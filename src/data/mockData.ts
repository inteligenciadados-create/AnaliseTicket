import { SUSRecord, SpecialtyMap } from "../types";

export const MOCK_SPECIALTIES: SpecialtyMap = {
  "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)": "CIRURGIA GERAL",
  "COLECISTECTOMIA": "CIRURGIA GERAL",
  "PARTO CESAREO EM GESTACAO DE ALTO RISCO": "GINECOLOGIA E OBSTETRICIA",
  "HISTERECTOMIA TOTAL": "GINECOLOGIA E OBSTETRICIA",
  "ANGIOPLASTIA CORONARIANA COM IMPLANTE DE STENT": "CARDIOLOGIA",
  "ARTROPLASTIA DE QUADRIL E RECONSTRUCAO": "ORTOPEDIA",
};

// Helper to format string currency appropriately
export const parseVal = (valStr: string | null | undefined): number => {
  if (!valStr) return 0;
  // Replace dots for thousands and comma for decimal
  const clean = valStr.replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

export const formatVal = (num: number): string => {
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const createMockRecord = (
  aih: number,
  hospital: string,
  procPrincipal: string,
  procAto: string,
  valAto: string,
  ticketReal: string | null,
  qtdAto: number = 1,
  valida: boolean = true,
  cid: string = "K450"
): SUSRecord => {
  return {
    SP_GESTOR: 310620,
    SP_UF: 31,
    SP_AA: 2026,
    SP_MM: 1,
    SP_CNES: hospital === "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS" ? 22003 : 26972,
    SP_NAIH: aih,
    SP_PROCREA: 407040242,
    SP_DTINTER: 20250704,
    SP_DTSAIDA: 20250901,
    SP_NUM_PR: 0,
    SP_TIPO: 0,
    SP_CPFCGC: 26972,
    SP_ATOPROF: 301010048,
    SP_TP_ATO: 0,
    SP_QTD_ATO: qtdAto,
    SP_PTSP: 0,
    SP_NF: 0,
    SP_VALATO: valAto,
    SP_M_HOSP: 310620,
    SP_M_PAC: 314560,
    SP_DES_HOS: 0,
    SP_DES_PAC: 1,
    SP_COMPLEX: 2,
    SP_FINANC: 6,
    SP_CO_FAEC: 0,
    SP_PF_CBO: 223505,
    SP_PF_DOC: 707807623277310,
    SP_PJ_DOC: 26972,
    IN_TP_VAL: 1,
    SEQUENCIA: 6615,
    REMESSA: "HM31062001N202601.DTS",
    SERV_CLA: 0,
    SP_CIDPRI: cid,
    SP_CIDSEC: 0,
    SP_QT_PROC: qtdAto,
    SP_U_AIH: 0,
    FONTE_ORC: 0,
    HOSPITAL: hospital,
    "PROCEDIMENTO ATO": procAto,
    "PROCEDIMENTO PRINCIPAL": procPrincipal,
    CONCATENADO: `${aih}-${procPrincipal.slice(0, 5)}`,
    "TICKET PROCEDIMENTO REAL": ticketReal,
    "TICKET MÉDIO": "0,00",
    Valida: valida,
  };
};

export const MOCK_DATABASE: SUSRecord[] = [
  // ==========================================
  // RESSUTURA DE PAREDE ABDOMINAL
  // Benchmark: MATERNIDADE ODETE VALADARES (Normal AIH, high ticket due to ICU and laboratory)
  // AIH: 3125151304100
  createMockRecord(
    3125151304100,
    "MATERNIDADE ODETE VALADARES",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "CONSULTA DE PROFISSIONAIS DE NIVEL SUPERIOR NA ATENCAO ESPECIALIZADA (EXCETO MEDICO)",
    "350,00",
    "48.854,81",
    3,
    false,
    "K450"
  ),
  createMockRecord(
    3125151304100,
    "MATERNIDADE ODETE VALADARES",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "DIARIA DE UTI ADULTO TIPO III - CORONARIANA E INTENSIVA",
    "4.500,00",
    null,
    8,
    true,
    "K450"
  ),
  createMockRecord(
    3125151304100,
    "MATERNIDADE ODETE VALADARES",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "DOSAGEM DE POTASSIO",
    "18,45",
    null,
    15,
    true,
    "K450"
  ),
  createMockRecord(
    3125151304100,
    "MATERNIDADE ODETE VALADARES",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "DOSAGEM DE CREATININA",
    "15,20",
    null,
    15,
    true,
    "K450"
  ),
  createMockRecord(
    3125151304100,
    "MATERNIDADE ODETE VALADARES",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "DOSAGEM DE SODIO",
    "18,45",
    null,
    12,
    true,
    "K450"
  ),
  createMockRecord(
    3125151304100,
    "MATERNIDADE ODETE VALADARES",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "HEMOGRAMA COMPLETO",
    "20,50",
    null,
    10,
    true,
    "K450"
  ),
  createMockRecord(
    3125151304100,
    "MATERNIDADE ODETE VALADARES",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "FISIOTERAPIA RESPIRATORIA",
    "45,00",
    null,
    12,
    true,
    "K450"
  ),
  createMockRecord(
    3125151304100,
    "MATERNIDADE ODETE VALADARES",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "ULTRA-SONOGRAFIA DE ABDOMEN TOTAL",
    "180,00",
    null,
    2,
    true,
    "K450"
  ),

  // RESSUTURA DE PAREDE ABDOMINAL
  // Comparativo: HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS (HUCM) - Normal AIH (Missing critical items!)
  // AIH: 3125152200301
  createMockRecord(
    3125152200301,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "CONSULTA DE PROFISSIONAIS DE NIVEL SUPERIOR NA ATENCAO ESPECIALIZADA (EXCETO MEDICO)",
    "350,00",
    "12.450,00",
    1,
    true,
    "K450"
  ),
  createMockRecord(
    3125152200301,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "HEMOGRAMA COMPLETO",
    "20,50",
    null,
    2,
    true,
    "K450"
  ),
  // Missing POTASSIO, CREATININA, SODIO, UTI daily charges, FISIOTERAPIA!
  createMockRecord(
    3125152200301,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
    "DETERMINACAO DE TEMPO DE TROMBOPLASTINA PARCIAL ATIVADA (TTPA)",
    "32,00",
    null,
    1,
    true,
    "K450"
  ),

  // ==========================================
  // COLECISTECTOMIA
  // Benchmark 1: SANTA CASA DE BELO HORIZONTE (Normal AIH, R$ 8.600,00)
  // AIH: 3125159988771
  createMockRecord(
    3125159988771,
    "SANTA CASA DE BELO HORIZONTE",
    "COLECISTECTOMIA",
    "COLECISTECTOMIA (PROCEDIMENTO PRINCIPAL)",
    "1.800,00",
    "8.600,00",
    1,
    true,
    "K802"
  ),
  createMockRecord(
    3125159988771,
    "SANTA CASA DE BELO HORIZONTE",
    "COLECISTECTOMIA",
    "DOSAGEM DE POTASSIO",
    "18,45",
    null,
    4,
    true,
    "K802"
  ),
  createMockRecord(
    3125159988771,
    "SANTA CASA DE BELO HORIZONTE",
    "COLECISTECTOMIA",
    "DOSAGEM DE CREATININA",
    "15,20",
    null,
    4,
    true,
    "K802"
  ),
  createMockRecord(
    3125159988771,
    "SANTA CASA DE BELO HORIZONTE",
    "COLECISTECTOMIA",
    "ULTRA-SONOGRAFIA DE ABDOMEN TOTAL",
    "180,00",
    null,
    1,
    true,
    "K802"
  ),
  createMockRecord(
    3125159988771,
    "SANTA CASA DE BELO HORIZONTE",
    "COLECISTECTOMIA",
    "HEMOGRAMA COMPLETO",
    "20,50",
    null,
    3,
    true,
    "K802"
  ),
  createMockRecord(
    3125159988771,
    "SANTA CASA DE BELO HORIZONTE",
    "COLECISTECTOMIA",
    "DIARIA DE LEITO CLINICO HOSPITALAR",
    "350,00",
    null,
    4,
    true,
    "K802"
  ),

  // Benchmark 2: HOSPITAL EVANGELICO (Incentivized AIH, R$ 9.890,00 -> Starts with 312555!)
  // AIH: 3125559988220 (starts with 312555)
  createMockRecord(
    3125559988220,
    "HOSPITAL EVANGELICO",
    "COLECISTECTOMIA",
    "COLECISTECTOMIA (PROCEDIMENTO PRINCIPAL)",
    "1.800,00",
    "9.890,00",
    1,
    true,
    "K802"
  ),
  createMockRecord(
    3125559988220,
    "HOSPITAL EVANGELICO",
    "COLECISTECTOMIA",
    "DIARIA DE LEITO CLINICO HOSPITALAR",
    "350,00",
    null,
    5,
    true,
    "K802"
  ),
  createMockRecord(
    3125559988220,
    "HOSPITAL EVANGELICO",
    "COLECISTECTOMIA",
    "DOSAGEM DE POTASSIO",
    "18,45",
    null,
    6,
    true,
    "K802"
  ),
  createMockRecord(
    3125559988220,
    "HOSPITAL EVANGELICO",
    "COLECISTECTOMIA",
    "DOSAGEM DE CREATININA",
    "15,20",
    null,
    6,
    true,
    "K802"
  ),
  createMockRecord(
    3125559988220,
    "HOSPITAL EVANGELICO",
    "COLECISTECTOMIA",
    "ULTRA-SONOGRAFIA DE ABDOMEN TOTAL",
    "180,00",
    null,
    1,
    true,
    "K802"
  ),
  createMockRecord(
    3125559988220,
    "HOSPITAL EVANGELICO",
    "COLECISTECTOMIA",
    "DOSAGEM DE AMILASE",
    "24,00",
    null,
    2,
    true,
    "K802"
  ),

  // COLECISTECTOMIA
  // Comparativo: HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS (HUCM) - Normal AIH (Missing labs, USG)
  // AIH: 3125152200320
  createMockRecord(
    3125152200320,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "COLECISTECTOMIA",
    "COLECISTECTOMIA (PROCEDIMENTO PRINCIPAL)",
    "1.800,00",
    "4.200,00",
    1,
    true,
    "K802"
  ),
  createMockRecord(
    3125152200320,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "COLECISTECTOMIA",
    "HEMOGRAMA COMPLETO",
    "20,50",
    null,
    1,
    true,
    "K802"
  ),
  createMockRecord(
    3125152200320,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "COLECISTECTOMIA",
    "DIARIA DE LEITO CLINICO HOSPITALAR",
    "350,00",
    null,
    2,
    true,
    "K802"
  ),

  // ==========================================
  // PARTO CESAREO EM GESTACAO DE ALTO RISCO
  // Benchmark: MATERNIDADE ODETE VALADARES (Incentivized AIH - 3125557766551)
  createMockRecord(
    3125557766551,
    "MATERNIDADE ODETE VALADARES",
    "PARTO CESAREO EM GESTACAO DE ALTO RISCO",
    "PARTO CESAREO (PRINCIPAL)",
    "2.500,00",
    "7.200,00",
    1,
    true,
    "O820"
  ),
  createMockRecord(
    3125557766551,
    "MATERNIDADE ODETE VALADARES",
    "PARTO CESAREO EM GESTACAO DE ALTO RISCO",
    "OBSTETRIA DE PLANTAO (ATO PROFISSIONAL)",
    "600,00",
    null,
    1,
    true,
    "O820"
  ),
  createMockRecord(
    3125557766551,
    "MATERNIDADE ODETE VALADARES",
    "PARTO CESAREO EM GESTACAO DE ALTO RISCO",
    "PEDIATRA DE PLANTAO EM SALA DE PARTO",
    "450,00",
    null,
    1,
    true,
    "O820"
  ),
  createMockRecord(
    3125557766551,
    "MATERNIDADE ODETE VALADARES",
    "PARTO CESAREO EM GESTACAO DE ALTO RISCO",
    "DOSAGEM DE TSH",
    "35,00",
    null,
    2,
    true,
    "O820"
  ),
  createMockRecord(
    3125557766551,
    "MATERNIDADE ODETE VALADARES",
    "PARTO CESAREO EM GESTACAO DE ALTO RISCO",
    "ULTRA-SONOGRAFIA OBSTETRICA",
    "150,00",
    null,
    2,
    true,
    "O820"
  ),
  createMockRecord(
    3125557766551,
    "MATERNIDADE ODETE VALADARES",
    "PARTO CESAREO EM GESTACAO DE ALTO RISCO",
    "HEMOGRAMA COMPLETO",
    "20,50",
    null,
    3,
    true,
    "O820"
  ),

  // HUCM: (Normal AIH - 3125152200330)
  createMockRecord(
    3125152200330,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "PARTO CESAREO EM GESTACAO DE ALTO RISCO",
    "PARTO CESAREO (PRINCIPAL)",
    "2.500,00",
    "3.100,00",
    1,
    true,
    "O820"
  ),
  createMockRecord(
    3125152200330,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "PARTO CESAREO EM GESTACAO DE ALTO RISCO",
    "HEMOGRAMA COMPLETO",
    "20,50",
    null,
    1,
    true,
    "O820"
  ),
  // Missing PEDIATRA DE PLANTAO, OBSTETRIA PLANTAO, TSH, USG!

  // ==========================================
  // HISTERECTOMIA TOTAL
  // Benchmark: SANTA CASA DE BELO HORIZONTE (Normal AIH)
  createMockRecord(
    3125155544221,
    "SANTA CASA DE BELO HORIZONTE",
    "HISTERECTOMIA TOTAL",
    "HISTERECTOMIA TOTAL (PRINCIPAL)",
    "3.200,00",
    "14.800,00",
    1,
    true,
    "N800"
  ),
  createMockRecord(
    3125155544221,
    "SANTA CASA DE BELO HORIZONTE",
    "HISTERECTOMIA TOTAL",
    "DIARIA DE UTI ADULTO TIPO II",
    "1.200,00",
    null,
    3,
    true,
    "N800"
  ),
  createMockRecord(
    3125155544221,
    "SANTA CASA DE BELO HORIZONTE",
    "HISTERECTOMIA TOTAL",
    "ANATOMOPATOLOGICO DE BIopsia/pecas",
    "130,00",
    null,
    1,
    true,
    "N800"
  ),
  createMockRecord(
    3125155544221,
    "SANTA CASA DE BELO HORIZONTE",
    "HISTERECTOMIA TOTAL",
    "DOSAGEM DE EQUILIBRIO ACIDO-BASE (GASOMETRIA)",
    "55,00",
    null,
    3,
    true,
    "N800"
  ),
  createMockRecord(
    3125155544221,
    "SANTA CASA DE BELO HORIZONTE",
    "HISTERECTOMIA TOTAL",
    "DOSAGEM DE POTASSIO",
    "18,45",
    null,
    4,
    true,
    "N800"
  ),

  // Comparativo: HUCM
  createMockRecord(
    3125152200340,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "HISTERECTOMIA TOTAL",
    "HISTERECTOMIA TOTAL (PRINCIPAL)",
    "3.200,00",
    "4.100,00",
    1,
    true,
    "N800"
  ),
  // Missing ANATOMOPATOLOGICO, UTI, GASOMETRIA, POTASSIO!

  // ==========================================
  // ANGIOPLASTIA CORONARIANA COM IMPLANTE DE STENT
  // Benchmark: SANTA CASA DE BELO HORIZONTE (Incentivized - 3125551122334, R$ 34.500,00)
  createMockRecord(
    3125551122334,
    "SANTA CASA DE BELO HORIZONTE",
    "ANGIOPLASTIA CORONARIANA COM IMPLANTE DE STENT",
    "ANGIOPLASTIA CORONARIANA (PRINCIPAL)",
    "12.400,00",
    "34.500,00",
    1,
    true,
    "I219"
  ),
  createMockRecord(
    3125551122334,
    "SANTA CASA DE BELO HORIZONTE",
    "ANGIOPLASTIA CORONARIANA COM IMPLANTE DE STENT",
    "DIARIA DE UTI ADULTO TIPO III - CORONARIANA E INTENSIVA",
    "4.500,00",
    null,
    2,
    true,
    "I219"
  ),
  createMockRecord(
    3125551122334,
    "SANTA CASA DE BELO HORIZONTE",
    "ANGIOPLASTIA CORONARIANA COM IMPLANTE DE STENT",
    "DOSAGEM DE TROPONINA",
    "85,00",
    null,
    4,
    true,
    "I219"
  ),
  createMockRecord(
    3125551122334,
    "SANTA CASA DE BELO HORIZONTE",
    "ANGIOPLASTIA CORONARIANA COM IMPLANTE DE STENT",
    "DOSAGEM DE CREATINAQUINASE FRACAO MB (CKMB)",
    "42,00",
    null,
    4,
    true,
    "I219"
  ),
  createMockRecord(
    3125551122334,
    "SANTA CASA DE BELO HORIZONTE",
    "ANGIOPLASTIA CORONARIANA COM IMPLANTE DE STENT",
    "ELETROCARDIOGRAMA (ECG)",
    "35,00",
    null,
    5,
    true,
    "I219"
  ),

  // HUCM: (Normal AIH)
  createMockRecord(
    3125152200350,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "ANGIOPLASTIA CORONARIANA COM IMPLANTE DE STENT",
    "ANGIOPLASTIA CORONARIANA (PRINCIPAL)",
    "12.400,00",
    "18.500,00",
    1,
    true,
    "I219"
  ),
  createMockRecord(
    3125152200350,
    "HOSPITAL UNIVERSITARIO CIENCIAS MEDICAS",
    "ANGIOPLASTIA CORONARIANA COM IMPLANTE DE STENT",
    "ELETROCARDIOGRAMA (ECG)",
    "35,00",
    null,
    1,
    true,
    "I219"
  )
  // Missing ICU, troponin, ckmb!
];
