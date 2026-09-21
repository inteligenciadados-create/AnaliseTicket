import fs from "fs";
import path from "path";
import zlib from "zlib";
import readline from "readline";
import Papa from "papaparse";
import { createRequire } from "module";

function getSqliteDatabaseClass(): any {
  try {
    if (typeof require !== "undefined") {
      return require("node:sqlite").DatabaseSync;
    }
    const req = createRequire(path.join(process.cwd(), "package.json"));
    return req("node:sqlite").DatabaseSync;
  } catch (err) {
    console.warn("Could not load node:sqlite:", err);
    return null;
  }
}

export interface SlotInfo {
  slotIndex: number;
  fileName: string;
  recordsCount: number;
  fileSizeBytes?: number;
  updatedAt: string;
}

export interface DatasetMetadata {
  fileName: string;
  totalRecords: number;
  uniqueAihs: number;
  uniqueHospitals: number;
  uniqueProcedures: number;
  hospitalsList: string[];
  proceduresList: string[];
  competencePeriod?: string;
  totalValueFormatted?: string;
  fileSizeBytes?: number;
  slots?: (SlotInfo | null)[];
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "fixed_database.json");
const GZ_FILE = path.join(DATA_DIR, "fixed_database.json.gz");
const METADATA_FILE = path.join(DATA_DIR, "fixed_metadata.json");

export function getSlotJsonPath(slotIndex: number): string {
  return path.join(DATA_DIR, `slot_${slotIndex}.json`);
}

export function getSlotGzPath(slotIndex: number): string {
  return path.join(DATA_DIR, `slot_${slotIndex}.json.gz`);
}

export function getSlotCompactJsonPath(slotIndex: number): string {
  return path.join(DATA_DIR, `slot_${slotIndex}.compact.json`);
}

export function getSlotCompactGzPath(slotIndex: number): string {
  return path.join(DATA_DIR, `slot_${slotIndex}.compact.json.gz`);
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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let sqliteInstance: any = null;

export function getSqliteDb(): any {
  if (!sqliteInstance) {
    try {
      const DatabaseSync = getSqliteDatabaseClass();
      if (!DatabaseSync) return null;
      ensureDataDir();
      const dbPath = path.join(DATA_DIR, "dataset.sqlite");
      sqliteInstance = new DatabaseSync(dbPath);
      sqliteInstance.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
      sqliteInstance.exec(`
        CREATE TABLE IF NOT EXISTS records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slot_id INTEGER,
          procedimento TEXT,
          hospital TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_records_proc ON records (procedimento);
        CREATE INDEX IF NOT EXISTS idx_records_hosp ON records (hospital);
      `);
    } catch (e) {
      console.warn("Could not initialize node:sqlite:", e);
      return null;
    }
  }
  return sqliteInstance;
}

export function queryProcedureRecords(procedureName: string): { cols: string[]; rows: any[][] } {
  try {
    const db = getSqliteDb();
    if (!db) {
      return { cols: RECORD_COLUMNS, rows: [] };
    }
    const stmt = db.prepare("SELECT data FROM records WHERE procedimento = ?");
    const results = stmt.all(procedureName.trim());
    const rows = results.map((r: any) => JSON.parse(r.data));
    return {
      cols: RECORD_COLUMNS,
      rows,
    };
  } catch (err) {
    console.error("Error querying procedure from SQLite:", err);
    return { cols: RECORD_COLUMNS, rows: [] };
  }
}

export interface ComparisonActItem {
  actCode?: string;
  actName: string;
  qtd: number;
  val: number;
}

export interface DetailedAihItem {
  naih: number;
  hospital: string;
  finalTicket: number;
  utiDays: number;
  permanence: number;
  dtInter?: number;
  dtSaida?: number;
  dtInterFormatted?: string;
  dtSaidaFormatted?: string;
  acts: ComparisonActItem[];
}

export interface ComparisonSharedProcedure {
  code: string;
  name: string;
  aihsA: number;
  utiDaysA: number;
  avgPermanenceA: number;
  avgTicketA: number;
  totalFaturadoA: number;
  aihsB: number;
  utiDaysB: number;
  avgPermanenceB: number;
  avgTicketB: number;
  totalFaturadoB: number;
  aihsDetailsA: DetailedAihItem[];
  aihsDetailsB: DetailedAihItem[];
}

export interface ComparisonExclusiveProcedure {
  code: string;
  name: string;
  aihsB: number;
  utiDaysB: number;
  avgPermanenceB: number;
  totalFaturadoB: number;
  avgTicketB: number;
  aihsDetailsB: DetailedAihItem[];
}

export interface ComparisonResultResponse {
  hospitalA: string;
  hospitalB: string;
  selectedYear: string;
  summaryShared: {
    totalCount: number;
    totalAihsA: number;
    totalAihsB: number;
    totalFaturadoA: number;
    totalFaturadoB: number;
  };
  summaryExclusive: {
    totalCount: number;
    totalAihsB: number;
    totalFaturadoB: number;
    totalUtiB: number;
    avgTicketGlobalB: number;
  };
  sharedProcedures: ComparisonSharedProcedure[];
  exclusiveProcedures: ComparisonExclusiveProcedure[];
  competencePeriod: {
    startYear: number;
    startMonth: number;
    endYear: number;
    endMonth: number;
    startFormatted: string;
    endFormatted: string;
    isSame: boolean;
    label: string;
  } | null;
}

const comparisonCache = new Map<string, ComparisonResultResponse>();

export function clearComparisonCache(): void {
  comparisonCache.clear();
}

function parseSqliteNumVal(val: any): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  let str = String(val).trim().replace("R$", "").trim();
  str = str.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function calcSqliteStayDays(dtInter: any, dtSaida: any): number {
  if (!dtInter || !dtSaida) return 1;
  const parseYMD = (val: any) => {
    if (!val) return null;
    const str = String(val).replace(/\D/g, "");
    if (str.length === 8) {
      const y = parseInt(str.substring(0, 4), 10);
      const m = parseInt(str.substring(4, 6), 10) - 1;
      const d = parseInt(str.substring(6, 8), 10);
      return new Date(y, m, d);
    }
    return null;
  };
  const d1 = parseYMD(dtInter);
  const d2 = parseYMD(dtSaida);
  if (!d1 || !d2) return 1;
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 1);
}

