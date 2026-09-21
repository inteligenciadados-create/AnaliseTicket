/**
 * BACKEND GOOGLE APPS SCRIPT - AUDITORIA E COMPARADOR AVANÇADO DE HOSPITAIS (SIH/SUS)
 * Projeto: Hospital Universitário Ciências Médicas (HUCM / FELUMA)
 * 
 * Função doGet: Serve a interface HTML5/Bootstrap no Google Workspace
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Comparador Avançado de Hospitais - FELUMA / HUCM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Retorna lista única de estabelecimentos hospitalares cadastrados na planilha,
 * desconsiderando rigorosamente qualquer linha de TOTAL ou vazia.
 */
function getHospitaisDisponiveis() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const colHospIndex = headers.indexOf("HOSPITAL");
  const colAihIndex = headers.indexOf("SP_NAIH");

  const hospSet = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const hosp = String(row[colHospIndex] || "").trim();
    const aih = String(row[colAihIndex] || "").trim();

    // REGRA RIGOROSA: Desconsiderar TOTAL e linhas vazias
    if (!hosp || hosp.toUpperCase().indexOf("TOTAL") !== -1) continue;
    if (!aih || aih.toUpperCase().indexOf("TOTAL") !== -1) continue;

    hospSet[hosp] = true;
  }

  return Object.keys(hospSet).sort();
}

/**
 * Processa a comparação detalhada e customizada entre Hospital A e Hospital B.
 * 
 * Regras estritas aplicadas:
 * 1. Tratamento de Linhas Totalizadoras: Ignora qualquer linha onde Coluna B (HOSPITAL) 
 *    ou Coluna C (SP_NAIH) contenha 'TOTAL' ou seja vazia.
 * 2. Agrupamento por AIH Única: Evita duplicidade de contagem de pacientes.
 * 3. Seção 1: Procedimentos Compartilhados onde Hospital A tem Maior Qtd AIHs E Menor Ticket Médio.
 * 4. Seção 2: Oportunidades Exclusivas onde Hospital B realizou procedimentos e Hospital A teve Volume = 0.
 * 5. Detalhamento de AIHs individuais agrupadas por hospital e ordenadas do maior valor para o menor.
 * 
 * @param {string} hospitalA - Nome da instituição de referência (ex: HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS)
 * @param {string} hospitalB - Nome do hospital comparado (ex: HOSPITAL EVANGELICO DE BELO HORIZONTE)
 * @param {string} anoFilter - Filtro de ano ('2025', '2026' ou 'Todos')
 * @returns {Object} JSON estruturado com { shared: [], exclusive: [] }
 */
