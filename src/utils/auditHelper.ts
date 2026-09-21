import { SUSRecord, AuditGap, HospitalBenchmark } from "../types";
import { parseVal } from "../data/mockData";

/**
 * Classifies any procedure into its respective specialty based on codes/descriptions
 * matching the structures found in the Unimed TUSS / AMB standard PDF guidelines.
 */
export function classifyProcedureSpecialty(procedureName: string): string {
  const norm = (procedureName || "").toUpperCase();

  // 15 - NEFROLOGIA
  if (norm.includes("DIÁLISE") || norm.includes("DIALISE") || norm.includes("HEMODIÁLISE") || norm.includes("HEMODIALISE") || norm.includes("NEFROLOGIA") || norm.includes("PERITONEAL") || norm.includes("PERCUTÂNEA") || norm.includes("Biópsia renal") || norm.includes("BIOPSIA RENAL")) {
    return "15 - NEFROLOGIA";
  }

  // 20 - CARDIOLOGIA
  if (norm.includes("ANGIOPLASTIA") || norm.includes("CORONARIANA") || norm.includes("STENT") || norm.includes("CARDIOLOGIA") || norm.includes("CARDÍACA") || norm.includes("CARDIACA") || norm.includes("HEMODINÂMICA") || norm.includes("DOPPLER") || norm.includes("ECG") || norm.includes("ELETROCARDIOGRAMA") || norm.includes("MARCA-PASSO") || norm.includes("CINTILOGRAFIA DO MIOCARDIO") || norm.includes("TROPONINA") || norm.includes("VALVOPATIA") || norm.includes("MARCAPASSO") || norm.includes("RESONÂNCIA CARDÍACA")) {
    return "20 - CARDIOLOGIA";
  }

  // 16 - ANESTESIOLOGIA
  if (norm.includes("ANESTESIA") || norm.includes("BLOQUEIO ANESTÉSICO") || norm.includes("ANESTESIOLOGIA") || norm.includes("BLOQUEIO GÂNGLIO") || norm.includes("ANALGESIA")) {
    return "16 - ANESTESIOLOGIA";
  }

  // 23 - ENDOSCOPIA DIGESTIVA
  if (norm.includes("ENDOSCOPIA") || norm.includes("COLONOSCOPIA") || norm.includes("RETOSSIGMOIDOSCOPIA") || norm.includes("ANUSCOPIA") || norm.includes("ECOENDOSCOPIA") || norm.includes("LAPAROSCOPIA") || norm.includes("ENTEROSCOPIA")) {
    return "23 - ENDOSCOPIA DIGESTIVA";
  }

  // 45 - GINECOLOGIA E OBSTETRICIA
  if (norm.includes("PARTO") || norm.includes("CESÁREO") || norm.includes("CESAREO") || norm.includes("GINECOLOGIA") || norm.includes("OBSTETRÍCIA") || norm.includes("OBSTETRICIA") || norm.includes("HISTERECTOMIA") || norm.includes("ÓVARIO") || norm.includes("OVARIO") || norm.includes("UTERINA") || norm.includes("GESTACAO") || norm.includes("COLO") || norm.includes("VAGINAL") || norm.includes("VULVA") || norm.includes("MAMA") || norm.includes("MASCTECTOMIA") || norm.includes("AMNIOSCOPIA") || norm.includes("OBSTÉTRICO") || norm.includes("OBSTETRICO")) {
    return "45 - GINECOLOGIA E OBSTETRICIA";
  }

  // 43 - CIRURGIA DO APARELHO DIGESTIVO
  if (norm.includes("COLECISTECTOMIA") || norm.includes("RESSUTURA DE PAREDE ABDOMINAL") || norm.includes("DEISCENCIA") || norm.includes("EVISCERACAO") || norm.includes("PAREDE ABDOMINAL") || norm.includes("HERNIA") || norm.includes("APENDICECTOMIA") || norm.includes("GASTRECTOMIA") || norm.includes("ESÔFAGO") || norm.includes("ESOFAGO") || norm.includes("ESTÔMAGO") || norm.includes("ESTOMAGO") || norm.includes("INTESTINO") || norm.includes("COLON") || norm.includes("ANUS") || norm.includes("APARELHO DIGESTIVO") || norm.includes("COLECTOMIA") || norm.includes("HEMORROIDECTOMIA") || norm.includes("FISTULECTOMIA") || norm.includes("PANCREAS") || norm.includes("BAÇO") || norm.includes("BEXIGA") || norm.includes("ABDOMINAL")) {
    return "43 - CIRURGIA DO APARELHO DIGESTIVO, ORGÃOS ANEXOS E PAREDE ABDOMINAL";
  }

  // 52 - ORTOPEDIA E TRAUMATOLOGIA
  if (norm.includes("ARTROPLASTIA") || norm.includes("QUADRIL") || norm.includes("ORTOPEDIA") || norm.includes("TRAUMATOLOGIA") || norm.includes("FRATURA") || norm.includes("CÓCCIX") || norm.includes("COCCIX") || norm.includes("COLUNA") || norm.includes("FÍBULA") || norm.includes("FIBULA") || norm.includes("CINTURA ESCAPULAR") || norm.includes("BRAÇO") || norm.includes("BRACÕ") || norm.includes("TENDÃO") || norm.includes("TENDON") || norm.includes("AMPUTAÇÃO") || norm.includes("AMPUTACAO") || norm.includes("IMOBILIZAÇÃO") || norm.includes("GESSADO") || norm.includes("ESQUELETO") || norm.includes("OSSEO") || norm.includes("JOELHO") || norm.includes("TORNOZELO") || norm.includes("PÉ") || norm.includes("PE ") || norm.includes("MÃO") || norm.includes("MAO")) {
    return "52 - ORTOPEDIA E TRAUMATOLOGIA";
  }

  // 21 - ANATOMIA PATOLOGICA E CITOPATOLOGICA
  if (norm.includes("PATOLOGIA") || norm.includes("CITOPATOLOGICA") || norm.includes("BIÓPSIA") || norm.includes("BIOPSIA") || norm.includes("PAAF") || norm.includes("CITOLÓGICO") || norm.includes("CITOLOGICO") || norm.includes("NEOPLÁSICAS") || norm.includes("AMPUTACAO") || norm.includes("ANATOMOPATOLOGICO") || norm.includes("ANATOMOPATOLÓGICO") || norm.includes("PEÇAS") || norm.includes("PECAS")) {
    return "21 - ANATOMIA PATOLOGICA E CITOPATOLOGICA";
  }

  // 28 - PATOLOGIA CLINICA
  if (norm.includes("CREATININA") || norm.includes("POTÁSSIO") || norm.includes("POTASSIO") || norm.includes("SÓDIO") || norm.includes("SODIO") || norm.includes("HEMOGRAMA") || norm.includes("PATOLOGIA CLINICA") || norm.includes("BIOQUIMICA") || norm.includes("URINA") || norm.includes("GLICEMIA") || norm.includes("SANGUE") || norm.includes("GLUCOSE") || norm.includes("FEZES") || norm.includes("HORMÔNIOS") || norm.includes("HORMONIOS") || norm.includes("IMUNOLOGIA") || norm.includes("EXAME") || norm.includes("DOSAGEM") || norm.includes("CLEARANCE") || norm.includes("GASOMETRIA") || norm.includes("TSH") || norm.includes("TROPONINA")) {
    return "28 - PATOLOGIA CLINICA";
  }

  // 14 - MEDICINA INTENSIVA
  if (norm.includes("UTI") || norm.includes("MEDICINA INTENSIVA") || norm.includes("DIÁRIA DE UTI") || norm.includes("DIARIA DE UTI") || norm.includes("INTENSIVISTA")) {
    return "14 - MEDICINA INTENSIVA";
  }

  // 12 - PSIQUIATRIA
  if (norm.includes("PSIQUIATRIA") || norm.includes("TERAPIA") || norm.includes("PSICOTERAPIA") || norm.includes("PSICOLOGIA") || norm.includes("SESSAO DE")) {
    return "12 - PSIQUIATRIA";
  }

  // 26 - GENETICA
  if (norm.includes("GENÉTICA") || norm.includes("GENETICA") || norm.includes("CARIÓTIPO") || norm.includes("CARIOTIPO") || norm.includes("DNA") || norm.includes("CROMOSSOMO")) {
    return "26 - GENETICA";
  }

  // 27 - HEMOTERAPIA
  if (norm.includes("HEMOTERAPIA") || norm.includes("SANGUE TOTAL") || norm.includes("HEMÁCIAS") || norm.includes("HEMACIAS") || norm.includes("PLASMA") || norm.includes("PLAQUETAS") || norm.includes("SANGRIA")) {
    return "27 - HEMOTERAPIA";
  }

  // 33 - ULTRA-SONOGRAFIA
  if (norm.includes("ULTRA-SONOGRAFIA") || norm.includes("ULTRASSONOGRAFIA") || norm.includes("USG") || norm.includes("ECODOPPLER")) {
    return "33 - ULTRA-SONOGRAFIA";
  }

  // 34 - TOMOGRAFIA COMPUTADORIZADA
  if (norm.includes("TOMOGRAFIA") || norm.includes("COMPUTADORIZADA") || norm.includes("ANGIOTOMOGRAFIA")) {
    return "34 - TOMOGRAFIA COMPUTADORIZADA";
  }

  // 32 - RADIODIAGNOSTICO
  if (norm.includes("RX") || norm.includes("RADIOGRAFIA") || norm.includes("RADIODIAGNÓSTICO") || norm.includes("RADIODIAGNOSTICO") || norm.includes("RAIO X") || norm.includes("RAIOS X")) {
    return "32 - RADIODIAGNOSTICO";
  }

  // Default fallback according to PDF AMB/TUSS
  if (norm.includes("CONSULTA")) {
    return "00 - CONSULTAS";
  }

  return "01 - CLÍNICA MÉDICA";
}

