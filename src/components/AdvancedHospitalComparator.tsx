import { useState, useMemo, useEffect } from "react";
import {
  Building2,
  Calendar,
  Filter,
  ArrowRight,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  Download,
  Search,
  CheckCircle2,
  Code2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Clock,
  HeartPulse,
  DollarSign,
  Activity,
  Layers,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  X,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { SUSRecord } from "../types";
import { formatVal, parseVal } from "../data/mockData";
import { calculatePermanence } from "../App";
import Papa from "papaparse";

interface AdvancedHospitalComparatorProps {
  records: SUSRecord[];
}

export interface AihActItem {
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
  acts: AihActItem[];
}

export interface ComparisonSharedProcedure {
  code: string;
  name: string;
  // Hospital A metrics
  aihsA: number;
  utiDaysA: number;
  avgPermanenceA: number;
  avgTicketA: number;
  totalFaturadoA: number;
  // Hospital B metrics
  aihsB: number;
  utiDaysB: number;
  avgPermanenceB: number;
  avgTicketB: number;
  totalFaturadoB: number;
  // AIHs detail lists (sorted descending by finalTicket)
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
  // AIHs detail list (sorted descending by finalTicket)
  aihsDetailsB: DetailedAihItem[];
}

type SharedSortKey =
  | "name"
  | "aihsA"
  | "aihsB"
  | "utiDaysA"
  | "utiDaysB"
  | "avgPermanenceA"
  | "avgPermanenceB"
  | "avgTicketA"
  | "avgTicketB"
  | "totalFaturadoA"
  | "totalFaturadoB";

type ExclusiveSortKey =
  | "name"
  | "aihsB"
  | "utiDaysB"
  | "avgPermanenceB"
  | "avgTicketB"
  | "totalFaturadoB";

function formatSUSDate(val: any): string {
  if (!val) return "-";
  const str = String(val).replace(/\D/g, "");
  if (str.length === 8) {
    return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`;
  }
  return String(val);
}

export default function AdvancedHospitalComparator({ records }: AdvancedHospitalComparatorProps) {
  // 1. Available Hospitals in Database (filtering out blank or 'TOTAL' lines)
  // Available Hospitals & Available Years (Calculated in a single fast loop)
  const { availableHospitals, availableYears } = useMemo(() => {
    const hospSet = new Set<string>();
    const yearSet = new Set<string>();
    const len = records.length;
    for (let i = 0; i < len; i++) {
      const r = records[i];
      const h = r.HOSPITAL;
      if (h && typeof h === "string") {
        const trimmed = h.trim();
        if (trimmed && !trimmed.toUpperCase().includes("TOTAL")) {
          hospSet.add(trimmed);
        }
      }
      if (r.SP_AA) {
        const y = r.SP_AA > 2000 ? r.SP_AA : 2000 + r.SP_AA;
        yearSet.add(String(y));
      } else if (r.SP_DTINTER) {
        const y = Math.floor(r.SP_DTINTER / 10000);
        if (y > 2000) yearSet.add(String(y));
      }
    }
    return {
      availableHospitals: Array.from(hospSet).sort(),
      availableYears: Array.from(yearSet).sort().reverse(),
    };
  }, [records]);

  // Default selection: Hospital A is HUCM / Ciências Médicas
  const defaultHospA = useMemo(() => {
    const found = availableHospitals.find(
      (h) => h.toUpperCase().includes("CIENCIAS MEDICAS") || h.toUpperCase().includes("HUCM")
    );
    return found || availableHospitals[0] || "";
  }, [availableHospitals]);

  // Default selection: Hospital B is another major competitor (Evangélico, Odete Valadares, Felício Rocho, etc.)
  const defaultHospB = useMemo(() => {
    const found = availableHospitals.find(
      (h) =>
        h !== defaultHospA &&
        (h.toUpperCase().includes("EVANGELICO") ||
          h.toUpperCase().includes("ODETE") ||
          h.toUpperCase().includes("FELICIO ROCHO") ||
          h.toUpperCase().includes("SANTA CASA"))
    );
    return found || availableHospitals.find((h) => h !== defaultHospA) || "";
  }, [availableHospitals, defaultHospA]);

  // State Filters
  const [hospitalA, setHospitalA] = useState<string>(defaultHospA);
  const [hospitalB, setHospitalB] = useState<string>(defaultHospB);
  const [selectedYear, setSelectedYear] = useState<string>("Todos");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [viewSection, setViewSection] = useState<"all" | "shared" | "exclusive">("all");

  // Período de Competência (do menor Mês/Ano ao maior)
  const competencePeriod = useMemo(() => {
    if (!records || records.length === 0) return null;
    let minCompVal = Infinity;
    let maxCompVal = -Infinity;
    let minYear = 2026;
    let minMonth = 1;
    let maxYear = 2026;
    let maxMonth = 1;
    let found = false;

    // Filter by selected year if specific year is selected
    const targetRecords = selectedYear === "Todos"
      ? records
      : records.filter((r) => {
          const yearInt = parseInt(selectedYear, 10);
          const rYear = r.SP_AA > 2000 ? r.SP_AA : (r.SP_AA ? 2000 + r.SP_AA : (r.SP_DTINTER ? Math.floor(r.SP_DTINTER / 10000) : null));
          return rYear === yearInt;
        });

    for (let i = 0; i < targetRecords.length; i++) {
      const record = targetRecords[i];
      let aa = Number(record.SP_AA);
      let mm = Number(record.SP_MM);

      if (aa > 0 && aa < 100) aa = 2000 + aa;

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
        found = true;
      }
    }

    if (!found) return null;

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const startFormatted = `${pad(minMonth)}/${minYear}`;
    const endFormatted = `${pad(maxMonth)}/${maxYear}`;
    const isSame = minYear === maxYear && minMonth === maxMonth;
    const label = isSame ? startFormatted : `${startFormatted} a ${endFormatted}`;

    return {
      startYear: minYear,
      startMonth: minMonth,
      endYear: maxYear,
      endMonth: maxMonth,
      startFormatted,
      endFormatted,
      isSame,
      label,
    };
  }, [records, selectedYear]);

  // Sorting states
  const [sortKeyShared, setSortKeyShared] = useState<SharedSortKey>("aihsA");
  const [sortDirShared, setSortDirShared] = useState<"asc" | "desc">("desc"); // Default "DO MAIOR PARA O MENOR"

  const [sortKeyExclusive, setSortKeyExclusive] = useState<ExclusiveSortKey>("totalFaturadoB");
  const [sortDirExclusive, setSortDirExclusive] = useState<"asc" | "desc">("desc"); // Default "DO MAIOR PARA O MENOR"

  // Modal detail states
  const [selectedProcedureForDetail, setSelectedProcedureForDetail] = useState<{
    code: string;
    name: string;
    aihsDetailsA?: DetailedAihItem[];
    aihsDetailsB: DetailedAihItem[];
    aihsA?: number;
    aihsB: number;
    avgTicketA?: number;
    avgTicketB: number;
    totalFaturadoA?: number;
    totalFaturadoB: number;
    utiDaysA?: number;
    utiDaysB?: number;
  } | null>(null);

  const [detailModalTab, setDetailModalTab] = useState<"both" | "hospA" | "hospB">("both");
  const [detailSearchTerm, setDetailSearchTerm] = useState<string>("");
  const [expandedAihNaihs, setExpandedAihNaihs] = useState<Set<number>>(new Set());

  // GAS Modal
  const [showGasModal, setShowGasModal] = useState<boolean>(false);
  const [copiedGasFile, setCopiedGasFile] = useState<string | null>(null);

  // Sorting handlers
  const handleSortShared = (key: SharedSortKey) => {
    if (sortKeyShared === key) {
      setSortDirShared((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKeyShared(key);
      setSortDirShared("desc"); // Default DO MAIOR PARA O MENOR as requested
    }
  };

  const handleSortExclusive = (key: ExclusiveSortKey) => {
    if (sortKeyExclusive === key) {
      setSortDirExclusive((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKeyExclusive(key);
      setSortDirExclusive("desc"); // Default DO MAIOR PARA O MENOR as requested
    }
  };

  // Toggle AIH acts expansion in modal
  const toggleAihActs = (naih: number) => {
    setExpandedAihNaihs((prev) => {
      const next = new Set(prev);
      if (next.has(naih)) {
        next.delete(naih);
      } else {
        next.add(naih);
      }
      return next;
    });
  };

  // 1. Estados das tabelas e cards (Preenchidos 100% via API Server-Side)
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dadosComparador, setDadosComparador] = useState<{
    sharedProcedures: ComparisonSharedProcedure[];
    exclusiveProcedures: ComparisonExclusiveProcedure[];
  }>({
    sharedProcedures: [],
    exclusiveProcedures: [],
  });

  const [cardsResumo, setCardsResumo] = useState<{
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
  }>({
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
  });

  const [serverCompetencePeriod, setServerCompetencePeriod] = useState<{
    startYear: number;
    startMonth: number;
    endYear: number;
    endMonth: number;
    startFormatted: string;
    endFormatted: string;
    isSame: boolean;
    label: string;
  } | null>(null);

  // Sincronização inicial dos filtros caso ainda não preenchidos
  useEffect(() => {
    if (!hospitalA && defaultHospA) {
      setHospitalA(defaultHospA);
    }
  }, [defaultHospA, hospitalA]);

  useEffect(() => {
    if (!hospitalB && defaultHospB) {
      setHospitalB(defaultHospB);
    }
  }, [defaultHospB, hospitalB]);

  // Função central de busca/processamento (Regra 2: 100% Server-Side SQL)
  const handleProcessComparison = async (
    targetA = hospitalA,
    targetB = hospitalB,
    targetYear = selectedYear
  ) => {
    if (!targetA || !targetB) return;
    setIsLoading(true);
    setIsProcessing(true);

    try {
      const params = new URLSearchParams({
        hospA: targetA,
        hospB: targetB,
        year: targetYear,
      });
      const res = await fetch(`/api/compare?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro ${res.status} ao consultar dados do comparador`);
      }
      const data = await res.json();

      // Regra 3: Atualização do Estado das Tabelas e Cards
      setDadosComparador({
        sharedProcedures: data.sharedProcedures || [],
        exclusiveProcedures: data.exclusiveProcedures || [],
      });

      if (data.summaryShared && data.summaryExclusive) {
        setCardsResumo({
          summaryShared: data.summaryShared,
          summaryExclusive: data.summaryExclusive,
        });
      }

      if (data.competencePeriod) {
        setServerCompetencePeriod(data.competencePeriod);
      }
    } catch (err) {
      console.error("Erro na busca de comparativo server-side:", err);
    } finally {
      setIsLoading(false);
      setIsProcessing(false);
    }
  };

  // Regra 1: Gatilho Automático (Auto-Fetch)
  // Observa os estados dos filtros (Hospital A, Hospital B, Ano).
  // Assim que recebem seus valores, dispara automaticamente a busca server-side.
  useEffect(() => {
    if (hospitalA && hospitalB) {
      handleProcessComparison(hospitalA, hospitalB, selectedYear);
    }
  }, [hospitalA, hospitalB, selectedYear]);



  // Filter & Sort Section 1 Table - Alimentada pelo estado retornado do Servidor SQL (Regra 3)
  const sortedAndFilteredShared = useMemo(() => {
    let list = dadosComparador.sharedProcedures;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)
      );
    }

    return [...list].sort((a, b) => {
      const valA = a[sortKeyShared];
      const valB = b[sortKeyShared];
      if (typeof valA === "string" && typeof valB === "string") {
        const cmp = valA.localeCompare(valB);
        return sortDirShared === "asc" ? cmp : -cmp;
      }
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortDirShared === "asc" ? numA - numB : numB - numA;
    });
  }, [dadosComparador.sharedProcedures, searchTerm, sortKeyShared, sortDirShared]);

  // Filter & Sort Section 2 Table - Alimentada pelo estado retornado do Servidor SQL (Regra 3)
  const sortedAndFilteredExclusive = useMemo(() => {
    let list = dadosComparador.exclusiveProcedures;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)
      );
    }

    return [...list].sort((a, b) => {
      const valA = a[sortKeyExclusive];
      const valB = b[sortKeyExclusive];
      if (typeof valA === "string" && typeof valB === "string") {
        const cmp = valA.localeCompare(valB);
        return sortDirExclusive === "asc" ? cmp : -cmp;
      }
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortDirExclusive === "asc" ? numA - numB : numB - numA;
    });
  }, [dadosComparador.exclusiveProcedures, searchTerm, sortKeyExclusive, sortDirExclusive]);

  // Summary Metrics lidas diretamente de cardsResumo retornado pelo Servidor SQL (Regra 3)
  const summaryShared = cardsResumo.summaryShared;
  const summaryExclusive = cardsResumo.summaryExclusive;

  // Período consolidado
  const effectiveCompetencePeriod = serverCompetencePeriod || competencePeriod;

  // Export Section 1 to CSV (Divided into two distinct columns per indicator, no Gap Potencial)
  const handleExportSharedCSV = () => {
    const data = sortedAndFilteredShared.map((p) => ({
      "Código": p.code,
      "Procedimento": p.name,
      [`Qtd AIHs (${hospitalA})`]: p.aihsA,
      [`Qtd AIHs (${hospitalB})`]: p.aihsB,
      [`Diárias UTI (${hospitalA})`]: p.utiDaysA,
      [`Diárias UTI (${hospitalB})`]: p.utiDaysB,
      [`Média Permanência Dias (${hospitalA})`]: p.avgPermanenceA.toFixed(1),
      [`Média Permanência Dias (${hospitalB})`]: p.avgPermanenceB.toFixed(1),
      [`Ticket Médio R$ (${hospitalA})`]: p.avgTicketA.toFixed(2),
      [`Ticket Médio R$ (${hospitalB})`]: p.avgTicketB.toFixed(2),
      [`Valor Faturado Total R$ (${hospitalA})`]: p.totalFaturadoA.toFixed(2),
      [`Valor Faturado Total R$ (${hospitalB})`]: p.totalFaturadoB.toFixed(2),
    }));
    const csv = Papa.unparse(data);
    downloadFile(csv, `comparativo_compartilhados_${cleanFilename(hospitalA)}_vs_${cleanFilename(hospitalB)}.csv`, "text/csv");
  };

  // Export Section 2 to CSV
  const handleExportExclusiveCSV = () => {
    const data = sortedAndFilteredExclusive.map((p) => ({
      "Código": p.code,
      "Procedimento": p.name,
      [`Qtd AIHs (${hospitalB})`]: p.aihsB,
      [`Diárias UTI (${hospitalB})`]: p.utiDaysB,
      [`Média Permanência Dias (${hospitalB})`]: p.avgPermanenceB.toFixed(1),
      [`Ticket Médio R$ (${hospitalB})`]: p.avgTicketB.toFixed(2),
      [`Valor Faturado Total R$ (${hospitalB})`]: p.totalFaturadoB.toFixed(2),
    }));
    const csv = Papa.unparse(data);
    downloadFile(csv, `oportunidades_exclusivas_${cleanFilename(hospitalB)}.csv`, "text/csv");
  };

  // Export Detailed AIHs from modal
  const handleExportDetailAIHs = () => {
    if (!selectedProcedureForDetail) return;
    const aihsA = selectedProcedureForDetail.aihsDetailsA || [];
    const aihsB = selectedProcedureForDetail.aihsDetailsB || [];

    const rows: any[] = [];
    aihsA.forEach((a) => {
      rows.push({
        "Hospital": hospitalA,
        "Código Procedimento": selectedProcedureForDetail.code,
        "Procedimento": selectedProcedureForDetail.name,
        "Número AIH": a.naih,
        "Valor Faturado R$": a.finalTicket.toFixed(2),
        "Diárias UTI": a.utiDays,
        "Dias Permanência": a.permanence,
        "Data Internação": a.dtInterFormatted || "",
        "Data Saída": a.dtSaidaFormatted || "",
        "Qtd Atos": a.acts.length,
      });
    });

    aihsB.forEach((b) => {
      rows.push({
        "Hospital": hospitalB,
        "Código Procedimento": selectedProcedureForDetail.code,
        "Procedimento": selectedProcedureForDetail.name,
        "Número AIH": b.naih,
        "Valor Faturado R$": b.finalTicket.toFixed(2),
        "Diárias UTI": b.utiDays,
        "Dias Permanência": b.permanence,
        "Data Internação": b.dtInterFormatted || "",
        "Data Saída": b.dtSaidaFormatted || "",
        "Qtd Atos": b.acts.length,
      });
    });

    const csv = Papa.unparse(rows);
    downloadFile(
      csv,
      `detalhamento_aihs_${cleanFilename(selectedProcedureForDetail.name)}.csv`,
      "text/csv"
    );
  };

  function cleanFilename(str: string): string {
    return str.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase().slice(0, 30);
  }

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob(["\uFEFF" + content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Copy code to clipboard helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedGasFile(label);
    setTimeout(() => setCopiedGasFile(null), 2500);
  };

  // Helper render sort indicator
  const renderSortIndicator = (currentKey: string, targetKey: string, currentDir: "asc" | "desc") => {
    if (currentKey !== targetKey) {
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 transition inline ml-1 shrink-0" />
      );
    }
    return currentDir === "desc" ? (
      <ArrowDown className="w-3.5 h-3.5 text-[#f3b924] inline ml-1 font-black shrink-0" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 text-[#f3b924] inline ml-1 font-black shrink-0" />
    );
  };

  // Filtered AIHs inside the Detail Modal
  const filteredModalAihsA = useMemo(() => {
    if (!selectedProcedureForDetail?.aihsDetailsA) return [];
    if (!detailSearchTerm.trim()) return selectedProcedureForDetail.aihsDetailsA;
    const term = detailSearchTerm.toLowerCase();
    return selectedProcedureForDetail.aihsDetailsA.filter(
      (a) =>
        String(a.naih).includes(term) ||
        a.acts.some((act) => act.actName.toLowerCase().includes(term) || String(act.actCode).includes(term))
    );
  }, [selectedProcedureForDetail, detailSearchTerm]);

  const filteredModalAihsB = useMemo(() => {
    if (!selectedProcedureForDetail?.aihsDetailsB) return [];
    if (!detailSearchTerm.trim()) return selectedProcedureForDetail.aihsDetailsB;
    const term = detailSearchTerm.toLowerCase();
    return selectedProcedureForDetail.aihsDetailsB.filter(
      (b) =>
        String(b.naih).includes(term) ||
        b.acts.some((act) => act.actName.toLowerCase().includes(term) || String(act.actCode).includes(term))
    );
  }, [selectedProcedureForDetail, detailSearchTerm]);

  return (
    <div id="advanced-hospital-comparator" className="space-y-6">
      {/* Top Filter Control Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#164194] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                Módulo Comparativo SIH/SUS
              </span>
              <span className="bg-[#f3b924]/15 text-[#8f5e0a] text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-[#f3b924]/30">
                Auditoria Customizada 1x1
              </span>
            </div>
            <h2 className="text-xl font-black text-[#0d2c68] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#164194]" />
              Comparador Avançado de Hospitais
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare a eficiência tarifária, volumetria de AIHs, diárias de UTI e permanência entre dois estabelecimentos de saúde. Clique no cabeçalho para reordenar (do maior para o menor) ou no nome do procedimento para abrir as AIH's.
            </p>
          </div>

          {/* Mostrador do Período de Competência (do menor Mês/Ano ao maior) */}
          {competencePeriod && (
            <div className="bg-gradient-to-r from-blue-50/90 via-amber-50/40 to-slate-50 border border-blue-200/80 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-2xs shrink-0 self-start lg:self-auto">
              <div className="w-9 h-9 rounded-lg bg-[#164194] text-white flex items-center justify-center shrink-0 shadow-3xs">
                <Calendar className="w-5 h-5 text-[#f3b924]" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span>Período de Competência</span>
                  <span className="text-[9px] font-bold text-[#164194] bg-blue-100/80 px-1.5 py-0.2 rounded font-sans">
                    {competencePeriod.isSame ? "Mês Único" : "Menor ao Maior"}
                  </span>
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs sm:text-sm font-black text-[#0d2c68] font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-3xs">
                    {competencePeriod.startFormatted}
                  </span>
                  {!competencePeriod.isSame && (
                    <>
                      <span className="text-slate-400 text-xs font-bold font-sans">a</span>
                      <span className="text-xs sm:text-sm font-black text-[#0d2c68] font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-3xs">
                        {competencePeriod.endFormatted}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
          {/* Hospital A */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#164194] mb-1.5 truncate" title={`1. ${hospitalA || "Hospital A"} (Sua Instituição)`}>
              1. {hospitalA || "Hospital A"} (Sua Instituição)
            </label>
            <div className="relative">
              <select
                id="select-hosp-a"
                value={hospitalA}
                onChange={(e) => setHospitalA(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0d2c68] focus:bg-white focus:border-[#164194] focus:ring-2 focus:ring-[#164194]/20 transition outline-hidden cursor-pointer"
              >
                {availableHospitals.map((h) => (
                  <option key={`a-${h}`} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hospital B */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5 truncate" title={`2. ${hospitalB || "Hospital B"} (Hospital de Comparação)`}>
              2. {hospitalB || "Hospital B"} (Hospital de Comparação)
            </label>
            <div className="relative">
              <select
                id="select-hosp-b"
                value={hospitalB}
                onChange={(e) => setHospitalB(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-[#164194] focus:ring-2 focus:ring-[#164194]/20 transition outline-hidden cursor-pointer"
              >
                {availableHospitals.map((h) => (
                  <option key={`b-${h}`} value={h} disabled={h === hospitalA}>
                    {h} {h === hospitalA ? "(Já selecionado em A)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ano */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              3. Ano de Competência
            </label>
            <div className="relative">
              <select
                id="select-ano"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#164194] focus:ring-2 focus:ring-[#164194]/20 transition outline-hidden cursor-pointer"
              >
                <option value="Todos">Todos os Anos</option>
                {availableYears.map((yr) => (
                  <option key={`yr-${yr}`} value={yr}>
                    Ano {yr}
                  </option>
                ))}
              </select>
            </div>
            {effectiveCompetencePeriod && (
              <span className="text-[10px] font-mono text-slate-500 mt-1 block truncate" title={`Período de Competência: ${effectiveCompetencePeriod.label}`}>
                Comp: <strong className="text-[#164194]">{effectiveCompetencePeriod.label}</strong>
              </span>
            )}
          </div>

          {/* Process Button */}
          <div className="md:col-span-2 flex items-end">
            <button
              id="btn-processar-comparacao"
              onClick={() => handleProcessComparison(hospitalA, hospitalB, selectedYear)}
              disabled={isLoading || isProcessing || !hospitalA || !hospitalB}
              className="w-full bg-[#164194] hover:bg-[#0f3675] active:bg-[#0c2a5c] text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isLoading || isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Cruzando...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 text-[#f3b924]" />
                  <span>Processar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Search & Rules Banner */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#164194] outline-hidden transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {effectiveCompetencePeriod && (
              <div className="flex items-center gap-1.5 bg-blue-50/80 border border-blue-200/70 text-[#164194] font-mono font-bold px-2.5 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-[#d99b26]" />
                <span>Competência: {effectiveCompetencePeriod.startFormatted} {!effectiveCompetencePeriod.isSame ? `a ${effectiveCompetencePeriod.endFormatted}` : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Linhas com <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-700">"TOTAL"</code> e em branco foram estritamente descartadas da base.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAINEL DE VISÃO GERAL EXECUTIVA & NAVEGAÇÃO ENTRE SEÇÕES */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {/* Banner com 2 Cards de Resumo Executivo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Compartilhados */}
          <div
            onClick={() => setViewSection("shared")}
            className={`rounded-2xl border p-5 transition cursor-pointer relative overflow-hidden ${
              viewSection === "shared"
                ? "bg-blue-50/70 border-[#164194] ring-2 ring-[#164194]/20 shadow-md"
                : "bg-white border-slate-200 hover:border-blue-300 shadow-xs"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="bg-[#164194] text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                    Seção 1 • Análise Tarifária
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Procedimentos Compartilhados
                  </span>
                </div>
                <h3 className="text-base font-black text-[#0d2c68] flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                  Maior Volume & Menor Ticket em {hospitalA}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Procedimentos onde o {hospitalA} atende mais AIHs, porém recebe um ticket médio menor que o {hospitalB}.
                </p>
              </div>
              <div className="text-right shrink-0 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 min-w-[96px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-1">
                    <div className="w-5 h-5 border-2 border-[#164194]/20 border-t-[#164194] rounded-full animate-spin" />
                    <span className="text-[9px] font-bold text-[#164194] mt-1">Calculando...</span>
                  </div>
                ) : (
                  <>
                    <span className="text-3xl font-black text-[#164194]">
                      {summaryShared.totalCount}
                    </span>
                    <span className="block text-[10px] uppercase font-bold text-slate-500">
                      procedimentos
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold truncate block" title={hospitalA}>AIHs em {hospitalA}</span>
                <div className="font-black text-[#164194]">
                  {isLoading ? <span className="text-slate-400 text-xs animate-pulse">...</span> : summaryShared.totalAihsA.toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold truncate block" title={hospitalB}>AIHs em {hospitalB}</span>
                <div className="font-extrabold text-slate-700">
                  {isLoading ? <span className="text-slate-400 text-xs animate-pulse">...</span> : summaryShared.totalAihsB.toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold truncate block" title={hospitalA}>Faturamento {hospitalA}</span>
                <div className="font-black text-slate-900">
                  {isLoading ? <span className="text-slate-400 text-xs animate-pulse">...</span> : `R$ ${formatVal(summaryShared.totalFaturadoA)}`}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Exclusivos do Concorrente (MÁXIMO DESTAQUE) */}
          <div
            onClick={() => setViewSection("exclusive")}
            className={`rounded-2xl border p-5 transition cursor-pointer relative overflow-hidden ${
              viewSection === "exclusive"
                ? "bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-500/20 shadow-md"
                : "bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30 border-emerald-300 hover:border-emerald-500 shadow-xs"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-2xs">
                    Seção 2 • Expansão Assistencial
                  </span>
                  <span className="text-xs text-emerald-800 font-bold">
                    Oportunidades Exclusivas
                  </span>
                </div>
                <h3 className="text-base font-black text-emerald-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Procedimentos Exclusivos de {hospitalB}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Procedimentos realizados pelo <strong className="text-emerald-900">{hospitalB}</strong> (Volume no {hospitalA} = 0).
                </p>
              </div>
              <div className="text-right shrink-0 bg-emerald-100/70 px-3 py-2 rounded-xl border border-emerald-200 min-w-[96px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-1">
                    <div className="w-5 h-5 border-2 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
                    <span className="text-[9px] font-bold text-emerald-800 mt-1">Calculando...</span>
                  </div>
                ) : (
                  <>
                    <span className="text-3xl font-black text-emerald-800">
                      {summaryExclusive.totalCount}
                    </span>
                    <span className="block text-[10px] uppercase font-bold text-emerald-700">
                      exclusivos
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-emerald-200/60 text-xs">
              <div className="bg-white/90 p-2 rounded-xl border border-emerald-200 shadow-2xs">
                <span className="text-[10px] text-amber-800 uppercase font-black">Ticket Médio Geral</span>
                <div className="font-black text-amber-900 text-sm">
                  {isLoading ? <span className="text-slate-400 text-xs animate-pulse">...</span> : `R$ ${formatVal(summaryExclusive.avgTicketGlobalB)}`}
                </div>
              </div>
              <div className="bg-white/90 p-2 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase font-semibold truncate block" title={hospitalB}>AIHs em {hospitalB}</span>
                <div className="font-black text-slate-900 text-sm">
                  {isLoading ? <span className="text-slate-400 text-xs animate-pulse">...</span> : summaryExclusive.totalAihsB.toLocaleString()}
                </div>
              </div>
              <div className="bg-white/90 p-2 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase font-semibold truncate block" title={hospitalB}>Faturado por {hospitalB}</span>
                <div className="font-black text-emerald-800 text-sm">
                  {isLoading ? <span className="text-slate-400 text-xs animate-pulse">...</span> : `R$ ${formatVal(summaryExclusive.totalFaturadoB)}`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Seleção de Visualização / Filtro de Abas */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setViewSection("all")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewSection === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Visão Completa (Ambas as Seções)</span>
            </button>
            <button
              onClick={() => setViewSection("shared")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewSection === "shared"
                  ? "bg-[#164194] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 text-[#f3b924]" />
              <span>1. Compartilhados ({summaryShared.totalCount})</span>
            </button>
            <button
              onClick={() => setViewSection("exclusive")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewSection === "exclusive"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>2. Exclusivos do Concorrente ({summaryExclusive.totalCount})</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium px-2">
            {viewSection === "exclusive" ? (
              <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                Exibindo {sortedAndFilteredExclusive.length} procedimentos exclusivos do {hospitalB}
              </span>
            ) : viewSection === "shared" ? (
              <span className="text-[#164194] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#164194] inline-block"></span>
                Exibindo {sortedAndFilteredShared.length} procedimentos compartilhados com desvantagem tarifária
              </span>
            ) : (
              <span>
                Total: {summaryShared.totalCount} compartilhados + {summaryExclusive.totalCount} exclusivos
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 1: Procedimentos Compartilhados (Hosp A com Maior Volume e Menor Ticket) */}
      {/* ========================================================================= */}
      {(viewSection === "all" || viewSection === "shared") && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header Seção 1 */}
        <div className="bg-gradient-to-r from-[#0d2c68] via-[#164194] to-[#1a4ba8] text-white p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-[#f3b924] text-[#0d2c68] text-[10px] font-black uppercase px-2 py-0.5 rounded">
                  Seção 1 • Análise Tarifária
                </span>
                <span className="text-[11px] text-blue-200 font-medium">
                  Procedimentos Compartilhados
                </span>
              </div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-rose-300" />
                Procedimentos com Maior Volume e Menor Ticket em {hospitalA}
              </h3>
              <p className="text-xs text-blue-100/90 max-w-3xl mt-1 leading-relaxed">
                Procedimentos realizados por ambos os hospitais onde o <strong className="text-white underline">{hospitalA}</strong> opera com <span className="text-[#f3b924] font-bold">maior quantidade de AIHs</span>, porém aufere um <span className="text-rose-300 font-bold">menor ticket médio</span> em comparação com o <strong className="text-white underline">{hospitalB}</strong>.
              </p>
            </div>

            <button
              onClick={handleExportSharedCSV}
              disabled={sortedAndFilteredShared.length === 0}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white border border-white/20 px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 self-start md:self-center disabled:opacity-40"
            >
              <Download className="w-4 h-4 text-[#f3b924]" />
              Exportar Tabela 1 (CSV)
            </button>
          </div>

          {/* Section 1 Metric Summary Cards (Cleaned, Gap Potencial card removed) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs">
              <span className="text-[10px] text-blue-200 uppercase font-semibold">Procedimentos Identificados</span>
              <div className="text-xl font-black text-white mt-0.5">
                {isLoading ? <span className="text-blue-200 text-base animate-pulse">Cruzando...</span> : summaryShared.totalCount}
              </div>
            </div>
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs">
              <span className="text-[10px] text-blue-200 uppercase font-semibold truncate block" title={hospitalA}>AIHs Executadas ({hospitalA})</span>
              <div className="text-xl font-black text-[#f3b924] mt-0.5">
                {isLoading ? <span className="text-blue-200 text-base animate-pulse">...</span> : summaryShared.totalAihsA.toLocaleString()}
              </div>
            </div>
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs">
              <span className="text-[10px] text-blue-200 uppercase font-semibold truncate block" title={hospitalB}>AIHs no Concorrente ({hospitalB})</span>
              <div className="text-xl font-black text-blue-200 mt-0.5">
                {isLoading ? <span className="text-blue-200 text-base animate-pulse">...</span> : summaryShared.totalAihsB.toLocaleString()}
              </div>
            </div>
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs">
              <span className="text-[10px] text-blue-200 uppercase font-semibold truncate block" title={hospitalA}>Faturamento Total ({hospitalA})</span>
              <div className="text-xl font-black text-white mt-0.5">
                {isLoading ? <span className="text-blue-200 text-base animate-pulse">...</span> : `R$ ${formatVal(summaryShared.totalFaturadoA)}`}
              </div>
            </div>
          </div>
        </div>

        {/* Section 1 Table - Divided in two columns per indicator, sorting enabled on header click, Gap Potencial removed */}
        <div className="overflow-x-auto overflow-y-auto max-h-[680px] border-t border-slate-200 relative">
          {isLoading ? (
            <div className="p-16 text-center flex flex-col items-center justify-center gap-3 bg-slate-50/50">
              <div className="w-8 h-8 border-3 border-[#164194]/20 border-t-[#164194] rounded-full animate-spin" />
              <div className="font-bold text-[#0d2c68] text-sm">
                Cruzando dados e calculando indicadores tarifários no servidor...
              </div>
              <p className="text-xs text-slate-500 max-w-md">
                Consultando o banco SQL central para {hospitalA} vs {hospitalB} ({selectedYear}). Os procedimentos compartilhados aparecerão aqui em instantes.
              </p>
            </div>
          ) : sortedAndFilteredShared.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 shadow-xs bg-white">
                {/* Tier 1 Header: Group Categories */}
                <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold border-b border-slate-200 uppercase tracking-wider select-none">
                  <th
                    rowSpan={2}
                    onClick={() => handleSortShared("name")}
                    className={`py-3 px-4 min-w-[280px] cursor-pointer hover:bg-slate-200 transition group border-r border-slate-200 bg-slate-100 ${
                      sortKeyShared === "name" ? "bg-slate-200 text-[#0d2c68]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Procedimento Principal</span>
                      {renderSortIndicator(sortKeyShared, "name", sortDirShared)}
                    </div>
                    <span className="block text-[9px] font-normal text-slate-500 normal-case mt-0.5">
                      (Clique no nome para detalhar AIH's)
                    </span>
                  </th>

                  {/* 1. Qtd. AIHs (Dividido em 2 colunas) */}
                  <th colSpan={2} className="py-2 px-2 text-center bg-blue-100/90 border-r border-slate-200">
                    <span className="text-[#164194] font-extrabold">Qtd. AIHs</span>
                  </th>

                  {/* 2. Diárias UTI (Dividido em 2 colunas) */}
                  <th colSpan={2} className="py-2 px-2 text-center bg-amber-100/90 border-r border-slate-200">
                    <span className="text-amber-900 font-extrabold">Diárias UTI</span>
                  </th>

                  {/* 3. Média Permanência (Dividido em 2 colunas) */}
                  <th colSpan={2} className="py-2 px-2 text-center bg-slate-100 border-r border-slate-200">
                    <span className="text-slate-800 font-extrabold">Média Permanência (Dias)</span>
                  </th>

                  {/* 4. Ticket Médio (Dividido em 2 colunas) */}
                  <th colSpan={2} className="py-2 px-2 text-center bg-rose-100/90 border-r border-slate-200">
                    <span className="text-rose-900 font-extrabold">Ticket Médio (R$)</span>
                  </th>

                  {/* 5. Valor Faturado Total (Dividido em 2 colunas) */}
                  <th colSpan={2} className="py-2 px-2 text-center bg-emerald-100/90">
                    <span className="text-emerald-950 font-extrabold">Valor Total Faturado (R$)</span>
                  </th>
                </tr>

                {/* Tier 2 Header: Distinct Hospital Columns */}
                <tr className="bg-slate-50 text-[10px] font-bold border-b-2 border-slate-300 uppercase tracking-wider select-none shadow-2xs">
                  {/* Qtd AIHs Sub-columns */}
                  <th
                    onClick={() => handleSortShared("aihsA")}
                    className={`py-2 px-2 text-center cursor-pointer transition border-r border-slate-200 ${
                      sortKeyShared === "aihsA" ? "bg-blue-150 text-[#164194] font-black" : "bg-blue-50/90 hover:bg-blue-100 text-[#164194]"
                    }`}
                    title={`Ordenar Qtd AIHs no ${hospitalA} do maior para o menor`}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span className="truncate max-w-[120px]" title={hospitalA}>{hospitalA}</span>
                      {renderSortIndicator(sortKeyShared, "aihsA", sortDirShared)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortShared("aihsB")}
                    className={`py-2 px-2 text-center cursor-pointer transition border-r border-slate-200 ${
                      sortKeyShared === "aihsB" ? "bg-slate-200 text-slate-900 font-black" : "bg-slate-100 hover:bg-slate-200/70 text-slate-600"
                    }`}
                    title={`Ordenar Qtd AIHs no ${hospitalB} do maior para o menor`}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span className="truncate max-w-[120px]" title={hospitalB}>{hospitalB}</span>
                      {renderSortIndicator(sortKeyShared, "aihsB", sortDirShared)}
                    </div>
                  </th>

                  {/* Diárias UTI Sub-columns */}
                  <th
                    onClick={() => handleSortShared("utiDaysA")}
                    className={`py-2 px-2 text-center cursor-pointer transition border-r border-slate-200 ${
                      sortKeyShared === "utiDaysA" ? "bg-amber-150 text-amber-900 font-black" : "bg-amber-50/90 hover:bg-amber-100 text-amber-800"
                    }`}
                    title={`Ordenar Diárias UTI no ${hospitalA} do maior para o menor`}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span className="truncate max-w-[120px]" title={hospitalA}>{hospitalA}</span>
                      {renderSortIndicator(sortKeyShared, "utiDaysA", sortDirShared)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortShared("utiDaysB")}
                    className={`py-2 px-2 text-center cursor-pointer transition border-r border-slate-200 ${
                      sortKeyShared === "utiDaysB" ? "bg-slate-200 text-slate-900 font-black" : "bg-slate-100 hover:bg-slate-200/70 text-slate-600"
                    }`}
                    title={`Ordenar Diárias UTI no ${hospitalB} do maior para o menor`}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span className="truncate max-w-[120px]" title={hospitalB}>{hospitalB}</span>
                      {renderSortIndicator(sortKeyShared, "utiDaysB", sortDirShared)}
                    </div>
                  </th>

                  {/* Permanência Sub-columns */}
                  <th
                    onClick={() => handleSortShared("avgPermanenceA")}
                    className={`py-2 px-2 text-center cursor-pointer transition border-r border-slate-200 ${
                      sortKeyShared === "avgPermanenceA" ? "bg-slate-200 text-slate-900 font-black" : "bg-slate-100 hover:bg-slate-200/70 text-slate-700"
                    }`}
                    title={`Ordenar Média Permanência no ${hospitalA} do maior para o menor`}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span className="truncate max-w-[120px]" title={hospitalA}>{hospitalA}</span>
                      {renderSortIndicator(sortKeyShared, "avgPermanenceA", sortDirShared)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortShared("avgPermanenceB")}
                    className={`py-2 px-2 text-center cursor-pointer transition border-r border-slate-200 ${
                      sortKeyShared === "avgPermanenceB" ? "bg-slate-200 text-slate-900 font-black" : "bg-slate-100 hover:bg-slate-200/70 text-slate-600"
                    }`}
                    title={`Ordenar Média Permanência no ${hospitalB} do maior para o menor`}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span className="truncate max-w-[120px]" title={hospitalB}>{hospitalB}</span>
                      {renderSortIndicator(sortKeyShared, "avgPermanenceB", sortDirShared)}
                    </div>
                  </th>

                  {/* Ticket Médio Sub-columns */}
                  <th
                    onClick={() => handleSortShared("avgTicketA")}
                    className={`py-2 px-2.5 text-right cursor-pointer transition border-r border-slate-200 ${
                      sortKeyShared === "avgTicketA" ? "bg-rose-150 text-rose-900 font-black" : "bg-rose-50/90 hover:bg-rose-100 text-rose-800"
                    }`}
                    title={`Ordenar Ticket Médio no ${hospitalA} do maior para o menor`}
                  >
                    <div className="flex items-center justify-end gap-0.5">
                      <span className="truncate max-w-[120px]" title={hospitalA}>{hospitalA}</span>
                      {renderSortIndicator(sortKeyShared, "avgTicketA", sortDirShared)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortShared("avgTicketB")}
                    className={`py-2 px-2.5 text-right cursor-pointer transition border-r border-slate-200 ${
                      sortKeyShared === "avgTicketB" ? "bg-emerald-150 text-emerald-950 font-black" : "bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800"
                    }`}
                    title={`Ordenar Ticket Médio no ${hospitalB} do maior para o menor`}
                  >
                    <div className="flex items-center justify-end gap-0.5">
                      <span className="truncate max-w-[120px]" title={hospitalB}>{hospitalB}</span>
                      {renderSortIndicator(sortKeyShared, "avgTicketB", sortDirShared)}
                    </div>
                  </th>

                  {/* Valor Faturado Sub-columns */}
                  <th
                    onClick={() => handleSortShared("totalFaturadoA")}
                    className={`py-2 px-2.5 text-right cursor-pointer transition border-r border-slate-200 ${
                      sortKeyShared === "totalFaturadoA" ? "bg-blue-150 text-[#164194] font-black" : "bg-blue-50/90 hover:bg-blue-100 text-slate-800"
                    }`}
                    title={`Ordenar Valor Faturado no ${hospitalA} do maior para o menor`}
                  >
                    <div className="flex items-center justify-end gap-0.5">
                      <span className="truncate max-w-[120px]" title={hospitalA}>{hospitalA}</span>
                      {renderSortIndicator(sortKeyShared, "totalFaturadoA", sortDirShared)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortShared("totalFaturadoB")}
                    className={`py-2 px-2.5 text-right cursor-pointer transition ${
                      sortKeyShared === "totalFaturadoB" ? "bg-slate-200 text-slate-900 font-black" : "bg-slate-100 hover:bg-slate-200/70 text-slate-700"
                    }`}
                    title={`Ordenar Valor Faturado no ${hospitalB} do maior para o menor`}
                  >
                    <div className="flex items-center justify-end gap-0.5">
                      <span className="truncate max-w-[120px]" title={hospitalB}>{hospitalB}</span>
                      {renderSortIndicator(sortKeyShared, "totalFaturadoB", sortDirShared)}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-800 font-sans">
                {sortedAndFilteredShared.map((item, idx) => (
                  <tr key={`shared-${item.name}-${idx}`} className="hover:bg-blue-50/30 transition font-sans group/row">
                    {/* Procedure Info with Interactive Detail Trigger */}
                    <td className="py-3 px-4 border-r border-slate-200">
                      <button
                        type="button"
                        onClick={() => setSelectedProcedureForDetail(item)}
                        className="text-left group cursor-pointer w-full focus:outline-hidden"
                        title="Clique no procedimento para abrir detalhamento das AIH's por Hospital"
                      >
                        <div className="font-bold text-slate-900 group-hover:text-[#164194] group-hover:underline transition flex items-baseline gap-1.5 leading-snug">
                          <span>{item.name}</span>
                          <Layers className="w-3.5 h-3.5 text-[#164194] opacity-0 group-hover:opacity-100 transition shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-slate-500">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-700">
                            {item.code}
                          </span>
                          <span className="text-[#164194] font-semibold flex items-center gap-1">
                            • Ver {item.aihsA + item.aihsB} AIH's
                          </span>
                        </div>
                      </button>
                    </td>

                    {/* Qtd AIHs Hosp A */}
                    <td className="py-3 px-2 text-center font-mono border-r border-slate-200 bg-blue-50/20">
                      <span className="font-black text-[#164194] bg-blue-100/70 px-2.5 py-0.5 rounded-md text-xs">
                        {item.aihsA}
                      </span>
                    </td>

                    {/* Qtd AIHs Hosp B */}
                    <td className="py-3 px-2 text-center font-mono border-r border-slate-200 bg-slate-50/20">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md text-xs">
                        {item.aihsB}
                      </span>
                    </td>

                    {/* Diárias UTI Hosp A */}
                    <td className="py-3 px-2 text-center font-mono border-r border-slate-200">
                      <span className={`font-semibold ${item.utiDaysA > 0 ? "text-amber-700 font-bold" : "text-slate-400"}`}>
                        {item.utiDaysA}
                      </span>
                    </td>

                    {/* Diárias UTI Hosp B */}
                    <td className="py-3 px-2 text-center font-mono border-r border-slate-200">
                      <span className={`font-semibold ${item.utiDaysB > 0 ? "text-indigo-700 font-bold" : "text-slate-400"}`}>
                        {item.utiDaysB}
                      </span>
                    </td>

                    {/* Média Permanência Hosp A */}
                    <td className="py-3 px-2 text-center font-mono border-r border-slate-200 text-xs font-bold text-slate-800">
                      {item.avgPermanenceA.toFixed(1)}d
                    </td>

                    {/* Média Permanência Hosp B */}
                    <td className="py-3 px-2 text-center font-mono border-r border-slate-200 text-xs text-slate-600">
                      {item.avgPermanenceB.toFixed(1)}d
                    </td>

                    {/* Ticket Médio Hosp A */}
                    <td className="py-3 px-2.5 text-right font-mono border-r border-slate-200 bg-amber-50/20">
                      <span className="font-bold text-rose-700">
                        R$ {formatVal(item.avgTicketA)}
                      </span>
                    </td>

                    {/* Ticket Médio Hosp B */}
                    <td className="py-3 px-2.5 text-right font-mono border-r border-slate-200 bg-emerald-50/20">
                      <span className="font-bold text-emerald-700">
                        R$ {formatVal(item.avgTicketB)}
                      </span>
                    </td>

                    {/* Total Faturado Hosp A */}
                    <td className="py-3 px-2.5 text-right font-mono border-r border-slate-200 bg-blue-50/10">
                      <span className="font-bold text-slate-900">
                        R$ {formatVal(item.totalFaturadoA)}
                      </span>
                    </td>

                    {/* Total Faturado Hosp B */}
                    <td className="py-3 px-2.5 text-right font-mono bg-slate-50/10">
                      <span className="text-slate-700 font-medium">
                        R$ {formatVal(item.totalFaturadoB)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-bold text-slate-700 text-sm">
                Nenhum procedimento com desvantagem tarifária encontrado.
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Para os filtros aplicados, o {hospitalA} não apresenta procedimentos simultâneos onde tenha maior volume e menor ticket médio em relação ao {hospitalB}.
              </p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* SEÇÃO 2: Oportunidades Exclusivas (Realizados apenas no Hospital B) */}
      {/* ========================================================================= */}
      {(viewSection === "all" || viewSection === "exclusive") && (
      <div id="secao-2-exclusivos" className="bg-white rounded-2xl border-2 border-emerald-200/80 shadow-md overflow-hidden">
        {/* Header Seção 2 */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="bg-emerald-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-2xs">
                  Seção 2 • Expansão Assistencial
                </span>
                <span className="bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                  {summaryExclusive.totalCount} Procedimentos Exclusivos Identificados
                </span>
                <span className="text-[11px] text-slate-300 font-medium">
                  Realizados apenas no {hospitalB} (Volume no {hospitalA} = 0)
                </span>
              </div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Procedimentos Exclusivos de {hospitalB}
              </h3>
              <p className="text-xs text-slate-300 max-w-3xl mt-1 leading-relaxed">
                Linhas de cuidado, cirurgias e procedimentos que foram faturados pelo <strong className="text-white underline">{hospitalB}</strong>, mas que <span className="text-rose-300 font-bold">NÃO foram realizados</span> pelo <strong className="text-white underline">{hospitalA}</strong> no período filtrado. Clique no procedimento para inspecionar as AIH's.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-center">
              {/* Quick sorting shortcuts for exclusive table */}
              <button
                type="button"
                onClick={() => {
                  setSortKeyExclusive("avgTicketB");
                  setSortDirExclusive("desc");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                  sortKeyExclusive === "avgTicketB"
                    ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs"
                    : "bg-white/10 hover:bg-white/20 text-slate-200 border-white/10"
                }`}
                title="Ordenar por maior Ticket Médio"
              >
                Maior Ticket Médio ↓
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortKeyExclusive("totalFaturadoB");
                  setSortDirExclusive("desc");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                  sortKeyExclusive === "totalFaturadoB"
                    ? "bg-emerald-500 text-white border-emerald-400 font-black shadow-xs"
                    : "bg-white/10 hover:bg-white/20 text-slate-200 border-white/10"
                }`}
                title="Ordenar por maior Faturamento"
              >
                Maior Faturamento ↓
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortKeyExclusive("aihsB");
                  setSortDirExclusive("desc");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                  sortKeyExclusive === "aihsB"
                    ? "bg-indigo-500 text-white border-indigo-400 font-black shadow-xs"
                    : "bg-white/10 hover:bg-white/20 text-slate-200 border-white/10"
                }`}
                title="Ordenar por quantidade de AIHs"
              >
                Qtd. AIHs ↓
              </button>

              <button
                onClick={handleExportExclusiveCSV}
                disabled={sortedAndFilteredExclusive.length === 0}
                className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white border border-white/20 px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                CSV
              </button>
            </div>
          </div>

          {/* Section 2 Metric Summary Cards with Highlighted Total Count and Average Ticket */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-white/10">
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs border border-white/10">
              <span className="text-[10px] text-slate-300 uppercase font-semibold">Procedimentos Exclusivos</span>
              <div className="text-2xl font-black text-white mt-0.5">
                {isLoading ? <span className="text-slate-300 text-base animate-pulse">Cruzando...</span> : summaryExclusive.totalCount}
              </div>
            </div>
            <div className="bg-amber-400/20 border border-amber-300/30 p-3 rounded-xl backdrop-blur-xs">
              <span className="text-[10px] text-amber-200 uppercase font-black truncate block" title={hospitalB}>Ticket Médio Geral ({hospitalB})</span>
              <div className="text-2xl font-black text-amber-300 mt-0.5">
                {isLoading ? <span className="text-amber-200 text-base animate-pulse">...</span> : `R$ ${formatVal(summaryExclusive.avgTicketGlobalB)}`}
              </div>
            </div>
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs border border-white/10">
              <span className="text-[10px] text-slate-300 uppercase font-semibold truncate block" title={hospitalB}>AIHs em {hospitalB}</span>
              <div className="text-xl font-black text-emerald-400 mt-0.5">
                {isLoading ? <span className="text-slate-300 text-base animate-pulse">...</span> : summaryExclusive.totalAihsB.toLocaleString()}
              </div>
            </div>
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-xs border border-white/10">
              <span className="text-[10px] text-slate-300 uppercase font-semibold">Diárias UTI Faturadas</span>
              <div className="text-xl font-black text-slate-200 mt-0.5">
                {isLoading ? <span className="text-slate-300 text-base animate-pulse">...</span> : summaryExclusive.totalUtiB.toLocaleString()}
              </div>
            </div>
            <div className="bg-emerald-500/20 border border-emerald-400/30 p-3 rounded-xl backdrop-blur-xs col-span-2 sm:col-span-1">
              <span className="text-[10px] text-emerald-300 uppercase font-bold">Faturamento Capturado</span>
              <div className="text-xl font-black text-emerald-300 mt-0.5">
                {isLoading ? <span className="text-emerald-200 text-base animate-pulse">...</span> : `R$ ${formatVal(summaryExclusive.totalFaturadoB)}`}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 Table - Sortable on header click with Highlighted Ticket Médio and # ranking column */}
        <div className="overflow-x-auto overflow-y-auto max-h-[680px] border-t border-slate-200 relative">
          {isLoading ? (
            <div className="p-16 text-center flex flex-col items-center justify-center gap-3 bg-emerald-50/30">
              <div className="w-8 h-8 border-3 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
              <div className="font-bold text-emerald-950 text-sm">
                Cruzando bases e identificando oportunidades exclusivas no servidor...
              </div>
              <p className="text-xs text-slate-500 max-w-md">
                Consultando o banco SQL central para identificar procedimentos realizados por {hospitalB} com volume zero em {hospitalA}.
              </p>
            </div>
          ) : sortedAndFilteredExclusive.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 shadow-xs bg-white">
                <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold border-b-2 border-slate-300 uppercase tracking-wider select-none shadow-2xs">
                  <th className="py-3 px-3 text-center w-12 font-bold text-slate-500 border-r border-slate-200 bg-slate-100">
                    #
                  </th>
                  <th
                    onClick={() => handleSortExclusive("name")}
                    className="py-3 px-4 min-w-[280px] cursor-pointer hover:bg-slate-200 transition border-r border-slate-200 bg-slate-100"
                  >
                    <div className="flex items-center justify-between">
                      <span>Código e Descrição do Procedimento</span>
                      {renderSortIndicator(sortKeyExclusive, "name", sortDirExclusive)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortExclusive("aihsB")}
                    className="py-3 px-4 text-center cursor-pointer hover:bg-slate-200 transition border-r border-slate-200 bg-slate-100"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Qtd. AIHs ({hospitalB})</span>
                      {renderSortIndicator(sortKeyExclusive, "aihsB", sortDirExclusive)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortExclusive("utiDaysB")}
                    className="py-3 px-4 text-center cursor-pointer hover:bg-slate-200 transition border-r border-slate-200 bg-slate-100"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Total Diárias UTI</span>
                      {renderSortIndicator(sortKeyExclusive, "utiDaysB", sortDirExclusive)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortExclusive("avgPermanenceB")}
                    className="py-3 px-4 text-center cursor-pointer hover:bg-slate-200 transition border-r border-slate-200 bg-slate-100"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Média Permanência</span>
                      {renderSortIndicator(sortKeyExclusive, "avgPermanenceB", sortDirExclusive)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortExclusive("avgTicketB")}
                    className={`py-3 px-4 text-right cursor-pointer transition border-r border-slate-200 ${
                      sortKeyExclusive === "avgTicketB"
                        ? "bg-amber-150 text-amber-950 font-black"
                        : "bg-amber-100/90 hover:bg-amber-150 text-amber-950"
                    }`}
                    title="Clique para reordenar por Ticket Médio do maior para o menor"
                  >
                    <div className="flex items-center justify-end gap-1 font-black">
                      <span>Ticket Médio (R$)</span>
                      {renderSortIndicator(sortKeyExclusive, "avgTicketB", sortDirExclusive)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortExclusive("totalFaturadoB")}
                    className="py-3 px-4 text-right bg-emerald-100 font-black text-emerald-950 cursor-pointer hover:bg-emerald-200 transition"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Valor Total Faturado (R$)</span>
                      {renderSortIndicator(sortKeyExclusive, "totalFaturadoB", sortDirExclusive)}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-sans">
                {sortedAndFilteredExclusive.map((item, idx) => (
                  <tr key={`exclusive-${item.name}-${idx}`} className="hover:bg-slate-50/80 transition">
                    {/* Index Ranking # */}
                    <td className="py-3.5 px-3 text-center font-mono text-xs font-bold text-slate-400 border-r border-slate-200 bg-slate-50/50">
                      #{idx + 1}
                    </td>

                    {/* Procedure Info with Interactive Detail Trigger */}
                    <td className="py-3.5 px-4 border-r border-slate-200">
                      <button
                        type="button"
                        onClick={() => setSelectedProcedureForDetail(item)}
                        className="text-left group cursor-pointer w-full focus:outline-hidden"
                        title={`Clique no procedimento para abrir detalhamento das AIH's de ${hospitalB}`}
                      >
                        <div className="font-bold text-slate-900 group-hover:text-[#164194] group-hover:underline transition flex items-baseline gap-1.5 leading-snug">
                          <span>{item.name}</span>
                          <Layers className="w-3.5 h-3.5 text-[#164194] opacity-0 group-hover:opacity-100 transition shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-slate-500">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-700">
                            {item.code}
                          </span>
                          <span className="text-rose-600 font-semibold">• Ausente no {hospitalA} (0 AIH)</span>
                          <span className="text-[#164194] font-semibold">• Ver {item.aihsB} AIH's</span>
                        </div>
                      </button>
                    </td>

                    {/* Qtd AIHs Hosp B */}
                    <td className="py-3.5 px-4 text-center font-mono border-r border-slate-200">
                      <span className="bg-indigo-50 text-indigo-900 font-black px-2.5 py-1 rounded-lg text-xs">
                        {item.aihsB} AIHs
                      </span>
                    </td>

                    {/* Total Diarias UTI Hosp B */}
                    <td className="py-3.5 px-4 text-center font-mono border-r border-slate-200">
                      <span className={`font-semibold ${item.utiDaysB > 0 ? "text-amber-700 font-bold" : "text-slate-400"}`}>
                        {item.utiDaysB > 0 ? `${item.utiDaysB} diárias` : "0"}
                      </span>
                    </td>

                    {/* Media Permanencia Hosp B */}
                    <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-700 font-bold border-r border-slate-200">
                      {item.avgPermanenceB.toFixed(1)} dias
                    </td>

                    {/* Ticket Medio Hosp B - HIGHLIGHTED */}
                    <td className="py-3.5 px-4 text-right font-mono border-r border-slate-200 bg-amber-50/40">
                      <span className="inline-block bg-amber-100 text-amber-950 font-black px-2.5 py-1 rounded-lg text-xs border border-amber-200/80 shadow-2xs">
                        R$ {formatVal(item.avgTicketB)}
                      </span>
                    </td>

                    {/* Valor Total Faturado Hosp B */}
                    <td className="py-3.5 px-4 text-right bg-emerald-50/30 font-mono">
                      <span className="font-black text-emerald-800 text-xs">
                        R$ {formatVal(item.totalFaturadoB)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="font-bold text-slate-700 text-sm">
                Nenhum procedimento exclusivo encontrado no concorrente.
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Todos os procedimentos faturados por {hospitalB} no período também foram realizados por {hospitalA}.
              </p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Detalhamento de AIH's agrupadas por Hospital (Valores do Maior p/ Menor) */}
      {/* ========================================================================= */}
      {selectedProcedureForDetail && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-[#0d2c68] text-white px-5 py-4 border-b border-blue-900/50 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-[#f3b924] text-[#0d2c68] text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono">
                    {selectedProcedureForDetail.code}
                  </span>
                  <span className="text-[11px] text-blue-200 font-semibold uppercase tracking-wider">
                    Detalhamento de AIH's por Hospital
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white leading-snug">
                  {selectedProcedureForDetail.name}
                </h3>
                <p className="text-[11px] text-blue-200/90 font-medium">
                  AIH's individuais agrupadas por hospital e ordenadas rigorosamente do <strong className="text-[#f3b924]">maior valor para o menor</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProcedureForDetail(null)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition cursor-pointer shrink-0"
                title="Fechar detalhamento"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-Bar: Filter tabs and Search */}
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDetailModalTab("both")}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                    detailModalTab === "both"
                      ? "bg-white text-[#164194] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Ambos Hospitais (Lado a Lado)
                </button>
                {selectedProcedureForDetail.aihsDetailsA && selectedProcedureForDetail.aihsDetailsA.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDetailModalTab("hospA")}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                      detailModalTab === "hospA"
                        ? "bg-[#164194] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {hospitalA} ({selectedProcedureForDetail.aihsDetailsA.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailModalTab("hospB")}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                    detailModalTab === "hospB"
                      ? "bg-slate-800 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {hospitalB} ({selectedProcedureForDetail.aihsDetailsB.length})
                </button>
              </div>

              {/* Search AIH & Export */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filtrar por Nº AIH ou ato..."
                    value={detailSearchTerm}
                    onChange={(e) => setDetailSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#164194] outline-hidden"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportDetailAIHs}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer shadow-2xs whitespace-nowrap"
                  title="Exportar AIH's deste procedimento para planilha CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar AIH's (CSV)</span>
                </button>
              </div>
            </div>

            {/* Modal Body: AIH Listings Grouped by Hospital */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-100/50 space-y-4">
              <div className={`grid gap-5 ${detailModalTab === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
                {/* Column 1: Hospital A AIHs (if applicable) */}
                {(detailModalTab === "both" || detailModalTab === "hospA") && (
                  <div className="bg-white rounded-xl border border-blue-200/80 shadow-xs overflow-hidden flex flex-col">
                    {/* Hospital A Header */}
                    <div className="bg-blue-50/80 px-4 py-3 border-b border-blue-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#164194] bg-blue-100/80 px-2 py-0.5 rounded truncate max-w-[280px] inline-block" title={hospitalA}>
                          {hospitalA} • SUA INSTITUIÇÃO
                        </span>
                        <h4 className="font-black text-slate-900 text-sm mt-0.5">{hospitalA}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-[#164194]">
                          {filteredModalAihsA.length} AIH's
                        </span>
                        {selectedProcedureForDetail.avgTicketA && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Ticket Médio: <strong className="text-slate-800">R$ {formatVal(selectedProcedureForDetail.avgTicketA)}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Table of AIHs for Hospital A */}
                    <div className="overflow-x-auto overflow-y-auto flex-1 max-h-[500px] border border-slate-200 rounded-lg">
                      {filteredModalAihsA.length > 0 ? (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 text-[10px] text-slate-700 font-bold uppercase sticky top-0 border-b border-slate-200 z-10 shadow-xs">
                            <tr>
                              <th className="py-2.5 px-3 bg-slate-100">#</th>
                              <th className="py-2.5 px-3 font-mono bg-slate-100">Número AIH</th>
                              <th className="py-2.5 px-3 text-right font-mono text-[#164194] bg-slate-100">
                                Valor AIH (R$) ↓
                              </th>
                              <th className="py-2.5 px-3 text-center bg-slate-100">UTI</th>
                              <th className="py-2.5 px-3 text-center bg-slate-100">Perm.</th>
                              <th className="py-2.5 px-3 text-center bg-slate-100">Período</th>
                              <th className="py-2.5 px-2 text-center bg-slate-100">Atos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans">
                            {filteredModalAihsA.map((aih, aihIdx) => {
                              const isExpanded = expandedAihNaihs.has(aih.naih);
                              return (
                                <tr key={`aiha-${aih.naih}-${aihIdx}`} className="hover:bg-blue-50/30 transition">
                                  <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                                    #{aihIdx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                    {aih.naih}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-black text-[#164194]">
                                    R$ {formatVal(aih.finalTicket)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    {aih.utiDays > 0 ? (
                                      <span className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                        {aih.utiDays}d UTI
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                                    {aih.permanence}d
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-[10px] font-mono text-slate-500 whitespace-nowrap">
                                    {aih.dtInterFormatted} → {aih.dtSaidaFormatted}
                                  </td>
                                  <td className="py-2.5 px-2 text-center">
                                    {aih.acts && aih.acts.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => toggleAihActs(aih.naih)}
                                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                      >
                                        {isExpanded ? "Ocultar" : `${aih.acts.length} atos`}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          {selectedProcedureForDetail.aihsDetailsA && selectedProcedureForDetail.aihsDetailsA.length === 0
                            ? `Nenhuma AIH realizada em ${hospitalA} para este procedimento.`
                            : "Nenhuma AIH encontrada para o termo pesquisado."}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Column 2: Hospital B AIHs */}
                {(detailModalTab === "both" || detailModalTab === "hospB") && (
                  <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden flex flex-col">
                    {/* Hospital B Header */}
                    <div className="bg-slate-100/90 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 bg-slate-200 px-2 py-0.5 rounded truncate max-w-[280px] inline-block" title={hospitalB}>
                          {hospitalB} • COMPARADO
                        </span>
                        <h4 className="font-black text-slate-900 text-sm mt-0.5">{hospitalB}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-800">
                          {filteredModalAihsB.length} AIH's
                        </span>
                        {selectedProcedureForDetail.avgTicketB && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Ticket Médio: <strong className="text-emerald-700">R$ {formatVal(selectedProcedureForDetail.avgTicketB)}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Table of AIHs for Hospital B */}
                    <div className="overflow-x-auto overflow-y-auto flex-1 max-h-[500px] border border-slate-200 rounded-lg">
                      {filteredModalAihsB.length > 0 ? (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 text-[10px] text-slate-700 font-bold uppercase sticky top-0 border-b border-slate-200 z-10 shadow-xs">
                            <tr>
                              <th className="py-2.5 px-3 bg-slate-100">#</th>
                              <th className="py-2.5 px-3 font-mono bg-slate-100">Número AIH</th>
                              <th className="py-2.5 px-3 text-right font-mono text-emerald-800 bg-slate-100">
                                Valor AIH (R$) ↓
                              </th>
                              <th className="py-2.5 px-3 text-center bg-slate-100">UTI</th>
                              <th className="py-2.5 px-3 text-center bg-slate-100">Perm.</th>
                              <th className="py-2.5 px-3 text-center bg-slate-100">Período</th>
                              <th className="py-2.5 px-2 text-center bg-slate-100">Atos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans">
                            {filteredModalAihsB.map((aih, aihIdx) => {
                              const isExpanded = expandedAihNaihs.has(aih.naih);
                              return (
                                <tr key={`aihb-${aih.naih}-${aihIdx}`} className="hover:bg-slate-50 transition">
                                  <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                                    #{aihIdx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                    {aih.naih}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800">
                                    R$ {formatVal(aih.finalTicket)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    {aih.utiDays > 0 ? (
                                      <span className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                        {aih.utiDays}d UTI
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                                    {aih.permanence}d
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-[10px] font-mono text-slate-500 whitespace-nowrap">
                                    {aih.dtInterFormatted} → {aih.dtSaidaFormatted}
                                  </td>
                                  <td className="py-2.5 px-2 text-center">
                                    {aih.acts && aih.acts.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => toggleAihActs(aih.naih)}
                                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                      >
                                        {isExpanded ? "Ocultar" : `${aih.acts.length} atos`}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          Nenhuma AIH encontrada para os filtros aplicados.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Pressione <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200">ESC</kbd> ou clique fora para fechar.
              </span>
              <button
                type="button"
                onClick={() => setSelectedProcedureForDetail(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                Fechar Detalhamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Visualizador e Exportador de Código Google Apps Script */}
      {/* ========================================================================= */}
      {showGasModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#0d2c68] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Code2 className="w-5 h-5 text-[#f3b924]" />
                <div>
                  <h3 className="font-bold text-base text-white">Código Completo Google Apps Script</h3>
                  <p className="text-xs text-blue-200">
                    Arquivos prontos para implantação no editor de scripts do Google Sheets / Google Workspace
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGasModal(false)}
                className="text-white/80 hover:text-white text-xl font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body with Two Tabs: Código.gs & Index.html */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {/* File 1: Código.gs */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                  <span className="font-mono font-bold text-slate-800 text-xs">
                    📄 Código.gs (Backend Google Apps Script)
                  </span>
                  <button
                    onClick={() => handleCopy(SAMPLE_CODIGO_GS, "gs")}
                    className="inline-flex items-center gap-1.5 bg-[#164194] hover:bg-[#0f3675] text-white px-3 py-1 rounded-md font-semibold text-[11px] transition cursor-pointer"
                  >
                    {copiedGasFile === "gs" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedGasFile === "gs" ? "Copiado!" : "Copiar Código.gs"}
                  </button>
                </div>
                <div className="bg-slate-900 p-4 overflow-x-auto max-h-60 text-slate-200 font-mono text-[11px] leading-relaxed">
                  <pre>{SAMPLE_CODIGO_GS}</pre>
                </div>
              </div>

              {/* File 2: Index.html */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                  <span className="font-mono font-bold text-slate-800 text-xs">
                    📄 Index.html (Frontend HTML5 & Bootstrap)
                  </span>
                  <button
                    onClick={() => handleCopy(SAMPLE_INDEX_HTML, "html")}
                    className="inline-flex items-center gap-1.5 bg-[#164194] hover:bg-[#0f3675] text-white px-3 py-1 rounded-md font-semibold text-[11px] transition cursor-pointer"
                  >
                    {copiedGasFile === "html" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedGasFile === "html" ? "Copiado!" : "Copiar Index.html"}
                  </button>
                </div>
                <div className="bg-slate-900 p-4 overflow-x-auto max-h-60 text-slate-200 font-mono text-[11px] leading-relaxed">
                  <pre>{SAMPLE_INDEX_HTML}</pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowGasModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer transition"
              >
                Fechar Visualizador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sample implementation strings for Google Apps Script export
export const SAMPLE_CODIGO_GS = `/**
 * BACKEND GOOGLE APPS SCRIPT - AUDITORIA E COMPARADOR AVANÇADO DE HOSPITAIS (SIH/SUS)
 * Projeto: Hospital Universitário Ciências Médicas (HUCM / FELUMA)
 */

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Comparador Avançado de Hospitais - FELUMA / HUCM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Retorna lista única de hospitais da planilha ativa desconsiderando linhas totalizadoras.
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
 * Processa a comparação analítica entre Hospital A e Hospital B.
 * Retorna as AIHs detalhadas de cada procedimento ordenadas do maior para o menor valor.
 */
function processarComparacao(hospitalA, hospitalB, anoFilter) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { shared: [], exclusive: [], error: "Planilha sem registros." };
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

  const sharedList = [];
  const exclusiveList = [];

  for (const procName in procMap) {
    const entry = procMap[procName];

    // Agregação Hospital A e ordenação de AIHs do maior para o menor
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

    // Agregação Hospital B e ordenação de AIHs do maior para o menor
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

    // SEÇÃO 1: Compartilhados (Hosp A com maior volume e menor ticket)
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

function parseNumeroMoeda(val) {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const clean = String(val).replace(/\\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

function parseDataSUS(dtVal) {
  if (!dtVal) return null;
  if (dtVal instanceof Date) return dtVal;
  const str = String(dtVal).replace(/\\D/g, "");
  if (str.length === 8) {
    const y = parseInt(str.substring(0, 4), 10);
    const m = parseInt(str.substring(4, 6), 10) - 1;
    const d = parseInt(str.substring(6, 8), 10);
    return new Date(y, m, d);
  }
  return null;
}
`;

export const SAMPLE_INDEX_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comparador Avançado de Hospitais - FELUMA / HUCM</title>
  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root {
      --feluma-blue: #164194;
      --feluma-gold: #f3b924;
      --feluma-navy: #0d2c68;
    }
    body { background-color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; }
    .header-bar { background-color: var(--feluma-navy); color: white; border-bottom: 3px solid var(--feluma-gold); }
    .btn-feluma { background-color: var(--feluma-blue); color: white; font-weight: 700; }
    .btn-feluma:hover { background-color: #0d2f66; color: white; }
    .card-custom { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .table-responsive { max-height: 680px; overflow-y: auto; }
    thead.table-light { position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
    thead.table-light th { background-color: #f1f5f9; }
    th.sortable { cursor: pointer; user-select: none; }
    th.sortable:hover { background-color: #e2e8f0; }
    .pointer { cursor: pointer; }
  </style>
</head>
<body class="p-3">
  <div class="container-fluid">
    <!-- Cabeçalho Analítico -->
    <div class="header-bar p-3 rounded mb-4 d-flex justify-content-between align-items-center">
      <div>
        <h4 class="mb-0 fw-bold">HOSPITAL UNIVERSITÁRIO CIÊNCIAS MÉDICAS (HUCM)</h4>
        <small class="text-warning">Comparador Avançado de Hospitais (SIH/SUS) • Detalhamento de AIH's</small>
      </div>
      <span class="badge bg-light text-dark fw-bold px-3 py-2">FELUMA</span>
    </div>

    <!-- Painel de Filtros -->
    <div class="card card-custom mb-4 bg-white">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label fw-bold text-primary text-uppercase small" id="lblHospAField">1. <span id="labelHospA">Hospital A</span> (Sua Instituição)</label>
            <select id="hospA" class="form-select" onchange="if(document.getElementById('labelHospA')) document.getElementById('labelHospA').innerText = this.value || 'Hospital A';"></select>
          </div>
          <div class="col-md-4">
            <label class="form-label fw-bold text-secondary text-uppercase small" id="lblHospBField">2. <span id="labelHospB">Hospital B</span> (Hospital de Comparação)</label>
            <select id="hospB" class="form-select" onchange="if(document.getElementById('labelHospB')) document.getElementById('labelHospB').innerText = this.value || 'Hospital B';"></select>
          </div>
          <div class="col-md-2">
            <label class="form-label fw-bold text-secondary text-uppercase small">3. Ano</label>
            <select id="anoSelect" class="form-select">
              <option value="Todos">Todos os Anos</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <button onclick="executarComparacao()" class="btn btn-feluma w-100 py-2" id="btnProcessar">
              Processar Comparação
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Visão Geral Executiva & KPIs -->
    <div class="row g-3 mb-4">
      <div class="col-md-6">
        <div class="card card-custom h-100 border-primary pointer" onclick="filtrarVisualizacao('shared')">
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge bg-primary text-uppercase">Seção 1 • Análise Tarifária</span>
              <span class="badge bg-primary-subtle text-primary fw-bold font-monospace fs-6" id="kpiSharedCount">0 procedimentos</span>
            </div>
            <h6 class="fw-bold mb-1" id="kpiSharedTitle">Procedimentos Compartilhados (Volume Maior & Menor Ticket em A)</h6>
            <small class="text-muted d-block mb-3" id="kpiSharedDesc">Procedimentos onde o Hospital A atende mais AIHs, porém recebe menor ticket que o Hospital B.</small>
            <div class="row text-center g-2 pt-2 border-top small">
              <div class="col-4">
                <span class="text-muted d-block truncate" id="kpiSharedAihsALbl">AIHs Hosp A</span>
                <strong id="kpiSharedAihsA" class="text-primary font-monospace">0</strong>
              </div>
              <div class="col-4">
                <span class="text-muted d-block truncate" id="kpiSharedAihsBLbl">AIHs Hosp B</span>
                <strong id="kpiSharedAihsB" class="text-secondary font-monospace">0</strong>
              </div>
              <div class="col-4">
                <span class="text-muted d-block truncate" id="kpiSharedFatALbl">Faturamento A</span>
                <strong id="kpiSharedFatA" class="text-dark font-monospace">R$ 0,00</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-6">
        <div class="card card-custom h-100 border-success pointer" style="background: linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%);" onclick="filtrarVisualizacao('exclusive')">
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge bg-success text-uppercase">Seção 2 • Expansão Assistencial</span>
              <span class="badge bg-success text-white fw-bold font-monospace fs-6" id="kpiExclCount">0 exclusivos</span>
            </div>
            <h6 class="fw-bold text-success-emphasis mb-1" id="kpiExclTitle">Procedimentos Exclusivos do Concorrente (Hospital B)</h6>
            <small class="text-muted d-block mb-3" id="kpiExclDesc">Procedimentos faturados pelo Hospital B onde o Hospital A teve <strong class="text-danger">Volume = 0</strong>.</small>
            <div class="row text-center g-2 pt-2 border-top small">
              <div class="col-4 bg-warning-subtle rounded p-1">
                <span class="text-dark fw-bold d-block" style="font-size: 11px;">Ticket Médio Geral</span>
                <strong id="kpiExclTicket" class="text-dark font-monospace fs-6">R$ 0,00</strong>
              </div>
              <div class="col-4 p-1">
                <span class="text-muted d-block truncate" id="kpiExclAihsLbl">AIHs no Concorrente</span>
                <strong id="kpiExclAihs" class="text-dark font-monospace fs-6">0</strong>
              </div>
              <div class="col-4 p-1">
                <span class="text-muted d-block truncate" id="kpiExclFatLbl">Faturamento B</span>
                <strong id="kpiExclFat" class="text-success font-monospace fs-6">R$ 0,00</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filtros de Visualização Rápida -->
    <div class="d-flex flex-wrap gap-2 mb-4 align-items-center">
      <div class="btn-group" role="group">
        <button type="button" class="btn btn-outline-dark btn-sm active" id="btnTabAll" onclick="filtrarVisualizacao('all')">
          Visão Completa (Ambas as Seções)
        </button>
        <button type="button" class="btn btn-outline-primary btn-sm" id="btnTabShared" onclick="filtrarVisualizacao('shared')">
          1. Compartilhados (<span id="tabCountShared">0</span>)
        </button>
        <button type="button" class="btn btn-outline-success btn-sm" id="btnTabExclusive" onclick="filtrarVisualizacao('exclusive')">
          2. Exclusivos do Concorrente (<span id="tabCountExclusive">0</span>)
        </button>
      </div>
      <span class="ms-auto text-muted small" id="lblTabInfo">Exibindo ambas as seções analíticas</span>
    </div>

    <!-- Seção 1: Indicadores divididos em duas colunas (Hosp A e Hosp B) -->
    <div id="containerSec1" class="card card-custom mb-4 bg-white">
      <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
        <div>
          <h6 class="mb-0 fw-bold" id="titleSec1Hosp">Seção 1: Procedimentos Compartilhados (Hospital A com Maior Volume e Menor Ticket)</h6>
          <small class="text-light opacity-75">Clique no cabeçalho para reordenar (do maior para o menor) ou no nome do procedimento para ver as AIH's</small>
        </div>
        <span id="countSec1" class="badge bg-warning text-dark font-monospace">0 procedimentos</span>
      </div>
      <div class="table-responsive">
        <table class="table table-hover table-bordered align-middle mb-0 text-nowrap">
          <thead class="table-light text-uppercase small">
            <tr>
              <th rowspan="2" class="sortable" onclick="ordenarTabela1('name')">Procedimento Principal (Clique p/ ver AIHs)</th>
              <th colspan="2" class="text-center bg-primary-subtle text-primary fw-bold">Qtd. AIHs</th>
              <th colspan="2" class="text-center bg-warning-subtle text-dark fw-bold">Diárias UTI</th>
              <th colspan="2" class="text-center bg-light fw-bold">Média Perm. (Dias)</th>
              <th colspan="2" class="text-center bg-danger-subtle text-danger fw-bold">Ticket Médio (R$)</th>
              <th colspan="2" class="text-center bg-success-subtle text-success fw-bold">Valor Total Faturado (R$)</th>
            </tr>
            <tr class="text-center small">
              <th class="sortable text-primary th-hosp-a" onclick="ordenarTabela1('aihsA')">Hosp A</th>
              <th class="sortable th-hosp-b" onclick="ordenarTabela1('aihsB')">Hosp B</th>
              <th class="sortable text-warning-emphasis th-hosp-a" onclick="ordenarTabela1('utiDaysA')">Hosp A</th>
              <th class="sortable th-hosp-b" onclick="ordenarTabela1('utiDaysB')">Hosp B</th>
              <th class="sortable th-hosp-a" onclick="ordenarTabela1('avgPermanenceA')">Hosp A</th>
              <th class="sortable th-hosp-b" onclick="ordenarTabela1('avgPermanenceB')">Hosp B</th>
              <th class="sortable text-danger th-hosp-a" onclick="ordenarTabela1('avgTicketA')">Hosp A</th>
              <th class="sortable text-success th-hosp-b" onclick="ordenarTabela1('avgTicketB')">Hosp B</th>
              <th class="sortable text-primary th-hosp-a" onclick="ordenarTabela1('totalFaturadoA')">Hosp A</th>
              <th class="sortable th-hosp-b" onclick="ordenarTabela1('totalFaturadoB')">Hosp B</th>
            </tr>
          </thead>
          <tbody id="tabelaSec1">
            <tr><td colspan="11" class="text-center text-muted p-4">Carregando dados...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Seção 2: Oportunidades Exclusivas -->
    <div id="containerSec2" class="card card-custom mb-4 bg-white border-2 border-success-subtle">
      <div class="card-header bg-dark text-white d-flex flex-wrap justify-content-between align-items-center py-3 gap-2" style="background: linear-gradient(90deg, #0f172a 0%, #064e3b 100%) !important;">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge bg-success text-uppercase">Seção 2</span>
            <h6 class="mb-0 fw-bold text-white" id="titleSec2Hosp">Procedimentos Exclusivos do Concorrente (Hospital B)</h6>
          </div>
          <small class="text-light opacity-75" id="subSec2Hosp">Procedimentos faturados pelo Hospital B onde o Hospital A teve Volume = 0</small>
        </div>
        <span id="countSec2" class="badge bg-light text-dark font-monospace fs-6">0 procedimentos exclusivos</span>
      </div>
      <div class="table-responsive">
        <table class="table table-hover table-bordered align-middle mb-0 text-nowrap">
          <thead class="table-light text-uppercase small text-secondary">
            <tr>
              <th class="text-center" style="width: 50px;">#</th>
              <th class="sortable" onclick="ordenarTabela2('name')">Código e Descrição (Clique p/ ver AIHs)</th>
              <th class="text-center sortable" onclick="ordenarTabela2('aihsB')">Qtd. AIHs (Hosp B)</th>
              <th class="text-center sortable" onclick="ordenarTabela2('utiDaysB')">Total Diárias UTI</th>
              <th class="text-center sortable" onclick="ordenarTabela2('avgPermanenceB')">Média Permanência</th>
              <th class="text-end sortable bg-warning-subtle text-dark fw-bold" onclick="ordenarTabela2('avgTicketB')" title="Clique para ordenar por Ticket Médio">Ticket Médio (R$) ↓</th>
              <th class="text-end sortable bg-success-subtle text-success fw-bold" onclick="ordenarTabela2('totalFaturadoB')" title="Clique para ordenar por Valor Faturado">Valor Total Faturado</th>
            </tr>
          </thead>
          <tbody id="tabelaSec2">
            <tr><td colspan="7" class="text-center text-muted p-4">Carregando dados...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Modal de Detalhamento de AIH's -->
  <div class="modal fade" id="modalAihs" tabindex="-1">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header bg-dark text-white">
          <div>
            <h5 class="modal-title fw-bold" id="modalProcTitle">Detalhamento de AIH's</h5>
            <small class="text-warning" id="modalProcSub">AIH's agrupadas por hospital (valores do maior para o menor)</small>
          </div>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body p-3 bg-light">
          <div class="row g-3">
            <div class="col-md-6">
              <div class="card">
                <div class="card-header bg-primary text-white fw-bold d-flex justify-content-between">
                  <span id="modalHospATitle">Hospital A</span>
                  <span id="modalCountA" class="badge bg-light text-dark">0 AIHs</span>
                </div>
                <div class="table-responsive" style="max-height: 450px;">
                  <table class="table table-sm table-striped mb-0 small">
                    <thead><tr><th>#</th><th>Nº AIH</th><th class="text-end">Valor (R$) ↓</th><th class="text-center">UTI</th><th class="text-center">Perm.</th></tr></thead>
                    <tbody id="modalBodyA"></tbody>
                  </table>
                </div>
              </div>
            </div>
            <div class="col-md-6">
              <div class="card">
                <div class="card-header bg-secondary text-white fw-bold d-flex justify-content-between">
                  <span id="modalHospBTitle">Hospital B</span>
                  <span id="modalCountB" class="badge bg-light text-dark">0 AIHs</span>
                </div>
                <div class="table-responsive" style="max-height: 450px;">
                  <table class="table table-sm table-striped mb-0 small">
                    <thead><tr><th>#</th><th>Nº AIH</th><th class="text-end">Valor (R$) ↓</th><th class="text-center">UTI</th><th class="text-center">Perm.</th></tr></thead>
                    <tbody id="modalBodyB"></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bootstrap 5 JS -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    let dadosShared = [];
    let dadosExclusive = [];
    let modalInstance = null;

    window.onload = function() {
      modalInstance = new bootstrap.Modal(document.getElementById('modalAihs'));
      google.script.run.withSuccessHandler(function(hospitais) {
        const selectA = document.getElementById('hospA');
        const selectB = document.getElementById('hospB');
        selectA.innerHTML = '';
        selectB.innerHTML = '';

        hospitais.forEach((h, idx) => {
          const isA = h.toUpperCase().includes("CIENCIAS MEDICAS") || h.toUpperCase().includes("HUCM");
          selectA.add(new Option(h, h, false, isA || idx === 0));
          selectB.add(new Option(h, h, false, !isA && (idx === 1 || h.toUpperCase().includes("EVANGELICO"))));
        });

        executarComparacao();
      }).getHospitaisDisponiveis();
    };

    function executarComparacao() {
      const hA = document.getElementById('hospA').value || "Hospital A";
      const hB = document.getElementById('hospB').value || "Hospital B";
      const ano = document.getElementById('anoSelect').value;
      const btn = document.getElementById('btnProcessar');

      // Update dynamic labels with selected hospital names
      if (document.getElementById('labelHospA')) document.getElementById('labelHospA').innerText = hA;
      if (document.getElementById('labelHospB')) document.getElementById('labelHospB').innerText = hB;
      if (document.getElementById('kpiSharedDesc')) document.getElementById('kpiSharedDesc').innerText = 'Procedimentos onde ' + hA + ' atende mais AIHs, porém recebe menor ticket que ' + hB + '.';
      if (document.getElementById('kpiSharedAihsALbl')) document.getElementById('kpiSharedAihsALbl').innerText = 'AIHs ' + hA;
      if (document.getElementById('kpiSharedAihsBLbl')) document.getElementById('kpiSharedAihsBLbl').innerText = 'AIHs ' + hB;
      if (document.getElementById('kpiSharedFatALbl')) document.getElementById('kpiSharedFatALbl').innerText = 'Faturamento ' + hA;
      if (document.getElementById('kpiExclTitle')) document.getElementById('kpiExclTitle').innerText = 'Procedimentos Exclusivos do Concorrente (' + hB + ')';
      if (document.getElementById('kpiExclDesc')) document.getElementById('kpiExclDesc').innerHTML = 'Procedimentos faturados por ' + hB + ' onde ' + hA + ' teve <strong class="text-danger">Volume = 0</strong>.';
      if (document.getElementById('kpiExclAihsLbl')) document.getElementById('kpiExclAihsLbl').innerText = 'AIHs em ' + hB;
      if (document.getElementById('kpiExclFatLbl')) document.getElementById('kpiExclFatLbl').innerText = 'Faturamento ' + hB;
      if (document.getElementById('titleSec1Hosp')) document.getElementById('titleSec1Hosp').innerText = 'Seção 1: Procedimentos Compartilhados (' + hA + ' com Maior Volume e Menor Ticket)';
      if (document.getElementById('titleSec2Hosp')) document.getElementById('titleSec2Hosp').innerText = 'Procedimentos Exclusivos do Concorrente (' + hB + ')';
      if (document.getElementById('subSec2Hosp')) document.getElementById('subSec2Hosp').innerText = 'Procedimentos faturados por ' + hB + ' onde ' + hA + ' teve Volume = 0';

      document.querySelectorAll('.th-hosp-a').forEach(el => el.innerText = hA);
      document.querySelectorAll('.th-hosp-b').forEach(el => el.innerText = hB);

      btn.disabled = true;
      btn.innerText = 'Processando...';

      google.script.run.withSuccessHandler(function(res) {
        btn.disabled = false;
        btn.innerText = 'Processar Comparação';
        dadosShared = res.shared || [];
        dadosExclusive = res.exclusive || [];

        // Atualização de KPIs Executivos
        const sumShared = res.summaryShared || {
          totalCount: dadosShared.length,
          totalAihsA: dadosShared.reduce((a, b) => a + (b.aihsA || 0), 0),
          totalAihsB: dadosShared.reduce((a, b) => a + (b.aihsB || 0), 0),
          totalFaturadoA: dadosShared.reduce((a, b) => a + (b.totalFaturadoA || 0), 0)
        };

        const sumExcl = res.summaryExclusive || {
          totalCount: dadosExclusive.length,
          totalAihsB: dadosExclusive.reduce((a, b) => a + (b.aihsB || 0), 0),
          totalFaturadoB: dadosExclusive.reduce((a, b) => a + (b.totalFaturadoB || 0), 0),
          avgTicketGlobalB: (dadosExclusive.reduce((a, b) => a + (b.aihsB || 0), 0) > 0)
            ? (dadosExclusive.reduce((a, b) => a + (b.totalFaturadoB || 0), 0) / dadosExclusive.reduce((a, b) => a + (b.aihsB || 0), 0))
            : 0
        };

        // Preenchimento de KPIs
        document.getElementById('kpiSharedCount').innerText = sumShared.totalCount + ' procedimentos';
        document.getElementById('kpiSharedAihsA').innerText = Number(sumShared.totalAihsA).toLocaleString('pt-BR');
        document.getElementById('kpiSharedAihsB').innerText = Number(sumShared.totalAihsB).toLocaleString('pt-BR');
        document.getElementById('kpiSharedFatA').innerText = 'R$ ' + Number(sumShared.totalFaturadoA).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        document.getElementById('kpiExclCount').innerText = sumExcl.totalCount + ' exclusivos';
        document.getElementById('kpiExclTicket').innerText = 'R$ ' + Number(sumExcl.avgTicketGlobalB).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById('kpiExclAihs').innerText = Number(sumExcl.totalAihsB).toLocaleString('pt-BR');
        document.getElementById('kpiExclFat').innerText = 'R$ ' + Number(sumExcl.totalFaturadoB).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        document.getElementById('tabCountShared').innerText = sumShared.totalCount;
        document.getElementById('tabCountExclusive').innerText = sumExcl.totalCount;

        renderTabela1();
        renderTabela2();
      }).withFailureHandler(function(err) {
        btn.disabled = false;
        btn.innerText = 'Processar Comparação';
        alert('Erro ao processar dados: ' + err);
      }).processarComparacao(hA, hB, ano);
    }

    function filtrarVisualizacao(tipo) {
      const c1 = document.getElementById('containerSec1');
      const c2 = document.getElementById('containerSec2');
      const btnAll = document.getElementById('btnTabAll');
      const btnShared = document.getElementById('btnTabShared');
      const btnExcl = document.getElementById('btnTabExclusive');
      const lbl = document.getElementById('lblTabInfo');

      btnAll.classList.remove('active');
      btnShared.classList.remove('active');
      btnExcl.classList.remove('active');

      if (tipo === 'shared') {
        c1.style.display = 'block';
        c2.style.display = 'none';
        btnShared.classList.add('active');
        lbl.innerText = 'Exibindo apenas Seção 1 (Procedimentos Compartilhados)';
        c1.scrollIntoView({ behavior: 'smooth' });
      } else if (tipo === 'exclusive') {
        c1.style.display = 'none';
        c2.style.display = 'block';
        btnExcl.classList.add('active');
        lbl.innerText = 'Exibindo apenas Seção 2 (Oportunidades Exclusivas)';
        c2.scrollIntoView({ behavior: 'smooth' });
      } else {
        c1.style.display = 'block';
        c2.style.display = 'block';
        btnAll.classList.add('active');
        lbl.innerText = 'Exibindo ambas as seções analíticas';
      }
    }

    function ordenarTabela1(campo) {
      dadosShared.sort((a, b) => {
        if (typeof a[campo] === 'string') return a[campo].localeCompare(b[campo]);
        return (b[campo] || 0) - (a[campo] || 0); // DO MAIOR PARA O MENOR
      });
      renderTabela1();
    }

    function ordenarTabela2(campo) {
      dadosExclusive.sort((a, b) => {
        if (typeof a[campo] === 'string') return a[campo].localeCompare(b[campo]);
        return (b[campo] || 0) - (a[campo] || 0); // DO MAIOR PARA O MENOR
      });
      renderTabela2();
    }

    function renderTabela1() {
      const tbody = document.getElementById('tabelaSec1');
      document.getElementById('countSec1').innerText = dadosShared.length + " procedimentos";
      const nameA = (document.getElementById('hospA') && document.getElementById('hospA').value) ? document.getElementById('hospA').value : "Hospital A";
      const nameB = (document.getElementById('hospB') && document.getElementById('hospB').value) ? document.getElementById('hospB').value : "Hospital B";

      if (dadosShared.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted p-4">Nenhum procedimento encontrado onde ' + nameA + ' possua maior volume e menor ticket em relação a ' + nameB + '.</td></tr>';
        return;
      }

      tbody.innerHTML = dadosShared.map((item, idx) => \`
        <tr>
          <td>
            <a href="javascript:void(0)" onclick="abrirDetalheAihs(\${idx}, 'shared')" class="fw-bold text-decoration-none text-dark">
              \${item.name}
            </a><br>
            <small class="badge bg-light text-dark font-monospace">\${item.code}</small>
          </td>
          <td class="text-center font-monospace fw-bold text-primary bg-primary-subtle">\${item.aihsA}</td>
          <td class="text-center font-monospace">\${item.aihsB}</td>
          <td class="text-center font-monospace text-warning-emphasis">\${item.utiDaysA}</td>
          <td class="text-center font-monospace">\${item.utiDaysB}</td>
          <td class="text-center font-monospace">\${item.avgPermanenceA.toFixed(1)}d</td>
          <td class="text-center font-monospace">\${item.avgPermanenceB.toFixed(1)}d</td>
          <td class="text-end font-monospace text-danger fw-bold">R$ \${item.avgTicketA.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td class="text-end font-monospace text-success fw-bold">R$ \${item.avgTicketB.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td class="text-end font-monospace fw-bold">R$ \${item.totalFaturadoA.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td class="text-end font-monospace text-muted">R$ \${item.totalFaturadoB.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        </tr>
      \`).join('');
    }

    function renderTabela2() {
      const tbody = document.getElementById('tabelaSec2');
      document.getElementById('countSec2').innerText = dadosExclusive.length + " procedimentos exclusivos";
      const nameA = (document.getElementById('hospA') && document.getElementById('hospA').value) ? document.getElementById('hospA').value : "Hospital A";
      const nameB = (document.getElementById('hospB') && document.getElementById('hospB').value) ? document.getElementById('hospB').value : "Hospital B";

      if (dadosExclusive.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-4">Nenhum procedimento exclusivo faturado por ' + nameB + '.</td></tr>';
        return;
      }

      tbody.innerHTML = dadosExclusive.map((item, idx) => \`
        <tr>
          <td class="text-center font-monospace text-muted small bg-light">#\${idx + 1}</td>
          <td>
            <a href="javascript:void(0)" onclick="abrirDetalheAihs(\${idx}, 'exclusive')" class="fw-bold text-decoration-none text-dark">
              \${item.name}
            </a><br>
            <small class="badge bg-light text-dark font-monospace">\${item.code}</small>
            <small class="text-danger ms-1">• Ausente em \${nameA}</small>
          </td>
          <td class="text-center font-monospace"><span class="badge bg-secondary">\${item.aihsB} AIHs</span></td>
          <td class="text-center font-monospace">\${item.utiDaysB > 0 ? ('<span class="text-warning-emphasis fw-bold">' + item.utiDaysB + ' diárias</span>') : '-'}</td>
          <td class="text-center font-monospace">\${item.avgPermanenceB.toFixed(1)} dias</td>
          <td class="text-end font-monospace bg-warning-subtle">
            <span class="badge bg-warning text-dark font-monospace fs-6 px-2 py-1">
              R$ \${item.avgTicketB.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}
            </span>
          </td>
          <td class="text-end font-monospace text-success fw-bold">R$ \${item.totalFaturadoB.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        </tr>
      \`).join('');
    }

    function abrirDetalheAihs(idx, tipo) {
      const item = tipo === 'shared' ? dadosShared[idx] : dadosExclusive[idx];
      if (!item) return;

      document.getElementById('modalProcTitle').innerText = item.name;
      document.getElementById('modalProcSub').innerText = 'Código SUS: ' + item.code + ' • AIHs ordenadas do maior valor para o menor';

      const aihsA = item.aihsDetailsA || [];
      const aihsB = item.aihsDetailsB || [];

      document.getElementById('modalHospATitle').innerText = document.getElementById('hospA').value;
      document.getElementById('modalCountA').innerText = aihsA.length + ' AIHs';
      document.getElementById('modalBodyA').innerHTML = aihsA.map((a, i) => \`
        <tr>
          <td>#\${i + 1}</td>
          <td class="font-monospace fw-bold">\${a.naih}</td>
          <td class="text-end font-monospace fw-bold text-primary">R$ \${a.finalTicket.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td class="text-center font-monospace">\${a.utiDays > 0 ? a.utiDays + 'd' : '-'}</td>
          <td class="text-center font-monospace">\${a.permanence}d</td>
        </tr>
      \`).join('') || '<tr><td colspan="5" class="text-center text-muted">Nenhuma AIH realizada.</td></tr>';

      document.getElementById('modalHospBTitle').innerText = document.getElementById('hospB').value;
      document.getElementById('modalCountB').innerText = aihsB.length + ' AIHs';
      document.getElementById('modalBodyB').innerHTML = aihsB.map((b, i) => \`
        <tr>
          <td>#\${i + 1}</td>
          <td class="font-monospace fw-bold">\${b.naih}</td>
          <td class="text-end font-monospace fw-bold text-success">R$ \${b.finalTicket.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td class="text-center font-monospace">\${b.utiDays > 0 ? b.utiDays + 'd' : '-'}</td>
          <td class="text-center font-monospace">\${b.permanence}d</td>
        </tr>
      \`).join('') || '<tr><td colspan="5" class="text-center text-muted">Nenhuma AIH realizada.</td></tr>';

      modalInstance.show();
    }
  </script>
</body>
</html>
`;
