'use client';

import { useState, useRef, useEffect, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Model options                                                      */
/* ------------------------------------------------------------------ */

export interface ModelOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

const VIDU_MODELS: ModelOption[] = [
  {
    value: "viduq3-turbo",
    label: "Vidu Q3 Turbo",
    description: "Fast generation, best cost-performance",
  },
  {
    value: "viduq3-pro",
    label: "Vidu Q3 Pro",
    description: "Highest quality, 4K support",
  },
  {
    value: "viduq3",
    label: "Vidu Q3",
    description: "Balanced quality and speed",
  },
  {
    value: "viduq2-pro",
    label: "Vidu Q2 Pro",
    description: "Previous gen pro model",
  },
  {
    value: "viduq2",
    label: "Vidu Q2",
    description: "Previous gen standard",
  },
  {
    value: "vidu2.0",
    label: "Vidu 2.0",
    description: "Legacy model",
  },
];

/** Image-generation models (text2image / reference2image).
 *  viduq2: supports both text-to-image and reference-to-image.
 *  viduq1: supports reference-to-image only. */
const VIDU_IMAGE_MODELS: ModelOption[] = [
  {
    value: "viduq2",
    label: "Vidu Q2",
    description: "Text-to-image + reference-to-image",
  },
  {
    value: "viduq1",
    label: "Vidu Q1",
    description: "Reference-to-image only",
  },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models?: ModelOption[];
  accent?: string;
  /** Optional icon rendered before the label in the trigger button */
  iconSlot?: ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */


const ML: Record<string, { border: string; bg: string; text: string }> = {
  blue: { border: "hover:border-blue-500/50", bg: "bg-blue-500/10", text: "text-blue-400" },
  purple: { border: "hover:border-purple-500/50", bg: "bg-purple-500/10", text: "text-purple-400" },
  green: { border: "hover:border-green-500/50", bg: "bg-green-500/10", text: "text-green-400" },
  red: { border: "hover:border-red-500/50", bg: "bg-red-500/10", text: "text-red-400" },
  amber: { border: "hover:border-amber-500/50", bg: "bg-amber-500/10", text: "text-amber-400" },
  zinc: { border: "hover:border-zinc-500/50", bg: "bg-zinc-500/10", text: "text-zinc-400" },
  neutral: { border: "hover:border-neutral-500/50", bg: "bg-neutral-500/10", text: "text-neutral-400" },
};
function mc(key: keyof typeof ML[string], accent: string): string { return ML[accent]?.[key] ?? ML.zinc[key]; }

export default function ModelSelector({
  value,
  onChange,
  models = VIDU_MODELS,
  accent = "blue",
  iconSlot,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = models.find((m) => m.value === value) ?? models[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-200 hover:border-${accent}-500/50 transition-colors text-left`}
      >
        {iconSlot && <span className="shrink-0">{iconSlot}</span>}
        <span className="flex-1 truncate">{selected.label}</span>
        <svg
          className={`w-3 h-3 text-zinc-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          {models.map((m) => {
            const isActive = m.value === value;
            return (
              <button
                key={m.value}
                onClick={(e) => { e.stopPropagation(); handleSelect(m.value); }}
                className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs text-left transition-colors ${
                  isActive
                    ? `bg-${accent}-500/10 text-${accent}-400`
                    : "text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {m.icon && <span className="shrink-0">{m.icon}</span>}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{m.label}</div>
                  {m.description && (
                    <div className="text-[10px] text-zinc-500 truncate">{m.description}</div>
                  )}
                </div>
                {isActive && (
                  <svg className={`w-3.5 h-3.5 text-${accent}-400 shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { VIDU_MODELS };
export { VIDU_IMAGE_MODELS };