/**
 * Extracts and maps specialties for each unique Procedimento Principal.
 */
export function getSpecialtiesForProcedures(
  records: SUSRecord[],
  specialtyMap: { [key: string]: string }
): { procedure: string; specialty: string }[] {
  const uniqProcedures = Array.from(
    new Set(records.map((r) => r["PROCEDIMENTO PRINCIPAL"]))
  );
  return uniqProcedures.map((proc) => {
    // Dynamically classify based on our auditor standard from Unimed PDF or fallback to mock map
    const specialty = specialtyMap[proc] ?? classifyProcedureSpecialty(proc);
    return {
      procedure: proc,
      specialty,
    };
  });
}

/**
 * Analyzes the benchmark hospital and HUCM faturamento metrics for a given Procedimento Principal
 */
export function analyzeProcedureBenchmark(
  records: SUSRecord[],
  procedimentoPrincipal: string
): {
  benchmarkHospital: string;
  benchmarkNaih: number;
  benchmarkTicket: number;
  benchmarkAvgTicket: number;
  benchmarkMaxTicket: number;
  hucmTicket: number;
  hucmAvgTicket: number;
  hucmMaxTicket: number;
  hucmNaih: number;
  hospitals: HospitalBenchmark[];
} {
  // Filter all records by procedure (regardless of Valida to ensure we pull full AIH faturamento totals)
  const procRecordsAll = records.filter(
    (r) => r["PROCEDIMENTO PRINCIPAL"] === procedimentoPrincipal
  );

  if (procRecordsAll.length === 0) {
    return {
      benchmarkHospital: "Não encontrado",
      benchmarkNaih: 0,
      benchmarkTicket: 0,
      benchmarkAvgTicket: 0,
      benchmarkMaxTicket: 0,
      hucmTicket: 0,
      hucmAvgTicket: 0,
      hucmMaxTicket: 0,
      hucmNaih: 0,
      hospitals: [],
    };
  }

  // Find all AIHs for this procedure and compute their tickets
  // Group by NAIH to calculate the complete faturamento for each AIH
  const aihGroups: {
    [naih: number]: {
      naih: number;
      hospital: string;
      explicitTicket: number;
      sumValAtos: number;
      isIncentivized: boolean;
      acts: { code: number; name: string; val: number; qty: number }[];
    };
  } = {};

  procRecordsAll.forEach((r) => {
    const naih = r.SP_NAIH;
    const isInc = String(naih).startsWith("312555");
    if (!aihGroups[naih]) {
      aihGroups[naih] = {
        naih,
        hospital: r.HOSPITAL,
        explicitTicket: 0,
        sumValAtos: 0,
        isIncentivized: isInc,
        acts: [],
      };
    }

    // Capture explicit ticket from any row of this NAIH that has it specified
    if (r["TICKET PROCEDIMENTO REAL"] !== undefined && r["TICKET PROCEDIMENTO REAL"] !== null) {
      const parsedVal = parseVal(r["TICKET PROCEDIMENTO REAL"]);
      if (parsedVal > 0) {
        aihGroups[naih].explicitTicket = parsedVal;
      }
    }

    const valTotal = parseVal(r.SP_VALATO);
    const qty = r.SP_QTD_ATO || 1;
    const valUnit = qty > 0 ? valTotal / qty : valTotal;
    aihGroups[naih].sumValAtos += valTotal;
    aihGroups[naih].acts.push({
      code: r.SP_ATOPROF,
      name: r["PROCEDIMENTO ATO"],
      val: valUnit,
      qty: qty,
    });
  });

  // For each AIH group, determine the total faturamento.
  // We use the explicitTicket if specified, otherwise the sum of acts.
  const aihs = Object.values(aihGroups).map((g) => {
    return {
      ...g,
      finalTicket: g.explicitTicket > 0 ? g.explicitTicket : g.sumValAtos,
    };
  });

  // Find HUCM AIHs and compute their average and maximum tickets
  const hucmAihs = aihs.filter((a) =>
    a.hospital.toUpperCase().includes("CIENCIAS MEDICAS") ||
    a.hospital.toUpperCase().includes("HUCM")
  );

  const hucmMaxAih = hucmAihs.length > 0
    ? hucmAihs.reduce((prev, curr) => (curr.finalTicket > prev.finalTicket ? curr : prev))
    : null;

  const hucmMaxTicket = hucmMaxAih ? hucmMaxAih.finalTicket : 0;
  const hucmAvgTicket = hucmAihs.length > 0
    ? hucmAihs.reduce((sum, a) => sum + a.finalTicket, 0) / hucmAihs.length
    : 0;
  const hucmNaih = hucmMaxAih ? hucmMaxAih.naih : 0;

  // Let's look for a non-HUCM competitor with the highest ticket as our benchmark!
  const nonHucmAihs = aihs.filter((a) =>
    !a.hospital.toUpperCase().includes("CIENCIAS MEDICAS") &&
    !a.hospital.toUpperCase().includes("HUCM")
  );

  const benchmarkAih = nonHucmAihs.length > 0
    ? nonHucmAihs.reduce((prev, curr) => (curr.finalTicket > prev.finalTicket ? curr : prev))
    : (aihs.length > 0 ? aihs.reduce((prev, curr) => (curr.finalTicket > prev.finalTicket ? curr : prev)) : null);

  // Aggregate stats per hospital
  const hospStatsMap: {
    [name: string]: {
      name: string;
      tickets: number[];
      isEligible: boolean;
    };
  } = {};

  aihs.forEach((a) => {
    if (!hospStatsMap[a.hospital]) {
      hospStatsMap[a.hospital] = {
        name: a.hospital,
        tickets: [],
        isEligible: false,
      };
    }
    hospStatsMap[a.hospital].tickets.push(a.finalTicket);
    if (a.isIncentivized) {
      hospStatsMap[a.hospital].isEligible = true;
    }
  });

  const hospitals: HospitalBenchmark[] = Object.values(hospStatsMap).map((h) => {
    const sum = h.tickets.reduce((a, b) => a + b, 0);
    const avg = sum / h.tickets.length;
    const max = Math.max(...h.tickets);
    return {
      hospitalName: h.name,
      ticketMax: max,
      ticketAvg: avg,
      isEligibleForIncentive: h.isEligible,
      totalAIHs: h.tickets.length,
    };
  });

  // Sort hospitals by Max ticket descending
  hospitals.sort((a, b) => b.ticketMax - a.ticketMax);

  // Find benchmark hospital object to extract its average ticket
  const benchmarkHospitalObj = benchmarkAih ? hospitals.find((h) => h.hospitalName === benchmarkAih.hospital) : null;
  const benchmarkAvgTicket = benchmarkHospitalObj ? benchmarkHospitalObj.ticketAvg : (benchmarkAih ? benchmarkAih.finalTicket : 0);
  const benchmarkMaxTicket = benchmarkAih ? benchmarkAih.finalTicket : 0;

  return {
    benchmarkHospital: benchmarkAih ? benchmarkAih.hospital : "Nenhum",
    benchmarkNaih: benchmarkAih ? benchmarkAih.naih : 0,
    benchmarkTicket: benchmarkAvgTicket,
    benchmarkAvgTicket,
    benchmarkMaxTicket,
    hucmTicket: hucmAvgTicket,
    hucmAvgTicket,
    hucmMaxTicket,
    hucmNaih,
    hospitals,
  };
}

