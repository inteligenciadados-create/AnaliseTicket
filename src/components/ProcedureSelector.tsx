import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, RefreshCw } from "lucide-react";

interface ProcedureSelectorProps {
  procedures: string[];
  selectedProcedure: string;
  onChange: (proc: string) => void;
  isLoading?: boolean;
}

export default function ProcedureSelector({
  procedures,
  selectedProcedure,
  onChange,
  isLoading = false,
}: ProcedureSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Sort the procedures alphabetically (memoized, procedures already sorted if passed sorted)
  const sortedProcedures = useMemo(() => {
    return procedures;
  }, [procedures]);

  // 2. Filter list by search term
  const filteredProcedures = useMemo(() => {
    if (!searchTerm.trim()) return sortedProcedures;
    const term = searchTerm.toLowerCase();
    return sortedProcedures.filter((p) => p.toLowerCase().includes(term));
  }, [sortedProcedures, searchTerm]);

  // 3. Render at most 100 items to guarantee 60 FPS scrolling and typing
  const visibleProcedures = useMemo(() => {
    return filteredProcedures.slice(0, 100);
  }, [filteredProcedures]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (proc: string) => {
    onChange(proc);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div id="searchable-procedure-select-root" ref={containerRef} className="relative w-full">
      {/* Trigger Button / Current Selection Box */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#164194] transition text-left flex items-center justify-between gap-2 shadow-sm font-medium"
      >
        <div className="flex items-center gap-2 truncate pr-2 min-w-0">
          {isLoading && <RefreshCw className="w-3.5 h-3.5 text-[#164194] animate-spin shrink-0" />}
          <span className="truncate text-[13px] md:text-sm text-slate-900">
            {selectedProcedure || "Selecione um Procedimento..."}
          </span>
          {isLoading && (
            <span className="text-[10px] bg-blue-100 text-[#164194] font-semibold px-1.5 py-0.5 rounded shrink-0">
              Consultando...
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-100 max-h-80 flex flex-col">
          {/* Search Box Header */}
          <div className="relative p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Digite para buscar procedimento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-8.5 pr-8 py-1.5 text-xs font-semibold rounded-lg outline-none focus:ring-2 focus:ring-[#164194]"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-0 bg-transparent"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Procedures Scrollable Area */}
          <div className="overflow-y-auto flex-1 py-1 max-h-56 divide-y divide-slate-50 font-sans">
            {filteredProcedures.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-400">
                Nenhum procedimento correspondente. Letras maiúsculas e minúsculas são indiferentes.
              </div>
            ) : (
              visibleProcedures.map((proc) => {
                const isSelected = proc === selectedProcedure;
                return (
                  <button
                    key={proc}
                    type="button"
                    onClick={() => handleSelect(proc)}
                    className={`w-full text-left px-4 py-2 text-xs md:text-[12px] transition flex items-start gap-2.5 font-medium border-0 ${
                      isSelected
                        ? "bg-[#164194]/10 text-[#164194] font-bold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isSelected ? "text-[#164194] opacity-100" : "opacity-0"}`} />
                    <span className="leading-relaxed">{proc}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Info Footer */}
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between font-mono">
            <span>
              {filteredProcedures.length > 100
                ? `Mostrando os 100 primeiros de ${filteredProcedures.length}`
                : `${filteredProcedures.length} encontrados`}
            </span>
            <span>Total: {procedures.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