function formatSqliteSUSDate(val: any): string {
  if (!val) return "-";
  const str = String(val).replace(/\D/g, "");
  if (str.length === 8) {
    return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`;
  }
  return String(val);
}

export function computeHospitalComparison(
  hospA: string,
  hospB: string,
  selectedYear: string = "Todos"
): ComparisonResultResponse {
  const cleanA = (hospA || "").trim();
  const cleanB = (hospB || "").trim();
  const cleanYear = (selectedYear || "Todos").trim();

  const emptyResponse: ComparisonResultResponse = {
    hospitalA: cleanA,
    hospitalB: cleanB,
    selectedYear: cleanYear,
    summaryShared: {
      totalCount: 0,
      totalAihsA: 0,
      totalAihsB: 0,
      totalFaturadoA: 0,
      totalFaturadoB: 0,
    },
    summaryExclusive: {
      totalCount: 0,
      totalAihsB: 0,
      totalFaturadoB: 0,
      totalUtiB: 0,
      avgTicketGlobalB: 0,
    },
    sharedProcedures: [],
    exclusiveProcedures: [],
    competencePeriod: null,
  };

  if (!cleanA || !cleanB) return emptyResponse;

  const cacheKey = `${cleanA.toUpperCase()}:::${cleanB.toUpperCase()}:::${cleanYear}`;
  if (comparisonCache.has(cacheKey)) {
    return comparisonCache.get(cacheKey)!;
  }

  const db = getSqliteDb();
  if (!db) return emptyResponse;

  try {
    const stmt = db.prepare(`
      SELECT 
        hospital,
        procedimento,
        json_extract(data, '$[5]') as naih,
        json_extract(data, '$[6]') as code,
        json_extract(data, '$[7]') as dt_inter,
        json_extract(data, '$[8]') as dt_saida,
        json_extract(data, '$[14]') as qtd_ato,
        json_extract(data, '$[17]') as val_ato,
        json_extract(data, '$[38]') as proc_ato,
        json_extract(data, '$[41]') as explicit_ticket,
        json_extract(data, '$[2]') as aa,
        json_extract(data, '$[3]') as mm,
        json_extract(data, '$[43]') as valida
      FROM records 
      WHERE hospital IN (?, ?)
    `);

    const rows: any[] = stmt.all(cleanA, cleanB);

    const yearInt = cleanYear !== "Todos" ? parseInt(cleanYear, 10) : null;
    const procedureMap = new Map<
      string,
      {
        code: string;
        name: string;
        hospA: Map<number, DetailedAihItem>;
        hospB: Map<number, DetailedAihItem>;
      }
    >();

    let minCompVal = Infinity;
    let maxCompVal = -Infinity;
    let minYear = 2026;
    let minMonth = 1;
    let maxYear = 2026;
    let maxMonth = 1;
    let foundPeriod = false;

    const rowCount = rows.length;
    for (let i = 0; i < rowCount; i++) {
      const r = rows[i];
      if (r.valida === 0 || r.valida === false) continue;

      const hosp = r.hospital;
      if (!hosp) continue;
      const isHospA = hosp === cleanA;
      const isHospB = hosp === cleanB;
      if (!isHospA && !isHospB) continue;

      const naih = Number(r.naih);
      if (!naih) continue;

      let aa = Number(r.aa);
      let mm = Number(r.mm);
      if (aa > 0 && aa < 100) aa = 2000 + aa;
      if ((isNaN(aa) || aa < 1990 || isNaN(mm) || mm < 1 || mm > 12) && r.dt_inter) {
        const dtStr = String(r.dt_inter).replace(/\D/g, "");
        if (dtStr.length === 8) {
          const y = parseInt(dtStr.substring(0, 4), 10);
          const m = parseInt(dtStr.substring(4, 6), 10);
          if (y >= 1990 && m >= 1 && m <= 12) {
            aa = y;
            mm = m;
          }
        }
      }

      // Filter by selected year if not "Todos"
      if (yearInt !== null && aa && aa !== yearInt) {
        continue;
      }

      if (!isNaN(aa) && !isNaN(mm) && aa >= 1990 && mm >= 1 && mm <= 12) {
        const compVal = aa * 12 + mm;
        if (compVal < minCompVal) {
          minCompVal = compVal;
          minYear = aa;
          minMonth = mm;
        }
        if (compVal > maxCompVal) {
          maxCompVal = compVal;
          maxYear = aa;
          maxMonth = mm;
        }
        foundPeriod = true;
      }

      const procName = String(r.procedimento || "NÃO ESPECIFICADO").trim();
      const procCode = String(r.code || "").trim();

      if (!procedureMap.has(procName)) {
        procedureMap.set(procName, {
          code: procCode,
          name: procName,
          hospA: new Map(),
          hospB: new Map(),
        });
      }

      const procEntry = procedureMap.get(procName)!;
      if (!procEntry.code && procCode) procEntry.code = procCode;

      const targetAihMap = isHospA ? procEntry.hospA : procEntry.hospB;

      const actName = String(r.proc_ato || "").toUpperCase();
      const qty = Number(r.qtd_ato) || 1;
      let isUtiAct = false;
      if (
        actName.includes("TERAPIA INTENSIVA") ||
        actName.includes("DIARIA DE UTI") ||
        actName.includes("DIÁRIA DE UTI") ||
        actName.includes("UTI ")
      ) {
        isUtiAct = true;
      }

      const valAct = parseSqliteNumVal(r.val_ato);
      const explicitTicket = r.explicit_ticket ? parseSqliteNumVal(r.explicit_ticket) : 0;

      const actItem: ComparisonActItem = {
        actCode: String(r.code || ""),
        actName: String(r.proc_ato || "ATO NÃO ESPECIFICADO"),
        qtd: qty,
        val: valAct,
      };

      if (!targetAihMap.has(naih)) {
        targetAihMap.set(naih, {
          naih,
          hospital: hosp,
          finalTicket: explicitTicket > 0 ? explicitTicket : valAct,
          utiDays: isUtiAct ? qty : 0,
          permanence: calcSqliteStayDays(r.dt_inter, r.dt_saida),
          dtInter: r.dt_inter,
          dtSaida: r.dt_saida,
          dtInterFormatted: formatSqliteSUSDate(r.dt_inter),
          dtSaidaFormatted: formatSqliteSUSDate(r.dt_saida),
          acts: [actItem],
        });
      } else {
        const aihObj = targetAihMap.get(naih)!;
        if (isUtiAct) {
          aihObj.utiDays += qty;
        }
        if (aihObj.finalTicket === 0 && explicitTicket > 0) {
          aihObj.finalTicket = explicitTicket;
        } else if (!explicitTicket) {
          aihObj.finalTicket += valAct;
        }
        aihObj.acts.push(actItem);
      }
    }

    const sharedProcedures: ComparisonSharedProcedure[] = [];
    const exclusiveProcedures: ComparisonExclusiveProcedure[] = [];

    procedureMap.forEach((entry, procName) => {
      const aihsListA = Array.from(entry.hospA.values());
      aihsListA.sort((a, b) => b.finalTicket - a.finalTicket);

      const countA = aihsListA.length;
      let totalFaturadoA = 0;
      let totalUtiA = 0;
      let totalPermA = 0;

      for (let j = 0; j < countA; j++) {
        const a = aihsListA[j];
        totalFaturadoA += a.finalTicket;
        totalUtiA += a.utiDays;
        totalPermA += a.permanence;
      }

      const avgTicketA = countA > 0 ? totalFaturadoA / countA : 0;
      const avgPermA = countA > 0 ? totalPermA / countA : 0;

      const aihsListB = Array.from(entry.hospB.values());
      aihsListB.sort((a, b) => b.finalTicket - a.finalTicket);

      const countB = aihsListB.length;
      let totalFaturadoB = 0;
      let totalUtiB = 0;
      let totalPermB = 0;

      for (let k = 0; k < countB; k++) {
        const b = aihsListB[k];
        totalFaturadoB += b.finalTicket;
        totalUtiB += b.utiDays;
        totalPermB += b.permanence;
      }

      const avgTicketB = countB > 0 ? totalFaturadoB / countB : 0;
      const avgPermB = countB > 0 ? totalPermB / countB : 0;

      // Section 1 Rule: Hospital A has higher volume and lower ticket than Hospital B
      if (countA > 0 && countB > 0) {
        if (countA > countB && avgTicketA < avgTicketB) {
          sharedProcedures.push({
            code: entry.code || "SIH-PROC",
            name: procName,
            aihsA: countA,
            utiDaysA: totalUtiA,
            avgPermanenceA: avgPermA,
            avgTicketA: avgTicketA,
            totalFaturadoA: totalFaturadoA,
            aihsB: countB,
            utiDaysB: totalUtiB,
            avgPermanenceB: avgPermB,
            avgTicketB: avgTicketB,
            totalFaturadoB: totalFaturadoB,
            aihsDetailsA: aihsListA,
            aihsDetailsB: aihsListB,
          });
        }
      }

      // Section 2 Rule: Realized ONLY in Hospital B (Volume in Hospital A = 0)
      if (countA === 0 && countB > 0) {
        exclusiveProcedures.push({
          code: entry.code || "SIH-PROC",
          name: procName,
          aihsB: countB,
          utiDaysB: totalUtiB,
          avgPermanenceB: avgPermB,
          totalFaturadoB: totalFaturadoB,
          avgTicketB: avgTicketB,
          aihsDetailsB: aihsListB,
        });
      }
    });

    const summaryShared = {
      totalCount: sharedProcedures.length,
      totalAihsA: sharedProcedures.reduce((sum, p) => sum + p.aihsA, 0),
      totalAihsB: sharedProcedures.reduce((sum, p) => sum + p.aihsB, 0),
      totalFaturadoA: sharedProcedures.reduce((sum, p) => sum + p.totalFaturadoA, 0),
      totalFaturadoB: sharedProcedures.reduce((sum, p) => sum + p.totalFaturadoB, 0),
    };

    const totalAihsB = exclusiveProcedures.reduce((sum, p) => sum + p.aihsB, 0);
    const totalFaturadoB = exclusiveProcedures.reduce((sum, p) => sum + p.totalFaturadoB, 0);
    const summaryExclusive = {
      totalCount: exclusiveProcedures.length,
      totalAihsB,
      totalFaturadoB,
      totalUtiB: exclusiveProcedures.reduce((sum, p) => sum + p.utiDaysB, 0),
      avgTicketGlobalB: totalAihsB > 0 ? totalFaturadoB / totalAihsB : 0,
    };

    let competencePeriod = null;
    if (foundPeriod) {
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const startFormatted = `${pad(minMonth)}/${minYear}`;
      const endFormatted = `${pad(maxMonth)}/${maxYear}`;
      const isSame = minYear === maxYear && minMonth === maxMonth;
      const label = isSame ? startFormatted : `${startFormatted} a ${endFormatted}`;
      competencePeriod = {
        startYear: minYear,
        startMonth: minMonth,
        endYear: maxYear,
        endMonth: maxMonth,
        startFormatted,
        endFormatted,
        isSame,
        label,
      };
    }

    const result: ComparisonResultResponse = {
      hospitalA: cleanA,
      hospitalB: cleanB,
      selectedYear: cleanYear,
      summaryShared,
      summaryExclusive,
      sharedProcedures,
      exclusiveProcedures,
      competencePeriod,
    };

    if (comparisonCache.size > 30) {
      const firstKey = comparisonCache.keys().next().value;
      if (firstKey) comparisonCache.delete(firstKey);
    }
    comparisonCache.set(cacheKey, result);

    return result;
  } catch (err) {
    console.error("Error computing hospital comparison in SQLite:", err);
    return emptyResponse;
  }
}

export function queryHospitalsComparison(hospA: string, hospB: string): { cols: string[]; rows: any[][] } {
  try {
    const db = getSqliteDb();
    if (!db) {
      return { cols: RECORD_COLUMNS, rows: [] };
    }
    const stmt = db.prepare("SELECT data FROM records WHERE hospital = ? OR hospital = ?");
    const results = stmt.all(hospA.trim(), hospB.trim());
    const rows = results.map((r: any) => JSON.parse(r.data));
    return {
      cols: RECORD_COLUMNS,
      rows,
    };
  } catch (err) {
    console.error("Error querying hospital comparison from SQLite:", err);
    return { cols: RECORD_COLUMNS, rows: [] };
  }
}

export async function indexSlotToSqlite(slotIndex: number, filePath: string): Promise<number> {
  const db = getSqliteDb();
  if (!db || !fs.existsSync(filePath)) return 0;

  try {
    db.exec(`DELETE FROM records WHERE slot_id = ${slotIndex}`);
    const stmt = db.prepare("INSERT INTO records (slot_id, procedimento, hospital, data) VALUES (?, ?, ?, ?)");

    const isGz = filePath.endsWith(".gz");
    const inputStream = isGz
      ? fs.createReadStream(filePath).pipe(zlib.createGunzip())
      : fs.createReadStream(filePath);

    const rl = readline.createInterface({
      input: inputStream,
      crlfDelay: Infinity,
    });

    let count = 0;
    let inBatch = 0;
    db.exec("BEGIN");

    for await (const line of rl) {
      const clean = line.trim().replace(/^,/, "").replace(/,$/, "");
      if (!clean.startsWith("[") || !clean.endsWith("]")) continue;
      try {
        const row = JSON.parse(clean);
        const hosp = String(row[37] || "").trim();
        const proc = String(row[39] || "").trim();
        stmt.run(slotIndex, proc, hosp, clean);
        count++;
        inBatch++;
        if (inBatch >= 25000) {
          db.exec("COMMIT");
          db.exec("BEGIN");
          inBatch = 0;
        }
      } catch {}
    }

    db.exec("COMMIT");
    clearComparisonCache();
    console.log(`[SQLite Indexer] Indexed slot ${slotIndex}: ${count.toLocaleString("pt-BR")} records`);
    return count;
  } catch (err) {
    console.error(`[SQLite Indexer] Error indexing slot ${slotIndex}:`, err);
    try {
      db.exec("ROLLBACK");
    } catch {}
    return 0;
  }
}

export async function ensureSqliteSync(): Promise<void> {
  const db = getSqliteDb();
  if (!db) return;

  try {
    const res = db.prepare("SELECT count(*) as cnt FROM records").get();
    const currentCount = (res as any)?.cnt || 0;

    let totalExpected = 0;
    if (fs.existsSync(METADATA_FILE)) {
      try {
        const meta = JSON.parse(fs.readFileSync(METADATA_FILE, "utf-8"));
        totalExpected = meta.totalRecords || 0;
      } catch {}
    }

    if (currentCount === 0 || currentCount < totalExpected) {
      console.log(`[SQLite Sync] Local SQLite has ${currentCount} records, metadata expected ${totalExpected}. Syncing slots...`);
      for (let s = 0; s < 3; s++) {
        const pJson = getSlotCompactJsonPath(s);
        const pGz = getSlotCompactGzPath(s);
        let targetPath = fs.existsSync(pJson) ? pJson : (fs.existsSync(pGz) ? pGz : null);
        if (!targetPath && s === 0) {
          const mainJson = path.join(DATA_DIR, "fixed_database.compact.json");
          const mainGz = path.join(DATA_DIR, "fixed_database.compact.json.gz");
          if (fs.existsSync(mainJson)) targetPath = mainJson;
          else if (fs.existsSync(mainGz)) targetPath = mainGz;
        }
        if (targetPath) {
          console.log(`[SQLite Sync] Indexing slot ${s} from ${targetPath}...`);
          await indexSlotToSqlite(s, targetPath);
        }
      }
      const finalRes = db.prepare("SELECT count(*) as cnt FROM records").get();
      console.log(`[SQLite Sync] Sync finished. Total records in SQLite: ${(finalRes as any)?.cnt}`);
    } else {
      console.log(`[SQLite Sync] SQLite verified with ${currentCount.toLocaleString("pt-BR")} indexed records.`);
    }
  } catch (err) {
    console.error("[SQLite Sync] Error checking sync:", err);
  }
}

export function parseBrVal(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const s = String(val).trim().replace("R$", "").trim();
  if (s === "") return 0;
  const clean = s.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function formatBrCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function getRowValue(r: any, ...aliases: string[]): any {
  if (!r) return undefined;
  const keys = Object.keys(r);
  const targets = aliases.map((a) => a.trim().toUpperCase());
  for (const key of keys) {
    const cleanKey = key.trim().toUpperCase();
    if (targets.includes(cleanKey)) {
      return r[key];
    }
  }
  return undefined;
}

export function normalizeDateToYYYYMMDD(val: any): number {
  if (val === undefined || val === null) return 0;
  const s = String(val).trim();
  if (s === "") return 0;

  if (/^\d{8}$/.test(s)) {
    return parseInt(s, 10);
  }

  const brMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, "0");
    const month = brMatch[2].padStart(2, "0");
    const year = brMatch[3];
    return parseInt(`${year}${month}${day}`, 10);
  }

  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");
    return parseInt(`${year}${month}${day}`, 10);
  }

  const num = Number(s);
  if (!isNaN(num) && num > 0) {
    const floored = Math.floor(num);
    if (String(floored).length === 8) {
      return floored;
    }
  }

  return 0;
}

// In-memory sessions for chunked upload
interface UploadSession {
  uploadId: string;
  fileName: string;
  slotIndex?: number;
  tempPath: string;
  stream: fs.WriteStream;
  totalRecordsCount: number;
  isFirstChunk: boolean;
  aihs: Set<string>;
  hospitals: Set<string>;
  procedures: Set<string>;
  totalVal: number;
  minYear: number;
  maxYear: number;
  minMonth: number;
  maxMonth: number;
  createdAt: number;
}

const activeSessions = new Map<string, UploadSession>();

// Cleanup stale sessions after 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.createdAt > 3600000) {
      try {
        session.stream.end();
        if (fs.existsSync(session.tempPath)) {
          fs.unlinkSync(session.tempPath);
        }
      } catch {}
      activeSessions.delete(id);
    }
  }
}, 600000);

export function startChunkedUpload(uploadId: string, fileName: string, slotIndex?: number): any {
  ensureDataDir();
  const tempPath = path.join(DATA_DIR, `temp_upload_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
  const stream = fs.createWriteStream(tempPath, { encoding: "utf-8" });
  stream.write('{"cols":' + JSON.stringify(RECORD_COLUMNS) + ',"rows":[\n');

  const session = {
    uploadId,
    fileName: fileName || (slotIndex !== undefined ? `base_${slotIndex + 1}.csv` : "base_hucm_fixa.csv"),
    slotIndex,
    tempPath,
    stream,
    totalRecordsCount: 0,
    isFirstChunk: true,
    aihs: new Set<string>(),
    hospitals: new Set<string>(),
    procedures: new Set<string>(),
    totalVal: 0,
    minYear: 9999,
    maxYear: 0,
    minMonth: 12,
    maxMonth: 1,
    createdAt: Date.now(),
  };

  activeSessions.set(uploadId, session);
  return session;
}

export function appendChunk(uploadId: string, chunkOrPayload: any): number {
  const session = activeSessions.get(uploadId);
  if (!session) {
    throw new Error("Sessão de upload não encontrada ou expirada. Inicie um novo envio.");
  }

  let items: any[] = [];
  if (Array.isArray(chunkOrPayload)) {
    items = chunkOrPayload;
  } else if (chunkOrPayload && Array.isArray(chunkOrPayload.rows)) {
    items = chunkOrPayload.rows;
  } else if (chunkOrPayload && Array.isArray(chunkOrPayload.chunk)) {
    items = chunkOrPayload.chunk;
  }

  if (!items || items.length === 0) {
    return 0;
  }

  let chunkStr = "";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let rowArray: any[];
    let aih: any, hosp: any, proc: any, tktVal: any, valAto: any, aaNum: any, mmNum: any;

    if (Array.isArray(item)) {
      rowArray = item;
      // Index mapping based on RECORD_COLUMNS:
      // 2: SP_AA, 3: SP_MM, 5: SP_NAIH, 17: SP_VALATO, 37: HOSPITAL, 39: PROCEDIMENTO PRINCIPAL, 41: TICKET PROCEDIMENTO REAL
      aaNum = item[2];
      mmNum = item[3];
      aih = item[5];
      valAto = item[17];
      hosp = item[37];
      proc = item[39];
      tktVal = item[41];
    } else {
      rowArray = RECORD_COLUMNS.map((col) => (item[col] !== undefined ? item[col] : null));
      aaNum = item.SP_AA;
      mmNum = item.SP_MM;
      aih = item.SP_NAIH;
      valAto = item.SP_VALATO;
      hosp = item.HOSPITAL;
      proc = item["PROCEDIMENTO PRINCIPAL"];
      tktVal = item["TICKET PROCEDIMENTO REAL"];
    }

    if (session.isFirstChunk && i === 0) {
      chunkStr += JSON.stringify(rowArray);
      session.isFirstChunk = false;
    } else {
      chunkStr += ",\n" + JSON.stringify(rowArray);
    }

    // Accumulate metadata stats
    if (aih) session.aihs.add(String(aih));
    if (hosp) session.hospitals.add(String(hosp));
    if (proc) session.procedures.add(String(proc));

    const tkt = parseBrVal(tktVal);
    const ato = parseBrVal(valAto);
    session.totalVal += tkt > 0 ? tkt : ato;

    const aa = Number(aaNum);
    const mm = Number(mmNum);
    if (aa > 1900 && mm >= 1 && mm <= 12) {
      if (aa < session.minYear || (aa === session.minYear && mm < session.minMonth)) {
        session.minYear = aa;
        session.minMonth = mm;
      }
      if (aa > session.maxYear || (aa === session.maxYear && mm > session.maxMonth)) {
        session.maxYear = aa;
        session.maxMonth = mm;
      }
    }
  }

  session.stream.write(chunkStr);
  session.totalRecordsCount += items.length;
  return session.totalRecordsCount;
}