/**
 * Calculates faturamento item differences (O Pulo do Gato)
 * Highlights what is present in references that is missing in HUCM
 */
export function calculateAuditGaps(
  records: SUSRecord[],
  procedimentoPrincipal: string,
  benchmarkNaih: number,
  hucmNaih: number
): {
  benchmarkActs: { code: number; name: string; qty: number; value: number; total: number }[];
  hucmActs: { code: number; name: string; qty: number; value: number; total: number }[];
  gaps: AuditGap[];
} {
  // Pull all records for the procedure to understand the complete acts list
  const procRecordsAll = records.filter(
    (r) => r["PROCEDIMENTO PRINCIPAL"] === procedimentoPrincipal
  );

  // Reference AIH act rows
  const benchmarkRows = procRecordsAll.filter((r) => r.SP_NAIH === benchmarkNaih);
  // HUCM AIH act rows
  const hucmRows = hucmNaih > 0
    ? procRecordsAll.filter((r) => r.SP_NAIH === hucmNaih)
    : procRecordsAll.filter((r) =>
        r.HOSPITAL.toUpperCase().includes("CIENCIAS MEDICAS") ||
        r.HOSPITAL.toUpperCase().includes("HUCM")
      );

  // Group benchmark acts
  const benchmarkActsMap: { [key: string]: { code: number; name: string; qty: number; value: number; isValida: boolean } } = {};
  benchmarkRows.forEach((r) => {
    const name = r["PROCEDIMENTO ATO"];
    const code = Number(r.SP_ATOPROF || 0);
    const qty = r.SP_QTD_ATO || 1;
    const val = parseVal(r.SP_VALATO);
    const unitVal = qty > 0 ? val / qty : val;
    // Differentiate surgical component splits (surgeon, anest., hosp.) using both code and unit values
    const key = code > 0 ? `${code}_${unitVal.toFixed(2)}` : name;
    if (!benchmarkActsMap[key]) {
      benchmarkActsMap[key] = { code, name, qty: 0, value: unitVal, isValida: r.Valida !== false };
    }
    benchmarkActsMap[key].qty += qty;
  });

  // Group HUCM acts
  const hucmActsMap: { [key: string]: { code: number; name: string; qty: number; value: number } } = {};
  hucmRows.forEach((r) => {
    const name = r["PROCEDIMENTO ATO"];
    const code = Number(r.SP_ATOPROF || 0);
    const qty = r.SP_QTD_ATO || 1;
    const val = parseVal(r.SP_VALATO);
    const unitVal = qty > 0 ? val / qty : val;
    // Differentiate surgical component splits (surgeon, anest., hosp.) using both code and unit values
    const key = code > 0 ? `${code}_${unitVal.toFixed(2)}` : name;
    if (!hucmActsMap[key]) {
      hucmActsMap[key] = { code, name, qty: 0, value: unitVal };
    }
    hucmActsMap[key].qty += qty;
  });

  const benchmarkActs = Object.values(benchmarkActsMap).map((data) => ({
    code: data.code,
    name: data.name,
    qty: data.qty,
    value: data.value,
    total: data.qty * data.value,
  }));

  const hucmActs = Object.values(hucmActsMap).map((data) => ({
    code: data.code,
    name: data.name,
    qty: data.qty,
    value: data.value,
    total: data.qty * data.value,
  }));

  // Identify Gaps: items in benchmark but absent in HUCM
  const gaps: AuditGap[] = [];
  Object.entries(benchmarkActsMap).forEach(([key, refData]) => {
    // Only flag as gap if the item is marked as a valid clinical auditable item (refData.isValida === true)
    if (!refData.isValida) {
      return;
    }
    const hasInHUCM = hucmActsMap[key] !== undefined && hucmActsMap[key].qty > 0;
    if (!hasInHUCM) {
      const name = refData.name;
      let estimatedVal = refData.value;
      if (estimatedVal === 0) {
        if (name.includes("CREATININA")) estimatedVal = 15.20;
        else if (name.includes("POTASSIO")) estimatedVal = 18.45;
        else if (name.includes("SODIO")) estimatedVal = 18.45;
        else if (name.includes("UTI ADULTO")) estimatedVal = 1500.00;
        else if (name.includes("HEMOGRAMA")) estimatedVal = 20.50;
        else if (name.includes("FISIOTERAPIA")) estimatedVal = 45.00;
        else if (name.includes("ULTRA-SONOGRAFIA")) estimatedVal = 180.00;
        else estimatedVal = 45.00;
      }

      const totalLoss = refData.qty * estimatedVal;

      gaps.push({
        procedimentoAto: name,
        codigoAto: refData.code || 301010048,
        estimatedLoss: totalLoss,
        frequencyInBenchmark: refData.qty,
        frequencyInHUCM: 0,
        avgValue: estimatedVal,
      });
    }
  });

  // Sort gaps by estimated loss descending
  gaps.sort((a, b) => b.estimatedLoss - a.estimatedLoss);

  return {
    benchmarkActs,
    hucmActs,
    gaps,
  };
}

