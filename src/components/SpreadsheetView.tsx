import { useState, useMemo } from "react";
import {
  Search,
  ArrowUpDown,
  Download,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileSpreadsheet,
  PlusCircle,
  HelpCircle
} from "lucide-react";
import { SUSRecord } from "../types";
import { formatVal, parseVal } from "../data/mockData";
import Papa from "papaparse";

interface SpreadsheetProps {
  records: SUSRecord[];
  onToggleValidation: (index: number) => void;
  onUpdateRecordValue: (index: number, field: keyof SUSRecord, val: any) => void;
}

type SortField = "SP_NAIH" | "HOSPITAL" | "PROCEDIMENTO PRINCIPAL" | "PROCEDIMENTO ATO" | "SP_QTD_ATO" | "SP_VALATO" | "Valida";
type SortOrder = "asc" | "desc";

export default function SpreadsheetView({
  records,
  onToggleValidation,
  onUpdateRecordValue,
}: SpreadsheetProps) {
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "invalid">("all");
  const [procFilter, setProcFilter] = useState<string>("all");
  const [hospFilter, setHospFilter] = useState<string>("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("SP_NAIH");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Editable Cell Track
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<keyof SUSRecord | null>(null);
  const [tempValue, setTempValue] = useState("");

  // Get unique lists for filtering dropdowns
  const uniqueHospitals = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.HOSPITAL))).sort();
  }, [records]);

  const uniqueProcedures = useMemo(() => {
    return Array.from(new Set(records.map((r) => r["PROCEDIMENTO PRINCIPAL"]))).sort();
  }, [records]);

  // Map record with original array indices for updating callback safely
  const recordsWithOriginalIndex = useMemo(() => {
    return records.map((record, index) => ({ record, index }));
  }, [records]);

  // Filter and sort records
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...recordsWithOriginalIndex];

    // Search filter
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        ({ record }) =>
          String(record.SP_NAIH).includes(term) ||
          record.HOSPITAL.toLowerCase().includes(term) ||
          record["PROCEDIMENTO PRINCIPAL"].toLowerCase().includes(term) ||
          record["PROCEDIMENTO ATO"].toLowerCase().includes(term) ||
          (record.SP_CIDPRI && record.SP_CIDPRI.toLowerCase().includes(term))
      );
    }

    // Status filter
    if (statusFilter === "valid") {
      result = result.filter(({ record }) => record.Valida !== false);
    } else if (statusFilter === "invalid") {
      result = result.filter(({ record }) => record.Valida === false);
    }

    // Procedure filter
    if (procFilter !== "all") {
      result = result.filter(({ record }) => record["PROCEDIMENTO PRINCIPAL"] === procFilter);
    }

    // Hospital filter
    if (hospFilter !== "all") {
      result = result.filter(({ record }) => record.HOSPITAL === hospFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let valA: any = a.record[sortField];
      let valB: any = b.record[sortField];

      if (sortField === "SP_VALATO") {
        valA = parseVal(String(valA));
        valB = parseVal(String(valB));
      }

      if (typeof valA === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        // numbers or booleans
        valA = valA === true ? 1 : valA === false ? 0 : valA;
        valB = valB === true ? 1 : valB === false ? 0 : valB;
        if (valA === undefined) valA = 0;
        if (valB === undefined) valB = 0;
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
    });

    return result;
  }, [recordsWithOriginalIndex, searchTerm, statusFilter, procFilter, hospFilter, sortField, sortOrder]);

  // Handle paginate
  const totalRows = filteredAndSortedRecords.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    // Clamp current page to safe boundaries
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredAndSortedRecords.slice(start, start + pageSize);
  }, [filteredAndSortedRecords, currentPage, pageSize, totalPages]);

  // Dynamic metrics on filtered/all data
  const summaryMetrics = useMemo(() => {
    let totalSum = 0;
    let legitCount = 0;
    records.forEach((r) => {
      const v = parseVal(r.SP_VALATO) * (r.SP_QTD_ATO || 1);
      totalSum += v;
      if (r.Valida !== false) {
        legitCount++;
      }
    });

    return {
      totalSum,
      legitCount,
      totalCount: records.length,
      utilizationPercent: records.length > 0 ? (legitCount / records.length) * 100 : 0,
    };
  }, [records]);

  // Handle column header clicking sorts
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Switch to inline inputs for easy numeric adjustment
  const startEditingCell = (index: number, field: keyof SUSRecord, initialVal: string | number) => {
    setEditingIndex(index);
    setEditingField(field);
    setTempValue(String(initialVal));
  };

  const saveCellEdit = (index: number) => {
    if (editingField) {
      let finalVal: any = tempValue;
      if (editingField === "SP_QTD_ATO" || editingField === "SP_NAIH") {
        finalVal = parseInt(tempValue, 10) || 0;
      }
      onUpdateRecordValue(index, editingField, finalVal);
    }
    setEditingIndex(null);
    setEditingField(null);
  };

  // Export current list to CSV
  const handleExportCSV = () => {
    // Generate CSV representing current table state (using papaparse unparse)
    const exportData = filteredAndSortedRecords.map(({ record }) => {
      return {
        SP_NAIH: record.SP_NAIH,
        HOSPITAL: record.HOSPITAL,
        "PROCEDIMENTO PRINCIPAL": record["PROCEDIMENTO PRINCIPAL"],
        "PROCEDIMENTO ATO": record["PROCEDIMENTO ATO"],
        SP_QTD_ATO: record.SP_QTD_ATO,
        SP_VALATO: record.SP_VALATO,
        "TICKET PROCEDIMENTO REAL": record["TICKET PROCEDIMENTO REAL"],
        Valida: record.Valida ? "VERDADEIRO" : "FALSO",
      };
    });

    const csvStr = Papa.unparse(exportData);
    const blob = new Blob(["\uFEFF" + csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `planilha_faturamento_auditada.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div id="excel-spreadsheet-view" className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
      {/* Top statistics about current CSV data */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-emerald-500 text-white text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded font-bold">
                Leitura Completa Ativada
              </span>
              <span className="bg-slate-700 text-slate-300 text-[10px] uppercase font-mono px-2 py-1.5 rounded font-mono">
                Modo Excel Fiel (100% dos dados)
              </span>
            </div>
            <h2 className="text-xl font-bold flex items-center gap-2 font-sans text-white">
              <FileSpreadsheet className="w-5.5 h-5.5 text-emerald-400" />
              Visualizador Integrado da Planilha CSV
            </h2>
            <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
              Explore a fita bruta de faturamento com as colunas completas da planilha. Tente clicar sob o status na coluna <strong className="text-white">Valida</strong> para ativar/desativar auditabilidade do item ou altere quantidades/valores, atualizando instantaneamente os gráficos.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white border-0 px-4 py-2 text-xs font-semibold rounded-xl transition cursor-pointer shrink-0 self-stretch sm:self-center justify-center font-mono"
          >
            <Download className="w-4 h-4" /> Exportar CSV Auditado
          </button>
        </div>

        {/* Real totals based on file columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-805 text-left font-mono">
          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-700/30">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Linhas na Planilha</span>
            <div className="text-lg font-extrabold text-white mt-0.5">{summaryMetrics.totalCount.toLocaleString()}</div>
          </div>
          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-700/30">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Itens Válidos</span>
            <span className="text-[10px] text-slate-500 font-sans ml-1">({Math.round(summaryMetrics.utilizationPercent)}%)</span>
            <div className="text-lg font-extrabold text-emerald-400 mt-0.5">{summaryMetrics.legitCount.toLocaleString()}</div>
          </div>
          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-700/30">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Itens Desconsiderados</span>
            <div className="text-lg font-extrabold text-rose-400 mt-0.5">{(summaryMetrics.totalCount - summaryMetrics.legitCount).toLocaleString()}</div>
          </div>
          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-700/30 font-bold">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Faturamento Somado Atos</span>
            <div className="text-lg font-extrabold text-amber-300 mt-0.5">R$ {formatVal(summaryMetrics.totalSum)}</div>
          </div>
        </div>
      </div>

      {/* Spreadsheet Search and Filtering controls */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Text Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar AIH, Hospital ou Procedimento..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 text-xs font-medium rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Quick validations filters */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shrink-0">
            <button
              onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
              className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition ${
                statusFilter === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => { setStatusFilter("valid"); setCurrentPage(1); }}
              className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition text-emerald-700 flex items-center gap-1 ${
                statusFilter === "valid" ? "bg-emerald-100/90 text-emerald-950" : "hover:bg-emerald-50"
              }`}
            >
              Válidos
            </button>
            <button
              onClick={() => { setStatusFilter("invalid"); setCurrentPage(1); }}
              className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition text-rose-700 flex items-center gap-1 ${
                statusFilter === "invalid" ? "bg-rose-100 text-rose-950" : "hover:bg-rose-50"
              }`}
            >
              Inválidos
            </button>
          </div>
        </div>

        {/* Dropdown column quick filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter by hospital */}
          <div className="flex items-center gap-1 border border-slate-200 bg-white rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={hospFilter}
              onChange={(e) => { setHospFilter(e.target.value); setCurrentPage(1); }}
              className="outline-none border-0 text-slate-800 bg-transparent pr-1 font-semibold max-w-[150px] cursor-pointer"
            >
              <option value="all">Filtrar Hospital: Todos</option>
              {uniqueHospitals.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Filter by primary procedure */}
          <div className="flex items-center gap-1 border border-slate-200 bg-white rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={procFilter}
              onChange={(e) => { setProcFilter(e.target.value); setCurrentPage(1); }}
              className="outline-none border-0 text-slate-800 bg-transparent pr-1 font-semibold max-w-[200px] cursor-pointer"
            >
              <option value="all">Filtrar Procedimento: Todos</option>
              {uniqueProcedures.map(p => (
                <option key={p} value={p}>{p.length > 40 ? p.slice(0, 38) + "..." : p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Spreadsheet Content Table */}
      <div className="overflow-x-auto max-h-[700px] overflow-y-auto border-b border-slate-200">
        <table className="w-full text-left border-collapse min-w-[1000px] font-mono text-[11px] text-slate-700">
          <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs">
            <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 select-none">
              <th
                onClick={() => handleSort("SP_NAIH")}
                className="py-3 px-4 uppercase tracking-wider text-left border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition text-[10px]"
              >
                <span className="flex items-center gap-2">
                  SP_NAIH (AIH) <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </span>
              </th>
              
              <th
                onClick={() => handleSort("HOSPITAL")}
                className="py-3 px-4 uppercase tracking-wider text-left border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition text-[10px] w-64"
              >
                <span className="flex items-center gap-2">
                  Hospital <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </span>
              </th>

              <th
                onClick={() => handleSort("PROCEDIMENTO PRINCIPAL")}
                className="py-3 px-4 uppercase tracking-wider text-left border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition text-[10px] w-80"
              >
                <span className="flex items-center gap-2">
                  Procedimento Principal <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </span>
              </th>

              <th
                onClick={() => handleSort("PROCEDIMENTO ATO")}
                className="py-3 px-4 uppercase tracking-wider text-left border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition text-[10px] w-64"
              >
                <span className="flex items-center gap-2">
                  Ato Faturado (Procedimento Ato) <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </span>
              </th>

              <th
                onClick={() => handleSort("SP_QTD_ATO")}
                className="py-3 px-4 uppercase tracking-wider text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition text-[10px] w-24"
              >
                <span className="flex items-center justify-center gap-2">
                  Qtd <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </span>
              </th>

              <th
                onClick={() => handleSort("SP_VALATO")}
                className="py-3 px-4 uppercase tracking-wider text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition text-[10px] w-28"
              >
                <span className="flex items-center justify-end gap-2">
                  SP_VALATO <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </span>
              </th>

              <th className="py-3 px-4 uppercase tracking-wider text-right border-r border-slate-200 text-[10px] w-28">
                Tkt Real AIH
              </th>

              <th
                onClick={() => handleSort("Valida")}
                className="py-3 px-4 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-200 transition text-[10px] w-24"
              >
                <span className="flex items-center justify-center gap-2">
                  Valida <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 px-4 text-center text-slate-400 font-sans text-xs">
                  Nenhum registro encontrado correspondendo aos filtros aplicados na planilha.
                </td>
              </tr>
            ) : (
              paginatedRecords.map(({ record, index: originalIndex }, rowIdx) => {
                const isSelectedForEditQtd = editingIndex === originalIndex && editingField === "SP_QTD_ATO";
                const isSelectedForEditVal = editingIndex === originalIndex && editingField === "SP_VALATO";

                return (
                  <tr
                    key={`spread-${rowIdx}`}
                    className={`hover:bg-slate-50/80 transition duration-75 text-slate-700 ${
                      record.Valida === false ? "bg-rose-50/20 text-slate-400" : ""
                    }`}
                  >
                    {/* SP_NAIH */}
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-600 border-r border-slate-150 relative">
                      {record.SP_NAIH}
                    </td>

                    {/* HOSPITAL */}
                    <td className="py-2.5 px-4 font-sans border-r border-slate-150 max-w-xs truncate text-[11px]" title={record.HOSPITAL}>
                      {record.HOSPITAL}
                    </td>

                    {/* PROCEDIMENTO PRINCIPAL */}
                    <td className="py-2.5 px-4 font-sans text-slate-500 border-r border-slate-150 max-w-xs truncate text-[11px]" title={record["PROCEDIMENTO PRINCIPAL"]}>
                      {record["PROCEDIMENTO PRINCIPAL"]}
                    </td>

                    {/* PROCEDIMENTO ATO */}
                    <td className="py-2.5 px-4 font-sans text-slate-600 border-r border-slate-150 max-w-xs truncate text-[11px]" title={record["PROCEDIMENTO ATO"]}>
                      {record["PROCEDIMENTO ATO"]}
                    </td>

                    {/* SP_QTD_ATO */}
                    <td
                      onClick={() => startEditingCell(originalIndex, "SP_QTD_ATO", record.SP_QTD_ATO)}
                      className="py-2.5 px-4 text-center border-r border-slate-150 font-bold hover:bg-slate-100 cursor-pointer"
                    >
                      {isSelectedForEditQtd ? (
                        <input
                          type="number"
                          autoFocus
                          value={tempValue}
                          onChange={(e) => setTempValue(e.target.value)}
                          onBlur={() => saveCellEdit(originalIndex)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveCellEdit(originalIndex); }}
                          className="w-16 p-0.5 text-center text-xs bg-white border border-blue-400 rounded focus:outline-none"
                        />
                      ) : (
                        record.SP_QTD_ATO
                      )}
                    </td>

                    {/* SP_VALATO */}
                    <td
                      onClick={() => startEditingCell(originalIndex, "SP_VALATO", record.SP_VALATO)}
                      className="py-2.5 px-4 text-right border-r border-slate-150 font-mono text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      {isSelectedForEditVal ? (
                        <input
                          type="text"
                          autoFocus
                          value={tempValue}
                          onChange={(e) => setTempValue(e.target.value)}
                          onBlur={() => saveCellEdit(originalIndex)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveCellEdit(originalIndex); }}
                          className="w-20 p-0.5 text-right text-xs bg-white border border-blue-400 rounded focus:outline-none"
                        />
                      ) : (
                        `R$ ${record.SP_VALATO}`
                      )}
                    </td>

                    {/* TICKET PROCEDIMENTO REAL */}
                    <td className="py-2.5 px-4 text-right border-r border-slate-150 font-mono text-slate-800 font-semibold bg-slate-50/50">
                      {record["TICKET PROCEDIMENTO REAL"] ? `R$ ${record["TICKET PROCEDIMENTO REAL"]}` : "-"}
                    </td>

                    {/* Valida toggle */}
                    <td className="py-2 px-4 text-center">
                      <button
                        onClick={() => onToggleValidation(originalIndex)}
                        className={`inline-flex items-center justify-center rounded-lg p-1 hover:bg-slate-100 cursor-pointer transition border-0 bg-transparent`}
                        title="Clique para alternar validade do faturamento"
                      >
                        {record.Valida !== false ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-sans text-[10px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> VERDADEIRO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-sans text-[10px] font-bold">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> FALSO
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Spreadsheet Bottom Paginate Controls */}
      <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-xs text-slate-500 font-sans">
          Trabalhando com linhas <strong className="text-slate-800">{(currentPage - 1) * pageSize + 1}</strong> a{" "}
          <strong className="text-slate-800">{Math.min(currentPage * pageSize, totalRows)}</strong> de{" "}
          <strong className="text-slate-800">{totalRows.toLocaleString()}</strong> de faturamento local.
        </span>

        <div className="flex items-center gap-4">
          {/* Select page size */}
          <div className="flex items-center gap-1 text-xs text-slate-500 font-sans">
            <span>Visualizar:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold outline-none cursor-pointer"
            >
              <option value={10}>10 linhas</option>
              <option value={25}>25 linhas</option>
              <option value={50}>50 linhas</option>
              <option value={100}>100 linhas</option>
            </select>
          </div>

          {/* Nav pagination */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold px-2 text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