export async function finishChunkedUpload(uploadId: string): Promise<DatasetMetadata> {
  const session = activeSessions.get(uploadId);
  if (!session) {
    throw new Error("Sessão de upload não encontrada.");
  }

  await new Promise<void>((resolve, reject) => {
    session.stream.on("error", reject);
    session.stream.on("finish", () => resolve());
    session.stream.end("\n]}");
  });

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const compPeriod =
    session.minYear <= session.maxYear && session.minYear < 9999
      ? `${pad(session.minMonth)}/${session.minYear} a ${pad(session.maxMonth)}/${session.maxYear}`
      : "Não especificado";

  const isSlot = session.slotIndex !== undefined && session.slotIndex >= 0 && session.slotIndex <= 2;
  const targetCompactJson = isSlot ? getSlotCompactJsonPath(session.slotIndex!) : path.join(DATA_DIR, "fixed_database.compact.json");
  const targetCompactGz = isSlot ? getSlotCompactGzPath(session.slotIndex!) : path.join(DATA_DIR, "fixed_database.compact.json.gz");

  // Rename temp file to destination (atomic and instant in < 1ms)
  if (fs.existsSync(targetCompactJson)) {
    try {
      fs.unlinkSync(targetCompactJson);
    } catch {}
  }
  fs.renameSync(session.tempPath, targetCompactJson);

  const stats = fs.statSync(targetCompactJson);

  // Background non-blocking safe atomic GZIP compression with Z_BEST_SPEED
  setImmediate(() => {
    try {
      const tmpGz = targetCompactGz + ".tmp";
      const readStream = fs.createReadStream(targetCompactJson);
      const writeGz = fs.createWriteStream(tmpGz);
      const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED });
      readStream.pipe(gzip).pipe(writeGz).on("finish", () => {
        try {
          if (fs.existsSync(targetCompactGz)) fs.unlinkSync(targetCompactGz);
          fs.renameSync(tmpGz, targetCompactGz);
        } catch (e) {
          console.warn("Could not rename tmp gz to target:", e);
        }
      });
    } catch (err) {
      console.warn("Background compact GZ compression notice:", err);
    }
  });

  // Read existing metadata to update slots
  let existingMeta: any = null;
  if (fs.existsSync(METADATA_FILE)) {
    try {
      existingMeta = JSON.parse(fs.readFileSync(METADATA_FILE, "utf-8"));
    } catch {}
  }

  let slots: (SlotInfo | null)[] = existingMeta?.slots || [null, null, null];
  if (!Array.isArray(slots) || slots.length < 3) {
    slots = [null, null, null];
  }

  const slotInfo: SlotInfo = {
    slotIndex: isSlot ? session.slotIndex! : 0,
    fileName: session.fileName,
    recordsCount: session.totalRecordsCount,
    fileSizeBytes: stats.size,
    updatedAt: new Date().toISOString(),
  };

  if (isSlot) {
    slots[session.slotIndex!] = slotInfo;
  } else {
    slots[0] = slotInfo;
  }

  // If slot 0 (Base 1 - Principal) is saved and main file needs sync
  const mainCompact = path.join(DATA_DIR, "fixed_database.compact.json");
  if (isSlot && session.slotIndex === 0 && targetCompactJson !== mainCompact) {
    setImmediate(() => {
      try {
        fs.copyFileSync(targetCompactJson, mainCompact);
      } catch (e) {
        console.warn("Could not copy slot_0 to main file:", e);
      }
    });
  }

  let totalRecords = session.totalRecordsCount;
  if (isSlot) {
    totalRecords = slots.reduce((acc, s) => acc + (s?.recordsCount || 0), 0);
  }

  const activeSlotNames = slots.filter(Boolean).map(s => s!.fileName);
  const metadata: DatasetMetadata = {
    fileName: activeSlotNames.length > 0 ? activeSlotNames.join(" + ") : session.fileName,
    totalRecords,
    uniqueAihs: session.aihs.size,
    uniqueHospitals: session.hospitals.size,
    uniqueProcedures: session.procedures.size,
    hospitalsList: Array.from(session.hospitals).sort(),
    proceduresList: Array.from(session.procedures).sort(),
    competencePeriod: compPeriod,
    totalValueFormatted: formatBrCurrency(session.totalVal),
    fileSizeBytes: stats.size,
    slots,
    createdAt: existingMeta?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), "utf-8");

  try {
    await indexSlotToSqlite(isSlot ? session.slotIndex! : 0, targetCompactJson);
  } catch (sqErr) {
    console.warn("Failed to index slot in SQLite on finishChunkedUpload:", sqErr);
  }

  activeSessions.delete(uploadId);

  return metadata;
}

