"use client";

import { memo, useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { VideoNodeData, NodeRef } from "@/store/canvasStore";
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

const ACCENT = "purple";
const RESOLUTIONS = ["720p", "1080p"];
const RATIOS = ["16:9", "9:16", "1:1"];

const ST = {
  pending: { accent: "amber", badge: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "PENDING" },
  running: { accent: "blue", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "RUNNING" },
  success: { accent: "green", badge: "bg-green-500/20 text-green-400 border-green-500/30", label: "SUCCESS" },
  failed: { accent: "red", badge: "bg-red-500/20 text-red-400 border-red-500/30", label: "FAILED" },
} as const;

function formatRefLabel(ref: NodeRef): string {
  return ref.type === "IMAGE" ? `图${ref.index}` : `视频${ref.index}`;
}

function parseRefTags(
  text: string,
  refs: NodeRef[],
): { valid: NodeRef[]; invalid: string[] } {
  const valid: NodeRef[] = [];
  const invalid: string[] = [];
  const tagRegex = /@(图|视频)(\d+)/g;
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    const prefix = match[1];
    const num = parseInt(match[2], 10);
    const type = prefix === "图" ? "IMAGE" : "VIDEO";
    const found = refs.find((r) => r.type === type && r.index === num);
    if (found) valid.push(found);
    else invalid.push(match[0]);
  }
  return { valid, invalid };
}

