import React, { useState, useEffect } from "react";
import {
  Share2,
  Copy,
  Check,
  X,
  Globe,
  Database,
  Users,
  ShieldCheck,
  ExternalLink,
  Table,
  CheckCircle2,
} from "lucide-react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProcedure: string;
  activeTab: string;
  serverDatasetInfo: {
    isFixed: boolean;
    metadata?: {
      fileName?: string;
      totalRecords?: number;
      uniqueAihs?: number;
      uniqueHospitals?: number;
      uniqueProcedures?: number;
      competencePeriod?: string;
      totalValueFormatted?: string;
      updatedAt?: string;
    };
  };
  totalRecords: number;
  slotNames: (string | null)[];
}

export default function ShareModal({
  isOpen,
  onClose,
  selectedProcedure,
  activeTab,
  serverDatasetInfo,
  totalRecords,
  slotNames,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [includeProcedure, setIncludeProcedure] = useState(true);

  if (!isOpen) return null;

  // Build the sharable URL based on options
  const baseUrl = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  const params = new URLSearchParams();
  if (includeProcedure && selectedProcedure) {
    params.set("proc", selectedProcedure);
  }
  if (activeTab && activeTab !== "dashboard") {
    params.set("tab", activeTab);
  }
  const queryString = params.toString();
  const shareableUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const input = document.getElementById("share-url-input") as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    }
  };

  const activeBases = slotNames.filter(Boolean) as string[];
  const baseName =
    serverDatasetInfo.metadata?.fileName ||
    (activeBases.length > 0 ? activeBases.join(" + ") : "Base Central SUS");

  return (
    <div
      id="share-modal-backdrop"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="share-modal-content"
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0d2c68] via-[#164194] to-[#1a4da6] p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-[#f3b924] shrink-0 shadow-inner">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#f3b924] font-bold">
                  Ferramenta Compartilhada
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h2 className="text-base font-extrabold tracking-tight font-sans">
                Compartilhar Análise do Ticket Médio
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 flex flex-col gap-5 text-left font-sans">
          {/* Shared Guarantee Banner */}
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <strong className="font-bold text-emerald-950 block mb-0.5">
                Garantia de Fidelidade Multi-Usuário:
              </strong>
              Todos os usuários que acessarem este link carregarão a <strong>mesma Base Central de Dados</strong> gravada no servidor. Os cálculos de ticket médio, gaps e benchmarks serão rigorosamente idênticos para toda a equipe.
            </div>
          </div>

          {/* URL Configuration */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Link de Acesso Direto:</span>
              <span className="text-[11px] font-normal text-slate-500">
                Pronto para envio via e-mail, WhatsApp ou Teams
              </span>
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="share-url-input"
                  type="text"
                  readOnly
                  value={shareableUrl}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-[#164194]"
                />
              </div>
              <button
                type="button"
                id="btn-copy-share-url"
                onClick={handleCopy}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs shrink-0 ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-[#164194] hover:bg-[#0f2e6b] text-white active:scale-95"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sharing Scope Options */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2.5">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Opções de Compartilhamento
            </span>
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
              <input
                type="radio"
                name="share-mode"
                checked={includeProcedure}
                onChange={() => setIncludeProcedure(true)}
                className="mt-0.5 text-[#164194] focus:ring-[#164194]"
              />
              <div>
                <strong className="block text-slate-900 font-bold">
                  Com procedimento atual selecionado
                </strong>
                <span className="text-slate-500 text-[11px] font-mono break-all">
                  {selectedProcedure || "Todos os procedimentos"}
                </span>
              </div>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 pt-1 border-t border-slate-200/60">
              <input
                type="radio"
                name="share-mode"
                checked={!includeProcedure}
                onChange={() => setIncludeProcedure(false)}
                className="mt-0.5 text-[#164194] focus:ring-[#164194]"
              />
              <div>
                <strong className="block text-slate-900 font-bold">
                  Visão Geral da Base (Padrão)
                </strong>
                <span className="text-slate-500 text-[11px]">
                  O colega abrirá no primeiro procedimento disponível da Base Central.
                </span>
              </div>
            </label>
          </div>

          {/* Central Database Snapshot Info */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-white text-xs">
            <div className="flex items-center justify-between border-b border-slate-150 pb-2 mb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#164194]" />
                Base Central Ativa no Servidor
              </span>
              <span className="text-[10px] bg-blue-50 text-[#164194] font-bold px-2 py-0.5 rounded-md border border-blue-200">
                Sincronizada
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Arquivo</span>
                <span className="font-semibold text-slate-800 truncate block font-mono" title={baseName}>
                  {baseName}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Registros / AIHs</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {totalRecords.toLocaleString("pt-BR")}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Faturamento Total</span>
                <span className="font-semibold text-emerald-700 font-mono">
                  {serverDatasetInfo.metadata?.totalValueFormatted || "—"}
                </span>
              </div>
              {serverDatasetInfo.metadata?.competencePeriod && (
                <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-100 text-slate-500">
                  <span className="text-slate-400 font-bold">Competência: </span>
                  <span className="font-mono text-slate-700">{serverDatasetInfo.metadata.competencePeriod}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">
            Hospital Universitário Ciências Médicas • FELUMA
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