export function computeDatasetMetadata(records: any[], fileName = "base_fixa.csv"): DatasetMetadata {
  const aihs = new Set<string>();
  const hospitals = new Set<string>();
  const procs = new Set<string>();
  let totalVal = 0;
  let minYear = 9999, maxYear = 0, minMonth = 12, maxMonth = 1;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.SP_NAIH) aihs.add(String(r.SP_NAIH));
    if (r.HOSPITAL) hospitals.add(String(r.HOSPITAL));
    if (r["PROCEDIMENTO PRINCIPAL"]) procs.add(String(r["PROCEDIMENTO PRINCIPAL"]));

    const tkt = parseBrVal(r["TICKET PROCEDIMENTO REAL"]);
    const atoVal = parseBrVal(r.SP_VALATO);
    totalVal += (tkt > 0 ? tkt : atoVal);

    const aa = Number(r.SP_AA);
    const mm = Number(r.SP_MM);
    if (aa > 1900 && mm >= 1 && mm <= 12) {
      if (aa < minYear || (aa === minYear && mm < minMonth)) {
        minYear = aa;
        minMonth = mm;
      }
      if (aa > maxYear || (aa === maxYear && mm > maxMonth)) {
        maxYear = aa;
        maxMonth = mm;
      }
    }
  }

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const compPeriod =
    minYear <= maxYear && minYear < 9999
      ? `${pad(minMonth)}/${minYear} a ${pad(maxMonth)}/${maxYear}`
      : "Não especificado";

  return {
    fileName,
    totalRecords: records.length,
    uniqueAihs: aihs.size,
    uniqueHospitals: hospitals.size,
    uniqueProcedures: procs.size,
    hospitalsList: Array.from(hospitals).sort(),
    proceduresList: Array.from(procs).sort(),
    competencePeriod: compPeriod,
    totalValueFormatted: formatBrCurrency(totalVal),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getDatasetStatus(): { exists: boolean; metadata?: DatasetMetadata; fileSizeMb?: number } {
  ensureDataDir();

  const hasMain =
    fs.existsSync(DATA_FILE) ||
    fs.existsSync(GZ_FILE) ||
    fs.existsSync(path.join(DATA_DIR, "fixed_database.compact.json")) ||
    fs.existsSync(path.join(DATA_DIR, "fixed_database.compact.json.gz"));

  const hasAnySlot = [0, 1, 2].some(
    (i) =>
      fs.existsSync(getSlotGzPath(i)) ||
      fs.existsSync(getSlotJsonPath(i)) ||
      fs.existsSync(getSlotCompactGzPath(i)) ||
      fs.existsSync(getSlotCompactJsonPath(i))
  );

  if (!hasMain && !hasAnySlot) {
    return { exists: false };
  }

  let metadata: DatasetMetadata | undefined;
  if (fs.existsSync(METADATA_FILE)) {
    try {
      metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf-8"));
    } catch {}
  }

  let totalBytes = 0;
  if (fs.existsSync(GZ_FILE)) {
    totalBytes = fs.statSync(GZ_FILE).size;
  } else if (fs.existsSync(path.join(DATA_DIR, "fixed_database.compact.json.gz"))) {
    totalBytes = fs.statSync(path.join(DATA_DIR, "fixed_database.compact.json.gz")).size;
  } else if (fs.existsSync(DATA_FILE)) {
    totalBytes = fs.statSync(DATA_FILE).size;
  } else if (fs.existsSync(path.join(DATA_DIR, "fixed_database.compact.json"))) {
    totalBytes = fs.statSync(path.join(DATA_DIR, "fixed_database.compact.json")).size;
  } else {
    for (let i = 0; i < 3; i++) {
      const compactGz = getSlotCompactGzPath(i);
      const compactJson = getSlotCompactJsonPath(i);
      const gz = getSlotGzPath(i);
      const json = getSlotJsonPath(i);
      if (fs.existsSync(compactGz)) totalBytes += fs.statSync(compactGz).size;
      else if (fs.existsSync(compactJson)) totalBytes += fs.statSync(compactJson).size;
      else if (fs.existsSync(gz)) totalBytes += fs.statSync(gz).size;
      else if (fs.existsSync(json)) totalBytes += fs.statSync(json).size;
    }
  }

  const sizeMb = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;

  return {
    exists: true,
    metadata,
    fileSizeMb: sizeMb,
  };
}

export function deleteSlotDataset(slotIndex: number): boolean {
  ensureDataDir();
  const gz = getSlotGzPath(slotIndex);
  const json = getSlotJsonPath(slotIndex);
  const compactGz = getSlotCompactGzPath(slotIndex);
  const compactJson = getSlotCompactJsonPath(slotIndex);
  let deleted = false;
  if (fs.existsSync(gz)) {
    try {
      fs.unlinkSync(gz);
      deleted = true;
    } catch {}
  }
  if (fs.existsSync(json)) {
    try {
      fs.unlinkSync(json);
      deleted = true;
    } catch {}
  }
  if (fs.existsSync(compactGz)) {
    try {
      fs.unlinkSync(compactGz);
      deleted = true;
    } catch {}
  }
  if (fs.existsSync(compactJson)) {
    try {
      fs.unlinkSync(compactJson);
      deleted = true;
    } catch {}
  }

  if (fs.existsSync(METADATA_FILE)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf-8"));
      if (metadata.slots && metadata.slots[slotIndex]) {
        metadata.slots[slotIndex] = null;
        const activeSlots = (metadata.slots as (SlotInfo | null)[]).filter(Boolean);
        metadata.totalRecords = activeSlots.reduce((acc, s) => acc + (s?.recordsCount || 0), 0);
        metadata.fileName = activeSlots.map((s) => s?.fileName).join(" + ") || "base_hucm_fixa.csv";
        metadata.updatedAt = new Date().toISOString();
        fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), "utf-8");
      }

      try {
        const db = getSqliteDb();
        if (db) {
          db.exec(`DELETE FROM records WHERE slot_id = ${slotIndex}`);
        }
        clearComparisonCache();
      } catch (sqErr) {
        console.warn("Could not delete slot from sqlite:", sqErr);
      }

      const anySlotRemaining = (metadata.slots as (SlotInfo | null)[]).some(Boolean);
      if (!anySlotRemaining) {
        if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
        if (fs.existsSync(GZ_FILE)) fs.unlinkSync(GZ_FILE);
        if (fs.existsSync(METADATA_FILE)) fs.unlinkSync(METADATA_FILE);
      }
    } catch {}
  }
  return deleted;
}