/**
 * Audit system parameters to identify percentage of Incentivized AIHs
 * and explain the model differences (Normal starts with 312515, Incentivized with 312555)
 */
export function analyzeFundingModels(records: SUSRecord[]): {
  incentivizedCount: number;
  normalCount: number;
  incentivizedRatio: number;
  avgIncentivizedTicket: number;
  avgNormalTicket: number;
  factorDiffPercent: number;
} {
  // Extract unique AIHs across the entire database to ensure accurate ratios and counts
  const aihTotals: { [naih: number]: { isInc: boolean; ticket: number } } = {};

  records.forEach((r) => {
    const naih = r.SP_NAIH;
    const isInc = String(naih).startsWith("312555");
    const val = parseVal(r.SP_VALATO);
    const qty = r.SP_QTD_ATO || 1;
    const explicitTicket = r["TICKET PROCEDIMENTO REAL"]
      ? parseVal(r["TICKET PROCEDIMENTO REAL"])
      : 0;

    if (!aihTotals[naih]) {
      aihTotals[naih] = { isInc, ticket: explicitTicket };
    }
    
    // Update if any row contains explicit ticket
    if (aihTotals[naih].ticket === 0 && explicitTicket > 0) {
      aihTotals[naih].ticket = explicitTicket;
    }
    
    // If no explicit ticket is present, keep summing acts
    if (aihTotals[naih].ticket === 0) {
      aihTotals[naih].ticket += val;
    }
  });

  let incSum = 0;
  let incCount = 0;
  let normSum = 0;
  let normCount = 0;

  Object.values(aihTotals).forEach((a) => {
    if (a.isInc) {
      incSum += a.ticket;
      incCount++;
    } else {
      normSum += a.ticket;
      normCount++;
    }
  });

  const avgIncentivizedTicket = incCount > 0 ? incSum / incCount : 0;
  const avgNormalTicket = normCount > 0 ? normSum / normCount : 0;

  // Percentage difference: how much higher are incentivized tickets on average
  const factorDiffPercent = avgNormalTicket > 0
    ? ((avgIncentivizedTicket - avgNormalTicket) / avgNormalTicket) * 100
    : 0;

  return {
    incentivizedCount: incCount,
    normalCount: normCount,
    incentivizedRatio: (incCount / (incCount + normCount || 1)) * 100,
    avgIncentivizedTicket,
    avgNormalTicket,
    factorDiffPercent,
  };
}
