import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeftRight, 
  TrendingUp, 
  Coins, 
  Percent, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  Info, 
  ArrowRight,
  UserCheck,
  Building,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { SUSRecord } from "../types";
import { parseVal, formatVal } from "../data/mockData";
import ProcedureSelector from "./ProcedureSelector";

interface CustomComparativeViewProps {
  records: SUSRecord[];
  allProcedures: string[];
  selectedProcedure: string;
  onProcedureChange: (procedure: string) => void;
}

export default function CustomComparativeView({
  records,
  allProcedures,
  selectedProcedure,
  onProcedureChange
}: CustomComparativeViewProps) {
  
  // 1. Single filtered slice of records for the selected procedure
  const procRecords = useMemo(() => {
    if (!selectedProcedure || !records || records.length === 0) return [];
    const len = records.length;
    const res: SUSRecord[] = [];
    for (let i = 0; i < len; i++) {
      if (records[i]["PROCEDIMENTO PRINCIPAL"] === selectedProcedure) {
        res.push(records[i]);
      }
    }
    return res;
  }, [records, selectedProcedure]);

  // Unique hospitals for the selected procedure
  const hospitalsForProc = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < procRecords.length; i++) {
      if (procRecords[i].HOSPITAL) set.add(procRecords[i].HOSPITAL);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [procRecords]);

  const [hospitalA, setHospitalA] = useState("");
  const [hospitalB, setHospitalB] = useState("");

  // Sync default hospitals when the procedure changes
  useEffect(() => {
    if (hospitalsForProc.length > 0) {
      const hucm = hospitalsForProc.find(h => h.toUpperCase().includes("CIENCIAS MEDICAS") || h.toUpperCase().includes("HUCM")) || hospitalsForProc[0];
      const competitor = hospitalsForProc.find(h => h !== hucm) || hospitalsForProc[1] || hospitalsForProc[0];
      setHospitalA(hucm);
      setHospitalB(competitor === hucm && hospitalsForProc.length > 1 ? hospitalsForProc[1] : competitor);
    } else {
      setHospitalA("");
      setHospitalB("");
    }
  }, [hospitalsForProc, selectedProcedure]);

  // Click-to-compare states
  const [selectedRecordA, setSelectedRecordA] = useState<SUSRecord | null>(null);
  const [selectedRecordB, setSelectedRecordB] = useState<SUSRecord | null>(null);

  // Split-by-price vs Grouped-by-code layout toggles
  const [viewMode, setViewMode] = useState<"segmented" | "grouped">("segmented");
  const [expandedCodes, setExpandedCodes] = useState<number[]>([]);

  const toggleCodeExpand = (code: number) => {
    setExpandedCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Reset row selection when procedure or hospitals change
  useEffect(() => {
    setSelectedRecordA(null);
    setSelectedRecordB(null);
    setExpandedCodes([]); // also collapse expanded codes on procedural change
  }, [selectedProcedure, hospitalA, hospitalB]);

  // Sorting state configuration for both tables
  type SortKey = "aih" | "code" | "name" | "qty" | "val" | "unit" | "total_aih";
  type SortDirection = "asc" | "desc";

  const [sortKeyA, setSortKeyA] = useState<SortKey | null>(null);
  const [sortDirA, setSortDirA] = useState<SortDirection>("asc");

  const [sortKeyB, setSortKeyB] = useState<SortKey | null>(null);
  const [sortDirB, setSortDirB] = useState<SortDirection>("asc");

  // 2. Pre-calculate the total ticket of each unique AIH (SP_NAIH) in the whole procedure
  const aihTotals = useMemo(() => {
    const map: { [naih: number]: number } = {};
    
    // Check explicit ticket values first
    procRecords.forEach(r => {
      const naih = r.SP_NAIH;
      if (!(naih in map)) {
        const explicitVal = r["TICKET PROCEDIMENTO REAL"] ? parseVal(r["TICKET PROCEDIMENTO REAL"]) : 0;
        map[naih] = explicitVal;
      }
    });

    // Sum individual act values for each NAIH
    const sums: { [naih: number]: number } = {};
    procRecords.forEach(r => {
      const naih = r.SP_NAIH;
      sums[naih] = (sums[naih] || 0) + parseVal(r.SP_VALATO);
    });

    // If explicit ticket was 0 or missing, fill with sum of acts
    Object.keys(map).forEach(naihStr => {
      const naih = Number(naihStr);
      if (map[naih] === 0) {
        map[naih] = sums[naih];
      }
    });

    return map;
  }, [procRecords]);

  // 3. Filter individual billing lines for each hospital
  const recordsA = useMemo(() => {
    if (!hospitalA) return [];
    return procRecords.filter(r => r.HOSPITAL === hospitalA);
  }, [procRecords, hospitalA]);

  const recordsB = useMemo(() => {
    if (!hospitalB) return [];
    return procRecords.filter(r => r.HOSPITAL === hospitalB);
  }, [procRecords, hospitalB]);

  // 4. Calculate key metrics for Hospital A
  const metricsA = useMemo(() => {
    if (recordsA.length === 0) {
      return { totalAihs: 0, incentivizedAihs: 0, ticketMedioProc: 0, totalValueAll: 0 };
    }
    const uniqueNaihs = Array.from(new Set(recordsA.map(r => r.SP_NAIH)));
    const totalAihs = uniqueNaihs.length;
    const incentivizedAihs = uniqueNaihs.filter(n => String(n).startsWith("312555")).length;
    
    const totalValue = uniqueNaihs.reduce<number>((sum, n) => sum + (aihTotals[n as number] || 0), 0);
    const ticketMedioProc = totalAihs > 0 ? (totalValue as number) / totalAihs : 0;

    return { totalAihs, incentivizedAihs, ticketMedioProc, totalValueAll: totalValue };
  }, [recordsA, aihTotals]);

  // 5. Calculate key metrics for Hospital B
  const metricsB = useMemo(() => {
    if (recordsB.length === 0) {
      return { totalAihs: 0, incentivizedAihs: 0, ticketMedioProc: 0, totalValueAll: 0 };
    }
    const uniqueNaihs = Array.from(new Set(recordsB.map(r => r.SP_NAIH)));
    const totalAihs = uniqueNaihs.length;
    const incentivizedAihs = uniqueNaihs.filter(n => String(n).startsWith("312555")).length;

    const totalValue = uniqueNaihs.reduce<number>((sum, n) => sum + (aihTotals[n as number] || 0), 0);
    const ticketMedioProc = totalAihs > 0 ? (totalValue as number) / totalAihs : 0;

    return { totalAihs, incentivizedAihs, ticketMedioProc, totalValueAll: totalValue };
  }, [recordsB, aihTotals]);

  // 6. Comparative performance insight
  const comparisonResult = useMemo(() => {
    const avgA = metricsA.ticketMedioProc;
    const avgB = metricsB.ticketMedioProc;
    
    if (avgA === 0 || avgB === 0) return null;
    
    if (avgA > avgB) {
      const pct = ((avgA - avgB) / avgB) * 100;
      return {
        winner: hospitalA,
        loser: hospitalB,
        pct: pct,
        message: `O hospital ${hospitalA} está recebendo ${pct.toFixed(2)}% MAIS em média do que o hospital ${hospitalB} por internação para este procedimento.`
      };
    } else if (avgB > avgA) {
      const pct = ((avgB - avgA) / avgA) * 100;
      return {
        winner: hospitalB,
        loser: hospitalA,
        pct: pct,
        message: `O hospital ${hospitalB} está recebendo ${pct.toFixed(2)}% MAIS em média do que o hospital ${hospitalA} por internação para este procedimento.`
      };
    }
    return { winner: "", loser: "", pct: 0, message: "Ambos os hospitais recebem o mesmo ticket médio para este procedimento." };
  }, [metricsA, metricsB, hospitalA, hospitalB]);

  // Sorting helper function
  const sortRecords = (list: SUSRecord[], key: SortKey | null, dir: SortDirection) => {
    if (!key) return list;
    const sorted = [...list];
    sorted.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (key) {
        case "aih":
          valA = Number(a.SP_NAIH || 0);
          valB = Number(b.SP_NAIH || 0);
          break;
        case "code":
          valA = Number(a.SP_ATOPROF || 0);
          valB = Number(b.SP_ATOPROF || 0);
          break;
        case "name":
          valA = String(a["PROCEDIMENTO ATO"] || "").toLowerCase();
          valB = String(b["PROCEDIMENTO ATO"] || "").toLowerCase();
          break;
        case "qty":
          valA = Number(a.SP_QTD_ATO || 1);
          valB = Number(b.SP_QTD_ATO || 1);
          break;
        case "val":
          valA = parseVal(a.SP_VALATO);
          valB = parseVal(b.SP_VALATO);
          break;
        case "unit": {
          const vA = parseVal(a.SP_VALATO);
          const qA = Number(a.SP_QTD_ATO || 1);
          valA = qA > 0 ? vA / qA : vA;

          const vB = parseVal(b.SP_VALATO);
          const qB = Number(b.SP_QTD_ATO || 1);
          valB = qB > 0 ? vB / qB : vB;
          break;
        }
        case "total_aih":
          valA = aihTotals[a.SP_NAIH] || 0;
          valB = aihTotals[b.SP_NAIH] || 0;
          break;
      }

      if (valA < valB) return dir === "asc" ? -1 : 1;
      if (valA > valB) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  const sortedRecordsA = useMemo(() => {
    return sortRecords(recordsA, sortKeyA, sortDirA);
  }, [recordsA, sortKeyA, sortDirA, aihTotals]);

  const sortedRecordsB = useMemo(() => {
    return sortRecords(recordsB, sortKeyB, sortDirB);
  }, [recordsB, sortKeyB, sortDirB, aihTotals]);

  // Click-to-compare automatic and manual handlers by object reference
  const handleSelectRowA = (recA: SUSRecord) => {
    setSelectedRecordA(recA);
    const match = recordsB.find(b => Number(b.SP_ATOPROF) === Number(recA.SP_ATOPROF));
    if (match) {
      setSelectedRecordB(match);
    } else {
      setSelectedRecordB(null);
    }
  };

  const handleSelectRowB = (recB: SUSRecord) => {
    setSelectedRecordB(recB);
    const match = recordsA.find(a => Number(a.SP_ATOPROF) === Number(recB.SP_ATOPROF));
    if (match) {
      setSelectedRecordA(match);
    } else {
      setSelectedRecordA(null);
    }
  };

  const toggleSortA = (key: SortKey) => {
    if (sortKeyA === key) {
      setSortDirA(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKeyA(key);
      if (["qty", "val", "unit", "total_aih"].includes(key)) {
        setSortDirA("desc");
      } else {
        setSortDirA("asc");
      }
    }
  };

  const toggleSortB = (key: SortKey) => {
    if (sortKeyB === key) {
      setSortDirB(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKeyB(key);
      if (["qty", "val", "unit", "total_aih"].includes(key)) {
        setSortDirB("desc");
      } else {
        setSortDirB("asc");
      }
    }
  };

  // Live active comparison calculations for selected rows
  const calcComparison = useMemo(() => {
    if (!selectedRecordA && !selectedRecordB) return null;

    const valA = selectedRecordA ? parseVal(selectedRecordA.SP_VALATO) : 0;
    const qtyA = selectedRecordA ? Number(selectedRecordA.SP_QTD_ATO || 1) : 1;
    const unitA = qtyA > 0 ? valA / qtyA : valA;

    const valB = selectedRecordB ? parseVal(selectedRecordB.SP_VALATO) : 0;
    const qtyB = selectedRecordB ? Number(selectedRecordB.SP_QTD_ATO || 1) : 1;
    const unitB = qtyB > 0 ? valB / qtyB : valB;

    const hasBoth = !!selectedRecordA && !!selectedRecordB;
    const sameCode = hasBoth && Number(selectedRecordA?.SP_ATOPROF) === Number(selectedRecordB?.SP_ATOPROF);

    const diffAbs = Math.abs(unitA - unitB);
    
    // Percentage differences
    const pctB_vs_A = unitA > 0 ? ((unitB - unitA) / unitA) * 100 : 0;
    const pctA_vs_B = unitB > 0 ? ((unitA - unitB) / unitB) * 100 : 0;

    // Loss calculation for HUCM (Hospital A) if competitor B is more expensive for same code
    const hucmLostUnit = unitB > unitA ? unitB - unitA : 0;
    const hucmLostTotal = hucmLostUnit * qtyA;

    return {
      valA,
      qtyA,
      unitA,
      valB,
      qtyB,
      unitB,
      hasBoth,
      sameCode,
      diffAbs,
      pctB_vs_A,
      pctA_vs_B,
      hucmLostUnit,
      hucmLostTotal
    };
  }, [selectedRecordA, selectedRecordB]);

  // 7. Advanced cross-reference per-activity code (SP_ATOPROF) comparison
  const codeComparisons = useMemo(() => {
    const stats: { 
      [key: string]: { 
        code: number; 
        name: string; 
        hospA: { count: number; totalQty: number; avgUnit: number; totalVal: number }; 
        hospB: { count: number; totalQty: number; avgUnit: number; totalVal: number };
      } 
    } = {};

    // Helper to extract or init
    const getCodeObj = (code: number, name: string, unitVal: number) => {
      const key = `${code}_${unitVal.toFixed(2)}`;
      if (!stats[key]) {
        stats[key] = {
          code,
          name,
          hospA: { count: 0, totalQty: 0, avgUnit: unitVal, totalVal: 0 },
          hospB: { count: 0, totalQty: 0, avgUnit: unitVal, totalVal: 0 }
        };
      }
      return stats[key];
    };

    // Populate Hospital A stats
    recordsA.forEach(r => {
      const code = Number(r.SP_ATOPROF || 0);
      const name = r["PROCEDIMENTO ATO"] || "Outros";
      const qty = r.SP_QTD_ATO || 1;
      const val = parseVal(r.SP_VALATO);
      const unitVal = qty > 0 ? val / qty : val;
      const obj = getCodeObj(code, name, unitVal);

      obj.hospA.count++;
      obj.hospA.totalQty += qty;
      obj.hospA.totalVal += val;
    });

    // Populate Hospital B stats
    recordsB.forEach(r => {
      const code = Number(r.SP_ATOPROF || 0);
      const name = r["PROCEDIMENTO ATO"] || "Outros";
      const qty = r.SP_QTD_ATO || 1;
      const val = parseVal(r.SP_VALATO);
      const unitVal = qty > 0 ? val / qty : val;
      const obj = getCodeObj(code, name, unitVal);

      obj.hospB.count++;
      obj.hospB.totalQty += qty;
      obj.hospB.totalVal += val;
    });

    // Compute unit averages
    Object.values(stats).forEach(item => {
      if (item.hospA.totalQty > 0) {
        item.hospA.avgUnit = item.hospA.totalVal / item.hospA.totalQty;
      }
      if (item.hospB.totalQty > 0) {
        item.hospB.avgUnit = item.hospB.totalVal / item.hospB.totalQty;
      }
    });

    // Filter out codes where both are 0 (e.g. invalid entries), and sort by total loss/value
    return Object.values(stats)
      .filter(item => item.hospA.totalQty > 0 || item.hospB.totalQty > 0)
      .sort((a, b) => {
        const totalA = a.hospA.totalVal + a.hospB.totalVal;
        const totalB = b.hospA.totalVal + b.hospB.totalVal;
        return totalB - totalA;
      });
  }, [recordsA, recordsB]);

  // 7b. New Vision: strictly grouped by SP_ATOPROF coding
  const groupedCodeComparisons = useMemo(() => {
    const stats: { 
      [code: number]: { 
        code: number; 
        name: string; 
        totalQtyA: number;
        totalValA: number;
        totalQtyB: number;
        totalValB: number;
        variations: {
          unitVal: number;
          qtyA: number;
          valA: number;
          qtyB: number;
          valB: number;
        }[];
      } 
    } = {};

    // Populate Hospital A
    recordsA.forEach(r => {
      const code = Number(r.SP_ATOPROF || 0);
      const name = r["PROCEDIMENTO ATO"] || "Outros";
      const qty = r.SP_QTD_ATO || 1;
      const val = parseVal(r.SP_VALATO);
      const unitVal = qty > 0 ? val / qty : val;

      if (!stats[code]) {
        stats[code] = {
          code,
          name,
          totalQtyA: 0,
          totalValA: 0,
          totalQtyB: 0,
          totalValB: 0,
          variations: []
        };
      }

      stats[code].totalQtyA += qty;
      stats[code].totalValA += val;

      let v = stats[code].variations.find(x => Math.abs(x.unitVal - unitVal) < 0.05);
      if (!v) {
        v = { unitVal, qtyA: 0, valA: 0, qtyB: 0, valB: 0 };
        stats[code].variations.push(v);
      }
      v.qtyA += qty;
      v.valA += val;
    });

    // Populate Hospital B
    recordsB.forEach(r => {
      const code = Number(r.SP_ATOPROF || 0);
      const name = r["PROCEDIMENTO ATO"] || "Outros";
      const qty = r.SP_QTD_ATO || 1;
      const val = parseVal(r.SP_VALATO);
      const unitVal = qty > 0 ? val / qty : val;

      if (!stats[code]) {
        stats[code] = {
          code,
          name,
          totalQtyA: 0,
          totalValA: 0,
          totalQtyB: 0,
          totalValB: 0,
          variations: []
        };
      }

      stats[code].totalQtyB += qty;
      stats[code].totalValB += val;

      let v = stats[code].variations.find(x => Math.abs(x.unitVal - unitVal) < 0.05);
      if (!v) {
        v = { unitVal, qtyA: 0, valA: 0, qtyB: 0, valB: 0 };
        stats[code].variations.push(v);
      }
      v.qtyB += qty;
      v.valB += val;
    });

    // Sort variations by unit price descending for accurate reading
    Object.values(stats).forEach(item => {
      item.variations.sort((a, b) => b.unitVal - a.unitVal);
    });

    // Return filtered and sorted by total combined faturamento value
    return Object.values(stats)
      .filter(item => item.totalQtyA > 0 || item.totalQtyB > 0)
      .sort((a, b) => (b.totalValA + b.totalValB) - (a.totalValA + a.totalValB));
  }, [recordsA, recordsB]);

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Selector Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#164194]/20 text-[#164194] p-2.5 rounded-2xl border border-[#164194]/30">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-sans">
              Visão Comparativa Geral de Hospitais
            </h2>
            <p className="text-slate-400 text-xs mt-0.5 font-sans">
              Selecione o procedimento de interesse e dois hospitais concorrentes para auditar a fita completa de lançamentos e encontrar discrepâncias ou brechas financeiras de faturamento.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-800/80">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono tracking-wider">
              Procedimento Principal da AIH
            </label>
            <ProcedureSelector
              procedures={allProcedures}
              selectedProcedure={selectedProcedure}
              onChange={onProcedureChange}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono tracking-wider truncate" title={`1. ${hospitalA || "Hospital A"} (Sua Instituição)`}>
              1. {hospitalA || "Hospital A"} (Sua Instituição)
            </label>
            <div className="relative">
              <select
                value={hospitalA}
                onChange={(e) => setHospitalA(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#164194]/80 appearance-none font-sans"
              >
                {hospitalsForProc.map((h) => (
                  <option key={`hospA-${h}`} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono tracking-wider truncate" title={`2. ${hospitalB || "Hospital B"} (Hospital de Comparação)`}>
              2. {hospitalB || "Hospital B"} (Hospital de Comparação)
            </label>
            <div className="relative">
              <select
                value={hospitalB}
                onChange={(e) => setHospitalB(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#164194]/80 appearance-none font-sans"
              >
                {hospitalsForProc.map((h) => (
                  <option key={`hospB-${h}`} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Analytical Comparison Bento Grid */}
      {hospitalsForProc.length >= 1 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Card: Hospital A Summary */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-5 md:col-span-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="bg-sky-50 text-sky-800 border-sky-100 border text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 max-w-[200px] truncate" title={hospitalA}>
                  <Building className="w-3 h-3 shrink-0" /> <span className="truncate">{hospitalA}</span>
                </div>
                {hospitalA.toUpperCase().includes("CIENCIAS MEDICAS") && (
                  <span className="bg-[#164194]/10 text-[#164194] text-[9px] uppercase font-sans font-bold px-1.5 py-0.2 rounded border border-[#164194]/20">
                    Sua Unidade
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-800 truncate" title={hospitalA}>
                {hospitalA}
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                  <span className="text-slate-450 text-[10px] uppercase font-mono block">Total de AIHs</span>
                  <span className="text-2xl font-extrabold text-slate-800 font-mono block mt-1">{metricsA.totalAihs}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                  <span className="text-slate-450 text-[10px] uppercase font-mono block">AIHs Incentivadas</span>
                  <span className="text-2xl font-extrabold text-[#38bdf8] font-mono block mt-1">{metricsA.incentivizedAihs}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 bg-[#38bdf8]/5 -mx-5 -mb-5 px-5 py-4 rounded-b-3xl">
              <span className="text-sky-900/60 text-[10px] uppercase font-mono block">Ticket Médio Hospitalar</span>
              <span className="text-xl font-black text-sky-850 font-mono mt-1 block">
                R$ {formatVal(metricsA.ticketMedioProc)}
              </span>
            </div>
          </div>

          {/* Card: Comparative Metrics Gap Insight */}
          <div className="bg-[#164194]/5 border border-[#164194]/20 shadow-xs rounded-3xl p-5 md:col-span-4 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#164194]/5 rounded-full blur-2xl pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between mb-3 relative">
                <div className="bg-[#164194]/10 text-[#164194] border-[#164194]/20 border text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Percent className="w-3 h-3" /> GAP PERCENTUAL
                </div>
                <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-slate-800 font-sans">
                Análise Comparativa Automática
              </h3>
              
              {comparisonResult ? (
                <div className="mt-3 space-y-2 relative">
                  <div className="flex items-baseline gap-1 text-[#164194] font-mono">
                    <span className="text-4xl font-black">{comparisonResult.pct.toFixed(1)}%</span>
                    <span className="text-xs font-bold font-sans">Diferença de Repasse</span>
                  </div>
                  <p className="text-slate-600 text-xs font-medium leading-relaxed font-sans">
                    Análise com base no ticket médio do procedimento real. O hospital faturamento líder (<strong className="text-slate-900">{comparisonResult.winner}</strong>) apresenta um desempenho superior.
                  </p>
                </div>
              ) : (
                <p className="text-slate-400 text-xs mt-3 font-sans">
                  Insira faturamentos válidos em ambos os competidores para carregar o cálculo de gap percentual deste procedimento.
                </p>
              )}
            </div>

            {comparisonResult && (
              <div className="mt-4 p-3 bg-[#164194]/10 border border-[#164194]/15 rounded-2xl flex items-start gap-2 text-[11px] text-blue-950">
                <TrendingUp className="w-4 h-4 shrink-0 text-[#164194] mt-0.5" />
                <span className="font-sans font-medium line-clamp-3">{comparisonResult.message}</span>
              </div>
            )}
          </div>

          {/* Card: Hospital B Summary */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-5 md:col-span-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="bg-amber-50 text-amber-800 border-amber-100 border text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 max-w-[200px] truncate" title={hospitalB}>
                  <Building className="w-3 h-3 shrink-0" /> <span className="truncate">{hospitalB}</span>
                </div>
                {hospitalB.toUpperCase().includes("CIENCIAS MEDICAS") && (
                  <span className="bg-[#164194]/10 text-[#164194] text-[9px] uppercase font-sans font-bold px-1.5 py-0.2 rounded border border-[#164194]/20">
                    Sua Unidade
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-800 truncate" title={hospitalB}>
                {hospitalB}
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                  <span className="text-slate-450 text-[10px] uppercase font-mono block">Total de AIHs</span>
                  <span className="text-2xl font-extrabold text-slate-800 font-mono block mt-1">{metricsB.totalAihs}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                  <span className="text-slate-450 text-[10px] uppercase font-mono block">AIHs Incentivadas</span>
                  <span className="text-2xl font-extrabold text-amber-500 font-mono block mt-1">{metricsB.incentivizedAihs}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 bg-amber-50/20 -mx-5 -mb-5 px-5 py-4 rounded-b-3xl">
              <span className="text-amber-800/60 text-[10px] uppercase font-mono block">Ticket Médio Hospitalar</span>
              <span className="text-xl font-black text-amber-900 font-mono mt-1 block font-bold">
                R$ {formatVal(metricsB.ticketMedioProc)}
              </span>
            </div>
          </div>

        </div>
      ) : null}

      {/* 3. Deep-Dive discrepancy by SP_ATOPROF Code */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-[#164194]/10 p-1.5 rounded-lg text-[#164194]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-sans">
                Análise Auditada por Código de Faturamento (SP_ATOPROF)
              </h3>
              <p className="text-[11px] text-slate-500 font-sans">
                Esta sessão cruza e analisa quais códigos de atos são faturados, identificando glosas implícitas ou discrepâncias.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Elegant Segmented Switcher */}
            <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-0.5 text-xs font-semibold">
              <button
                onClick={() => setViewMode("segmented")}
                className={`px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                  viewMode === "segmented"
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Visão por Faixa de Preço
              </button>
              <button
                onClick={() => setViewMode("grouped")}
                className={`px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "grouped"
                    ? "bg-[#164194] text-white shadow-sm font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-100"></span>
                </span>
                Agrupado por Código
              </button>
            </div>

            <span className="text-[10px] font-mono uppercase bg-slate-200 font-bold px-2 py-1 rounded-lg text-slate-600 shadow-3xs">
              {viewMode === "segmented" ? codeComparisons.length : groupedCodeComparisons.length} Ativos
            </span>
          </div>
        </div>

        {codeComparisons.length > 0 ? (
          viewMode === "segmented" ? (
            <div className="overflow-x-auto max-h-[650px] overflow-y-auto border border-slate-200 rounded-2xl shadow-xs bg-white">
              <table className="w-full text-left text-xs border-collapse font-sans min-w-[900px]">
                <thead className="sticky top-0 z-20 bg-[#f0fdfa] text-slate-700 uppercase font-mono text-[9px] font-bold border-b border-slate-200 shadow-xs">
                  <tr>
                    <th className="py-3 px-4 font-bold">Código</th>
                    <th className="py-3 px-4 font-sans font-bold">Ato Profissional Mapeado</th>
                    <th className="py-3 px-4 text-center border-l border-slate-100 bg-sky-50/40 text-sky-950 font-bold truncate max-w-[150px]" title={`${hospitalA} Fatur. (Quant)`}>{hospitalA} Fatur. (Quant)</th>
                    <th className="py-3 px-4 text-right bg-sky-50/40 text-sky-950 font-bold truncate max-w-[130px]" title={`${hospitalA} Unit.`}>{hospitalA} Unit.</th>
                    <th className="py-3 px-4 text-center border-l border-slate-100 bg-amber-50/40 text-amber-950 font-bold truncate max-w-[150px]" title={`${hospitalB} Fatur. (Quant)`}>{hospitalB} Fatur. (Quant)</th>
                    <th className="py-3 px-4 text-right bg-amber-50/40 text-amber-950 font-bold truncate max-w-[130px]" title={`${hospitalB} Unit.`}>{hospitalB} Unit.</th>
                    <th className="py-3 px-4 border-l border-slate-150 text-center font-bold">Status de Auditoria Clínico-financeira</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {codeComparisons.map((item) => {
                    const hasA = item.hospA.totalQty > 0;
                    const hasB = item.hospB.totalQty > 0;
                    
                    let statusEl = null;
                    let bgRow = "";

                    if (hasA && !hasB) {
                      statusEl = (
                        <span className="inline-flex flex-col items-center gap-0.5 bg-amber-50 border border-amber-200 text-amber-800 font-semibold px-2.5 py-1 rounded-xl text-[10px] min-w-[190px] justify-center shadow-sm">
                          <span className="flex items-center gap-1 truncate max-w-[180px]" title={`Exclusivo de ${hospitalA}`}>
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> Exclusivo de {hospitalA}
                          </span>
                          <span className="text-[9px] font-mono text-amber-700/90 font-medium">
                            Dif: +R$ {formatVal(item.hospA.avgUnit)} (+100,0%)
                          </span>
                        </span>
                      );
                      bgRow = "bg-amber-50/10";
                    } else if (!hasA && hasB) {
                      statusEl = (
                        <span className="inline-flex flex-col items-center gap-0.5 bg-rose-50 border border-rose-200 text-rose-800 font-semibold px-2.5 py-1 rounded-xl text-[10px] min-w-[190px] justify-center shadow-sm">
                          <span className="flex items-center gap-1 truncate max-w-[180px]" title={`Exclusivo de ${hospitalB}`}>
                            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" /> Exclusivo de {hospitalB}
                          </span>
                          <span className="text-[9px] font-mono text-rose-700/90 font-medium">
                            Dif: -R$ {formatVal(item.hospB.avgUnit)} (-100,0%)
                          </span>
                        </span>
                      );
                      bgRow = "bg-rose-50/10";
                    } else {
                      const priceDiffVal = item.hospA.avgUnit - item.hospB.avgUnit;
                      const priceDiffAbs = Math.abs(priceDiffVal);
                      const qtyDiff = Math.abs(item.hospA.totalQty - item.hospB.totalQty);

                      if (priceDiffAbs > 0.05) {
                        const pct = item.hospB.avgUnit > 0 ? (priceDiffAbs / item.hospB.avgUnit) * 100 : 0;
                        const sign = priceDiffVal >= 0 ? "+" : "-";
                        statusEl = (
                          <span className="inline-flex flex-col items-center gap-0.5 bg-purple-50 border border-purple-200 text-purple-800 font-semibold px-2.5 py-1 rounded-xl text-[10px] min-w-[190px] justify-center shadow-sm">
                            <span className="flex items-center gap-1">
                              <Coins className="w-3 h-3 text-purple-600" /> Preço Divergente
                            </span>
                            <span className="text-[9px] font-mono text-purple-700/90 font-medium">
                              {sign}R$ {formatVal(priceDiffAbs)}/unid ({sign}{pct.toFixed(1).replace('.', ',')}%)
                            </span>
                          </span>
                        );
                        bgRow = "bg-purple-50/5";
                      } else if (qtyDiff > 0) {
                        const unitValDiff = item.hospA.avgUnit - item.hospB.avgUnit;
                        const unitValDiffAbs = Math.abs(unitValDiff);
                        const pctUnit = item.hospB.avgUnit > 0 ? (unitValDiffAbs / item.hospB.avgUnit) * 100 : 0;
                        const sign = unitValDiffAbs < 0.01 ? "" : (unitValDiff >= 0 ? "+" : "-");
                        statusEl = (
                          <span className="inline-flex flex-col items-center gap-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium px-2.5 py-1 rounded-xl text-[10px] min-w-[190px] justify-center shadow-sm">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Quantidades Divergentes
                            </span>
                            <span className="text-[9px] font-mono text-emerald-700/90 font-medium">
                              Dif. Unit: {sign}R$ {formatVal(unitValDiffAbs)} ({sign}{pctUnit.toFixed(1).replace('.', ',')}%)
                            </span>
                          </span>
                        );
                      } else {
                        statusEl = (
                          <span className="inline-flex flex-col items-center gap-0.5 bg-teal-50 border border-teal-200 text-teal-800 px-2.5 py-1 rounded-xl text-[10px] min-w-[190px] justify-center shadow-sm">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-teal-600" /> Cobrança Equivalente
                            </span>
                            <span className="text-[9px] font-mono text-slate-500 font-medium">
                              Dif: R$ 0,00 (0,0%)
                            </span>
                          </span>
                        );
                      }
                    }

                    return (
                      <tr key={`codecomp-${item.code}_${item.hospA.avgUnit || item.hospB.avgUnit}`} className={`hover:bg-slate-50 transition duration-150 ${bgRow}`}>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {item.code || "---"}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 max-w-[220px] truncate" title={item.name}>
                          {item.name}
                        </td>
                        <td className="py-3 px-4 text-center font-mono border-l border-slate-100 bg-sky-50/10">
                          {hasA ? (
                            <span className="font-bold text-slate-805">{item.hospA.totalQty}</span>
                          ) : (
                            <span className="text-slate-400 italic">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono bg-sky-50/10 text-slate-500">
                          {hasA ? `R$ ${formatVal(item.hospA.avgUnit)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-center font-mono border-l border-slate-100 bg-amber-50/10">
                          {hasB ? (
                            <span className="font-bold text-slate-805">{item.hospB.totalQty}</span>
                          ) : (
                            <span className="text-slate-400 italic">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono bg-amber-50/10 text-slate-500">
                          {hasB ? `R$ ${formatVal(item.hospB.avgUnit)}` : "—"}
                        </td>
                        <td className="py-3 px-4 border-l border-slate-150 text-center">
                          {statusEl}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[650px] overflow-y-auto border border-slate-200 rounded-2xl shadow-xs bg-white animate-fade-in">
              <table className="w-full text-left text-xs border-collapse font-sans min-w-[1000px]">
                <thead className="sticky top-0 z-20 bg-[#f0fdfa] text-slate-700 uppercase font-mono text-[9px] font-bold border-b border-slate-200 shadow-xs">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center"></th>
                    <th className="py-3 px-4 font-bold">Código</th>
                    <th className="py-3 px-4 font-sans font-bold">Ato Profissional Mapeado</th>
                    <th className="py-3 px-4 text-center border-l border-slate-100 bg-sky-50/40 text-sky-950 font-bold">Hosp. A (Qtd Total)</th>
                    <th className="py-3 px-4 text-right bg-sky-50/40 text-sky-950 font-bold">Hosp. A Faturamento Total</th>
                    <th className="py-3 px-4 text-center border-l border-slate-100 bg-amber-50/40 text-amber-950 font-bold">Hosp. B (Qtd Total)</th>
                    <th className="py-3 px-4 text-right bg-amber-50/40 text-amber-950 font-bold">Hosp. B Faturamento Total</th>
                    <th className="py-3 px-4 border-l border-slate-150 text-center font-bold text-[#164194] bg-[#164194]/5">Comparativo Unitário (%)</th>
                    <th className="py-3 px-4 border-l border-slate-150 text-center font-bold">Consistência / Variações Estimadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {groupedCodeComparisons.map((item) => {
                    const isExpanded = expandedCodes.includes(item.code);
                    const qtyA = item.totalQtyA;
                    const valA = item.totalValA;
                    const qtyB = item.totalQtyB;
                    const valB = item.totalValB;
                    const varCount = item.variations.length;

                    // Calculate unit prices for parent comparison
                    const avgUnitA = qtyA > 0 ? valA / qtyA : 0;
                    const avgUnitB = qtyB > 0 ? valB / qtyB : 0;

                    const priceDiffVal = avgUnitA - avgUnitB;
                    const pct = avgUnitB > 0 ? (priceDiffVal / avgUnitB) * 100 : 0;

                    // Determine parent-level overall status
                    let statusBadge = null;
                    if (qtyA > 0 && qtyB === 0) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider truncate max-w-[200px]" title={`Exclusivo de ${hospitalA}`}>
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> Exclusivo de {hospitalA}
                        </span>
                      );
                    } else if (qtyB > 0 && qtyA === 0) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-extrabold text-[9px] uppercase tracking-wider animate-pulseStg truncate max-w-[200px]" title={`Ausente em ${hospitalA}`}>
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" /> Ausente em {hospitalA}
                        </span>
                      );
                    } else if (varCount > 1) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-md font-extrabold text-[9px] uppercase tracking-wider">
                          <Coins className="w-3 h-3 text-purple-600" /> Dispersão de Preços ({varCount} Níveis)
                        </span>
                      );
                    } else {
                      const priceA = item.variations[0]?.unitVal || 0;
                      const priceB = item.variations[0]?.unitVal || 0;
                      if (Math.abs(priceA - priceB) < 0.05) {
                        if (Math.abs(qtyA - qtyB) > 0) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-850 border border-sky-200 px-2.5 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3 text-sky-600" /> Qtd Divergente
                            </span>
                          );
                        } else {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-850 border border-teal-200 px-2.5 py-0.5 rounded-md font-semibold text-[9px] uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3 text-teal-600" /> Cobrança Equivalente
                            </span>
                          );
                        }
                      } else {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider">
                            <Coins className="w-3 h-3 text-purple-600" /> Preço Divergente ({varCount} Nível)
                          </span>
                        );
                      }
                    }

                    return (
                      <tbody key={`grouped-block-${item.code}`} className="border-b border-slate-100">
                        {/* Parent row */}
                        <tr 
                          onClick={() => toggleCodeExpand(item.code)}
                          className={`hover:bg-slate-50 transition duration-150 cursor-pointer select-none border-b border-transparent ${
                            isExpanded ? "bg-slate-50/80 font-medium" : ""
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">
                            {item.code || "---"}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 max-w-[210px] truncate" title={item.name}>
                            {item.name}
                          </td>
                          <td className="py-3 px-4 text-center font-mono border-l border-slate-100 bg-sky-50/10 text-slate-900">
                            {qtyA > 0 ? (
                              <span className="font-bold">{qtyA}</span>
                            ) : (
                              <span className="text-slate-450 italic">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono bg-sky-50/10 text-slate-700 font-semibold animate-fade-in">
                            {qtyA > 0 ? (
                              <div className="flex flex-col items-end">
                                <span>R$ {formatVal(valA)}</span>
                                <span className="text-[10px] text-slate-500 font-normal">
                                  Méd: R$ {formatVal(avgUnitA)}
                                </span>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-3 px-4 text-center font-mono border-l border-slate-100 bg-amber-50/10 text-slate-900">
                            {qtyB > 0 ? (
                              <span className="font-bold">{qtyB}</span>
                            ) : (
                              <span className="text-slate-450 italic">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono bg-amber-50/10 text-slate-700 font-semibold animate-fade-in">
                            {qtyB > 0 ? (
                              <div className="flex flex-col items-end">
                                <span>R$ {formatVal(valB)}</span>
                                <span className="text-[10px] text-slate-500 font-normal">
                                  Méd: R$ {formatVal(avgUnitB)}
                                </span>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-3 px-4 border-l border-slate-100 bg-indigo-50/10 text-center font-mono animate-fade-in">
                            {qtyA > 0 && qtyB > 0 ? (
                              <div className="flex flex-col items-center justify-center gap-1.5 py-0.5">
                                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                                  pct > 0.05 
                                    ? "bg-purple-100/90 text-purple-900 border border-purple-200/50 shadow-3xs" 
                                    : pct < -0.05 
                                      ? "bg-rose-100/95 text-rose-950 border border-rose-200/50 shadow-3xs" 
                                      : "bg-teal-100/90 text-blue-950 border border-teal-200/50 shadow-3xs"
                                }`}>
                                  {pct > 0 ? "+" : ""}{pct.toFixed(2).replace(".", ",")}%
                                </span>
                                <span className="text-[9px] font-semibold text-slate-500">
                                  Dif: {pct > 0.05 ? "Méd. A Maior" : pct < -0.05 ? "Méd. A Menor" : "Equivalente"}
                                </span>
                              </div>
                            ) : qtyA > 0 ? (
                              <div className="flex flex-col items-center justify-center gap-0.5 py-1">
                                <span className="text-[10px] font-semibold text-sky-850 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100/60">
                                  Unid: R$ {formatVal(avgUnitA)}
                                </span>
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 mx-auto px-1.5 py-0.5 rounded text-center leading-none mt-1">
                                  EXCLUSIVO A
                                </span>
                              </div>
                            ) : qtyB > 0 ? (
                              <div className="flex flex-col items-center justify-center gap-0.5 py-1">
                                <span className="text-[10px] font-semibold text-amber-850 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/60">
                                  Unid: R$ {formatVal(avgUnitB)}
                                </span>
                                <span className="text-[9px] font-bold text-rose-600 bg-rose-50 mx-auto px-1.5 py-0.5 rounded text-center leading-none mt-1">
                                  AUSENTE A
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 border-l border-slate-150 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {statusBadge}
                              <span className="text-[10px] font-medium text-[#164194] bg-[#164194]/5 border border-[#164194]/10 px-1.5 py-0.5 rounded-sm">
                                {varCount} {varCount === 1 ? "faixa" : "faixas"}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Interactive variation details subset */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={9} className="py-3.5 px-6">
                              <div className="bg-white border-2 border-[#164194]/15 rounded-2xl p-4 shadow-sm space-y-3 max-w-6xl mx-auto">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3.5 bg-[#164194] rounded"></div>
                                    <h4 className="text-xs font-bold text-slate-800 font-sans uppercase tracking-wider">
                                      Preservação por Valor Unitário: {item.name} (Atos faturados por código {item.code})
                                    </h4>
                                  </div>
                                  <span className="text-[9px] uppercase font-mono font-bold bg-slate-100 text-slate-650 px-2 py-0.5 rounded-md">
                                    Identificadas {varCount} {varCount === 1 ? "faixa de preço" : "faixas de preços"}
                                  </span>
                                </div>

                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-600 uppercase font-mono text-[9px] border-b border-slate-200">
                                      <th className="py-2 px-3 font-bold">Preço Unitário da Faixa</th>
                                      <th className="py-2 px-3 border-l border-slate-100 bg-sky-50/20 text-sky-950 text-center font-bold">HUCM / Hosp. A (Qtd)</th>
                                      <th className="py-2 px-3 bg-sky-50/20 text-sky-950 text-right font-bold">Faturamento Parcial A</th>
                                      <th className="py-2 px-3 border-l border-slate-100 bg-amber-50/20 text-amber-950 text-center font-bold">Competidor / Hosp. B (Qtd)</th>
                                      <th className="py-2 px-3 bg-amber-50/20 text-amber-950 text-right font-bold">Faturamento Parcial B</th>
                                      <th className="py-2 px-3 border-l border-slate-150 text-center font-bold">Análise e Cruzamento de Atos</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {item.variations.map((v, vIdx) => {
                                      const hasA_v = v.qtyA > 0;
                                      const hasB_v = v.qtyB > 0;

                                      let nestedStatus = null;
                                      if (hasA_v && !hasB_v) {
                                        nestedStatus = (
                                          <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Cobrado apenas pelo Hosp A
                                          </span>
                                        );
                                      } else if (!hasA_v && hasB_v) {
                                        nestedStatus = (
                                          <span className="inline-flex items-center gap-1.5 text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md font-extrabold text-[10px] animate-pulse">
                                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Item Ausente no HUCM (Relação de Perda!)
                                          </span>
                                        );
                                      } else {
                                        const qtyDiff = v.qtyA - v.qtyB;
                                        if (qtyDiff > 0) {
                                          nestedStatus = (
                                            <span className="inline-flex items-center gap-1.5 text-sky-800 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                              <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" /> HUCM faturou mais (+{qtyDiff} un.)
                                            </span>
                                          );
                                        } else if (qtyDiff < 0) {
                                          nestedStatus = (
                                            <span className="inline-flex items-center gap-1.5 text-rose-850 bg-rose-50 border border-rose-150 px-2 py-0.5 rounded-md font-extrabold text-[10px]">
                                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" /> Competidor faturou mais (+{Math.abs(qtyDiff)} un.)
                                            </span>
                                          );
                                        } else {
                                          nestedStatus = (
                                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-md font-medium text-[10px]">
                                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cobrança Equivalente
                                            </span>
                                          );
                                        }
                                      }

                                      return (
                                        <tr key={`var-${item.code}-${vIdx}`} className="hover:bg-slate-50 transition duration-100">
                                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                                            R$ {formatVal(v.unitVal)}
                                          </td>
                                          <td className="py-2.5 px-3 text-center font-mono border-l border-slate-100 bg-sky-50/5">
                                            {hasA_v ? (
                                              <span className="font-bold text-slate-800">{v.qtyA}</span>
                                            ) : (
                                              <span className="text-slate-400 italic">0</span>
                                            )}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-mono bg-sky-50/5 text-slate-505">
                                            {hasA_v ? `R$ ${formatVal(v.valA)}` : "—"}
                                          </td>
                                          <td className="py-2.5 px-3 text-center font-mono border-l border-slate-100 bg-amber-50/5">
                                            {hasB_v ? (
                                              <span className="font-bold text-slate-800">{v.qtyB}</span>
                                            ) : (
                                              <span className="text-slate-400 italic">0</span>
                                            )}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-mono bg-amber-50/5 text-slate-550">
                                            {hasB_v ? `R$ ${formatVal(v.valB)}` : "—"}
                                          </td>
                                          <td className="py-2.5 px-3 border-l border-slate-150 text-center font-sans">
                                            {nestedStatus}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="p-12 text-center text-slate-400 font-sans text-sm">
            Sem dados para cruzar os códigos deste procedimento nos hospitais selecionados.
          </div>
        )}
      </div>

      {/* 4. ACTIVE LIVE COMPARISON MULTI-HUD (Calculadora de Divergências) */}
      <div className="mb-6">
        <AnimatePresence>
          {(selectedRecordA !== null || selectedRecordB !== null) && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden"
            >
              {/* Ambient Background Glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-500/20 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/30">
                    <Coins className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-sans text-indigo-300 uppercase tracking-wide">
                      Mecanismo de Auditoria e Divergência de Atos (Linha a Linha)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Exibindo análise comparativa de repasse e simulação de ganho/perda baseada na linha clicada.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedRecordA(null);
                    setSelectedRecordB(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 font-medium px-2.5 py-1 rounded-xl transition duration-150 cursor-pointer"
                >
                  Limpar Amostras
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Box A */}
                <div className="lg:col-span-5 bg-sky-950/30 border border-sky-800/35 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-mono font-bold text-sky-400 tracking-wider">Hospital A (HUCM ou Selecionado)</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Amostra #{selectedRecordA ? sortedRecordsA.indexOf(selectedRecordA) + 1 : ""}
                      </span>
                    </div>
                    {selectedRecordA ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">N° AIH:</span>
                          <span className="font-mono font-bold text-slate-200">{selectedRecordA.SP_NAIH}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Ato Prof:</span>
                          <span className="font-mono font-bold text-sky-300">{selectedRecordA.SP_ATOPROF}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-300 truncate max-w-xs" title={selectedRecordA["PROCEDIMENTO ATO"]}>
                          {selectedRecordA["PROCEDIMENTO ATO"]}
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-sky-900/30 text-center">
                          <div className="bg-sky-900/40 py-1 rounded">
                            <span className="text-[8px] text-slate-400 block uppercase font-mono">Qtd</span>
                            <span className="font-mono font-bold text-sky-200 text-xs">{calcComparison?.qtyA}</span>
                          </div>
                          <div className="bg-sky-900/40 py-1 rounded col-span-2">
                            <span className="text-[8px] text-slate-400 block uppercase font-mono">Valor Billed</span>
                            <span className="font-mono font-bold text-sky-200 text-xs">R$ {formatVal(calcComparison?.valA || 0)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="py-6 text-center text-xs text-sky-450/60 italic">
                        Nenhum faturamento de {hospitalA} selecionado. Clique em uma linha na tabela detalhada esquerda abaixo.
                      </p>
                    )}
                  </div>
                  {selectedRecordA && (
                    <div className="mt-3 bg-sky-500/10 border border-sky-500/20 py-1.5 px-3 rounded-lg flex justify-between items-center">
                      <span className="text-[10px] uppercase font-mono font-semibold text-sky-300">Repasse Unitário</span>
                      <span className="font-mono font-extrabold text-sky-200 text-sm">R$ {formatVal(calcComparison?.unitA || 0)}</span>
                    </div>
                  )}
                </div>

                {/* Central Comparison Divider */}
                <div className="lg:col-span-2 flex flex-col items-center justify-center text-center py-2">
                  <div className="bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-full w-10 h-10 flex items-center justify-center font-mono font-extrabold text-xs shadow-md mb-2">
                    VS
                  </div>
                  {calcComparison && calcComparison.hasBoth && (
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-400 block font-mono">Diferença Unitária</span>
                      <span className="font-mono font-black text-amber-400 text-base">
                        R$ {formatVal(calcComparison.diffAbs)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Box B */}
                <div className="lg:col-span-5 bg-amber-950/20 border border-amber-800/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-mono font-bold text-amber-400 tracking-wider">Hospital B (Concorrente de Bench)</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Amostra #{selectedRecordB ? sortedRecordsB.indexOf(selectedRecordB) + 1 : ""}
                      </span>
                    </div>
                    {selectedRecordB ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">N° AIH:</span>
                          <span className="font-mono font-bold text-slate-200">{selectedRecordB.SP_NAIH}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Ato Prof:</span>
                          <span className="font-mono font-bold text-amber-300">{selectedRecordB.SP_ATOPROF}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-300 truncate max-w-xs" title={selectedRecordB["PROCEDIMENTO ATO"]}>
                          {selectedRecordB["PROCEDIMENTO ATO"]}
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-900/30 text-center">
                          <div className="bg-amber-900/40 py-1 rounded">
                            <span className="text-[8px] text-slate-400 block uppercase font-mono">Qtd</span>
                            <span className="font-mono font-bold text-amber-200 text-xs">{calcComparison?.qtyB}</span>
                          </div>
                          <div className="bg-amber-900/40 py-1 rounded col-span-2">
                            <span className="text-[8px] text-slate-400 block uppercase font-mono">Valor Billed</span>
                            <span className="font-mono font-bold text-amber-200 text-xs">R$ {formatVal(calcComparison?.valB || 0)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="py-6 text-center text-xs text-amber-450/60 italic">
                        Nenhum faturamento de {hospitalB} selecionado. Clique em uma linha na tabela detalhada direita abaixo.
                      </p>
                    )}
                  </div>
                  {selectedRecordB && (
                    <div className="mt-3 bg-amber-500/10 border border-amber-500/20 py-1.5 px-3 rounded-lg flex justify-between items-center">
                      <span className="text-[10px] uppercase font-mono font-semibold text-amber-300">Repasse Unitário</span>
                      <span className="font-mono font-extrabold text-amber-200 text-sm">R$ {formatVal(calcComparison?.unitB || 0)}</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Advanced Comparison Math Output */}
              {calcComparison && calcComparison.hasBoth && (
                <div className="mt-4 pt-3.5 border-t border-slate-800 bg-slate-950/50 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-indigo-400 mb-2">
                    <Activity className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider font-sans">Diferença e Análise Auditada de Valores</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Val and % Differentials */}
                    <div className="text-xs space-y-2 border-r border-slate-800/80 pr-4">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Repasse B em relação a A:</span>
                        <span className={`font-mono font-black ${calcComparison.pctB_vs_A > 0 ? "text-emerald-400" : calcComparison.pctB_vs_A < 0 ? "text-rose-400" : "text-slate-300"}`}>
                          {calcComparison.pctB_vs_A > 0 ? `+` : ""}{calcComparison.pctB_vs_A.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Repasse A em relação a B:</span>
                        <span className={`font-mono font-black ${calcComparison.pctA_vs_B > 0 ? "text-emerald-400" : calcComparison.pctA_vs_B < 0 ? "text-rose-400" : "text-slate-300"}`}>
                          {calcComparison.pctA_vs_B > 0 ? `+` : ""}{calcComparison.pctA_vs_B.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans italic leading-relaxed pt-0.5">
                        * O percentual de desvio mede a diferença de preços por faturamento unitário do ato.
                      </div>
                    </div>

                    {/* Financial Loss diagnosis for user */}
                    <div className="flex flex-col justify-center">
                      {calcComparison.unitA === calcComparison.unitB ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/15 p-2.5 rounded-lg text-xs text-emerald-400 flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <div>
                            <span className="block font-bold">Faturamentos Equivalentes</span>
                            Os valores unitários do código nos dois lançamentos selecionados são idênticos.
                          </div>
                        </div>
                      ) : calcComparison.unitA < calcComparison.unitB ? (
                        <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-300 space-y-2">
                          <div className="flex items-start gap-1.5">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                            <div>
                              <span className="block font-bold font-sans text-rose-200">Subfaturamento de AIH HUCM Detectado</span>
                              O hospital concorrente cobra <strong className="text-rose-200 font-mono">R$ {formatVal(calcComparison.diffAbs)}</strong> a mais por ato unitário deste código.
                            </div>
                          </div>
                          {calcComparison.sameCode ? (
                            <div className="bg-rose-950/40 p-1.5 px-2.5 rounded border border-rose-900/25 font-mono text-[11px] text-rose-200 flex justify-between">
                              <span>Sua Defasagem (Impacto Financeiro na Linha):</span>
                              <span className="font-black">- R$ {formatVal(calcComparison.hucmLostTotal)}</span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-450 pl-5 leading-normal">
                              Aviso: Comparando profissionais de códigos distintos. O HUCM recebe menos repasse neste comparativo de fita.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-xs text-emerald-300">
                          <div className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                            <div>
                              <span className="block font-bold text-emerald-250">HUCM com Faturamento Superior</span>
                              Seu faturamento unitário é <strong className="text-emerald-100 font-bold">R$ {formatVal(calcComparison.diffAbs)} ({calcComparison.pctA_vs_B.toFixed(1)}%)</strong> mais alto do que o praticado pelo concorrente nesta modalidade.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. Side-by-Side Detailed AIH Lists with Selection Support */}
      <div className="mb-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex gap-2 items-center text-xs text-slate-600">
        <span className="font-bold text-[#164194]">Instruções de Auditoria:</span>
        <p className="leading-snug">
          Clique em qualquer faturamento para carregá-lo no mecanismo ativo de comparação. Se houver um código correspondente no concorrente, ele será autolocalizado e selecionado para você!
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Table: HOSPITAL A AIH List */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                <h4 className="text-xs font-bold text-slate-800 font-sans uppercase truncate max-w-xs" title={hospitalA}>
                  Faturamento de {hospitalA}
                </h4>
              </div>
              <span className="text-[10px] font-mono bg-sky-100 text-sky-850 font-bold px-1.5 py-0.2 rounded-md">
                {recordsA.length} linhas
              </span>
            </div>

            {sortedRecordsA.length > 0 ? (
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead className="sticky top-0 z-20 bg-[#f0fdfa] text-slate-700 font-mono text-[9px] uppercase font-bold border-b border-slate-200 select-none shadow-xs">
                    <tr>
                      <th onClick={() => toggleSortA("aih")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150">
                        <div className="flex items-center gap-1">
                          <span>N° AIH</span>
                          {sortKeyA === "aih" ? (
                            sortDirA === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortA("code")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150">
                        <div className="flex items-center gap-1">
                          <span>Código Ato</span>
                          {sortKeyA === "code" ? (
                            sortDirA === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortA("name")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150">
                        <div className="flex items-center gap-1">
                          <span>Procedimento Ato</span>
                          {sortKeyA === "name" ? (
                            sortDirA === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortA("qty")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span>Quant</span>
                          {sortKeyA === "qty" ? (
                            sortDirA === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortA("val")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Valor</span>
                          {sortKeyA === "val" ? (
                            sortDirA === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortA("unit")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Ticket Unit.</span>
                          {sortKeyA === "unit" ? (
                            sortDirA === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortA("total_aih")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Ticket Total AIH</span>
                          {sortKeyA === "total_aih" ? (
                            sortDirA === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-700 text-[11px]">
                    {sortedRecordsA.map((r, i) => {
                      const val = parseVal(r.SP_VALATO);
                      const qty = r.SP_QTD_ATO || 1;
                      const avgUnit = qty > 0 ? val / qty : val;
                      const aihTotal = aihTotals[r.SP_NAIH] || 0;
                      const isSelected = selectedRecordA === r;

                      return (
                        <tr 
                          key={`recA-${i}`} 
                          onClick={() => handleSelectRowA(r)}
                          className={`cursor-pointer transition duration-150 relative ${
                            isSelected 
                              ? "bg-sky-50 font-medium border-l-4 border-sky-500 shadow-inner" 
                              : "hover:bg-slate-50 border-l-4 border-transparent"
                          }`}
                        >
                          <td className="px-3 py-2.5 text-slate-500 font-semibold font-mono">{r.SP_NAIH}</td>
                          <td className="px-3 py-2.5 text-slate-800 font-bold font-mono">{r.SP_ATOPROF || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-900 font-sans font-medium line-clamp-1 truncate max-w-[130px]" title={r["PROCEDIMENTO ATO"]}>
                            {r["PROCEDIMENTO ATO"]}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-805">{qty}</td>
                          <td className="px-3 py-2.5 text-right text-slate-500">R$ {formatVal(val)}</td>
                          <td className="px-3 py-2.5 text-right text-[#164194] font-bold">R$ {formatVal(avgUnit)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-900 font-extrabold bg-slate-50/40">
                            R$ {formatVal(aihTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center text-slate-400 font-sans italic">
                Nenhum faturamento registrado para {hospitalA} neste procedimento.
              </div>
            )}
          </div>
          
          <div className="bg-slate-50 p-3.5 border-t border-slate-100 text-[11px] text-slate-500 font-sans flex justify-between items-center">
            <span>Soma dos atos faturados:</span>
            <span className="font-bold text-slate-800 font-mono text-xs">
              R$ {formatVal(recordsA.reduce((sum, r) => sum + parseVal(r.SP_VALATO), 0))}
            </span>
          </div>
        </div>

        {/* Table: HOSPITAL B AIH List */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h4 className="text-xs font-bold text-slate-800 font-sans uppercase truncate max-w-xs" title={hospitalB}>
                  Faturamento de {hospitalB}
                </h4>
              </div>
              <span className="text-[10px] font-mono bg-amber-100 text-amber-850 font-bold px-1.5 py-0.2 rounded-md">
                {recordsB.length} linhas
              </span>
            </div>

            {sortedRecordsB.length > 0 ? (
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead className="sticky top-0 z-20 bg-[#f0fdfa] text-slate-700 font-mono text-[9px] uppercase font-bold border-b border-slate-200 select-none shadow-xs">
                    <tr>
                      <th onClick={() => toggleSortB("aih")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150">
                        <div className="flex items-center gap-1">
                          <span>N° AIH</span>
                          {sortKeyB === "aih" ? (
                            sortDirB === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortB("code")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150">
                        <div className="flex items-center gap-1">
                          <span>Código Ato</span>
                          {sortKeyB === "code" ? (
                            sortDirB === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortB("name")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150">
                        <div className="flex items-center gap-1">
                          <span>Procedimento Ato</span>
                          {sortKeyB === "name" ? (
                            sortDirB === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortB("qty")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span>Quant</span>
                          {sortKeyB === "qty" ? (
                            sortDirB === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortB("val")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Valor</span>
                          {sortKeyB === "val" ? (
                            sortDirB === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortB("unit")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Ticket Unit.</span>
                          {sortKeyB === "unit" ? (
                            sortDirB === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th onClick={() => toggleSortB("total_aih")} className="px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition duration-150 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>Ticket Total AIH</span>
                          {sortKeyB === "total_aih" ? (
                            sortDirB === "asc" ? <ArrowUp className="w-3 h-3 text-[#164194]" /> : <ArrowDown className="w-3 h-3 text-[#164194]" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-slate-405 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-700 text-[11px]">
                    {sortedRecordsB.map((r, i) => {
                      const val = parseVal(r.SP_VALATO);
                      const qty = r.SP_QTD_ATO || 1;
                      const avgUnit = qty > 0 ? val / qty : val;
                      const aihTotal = aihTotals[r.SP_NAIH] || 0;
                      const isSelected = selectedRecordB === r;

                      return (
                        <tr 
                          key={`recB-${i}`} 
                          onClick={() => handleSelectRowB(r)}
                          className={`cursor-pointer transition duration-150 relative ${
                            isSelected 
                              ? "bg-amber-50 font-medium border-l-4 border-amber-500 shadow-inner" 
                              : "hover:bg-slate-50 border-l-4 border-transparent"
                          }`}
                        >
                          <td className="px-3 py-2.5 text-slate-500 font-semibold font-mono">{r.SP_NAIH}</td>
                          <td className="px-3 py-2.5 text-slate-800 font-bold font-mono">{r.SP_ATOPROF || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-900 font-sans font-medium line-clamp-1 truncate max-w-[130px]" title={r["PROCEDIMENTO ATO"]}>
                            {r["PROCEDIMENTO ATO"]}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-805">{qty}</td>
                          <td className="px-3 py-2.5 text-right text-slate-500">R$ {formatVal(val)}</td>
                          <td className="px-3 py-2.5 text-right text-[#164194] font-bold">R$ {formatVal(avgUnit)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-900 font-extrabold bg-slate-50/40">
                            R$ {formatVal(aihTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center text-slate-400 font-sans italic">
                Nenhum faturamento registrado para o Hospital B neste procedimento.
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-3.5 border-t border-slate-100 text-[11px] text-slate-500 font-sans flex justify-between items-center">
            <span>Soma dos atos faturados:</span>
            <span className="font-bold text-slate-800 font-mono text-xs">
              R$ {formatVal(recordsB.reduce((sum, r) => sum + parseVal(r.SP_VALATO), 0))}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