export function getFixedDataset(): { exists: boolean; metadata?: DatasetMetadata; data?: any[] } {
  ensureDataDir();
  const compactJson = path.join(DATA_DIR, "fixed_database.compact.json");
  const compactGz = path.join(DATA_DIR, "fixed_database.compact.json.gz");
  const slot0Compact = getSlotCompactJsonPath(0);
  const slot0CompactGz = getSlotCompactGzPath(0);
  const targetCompact = fs.existsSync(compactJson) ? compactJson : (fs.existsSync(slot0Compact) ? slot0Compact : null);
  const targetCompactGz = fs.existsSync(compactGz) ? compactGz : (fs.existsSync(slot0CompactGz) ? slot0CompactGz : null);

  if (!fs.existsSync(DATA_FILE) && !fs.existsSync(GZ_FILE) && !targetCompact && !targetCompactGz) {
    return { exists: false };
  }

  try {
    let metadata: DatasetMetadata | undefined;
    if (fs.existsSync(METADATA_FILE)) {
      try {
        metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf-8"));
      } catch {}
    }

    if (targetCompact || targetCompactGz) {
      const rawContent = targetCompact
        ? fs.readFileSync(targetCompact, "utf-8")
        : zlib.gunzipSync(fs.readFileSync(targetCompactGz!)).toString("utf-8");
      const parsed = JSON.parse(rawContent);
      if (parsed.cols && Array.isArray(parsed.rows)) {
        const cols: string[] = parsed.cols;
        const rows: any[][] = parsed.rows;
        const numCols = cols.length;
        const objRows = new Array(rows.length);
        for (let r = 0; r < rows.length; r++) {
          const rowArr = rows[r];
          const obj: any = {};
          for (let c = 0; c < numCols; c++) {
            obj[cols[c]] = rowArr[c];
          }
          objRows[r] = obj;
        }
        return {
          exists: true,
          metadata,
          data: objRows,
        };
      }
      return {
        exists: true,
        metadata,
        data: parsed.rows || parsed,
      };
    }

    let rawContent: string;
    if (fs.existsSync(DATA_FILE)) {
      rawContent = fs.readFileSync(DATA_FILE, "utf-8");
    } else {
      const gzBuf = fs.readFileSync(GZ_FILE);
      rawContent = zlib.gunzipSync(gzBuf).toString("utf-8");
    }

    const data = JSON.parse(rawContent);
    if (!metadata) {
      metadata = computeDatasetMetadata(data, "base_fixa.json");
    }

    return {
      exists: true,
      metadata,
      data,
    };
  } catch (error) {
    console.error("Error reading fixed dataset:", error);
    return { exists: false };
  }
}

