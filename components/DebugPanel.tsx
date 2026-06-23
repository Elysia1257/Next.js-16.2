"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ErrorEntry {
  id: number;
  time: string;
  message: string;
  type: string;
  source: string;
  stack: string;
}

let errorId = 0;
const errorStore: ErrorEntry[] = (typeof window !== "undefined" && (window as any).__debugErrorStore) || [];
if (typeof window !== "undefined") (window as any).__debugErrorStore = errorStore;
let listeners: (() => void)[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

// Intercept console.error and window errors
if (typeof window !== "undefined") {
  // Store originals on window to survive HMR
  if (!(window as any).__origConsoleError) {
    (window as any).__origConsoleError = console.error.bind(console);
  }
  if (!(window as any).__origConsoleWarn) {
    (window as any).__origConsoleWarn = console.warn.bind(console);
  }

  const origError = (window as any).__origConsoleError;
  delete (console as any).error;
  console.error = (...args: unknown[]) => {
    origError(...args);
    const parts: string[] = [];
    args.forEach((a) => {
      if (a instanceof Error) {
        parts.push(`${a.name}: ${a.message}`);
        if (a.stack) parts.push(a.stack.split("\n").slice(0, 4).join("\n"));
      } else if (typeof a === "object") {
        try { parts.push(JSON.stringify(a)); } catch { parts.push(String(a)); }
      } else {
        parts.push(String(a));
      }
    });
    errorStore.push({ id: ++errorId, time: new Date().toLocaleTimeString(), message: parts.join(" | "), type: "console.error", source: "", stack: "" });
    if (errorStore.length > 50) errorStore.shift();
    notify();
  };

  const origWarn = (window as any).__origConsoleWarn;
  delete (console as any).warn;
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    const msg = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    errorStore.push({ id: ++errorId, time: new Date().toLocaleTimeString(), message: `[warn] ${msg}`, type: "console.warn", source: "", stack: "" });
    if (errorStore.length > 50) errorStore.shift();
    notify();
  };

  if (!(window as any).__debugListenersAttached) {
    (window as any).__debugListenersAttached = true;
    window.addEventListener("error", (e) => {
      const err = e.error;
      const type = err?.name || "ErrorEvent";
      const msg = err?.message || e.message || "Unknown";
      const src = e.filename ? `${e.filename.replace(/^.*[\\\/]/, "")}:${e.lineno}:${e.colno}` : "";
      const stk = err?.stack ? err.stack.split("\n").slice(0, 5).join("\n") : "";
      errorStore.push({ id: ++errorId, time: new Date().toLocaleTimeString(), message: msg, type, source: src, stack: stk });
      if (errorStore.length > 50) errorStore.shift();
      notify();
  }, true); // capture phase

    window.addEventListener("unhandledrejection", (e) => {
      const err = e.reason;
      const type = err?.name || "UnhandledRejection";
      const msg = err?.message || String(err || "Rejection");
      const stk = err?.stack ? err.stack.split("\n").slice(0, 5).join("\n") : "";
      errorStore.push({ id: ++errorId, time: new Date().toLocaleTimeString(), message: msg, type, source: "", stack: stk });
      if (errorStore.length > 50) errorStore.shift();
      notify();
    });
  }
}

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<ErrorEntry[]>(errorStore);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setErrors([...errorStore]);
  }, []);

  useEffect(() => {
    listeners.push(refresh);
    return () => {
      listeners = listeners.filter((fn) => fn !== refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollTop = bottomRef.current.scrollHeight;
    }
  }, [errors, open]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-3 left-3 z-[9999] px-3 py-1.5 rounded-lg text-xs font-mono bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors shadow-lg"
        title="Debug console"
      >
        {open ? "Close Debug" : `Debug (${errors.length})`}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-12 left-3 z-[9998] w-[480px] max-h-[400px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-850">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Errors ({errors.length})
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => { console.error("Test error: " + new Date().toISOString()); }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Test
              </button>
              <button
                onClick={() => { errorStore.length = 0; refresh(); }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div ref={bottomRef} className="flex-1 overflow-y-auto p-2 space-y-1">
            {errors.length === 0 && (
              <p className="text-[10px] text-zinc-600 text-center py-8">No errors captured</p>
            )}
            {errors.map((err) => (
              <div key={err.id} className="text-[10px] font-mono bg-zinc-800/50 rounded px-2 py-1 border border-zinc-800 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-zinc-500">{err.time}</span>
                  <span className="text-[9px] px-1 rounded bg-zinc-700 text-zinc-400">{err.type}</span>
                  {err.source && <span className="text-[9px] text-zinc-600">{err.source}</span>}
                </div>
                <div className="text-red-400 break-all">{err.message}</div>
                {err.stack && (
                  <pre className="text-[9px] text-zinc-500 whitespace-pre-wrap break-all">{err.stack}</pre>
                )}
              </div>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-zinc-800 bg-zinc-850">
            <p className="text-[9px] text-zinc-600">
              Captures console.error, unhandled errors, and promise rejections
            </p>
          </div>
        </div>
      )}
    </>
  );
}