function VideoNode({ id, data, selected }: NodeProps) {
  const { t } = useI18n();
  const typed = data as VideoNodeData & { status?: string; video_url?: string; thumbnail_url?: string; error_message?: string; references?: { images: NodeRef[]; videos: NodeRef[] } };
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const [generating, setGenerating] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [acFilter, setAcFilter] = useState("");
  const [localPrompt, setLocalPrompt] = useState(typed.prompt ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const acRef = useRef<HTMLDivElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync Zustand -> local when external prompt changes (e.g. workflow load)
  useEffect(() => {
    setLocalPrompt(typed.prompt ?? "");
  }, [typed.prompt]);

  // Compute connected references
  const refs = useMemo(() => computeReferences(id, edges, nodes), [id, edges, nodes]);
  const allRefs = [...refs.images, ...refs.videos];
  const prevRefSig = useRef("");
  console.log("input connections:", allRefs.length);
  const allRefsRef = useRef(allRefs);
  allRefsRef.current = allRefs;

  // Sync references into node.data
  useEffect(() => {
    const newRefs = computeReferences(id, edges, nodes);
    const sig = JSON.stringify({ i: newRefs.images.length, v: newRefs.videos.length });
    if (sig === prevRefSig.current) return;
    prevRefSig.current = sig;
    updateNodeData(id, { references: newRefs } as Partial<VideoNodeData> & Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodes]);

  const promptText = typed.prompt ?? "";
  const tagValidation = useMemo(() => parseRefTags(promptText, allRefs), [promptText, allRefs]);

  /* ---- Read upstream reference images from connected AssetNodes ---- */
  const upstreamUrls = useMemo(() => {
    const incoming = edges.filter((e) => e.target === id);
    const urls: string[] = [];
    for (const edge of incoming) {
      const src = nodes.find((n) => n.id === edge.source);
      if (!src) continue;
      const d = src.data as Record<string, unknown>;
      const url = d.image_url || d.video_url || d.url || ((d as unknown as { reference_images?: string[] }).reference_images?.[0]);
      if (url) urls.push(url as string);
    }
    return urls;
  }, [edges, nodes, id]);

  const upstreamImageUrl = upstreamUrls[0] ?? null;
  const duration = typed.duration || 10;
  const resolution = typed.resolution || "1080p";
  const aspectRatio = typed.aspect_ratio || "16:9";

  const nodeStatus = (typed.status as string ?? "pending") as keyof typeof ST;
  const st = ST[nodeStatus] ?? ST.pending;
  const isRunning = nodeStatus === "running";
  const isPending = nodeStatus === "pending";
  const isSuccess = nodeStatus === "success";
  const isFailed = nodeStatus === "failed";
  const hasResult = isSuccess || isFailed || isRunning;
  const hasConnectedSources = refs.images.length > 0 || refs.videos.length > 0;

  /* ---- Per-node Generate ---- */
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const mode = (typed.vidu_mode as string) || "img2video";
      // img2video: single image, reference2video: all connected images
      const images = mode === "reference2video" ? upstreamUrls : upstreamUrls.slice(0, 1);
      const res = await generateVideo({
        prompt: typed.prompt ?? "",
        model: typed.model ?? "viduq3-turbo",
        duration: typed.duration ?? 10,
        aspect_ratio: typed.aspect_ratio ?? "16:9",
        resolution: typed.resolution ?? "1080p",
        audio_enabled: typed.audio_enabled ?? true,
        ...(typed.seed_lock ? { seed: typed.seed ?? 0 } : {}),
        subtitle_enabled: typed.subtitle_enabled ?? false,
        vidu_mode: mode,
        reference_images: images,
      });
      const poll = async () => {
        const result = await pollTaskResult(res.task_id);
        if (result.status === "success" || result.status === "failed") {
          updateNodeData(id, {
            status: result.status,
            video_url: result.video_url,
            thumbnail_url: result.thumbnail_url,
            error_message: result.error_message,
          } as Partial<VideoNodeData> & Record<string, unknown>);
          setGenerating(false);
        } else {
          setTimeout(poll, 2000);
        }
      };
      setTimeout(poll, 2000);
    } catch (err) {
      console.error("Generate failed:", err);
      updateNodeData(id, { status: "failed", error_message: String(err) } as Partial<VideoNodeData> & Record<string, unknown>);
      setGenerating(false);
    }
  }, [id, typed, upstreamUrls, updateNodeData]);

  /* ---- @ autocomplete logic ---- */
  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setLocalPrompt(value);

      // Debounce Zustand sync to avoid re-render interruption on every keystroke
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        updateNodeData(id, { prompt: value } as Partial<VideoNodeData> & Record<string, unknown>);
      }, 500);

      const cursorPos = e.target.selectionStart ?? 0;
      const textBefore = value.substring(0, cursorPos);
      const atMatch = textBefore.match(/@([\u4e00-\u9fa5]*)(\d*)$/);
      if (atMatch && allRefsRef.current.length > 0) {
        setAcFilter(atMatch[1] || "");
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleAcSelect = useCallback(
    (ref: NodeRef) => {
      if (!textareaRef.current) return;
      const ta = textareaRef.current;
      const cursorPos = ta.selectionStart ?? 0;
      const value = ta.value;
      const textBefore = value.substring(0, cursorPos);
      const atIdx = textBefore.lastIndexOf("@");
      const newText =
        value.substring(0, atIdx) +
        "@" + formatRefLabel(ref) + " " +
        value.substring(cursorPos);
      updateNodeData(id, { prompt: newText } as Partial<VideoNodeData> & Record<string, unknown>);
      setShowAutocomplete(false);
      setTimeout(() => {
        ta.focus();
        const pos = atIdx + formatRefLabel(ref).length + 2;
        ta.setSelectionRange(pos, pos);
      }, 0);
    },
    [id, updateNodeData],
  );

  useEffect(() => {
    if (!showAutocomplete) return;
    const handler = (e: MouseEvent) => {
      if (acRef.current && !acRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAutocomplete]);

  const filteredRefs = useMemo(() => {
    if (!acFilter) return allRefs;
    const f = acFilter.toLowerCase();
    return allRefs.filter(
      (r) =>
        formatRefLabel(r).toLowerCase().includes(f) ||
        r.fileName.toLowerCase().includes(f),
    );
  }, [allRefs, acFilter]);

  return (
    <div className={`${CARD_BASE} ${cardBorder(selected, ACCENT)}`} style={{ width: CARD_W }}>
      <Handle type="target" position={Position.Top} className={`${HANDLE_CLASS} !bg-purple-500`} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1c1c24] bg-[#0f0f14]">
        <svg className="w-4 h-4 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
        </svg>
        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider truncate flex-1">Video</span>
        {isRunning && <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shrink-0" title="Generating" />}
        {isPending && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Pending" />}
        {isFailed && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Failed" />}
        <div className={ACTION_BUTTON_GROUP}>
          <button onClick={(e) => { e.stopPropagation(); deleteNode(id); }} className={deleteButtonClass()} title="Delete node">
            <DeleteIcon />
          </button>
        </div>
      </div>

      {/* ---- Reference cards panel ---- */}
      {hasConnectedSources && (
        <div className="px-3 pt-3 pb-1">
          <div className={FIELD_LABEL}>参考图（{allRefs.length}）</div>
          <div className="flex overflow-x-auto gap-2 pb-1">
            {allRefs.map((ref) => (
              <div
                key={ref.nodeId}
                className="shrink-0 flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/60 rounded-md px-2 py-1 cursor-default"
                title={ref.fileName}
              >
                {ref.thumbnail ? (
                  <img src={ref.thumbnail} alt={ref.fileName} className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${ref.type === "IMAGE" ? "bg-blue-500/20" : "bg-purple-500/20"}`}>
                    <span className={`text-[7px] ${ref.type === "IMAGE" ? "text-blue-400" : "text-purple-400"}`}>
                      {ref.type === "IMAGE" ? "IMG" : "VID"}
                    </span>
                  </div>
                )}
                <span className="text-[9px] text-zinc-300 truncate max-w-[80px]">{ref.fileName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview (removed — upstream shown in reference cards) */}

      {/* Model */}
      <div className="px-3 pt-3 pb-2.5">
        <div className={FIELD_LABEL}>{t("common.model")}</div>
        <ModelSelector value={typed.model ?? "viduq3-turbo"} onChange={(v) => updateNodeData(id, { model: v } as Partial<VideoNodeData> & Record<string, unknown>)} accent={ACCENT} />
      </div>

      {/* Prompt with @ autocomplete */}
      <div className="px-3 pb-2.5 relative">
        <div className="flex items-center justify-between">
          <div className={FIELD_LABEL + " mb-0"}>Prompt</div>
          {tagValidation.invalid.length > 0 && (
            <span className="text-[9px] text-red-400 flex items-center gap-1" title="Invalid references found">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              Invalid ref
            </span>
          )}
        </div>
        <textarea
          ref={textareaRef}
          className={`${INPUT_CLASS} ${inputFocus(ACCENT)} min-h-[88px] resize-y text-[11px] leading-relaxed`}
          rows={3}
          placeholder="Describe the video... Type @ to reference sources"
          value={localPrompt}
          onChange={handlePromptChange}
          onClick={(e) => e.stopPropagation()}
        />

        {showAutocomplete && filteredRefs.length > 0 && (
          <div
            ref={acRef}
            className="absolute z-[60] left-3 right-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-36 overflow-y-auto"
            style={{ top: "100%", marginTop: 2 }}
          >
            {filteredRefs.map((ref) => (
              <button
                key={ref.nodeId}
                onClick={() => handleAcSelect(ref)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors text-left"
              >
                {ref.thumbnail ? (
                  <img  src={ref.thumbnail}  alt={ref.fileName}  className="w-6 h-6 rounded object-cover shrink-0"/>
                ) : (
                  <div className={`w-6 h-6 rounded shrink-0 flex items-center justify-center ${ref.type === "IMAGE" ? "bg-blue-500/20" : "bg-purple-500/20"}`}>
                    <span className={`text-[7px] ${ref.type === "IMAGE" ? "text-blue-400" : "text-purple-400"}`}>
                      {ref.type === "IMAGE" ? "IMG" : "VID"}
                    </span>
                  </div>
                )}
                <span className={`font-medium ${ref.type === "IMAGE" ? "text-blue-300" : "text-purple-300"}`}>
                  @{formatRefLabel(ref)}
                </span>
                <span className="text-[10px] text-zinc-500 truncate ml-auto">{ref.fileName}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Duration */}
      <div className="px-3 pb-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider">Duration</span>
          <input
            type="number"
            min={3}
            max={15}
            value={duration}
            onChange={(e) => updateNodeData(id, { duration: Math.max(3, Math.min(15, Number(e.target.value) || 3)) } as Partial<VideoNodeData> & Record<string, unknown>)}
            onClick={(e) => e.stopPropagation()}
            className="w-12 text-right text-[11px] font-mono bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 focus:outline-none focus:border-purple-500"
          />
        </div>
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="py-2 -mx-1 px-1"
        >
          <input
            type="range"
            min={3}
            max={15}
            step={1}
            value={duration}
            onChange={(e) => updateNodeData(id, { duration: Number(e.target.value) } as Partial<VideoNodeData> & Record<string, unknown>)}
            className="w-full cursor-pointer h-3 rounded-full bg-zinc-700 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-grab active:[&::-webkit-slider-thumb]:cursor-grabbing [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:bg-purple-400 active:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:bg-purple-300 transition-all"
          />
        </div>
        <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5"><span>3s</span><span>15s</span></div>
      </div>


      {/* Aspect Ratio */}
      <div className="px-3 pb-2.5">
        <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">{t("common.aspectRatio")}</div>
        <Segmented options={RATIOS} value={aspectRatio} onChange={(v) => updateNodeData(id, { aspect_ratio: v } as Partial<VideoNodeData> & Record<string, unknown>)} activeClass="bg-purple-500 border-purple-500 text-white" />
      </div>

      {/* Resolution */}
      <div className="px-3 pb-2.5">
        <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">{t("common.resolution")}</div>
        <Segmented options={RESOLUTIONS} value={resolution} onChange={(v) => updateNodeData(id, { resolution: v } as Partial<VideoNodeData> & Record<string, unknown>)} activeClass="bg-purple-500 border-purple-500 text-white" />
      </div>

      {/* Audio Toggle */}
      <div className="px-3 pb-2.5">
        <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Mode</div>
        <Segmented
          options={["图生视频", "全能参考"]}
          value={(typed.vidu_mode as string) === "reference2video" ? "全能参考" : "图生视频"}
          onChange={(v) => updateNodeData(id, { vidu_mode: v === "全能参考" ? "reference2video" : "img2video" } as Partial<VideoNodeData> & Record<string, unknown>)}
          activeClass="bg-purple-500 border-purple-500 text-white"
        />
      </div>

      <div className="px-3 pb-2.5">
        <div className={FIELD_LABEL}>Audio</div>
        <Toggle checked={typed.audio_enabled ?? true} onChange={(v) => updateNodeData(id, { audio_enabled: v } as Partial<VideoNodeData> & Record<string, unknown>)} accent={ACCENT} />
      </div>

      {/* Seed Lock */}
      <div className="px-3 pb-2.5">
        <Toggle
          checked={(typed.seed_lock as boolean) ?? false}
          onChange={(v) => updateNodeData(id, { seed_lock: v } as Partial<VideoNodeData> & Record<string, unknown>)}
          accent={ACCENT}
          label="Seed Lock"
        />
        {(typed.seed_lock as boolean) && (
          <div className="mt-2">
            <input
              type="number"
              value={(typed.seed as number) ?? 0}
              onChange={(e) => updateNodeData(id, { seed: Number(e.target.value) } as Partial<VideoNodeData> & Record<string, unknown>)}
              onClick={(e) => e.stopPropagation()}
              className={`${INPUT_CLASS} ${inputFocus(ACCENT)} text-[11px]`}
              placeholder="Random seed"
            />
          </div>
        )}
      </div>

      {/* Subtitle Toggle */}
      <div className="px-3 pb-2.5">
        <Toggle
          checked={typed.subtitle_enabled ?? false}
          onChange={(v) => updateNodeData(id, { subtitle_enabled: v } as Partial<VideoNodeData> & Record<string, unknown>)}
          accent={ACCENT}
          label="Subtitle"
        />
      </div>

      {/* Result display */}
      {hasResult && (
        <div className="px-3 pb-2 space-y-2">
          <div className="border-t border-[#1c1c24]" />
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.badge}`}>
            {(isRunning || isPending) && <Spinner />}
            {st.label}
          </div>
          {(isPending || isRunning) && (
            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${isRunning ? "bg-" + st.accent + "-500 animate-pulse" : "bg-" + st.accent + "-500"}`} style={{ width: isRunning ? "60%" : "100%" }} />
            </div>
          )}
          {isFailed && typed.error_message && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2">
              <div className="text-[9px] font-semibold text-red-400 uppercase tracking-wider mb-1">Error</div>
              <p className="text-[10px] text-red-300 break-words leading-relaxed">{typed.error_message}</p>
            </div>
          )}
          {isSuccess && typed.video_url && (
            <div className="rounded-lg overflow-hidden border border-[#1c1c24] bg-black">
              <video className="w-full" controls preload="metadata" src={typed.video_url} style={{ maxHeight: 180 }} />
            </div>
          )}
          {isSuccess && !typed.video_url && typed.thumbnail_url && (
            <div className="rounded-lg overflow-hidden border border-[#1c1c24]">
              <img src={typed.thumbnail_url} alt="Preview" className="w-full h-28 object-cover" />
            </div>
          )}
        </div>
      )}

      {/* Generate Button */}
      <div className="px-3 pb-3 pt-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
          disabled={generating}
          className="w-full py-2 rounded-lg text-xs font-semibold bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {generating || isRunning ? (<><Spinner className="h-3 w-3" /> {t("common.generating")}</>) : ("Generate Video")}
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} className={`${HANDLE_CLASS} !bg-purple-500`} />
    </div>
  );
}

export default VideoNode;
