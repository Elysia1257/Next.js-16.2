import type { ReactNode } from "react";

/* Accent map -- only entries used by ImageNode (blue), VideoNode (purple), zinc (fallback) */
const AM: Record<string, { focus: string; border: string; ring: string; bg: string; bgHover: string; text: string }> = {
  blue:    { focus: "focus:ring-blue-400",    border: "border-blue-500",    ring: "ring-2 ring-blue-400",    bg: "bg-blue-500",    bgHover: "bg-blue-500/10",    text: "text-blue-400" },
  purple:  { focus: "focus:ring-purple-400",  border: "border-purple-500",  ring: "ring-2 ring-purple-400",  bg: "bg-purple-500",  bgHover: "bg-purple-500/10",  text: "text-purple-400" },
  zinc:    { focus: "focus:ring-zinc-400",    border: "border-zinc-500",    ring: "ring-2 ring-zinc-400",    bg: "bg-zinc-500",    bgHover: "bg-zinc-500/10",    text: "text-zinc-400" },
};

function ac(key: keyof typeof AM[string], color: string): string {
  return AM[color]?.[key] ?? AM.zinc[key];
}

export const CARD_W = 320;

export const HANDLE_CLASS =
  "!w-2.5 !h-2.5 !border-[1.5] !border-zinc-500/50" as const;

export const CARD_BASE =
  "bg-[#0f0f14] rounded-lg border border-[#1c1c24] node-shadow text-sm overflow-hidden transition-shadow duration-200" as const;

export function cardBorder(selected: boolean, accent: string): string {
  if (!selected) return "border-[#1c1c24]";
  const B: Record<string, string> = {
    blue: "border-blue-500/30",
    purple: "border-purple-500/30",
    zinc: "border-zinc-500/30",
  };
  return "glow-ring-" + accent + " " + (B[accent] ?? B.zinc);
}

export const INPUT_CLASS =
  "w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 resize-none focus:outline-none focus:ring-0 focus:border-zinc-600 transition-colors" as const;

export function inputFocus(accent: string): string {
  return ac("focus", accent);
}

export const FIELD_LABEL =
  "text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1" as const;

export const ACTION_BUTTON_GROUP =
  "flex items-center gap-0.5" as const;

const HOV: Record<string, string> = {
  "zinc-200": "hover:text-zinc-200",
  "zinc-300": "hover:text-zinc-300",
  "zinc-400": "hover:text-zinc-400",
  "red-400":  "hover:text-red-400",
};

export function actionButtonClass(hoverColor = "zinc-200"): string {
  const hover = HOV[hoverColor] ?? HOV["zinc-200"];
  return "p-1 rounded hover:bg-zinc-700 text-zinc-400 " + hover + " transition-colors";
}

export function deleteButtonClass(): string {
  return "p-1 rounded hover:bg-red-900/40 text-zinc-500 hover:text-red-400 transition-colors";
}

export function DeleteIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function Segmented<T extends string>({
  options, value, onChange,
  activeClass = "bg-zinc-600 border-zinc-500 text-zinc-100",
  inactiveClass = "bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700",
}: { options: T[]; value: T; onChange: (v: T) => void; activeClass?: string; inactiveClass?: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button key={opt} onClick={(e) => { e.stopPropagation(); onChange(opt); }}
          className={"px-2 py-0.5 text-[9px] font-medium rounded border transition-colors " + (value === opt ? activeClass : inactiveClass)}>
          {opt}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, accent = "purple", label }: { checked: boolean; onChange: (v: boolean) => void; accent?: string; label?: string }) {
  const track = checked ? ac("bg", accent) : "bg-zinc-700";
  const dot = checked ? "translate-x-3" : "translate-x-0.5";
  return (
    <button onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={"flex items-center gap-2 " + (label ? "w-full justify-between" : "") + " group"}>
      {label && (<span className="text-[9px] font-medium text-zinc-500 group-hover:text-zinc-400 transition-colors">{label}</span>)}
      <div className={"relative w-7 h-4 rounded-full transition-colors shrink-0 " + track}>
        <div className={"absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform " + dot} />
      </div>
    </button>
  );
}

export const SLIDER_THUMB =
  "appearance-none h-1 rounded-full bg-zinc-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" as const;

export function sliderThumbColor(accent: string): string {
  const bg = ac("bg", accent);
  const bgHover = ac("bgHover", accent).replace("/10", "");
  return "[&::-webkit-slider-thumb]:" + bg + " [&::-webkit-slider-thumb]:hover:" + bgHover;
}

export function Spinner({ className = "h-2.5 w-2.5" }: { className?: string }) {
  return (
    <svg className={"animate-spin " + className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