function processarComparacao(hospitalA, hospitalB, anoFilter) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { shared: [], exclusive: [], error: "A planilha ativa não contém registros." };
  }

  const headers = data[0];
  const idxHosp = headers.indexOf("HOSPITAL");
  const idxAih = headers.indexOf("SP_NAIH");
  const idxProcPrinc = headers.indexOf("PROCEDIMENTO PRINCIPAL");
  const idxProcAto = headers.indexOf("PROCEDIMENTO ATO");
  const idxValAto = headers.indexOf("SP_VALATO");
  const idxTicketReal = headers.indexOf("TICKET PROCEDIMENTO REAL");
  const idxQtdAto = headers.indexOf("SP_QTD_ATO");
  const idxDtInter = headers.indexOf("SP_DTINTER");
  const idxDtSaida = headers.indexOf("SP_DTSAIDA");
  const idxAno = headers.indexOf("SP_AA");
  const idxProcCod = headers.indexOf("SP_PROCREA");

  // Estrutura de agrupamento em memória:
  // procMap[procName] = { code, name, hospA: { [naih]: aihData }, hospB: { [naih]: aihData } }
  const procMap = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const hosp = String(row[idxHosp] || "").trim();
    const aih = String(row[idxAih] || "").trim();

    // 1. REGRAS RIGOROSAS: Desconsiderar linhas totalizadoras e vazias
    if (!hosp || hosp.toUpperCase().indexOf("TOTAL") !== -1) continue;
    if (!aih || aih.toUpperCase().indexOf("TOTAL") !== -1) continue;

    const isHospA = hosp === hospitalA;
    const isHospB = hosp === hospitalB;
    if (!isHospA && !isHospB) continue;

    // Filtro opcional por ano
    if (anoFilter && anoFilter !== "Todos") {
      const rowAno = row[idxAno] ? String(row[idxAno]) : "";
      if (rowAno && rowAno.indexOf(anoFilter) === -1) continue;
    }

    const procName = String(row[idxProcPrinc] || "NÃO ESPECIFICADO").trim();
    const procCod = (idxProcCod !== -1 && row[idxProcCod]) ? String(row[idxProcCod]) : "SIH";

    if (!procMap[procName]) {
      procMap[procName] = {
        code: procCod,
        name: procName,
        hospA: {},
        hospB: {}
      };
    }

    const targetHospMap = isHospA ? procMap[procName].hospA : procMap[procName].hospB;

    // Identificação de Diárias de UTI
    const actDesc = idxProcAto !== -1 ? String(row[idxProcAto] || "").toUpperCase() : "";
    const isUTI = actDesc.indexOf("UTI") !== -1 || actDesc.indexOf("TERAPIA INTENSIVA") !== -1;
    const qtdAto = (idxQtdAto !== -1 && row[idxQtdAto]) ? Number(row[idxQtdAto]) : 1;

    // Dias de permanência
    const dtInter = row[idxDtInter];
    const dtSaida = row[idxDtSaida];
    let permanence = 1;
    if (dtInter && dtSaida) {
      const d1 = parseDataSUS(dtInter);
      const d2 = parseDataSUS(dtSaida);
      if (d1 && d2) {
        const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        permanence = diff > 0 ? diff : 1;
      }
    }

    const valAto = parseNumeroMoeda(row[idxValAto]);
    const explicitTicket = (idxTicketReal !== -1 && row[idxTicketReal]) ? parseNumeroMoeda(row[idxTicketReal]) : 0;

    if (!targetHospMap[aih]) {
      targetHospMap[aih] = {
        naih: aih,
        hospital: hosp,
        finalTicket: explicitTicket > 0 ? explicitTicket : valAto,
        utiDays: isUTI ? qtdAto : 0,
        permanence: permanence,
        dtInter: dtInter,
        dtSaida: dtSaida
      };
    } else {
      if (isUTI) targetHospMap[aih].utiDays += qtdAto;
      if (targetHospMap[aih].finalTicket === 0 && explicitTicket > 0) {
        targetHospMap[aih].finalTicket = explicitTicket;
      } else if (!explicitTicket) {
        targetHospMap[aih].finalTicket += valAto;
      }
    }
  }

  // Agregações finais para Seção 1 e Seção 2
  const sharedList = [];
  const exclusiveList = [];

  for (const procName in procMap) {
    const entry = procMap[procName];

    // Hospital A: lista e ordenação de AIHs do maior para o menor valor
    const aihsA = Object.values(entry.hospA);
    aihsA.sort((x, y) => y.finalTicket - x.finalTicket);

    const countA = aihsA.length;
    let totalFatA = 0;
    let totalUtiA = 0;
    let sumPermA = 0;
    aihsA.forEach(a => {
      totalFatA += a.finalTicket;
      totalUtiA += a.utiDays;
      sumPermA += a.permanence;
    });
    const avgTicketA = countA > 0 ? totalFatA / countA : 0;
    const avgPermA = countA > 0 ? sumPermA / countA : 0;

    // Hospital B: lista e ordenação de AIHs do maior para o menor valor
    const aihsB = Object.values(entry.hospB);
    aihsB.sort((x, y) => y.finalTicket - x.finalTicket);

    const countB = aihsB.length;
    let totalFatB = 0;
    let totalUtiB = 0;
    let sumPermB = 0;
    aihsB.forEach(b => {
      totalFatB += b.finalTicket;
      totalUtiB += b.utiDays;
      sumPermB += b.permanence;
    });
    const avgTicketB = countB > 0 ? totalFatB / countB : 0;
    const avgPermB = countB > 0 ? sumPermB / countB : 0;

    // SEÇÃO 1: Procedimentos Compartilhados (Hosp A com Maior Volume e Menor Ticket)
    if (countA > 0 && countB > 0) {
      if (countA > countB && avgTicketA < avgTicketB) {
        sharedList.push({
          code: entry.code,
          name: procName,
          aihsA: countA,
          aihsB: countB,
          utiDaysA: totalUtiA,
          utiDaysB: totalUtiB,
          avgPermanenceA: avgPermA,
          avgPermanenceB: avgPermB,
          avgTicketA: avgTicketA,
          avgTicketB: avgTicketB,
          totalFaturadoA: totalFatA,
          totalFaturadoB: totalFatB,
          aihsDetailsA: aihsA,
          aihsDetailsB: aihsB
        });
      }
    }

    // SEÇÃO 2: Oportunidades Exclusivas (Realizados apenas no Hospital B)
    if (countA === 0 && countB > 0) {
      exclusiveList.push({
        code: entry.code,
        name: procName,
        aihsB: countB,
        utiDaysB: totalUtiB,
        avgPermanenceB: avgPermB,
        avgTicketB: avgTicketB,
        totalFaturadoB: totalFatB,
        aihsDetailsB: aihsB
      });
    }
  }

  // Ordenação padrão: Maior volume de AIHs no Hospital A
  sharedList.sort((a, b) => b.aihsA - a.aihsA);
  exclusiveList.sort((a, b) => b.totalFaturadoB - a.totalFaturadoB);

  const totalAihsBExcl = exclusiveList.reduce((acc, x) => acc + x.aihsB, 0);
  const totalFatBExcl = exclusiveList.reduce((acc, x) => acc + x.totalFaturadoB, 0);
  const avgTicketExcl = totalAihsBExcl > 0 ? totalFatBExcl / totalAihsBExcl : 0;

  const summaryExclusive = {
    totalCount: exclusiveList.length,
    totalAihsB: totalAihsBExcl,
    totalFaturadoB: totalFatBExcl,
    totalUtiB: exclusiveList.reduce((acc, x) => acc + x.utiDaysB, 0),
    avgTicketGlobalB: avgTicketExcl
  };

  const summaryShared = {
    totalCount: sharedList.length,
    totalAihsA: sharedList.reduce((acc, x) => acc + x.aihsA, 0),
    totalAihsB: sharedList.reduce((acc, x) => acc + x.aihsB, 0),
    totalFaturadoA: sharedList.reduce((acc, x) => acc + x.totalFaturadoA, 0)
  };

  return {
    shared: sharedList,
    exclusive: exclusiveList,
    summaryShared: summaryShared,
    summaryExclusive: summaryExclusive
  };
}

/**
 * Converte strings monetárias no padrão brasileiro (1.234,56) para número float.
 */
function parseNumeroMoeda(val) {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const clean = String(val).replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

/**
 * Realiza o parsing de datas SUS no formato YYYYMMDD ou Date.
 */
function parseDataSUS(dtVal) {
  if (!dtVal) return null;
  if (dtVal instanceof Date) return dtVal;
  const str = String(dtVal).replace(/\D/g, "");
  if (str.length === 8) {
    const y = parseInt(str.substring(0, 4), 10);
    const m = parseInt(str.substring(4, 6), 10) - 1;
    const d = parseInt(str.substring(6, 8), 10);
    return new Date(y, m, d);
  }
  return null;
}
