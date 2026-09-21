import React from "react";

interface FelumaLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showInstitutionText?: boolean;
  variant?: "blue" | "bw" | "white";
}

/**
 * Logomarca Oficial 100% Fiel da FELUMA
 * Fundação Educacional Lucas Machado / Hospital Universitário Ciências Médicas (HUCM)
 * 
 * Gerado diretamente a partir dos ativos oficiais da instituição:
 * - Emblema azul com o pilar inclinado e a hélice (Bastão de Esculápio / DNA) com 5 lóbulos fiéis
 * - Wordmark "FELUMA" com a tipografia institucional original
 */
export default function FelumaLogo({
  className = "",
  size = "md",
  showInstitutionText = false,
  variant = "blue",
}: FelumaLogoProps) {
  // Proporções exatas da marca (380 x 452)
  const pixelSizes = {
    sm: { w: 38, h: 45 },
    md: { w: 52, h: 62 },
    lg: { w: 70, h: 83 },
    xl: { w: 90, h: 107 },
  }[size];

  const logoSrc =
    variant === "bw"
      ? "/feluma-logo-bw.png"
      : "/feluma-logo-blue.png";

  const EmblemGraphic = (
    <img
      src={logoSrc}
      alt="FELUMA - Fundação Educacional Lucas Machado"
      width={pixelSizes.w}
      height={pixelSizes.h}
      className="w-full h-full object-contain select-none pointer-events-none drop-shadow-xs"
      draggable={false}
      loading="eager"
    />
  );

  if (!showInstitutionText) {
    return (
      <div
        className={`flex items-center justify-center shrink-0 ${className}`}
        style={{ width: pixelSizes.w, height: pixelSizes.h }}
        title="Fundação Educacional Lucas Machado - FELUMA"
      >
        {EmblemGraphic}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: pixelSizes.w, height: pixelSizes.h }}
      >
        {EmblemGraphic}
      </div>
      <div className="flex flex-col text-left">
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#f3b924]">
          Fundação Educacional Lucas Machado
        </span>
        <h1 className="text-lg md:text-xl font-black text-[#164194] tracking-tight leading-tight">
          HOSPITAL UNIVERSITÁRIO CIÊNCIAS MÉDICAS
        </h1>
        <p className="text-xs font-semibold text-slate-500 tracking-normal">
          Núcleo de Inteligência e Auditoria de Faturamento SUS (SIH/SIA)
        </p>
      </div>
    </div>
  );
}
