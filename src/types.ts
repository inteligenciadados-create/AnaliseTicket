export interface SUSRecord {
  SP_GESTOR: number;
  SP_UF: number;
  SP_AA: number;
  SP_MM: number;
  SP_CNES: number;
  SP_NAIH: number;
  SP_PROCREA: number;
  SP_DTINTER: number;
  SP_DTSAIDA: number;
  SP_NUM_PR: number;
  SP_TIPO: number;
  SP_CPFCGC: number;
  SP_ATOPROF: number;
  SP_TP_ATO: number;
  SP_QTD_ATO: number;
  SP_PTSP: number;
  SP_NF: number;
  SP_VALATO: string; // "X,XX"
  SP_M_HOSP: number;
  SP_M_PAC: number;
  SP_DES_HOS: number;
  SP_DES_PAC: number;
  SP_COMPLEX: number;
  SP_FINANC: number;
  SP_CO_FAEC: number;
  SP_PF_CBO: number;
  SP_PF_DOC: number;
  SP_PJ_DOC: number;
  IN_TP_VAL: number;
  SEQUENCIA: number;
  REMESSA: string;
  SERV_CLA: number;
  SP_CIDPRI: string;
  SP_CIDSEC: number | string;
  SP_QT_PROC: number;
  SP_U_AIH: number;
  FONTE_ORC: number;
  HOSPITAL: string;
  "PROCEDIMENTO ATO": string; // Secondary billed acts
  "PROCEDIMENTO PRINCIPAL": string; // Core procedure
  CONCATENADO: string;
  "TICKET PROCEDIMENTO REAL": string | null; // e.g. "48.854,81"
  "TICKET MÉDIO": string; // e.g. "0,00"
  Valida: boolean;
  _slotId?: number;
}

export interface SpecialtyMap {
  [procedimentoPrincipal: string]: string; // Maps procedure name to Specialty
}

export interface AuditGap {
  procedimentoAto: string;
  codigoAto: number;
  estimatedLoss: number;
  frequencyInBenchmark: number;
  frequencyInHUCM: number;
  avgValue: number;
}

export const RECORD_COLUMNS = [
  "SP_GESTOR", "SP_UF", "SP_AA", "SP_MM", "SP_CNES", "SP_NAIH", "SP_PROCREA",
  "SP_DTINTER", "SP_DTSAIDA", "SP_NUM_PR", "SP_TIPO", "SP_CPFCGC", "SP_ATOPROF",
  "SP_TP_ATO", "SP_QTD_ATO", "SP_PTSP", "SP_NF", "SP_VALATO", "SP_M_HOSP",
  "SP_M_PAC", "SP_DES_HOS", "SP_DES_PAC", "SP_COMPLEX", "SP_FINANC", "SP_CO_FAEC",
  "SP_PF_CBO", "SP_PF_DOC", "SP_PJ_DOC", "IN_TP_VAL", "SEQUENCIA", "REMESSA",
  "SERV_CLA", "SP_CIDPRI", "SP_CIDSEC", "SP_QT_PROC", "SP_U_AIH", "FONTE_ORC",
  "HOSPITAL", "PROCEDIMENTO ATO", "PROCEDIMENTO PRINCIPAL", "CONCATENADO",
  "TICKET PROCEDIMENTO REAL", "TICKET MÉDIO", "Valida", "_slotId"
];

export interface HospitalBenchmark {
  hospitalName: string;
  ticketMax: number;
  ticketAvg: number;
  isEligibleForIncentive: boolean;
  totalAIHs: number;
}