export function saveFixedDataset(records: any[], fileName = "base_fixa.csv"): DatasetMetadata {
  ensureDataDir();
  const metadata = computeDatasetMetadata(records, fileName);

  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), "utf-8");
  const stats = fs.statSync(DATA_FILE);
  metadata.fileSizeBytes = stats.size;

  // Also create gz
  const gzBuf = zlib.gzipSync(Buffer.from(JSON.stringify(records)), { level: 6 });
  fs.writeFileSync(GZ_FILE, gzBuf);

  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), "utf-8");

  return metadata;
}

export function deleteFixedDataset(): boolean {
  ensureDataDir();
  let deleted = false;
  const filesToDelete = [
    DATA_FILE,
    GZ_FILE,
    METADATA_FILE,
    path.join(DATA_DIR, "fixed_database.compact.json"),
    path.join(DATA_DIR, "fixed_database.compact.json.gz"),
    getSlotCompactJsonPath(0),
    getSlotCompactGzPath(0),
    getSlotCompactJsonPath(1),
    getSlotCompactGzPath(1),
    getSlotCompactJsonPath(2),
    getSlotCompactGzPath(2),
  ];
  for (const f of filesToDelete) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
        deleted = true;
      } catch {}
    }
  }
  try {
    const db = getSqliteDb();
    if (db) {
      db.exec("DELETE FROM records;");
    }
    clearComparisonCache();
  } catch {}
  return deleted;
}

export function parseRawCsvToRecords(csvText: string): any[] {
  const parseResult = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  const data = parseResult.data as any[];
  if (!data || data.length === 0) {
    throw new Error("Arquivo CSV está vazio ou em formato inválido.");
  }

  return data.map((row, i) => {
    const hosp = getRowValue(row, "HOSPITAL") || "HOSPITAL DESCONHECIDO";
    const procPrinc =
      getRowValue(
        row,
        "PROCEDIMENTO PRINCIPAL",
        "PROCEDIMENTO_PRINCIPAL",
        "PROC_PRINCIPAL",
        "PROC PRINC_PRINCIPAL"
      ) || "PROCEDIMENTO INDEFINIDO";
    const procAto =
      getRowValue(row, "PROCEDIMENTO ATO", "PROCEDIMENTO_ATO", "PROC_ATO") ||
      "ATO COMPLEMENTAR";
    const tktRealRaw = getRowValue(
      row,
      "TICKET PROCEDIMENTO REAL",
      "TICKET_PROCEDIMENTO_REAL",
      "TICKET_PROCEDIMENTO"
    );
    const tktReal =
      tktRealRaw !== undefined && tktRealRaw !== null ? String(tktRealRaw) : null;

    const rawAih = getRowValue(row, "SP_NAIH", "NAIH", "SPNAIH");
    let parsedAih = 3125150000000 + i;
    if (rawAih !== undefined && rawAih !== null) {
      const rawStr = String(rawAih).trim();
      parsedAih = parseFloat(rawStr) || 3125150000000 + i;
    }

    const rawProcrea = getRowValue(row, "SP_PROCREA", "PROCREA", "SPPROCREA");
    const parsedProcrea = rawProcrea ? parseInt(String(rawProcrea), 10) || 0 : 0;

    const rawQtd = getRowValue(row, "SP_QTD_ATO", "QTD", "QTD_ATO");
    const parsedQtd = rawQtd !== undefined ? Number(rawQtd) : 1;

    const rawValAto = getRowValue(row, "SP_VALATO", "VAL_ATO", "SPVALATO", "VALATO");
    const valAtoStr = rawValAto !== undefined && rawValAto !== null ? String(rawValAto) : "0,00";

    const valRaw = getRowValue(row, "Valida", "valida", "VALIDA", "Valido", "valido");
    let isValid = true;
    if (valRaw !== undefined && valRaw !== null) {
      if (typeof valRaw === "boolean") isValid = valRaw;
      else {
        const s = String(valRaw).trim().toUpperCase();
        if (["FALSE", "NAO", "NÃO", "0", "N", "INVALIDO", "FALSO"].includes(s)) {
          isValid = false;
        }
      }
    }

    return {
      SP_GESTOR: Number(getRowValue(row, "SP_GESTOR") || 310620),
      SP_UF: Number(getRowValue(row, "SP_UF") || 31),
      SP_AA: Number(getRowValue(row, "SP_AA", "AA", "ANO", "YEAR") || 2026) || 2026,
      SP_MM: Number(getRowValue(row, "SP_MM", "MM", "MES", "MÊS") || 1) || 1,
      SP_CNES: Number(getRowValue(row, "SP_CNES") || 26972),
      SP_NAIH: parsedAih,
      SP_PROCREA: parsedProcrea,
      SP_DTINTER: normalizeDateToYYYYMMDD(getRowValue(row, "SP_DTINTER", "DTINTER", "DT_INTER")),
      SP_DTSAIDA: normalizeDateToYYYYMMDD(getRowValue(row, "SP_DTSAIDA", "DTSAIDA", "DT_SAIDA")),
      SP_NUM_PR: Number(getRowValue(row, "SP_NUM_PR") || 0),
      SP_TIPO: Number(getRowValue(row, "SP_TIPO") || 0),
      SP_CPFCGC: Number(getRowValue(row, "SP_CPFCGC") || 0),
      SP_ATOPROF: Number(getRowValue(row, "SP_ATOPROF") || 301010048),
      SP_TP_ATO: Number(getRowValue(row, "SP_TP_ATO") || 0),
      SP_QTD_ATO: parsedQtd,
      SP_PTSP: Number(getRowValue(row, "SP_PTSP") || 0),
      SP_NF: Number(getRowValue(row, "SP_NF") || 0),
      SP_VALATO: valAtoStr,
      SP_M_HOSP: Number(getRowValue(row, "SP_M_HOSP") || 310620),
      SP_M_PAC: Number(getRowValue(row, "SP_M_PAC") || 310620),
      SP_DES_HOS: Number(getRowValue(row, "SP_DES_HOS") || 0),
      SP_DES_PAC: Number(getRowValue(row, "SP_DES_PAC") || 0),
      SP_COMPLEX: Number(getRowValue(row, "SP_COMPLEX") || 2),
      SP_FINANC: Number(getRowValue(row, "SP_FINANC") || 6),
      SP_CO_FAEC: Number(getRowValue(row, "SP_CO_FAEC") || 0),
      SP_PF_CBO: Number(getRowValue(row, "SP_PF_CBO") || 0),
      SP_PF_DOC: Number(getRowValue(row, "SP_PF_DOC") || 0),
      SP_PJ_DOC: Number(getRowValue(row, "SP_PJ_DOC") || 0),
      IN_TP_VAL: Number(getRowValue(row, "IN_TP_VAL") || 1),
      SEQUENCIA: Number(getRowValue(row, "SEQUENCIA") || i),
      REMESSA: String(getRowValue(row, "REMESSA") || "REM123.DTS"),
      SERV_CLA: Number(getRowValue(row, "SERV_CLA") || 0),
      SP_CIDPRI: String(getRowValue(row, "SP_CIDPRI") || "Z000"),
      SP_CIDSEC: getRowValue(row, "SP_CIDSEC") || 0,
      SP_QT_PROC: Number(getRowValue(row, "SP_QT_PROC") || 1),
      SP_U_AIH: Number(getRowValue(row, "SP_U_AIH") || 0),
      FONTE_ORC: Number(getRowValue(row, "FONTE_ORC") || 0),
      HOSPITAL: hosp,
      "PROCEDIMENTO ATO": procAto,
      "PROCEDIMENTO PRINCIPAL": procPrinc,
      CONCATENADO: getRowValue(row, "CONCATENADO") || `${parsedAih}-${procPrinc.slice(0, 5)}`,
      "TICKET PROCEDIMENTO REAL": tktReal,
      "TICKET MÉDIO": "0,00",
      Valida: isValid,
    };
  });
}

