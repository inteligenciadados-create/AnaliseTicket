/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, ChangeEvent, Fragment, useEffect, useRef } from "react";
import {
  Activity,
  FileSpreadsheet,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Code,
  Table,
  RefreshCw,
  DollarSign,
  CheckCircle2,
  Building2,
  Bookmark,
  ChevronRight,
  ChevronDown,
  Info,
  HelpCircle,
  Upload,
  ArrowRight,
  X,
  FileText,
  ArrowUpDown,
  SlidersHorizontal,
  ListOrdered,
  Check,
  FolderClosed,
  Save,
  Trash2,
  Database,
  HardDrive,
  ArrowLeftRight,
  Calendar,
  Clock,
  Plus,
  Flame,
  Share2,
  Copy,
  ExternalLink,
  Link,
  Globe,
  Users,
  CheckCheck,
  Cloud,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import {
  MOCK_DATABASE,
  MOCK_SPECIALTIES,
  parseVal,
  formatVal
} from "./data/mockData";
import {
  analyzeProcedureBenchmark,
  calculateAuditGaps,
  analyzeFundingModels,
  getSpecialtiesForProcedures,
  classifyProcedureSpecialty
} from "./utils/auditHelper";
import { SUSRecord, SpecialtyMap, AuditGap, HospitalBenchmark, RECORD_COLUMNS } from "./types";
import SpreadsheetView from "./components/SpreadsheetView";
import ProcedureSelector from "./components/ProcedureSelector";
import CustomComparativeView from "./components/CustomComparativeView";
import AdvancedHospitalComparator from "./components/AdvancedHospitalComparator";
import FelumaLogo from "./components/FelumaLogo";
import ShareModal from "./components/ShareModal";
import {
  saveToIndexedDB,
  loadFromIndexedDB,
  clearIndexedDB,
  saveSlotToIndexedDB,
  deleteSlotFromIndexedDB
} from "./utils/indexedDB";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList
} from "recharts";

const JSON_SCHEMA_EXAMPLE = {
  SP_GESTOR: 310620,
  SP_UF: 31,
  SP_AA: 2026,
  SP_MM: 1,
  SP_CNES: 26972,
  SP_NAIH: 3125151304100,
  SP_PROCREA: 407040242,
  SP_DTINTER: 20250704,
  SP_DTSAIDA: 20250901,
  SP_NUM_PR: 0,
  SP_TIPO: 0,
  SP_CPFCGC: 26972,
  SP_ATOPROF: 301010048,
  SP_TP_ATO: 0,
  SP_QTD_ATO: 3,
  SP_VALATO: "0,00",
  HOSPITAL: "MATERNIDADE ODETE VALADARES",
  "PROCEDIMENTO ATO": "DOSAGEM DE POTASSIO",
  "PROCEDIMENTO PRINCIPAL": "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)",
  CONCATENADO: "3125151304100-407040242",
  "TICKET PROCEDIMENTO REAL": "48.854,81",
  "TICKET MÉDIO": "0,00",
  Valida: false
};

/**
 * Normalizes any incoming date format (YYYYMMDD, DD/MM/YYYY, YYYY-MM-DD or custom string) to YYYYMMDD number.
 * Returns 0 if invalid or unrecognized, to prevent inventing dates.
 */
export function normalizeDateToYYYYMMDD(val: any): number {
  if (val === undefined || val === null) return 0;
  const s = String(val).trim();
  if (s === "") return 0;

  // 1. If it's already a clean YYYYMMDD string or number (8 digits)
  if (/^\d{8}$/.test(s)) {
    return parseInt(s, 10);
  }

  // 2. If it is formatted as DD/MM/YYYY or DD-MM-YYYY
  const brMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    return parseInt(`${year}${month}${day}`, 10);
  }

  // 3. If it is formatted as YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return parseInt(`${year}${month}${day}`, 10);
  }

  // 4. Try parsing with native Date parser if it's a generic date string
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return parseInt(`${year}${month}${day}`, 10);
    }
  } catch (e) {
    // Ignore and fallback
  }

  // 5. If it's a number that is not exactly 8 digits but maybe a float like 20250704.0
  const num = Number(s);
  if (!isNaN(num) && num > 0) {
    const floored = Math.floor(num);
    if (String(floored).length === 8) {
      return floored;
    }
  }

  return 0;
}

/**
 * parses a date in YYYYMMDD string or number format (e.g. 20251213) into a Date object
 */
