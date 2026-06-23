"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StartEndVideoData } from "@/store/canvasStore";
import { useCanvasStore } from "@/store/canvasStore";
import { generateVideo, pollTaskResult } from "@/lib/api";
import { computeReferences } from "@/hooks/useReferenceEngine";
import {
  CARD_W,
  HANDLE_CLASS,
  CARD_BASE,
  cardBorder,
  INPUT_CLASS,
  inputFocus,
  FIELD_LABEL,
  Segmented,
  Toggle,
  SLIDER_THUMB,
  sliderThumbColor,
  Spinner,
  ACTION_BUTTON_GROUP,
  deleteButtonClass,
  DeleteIcon,
} from "./nodeStyles";
import ModelSelector from "@/components/ui/ModelSelector";
import { useI18n } from "@/lib/i18n";

const ACCENT = "amber";
const RATIOS = ["16:9", "9:16", "1:1"];
const RESOLUTIONS = ["720p", "1080p"];

const ST = {
  pending: { accent: "amber", badge: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "PENDING" },
  running: { accent: "blue", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "RUNNING" },
  success: { accent: "green", badge: "bg-green-500/20 text-green-400 border-green-500/30", label: "SUCCESS" },
  failed: { accent: "red", badge: "bg-red-500/20 text-red-400 border-red-500/30", label: "FAILED" },
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function StartEndVideoNode({ id, data, selected }: NodeProps) {
  const { t } = useI18n();
  const typed = data as StartEndVideoData & { status?: string; video_url?: string; thumbnail_url?: string; error_message?: string };
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const [generating, setGenerating] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(typed.prompt ?? "");
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalPrompt(typed.prompt ?? "");
  }, [typed.prompt]);

  // Find start/end frame images from connected source nodes
  const { startUrl, endUrl } = useMemo(() => {
    const incoming = edges.filter((e) => e.target === id);
    let start: string | null = null;
    let end: string | null = null;
    for (const edge of incoming) {
      const src = nodes.find((n) => n.id === edge.source);
      if (!src) continue;
      const d = src.data as Record<string, unknown>;
      const url = (d.url || d.image_url) as string | undefined;
      if (!url) continue;
      if (edge.sourceHandle === "IMAGE" || edge.targetHandle === "start") {
        if (!start) start = url;
        else if (!end) end = url;
      } else {
        if (!end) end = url;
      }
    }
    // Fallback: first edge = start, second = end
    if (!start && !end && incoming.length >= 2) {
      const s1 = nodes.find((n) => n.id === incoming[0].source);
      const s2 = nodes.find((n) => n.id === incoming[1].source);
      start = (s1?.data as Record<string, unknown>)?.url as string || (s1?.data as Record<string, unknown>)?.image_url as string || null;
      end = (s2?.data as Record<string, unknown>)?.url as string || (s2?.data as Record<string, unknown>)?.image_url as string || null;
    } else if (!start && incoming.length >= 1) {
      const s1 = nodes.find((n) => n.id === incoming[0].source);
      start = (s1?.data as Record<string, unknown>)?.url as string || (s1?.data as Record<string, unknown>)?.image_url as string || null;
    }
    return { startUrl: start, endUrl: end };
  }, [edges, nodes, id]);

  const hasInputs = !!(startUrl || endUrl);
  const duration = typed.duration || 10;
  const resolution = typed.resolution || "1080p";
  const aspectRatio = typed.aspect_ratio || "16:9";
  const nodeStatus = (generating ? "running" : (typed.status as string ?? "pending")) as keyof typeof ST;
  const st = ST[nodeStatus] ?? ST.pending;
  const isRunning = nodeStatus === "running";
  const isPending = nodeStatus === "pending";
  const isSuccess = nodeStatus === "success";
  const isFailed = nodeStatus === "failed";
  const hasResult = isSuccess || isFailed || isRunning;

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await generateVideo({
        prompt: typed.prompt ?? "",
        model: typed.model ?? "viduq3-turbo",
        duration,
        aspect_ratio: aspectRatio,
        resolution,
        audio_enabled: typed.audio_enabled ?? true,
        vidu_mode: "start_end2video",
        start_frame_url: startUrl ?? undefined,
        end_frame_url: endUrl ?? undefined,
      } as any);
      const poll = async () => {
        const result = await pollTaskResult(res.task_id);
        if (result.status === "success" || result.status === "failed") {
          updateNodeData(id, {
            status: result.status,
            video_url: result.video_url,
            thumbnail_url: result.thumbnail_url,
            error_message: result.error_message,
          } as Partial<StartEndVideoData> & Record<string, unknown>);
          setGenerating(false);
        } else {
          setTimeout(poll, 2000);
        }
      };
      setTimeout(poll, 2000);
    } catch (err) {
      console.error("Generate failed:", err);
      updateNodeData(id, { status: "failed", error_message: String(err) } as Partial<StartEndVideoData> & Record<string, unknown>);
      setGenerating(false);
    }
  }, [id, typed, duration, aspectRatio, resolution, startUrl, endUrl, updateNodeData]);

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setLocalPrompt(value);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        updateNodeData(id, { prompt: value } as Partial<StartEndVideoData> & Record<string, unknown>);
      }, 500);
    },
    [],
  );

  return (
    <div className={`${CARD_BASE} ${cardBorder(selected, ACCENT)}`} style={{ width: CARD_W }}>
      {/* Start Frame Handle */}
      <Handle type="target" position={Position.Top} id="start" className={`${HANDLE_CLASS} !bg-amber-500`} title="Start Frame" style={{ left: "25%" }} />
      {/* End Frame Handle */}
      <Handle type="target" position={Position.Top} id="end" className={`${HANDLE_CLASS} !bg-orange-500`} title="End Frame" style={{ left: "75%" }} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1c1c24] bg-[#0f0f14]/80">
        <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 17.25v-10.5a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-12a2.25 2.25 0 01-2.25-2.25zM9.75 9l5.25 3-5.25 3V9z" />
        </svg>
        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider truncate flex-1">Start-End Video</span>
        {isRunning && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Generating" />}
        <div className={ACTION_BUTTON_GROUP}>
          <button onClick={(e) => { e.stopPropagation(); deleteNode(id); }} className={deleteButtonClass()} title="Delete node">
            <DeleteIcon />
          </button>
        </div>
      </div>

      {/* Frame previews */}
      <div className="flex gap-2 px-3 pt-3 pb-2">
        <div className="flex-1">
          <div className={FIELD_LABEL + " text-amber-400"}>{t("nodes.startEnd.startFrame")}</div>
          <div className="rounded-lg overflow-hidden border border-[#1c1c24] bg-black h-24 flex items-center justify-center mt-1">
            {startUrl ? (
              <img src={startUrl} alt="Start" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-zinc-600">{t("nodes.startEnd.connectSource")}</span>
            )}
          </div>
        </div>
        <div className="flex-1">
          <div className={FIELD_LABEL + " text-orange-400"}>{t("nodes.startEnd.endFrame")}</div>
          <div className="rounded-lg overflow-hidden border border-[#1c1c24] bg-black h-24 flex items-center justify-center mt-1">
            {endUrl ? (
              <img src={endUrl} alt="End" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-zinc-600">{t("nodes.startEnd.connectSource")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Model */}
      <div className="px-3 pt-1 pb-2.5">
        <div className={FIELD_LABEL}>{t("common.model")}</div>
        <ModelSelector value={typed.model ?? "viduq3-turbo"} onChange={(v) => updateNodeData(id, { model: v } as Partial<StartEndVideoData> & Record<string, unknown>)} accent={ACCENT} />
      </div>

      {/* Prompt */}
      <div className="px-3 pb-2.5">
        <div className={FIELD_LABEL}>Prompt</div>
        <textarea
          className={`${INPUT_CLASS} ${inputFocus(ACCENT)} min-h-[64px] resize-y text-[11px] leading-relaxed`}
          rows={2}
          placeholder="Describe the transition..."
          value={localPrompt}
          onChange={handlePromptChange}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Duration */}
      <div className="px-3 pb-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider">{t("nodes.video.duration")}</span>
          <input type="number" min={3} max={16} value={duration} onChange={(e) => updateNodeData(id, { duration: Math.max(3, Math.min(16, Number(e.target.value) || 3)) } as Partial<StartEndVideoData> & Record<string, unknown>)} onClick={(e) => e.stopPropagation()} className="w-12 text-right text-[11px] font-mono bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 focus:outline-none focus:border-amber-500" />
        </div>
        <div onMouseDown={(e) => e.stopPropagation()} className="py-2 -mx-1 px-1">
          <input type="range" min={3} max={16} step={1} value={duration} onChange={(e) => updateNodeData(id, { duration: Number(e.target.value) } as Partial<StartEndVideoData> & Record<string, unknown>)} className="w-full cursor-pointer h-3 rounded-full bg-zinc-700 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:cursor-grab active:[&::-webkit-slider-thumb]:cursor-grabbing [&::-webkit-slider-thumb]:shadow-lg" />
        </div>
        <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5"><span>3s</span><span>16s</span></div>
      </div>

      {/* Aspect Ratio */}
      <div className="px-3 pb-2.5">
        <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">{t("common.aspectRatio")}</div>
        <Segmented options={RATIOS} value={aspectRatio} onChange={(v) => updateNodeData(id, { aspect_ratio: v } as Partial<StartEndVideoData> & Record<string, unknown>)} activeClass="bg-amber-500 border-amber-500 text-white" />
      </div>

      {/* Resolution */}
      <div className="px-3 pb-2.5">
        <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">{t("common.resolution")}</div>
        <Segmented options={RESOLUTIONS} value={resolution} onChange={(v) => updateNodeData(id, { resolution: v } as Partial<StartEndVideoData> & Record<string, unknown>)} activeClass="bg-amber-500 border-amber-500 text-white" />
      </div>

      {/* Audio Toggle */}
      <div className="px-3 pb-2.5">
        <div className={FIELD_LABEL}>{t("nodes.video.audio")}</div>
        <Toggle checked={typed.audio_enabled ?? true} onChange={(v) => updateNodeData(id, { audio_enabled: v } as Partial<StartEndVideoData> & Record<string, unknown>)} accent={ACCENT} />
      </div>

      {/* Result */}
      {hasResult && (
        <div className="px-3 pb-2 space-y-2">
          <div className="border-t border-[#1c1c24]" />
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.badge}`}>
            {(isRunning || isPending) && <Spinner />}
            {st.label}
          </div>
          {isSuccess && typed.video_url && (
            <div className="rounded-lg overflow-hidden border border-[#1c1c24] bg-black">
              <video className="w-full" controls preload="metadata" src={typed.video_url} style={{ maxHeight: 180 }} />
            </div>
          )}
        </div>
      )}

      {/* Generate Button */}
      <div className="px-3 pb-3 pt-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
          disabled={generating}
          className="w-full py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? "Generating..." : "Generate Start-End Video"}
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} className={`${HANDLE_CLASS} !bg-amber-500`} />
    </div>
  );
}

export default StartEndVideoNode;