export async function ingestCsvFileToSlot(
  filePath: string,
  fileName: string,
  slotIndex: number = 0
): Promise<DatasetMetadata> {
  ensureDataDir();

  const isSlot = slotIndex >= 0 && slotIndex <= 2;
  const targetCompactJson = isSlot
    ? getSlotCompactJsonPath(slotIndex)
    : path.join(DATA_DIR, "fixed_database.compact.json");
  const targetCompactGz = isSlot
    ? getSlotCompactGzPath(slotIndex)
    : path.join(DATA_DIR, "fixed_database.compact.json.gz");

  const tempJsonPath = path.join(
    DATA_DIR,
    `temp_ingest_${Date.now()}_${Math.random().toString(36).substring(7)}.json`
  );
  const writeStream = fs.createWriteStream(tempJsonPath, { encoding: "utf-8" });
  writeStream.write('{"cols":' + JSON.stringify(RECORD_COLUMNS) + ',"rows":[\n');

  let isFirstRow = true;
  let totalRecordsCount = 0;
  const aihs = new Set<string>();
  const hospitals = new Set<string>();
  const procedures = new Set<string>();
  let totalVal = 0;
  let minYear = 9999,
    maxYear = 0,
    minMonth = 12,
    maxMonth = 1;

  const fileStream = fs.createReadStream(filePath);

  return new Promise<DatasetMetadata>((resolve, reject) => {
    Papa.parse(fileStream, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      step: (rowObj: any) => {
        const row = rowObj.data;
        if (!row) return;

        const hosp = getRowValue(row, "HOSPITAL") || "HOSPITAL DESCONHECIDO";
        const procPrinc =
          getRowValue(
            row,
            "PROCEDIMENTO PRINCIPAL",
            "PROCEDIMENTO_PRINCIPAL",
            "PROC_PRINCIPAL",
            "PROC PRINC_PRINCIPAL"
          ) || "PROCEDIMENTO INDEFINIDO";
        const procAto =
          getRowValue(row, "PROCEDIMENTO ATO", "PROCEDIMENTO_ATO", "PROC_ATO") ||
          "ATO COMPLEMENTAR";
        const tktRealRaw = getRowValue(
          row,
          "TICKET PROCEDIMENTO REAL",
          "TICKET_PROCEDIMENTO_REAL",
          "TICKET_PROCEDIMENTO"
        );
        const tktReal =
          tktRealRaw !== undefined && tktRealRaw !== null ? String(tktRealRaw) : null;

        const rawAih = getRowValue(row, "SP_NAIH", "NAIH", "SPNAIH");
        let parsedAih = 3125150000000 + totalRecordsCount;
        if (rawAih !== undefined && rawAih !== null) {
          const rawStr = String(rawAih).trim();
          parsedAih = parseFloat(rawStr) || 3125150000000 + totalRecordsCount;
        }

        const rawProcrea = getRowValue(row, "SP_PROCREA", "PROCREA", "SPPROCREA");
        const parsedProcrea = rawProcrea ? parseInt(String(rawProcrea), 10) || 0 : 0;

        const rawQtd = getRowValue(row, "SP_QTD_ATO", "QTD", "QTD_ATO");
        const parsedQtd = rawQtd !== undefined ? Number(rawQtd) : 1;

        const rawValAto = getRowValue(row, "SP_VALATO", "VAL_ATO", "SPVALATO", "VALATO");
        const valAtoStr = rawValAto !== undefined && rawValAto !== null ? String(rawValAto) : "0,00";

        const valRaw = getRowValue(row, "Valida", "valida", "VALIDA", "Valido", "valido");
        let isValid = true;
        if (valRaw !== undefined && valRaw !== null) {
          if (typeof valRaw === "boolean") isValid = valRaw;
          else {
            const s = String(valRaw).trim().toUpperCase();
            if (["FALSE", "NAO", "NÃO", "0", "N", "INVALIDO", "FALSO"].includes(s)) {
              isValid = false;
            }
          }
        }

        const aa = Number(getRowValue(row, "SP_AA", "AA", "ANO", "YEAR") || 2026) || 2026;
        const mm = Number(getRowValue(row, "SP_MM", "MM", "MES", "MÊS") || 1) || 1;
        const sId = slotIndex + 1;

        const itemObj: any = {
          SP_GESTOR: Number(getRowValue(row, "SP_GESTOR") || 310620),
          SP_UF: Number(getRowValue(row, "SP_UF") || 31),
          SP_AA: aa,
          SP_MM: mm,
          SP_CNES: Number(getRowValue(row, "SP_CNES") || 26972),
          SP_NAIH: parsedAih,
          SP_PROCREA: parsedProcrea,
          SP_DTINTER: normalizeDateToYYYYMMDD(getRowValue(row, "SP_DTINTER", "DTINTER", "DT_INTER")),
          SP_DTSAIDA: normalizeDateToYYYYMMDD(getRowValue(row, "SP_DTSAIDA", "DTSAIDA", "DT_SAIDA")),
          SP_NUM_PR: Number(getRowValue(row, "SP_NUM_PR") || 0),
          SP_TIPO: Number(getRowValue(row, "SP_TIPO") || 0),
          SP_CPFCGC: Number(getRowValue(row, "SP_CPFCGC") || 0),
          SP_ATOPROF: Number(getRowValue(row, "SP_ATOPROF") || 301010048),
          SP_TP_ATO: Number(getRowValue(row, "SP_TP_ATO") || 0),
          SP_QTD_ATO: parsedQtd,
          SP_PTSP: Number(getRowValue(row, "SP_PTSP") || 0),
          SP_NF: Number(getRowValue(row, "SP_NF") || 0),
          SP_VALATO: valAtoStr,
          SP_M_HOSP: Number(getRowValue(row, "SP_M_HOSP") || 310620),
          SP_M_PAC: Number(getRowValue(row, "SP_M_PAC") || 310620),
          SP_DES_HOS: Number(getRowValue(row, "SP_DES_HOS") || 0),
          SP_DES_PAC: Number(getRowValue(row, "SP_DES_PAC") || 0),
          SP_COMPLEX: Number(getRowValue(row, "SP_COMPLEX") || 2),
          SP_FINANC: Number(getRowValue(row, "SP_FINANC") || 6),
          SP_CO_FAEC: Number(getRowValue(row, "SP_CO_FAEC") || 0),
          SP_PF_CBO: Number(getRowValue(row, "SP_PF_CBO") || 0),
          SP_PF_DOC: Number(getRowValue(row, "SP_PF_DOC") || 0),
          SP_PJ_DOC: Number(getRowValue(row, "SP_PJ_DOC") || 0),
          IN_TP_VAL: Number(getRowValue(row, "IN_TP_VAL") || 1),
          SEQUENCIA: Number(getRowValue(row, "SEQUENCIA") || totalRecordsCount),
          REMESSA: String(getRowValue(row, "REMESSA") || "REM123.DTS"),
          SERV_CLA: Number(getRowValue(row, "SERV_CLA") || 0),
          SP_CIDPRI: String(getRowValue(row, "SP_CIDPRI") || "Z000"),
          SP_CIDSEC: getRowValue(row, "SP_CIDSEC") || 0,
          SP_QT_PROC: Number(getRowValue(row, "SP_QT_PROC") || 1),
          SP_U_AIH: Number(getRowValue(row, "SP_U_AIH") || 0),
          FONTE_ORC: Number(getRowValue(row, "FONTE_ORC") || 0),
          HOSPITAL: hosp,
          "PROCEDIMENTO ATO": procAto,
          "PROCEDIMENTO PRINCIPAL": procPrinc,
          CONCATENADO: getRowValue(row, "CONCATENADO") || `${parsedAih}-${procPrinc.slice(0, 5)}`,
          "TICKET PROCEDIMENTO REAL": tktReal,
          "TICKET MÉDIO": "0,00",
          Valida: isValid,
          _slotId: sId,
        };

        const rowArr = RECORD_COLUMNS.map((col) =>
          itemObj[col] !== undefined ? itemObj[col] : null
        );

        if (isFirstRow) {
          writeStream.write(JSON.stringify(rowArr));
          isFirstRow = false;
        } else {
          writeStream.write(",\n" + JSON.stringify(rowArr));
        }

        totalRecordsCount++;
        if (parsedAih) aihs.add(String(parsedAih));
        if (hosp) hospitals.add(String(hosp));
        if (procPrinc) procedures.add(String(procPrinc));

        const tkt = parseBrVal(tktReal);
        const ato = parseBrVal(valAtoStr);
        totalVal += tkt > 0 ? tkt : ato;

        if (aa > 1900 && mm >= 1 && mm <= 12) {
          if (aa < minYear || (aa === minYear && mm < minMonth)) {
            minYear = aa;
            minMonth = mm;
          }
          if (aa > maxYear || (aa === maxYear && mm > maxMonth)) {
            maxYear = aa;
            maxMonth = mm;
          }
        }
      },
      complete: async () => {
        writeStream.end("\n]}", async () => {
          try {
            if (fs.existsSync(targetCompactJson)) {
              try {
                fs.unlinkSync(targetCompactJson);
              } catch {}
            }
            fs.renameSync(tempJsonPath, targetCompactJson);

            const stats = fs.statSync(targetCompactJson);

            // Compress to gz with Z_BEST_SPEED
            const tmpGz = targetCompactGz + ".tmp";
            const readGz = fs.createReadStream(targetCompactJson);
            const writeGz = fs.createWriteStream(tmpGz);
            const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED });

            await new Promise<void>((resGz, rejGz) => {
              readGz
                .pipe(gzip)
                .pipe(writeGz)
                .on("finish", () => {
                  try {
                    if (fs.existsSync(targetCompactGz)) fs.unlinkSync(targetCompactGz);
                    fs.renameSync(tmpGz, targetCompactGz);
                  } catch (e) {
                    console.warn("Rename gz failed:", e);
                  }
                  resGz();
                })
                .on("error", rejGz);
            });

            // Read metadata to update slots
            let existingMeta: any = null;
            if (fs.existsSync(METADATA_FILE)) {
              try {
                existingMeta = JSON.parse(fs.readFileSync(METADATA_FILE, "utf-8"));
              } catch {}
            }

            let slots: (SlotInfo | null)[] = existingMeta?.slots || [null, null, null];
            if (!Array.isArray(slots) || slots.length < 3) {
              slots = [null, null, null];
            }

            const slotInfo: SlotInfo = {
              slotIndex,
              fileName,
              recordsCount: totalRecordsCount,
              fileSizeBytes: stats.size,
              updatedAt: new Date().toISOString(),
            };
            slots[slotIndex] = slotInfo;

            let totalRecords = slots.reduce((acc, s) => acc + (s?.recordsCount || 0), 0);
            const activeSlots = slots.filter(Boolean) as SlotInfo[];

            const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
            const compPeriod =
              minYear <= maxYear && minYear < 9999
                ? `${pad(minMonth)}/${minYear} a ${pad(maxMonth)}/${maxYear}`
                : "Não especificado";

            const allHospitals = new Set<string>([
              ...(existingMeta?.hospitalsList || []),
              ...Array.from(hospitals),
            ]);
            const allProcedures = new Set<string>([
              ...(existingMeta?.proceduresList || []),
              ...Array.from(procedures),
            ]);

            const metadata: DatasetMetadata = {
              fileName: activeSlots.map((s) => s.fileName).join(" + ") || fileName,
              totalRecords,
              uniqueAihs: aihs.size,
              uniqueHospitals: allHospitals.size,
              uniqueProcedures: allProcedures.size,
              hospitalsList: Array.from(allHospitals).sort(),
              proceduresList: Array.from(allProcedures).sort(),
              competencePeriod: compPeriod,
              totalValueFormatted: formatBrCurrency(totalVal),
              fileSizeBytes: stats.size,
              slots,
              createdAt: existingMeta?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), "utf-8");

            // Also copy to main fixed_database if slot 0
            const mainCompact = path.join(DATA_DIR, "fixed_database.compact.json");
            const mainCompactGz = path.join(DATA_DIR, "fixed_database.compact.json.gz");
            if (slotIndex === 0) {
              try {
                fs.copyFileSync(targetCompactJson, mainCompact);
                fs.copyFileSync(targetCompactGz, mainCompactGz);
              } catch {}
            }

            // Sync with local SQLite table for sub-second procedure queries
            try {
              await indexSlotToSqlite(slotIndex, targetCompactJson);
            } catch (sqErr) {
              console.warn("Failed to populate SQLite for slot " + slotIndex, sqErr);
            }

            resolve(metadata);
          } catch (err) {
            reject(err);
          }
        });
      },
      error: (err: any) => {
        writeStream.end();
        if (fs.existsSync(tempJsonPath)) {
          try {
            fs.unlinkSync(tempJsonPath);
          } catch {}
        }
        reject(err);
      },
    });
  });
}