export function parseYYYYMMDD(dateNum: number | string | undefined | null): Date | null {
  if (!dateNum) return null;
  const s = String(dateNum).trim();
  if (s.length !== 8) return null;
  const year = parseInt(s.substring(0, 4), 10);
  const month = parseInt(s.substring(4, 6), 10) - 1; // 0-indexed in JS Date
  const day = parseInt(s.substring(6, 8), 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

/**
 * formats a Date object into "DD/MM/YYYY" (Brazilian format)
 */
export function formatBrDate(date: Date | null): string {
  if (!date) return "—";
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parses numeric date YYYYMMDD and returns formatted "DD/MM/YYYY"
 */
export function formatRawDateToBr(dateNum: number | string | undefined | null): string {
  const date = parseYYYYMMDD(dateNum);
  return formatBrDate(date);
}

/**
 * Calculates length of stay (permanence) in days between two YYYYMMDD dates
 */
export function calculatePermanence(dtInter: number | string | undefined | null, dtSaida: number | string | undefined | null): number {
  const dateInter = parseYYYYMMDD(dtInter);
  const dateSaida = parseYYYYMMDD(dtSaida);
  if (!dateInter || !dateSaida) return 0;
  const diffTime = dateSaida.getTime() - dateInter.getTime();
  const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return days < 0 ? 0 : days;
}

// Reconstructs full SUSRecord objects from various server responses (including compact column/row arrays)
export function parseServerSlotData(slotJson: any, slotIndex: number): SUSRecord[] {
  if (!slotJson) return [];
  const sId = slotIndex + 1;
  if (Array.isArray(slotJson)) {
    return slotJson.map((row) => (row._slotId ? row : { ...row, _slotId: sId }));
  }
  if (Array.isArray(slotJson.data)) {
    return slotJson.data.map((row: any) => (row._slotId ? row : { ...row, _slotId: sId }));
  }
  if (slotJson.cols && Array.isArray(slotJson.rows)) {
    const cols: string[] = slotJson.cols;
    const rows: any[][] = slotJson.rows;
    const numCols = cols.length;
    const total = rows.length;
    const result: SUSRecord[] = new Array(total);
    for (let r = 0; r < total; r++) {
      const rowArr = rows[r];
      const obj: any = { _slotId: sId };
      for (let c = 0; c < numCols; c++) {
        obj[cols[c]] = rowArr[c];
      }
      result[r] = obj;
    }
    return result;
  }
  return [];
}

// Asynchronous parser with yielding to keep UI completely responsive for large datasets (e.g. 700k+ records)
export async function parseServerSlotDataAsync(
  slotJson: any,
  slotIndex: number,
  onProgress?: (percent: number, loaded: number, total: number) => void
): Promise<SUSRecord[]> {
  if (!slotJson) return [];
  const sId = slotIndex + 1;
  if (Array.isArray(slotJson)) {
    return slotJson.map((row) => (row._slotId ? row : { ...row, _slotId: sId }));
  }
  if (Array.isArray(slotJson.data)) {
    return slotJson.data.map((row: any) => (row._slotId ? row : { ...row, _slotId: sId }));
  }
  if (slotJson.cols && Array.isArray(slotJson.rows)) {
    const cols: string[] = slotJson.cols;
    const rows: any[][] = slotJson.rows;
    const numCols = cols.length;
    const total = rows.length;
    const result: SUSRecord[] = new Array(total);

    const CHUNK_SIZE = 35000;
    for (let r = 0; r < total; r += CHUNK_SIZE) {
      const end = Math.min(r + CHUNK_SIZE, total);
      for (let i = r; i < end; i++) {
        const rowArr = rows[i];
        const obj: any = { _slotId: sId };
        for (let c = 0; c < numCols; c++) {
          obj[cols[c]] = rowArr[c];
        }
        result[i] = obj;
      }
      if (onProgress && total > 0) {
        onProgress(Math.round((end / total) * 100), end, total);
      }
      if (total > 35000) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    return result;
  }
  return [];
}

export default function App() {
  // Load initial database: starts with standard mock until async IndexedDB/Server loader populates
  const [db, setDb] = useState<SUSRecord[]>(MOCK_DATABASE);

  const [fileName, setFileName] = useState<string | null>(() => {
    try {
      return localStorage.getItem("neossus_cached_filename") || null;
    } catch {
      return null;
    }
  });

  // State to support uploading up to 3 separate database files
  const [slotNames, setSlotNames] = useState<(string | null)[]>(() => {
    try {
      const cachedSlots = localStorage.getItem("neossus_cached_slotnames");
      if (cachedSlots) {
        const parsed = JSON.parse(cachedSlots);
        if (Array.isArray(parsed) && parsed.length === 3) {
          return parsed;
        }
      }
      const cachedName = localStorage.getItem("neossus_cached_filename");
      if (cachedName) {
        if (cachedName.includes(" + ")) {
          const parts = cachedName.split(" + ");
          return [
            parts[0] || null,
            parts[1] || null,
            parts[2] || null
          ];
        }
        return [cachedName, null, null];
      }
    } catch {}
    return [null, null, null];
  });

  // Effect to automatically synchronize fileName and slot names when any slotName changes
  useEffect(() => {
    const activeNames = slotNames.filter(Boolean) as string[];
    const combinedName = activeNames.length > 0 ? activeNames.join(" + ") : null;
    setFileName(combinedName);
    try {
      localStorage.setItem("neossus_cached_slotnames", JSON.stringify(slotNames));
      if (combinedName) {
        localStorage.setItem("neossus_cached_filename", combinedName);
      } else {
        localStorage.removeItem("neossus_cached_filename");
      }
    } catch {}
  }, [slotNames]);

  const [selectedProcedure, setSelectedProcedure] = useState<string>(() => {
    try {
      const cachedProc = localStorage.getItem("neossus_cached_procedure");
      // Check if it's correct in matching the currently active records
      const cachedDbStr = localStorage.getItem("neossus_cached_db");
      const activeDb = cachedDbStr ? JSON.parse(cachedDbStr) : MOCK_DATABASE;
      if (cachedProc && Array.isArray(activeDb) && activeDb.some(r => r["PROCEDIMENTO PRINCIPAL"] === cachedProc)) {
        return cachedProc;
      }
    } catch {}
    return "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)";
  });

  const [activeTab, setActiveTab] = useState<"dashboard" | "advanced-comparator" | "spreadsheet" | "custom-compare">("advanced-comparator");
  const [selectedNaihToInspect, setSelectedNaihToInspect] = useState<number | null>(null);
  const [selectedActCodeFilter, setSelectedActCodeFilter] = useState<string>("");
  
  // Custom CSV uploading states
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSchemaReview, setShowSchemaReview] = useState<boolean>(false);

  // States to keep track of memory footprint and storage quota status
  const [saveStatus, setSaveStatus] = useState<"standard" | "cached" | "error-quota" | "saving" | "server-fixed">("standard");

  // Fixed Server Dataset state and feedback
  const [serverDatasetInfo, setServerDatasetInfo] = useState<{
    isFixed: boolean;
    metadata?: {
      fileName: string;
      totalRecords: number;
      uniqueAihs: number;
      uniqueHospitals: number;
      uniqueProcedures: number;
      competencePeriod?: string;
      totalValueFormatted?: string;
      fileSizeBytes?: number;
      slots?: any[];
      createdAt?: string;
      updatedAt?: string;
    };
    isSaving?: boolean;
  }>({ isFixed: false });
  const [serverSaveSuccessMsg, setServerSaveSuccessMsg] = useState<string | null>(null);
  const [savingSlotIndex, setSavingSlotIndex] = useState<number | null>(null);

  // Live transmission progress for large datasets (e.g. 1.9M rows)
  const [saveProgress, setSaveProgress] = useState<{
    active: boolean;
    currentChunk: number;
    totalChunks: number;
    percent: number;
    message: string;
    error: string | null;
  }>({
    active: false,
    currentChunk: 0,
    totalChunks: 0,
    percent: 0,
    message: "",
    error: null,
  });

  // Server live verification inspector state
  const [serverVerificationDetails, setServerVerificationDetails] = useState<any | null>(null);
  const [isVerifyingServer, setIsVerifyingServer] = useState<boolean>(false);

  // In-app confirmation modal state (replaces window.confirm which is blocked by iframe sandboxes)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: "danger" | "primary";
    onConfirm: () => void;
  } | null>(null);

  // Share Analysis Modal state
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);

  // Multi-user synchronization detection
  const [newServerVersionAvailable, setNewServerVersionAvailable] = useState<{
    fileName: string;
    totalRecords: number;
    updatedAt: string;
  } | null>(null);
  const [isRefreshingFromServer, setIsRefreshingFromServer] = useState<boolean>(false);
  const procedureCacheRef = useRef<Map<string, SUSRecord[]>>(new Map());
  const [isLoadingProcedure, setIsLoadingProcedure] = useState<boolean>(false);

  // Read initial URL params on start (e.g. ?proc=...&tab=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlProc = params.get("proc");
      const urlTab = params.get("tab");
      if (urlProc) {
        setSelectedProcedure(decodeURIComponent(urlProc));
      }
      if (
        urlTab &&
        ["dashboard", "advanced-comparator", "comparative", "spreadsheet"].includes(urlTab)
      ) {
        setActiveTab(urlTab as any);
      }
    } catch {}
  }, []);

  // Sync URL parameters whenever activeTab or selectedProcedure changes so copying address bar works
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (selectedProcedure) {
        url.searchParams.set("proc", selectedProcedure);
      } else {
        url.searchParams.delete("proc");
      }
      if (activeTab && activeTab !== "dashboard") {
        url.searchParams.set("tab", activeTab);
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, [selectedProcedure, activeTab]);

  // Dynamically load records from Central Server SQLite index when user switches procedure
  useEffect(() => {
    if (!selectedProcedure) return;
    if (saveStatus !== "server-fixed" && !serverDatasetInfo.isFixed) return;

    // Check if the current in-memory db already contains records for this procedure
    const alreadyInDb =
      db !== MOCK_DATABASE &&
      db.length > 0 &&
      db.every((r) => r["PROCEDIMENTO PRINCIPAL"] === selectedProcedure);
    if (alreadyInDb) return;

    // Check fast in-memory cache
    if (procedureCacheRef.current.has(selectedProcedure)) {
      const cached = procedureCacheRef.current.get(selectedProcedure)!;
      setDb(cached);
      return;
    }

    let isMounted = true;
    setIsLoadingProcedure(true);

    fetch(`/api/dataset/procedure?name=${encodeURIComponent(selectedProcedure)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data || !Array.isArray(data.rows)) return;
        const cols: string[] = data.cols || RECORD_COLUMNS;
        const parsed: SUSRecord[] = data.rows.map((rowArr: any[]) => {
          const obj: any = {};
          for (let c = 0; c < cols.length; c++) {
            obj[cols[c]] = rowArr[c];
          }
          return obj as SUSRecord;
        });
        procedureCacheRef.current.set(selectedProcedure, parsed);
        setDb(parsed);
      })
      .catch((err) => console.warn("Failed to fetch procedure records:", err))
      .finally(() => {
        if (isMounted) setIsLoadingProcedure(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProcedure, saveStatus, serverDatasetInfo.isFixed]);

  // Periodic polling & window focus check to detect if another user updated the Central Database
  useEffect(() => {
    const checkServerUpdate = async () => {
      try {
        const res = await fetch("/api/dataset/status");
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.exists && data.metadata) {
          const currentLoadedTime = serverDatasetInfo?.metadata?.updatedAt;
          const serverUpdatedTime = data.metadata.updatedAt;
          if (currentLoadedTime && serverUpdatedTime && serverUpdatedTime !== currentLoadedTime) {
            setNewServerVersionAvailable({
              fileName: data.metadata.fileName || "Nova base",
              totalRecords: data.metadata.totalRecords || 0,
              updatedAt: serverUpdatedTime,
            });
          }
        }
      } catch {}
    };

    const intervalId = setInterval(checkServerUpdate, 30000);
    const onFocus = () => checkServerUpdate();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [serverDatasetInfo?.metadata?.updatedAt]);

  // Determine actual persistence status on start and load authoritative database from Central Server
  useEffect(() => {
    async function loadPersistedData() {
      try {
        setSaveStatus("saving");

        // Check if procedure was passed via URL query
        let urlProc: string | null = null;
        try {
          const params = new URLSearchParams(window.location.search);
          urlProc = params.get("proc");
          if (urlProc) urlProc = decodeURIComponent(urlProc);
        } catch {}

        // 1. PRIMARY & AUTHORITATIVE: Check Central Server database shared for all users
        try {
          const statusRes = await fetch("/api/dataset/status");
          if (statusRes.ok) {
            const statusJson = await statusRes.json();
            if (statusJson && statusJson.exists && statusJson.metadata) {
              setServerDatasetInfo({ isFixed: true, metadata: statusJson.metadata });

              const metaSlots = statusJson.metadata.slots as any[] | undefined;
              const activeSlots = Array.isArray(metaSlots)
                ? metaSlots.map((s, idx) => (s && s.recordsCount > 0 ? { ...s, slotIndex: idx } : null))
                : [null, null, null];

              const hasSlotData = activeSlots.some(Boolean);

              if (hasSlotData || (statusJson.metadata && statusJson.metadata.totalRecords > 0)) {
                const restoredSlotNames: (string | null)[] = [null, null, null];
                for (let i = 0; i < 3; i++) {
                  if (activeSlots[i]?.fileName) restoredSlotNames[i] = activeSlots[i].fileName;
                }

                setSaveStatus("server-fixed");
                setSlotNames(restoredSlotNames);
                const activeNames = restoredSlotNames.filter(Boolean) as string[];
                setFileName(activeNames.join(" + ") || statusJson.metadata.fileName || "base_hucm_fixa.csv");

                // Determine target procedure to load
                const targetProc =
                  urlProc ||
                  (statusJson.metadata.proceduresList?.includes("RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)")
                    ? "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)"
                    : statusJson.metadata.proceduresList?.[0] || "");

                if (targetProc) {
                  setSelectedProcedure(targetProc);
                  try {
                    const procRes = await fetch(`/api/dataset/procedure?name=${encodeURIComponent(targetProc)}`);
                    if (procRes.ok) {
                      const procJson = await procRes.json();
                      if (procJson && Array.isArray(procJson.rows) && procJson.rows.length > 0) {
                        const cols: string[] = procJson.cols || RECORD_COLUMNS;
                        const parsedRecords: SUSRecord[] = procJson.rows.map((rowArr: any[]) => {
                          const obj: any = {};
                          for (let c = 0; c < cols.length; c++) {
                            obj[cols[c]] = rowArr[c];
                          }
                          return obj as SUSRecord;
                        });

                        procedureCacheRef.current.set(targetProc, parsedRecords);
                        setDb(parsedRecords);
                      }
                    }
                  } catch (procErr) {
                    console.warn("Failed to fetch initial procedure from SQLite index:", procErr);
                  }
                }
                return;
              }
            }
          }
        } catch (serverErr) {
          console.warn("Could not check server dataset, checking local cache:", serverErr);
        }

        // 2. Check local client IndexedDB storage
        const loaded = await loadFromIndexedDB();
        if (loaded && Array.isArray(loaded.db) && loaded.db.length > 0) {
          setDb(loaded.db);
          if (loaded.slotNames && loaded.slotNames.some(Boolean)) {
            setSlotNames(loaded.slotNames);
            try {
              localStorage.setItem("neossus_cached_slotnames", JSON.stringify(loaded.slotNames));
            } catch {}
          } else if (loaded.fileName) {
            if (loaded.fileName.includes(" + ")) {
              const parts = loaded.fileName.split(" + ");
              setSlotNames([
                parts[0] || null,
                parts[1] || null,
                parts[2] || null
              ]);
            } else {
              setSlotNames([loaded.fileName, null, null]);
            }
          }
          if (loaded.fileName) {
            setFileName(loaded.fileName);
            try {
              localStorage.setItem("neossus_cached_filename", loaded.fileName);
            } catch {}
          }
          if (loaded.selectedProcedure) {
            setSelectedProcedure(loaded.selectedProcedure);
            try {
              localStorage.setItem("neossus_cached_procedure", loaded.selectedProcedure);
            } catch {}
          }
          setSaveStatus("cached");
        } else {
          // Fallback to localStorage for small base if previously cached
          const localDbStr = localStorage.getItem("neossus_cached_db");
          if (localDbStr) {
            try {
              const parsed = JSON.parse(localDbStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setDb(parsed);
                const localFile = localStorage.getItem("neossus_cached_filename");
                if (localFile) {
                  setFileName(localFile);
                  if (localFile.includes(" + ")) {
                    const parts = localFile.split(" + ");
                    setSlotNames([
                      parts[0] || null,
                      parts[1] || null,
                      parts[2] || null
                    ]);
                  } else {
                    setSlotNames([localFile, null, null]);
                  }
                }
                const localProc = localStorage.getItem("neossus_cached_procedure");
                if (localProc) setSelectedProcedure(localProc);
                setSaveStatus("cached");
                return;
              }
            } catch {}
          }
          setSaveStatus("standard");
        }
      } catch (e) {
        console.warn("Could not load from IndexedDB or storage, using defaults:", e);
        setSaveStatus("standard");
      }
    }
    loadPersistedData();
  }, []);

  // Lightweight persistence for selectedProcedure
  useEffect(() => {
    if (selectedProcedure) {
      try {
        localStorage.setItem("neossus_cached_procedure", selectedProcedure);
      } catch {}
    }
  }, [selectedProcedure]);

  // Autosave to IndexedDB on any modification or replacement of database records (local uploads only)
  useEffect(() => {
    // If we're using MOCK_DATABASE with absolutely no user uploaded CSV, don't auto cache to save space
    if (db === MOCK_DATABASE && (!fileName || slotNames.every((s) => !s))) {
      return;
    }
    // If data is safely hosted on the central server database, avoid redundant multi-megabyte IndexedDB writes
    if (saveStatus === "server-fixed" || serverDatasetInfo.isFixed) {
      return;
    }
    let isMounted = true;
    async function savePersisted() {
      try {
        if (isMounted) setSaveStatus("saving");

        // Save to IndexedDB (chunked per slot, safe for millions of records)
        await saveToIndexedDB(db, slotNames, selectedProcedure);

        // Lightweight metadata persistence in localStorage
        try {
          localStorage.setItem("neossus_cached_slotnames", JSON.stringify(slotNames));
          if (fileName) {
            localStorage.setItem("neossus_cached_filename", fileName);
          } else {
            localStorage.removeItem("neossus_cached_filename");
          }
        } catch {
          // Ignore
        }

        if (isMounted) setSaveStatus("cached");
      } catch (e) {
        console.warn("Storage write failed:", e);
        if (isMounted) setSaveStatus("error-quota");
      }
    }

    const timer = setTimeout(() => {
      savePersisted();
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [db, slotNames, fileName, saveStatus]);

  // States for hospital ticket composition and analytical sorting (Requirement 1)
  const [hospitalSortBy, setHospitalSortBy] = useState<"value-desc" | "value-asc" | "name-asc">("value-desc");
  const [aihSortBy, setAihSortBy] = useState<"value-desc" | "value-asc" | "uti-desc" | "uti-asc">("value-desc");
  const [rankingMetric, setRankingMetric] = useState<"average" | "maximum">("average");

  // State to track expanded hospitals in the "Agrupado por Código" UTI view
  const [expandedHospitals, setExpandedHospitals] = useState<Record<string, boolean>>({});

  // Dynamic calculation of the first & last date parsed and cached
  const analysisPeriod = useMemo(() => {
    if (!db || db.length === 0) return null;
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (let i = 0; i < db.length; i++) {
      const record = db[i];
      const dtInter = record.SP_DTINTER;
      const dtSaida = record.SP_DTSAIDA;

      if (dtInter) {
        const dInter = parseYYYYMMDD(dtInter);
        if (dInter) {
          if (!minDate || dInter < minDate) {
            minDate = dInter;
          }
          if (!maxDate || dInter > maxDate) {
            maxDate = dInter;
          }
        }
      }

      if (dtSaida) {
        const dSaida = parseYYYYMMDD(dtSaida);
        if (dSaida) {
          if (!minDate || dSaida < minDate) {
            minDate = dSaida;
          }
          if (!maxDate || dSaida > maxDate) {
            maxDate = dSaida;
          }
        }
      }
    }

    if (!minDate || !maxDate) return null;

    return {
      first: minDate,
      last: maxDate,
      firstFormatted: formatBrDate(minDate),
      lastFormatted: formatBrDate(maxDate),
      daysCount: Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
    };
  }, [db]);

  // Dynamic calculation of the competence period (SP_AA and SP_MM) (Requirement: Período de Competência do menor Mês/Ano ao maior)
  const competencePeriod = useMemo(() => {
    if (!db || db.length === 0) return null;
    let minCompVal = Infinity;
    let maxCompVal = -Infinity;
    let minYear = 2026;
    let minMonth = 1;
    let maxYear = 2026;
    let maxMonth = 1;
    let found = false;

    for (let i = 0; i < db.length; i++) {
      const record = db[i];
      let aa = Number(record.SP_AA);
      let mm = Number(record.SP_MM);

      // Normalize 2-digit years (e.g. 25 -> 2025)
      if (aa > 0 && aa < 100) aa = 2000 + aa;

      // Fallback from SP_DTINTER if missing or invalid
      if ((isNaN(aa) || aa < 1990 || isNaN(mm) || mm < 1 || mm > 12) && record.SP_DTINTER) {
        const dtStr = String(record.SP_DTINTER).replace(/\D/g, "");
        if (dtStr.length === 8) {
          const y = parseInt(dtStr.substring(0, 4), 10);
          const m = parseInt(dtStr.substring(4, 6), 10);
          if (y >= 1990 && m >= 1 && m <= 12) {
            aa = y;
            mm = m;
          }
        }
      }

      if (!isNaN(aa) && !isNaN(mm) && aa > 1900 && mm >= 1 && mm <= 12) {
        const compVal = aa * 12 + (mm - 1);
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
        found = true;
      }
    }

    if (!found) return null;

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const startFormatted = `${pad(minMonth)}/${minYear}`;
    const endFormatted = `${pad(maxMonth)}/${maxYear}`;
    const isSame = minYear === maxYear && minMonth === maxMonth;
    const label = isSame ? startFormatted : `${startFormatted} a ${endFormatted}`;

    // Start of competence period: 1st day of minMonth/minYear
    const startDate = new Date(minYear, minMonth - 1, 1);
    // End of competence period: last day of maxMonth/maxYear (0th day of the next month is the last day of this month)
    const endDate = new Date(maxYear, maxMonth, 0);

    return {
      startYear: minYear,
      startMonth: minMonth,
      endYear: maxYear,
      endMonth: maxMonth,
      startFormatted,
      endFormatted,
      isSame,
      label,
      startDate,
      endDate,
      startDateFormatted: formatBrDate(startDate),
      endDateFormatted: formatBrDate(endDate),
    };
  }, [db]);

  const toggleHospitalExpand = (hospitalName: string) => {
    setExpandedHospitals((prev) => ({
      ...prev,
      [hospitalName]: !prev[hospitalName],
    }));
  };

  // Toggle validation active/inactive on a specific record with direct reactive update
  const handleToggleValidation = (index: number) => {
    setDb((prev) =>
      prev.map((r, i) => (i === index ? { ...r, Valida: r.Valida === false ? true : false } : r))
    );
  };

  // Modify quantities or specific cell pricing parameters with direct reactive update
  const handleUpdateRecordValue = (index: number, field: keyof SUSRecord, val: any) => {
    setDb((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: val } : r))
    );
  };

  // Reset to default mock database
  const handleResetData = async () => {
    setDb(MOCK_DATABASE);
    setFileName(null);
    setSlotNames([null, null, null]);
    setUploadError(null);
    setUploadProgress(null);
    setSelectedProcedure("RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)");
    setSelectedNaihToInspect(null);
    setActiveTab("dashboard");
    setSaveStatus("standard");
    try {
      localStorage.removeItem("neossus_cached_db");
      localStorage.removeItem("neossus_cached_slotnames");
      localStorage.removeItem("neossus_cached_filename");
      localStorage.removeItem("neossus_cached_procedure");
      await clearIndexedDB();
    } catch (e) {
      console.error("Failed to clear caches:", e);
    }
  };

  // Consolidated database stats computed in a single pass to eliminate redundant render loops
  const databaseStats = useMemo(() => {
    if (!db || db.length === 0 || db === MOCK_DATABASE) {
      return { total: 0, valid: 0, filtered: 0, ratio: 0, slotCounts: [0, 0, 0] };
    }
    let valid = 0;
    let filtered = 0;
    const slotCounts = [0, 0, 0];
    const total = db.length;
    for (let i = 0; i < total; i++) {
      const r = db[i];
      if (r.Valida !== false) valid++;
      else filtered++;
      const sId = r._slotId || 1;
      if (sId >= 1 && sId <= 3) {
        slotCounts[sId - 1]++;
      }
    }
    const ratio = total > 0 ? Math.round((valid / total) * 100) : 0;
    return { total, valid, filtered, ratio, slotCounts };
  }, [db]);

  const getSlotRecordsCount = (idx: number) => {
    if (db === MOCK_DATABASE) return 0;
    return databaseStats.slotCounts[idx] || 0;
  };

  // Save a specific slot (0, 1, or 2) directly to the server's permanent disk storage in safe 10k-record chunks
  const saveSingleSlotToServer = async (
    slotIndex: number,
    overrideRecords?: SUSRecord[],
    overrideFileName?: string
  ): Promise<boolean> => {
    // Safety guard: If this slot is ALREADY fixed in the Central Server with full records,
    // NEVER overwrite it with an in-memory single-procedure slice!
    const existingServerSlot = serverDatasetInfo.isFixed && serverDatasetInfo.metadata?.slots?.[slotIndex];
    if (!overrideRecords && existingServerSlot && (existingServerSlot.recordsCount || 0) > 0) {
      console.log(`Slot ${slotIndex + 1} já está consolidado no Banco Central com ${existingServerSlot.recordsCount} registros. Preservando integridade.`);
      return true;
    }

    const slotRecords =
      overrideRecords ||
      db.filter((r) => {
        if (slotIndex === 0) return !r._slotId || r._slotId === 1;
        return r._slotId === slotIndex + 1;
      });

    if (!slotRecords || slotRecords.length === 0) {
      return false;
    }

    const sName = overrideFileName || slotNames[slotIndex] || `base_${slotIndex + 1}.csv`;
    const uploadId = `upload_slot_${slotIndex}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const CHUNK_SIZE = 10000; // ~4.5MB JSON payload, safely below proxy limits
    const totalChunks = Math.ceil(slotRecords.length / CHUNK_SIZE);

    try {
      setSavingSlotIndex(slotIndex);
      setSaveProgress({
        active: true,
        currentChunk: 0,
        totalChunks,
        percent: 0,
        message: `Iniciando gravação da Base ${slotIndex + 1} (${sName}) no Banco Central...`,
        error: null,
      });

      // 1. Start chunked upload session for this slot
      const startRes = await fetch("/api/dataset/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, fileName: sName, slotIndex }),
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || `Falha ao inicializar envio da Base ${slotIndex + 1}`);
      }

      // 2. Transmit each chunk with retry
      for (let i = 0; i < totalChunks; i++) {
        const slice = slotRecords.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const percent = Math.round(((i + 1) / totalChunks) * 100);
        const processedCount = Math.min((i + 1) * CHUNK_SIZE, slotRecords.length);

        setSaveProgress({
          active: true,
          currentChunk: i + 1,
          totalChunks,
          percent,
          message: `Gravando Base ${slotIndex + 1}: lote ${i + 1} de ${totalChunks} (${processedCount.toLocaleString("pt-BR")} de ${slotRecords.length.toLocaleString("pt-BR")} registros)...`,
          error: null,
        });

        let chunkSuccess = false;
        let lastErr = "";
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const chunkRes = await fetch("/api/dataset/chunk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uploadId, chunk: slice }),
            });
            if (chunkRes.ok) {
              chunkSuccess = true;
              break;
            } else {
              const err = await chunkRes.json().catch(() => ({}));
              lastErr = err.error || `Erro HTTP ${chunkRes.status}`;
            }
          } catch (netErr: any) {
            lastErr = netErr.message;
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        if (!chunkSuccess) {
          throw new Error(`Falha ao transmitir lote ${i + 1} da Base ${slotIndex + 1}: ${lastErr}`);
        }
      }

      // 3. Finalize slot on server
      setSaveProgress((prev) => ({
        ...prev,
        percent: 100,
        message: `Consolidando Base ${slotIndex + 1} no Banco Central...`,
      }));

      const finishRes = await fetch("/api/dataset/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });

      if (!finishRes.ok) {
        const err = await finishRes.json().catch(() => ({}));
        throw new Error(err.error || `Falha ao consolidar Base ${slotIndex + 1}`);
      }

      const finishData = await finishRes.json();
      setServerDatasetInfo({
        isFixed: true,
        metadata: finishData.metadata,
        isSaving: false,
      });
      setSaveStatus("server-fixed");
      setSaveProgress({
        active: false,
        currentChunk: 0,
        totalChunks: 0,
        percent: 100,
        message: "",
        error: null,
      });
      setServerSaveSuccessMsg(
        `✅ Base ${slotIndex + 1} (${sName}) consolidada e fixada no Banco Central com sucesso! (${slotRecords.length.toLocaleString("pt-BR")} registros disponíveis para todos os usuários).`
      );
      setTimeout(() => setServerSaveSuccessMsg(null), 10000);
      return true;
    } catch (err: any) {
      setSaveProgress((prev) => ({
        ...prev,
        active: false,
        error: err.message || "Erro durante gravação no servidor",
      }));
      return false;
    } finally {
      setSavingSlotIndex(null);
    }
  };

  // Save ALL loaded database slots directly to the server's permanent disk storage
  const handleSaveAsFixedServerDatabase = async () => {
    if (!db || db.length === 0 || (db === MOCK_DATABASE && !fileName)) {
      setSaveProgress((prev) => ({
        ...prev,
        error: "Carregue ao menos um arquivo CSV válido antes de fixar no servidor.",
      }));
      return;
    }

    setServerSaveSuccessMsg(null);
    const activeSlotsToSave: number[] = [];
    for (let i = 0; i < 3; i++) {
      const count = getSlotRecordsCount(i);
      const isServerFixed = serverDatasetInfo.isFixed && (serverDatasetInfo.metadata?.slots?.[i]?.recordsCount || 0) > 0;
      if (count > 0 || slotNames[i] || isServerFixed) {
        activeSlotsToSave.push(i);
      }
    }

    if (activeSlotsToSave.length === 0) {
      activeSlotsToSave.push(0);
    }

    // Safety: If all active slots are ALREADY fixed on the server with full fidelity,
    // do NOT re-upload in-memory single-procedure slices! Just synchronize.
    const allAlreadyFixed = activeSlotsToSave.every(
      (idx) => serverDatasetInfo.isFixed && (serverDatasetInfo.metadata?.slots?.[idx]?.recordsCount || 0) > 0
    );

    if (allAlreadyFixed) {
      await handleReloadFromServerDatabase();
      const totalRecs = serverDatasetInfo.metadata?.totalRecords || 0;
      setServerSaveSuccessMsg(
        `✅ Todas as bases já estão consolidadas e ativas no Banco Central com fidelidade total (${totalRecs.toLocaleString("pt-BR")} registros compartilhados para todos os usuários)!`
      );
      setTimeout(() => setServerSaveSuccessMsg(null), 8000);
      return;
    }

    let allSaved = true;
    let totalSavedRecords = 0;

    for (const slotIdx of activeSlotsToSave) {
      const ok = await saveSingleSlotToServer(slotIdx);
      if (!ok) {
        allSaved = false;
        break;
      }
      const sMetaCount = serverDatasetInfo.metadata?.slots?.[slotIdx]?.recordsCount;
      totalSavedRecords += sMetaCount || getSlotRecordsCount(slotIdx);
    }

    if (allSaved) {
      setSaveProgress({
        active: false,
        currentChunk: 0,
        totalChunks: 0,
        percent: 100,
        message: "",
        error: null,
      });
      const names = slotNames.filter(Boolean).join(", ");
      setServerSaveSuccessMsg(
        `✅ Todas as bases (${names || "Base Principal"}) foram consolidadas e fixadas com sucesso no Banco Central! Total de ${totalSavedRecords.toLocaleString("pt-BR")} registros compartilhados para todos os usuários que acessarem o link.`
      );
      setTimeout(() => setServerSaveSuccessMsg(null), 12000);
    }
  };

  // Inspect live server state to confirm dataset on physical disk
  const handleVerifyServerDataset = async () => {
    try {
      setIsVerifyingServer(true);
      const res = await fetch("/api/dataset/status");
      if (res.ok) {
        const json = await res.json();
        setServerVerificationDetails(json);
      } else {
        setServerVerificationDetails({ exists: false, error: "Resposta inválida do servidor" });
      }
    } catch (e: any) {
      setServerVerificationDetails({ exists: false, error: e.message });
    } finally {
      setIsVerifyingServer(false);
    }
  };

  // Delete server's permanent database and revert to demo
  const handleResetServerDatabase = () => {
    setConfirmModal({
      isOpen: true,
      title: "Limpar Banco Central",
      message: "Tem certeza que deseja remover todas as bases do Banco Central e restaurar a base de demonstração do sistema?",
      confirmLabel: "Sim, Limpar Banco",
      confirmVariant: "danger",
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await fetch("/api/dataset", { method: "DELETE" });
          setServerDatasetInfo({ isFixed: false });
          setServerVerificationDetails(null);
          await handleResetData();
          setServerSaveSuccessMsg("Banco central removido com sucesso. Base padrão restaurada.");
          setTimeout(() => setServerSaveSuccessMsg(null), 5000);
        } catch (err) {
          console.error("Failed to delete server dataset:", err);
        }
      }
    });
  };

  // Reload and re-sync authoritative database from Central Server
  const handleReloadFromServerDatabase = async () => {
    try {
      setIsRefreshingFromServer(true);
      setNewServerVersionAvailable(null);
      setSaveProgress({
        active: true,
        currentChunk: 0,
        totalChunks: 1,
        percent: 20,
        message: "Sincronizando com o Banco Central compartilhado...",
        error: null,
      });

      const res = await fetch("/api/dataset/status");
      if (!res.ok) throw new Error("Erro ao consultar status do servidor");
      const data = await res.json();

      if (!data || !data.exists) {
        setSaveProgress({ active: false, currentChunk: 0, totalChunks: 0, percent: 0, message: "", error: null });
        setServerSaveSuccessMsg("Nenhuma base encontrada no Banco Central.");
        setTimeout(() => setServerSaveSuccessMsg(null), 5000);
        return;
      }

      setServerDatasetInfo({ isFixed: true, metadata: data.metadata });
      const metaSlots = data.metadata?.slots as any[] | undefined;
      const activeSlots = Array.isArray(metaSlots)
        ? metaSlots.map((s, idx) => (s && s.recordsCount > 0 ? { ...s, slotIndex: idx } : null))
        : [null, null, null];

      const restoredSlotNames: (string | null)[] = [null, null, null];
      for (let i = 0; i < 3; i++) {
        if (activeSlots[i]?.fileName) restoredSlotNames[i] = activeSlots[i].fileName;
      }

      // Clear local memory cache so fresh data from server is fetched
      procedureCacheRef.current.clear();

      const targetProc =
        selectedProcedure ||
        (data.metadata?.proceduresList?.includes("RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)")
          ? "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)"
          : data.metadata?.proceduresList?.[0] || "");

      setSaveProgress({
        active: true,
        currentChunk: 1,
        totalChunks: 1,
        percent: 60,
        message: `Sincronizando ${targetProc ? `"${targetProc.substring(0, 30)}..."` : "Banco Central"}...`,
        error: null,
      });

      if (targetProc) {
        const procRes = await fetch(`/api/dataset/procedure?name=${encodeURIComponent(targetProc)}`);
        if (procRes.ok) {
          const procJson = await procRes.json();
          if (procJson && Array.isArray(procJson.rows)) {
            const cols: string[] = procJson.cols || RECORD_COLUMNS;
            const parsedRecords: SUSRecord[] = procJson.rows.map((rowArr: any[]) => {
              const obj: any = {};
              for (let c = 0; c < cols.length; c++) {
                obj[cols[c]] = rowArr[c];
              }
              return obj as SUSRecord;
            });
            procedureCacheRef.current.set(targetProc, parsedRecords);
            setDb(parsedRecords);
          }
        }
      }

      setSaveProgress({ active: false, currentChunk: 0, totalChunks: 0, percent: 100, message: "", error: null });
      setSaveStatus("server-fixed");
      setSlotNames(restoredSlotNames);
      setFileName(restoredSlotNames.filter(Boolean).join(" + ") || data.metadata?.fileName || "base_hucm_fixa.csv");

      const totalFmt = (data.metadata?.totalRecords || 0).toLocaleString("pt-BR");
      setServerSaveSuccessMsg(
        `✅ Banco Central sincronizado com sucesso! Base com ${totalFmt} registros consolidados pronta para análise.`
      );
      setTimeout(() => setServerSaveSuccessMsg(null), 8000);
    } catch (err: any) {
      setSaveProgress({
        active: false,
        currentChunk: 0,
        totalChunks: 0,
        percent: 0,
        message: "",
        error: `Erro ao sincronizar do Banco Central: ${err.message}`,
      });
    } finally {
      setIsRefreshingFromServer(false);
    }
  };

  // Direct file stream upload to the Central Server database (guarantees shared fidelity for all users)
  const uploadFileDirectlyToServer = async (file: File, slotIndex: number): Promise<boolean> => {
    const sName = file.name;
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per chunk - safely below any reverse proxy request limits
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const uploadId = `raw_${slotIndex}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    setSavingSlotIndex(slotIndex);
    setSaveProgress({
      active: true,
      currentChunk: 0,
      totalChunks,
      percent: 0,
      message: `Iniciando transmissão de ${sName} para o Banco Central...`,
      error: null,
    });

    try {
      // Transmit file in 4MB binary slices to bypass any reverse proxy 413 body size limits
      for (let i = 0; i < totalChunks; i++) {
        const startByte = i * CHUNK_SIZE;
        const endByte = Math.min(startByte + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(startByte, endByte);

        const loadedMb = (endByte / (1024 * 1024)).toFixed(1);
        const totalMb = (file.size / (1024 * 1024)).toFixed(1);
        const percent = Math.round((endByte / file.size) * 88);

        setSaveProgress({
          active: true,
          currentChunk: i + 1,
          totalChunks,
          percent,
          message: `Transmitindo ${sName} ao Banco Central (${loadedMb} MB de ${totalMb} MB - bloco ${i + 1}/${totalChunks})...`,
          error: null,
        });

        let chunkSuccess = false;
        let lastError = "";

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const chunkRes = await fetch(
              `/api/dataset/upload-raw-chunk?uploadId=${uploadId}&chunkIndex=${i}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/octet-stream" },
                body: chunkBlob,
              }
            );

            if (chunkRes.ok) {
              chunkSuccess = true;
              break;
            } else {
              const errJson = await chunkRes.json().catch(() => ({}));
              lastError = errJson.error || `Erro HTTP ${chunkRes.status}`;
            }
          } catch (netErr: any) {
            lastError = netErr.message || "Erro de rede";
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        if (!chunkSuccess) {
          throw new Error(`Falha ao transmitir bloco ${i + 1}/${totalChunks}: ${lastError}`);
        }
      }

      // Finalize and trigger server-side streaming indexing (ingestCsvFileToSlot)
      setSaveProgress({
        active: true,
        currentChunk: totalChunks,
        totalChunks,
        percent: 92,
        message: `Arquivo enviado com sucesso! Indexando no Banco Central e SQLite...`,
        error: null,
      });

      const finishRes = await fetch("/api/dataset/upload-raw-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          fileName: sName,
          slotIndex,
        }),
      });

      if (!finishRes.ok) {
        const errJson = await finishRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Falha ao processar arquivo no servidor (HTTP ${finishRes.status})`);
      }

      const resJson = await finishRes.json();

      // Update slot names
      setSlotNames((prev) => {
        const next = [...prev];
        next[slotIndex] = sName;
        return next;
      });

      // Clear local memory cache so fresh data from server is loaded
      procedureCacheRef.current.clear();

      setServerDatasetInfo({
        isFixed: true,
        metadata: resJson.metadata,
        isSaving: false,
      });

      const targetProc =
        selectedProcedure ||
        (resJson.metadata?.proceduresList?.includes("RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)")
          ? "RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)"
          : resJson.metadata?.proceduresList?.[0] || "");

      if (targetProc) {
        const procRes = await fetch(`/api/dataset/procedure?name=${encodeURIComponent(targetProc)}`);
        if (procRes.ok) {
          const procJson = await procRes.json();
          if (procJson && Array.isArray(procJson.rows)) {
            const cols: string[] = procJson.cols || RECORD_COLUMNS;
            const parsedRecords: SUSRecord[] = procJson.rows.map((rowArr: any[]) => {
              const obj: any = {};
              for (let c = 0; c < cols.length; c++) {
                obj[cols[c]] = rowArr[c];
              }
              return obj as SUSRecord;
            });
            procedureCacheRef.current.set(targetProc, parsedRecords);
            setDb(parsedRecords);
            setSelectedProcedure(targetProc);
          }
        }
      }

      setSaveStatus("server-fixed");
      const slotCount = resJson.metadata?.slots?.[slotIndex]?.recordsCount || 0;
      setSaveProgress({
        active: false,
        currentChunk: 0,
        totalChunks: 0,
        percent: 100,
        message: "",
        error: null,
      });

      setServerSaveSuccessMsg(
        `✅ Base ${slotIndex + 1} (${sName}) adicionada com sucesso ao Banco Central! (${slotCount.toLocaleString("pt-BR")} registros gravados e indexados). Todos os usuários agora visualizam estes dados fielmente.`
      );
      setTimeout(() => setServerSaveSuccessMsg(null), 12000);
      return true;
    } catch (err: any) {
      setSaveProgress({
        active: false,
        currentChunk: 0,
        totalChunks: 0,
        percent: 0,
        message: "",
        error: err.message || "Erro ao enviar arquivo para o Banco Central",
      });
      return false;
    } finally {
      setSavingSlotIndex(null);
    }
  };

  // CSV parsing logic for a specific database slot (supporting 1 to 3 slots)
  const handleSlotCsvUpload = async (slotIndex: number, file: File) => {
    // Attempt direct streaming upload to server first (instant persistence for all users)
    const uploadedToServer = await uploadFileDirectlyToServer(file, slotIndex);
    if (uploadedToServer) {
      return;
    }
    setUploadProgress(0);
    setUploadError(null);

    // Limit read size to prevent crash in browser if file is gigantic (e.g. up to 500MB)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      chunkSize: 1024 * 1024 * 10, // 10MB chunks
      worker: true,
      
      complete: (results) => {
        setUploadProgress(100);
        const data = results.data as any[];
        
        if (!data || data.length === 0) {
          setUploadError(`O arquivo CSV da Base ${slotIndex + 1} está vazio ou não pôde ser analisado.`);
          return;
        }

        // Helper to query row fields case/space insensitively
        const getRowValue = (r: any, ...aliases: string[]): any => {
          if (!r) return undefined;
          const keys = Object.keys(r);
          const targets = aliases.map(a => a.trim().toUpperCase());
          for (const key of keys) {
            const cleanKey = key.trim().toUpperCase();
            if (targets.includes(cleanKey)) {
              return r[key];
            }
          }
          return undefined;
        };

        // Validate structure & map keys dynamically
        const firstRecord = data[0];
        const hasHospital = getRowValue(firstRecord, "HOSPITAL") !== undefined;
        const hasProcPrincipal = getRowValue(firstRecord, "PROCEDIMENTO PRINCIPAL", "PROCEDIMENTO_PRINCIPAL", "PROC_PRINCIPAL", "PROC PRINC_PRINCIPAL") !== undefined;

        if (!hasHospital && !hasProcPrincipal) {
          setUploadError(
            `Estrutura incompatível na Base ${slotIndex + 1}. O arquivo deve possuir pelo menos as colunas 'HOSPITAL' e 'PROCEDIMENTO PRINCIPAL' para análise.`
          );
          return;
        }

        // Normalize loaded data
        const normalizedRecords: SUSRecord[] = data.map((row, i) => {
          const hosp = getRowValue(row, "HOSPITAL") || "HOSPITAL DESCONHECIDO";
          const procPrinc = getRowValue(row, "PROCEDIMENTO PRINCIPAL", "PROCEDIMENTO_PRINCIPAL", "PROC_PRINCIPAL", "PROCEDIMENTO PRINCIPAL ") || "PROCEDIMENTO INDEFINIDO";
          const procAto = getRowValue(row, "PROCEDIMENTO ATO", "PROCEDIMENTO_ATO", "PROC_ATO", "PROCEDIMENTO ATO ") || "ATO COMPLEMENTAR";
          const tktRealRaw = getRowValue(row, "TICKET PROCEDIMENTO REAL", "TICKET_PROCEDIMENTO_REAL", "TICKET_PROCEDIMENTO", "TICKET PROCEDIMENTO REAL ");
          const tktReal = tktRealRaw !== undefined && tktRealRaw !== null ? String(tktRealRaw) : null;
          
          const rawAih = getRowValue(row, "SP_NAIH", "NAIH", "SPNAIH", "SP_NAIH ");
          let parsedAih = 3125150000000 + i;
          if (rawAih !== undefined && rawAih !== null) {
            const rawStr = String(rawAih).trim();
            if (rawStr.includes("E") || rawStr.includes("e") || rawStr.includes("+")) {
              parsedAih = parseFloat(rawStr) || (3125150000000 + i);
            } else {
              parsedAih = parseInt(rawStr, 10) || (3125150000000 + i);
            }
          }

          const rawProcrea = getRowValue(row, "SP_PROCREA", "PROCREA", "SPPROCREA", "SP_PROCREA ");
          let parsedProcrea = 0;
          if (rawProcrea !== undefined && rawProcrea !== null) {
            const rawStr = String(rawProcrea).trim();
            if (rawStr.includes("E") || rawStr.includes("e") || rawStr.includes("+")) {
              parsedProcrea = parseFloat(rawStr) || 0;
            } else {
              parsedProcrea = parseInt(rawStr, 10) || 0;
            }
          }

          const rawQtd = getRowValue(row, "SP_QTD_ATO", "QTD", "QTD_ATO", "SP_QTDATO", "SPQTDATO");
          const parsedQtd = rawQtd !== undefined ? Number(rawQtd) : 1;

          const rawValAto = getRowValue(row, "SP_VALATO", "VAL_ATO", "SPVALATO", "VALATO", "SP_VALATO ");
          const valAtoStr = rawValAto !== undefined && rawValAto !== null ? String(rawValAto) : "0,00";

          return {
            SP_GESTOR: Number(getRowValue(row, "SP_GESTOR") || 310620),
            SP_UF: Number(getRowValue(row, "SP_UF") || 31),
            SP_AA: Number(getRowValue(row, "SP_AA", "AA", "SPAA", "SP_AA ", "ANO", "YEAR", "SP_ANO", "SP_YEAR", "COMPETENCIA_ANO") || 2026) || 2026,
            SP_MM: Number(getRowValue(row, "SP_MM", "MM", "SPMM", "SP_MM ", "MES", "MÊS", "MONTH", "SP_MES", "SP_MONTH", "COMPETENCIA_MES") || 1) || 1,
            SP_CNES: Number(getRowValue(row, "SP_CNES") || 26972),
            SP_NAIH: parsedAih,
            SP_PROCREA: parsedProcrea,
            SP_DTINTER: normalizeDateToYYYYMMDD(getRowValue(row, "SP_DTINTER", "DTINTER", "DT_INTER", "DATEINTER", "DATA_INTERNACAO", "DT_INTERNACAO")),
            SP_DTSAIDA: normalizeDateToYYYYMMDD(getRowValue(row, "SP_DTSAIDA", "DTSAIDA", "DT_SAIDA", "DATESAIDA", "DATA_SAIDA")),
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
            Valida: (() => {
              const valRaw = getRowValue(row, "Valida", "valida", "VALIDA", "Valido", "valido", "VALIDO", "VALIDADO", "VALIDADA", "VALIDADE");
              if (valRaw === undefined || valRaw === null) return true;
              if (typeof valRaw === "boolean") return valRaw;
              if (typeof valRaw === "number") return valRaw === 1;
              const s = String(valRaw).trim().toUpperCase();
              if (s === "") return true; // empty cells default to true
              
              if (s === "TRUE" || s === "SIM" || s === "1" || s === "S" || s === "VALIDO" || s === "VÁLIDO" || s === "VALIDA" || s === "VÁLIDA" || s === "VERDADEIRO" || s === "VERDADEIRA") {
                return true;
              }
              if (s === "FALSE" || s === "NAO" || s === "NÃO" || s === "0" || s === "N" || s === "INVALIDO" || s === "INVÁLIDO" || s === "INVALIDA" || s === "INVÁLIDA" || s === "FALSO" || s === "FALSA") {
                return false;
              }
              return true;
            })(),
            _slotId: slotIndex + 1
          };
        });

        // Add slot name to slotNames
        setSlotNames(prev => {
          const next = [...prev];
          next[slotIndex] = file.name;
          return next;
        });

        // 1. Automatically transmit and persist this slot to the Central Server database
        saveSingleSlotToServer(slotIndex, normalizedRecords, file.name).catch((err) => {
          console.warn(`Falha ao gravar slot ${slotIndex + 1} no Banco Central:`, err);
        });

        // 2. Also keep local IndexedDB fallback cache
        saveSlotToIndexedDB(slotIndex, normalizedRecords, file.name, selectedProcedure).catch(() => {});

        // Merge and update db
        setDb(prevDb => {
          const baseDb = (prevDb === MOCK_DATABASE) ? [] : prevDb;
          
          // Filter out existing records belonging to this slot
          const cleanDb = baseDb.filter(r => r._slotId !== slotIndex + 1);
          
          // Ensure other loaded slots' records have their slotId correctly identified (fallback to slot 1)
          const updatedDb = cleanDb.map(r => r._slotId ? r : { ...r, _slotId: 1 });
          
          const merged = [...updatedDb, ...normalizedRecords];

          // Auto-select first procedure available
          if (merged.length > 0) {
            const firstProc = merged[0]["PROCEDIMENTO PRINCIPAL"];
            setSelectedProcedure(firstProc);
          }

          return merged;
        });
      },
      error: (error) => {
        setUploadError(`Erro ao ler arquivo da Base ${slotIndex + 1}: ${error.message}`);
      }
    });
  };

  const handleRemoveSlot = (slotIndex: number) => {
    const sName = slotNames[slotIndex] || `Base ${slotIndex + 1}`;
    const count = getSlotRecordsCount(slotIndex);

    setConfirmModal({
      isOpen: true,
      title: `Remover ${sName}`,
      message: `Tem certeza que deseja remover esta base (${count.toLocaleString("pt-BR")} registros)? Os registros desta planilha serão removidos da visualização atual e do Banco Central.`,
      confirmLabel: "Sim, Remover Base",
      confirmVariant: "danger",
      onConfirm: async () => {
        setConfirmModal(null);
        await executeRemoveSlot(slotIndex, sName);
      }
    });
  };

  const executeRemoveSlot = async (slotIndex: number, sName: string) => {
    // 1. Update slotNames
    const nextSlots = [...slotNames];
    nextSlots[slotIndex] = null;
    setSlotNames(nextSlots);
    procedureCacheRef.current.clear();

    // 2. Update local IndexedDB
    deleteSlotFromIndexedDB(slotIndex, nextSlots).catch((err) => {
      console.warn(`Delete slot ${slotIndex + 1} from IndexedDB failed:`, err);
    });

    // 3. Delete from permanent server central storage
    fetch(`/api/dataset/slot/${slotIndex}`, { method: "DELETE" })
      .then(() => {
        fetch("/api/dataset/status")
          .then((res) => res.json())
          .then((data) => {
            if (data && data.exists && data.metadata) {
              setServerDatasetInfo({ isFixed: true, metadata: data.metadata });
            } else {
              setServerDatasetInfo({ isFixed: false });
            }
          })
          .catch(() => {});
      })
      .catch((err) => {
        console.warn("Erro ao excluir slot do servidor:", err);
      });

    // 4. Clean up in-memory db records
    setDb(prevDb => {
      if (prevDb === MOCK_DATABASE) return MOCK_DATABASE;
      
      const cleanDb = prevDb.filter(r => {
        if (slotIndex === 0) {
          // Base 1: records where _slotId is 1 or missing
          return r._slotId !== undefined && r._slotId !== null && r._slotId !== 1;
        }
        return r._slotId !== slotIndex + 1;
      });
      
      const remainingSlots = nextSlots.filter(Boolean) as string[];
      if (cleanDb.length === 0 || remainingSlots.length === 0) {
        setFileName(null);
        setSelectedProcedure("RESSUTURA DE PAREDE ABDOMINAL (POR DEISCENCIA TOTAL / EVISCERACAO)");
        return MOCK_DATABASE;
      }

      setFileName(remainingSlots.join(" + "));

      // Auto-select first procedure available from remaining dataset
      if (cleanDb.length > 0) {
        const firstProc = cleanDb[0]["PROCEDIMENTO PRINCIPAL"];
        setSelectedProcedure(firstProc);
      }

      return cleanDb;
    });

    setServerSaveSuccessMsg(`Base ${slotIndex + 1} (${sName}) foi removida com sucesso.`);
    setTimeout(() => setServerSaveSuccessMsg(null), 5000);
  };

  const handleCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSlotCsvUpload(0, file);
    }
  };

  // 1. Get all unique procedures sorted alphabetically (optimized single pass or pre-indexed server list)
  const allProcedures = useMemo<string[]>(() => {
    if (
      serverDatasetInfo?.metadata?.proceduresList &&
      serverDatasetInfo.metadata.proceduresList.length > 0 &&
      (saveStatus === "server-fixed" || serverDatasetInfo.isFixed)
    ) {
      return serverDatasetInfo.metadata.proceduresList;
    }
    if (!db || db.length === 0) return [];
    const procSet = new Set<string>();
    const len = db.length;
    for (let i = 0; i < len; i++) {
      const p = db[i]["PROCEDIMENTO PRINCIPAL"];
      if (p && typeof p === "string") {
        const trimmed = p.trim();
        if (trimmed) procSet.add(trimmed);
      }
    }
    return Array.from(procSet).sort((a, b) => a.localeCompare(b));
  }, [db, serverDatasetInfo?.metadata?.proceduresList, saveStatus]);

  // Single filtered slice of records for the active selected procedure, computed ONLY when dashboard is active
  const selectedProcedureRecords = useMemo(() => {
    if (!selectedProcedure || activeTab !== "dashboard" || !db || db.length === 0) return [];
    const results: SUSRecord[] = [];
    const len = db.length;
    for (let i = 0; i < len; i++) {
      if (db[i]["PROCEDIMENTO PRINCIPAL"] === selectedProcedure) {
        results.push(db[i]);
      }
    }
    return results;
  }, [db, selectedProcedure, activeTab]);

  // 2. Perform audit analyses
  const benchmarkAnalysis = useMemo(() => {
    return analyzeProcedureBenchmark(selectedProcedureRecords, selectedProcedure);
  }, [selectedProcedureRecords, selectedProcedure]);

  const gapsAnalysis = useMemo(() => {
    return calculateAuditGaps(
      selectedProcedureRecords,
      selectedProcedure,
      benchmarkAnalysis.benchmarkNaih,
      benchmarkAnalysis.hucmNaih
    );
  }, [selectedProcedureRecords, selectedProcedure, benchmarkAnalysis]);

  const fundingModels = useMemo(() => {
    return analyzeFundingModels(selectedProcedureRecords);
  }, [selectedProcedureRecords]);

  // Total Estimated Revenue Gap (Cumulative loss over the procedure)
  const totalGapValue = useMemo(() => {
    return gapsAnalysis.gaps.reduce((acc, curr) => acc + curr.estimatedLoss, 0);
  }, [gapsAnalysis]);

  // Ticket médio geral do procedimento (Requirement 2: Novo Card de Ticket Médio Geral)
  const procedureAverageTicket = useMemo(() => {
    if (selectedProcedureRecords.length === 0) return 0;

    const aihGroups: { [naih: number]: { sumVal: number; explicitVal: number } } = {};
    selectedProcedureRecords.forEach((r) => {
      const naih = r.SP_NAIH;
      if (!aihGroups[naih]) {
        aihGroups[naih] = { sumVal: 0, explicitVal: 0 };
      }
      
      if (r["TICKET PROCEDIMENTO REAL"] !== undefined && r["TICKET PROCEDIMENTO REAL"] !== null) {
        const val = parseVal(r["TICKET PROCEDIMENTO REAL"]);
        if (val > 0) {
          aihGroups[naih].explicitVal = val;
        }
      }
      const valEach = parseVal(r.SP_VALATO);
      aihGroups[naih].sumVal += valEach;
    });

    const finalTickets = Object.values(aihGroups).map((g) =>
      g.explicitVal > 0 ? g.explicitVal : g.sumVal
    );

    const sum = finalTickets.reduce((acc, val) => acc + val, 0);
    return finalTickets.length > 0 ? sum / finalTickets.length : 0;
  }, [selectedProcedureRecords]);

  // Preparação dos dados do gráfico (Requirement 3: Comparação com o Ticket Médio Geral de BH)
  const chartData = useMemo(() => {
    return benchmarkAnalysis.hospitals.map((h) => {
      const isHUCM = h.hospitalName.toUpperCase().includes("CIENCIAS MEDICAS") ||
                     h.hospitalName.toUpperCase().includes("HUCM");
      return {
        name: h.hospitalName.length > 22 ? h.hospitalName.slice(0, 20) + "..." : h.hospitalName,
        fullName: h.hospitalName,
        "Ticket do Hospital (R$)": Math.round(h.ticketAvg),
        "Ticket Médio Geral (BH) (R$)": Math.round(procedureAverageTicket),
        isHUCM
      };
    });
  }, [benchmarkAnalysis, procedureAverageTicket]);

  // 3. Quantidade total de AIH (Contagem distinta de AIH relacionadas ao Procedimento filtrado) (Requirement 3)
  const distinctAihsCount = useMemo(() => {
    const uniqueNaihs = new Set(selectedProcedureRecords.map((r) => r.SP_NAIH));
    return uniqueNaihs.size;
  }, [selectedProcedureRecords]);

  // 4. ICU / UTI Daily detection highlight (Requirement 6)
  const utiWarningInfo = useMemo(() => {
    const matchingRows = selectedProcedureRecords.filter((r) => {
      const act = (r["PROCEDIMENTO ATO"] || "").toUpperCase();
      return act.includes("UNIDADE DE TERAPIA INTENSIVA") ||
             act.includes("TERAPIA INTENSIVA") ||
             act.includes("DIARIA DE UTI") ||
             act.includes("DIÁRIA DE UTI") ||
             act.includes("UTI ");
    });

    const totalUtiDailies = matchingRows.reduce((sum, r) => sum + (r.SP_QTD_ATO || 1), 0);
    
    // Group by hospital to show context
    const hospMap: { [hosp: string]: number } = {};
    matchingRows.forEach((r) => {
      hospMap[r.HOSPITAL] = (hospMap[r.HOSPITAL] || 0) + (r.SP_QTD_ATO || 1);
    });
    
    return {
      hasUTI: totalUtiDailies > 0,
      totalQty: totalUtiDailies,
      hospitals: Object.entries(hospMap).map(([hosp, qty]) => ({ hosp, qty })).sort((a, b) => b.qty - a.qty)
    };
  }, [selectedProcedureRecords]);

  // 5. Ranking calculations (sorted highest to lowest) (Requirement 4 & 5)
  const maxRankings = useMemo(() => {
    // benchmarkAnalysis.hospitals is already sorted by ticketMax descending by the helper
    return [...benchmarkAnalysis.hospitals].sort((a, b) => b.ticketMax - a.ticketMax);
  }, [benchmarkAnalysis.hospitals]);

  const averageRankings = useMemo(() => {
    return [...benchmarkAnalysis.hospitals].sort((a, b) => b.ticketAvg - a.ticketAvg);
  }, [benchmarkAnalysis.hospitals]);

  // 6. Detailed grouping of all AIH's for this procedure to enable cards view (Requirement 7 & Objectives 1, 2, 3)
  const procedureAihsDetails = useMemo(() => {
    const aihMap: {
      [naih: number]: {
        naih: number;
        hospital: string;
        explicitTicket: number;
        sumValAtos: number;
        finalTicket: number;
        hasUTI: boolean;
        utiQty: number;
        rows: SUSRecord[];
        dtInter: number;
        dtSaida: number;
        permanence: number;
      }
    } = {};
    
    selectedProcedureRecords.forEach((r) => {
      const naih = r.SP_NAIH;
      if (!aihMap[naih]) {
        aihMap[naih] = {
          naih,
          hospital: r.HOSPITAL,
          explicitTicket: 0,
          sumValAtos: 0,
          finalTicket: 0,
          hasUTI: false,
          utiQty: 0,
          rows: [],
          dtInter: r.SP_DTINTER,
          dtSaida: r.SP_DTSAIDA,
          permanence: calculatePermanence(r.SP_DTINTER, r.SP_DTSAIDA)
        };
      }
      
      aihMap[naih].rows.push(r);
      
      if (r["TICKET PROCEDIMENTO REAL"] !== undefined && r["TICKET PROCEDIMENTO REAL"] !== null) {
        const parsedVal = parseVal(r["TICKET PROCEDIMENTO REAL"]);
        if (parsedVal > 0) {
          aihMap[naih].explicitTicket = parsedVal;
        }
      }
      
      const valEach = parseVal(r.SP_VALATO);
      const qty = r.SP_QTD_ATO || 1;
      aihMap[naih].sumValAtos += valEach;
      
      const act = (r["PROCEDIMENTO ATO"] || "").toUpperCase();
      if (act.includes("UNIDADE DE TERAPIA INTENSIVA") ||
          act.includes("TERAPIA INTENSIVA") ||
          act.includes("DIARIA DE UTI") ||
          act.includes("DIÁRIA DE UTI") ||
          act.includes("UTI ")) {
        aihMap[naih].hasUTI = true;
        aihMap[naih].utiQty += qty;
      }
    });
    
    return Object.values(aihMap).map((a) => ({
      ...a,
      finalTicket: a.explicitTicket > 0 ? a.explicitTicket : a.sumValAtos
    })).sort((a, b) => b.finalTicket - a.finalTicket);
  }, [selectedProcedureRecords]);

  // Compute grouped and custom sorted hospital composite tickets and their underlying AIHs (Requirement 1)
  const hospitalAihGroupsSorted = useMemo(() => {
    const groupsMap: {
      [hospital: string]: {
        hospital: string;
        aihs: typeof procedureAihsDetails;
        totalAihs: number;
        totalUtiQty: number;
        totalValue: number;
        avgValue: number;
        totalPermanence: number;
        avgPermanence: number;
      };
    } = {};

    procedureAihsDetails.forEach((aih) => {
      const hosp = aih.hospital;
      if (!groupsMap[hosp]) {
        groupsMap[hosp] = {
          hospital: hosp,
          aihs: [],
          totalAihs: 0,
          totalUtiQty: 0,
          totalValue: 0,
          avgValue: 0,
          totalPermanence: 0,
          avgPermanence: 0,
        };
      }
      groupsMap[hosp].aihs.push(aih);
      groupsMap[hosp].totalAihs += 1;
      groupsMap[hosp].totalUtiQty += aih.utiQty;
      groupsMap[hosp].totalValue += aih.finalTicket;
      groupsMap[hosp].totalPermanence += aih.permanence;
    });

    const groupsList = Object.values(groupsMap).map((g) => {
      const avgValue = g.totalValue / g.totalAihs;
      const avgPermanence = g.totalPermanence / g.totalAihs;
      
      // Sort individual AIHs inside each group
      const sortedAihs = [...g.aihs].sort((a, b) => {
        if (aihSortBy === "value-desc") return b.finalTicket - a.finalTicket;
        if (aihSortBy === "value-asc") return a.finalTicket - b.finalTicket;
        if (aihSortBy === "uti-desc") return b.utiQty - a.utiQty;
        if (aihSortBy === "uti-asc") return a.utiQty - b.utiQty;
        return 0;
      });

      return {
        ...g,
        avgValue,
        avgPermanence,
        aihs: sortedAihs,
      };
    });

    // Sort the hospital groups themselves
    groupsList.sort((a, b) => {
      if (hospitalSortBy === "value-desc") return b.avgValue - a.avgValue;
      if (hospitalSortBy === "value-asc") return a.avgValue - b.avgValue;
      if (hospitalSortBy === "name-asc") return a.hospital.localeCompare(b.hospital);
      return 0;
    });

    return groupsList;
  }, [procedureAihsDetails, hospitalSortBy, aihSortBy]);

  // Identify special AIHs of interest (Objetivo 2)
  const hucmPeakAihObj = useMemo(() => {
    return procedureAihsDetails.find((a) =>
      a.hospital.toUpperCase().includes("CIENCIAS MEDICAS") ||
      a.hospital.toUpperCase().includes("HUCM")
    );
  }, [procedureAihsDetails]);

  const marketPeakAihObj = useMemo(() => {
    return procedureAihsDetails.find((a) =>
      !a.hospital.toUpperCase().includes("CIENCIAS MEDICAS") &&
      !a.hospital.toUpperCase().includes("HUCM")
    );
  }, [procedureAihsDetails]);

  const referenceAverageAihObj = useMemo(() => {
    const nonHucm = procedureAihsDetails.filter((a) =>
      !a.hospital.toUpperCase().includes("CIENCIAS MEDICAS") &&
      !a.hospital.toUpperCase().includes("HUCM") &&
      a.naih !== marketPeakAihObj?.naih
    );
    if (nonHucm.length > 0) {
      // Pick one in the middle of representatives to reflect an "average" billing state
      return nonHucm[Math.floor(nonHucm.length / 2)];
    }
    return null;
  }, [procedureAihsDetails, marketPeakAihObj]);

  // HUCM general billing map of acts for other comparisons (Objetivo 1 & 3)
  const hucmActsMap = useMemo(() => {
    const hucmRows = selectedProcedureRecords.filter((r) =>
      r.HOSPITAL.toUpperCase().includes("CIENCIAS MEDICAS") ||
      r.HOSPITAL.toUpperCase().includes("HUCM")
    );
    
    const codesMap: { [code: number]: { name: string; qty: number; value: number } } = {};
    hucmRows.forEach((r) => {
      const code = r.SP_ATOPROF;
      const qty = r.SP_QTD_ATO || 1;
      const valTotal = parseVal(r.SP_VALATO);
      const valUnit = qty > 0 ? Math.round((valTotal / qty) * 100) / 100 : valTotal;
      if (!codesMap[code]) {
        codesMap[code] = { name: r["PROCEDIMENTO ATO"], qty: 0, value: 0 };
      }
      codesMap[code].qty += qty;
      codesMap[code].value = valUnit > 0 ? valUnit : codesMap[code].value;
    });
    
    return codesMap;
  }, [selectedProcedureRecords]);

  // All unique child procedure codes (SP_ATOPROF) listed under the selected procedure (Requirement 1 & 3)
  const allAtosList = useMemo(() => {
    const codeToValues: { [code: string]: { name: string; values: { val: number; hosp: string; naih: number }[] } } = {};
    
    selectedProcedureRecords.forEach((r) => {
      const code = String(r.SP_ATOPROF || "").trim();
      if (!code) return;
      const qty = r.SP_QTD_ATO || 1;
      const valTotal = parseVal(r.SP_VALATO);
      const val = qty > 0 ? Math.round((valTotal / qty) * 100) / 100 : valTotal;
      
      if (!codeToValues[code]) {
        codeToValues[code] = { name: r["PROCEDIMENTO ATO"] || "Procedimento sem nome", values: [] };
      }
      
      const exists = codeToValues[code].values.some((v) => v.val === val && v.hosp === r.HOSPITAL);
      if (!exists) {
        codeToValues[code].values.push({ val, hosp: r.HOSPITAL, naih: r.SP_NAIH });
      }
    });

    return Object.entries(codeToValues).map(([codeStr, data]) => {
      const uniqVals = Array.from(new Set(data.values.map((v) => v.val)));
      return {
        code: codeStr,
        name: data.name,
        valuesCount: uniqVals.length,
        values: data.values,
        uniqVals
      };
    }).sort((a, b) => b.valuesCount - a.valuesCount || a.code.localeCompare(b.code));
  }, [db, selectedProcedure]);

  // Filtered atos for table view (isolated by SP_ATOPROF filter, or showing divergent values by default)
  const filteredAtosList = useMemo(() => {
    if (selectedActCodeFilter.trim()) {
      const filterStr = selectedActCodeFilter.trim();
      return allAtosList.filter(
        (item) => item.code.includes(filterStr) || item.name.toLowerCase().includes(filterStr.toLowerCase())
      );
    }
    // Default is only returning divergent prices across Belo Horizonte
    return allAtosList.filter((item) => item.valuesCount > 1);
  }, [allAtosList, selectedActCodeFilter]);

  // Obter hospitais competidores associados aos preços (Requirement 1 of user request)
  const competitorHospitals = useMemo<string[]>(() => {
    const list: string[] = [];
    allAtosList.forEach((v) => {
      v.values.forEach((valObj) => {
        const isHUCM = valObj.hosp.toUpperCase().includes("CIENCIAS MEDICAS") ||
                       valObj.hosp.toUpperCase().includes("HUCM");
        if (!isHUCM && !list.includes(valObj.hosp)) {
          list.push(valObj.hosp);
        }
      });
    });
    return list.sort();
  }, [allAtosList]);

  // Current selected AIH for deep inspection (Requirement 7)
  const activeInspectionNaih = selectedNaihToInspect || marketPeakAihObj?.naih || (procedureAihsDetails.length > 0 ? procedureAihsDetails[0].naih : null);

  const inspectedAih = useMemo(() => {
    return procedureAihsDetails.find((a) => a.naih === activeInspectionNaih);
  }, [procedureAihsDetails, activeInspectionNaih]);

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-900 font-sans antialiased p-2 sm:p-4 lg:p-6">
      {/* Executive Analytical Header - Official FELUMA & HUCM Identity */}
      <header id="main-header" className="w-full max-w-[1920px] mx-auto mb-6 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Top Institutional Strip (Inspired by feluma.org.br) */}
        <div className="bg-[#0d2c68] text-slate-200 px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-sans">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#ffcd57] tracking-wider uppercase">
              FELUMA • Desde 1971
            </span>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="hidden sm:inline text-slate-300 font-medium">
              Fundação Educacional Lucas Machado • Mantenedora do HUCM
            </span>
          </div>
          <div className="flex items-center gap-3 font-medium">
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              Painel Diretoria Executiva
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-300">Belo Horizonte / MG</span>
          </div>
        </div>

        {/* Main Branding & Context Section */}
        <div className="p-4 sm:p-5 lg:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Authentic FELUMA Vertical Badge (100% Faithful Asset) */}
            <div className="shrink-0 drop-shadow-xs">
              <FelumaLogo size="lg" />
            </div>

            {/* Institutional Titles */}
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-[10px] font-sans tracking-widest text-[#164194] font-extrabold uppercase bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-md leading-none">
                  FUNDAÇÃO EDUCACIONAL LUCAS MACHADO
                </span>
                <span className="text-[10px] font-sans tracking-wider text-[#0d2c68] font-bold uppercase bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md leading-none">
                  SIH/SUS BELO HORIZONTE
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0d2c68] uppercase font-sans leading-none flex flex-wrap items-baseline gap-2">
                Hospital Universitário Ciências Médicas
                <span className="text-[#f3b924] font-black text-base sm:text-lg font-sans tracking-tight">
                  HUCM • AUDIT SUS
                </span>
              </h1>

              <p className="text-slate-500 text-xs mt-1.5 max-w-3xl font-medium leading-relaxed font-sans">
                Plataforma de inteligência institucional e auditoria de faturamento do <strong className="text-[#164194] font-bold">Hospital Universitário Ciências Médicas (HUCM / FELUMA)</strong> para detecção de perdas de diárias UTI, atos não faturados e benchmarking analítico do SUS em Belo Horizonte.
              </p>
            </div>
          </div>

          {/* Executive Quick Stats Pill for Board Presentation */}
          <div className="flex sm:flex-row flex-wrap items-center gap-2.5 self-stretch lg:self-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            {competencePeriod && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex flex-col text-left">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5 text-[#d99b26]" />
                  Período Competência
                </span>
                <span className="text-xs font-black text-[#0d2c68] font-mono">
                  {competencePeriod.startFormatted} {!competencePeriod.isSame ? `a ${competencePeriod.endFormatted}` : ""}
                </span>
              </div>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Universo Processado</span>
              <span className="text-xs font-black text-[#164194] font-mono">
                {(serverDatasetInfo.isFixed && serverDatasetInfo.metadata?.totalRecords
                  ? serverDatasetInfo.metadata.totalRecords
                  : db.length
                ).toLocaleString("pt-BR")}{" "}
                <span className="font-sans font-medium text-[10px] text-slate-500">
                  {serverDatasetInfo.isFixed ? "Linhas Totais" : "AIHs"}
                </span>
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Armazenamento</span>
              <span className="text-xs font-black font-mono flex items-center gap-1">
                {serverDatasetInfo.isFixed ? (
                  <span className="text-emerald-700 flex items-center gap-1" title="Base oficial compartilhada ativa no Banco Central">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Banco Central Ativo
                  </span>
                ) : (db !== MOCK_DATABASE || fileName) ? (
                  <span className="text-amber-700 flex items-center gap-1" title="Dados na sessão local. Clique em Fixar no Banco Central para compartilhar">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Sessão Local
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    Base Padrão
                  </span>
                )}
              </span>
            </div>

            {/* Quick Synchronize Button */}
            <button
              type="button"
              id="btn-quick-sync-server"
              onClick={handleReloadFromServerDatabase}
              disabled={isRefreshingFromServer}
              title="Sincronizar instantaneamente com o Banco Central compartilhado"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-250 self-stretch sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingFromServer ? "animate-spin text-[#164194]" : "text-slate-500"}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>

            {/* Prominent Share Analysis Button */}
            <button
              type="button"
              id="btn-open-share-modal"
              onClick={() => setShareModalOpen(true)}
              className="bg-gradient-to-r from-[#164194] to-[#0d2c68] hover:from-[#133880] hover:to-[#0a2354] text-white font-extrabold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-sm border border-blue-800/40 hover:shadow self-stretch sm:self-auto"
            >
              <Share2 className="w-3.5 h-3.5 text-[#ffcd57]" />
              <span>Compartilhar Link</span>
            </button>
          </div>
        </div>
      </header>

      {/* Real-time Multi-User Server Update Notification Banner */}
      {newServerVersionAvailable && (
        <div className="w-full max-w-[1920px] mx-auto mb-6 bg-gradient-to-r from-blue-700 via-[#164194] to-[#0d2c68] text-white p-3.5 sm:px-5 rounded-2xl shadow-md border border-blue-400/30 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <div>
              <span className="font-black text-amber-300 uppercase tracking-wide">Base Central Atualizada no Servidor: </span>
              <span className="text-blue-100">
                Uma versão mais recente (<strong>{newServerVersionAvailable.fileName}</strong> • {newServerVersionAvailable.totalRecords.toLocaleString("pt-BR")} registros) foi gravada. Sincronize para analisar exatamente a mesma base.
              </span>
            </div>
          </div>
          <button
            type="button"
            id="btn-banner-sync-server"
            onClick={handleReloadFromServerDatabase}
            disabled={isRefreshingFromServer}
            className="bg-[#ffcd57] hover:bg-[#ffbe2e] text-[#0d2c68] font-black px-4 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer text-xs uppercase tracking-wider"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingFromServer ? "animate-spin" : ""}`} />
            {isRefreshingFromServer ? "Sincronizando..." : "Sincronizar Meus Dados"}
          </button>
        </div>
      )}

      <main className="w-full max-w-[1920px] mx-auto space-y-8">
        
        {/* Schema Review Panel */}
        <AnimatePresence>
          {showSchemaReview && (
            <motion.div
              id="schema-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 shadow-md border border-slate-800 mb-8 font-mono text-xs">
                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-sm text-white">Dicionário de Campos e Estrutura JSON (SUS SIA/SIH)</span>
                  </div>
                  <button onClick={() => setShowSchemaReview(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="mb-4 text-slate-400 font-sans text-sm">
                  A fita abaixo demonstra o mapeamento exato de dados utilizado pelo algoritmo para cruzar diárias, exames complementares e atos profissionais sob o mesmo teto da AIH (<code className="text-blue-400 font-mono">SP_NAIH</code>). Os campos são extraídos diretamente dos arquivos oficiais de faturamento.
                </p>
                <div className="bg-slate-950 p-4 rounded-xl overflow-x-auto max-h-80 border border-slate-850">
                  <pre>{JSON.stringify(JSON_SCHEMA_EXAMPLE, null, 2)}</pre>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Tabs */}
        <div id="navigation-tabs" className="flex border-b border-slate-200 gap-1.5 sm:gap-4 mb-4 select-none overflow-x-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`py-3 px-4 sm:px-6 text-xs sm:text-sm rounded-t-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "dashboard"
                ? "border-b-2 border-[#f3b924] text-[#164194] font-extrabold bg-blue-50/40"
                : "border-b-2 border-transparent text-slate-600 hover:text-[#164194] hover:bg-slate-50 font-medium"
            }`}
          >
            <Table className="w-4 h-4 shrink-0 text-[#164194]" />
            Painel de Auditoria & Cruzamento (Ticket Médio)
          </button>
          <button
            onClick={() => setActiveTab("advanced-comparator")}
            className={`py-3 px-4 sm:px-6 text-xs sm:text-sm rounded-t-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "advanced-comparator"
                ? "border-b-2 border-[#f3b924] text-[#164194] font-extrabold bg-blue-50/40"
                : "border-b-2 border-transparent text-slate-600 hover:text-[#164194] hover:bg-slate-50 font-medium"
            }`}
          >
            <Building2 className="w-4 h-4 text-[#164194] shrink-0" />
            Comparador Avançado
          </button>
          <button
            onClick={() => setActiveTab("spreadsheet")}
            className={`py-3 px-4 sm:px-6 text-xs sm:text-sm rounded-t-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "spreadsheet"
                ? "border-b-2 border-[#f3b924] text-[#164194] font-extrabold bg-blue-50/40"
                : "border-b-2 border-transparent text-slate-600 hover:text-[#164194] hover:bg-slate-50 font-medium"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            Visualizador da Planilha Completa (Estilo Excel)
          </button>
          <button
            onClick={() => setActiveTab("custom-compare")}
            className={`py-3 px-4 sm:px-6 text-xs sm:text-sm rounded-t-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "custom-compare"
                ? "border-b-2 border-[#f3b924] text-[#164194] font-extrabold bg-blue-50/40"
                : "border-b-2 border-transparent text-slate-600 hover:text-[#164194] hover:bg-slate-50 font-medium"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4 text-[#164194] shrink-0" />
            Comparativo Geral de Hospitais
          </button>
        </div>

        {activeTab === "advanced-comparator" ? (
          <AdvancedHospitalComparator records={db} />
        ) : activeTab === "spreadsheet" ? (
          <SpreadsheetView
            records={db}
            onToggleValidation={handleToggleValidation}
            onUpdateRecordValue={handleUpdateRecordValue}
          />
        ) : activeTab === "custom-compare" ? (
          <CustomComparativeView
            records={db}
            allProcedures={allProcedures}
            selectedProcedure={selectedProcedure}
            onProcedureChange={(proc) => {
              setSelectedProcedure(proc);
              setSelectedNaihToInspect(null);
            }}
          />
        ) : (
          <>
            {/* CSV Import, Specialty selection Grid */}
            <div id="controls-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 scroll-mt-6">
          
              {/* File Upload Zone */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileSpreadsheet className="w-5 h-5 text-[#164194]" />
                    <h2 className="font-semibold text-slate-900 text-sm">Importação do Faturamento (SIA/SIH)</h2>
                  </div>
                  <p className="text-slate-500 text-xs mb-3.5 leading-relaxed">
                    Upload do CSV extraído do gestor local de BH com unificação automática de até 3 remessas.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Multi-slot upload container */}
                  <div className="space-y-2">
                    <span className="text-slate-700 text-xs font-semibold block">
                      Bases Carregadas (Unificadas por Append)
                    </span>
                    
                    {[0, 1, 2].map((idx) => {
                      const sName = slotNames[idx];
                      const sMeta = serverDatasetInfo.isFixed ? serverDatasetInfo.metadata?.slots?.[idx] : null;
                      const isSlotFixed = Boolean(sMeta && (sMeta.recordsCount || 0) > 0);
                      const totalSlotCount = isSlotFixed ? (sMeta?.recordsCount || 0) : (getSlotRecordsCount ? getSlotRecordsCount(idx) : (db === MOCK_DATABASE ? 0 : db.filter(r => (!r._slotId && idx === 0) || r._slotId === idx + 1).length));
                      const inMemoryProcCount = getSlotRecordsCount ? getSlotRecordsCount(idx) : 0;
                      
                      return (
                        <div key={idx} className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 flex items-center justify-between gap-2.5 hover:border-slate-300 transition shadow-2xs">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${sName ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                              {sName ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex flex-col overflow-hidden text-left">
                              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                                Base {idx + 1} {idx === 0 ? '(Principal)' : '(Opcional)'}
                              </span>
                              {sName ? (
                                <span className="text-xs font-semibold text-slate-700 truncate max-w-[160px]" title={sName}>
                                  {sName}
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-400">
                                  Disponível
                                </span>
                              )}
                            </div>
                          </div>

                          {sName ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className="text-[9px] bg-slate-200 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded"
                                title={isSlotFixed && inMemoryProcCount > 0 && inMemoryProcCount !== totalSlotCount ? `${totalSlotCount.toLocaleString("pt-BR")} registros totais indexados no Banco Central (${inMemoryProcCount.toLocaleString("pt-BR")} no procedimento ativo)` : `${totalSlotCount.toLocaleString("pt-BR")} registros totais`}
                              >
                                {totalSlotCount.toLocaleString("pt-BR")} reg.
                              </span>

                              {/* Central Server Persistence Badge / Save button */}
                              {isSlotFixed ? (
                                <span
                                  className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-2xs"
                                  title={`Consolidada no Banco Central (${totalSlotCount.toLocaleString("pt-BR")} reg. compartilhados)`}
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                  Banco Central
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={savingSlotIndex !== null || saveProgress.active}
                                  onClick={() => saveSingleSlotToServer(idx)}
                                  className="text-[9px] bg-[#164194] hover:bg-[#0f2e6b] text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                                  title="Fixar esta base no Banco Central para todos os usuários"
                                >
                                  {savingSlotIndex === idx ? (
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-white" />
                                  ) : (
                                    <Save className="w-2.5 h-2.5 text-[#ffcd57]" />
                                  )}
                                  {savingSlotIndex === idx ? "Gravando..." : "Fixar no Banco"}
                                </button>
                              )}

                              <button
                                type="button"
                                id={`btn-remove-slot-${idx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSlot(idx);
                                }}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                                title={`Remover ${sName || `Base ${idx + 1}`}`}
                                aria-label={`Remover ${sName || `Base ${idx + 1}`}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="shrink-0 py-1 px-2.5 rounded-lg bg-white border border-slate-250 hover:border-[#164194] hover:text-[#164194] text-slate-600 text-xs font-semibold cursor-pointer transition flex items-center gap-1 shadow-2xs">
                              <Plus className="w-3 h-3" />
                              Carregar
                              <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleSlotCsvUpload(idx, file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Direct Action: Add New Base to Shared Central Database */}
                  <label className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#164194] to-[#0d2c68] hover:from-[#133880] hover:to-[#0a2354] text-white text-xs font-bold cursor-pointer transition flex items-center justify-center gap-2 shadow-xs border border-blue-900/30">
                    <Upload className="w-3.5 h-3.5 text-[#ffcd57]" />
                    <span>Adicionar Base ao Banco Central Compartilhado</span>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const emptyIdx = slotNames.findIndex((s) => !s);
                          handleSlotCsvUpload(emptyIdx >= 0 ? emptyIdx : 0, file);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>

                  {/* Multiple bases consolidated badge */}
                  {slotNames.filter(Boolean).length > 1 && (
                    <div className="bg-[#164194]/5 border border-[#164194]/15 rounded-xl p-2.5 flex items-center gap-2 animate-fade-in">
                      <Sparkles className="w-3.5 h-3.5 text-[#164194] shrink-0" />
                      <p className="text-[10px] text-[#164194] font-medium leading-tight">
                        <strong>Bases Unificadas:</strong> {slotNames.filter(Boolean).length} planilhas consolidadas em {(serverDatasetInfo.isFixed && serverDatasetInfo.metadata?.totalRecords ? serverDatasetInfo.metadata.totalRecords : db.length).toLocaleString("pt-BR")} registros.
                      </p>
                    </div>
                  )}

                  {/* Compact Period & Competence bar */}
                  {(analysisPeriod || competencePeriod) && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 font-sans">
                      {analysisPeriod && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#164194]" />
                          <span>Internações: <strong className="text-slate-800 font-mono">{analysisPeriod.firstFormatted} – {analysisPeriod.lastFormatted}</strong> ({analysisPeriod.daysCount}d)</span>
                        </span>
                      )}
                      {competencePeriod && (
                        <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                          <Clock className="w-3 h-3 text-[#d99b26]" />
                          <span>Competência: <strong className="text-slate-700">{competencePeriod.startMonth < 10 ? `0${competencePeriod.startMonth}` : competencePeriod.startMonth}/{competencePeriod.startYear}</strong></span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Validation stats */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#164194] pb-1 border-b border-[#164194]/15 font-sans">
                      <span className="flex items-center gap-1 font-semibold text-[#164194] text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Validação da Amostra Ativa
                      </span>
                      <span className="font-mono text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                        {serverDatasetInfo.isFixed ? "BANCO CENTRAL" : fileName ? "CSV USUÁRIO" : "PADRÃO HUCM"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-600">
                      <div>
                        No procedimento: <strong className="text-slate-950 font-bold">{(databaseStats.total || db.length).toLocaleString("pt-BR")}</strong>
                      </div>
                      <div>
                        Legítimos: <strong className="text-emerald-600 font-bold">{databaseStats.valid.toLocaleString("pt-BR")}</strong>
                      </div>
                      <div>
                        Filtrados: <strong className="text-rose-600 font-bold">{databaseStats.filtered.toLocaleString("pt-BR")}</strong>
                      </div>
                      <div>
                        Aproveitamento: <strong className="text-[#164194] font-bold">{databaseStats.ratio}%</strong>
                      </div>
                    </div>
                    {serverDatasetInfo.isFixed && serverDatasetInfo.metadata && (
                      <div className="text-[10px] text-slate-500 font-sans pt-1 border-t border-slate-200 flex justify-between items-center">
                        <span>Total consolidado (Todos procedimentos):</span>
                        <strong className="font-mono text-[#164194] font-bold">{serverDatasetInfo.metadata.totalRecords.toLocaleString("pt-BR")} reg.</strong>
                      </div>
                    )}
                  </div>

                  {/* Success notification after fixing database to central server */}
                  {serverSaveSuccessMsg && (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-start gap-2.5 animate-fade-in text-xs text-emerald-900 shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <strong className="block font-bold text-emerald-950">Banco Central Atualizado!</strong>
                        <span className="leading-relaxed">{serverSaveSuccessMsg}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setServerSaveSuccessMsg(null)}
                        className="text-emerald-700 hover:text-emerald-950 cursor-pointer p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Institutional Central Shared Database Management Panel */}
                  <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30 border border-[#164194]/25 rounded-xl p-4 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#164194] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Database className="w-4.5 h-4.5 text-[#ffcd57]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[#0d2c68] block leading-tight">
                              Gestão do Banco Central Compartilhado
                            </span>
                            {serverDatasetInfo.isFixed ? (
                              <span className="text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                BANCO CENTRAL ATIVO
                              </span>
                            ) : (
                              <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                SESSÃO LOCAL (PENDENTE DE FIXAÇÃO)
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-600 mt-1 block leading-relaxed">
                            {serverDatasetInfo.isFixed
                              ? "Base oficial consolidada no Banco Central. Todos os usuários que acessarem o link compartilhado visualizarão exatamente esta mesma base de dados."
                              : "Fixe as bases no Banco Central para que todos os usuários que acessarem o link compartilhado vejam os mesmos dados consolidados."}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bases Uploaded / Slot Management Table */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center pb-1.5 border-b border-slate-100 font-semibold text-slate-800">
                        <span className="flex items-center gap-1.5 text-[#164194]">
                          <Database className="w-3.5 h-3.5" />
                          Bases Subidas ({[0, 1, 2].filter((i) => getSlotRecordsCount(i) > 0 || (serverDatasetInfo.metadata?.slots?.[i]?.recordsCount || 0) > 0).length} de 3):
                        </span>
                        <span className="font-mono text-[11px] text-slate-600">
                          Total: <strong className="text-emerald-700 font-bold">{(serverDatasetInfo.isFixed && serverDatasetInfo.metadata?.totalRecords ? serverDatasetInfo.metadata.totalRecords : db.length).toLocaleString("pt-BR")}</strong> reg.
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {[0, 1, 2].map((idx) => {
                          const sMeta = serverDatasetInfo.metadata?.slots?.[idx];
                          const localCount = getSlotRecordsCount(idx);
                          const localName = slotNames[idx];
                          const isSlotFixed = serverDatasetInfo.isFixed && sMeta && (sMeta.recordsCount || 0) > 0;
                          const hasData = localCount > 0 || isSlotFixed;

                          return (
                            <div
                              key={idx}
                              className={`flex flex-wrap items-center justify-between gap-1.5 p-2 rounded-md transition ${
                                isSlotFixed
                                  ? "bg-emerald-50/60 border border-emerald-150"
                                  : hasData
                                  ? "bg-amber-50/60 border border-amber-200"
                                  : "bg-slate-50/60 border border-slate-150 opacity-70"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-[11px] text-slate-900 shrink-0">
                                  Base {idx + 1}:
                                </span>
                                <span className="text-[11px] text-slate-700 truncate max-w-[150px] sm:max-w-[200px]" title={sMeta?.fileName || localName || "Não carregada"}>
                                  {sMeta?.fileName || localName || "Vazia (Aguardando arquivo)"}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {hasData && (
                                  <span className="font-mono font-semibold text-[10px] text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {(sMeta?.recordsCount || localCount).toLocaleString("pt-BR")} reg.
                                  </span>
                                )}

                                {isSlotFixed ? (
                                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    No Banco Central
                                  </span>
                                ) : hasData ? (
                                  <button
                                    type="button"
                                    disabled={savingSlotIndex !== null || saveProgress.active}
                                    onClick={() => saveSingleSlotToServer(idx)}
                                    className="text-[9px] font-bold bg-[#164194] hover:bg-[#0f2e6b] text-white px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                                    title="Fixar esta base no Banco Central"
                                  >
                                    {savingSlotIndex === idx ? (
                                      <RefreshCw className="w-2.5 h-2.5 animate-spin text-white" />
                                    ) : (
                                      <Save className="w-2.5 h-2.5 text-[#ffcd57]" />
                                    )}
                                    {savingSlotIndex === idx ? "Gravando..." : "Fixar no Banco"}
                                  </button>
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-mono">Disponível</span>
                                )}

                                {hasData && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSlot(idx)}
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                    title="Excluir base"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Live Progress Bar for chunked transmission */}
                    {saveProgress.active && (
                      <div className="bg-white border border-[#164194]/30 rounded-xl p-3 shadow-xs flex flex-col gap-2 animate-fade-in">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                          <span className="flex items-center gap-1.5 text-[#164194] font-semibold">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            {saveProgress.message}
                          </span>
                          <span className="font-mono font-bold text-[#164194]">{saveProgress.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                          <div
                            className="bg-gradient-to-r from-[#164194] to-[#1e5ad3] h-2.5 rounded-full transition-all duration-200"
                            style={{ width: `${saveProgress.percent}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Lote {saveProgress.currentChunk} de {saveProgress.totalChunks} • Transmissão rápida em blocos de 25.000 linhas
                        </span>
                      </div>
                    )}

                    {/* Transmission Error alert */}
                    {saveProgress.error && (
                      <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-start gap-2 text-xs text-rose-900 animate-fade-in">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <strong className="block font-bold">Falha ao Gravar no Banco Central:</strong>
                          <span>{saveProgress.error}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSaveProgress(p => ({ ...p, error: null }))}
                          className="text-rose-600 hover:text-rose-900 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Server Dataset Verified Stats when isFixed is active */}
                    {serverDatasetInfo.isFixed && serverDatasetInfo.metadata && (
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex flex-col gap-2">
                        <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-200 pb-1.5">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Auditoria do Banco Central
                          </span>
                          <span className="text-[10px] font-mono bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md">
                            COMPARTILHAMENTO ATIVO
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono pt-0.5">
                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[9px] uppercase text-slate-500 font-sans block">Linhas Totais</span>
                            <strong className="text-emerald-950 font-bold text-xs">{serverDatasetInfo.metadata.totalRecords.toLocaleString("pt-BR")}</strong>
                          </div>
                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[9px] uppercase text-slate-500 font-sans block">AIHs Únicas</span>
                            <strong className="text-emerald-950 font-bold text-xs">{serverDatasetInfo.metadata.uniqueAihs.toLocaleString("pt-BR")}</strong>
                          </div>
                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[9px] uppercase text-slate-500 font-sans block">Hospitais</span>
                            <strong className="text-emerald-950 font-bold text-xs">{serverDatasetInfo.metadata.uniqueHospitals}</strong>
                          </div>
                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[9px] uppercase text-slate-500 font-sans block">Procedimentos</span>
                            <strong className="text-emerald-950 font-bold text-xs">{serverDatasetInfo.metadata.uniqueProcedures}</strong>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-600 pt-1">
                          <span>Competência: <strong className="text-slate-800 font-mono">{serverDatasetInfo.metadata.competencePeriod || "01/2025"}</strong></span>
                          <span>Faturamento Total: <strong className="text-emerald-700 font-mono font-bold">{serverDatasetInfo.metadata.totalValueFormatted || "R$ 0,00"}</strong></span>
                        </div>
                      </div>
                    )}

                    {/* Server Verification inspector pop-up / panel */}
                    {serverVerificationDetails && (
                      <div className="bg-white border-2 border-indigo-300 rounded-xl p-3 shadow-md text-xs flex flex-col gap-2 animate-fade-in">
                        <div className="flex items-center justify-between font-bold text-indigo-950 border-b border-slate-200 pb-1.5">
                          <span className="flex items-center gap-1.5">
                            <Database className="w-4 h-4 text-indigo-600" />
                            Auditoria Física do Banco Central
                          </span>
                          <button
                            type="button"
                            onClick={() => setServerVerificationDetails(null)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {serverVerificationDetails.exists ? (
                          <div className="space-y-1.5 text-slate-700 text-[11px] font-mono">
                            <div className="flex justify-between">
                              <span>Status do Banco:</span>
                              <span className="text-emerald-600 font-bold">PRESENTE E DISPONÍVEL</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Tamanho em Disco:</span>
                              <span className="font-bold">{serverVerificationDetails.fileSizeMb} MB (otimizado GZIP)</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total de Registros:</span>
                              <span className="font-bold text-[#164194]">{serverVerificationDetails.metadata?.totalRecords?.toLocaleString("pt-BR")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>AIHs Auditadas:</span>
                              <span className="font-bold">{serverVerificationDetails.metadata?.uniqueAihs?.toLocaleString("pt-BR")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Última Gravação:</span>
                              <span className="text-slate-500">{new Date(serverVerificationDetails.metadata?.updatedAt || "").toLocaleString("pt-BR")}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-rose-600 text-xs font-medium">
                            Nenhum arquivo de base oficial encontrado no banco central ainda.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
                      {(() => {
                        const activeSlots = [0, 1, 2].filter((i) => slotNames[i] || (serverDatasetInfo.metadata?.slots?.[i]?.recordsCount || 0) > 0);
                        const allActiveFixed = serverDatasetInfo.isFixed && activeSlots.length > 0 && activeSlots.every(
                          (idx) => (serverDatasetInfo.metadata?.slots?.[idx]?.recordsCount || 0) > 0
                        );

                        return (
                          <button
                            type="button"
                            onClick={handleSaveAsFixedServerDatabase}
                            disabled={saveProgress.active || (db === MOCK_DATABASE && !fileName && !serverDatasetInfo.isFixed)}
                            className={`flex-1 py-2 px-3.5 rounded-lg text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                              allActiveFixed ? "bg-emerald-700 hover:bg-emerald-800" : "bg-[#164194] hover:bg-[#0f306e]"
                            }`}
                            title={
                              allActiveFixed
                                ? "Todas as bases carregadas já estão ativas e consolidadas no Banco Central com integridade total"
                                : "Consolida e fixa todas as bases no Banco Central para que todos os usuários que acessarem o link vejam os mesmos dados"
                            }
                          >
                            {allActiveFixed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <Save className="w-3.5 h-3.5 text-[#ffcd57]" />
                            )}
                            {saveProgress.active
                              ? `Gravando no Banco Central... (${saveProgress.percent}%)`
                              : allActiveFixed
                              ? `✅ Bases Ativas e Fixadas no Banco Central (${(serverDatasetInfo.metadata?.totalRecords || 0).toLocaleString("pt-BR")} reg.)`
                              : "💾 Fixar Todas as Bases no Banco Central (Compartilhar com Todos os Usuários)"}
                          </button>
                        );
                      })()}

                      <button
                        type="button"
                        onClick={handleReloadFromServerDatabase}
                        disabled={saveProgress.active}
                        className="py-2 px-3 rounded-lg border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 bg-white shadow-2xs"
                        title="Recarrega as bases mais recentes consolidadas no Banco Central"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                        Sincronizar Banco
                      </button>

                      <button
                        type="button"
                        onClick={handleVerifyServerDataset}
                        disabled={isVerifyingServer}
                        className="py-2 px-3 rounded-lg border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 bg-white shadow-2xs"
                        title="Audita se o arquivo físico está gravado no disco do servidor"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isVerifyingServer ? "animate-spin" : ""}`} />
                        {isVerifyingServer ? "Auditando..." : "Auditar"}
                      </button>

                      {serverDatasetInfo.isFixed && (
                        <button
                          type="button"
                          onClick={handleResetServerDatabase}
                          className="py-2 px-2.5 rounded-lg border border-slate-300 hover:border-rose-400 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-medium transition cursor-pointer"
                          title="Remover o banco central e restaurar a base de demonstração"
                        >
                          Limpar Banco
                        </button>
                      )}
                    </div>
                  </div>

                  {uploadError && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-2.5 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span className="text-xs text-red-700 font-medium">{uploadError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Searchable and Sorted select block */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Activity className="w-5 h-5 text-[#164194]" />
                    <h2 className="font-semibold text-slate-900 text-sm">Seleção do Procedimento Principal</h2>
                  </div>
                  <p className="text-slate-500 text-xs mb-3.5 leading-relaxed">
                    Selecione o procedimento para cruzar instantaneamente os prestadores de BH e auditar gaps de faturamento.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase font-sans tracking-wider">
                      Procedimento Principal (Pesquisa por Texto e Ordem Alfabética)
                    </label>
                    <ProcedureSelector
                      procedures={allProcedures}
                      selectedProcedure={selectedProcedure}
                      isLoading={isLoadingProcedure}
                      onChange={(proc) => {
                        setSelectedProcedure(proc);
                        setSelectedNaihToInspect(null);
                      }}
                    />
                  </div>

                  {/* Volume e Incentivos SUS BH */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Volume de AIHs por Modelo */}
                    <div className="bg-slate-50/80 border border-slate-150 rounded-xl p-3">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block">Volume de AIHs por Modelo</span>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="text-center bg-white border border-slate-200 rounded-lg p-1.5 flex-1 shadow-2xs">
                          <span className="block text-sm font-extrabold text-[#164194] font-mono leading-none">
                            {fundingModels.incentivizedCount}
                          </span>
                          <span className="text-[7.5px] text-slate-400 uppercase font-mono">Incentivadas</span>
                        </div>
                        <div className="text-center bg-white border border-slate-200 rounded-lg p-1.5 flex-1 shadow-2xs">
                          <span className="block text-sm font-extrabold text-slate-400 font-mono leading-none">
                            {fundingModels.normalCount}
                          </span>
                          <span className="text-[7.5px] text-slate-400 uppercase font-mono">Normais</span>
                        </div>
                      </div>
                    </div>

                    {/* Diferença de Repasse */}
                    <div className="bg-slate-50/80 border border-slate-150 rounded-xl p-3 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block">Diferença de Repasse (SUS BH)</span>
                        <div className="mt-1 text-[10px] space-y-0.5 leading-none">
                          <div className="text-slate-500 font-mono flex justify-between">
                            <span>Incentivos:</span>
                            <strong className="text-slate-700">R$ {formatVal(fundingModels.avgIncentivizedTicket)}</strong>
                          </div>
                          <div className="text-slate-500 font-mono flex justify-between">
                            <span>Normais:</span>
                            <strong className="text-slate-700">R$ {formatVal(fundingModels.avgNormalTicket)}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-200/50 text-[10px] font-mono leading-none flex items-center justify-between">
                        <span className="font-sans font-bold text-[#164194] text-[9px]">Impacto de Incentivo:</span>
                        <span className="font-extrabold text-[#164194] bg-teal-50 px-1 py-0.5 rounded text-[9px] border border-teal-100">
                          {fundingModels.factorDiffPercent > 0 ? (
                            `+${fundingModels.factorDiffPercent.toFixed(1)}%`
                          ) : (
                            "0%"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit summary metrics cards */}
            <div id="summary-section" className="grid grid-cols-1 md:grid-cols-12 gap-5 scroll-mt-6">
              {/* Card 1: Diferencial Competitivo HUCM vs Mercado */}
              <div className="md:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">Diagnóstico Competitivo de Ticket Médio</span>
                    <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-800 font-semibold px-2 py-0.5 rounded-full font-mono">
                      HUCM vs LÍDER
                    </span>
                  </div>
                  <div className="mt-3.5 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">Ticket Médio HUCM</span>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">R$</span>
                        <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                          {formatVal(benchmarkAnalysis.hucmAvgTicket)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#164194] font-bold block">Meta Benchmark BH</span>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <span className="text-[10px] text-[#164194] font-mono font-bold">R$</span>
                        <span className="text-xl sm:text-2xl font-black text-[#164194] font-mono">
                          {formatVal(benchmarkAnalysis.benchmarkAvgTicket)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mt-3.5">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                      <span>Aproveitamento do Faturamento Potencial</span>
                      <span className="font-mono font-bold text-[#164194]">
                        {Math.round((benchmarkAnalysis.hucmAvgTicket / (benchmarkAnalysis.benchmarkAvgTicket || 1)) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-[#164194] rounded-full transition-all duration-350"
                        style={{ width: `${Math.min(100, Math.round((benchmarkAnalysis.hucmAvgTicket / (benchmarkAnalysis.benchmarkAvgTicket || 1)) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate max-w-48 font-semibold">Líder: {benchmarkAnalysis.benchmarkHospital}</span>
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                    Déficit: {Math.round(((benchmarkAnalysis.benchmarkAvgTicket - benchmarkAnalysis.hucmAvgTicket) / (benchmarkAnalysis.benchmarkAvgTicket || 1)) * 100)}%
                  </span>
                </div>
              </div>

              {/* Card 2: Potencial de Recuperação Financeira */}
              <div className="md:col-span-4 bg-white rounded-2xl p-5 border border-rose-200 shadow-xs relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-white to-rose-50/20">
                <div className="absolute right-3 top-3 bg-rose-50 border border-rose-100 text-rose-600 p-1.5 rounded-lg">
                  <AlertTriangle className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-rose-600 font-extrabold">Gargalo de Omissões de Receitas</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-xs text-rose-500 font-semibold font-mono">R$</span>
                    <span className="text-2xl sm:text-3xl font-extrabold text-rose-700 font-mono tracking-tight">
                      {formatVal(totalGapValue)}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800/80 mt-1.5 leading-relaxed text-left font-medium">
                    Receita recuperável imediata identificando os <span className="font-bold text-rose-700">{gapsAnalysis.gaps.length} itens não faturados</span> no prontuário do líder concorrente.
                  </p>
                </div>
                
                <div className="mt-3.5 pt-2.5 border-t border-rose-100 flex items-center justify-between text-xs text-rose-800">
                  <span className="flex items-center gap-1 font-bold">
                    <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping mr-1"></span>
                    {gapsAnalysis.gaps.length} Códigos Perdidos
                  </span>
                  <span className="font-mono text-[10px] text-rose-600 bg-rose-100 font-bold px-2 py-0.5 rounded">
                    AUDITORIA EVITÁVEL
                  </span>
                </div>
              </div>

              {/* Card 3: Escopo Geral BH */}
              <div className="md:col-span-3 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between font-sans">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono tracking-wider block">Estudo e Amostragem BH</span>
                  <div className="mt-3 space-y-2.5">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-[11px] text-slate-500 font-medium">Média Geral BH</span>
                      <span className="text-sm font-bold text-[#7c3aed] font-mono">
                        R$ {formatVal(procedureAverageTicket)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-[11px] text-slate-500 font-medium">Amostragem de AIHs</span>
                      <span className="text-sm font-bold text-slate-800 font-mono">
                        {distinctAihsCount} AIHs
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono uppercase tracking-wider">
                  <span>Belo Horizonte</span>
                  <span className="text-slate-500 font-bold font-sans">SUS BH</span>
                </div>
              </div>
            </div>

            {/* Benchmarking Header */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-sans">
                  Benchmarking de Mercado & Omissões de Registro
                </h2>
                <p className="text-slate-500 text-xs font-sans">
                  Comparativo visual dos prestadores de Belo Horizonte e mapeamento de atos não faturados pelo HUCM.
                </p>
              </div>
            </div>

        {/* Estudo Comparativo de Desempenho (Chart and Sidebar Rankings consolidated) */}
        <div id="competitiveness-block" className="grid grid-cols-1 lg:grid-cols-12 gap-8 scroll-mt-6">
          
          {/* Column A: Comparative Chart */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Mesa de Ticket por Hospital</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Comparativo do Ticket Médio de faturamento de cada hospital contra a Média Geral do Município de Belo Horizonte.
              </p>
            </div>
            
            <div className="h-[380px] w-full font-mono mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 35, right: 15, left: 15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis hide={true} />
                  <Tooltip
                    formatter={(value: any, name: string) => [`R$ ${value.toLocaleString()}`, name]}
                    labelClassName="font-bold text-slate-900 text-xs font-sans"
                    contentStyle={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                  />
                  {/* Line rendered before Bar so dashed meta line is underneath */}
                  <Line
                    type="monotone"
                    dataKey="Ticket Médio Geral (BH) (R$)"
                    name="Média BH SUS (Geral)"
                    stroke="#64748b"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 1 }}
                  />
                  <Bar dataKey="Ticket do Hospital (R$)" name="Ticket Médio do Hospital">
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isHUCM ? "#f3b924" : "#164194"} // HUCM brand gold, competitors/general brand teal
                      />
                    ))}
                    <LabelList
                      dataKey="Ticket do Hospital (R$)"
                      content={(props: any) => {
                        const { x, y, width, value, index } = props;
                        if (value === undefined || value === null || !width) return null;
                        const formattedVal = `R$ ${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
                        const item = chartData[index];
                        const isHUCM = item?.isHUCM;
                        const cx = x + width / 2;
                        const cy = y - 16;
                        return (
                          <g className="select-none pointer-events-none">
                            <rect
                              x={cx - 36}
                              y={cy - 12}
                              width={72}
                              height={22}
                              rx={6}
                              fill="#ffffff"
                              stroke={isHUCM ? "#f3b924" : "#164194"}
                              strokeWidth={1.5}
                              filter="drop-shadow(0px 1px 3px rgba(0,0,0,0.12))"
                            />
                            <text
                              x={cx}
                              y={cy + 3}
                              textAnchor="middle"
                              fill={isHUCM ? "#785b24" : "#0f172a"}
                              fontSize="12.5"
                              fontWeight="800"
                              fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                            >
                              {formattedVal}
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-100 font-sans">
              <div className="flex items-center gap-1.5 font-sans">
                <span className="w-3 h-3 bg-[#f3b924] rounded"></span>
                <span className="font-semibold text-slate-700">HUCM (Ciências Médicas / FELUMA)</span>
              </div>
              <div className="flex items-center gap-1.5 font-sans">
                <span className="w-3 h-3 bg-[#164194] rounded flex"></span>
                <span className="font-semibold text-slate-700">Prestadores Concorrentes (BH)</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-5 h-0.5 border-t-2 border-dashed border-slate-400"></span>
                <span>Média BH SUS (Referência)</span>
              </div>
            </div>
          </div>

          {/* Column B: Consolidated Interactive Performance Rankings (Storytelling Tabbed Sidebar) */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-base font-bold text-slate-900">Quadro de Audit de Prestadores</h3>
                <span className="bg-[#7c3aed]/10 text-[#7c3aed] text-[9px] font-black tracking-wider px-2 py-0.5 rounded font-mono uppercase">
                  RANKING DE TETO
                </span>
              </div>
              <p className="text-slate-500 text-xs mb-4">
                Selecione a métrica abaixo para reordenar instantaneamente os hospitais comparados.
              </p>
              
              {/* Tab Selector for Metrics */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-semibold font-sans">
                <button
                  type="button"
                  onClick={() => setRankingMetric("average")}
                  className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer ${
                    rankingMetric === "average"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Ticket Médio
                </button>
                <button
                  type="button"
                  onClick={() => setRankingMetric("maximum")}
                  className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer ${
                    rankingMetric === "maximum"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Ticket Máximo (Pico)
                </button>
              </div>

              {/* Table rendering the active metric */}
              <div className="overflow-x-auto overflow-y-auto max-h-[350px] border border-slate-100 rounded-xl">
                <table className="w-full text-left font-sans">
                  <thead className="sticky top-0 z-20 bg-slate-50 font-mono text-[9px] text-slate-500 uppercase tracking-widest border-b border-slate-100 shadow-xs">
                    <tr>
                      <th className="px-3.5 py-2.5 font-bold bg-slate-50">Prestador</th>
                      <th className="px-3.5 py-2.5 text-center font-bold bg-slate-50">
                        {rankingMetric === "average" ? "Internações" : "AIH de Pico"}
                      </th>
                      <th className="px-3.5 py-2.5 text-right font-bold bg-slate-50">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {(rankingMetric === "average" ? averageRankings : maxRankings).map((h, index) => {
                      const isHUCM = h.hospitalName.toUpperCase().includes("CIENCIAS MEDICAS") ||
                                     h.hospitalName.toUpperCase().includes("HUCM");
                      return (
                        <tr key={h.hospitalName} className={`hover:bg-slate-50 transition duration-150 ${isHUCM ? "bg-hucm-gold-light font-semibold text-[#886d38]" : "text-slate-750"}`}>
                          <td className="px-3.5 py-2 flex items-center gap-2">
                            <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              index === 0
                                ? "bg-rose-500 text-white"
                                : isHUCM
                                ? "bg-hucm-gold text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {index + 1}
                            </span>
                            <span className="truncate max-w-[130px] block font-semibold text-[11px]" title={h.hospitalName}>
                              {h.hospitalName.substring(0, 18)}...
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-center font-mono text-slate-500 text-[11px]">
                            {rankingMetric === "average" ? (
                              h.totalAIHs
                            ) : (
                              procedureAihsDetails.find((a) => a.hospital === h.hospitalName)?.naih || "N/A"
                            )}
                          </td>
                          <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900 text-[11px]">
                            R$ {formatVal(rankingMetric === "average" ? h.ticketAvg : h.ticketMax)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="pt-2 text-[10px] text-slate-400 font-mono text-left italic border-t border-slate-100 mt-3 flex items-center justify-between">
              <span>* Faturamento ({rankingMetric === "average" ? "Médio das AIHs" : "Maior Bilhete Unitário"})</span>
              <span className="text-[#164194] font-bold">Audit SUS</span>
            </div>
          </div>
        </div>

        {/* Side-by-side Comparative Table "O Pulo do Gato" inside NeosSUS visual frame */}
        <div id="comparison-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-12">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              
              {/* Clean Header */}
              <div className="bg-slate-900 text-white p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h3 className="text-base font-bold font-sans">
                    Comparação de Itens de AIH (Benchmark vs HUCM)
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Demonstração dos códigos faturados no concorrente de maior desempenho (<strong className="text-blue-400">{benchmarkAnalysis.benchmarkHospital}</strong>) comparados ao <strong className="text-orange-400">HUCM</strong> para o mesmo procedimento.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-800/60 font-sans">
                    <div className="bg-slate-800/80 border border-slate-700/30 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">Benchmark ({benchmarkAnalysis.benchmarkHospital}):</span>
                      <span className="font-mono font-bold text-[#38bdf8] bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-900/30 text-xs">
                        AIH {benchmarkAnalysis.benchmarkNaih || "—"}
                      </span>
                      {benchmarkAnalysis.benchmarkMaxTicket > 0 && (
                        <span className="font-mono font-bold text-sky-300 text-xs">
                          (R$ {formatVal(benchmarkAnalysis.benchmarkMaxTicket)})
                        </span>
                      )}
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700/30 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">HUCM:</span>
                      <span className="font-mono font-bold text-[#fb923c] bg-orange-950/40 px-1.5 py-0.5 rounded border border-orange-900/30 text-xs">
                        AIH {benchmarkAnalysis.hucmNaih || "—"}
                      </span>
                      {benchmarkAnalysis.hucmMaxTicket > 0 && (
                        <span className="font-mono font-bold text-orange-300 text-xs">
                          (R$ {formatVal(benchmarkAnalysis.hucmMaxTicket)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="bg-rose-950/80 border border-rose-800 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"></div>
                  <div>
                    <span className="block text-[10px] text-rose-300 font-bold uppercase font-mono">Diferença de Escopo</span>
                    <span className="text-xs font-semibold text-white">
                      HUCM deixa de faturar {gapsAnalysis.gaps.length} itens (R$ {formatVal(totalGapValue)} potenciais)
                    </span>
                  </div>
                </div>
              </div>

              {/* Side-by-side table container */}
              <div className="p-4 overflow-x-auto max-h-[550px] overflow-y-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-700 shadow-xs">
                    <tr className="border-b border-slate-800">
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider font-mono w-28">Código</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Itens Faturados no Concorrente ({benchmarkAnalysis.benchmarkHospital})</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider font-mono w-24 text-center">Quant.</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider font-mono w-32 text-right">Valor Unit.</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Status Auditoria & Impacto HUCM</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider font-mono text-center">HUCM Ocorr.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* First list all benchmark acts */}
                    {gapsAnalysis.benchmarkActs.map((refAct, i) => {
                      const hucmMatch = gapsAnalysis.hucmActs.find((h) => 
                        (refAct.code > 0 && h.code === refAct.code && Math.abs(h.value - refAct.value) < 0.05) || 
                        (refAct.code === 0 && refAct.name.trim().toUpperCase() === h.name.trim().toUpperCase())
                      );
                      const isMissing = !hucmMatch || hucmMatch.qty === 0;
                      const hasQtyMismatch = hucmMatch && hucmMatch.qty !== refAct.qty;
                      
                      let rowBgClass = "hover:bg-slate-50 border-slate-100 text-slate-700";
                      if (isMissing) {
                        rowBgClass = "bg-rose-50/70 border-rose-100 hover:bg-rose-100/40 text-slate-800";
                      } else if (hasQtyMismatch) {
                        rowBgClass = "bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/40 text-slate-800";
                      }

                      return (
                        <tr
                          key={`ref-${i}`}
                          className={`border-b text-xs transition duration-150 ${rowBgClass}`}
                        >
                          <td className="py-3.5 px-4 font-mono">
                            <span className="bg-slate-100 text-slate-700 border border-slate-200/60 rounded px-1.5 py-0.5 text-[10px] font-bold">
                              {refAct.code || "---"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium flex items-center gap-2">
                            {isMissing ? (
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                            ) : hasQtyMismatch ? (
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse"></span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            )}
                            {refAct.name}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-medium">
                            {hasQtyMismatch ? (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold border border-slate-400">
                                {refAct.qty}
                              </span>
                            ) : (
                              refAct.qty
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-500">R$ {formatVal(refAct.value)}</td>
                          <td className="py-3.5 px-4">
                            {isMissing ? (
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
                                <AlertTriangle className="w-3 h-3" /> Exclusivo do Concorrente (Perda HUCM: -R$ {formatVal(refAct.total)})
                              </span>
                            ) : hasQtyMismatch ? (
                              hucmMatch.qty < refAct.qty ? (
                                <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Dif. Quantidade (Sobrou {refAct.qty - hucmMatch.qty} no Concorrente | Perda: -R$ {formatVal((refAct.qty - hucmMatch.qty) * refAct.value)})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-900 border border-blue-350 font-extrabold px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider">
                                  <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Dif. Quantidade (HUCM Faturou +{hucmMatch.qty - refAct.qty} un.)
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-105 text-emerald-800 border border-emerald-200 font-medium px-2 py-0.5 rounded text-[10px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Item Faturado por Ambos (Adequado)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold">
                            {isMissing ? (
                              <span className="text-rose-600">0</span>
                            ) : hasQtyMismatch ? (
                              hucmMatch.qty < refAct.qty ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 font-extrabold border border-amber-400">
                                  {hucmMatch.qty} <span className="text-[10px] text-amber-700 font-medium">(-{refAct.qty - hucmMatch.qty})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-105 text-blue-950 font-extrabold border border-blue-400">
                                  {hucmMatch.qty} <span className="text-[10px] text-blue-700 font-medium">(+{hucmMatch.qty - refAct.qty})</span>
                                </span>
                              )
                            ) : (
                              <span className="text-emerald-700">{hucmMatch.qty}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Any items unique to HUCM (not present in benchmark) */}
                    {gapsAnalysis.hucmActs
                      .filter((ha) => !gapsAnalysis.benchmarkActs.some((ra) => 
                        (ra.code > 0 && ha.code === ra.code && Math.abs(ha.value - ra.value) < 0.05) || 
                        (ra.code === 0 && ra.name.trim().toUpperCase() === ha.name.trim().toUpperCase())
                      ))
                      .map((hucmUnique, i) => (
                        <tr
                          key={`unique-hucm-${i}`}
                          className="border-b text-xs border-slate-100 bg-amber-50/50 hover:bg-amber-50 text-slate-700 font-mono"
                        >
                          <td className="py-3.5 px-4 font-mono">
                            <span className="bg-slate-200/60 text-slate-700 border border-slate-300/60 rounded px-1.5 py-0.5 text-[10px] font-bold">
                              {hucmUnique.code || "---"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium font-sans italic text-slate-600 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0"></span>
                            {hucmUnique.name}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-400 font-medium">0</td>
                          <td className="py-3.5 px-4 text-right text-slate-500">R$ {formatVal(hucmUnique.value)}</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded text-[10px]">
                              Item Exclusivo HUCM (Revisar se cabe repasse ao competidor)
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-orange-600">{hucmUnique.qty}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-slate-50 p-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-mono">
                  <Info className="w-4 h-4 text-slate-400" />
                  Nota de Auditoria: Os valores com fundo avermelhado são glosas preventivas que o HUCM deixou de lançar no prontuário.
                </span>
                <span className="font-semibold text-slate-800">
                  Total de Atos Analisados: {gapsAnalysis.benchmarkActs.length + gapsAnalysis.hucmActs.filter((ha) => !gapsAnalysis.benchmarkActs.some((ra) => 
                    (ra.code > 0 && ha.code === ra.code && Math.abs(ha.value - ra.value) < 0.05) || 
                    (ra.code === 0 && ra.name.trim().toUpperCase() === ha.name.trim().toUpperCase())
                  )).length} itens
                </span>
              </div>

            </div>
          </div>
        </div>

        {/* TABELA DE COMPOSIÇÃO DO TICKET MÉDIO POR HOSPITAL (Requirement 1) */}
        <div id="hospital-ticket-composition" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs mt-6 scroll-mt-6">
          <div className="bg-slate-900 text-white p-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-white font-sans">
                  Composição do Ticket Médio por Provedor Hospitalar
                </h3>
                <p className="text-slate-400 text-xs mt-0.5 font-sans">
                  Agrupamento das AIHs e verificação de diárias de UTI que influenciam o ticket médio.
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300 font-bold uppercase">Procedimento:</span>
                <span className="text-emerald-400 font-bold max-w-[220px] truncate" title={selectedProcedure}>{selectedProcedure}</span>
              </div>
            </div>

            {/* Sorting Controls */}
            <div className="mt-4 flex flex-wrap gap-3 items-center border-t border-slate-800 pt-3 text-xs font-sans">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                  Ordenar Hospitais:
                </span>
                <button
                  type="button"
                  onClick={() => setHospitalSortBy("value-desc")}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
                    hospitalSortBy === "value-desc"
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Ticket Médio (Maior → Menor)
                </button>
                <button
                  type="button"
                  onClick={() => setHospitalSortBy("value-asc")}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
                    hospitalSortBy === "value-asc"
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Ticket Médio (Menor → Maior)
                </button>
                <button
                  type="button"
                  onClick={() => setHospitalSortBy("name-asc")}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
                    hospitalSortBy === "name-asc"
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Nome (A-Z)
                </button>
              </div>

              <div className="h-4 w-[1px] bg-slate-800 hidden md:block"></div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
                  Ordenar AIHs internas:
                </span>
                <button
                  type="button"
                  onClick={() => setAihSortBy("value-desc")}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
                    aihSortBy === "value-desc"
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Valor (Maior → Menor)
                </button>
                <button
                  type="button"
                  onClick={() => setAihSortBy("value-asc")}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
                    aihSortBy === "value-asc"
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Valor (Menor → Maior)
                </button>
                <button
                  type="button"
                  onClick={() => setAihSortBy("uti-desc")}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
                    aihSortBy === "uti-desc"
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Diárias UTI (Maior → Menor)
                </button>
              </div>
            </div>
          </div>

          <div className="p-4">
            {utiWarningInfo.hasUTI && (
              <div className="bg-amber-50 border-l-4 border-amber-500 rounded-xl p-3.5 shadow-2xs mb-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-950 uppercase font-mono tracking-wider">
                      ⚠️ Detecção de Diárias de UTI ({utiWarningInfo.totalQty} diárias identificadas)
                    </h4>
                    <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                      Diárias de UTI elevam artificialmente o ticket médio. Verifique os hospitais com UTI para evitar distorções.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {utiWarningInfo.hospitals.map(({ hosp, qty }) => (
                        <span key={hosp} className="bg-amber-100/80 border border-amber-200/50 text-amber-900 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold">
                          {hosp}: {qty} {qty === 1 ? "diária" : "diárias"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto max-h-[550px] overflow-y-auto border border-slate-200 rounded-xl shadow-2xs bg-white">
              <table className="w-full text-left text-xs divide-y divide-slate-200 font-sans border-collapse">
                <thead className="sticky top-0 z-20 bg-[#f4f8fe] text-slate-700 font-mono text-[10px] uppercase font-bold border-b border-slate-200 shadow-xs">
                  <tr>
                    <th className="px-6 py-4 font-bold">Grupo Hospitalar / AIH Faturada</th>
                    <th className="px-6 py-4 text-center font-bold">Qtde de Diárias UTI (Total / AIH)</th>
                    <th className="px-6 py-4 text-center font-bold">Período & Permanência</th>
                    <th className="px-6 py-4 text-right font-bold bg-[#164194]/5 text-[#164194]">Valor Procedimento Dia</th>
                    <th className="px-6 py-4 text-right font-bold bg-[#164194]/5 text-[#0f306e]">Ticket / Permanência Média</th>
                    <th className="px-6 py-4 text-right font-bold">Resumo Financeiro (Total / AIH)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {hospitalAihGroupsSorted.map((group) => {
                    const isGroupHUCM = group.hospital.toUpperCase().includes("CIENCIAS MEDICAS") ||
                                       group.hospital.toUpperCase().includes("HUCM");
                    const isGroupExpanded = !!expandedHospitals[group.hospital];
                    return (
                      <Fragment key={group.hospital}>
                        {/* Group Header / Totalizer Row */}
                        <tr 
                          onClick={() => toggleHospitalExpand(group.hospital)}
                          className={`bg-[#164194]/5 font-semibold text-slate-900 border-b border-slate-250 transition cursor-pointer hover:bg-[#164194]/10 select-none ${
                            isGroupHUCM ? "bg-hucm-gold-light border-l-4 border-l-hucm-gold" : ""
                          }`}
                          title="Clique para expandir ou recolher as AIHs faturadas por este hospital"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              {isGroupExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-600 shrink-0 transition" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition" />
                              )}
                              <Building2 className={`w-4 h-4 shrink-0 ${isGroupHUCM ? "text-hucm-gold" : "text-[#164194]"}`} />
                              <span className="text-sm font-bold text-slate-800">
                                {group.hospital}
                              </span>
                              <span className="bg-slate-200/85 text-slate-700 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full shrink-0">
                                {group.totalAihs} {group.totalAihs === 1 ? "AIH" : "AIHs"}
                              </span>
                              {isGroupHUCM && (
                                <span className="bg-hucm-gold text-white font-mono font-black text-[9px] px-2 py-0.5 rounded-full tracking-wider shrink-0 shadow-2xs">
                                  SUA INSTITUIÇÃO (HUCM)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {group.totalUtiQty > 0 ? (
                              <div className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-250 rounded-full text-amber-900 text-[11px] font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="font-mono text-amber-900 font-bold">{group.totalUtiQty}</span> Diárias UTI
                              </div>
                            ) : (
                              <span className="text-slate-400 font-medium italic text-[11px]">Enfermaria Comum (0 UTI)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-slate-650 font-medium text-[11px] font-sans">
                              Permanência Média: <strong className="font-mono text-slate-900 font-extrabold text-xs">{group.avgPermanence.toFixed(1).replace(".", ",")}</strong> d
                            </span>
                          </td>
                          {/* NEW COLUMN 1: Ticket Médio / Total Diárias */}
                          <td className="px-6 py-4 text-right bg-slate-50/20">
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-mono font-extrabold text-slate-800">
                                R$ {formatVal(group.avgValue / (group.totalPermanence || 1))}
                              </span>
                              <span className="text-[9px] text-slate-500 font-sans font-medium">
                                ({group.totalPermanence} diárias somadas)
                              </span>
                            </div>
                          </td>
                          {/* NEW COLUMN 2: Ticket Médio / Permanência Média */}
                          <td className="px-6 py-4 text-right bg-slate-50/35">
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-mono font-extrabold text-[#164194]">
                                R$ {formatVal(group.avgValue / (group.avgPermanence || 1))}
                              </span>
                              <span className="text-[9px] text-slate-500 font-sans font-medium">
                                (Ref. {group.avgPermanence.toFixed(1).replace(".", ",")} d stay)
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider font-bold">
                                Ticket Médio: <span className={`text-sm font-mono font-black ${isGroupHUCM ? "text-[#164194]" : "text-slate-900"}`}>R$ {formatVal(group.avgValue)}</span>
                              </span>
                              <span className="text-slate-400 text-xs">/</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Total: R$ {formatVal(group.totalValue)}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Underlying AIH Rows */}
                        {isGroupExpanded && group.aihs.map((aih) => {
                          const isHighOutlier = aih.finalTicket > group.avgValue * 1.35;
                          const hasUTIDaily = aih.utiQty > 0;
                          return (
                            <tr
                              key={aih.naih}
                              onClick={() => {
                                setSelectedNaihToInspect(aih.naih);
                                const dossierHeader = document.getElementById("inspection-dossier-panel");
                                if (dossierHeader) {
                                  dossierHeader.scrollIntoView({ behavior: "smooth" });
                                }
                              }}
                              className={`group hover:bg-slate-50 cursor-pointer transition duration-150 border-b border-slate-100 ${
                                selectedNaihToInspect === aih.naih
                                  ? "bg-teal-50/40 hover:bg-teal-50/60"
                                  : ""
                              }`}
                            >
                              <td className="px-8 py-3.5">
                                <div className="flex items-center gap-3 pl-2">
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 group-hover:text-[#164194] transition-all shrink-0" />
                                  <span className="font-mono bg-slate-100 group-hover:bg-[#164194]/10 border border-slate-200 group-hover:border-[#164194]/20 text-slate-700 group-hover:text-[#164194] font-bold text-xs px-2.5 py-1 rounded-lg transition shrink-0">
                                    AIH: {aih.naih}
                                  </span>
                                  <span className="text-[10px] text-slate-450 italic font-medium opacity-0 group-hover:opacity-100 transition duration-150">
                                    Inspecionar faturamento detalhado
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                {hasUTIDaily ? (
                                  <span className="font-sans font-extrabold bg-amber-100 text-amber-900 border border-amber-250 px-2.5 py-0.5 rounded text-[11px] inline-flex items-center gap-1">
                                    ⚠️ {aih.utiQty} Diárias {aih.utiQty > 10 ? "(Outlier UTI)" : ""}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">—</span>
                                )}
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <div className="inline-flex flex-col items-center justify-center gap-0.5">
                                  <span className="text-[10px] font-mono text-slate-600 font-bold bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                                    {formatRawDateToBr(aih.dtInter)} a {formatRawDateToBr(aih.dtSaida)}
                                  </span>
                                  <span className="text-[10px] text-teal-800 font-extrabold bg-teal-50 border border-teal-150/40 px-1.5 py-0.2 rounded text-[9px]">
                                    ⏱️ {aih.permanence} {aih.permanence === 1 ? "dia" : "dias"}
                                  </span>
                                </div>
                              </td>
                              {/* Sub-row NEW COLUMN 1: Unit AIH Ticket / Unit AIH Stay Days */}
                              <td className="px-6 py-3.5 text-right font-mono bg-slate-50/10">
                                <div className="flex flex-col items-end">
                                  <span className="text-xs font-bold text-slate-700">
                                    R$ {formatVal(aih.finalTicket / (aih.permanence || 1))}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-sans">
                                    por {aih.permanence} {aih.permanence === 1 ? "dia" : "dias"}
                                  </span>
                                </div>
                              </td>
                              {/* Sub-row NEW COLUMN 2: Unit AIH Ticket / Group Average Stay Days */}
                              <td className="px-6 py-3.5 text-right font-mono bg-slate-50/20">
                                <div className="flex flex-col items-end">
                                  <span className="text-xs font-semibold text-slate-600">
                                    R$ {formatVal(aih.finalTicket / (group.avgPermanence || 1))}
                                  </span>
                                  <span className="text-[9px] text-slate-450 font-sans">
                                    ref. {group.avgPermanence.toFixed(1).replace(".", ",")} d
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-right font-mono">
                                <div className="flex items-center justify-end gap-2">
                                  {isHighOutlier && (
                                    <span className="bg-rose-50 border border-rose-250 text-rose-700 text-[9px] font-bold px-2 py-0.5 rounded font-sans uppercase tracking-wider shrink-0" title="AIH com ticket 35% acima da média do grupo hospitalar por poluente clínico UTI">
                                      🚨 OUTLIER DE TICKET
                                    </span>
                                  )}
                                  <span className={`text-xs font-black ${isHighOutlier ? "text-rose-600 font-extrabold" : "text-slate-700"}`}>
                                    R$ {formatVal(aih.finalTicket)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 p-4 border border-t-0 border-slate-200 rounded-b-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-500 font-sans">
              <span className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#164194] shrink-0" />
                Dica Profissional: Clique em qualquer linha de AIH individual acima para carregar instantaneamente o faturamento detalhado no dossiê qualitativo.
              </span>
              <span className="font-bold text-slate-700">
                Total de AIHs Processadas: {procedureAihsDetails.length} documentos
              </span>
            </div>
          </div>
        </div>

        {/* Dossier Panel (Requirement 7 & Interactive Qualitative Inspections) */}
        {inspectedAih && (
          <div id="inspection-dossier-panel" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs mt-6 transition duration-300">
            <div className="bg-slate-900 text-white p-5 relative">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#164194]/20 text-[#164194] border border-[#164194]/35 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                      Dossiê Qualitativo
                    </span>
                    <span className="text-slate-400 text-xs">/</span>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest font-mono">
                      AIH {inspectedAih.naih}
                    </span>
                  </div>
                  <h3 className="text-base font-bold mt-1 font-sans text-white flex items-center gap-2">
                    <FolderClosed className="w-4 h-4 text-emerald-400 shrink-0" />
                    Detalhamento de Itens da AIH
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Decomposição dos sub-atos faturados na autorização de internação selecionada.
                  </p>
                </div>
                
                <div className="flex flex-col items-start md:items-end font-sans">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">Prestador</span>
                  <span className="text-sm font-bold text-emerald-400">{inspectedAih.hospital}</span>
                </div>
              </div>
            </div>

            <div className="p-4">
              {/* Financial stats inside folder */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 border border-slate-150 rounded-xl p-3.5 mb-4 font-sans text-left">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Ticket da AIH</span>
                  <span className="text-base font-black text-[#164194] font-mono block mt-0.5">
                    R$ {formatVal(inspectedAih.finalTicket)}
                  </span>
                  <span className="text-[9px] text-slate-500 block">Total faturado</span>
                </div>
                
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Atos Faturados</span>
                  <span className="text-base font-bold text-slate-800 font-mono block mt-0.5">
                    {inspectedAih.rows.length} itens
                  </span>
                  <span className="text-[9px] text-slate-500 block font-sans">Sub-lançamentos</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Diárias UTI</span>
                  {inspectedAih.utiQty > 0 ? (
                    <span className="text-base font-extrabold text-amber-600 block mt-0.5">
                      ⚠️ {inspectedAih.utiQty} Diárias
                    </span>
                  ) : (
                    <span className="text-base font-semibold text-slate-500 block mt-0.5">
                      0 (Enfermaria)
                    </span>
                  )}
                  <span className="text-[9px] text-slate-500 block">Terapia Intensiva</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Permanência</span>
                  <span className="text-base font-extrabold text-[#164194] font-mono block mt-0.5">
                    ⏱️ {inspectedAih.permanence} {inspectedAih.permanence === 1 ? "dia" : "dias"}
                  </span>
                  <span className="text-[9px] text-slate-500 block">
                    {formatRawDateToBr(inspectedAih.dtInter)} a {formatRawDateToBr(inspectedAih.dtSaida)}
                  </span>
                </div>

                <div className="bg-white rounded-lg p-2.5 border border-slate-200 flex flex-col justify-center col-span-2 md:col-span-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                    <span className="font-sans font-semibold text-slate-500 text-[10px]">Validação:</span>
                    {inspectedAih.rows.every(r => r.Valida) ? (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-250 px-2 py-0.5 rounded font-mono font-bold uppercase text-[9px] flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5 shrink-0" /> 100% VÁLIDA
                      </span>
                    ) : inspectedAih.rows.some(r => r.Valida) ? (
                      <span className="text-amber-800 bg-amber-50 border border-amber-250 px-1.5 py-0.5 rounded font-mono font-bold uppercase text-[9px]">
                        PARCIAL ({inspectedAih.rows.filter(r => r.Valida).length}/{inspectedAih.rows.length})
                      </span>
                    ) : (
                      <span className="text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono font-bold uppercase text-[9px]">
                        A VALIDAR
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Account details ledger */}
              <div className="overflow-x-auto max-h-[450px] overflow-y-auto border border-slate-150 rounded-xl shadow-2xs bg-white">
                <table className="w-full text-left font-sans border-collapse">
                  <thead className="sticky top-0 z-20 bg-[#f4f8fe] text-slate-700 font-mono text-[9px] uppercase font-bold border-b border-slate-150 tracking-wider shadow-xs">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Procedimento (Ato Faturado)</th>
                      <th className="px-4 py-3 text-center">Quant.</th>
                      <th className="px-4 py-3 text-right">Valor Unitário</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                      <th className="px-4 py-3 text-center">Auditoria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {inspectedAih.rows.map((row, index) => {
                      const valTotal = parseVal(row.SP_VALATO);
                      const qty = row.SP_QTD_ATO || 1;
                      const valUnit = qty > 0 ? Math.round((valTotal / qty) * 100) / 100 : valTotal;
                      const rowSubtotal = valTotal;
                      
                      // Find unique index in main db for reactive toggle
                      const dbIndex = db.findIndex(
                        (r) =>
                          r.SP_NAIH === row.SP_NAIH &&
                          r.SEQUENCIA === row.SEQUENCIA &&
                          r.SP_ATOPROF === row.SP_ATOPROF &&
                          r["PROCEDIMENTO ATO"] === row["PROCEDIMENTO ATO"]
                      );

                      return (
                        <tr key={index} className="hover:bg-slate-50 transition duration-150">
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{row.SP_ATOPROF}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900 max-w-[280px] leading-relaxed break-words">
                            {row["PROCEDIMENTO ATO"] || "Procedimento Clínico Geral"}
                          </td>
                          <td className="px-4 py-2.5 text-center font-mono font-bold">{qty}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-500">R$ {formatVal(valUnit)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">R$ {formatVal(rowSubtotal)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (dbIndex !== -1) {
                                  handleToggleValidation(dbIndex);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-md border font-mono font-bold text-[10px] cursor-pointer transition duration-150 ${
                                row.Valida
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                                  : "bg-slate-100 border-slate-350 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {row.Valida ? "✓ AUDITADO" : "⚙ REVISAR"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Auditoria de Preços Unitários por Código Clínico (SP_ATOPROF) */}
        <div id="atoprof-price-auditor" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs mt-6">
          <div className="bg-slate-900 text-white p-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h3 className="text-base font-bold font-sans text-white">
                  Valores Unitários Praticados por Código de Atividade (SP_ATOPROF)
                </h3>
                <p className="text-slate-400 text-xs mt-0.5 max-w-3xl font-sans">
                  Comparação de valores unitários cobrados para os mesmos códigos de atos profissionais entre os hospitais de BH.
                </p>
              </div>
            </div>

            {/* Interactive Filters to Isolate Codes */}
            <div className="mt-4 pt-3 border-t border-slate-850 grid grid-cols-1 md:grid-cols-12 gap-3 items-center font-sans">
              
              <div className="md:col-span-4 flex flex-col gap-1">
                <label htmlFor="search-code-filter" className="text-xs text-slate-300 font-bold">Buscar Código ou Nome:</label>
                <div className="relative">
                  <input
                    id="search-code-filter"
                    type="text"
                    placeholder="Digite código ou nome..."
                    value={selectedActCodeFilter}
                    onChange={(e) => setSelectedActCodeFilter(e.target.value)}
                    className="w-full bg-slate-850 hover:bg-slate-800/80 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:border-[#164194] focus:ring-1 focus:ring-[#164194] outline-none font-sans transition"
                  />
                  {selectedActCodeFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedActCodeFilter("")}
                      className="absolute right-3 top-2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer font-sans"
                      title="Limpar busca"
                    >
                      CLEAR
                    </button>
                  )}
                </div>
              </div>

              <div className="md:col-span-5 flex flex-col gap-1">
                <label htmlFor="select-code-filter" className="text-xs text-slate-300 font-bold">Selecione Atividade (SP_ATOPROF):</label>
                <select
                  id="select-code-filter"
                  value={selectedActCodeFilter}
                  onChange={(e) => setSelectedActCodeFilter(e.target.value)}
                  className="w-full bg-slate-850 text-white text-xs rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-[#164194] focus:ring-1 focus:ring-[#164194] cursor-pointer text-ellipsis font-sans transition"
                >
                  <option value="">🔍 [Todos os preços divergentes]</option>
                  {allAtosList.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} - {item.name.length > 35 ? item.name.substring(0, 33) + "..." : item.name} ({item.uniqVals.length} {item.uniqVals.length === 1 ? 'preço' : 'preços'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 flex justify-end pt-2 md:pt-0">
                {selectedActCodeFilter ? (
                  <button
                    type="button"
                    onClick={() => setSelectedActCodeFilter("")}
                    className="px-3 py-2 bg-[#164194] hover:bg-[#0f306e] text-white font-bold text-xs rounded-lg shadow transition duration-150 flex items-center justify-center gap-1 cursor-pointer w-full md:w-auto"
                  >
                    Mostrar Todos Divergentes
                  </button>
                ) : (
                  <div className="text-[11px] text-slate-400 text-center md:text-right italic w-full">
                    Exibindo <span className="text-amber-400 font-bold font-mono">{filteredAtosList.length}</span> códigos divergentes.
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="p-4">
              
            {filteredAtosList.length > 0 ? (
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto border border-slate-150 rounded-xl shadow-2xs bg-white">
                <table className="w-full text-left text-xs divide-y divide-slate-150 font-sans border-collapse">
                  <thead className="sticky top-0 z-20 bg-[#f4f8fe] text-slate-800 font-mono text-[10px] uppercase font-bold border-b border-slate-200 shadow-xs">
                    <tr>
                      <th className="px-3.5 py-3 font-bold bg-[#f4f8fe]">Código</th>
                      <th className="px-3.5 py-3 font-sans font-bold bg-[#f4f8fe]">Procedimento SUS</th>
                      <th className="px-3.5 py-3 text-center border-l border-slate-150 bg-amber-100/90 text-amber-950 font-bold">Valor HUCM</th>
                      {competitorHospitals.map((hosp) => (
                        <th key={hosp} className="px-3.5 py-3 text-center border-l border-slate-150 font-bold max-w-[160px] break-words text-slate-700 bg-[#f4f8fe]" title={hosp}>
                          {hosp}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-sans">
                    {filteredAtosList.map((v) => {
                      const hucmValues = Array.from(new Set(
                        v.values
                          .filter((valObj) => {
                            const hName = valObj.hosp.toUpperCase();
                            return hName.includes("CIENCIAS MEDICAS") || hName.includes("HUCM");
                          })
                          .map((valObj) => valObj.val as number)
                      )) as number[];

                      return (
                        <tr key={v.code} className="hover:bg-slate-50 transition duration-150">
                          <td className="px-3.5 py-2.5 font-mono text-slate-800 font-bold">{v.code}</td>
                          <td className="px-3.5 py-2.5 font-medium text-slate-900 max-w-[260px] leading-relaxed break-words">{v.name}</td>
                          <td className="px-3.5 py-2.5 text-center border-l border-slate-150 bg-amber-100/10 font-mono">
                            {hucmValues.length > 0 ? (
                              <div className="flex flex-wrap items-center justify-center gap-1 font-sans">
                                {hucmValues.map((val) => (
                                  <span
                                    key={val}
                                    className="bg-amber-100 border border-amber-300 text-[#164194] rounded px-2 py-0.5 text-[11px] font-black shadow-2xs whitespace-nowrap"
                                  >
                                    R$ {formatVal(val)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-rose-600 font-extrabold bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-100 uppercase tracking-wider font-sans">
                                🔴 Omitido
                              </span>
                            )}
                          </td>
                          {competitorHospitals.map((hosp) => {
                            const competitorValues = Array.from(new Set(
                              v.values
                                .filter((valObj) => valObj.hosp === hosp)
                                .map((valObj) => valObj.val as number)
                            )) as number[];

                            return (
                              <td key={hosp} className="px-3.5 py-2.5 text-center border-l border-slate-150 font-mono">
                                {competitorValues.length > 0 ? (
                                  <div className="flex flex-wrap items-center justify-center gap-1 font-sans">
                                    {competitorValues.map((val) => (
                                      <span
                                        key={val}
                                        className="bg-[#164194]/10 border border-[#164194]/20 text-slate-700 font-bold rounded px-2 py-0.5 text-[11px]"
                                      >
                                        R$ {formatVal(val)}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[10px] font-sans">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 font-sans text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50">
                ⚠️ Nenhum código correspondente para <strong className="text-slate-600">"{selectedActCodeFilter}"</strong>.
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </main>

      {/* In-app Confirmation Modal (reliable in iframe and standalone environments) */}
      {confirmModal && confirmModal.isOpen && (
        <div
          id="confirm-action-modal-backdrop"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setConfirmModal(null)}
        >
          <div
            id="confirm-action-modal-content"
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.confirmVariant === "danger"
                    ? "bg-rose-100 text-rose-600 border border-rose-200"
                    : "bg-amber-100 text-amber-700 border border-amber-200"
                }`}
              >
                {confirmModal.confirmVariant === "danger" ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col gap-1 text-left">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-sans">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 mt-1">
              <button
                type="button"
                id="btn-cancel-modal"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-modal"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition cursor-pointer shadow-sm ${
                  confirmModal.confirmVariant === "danger"
                    ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
                    : "bg-[#164194] hover:bg-[#0f2e6b] active:bg-[#0a204b]"
                }`}
              >
                {confirmModal.confirmLabel || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Analysis Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        selectedProcedure={selectedProcedure}
        activeTab={activeTab}
        serverDatasetInfo={serverDatasetInfo}
        totalRecords={db.length}
        slotNames={slotNames}
      />
    </div>
  );
}
