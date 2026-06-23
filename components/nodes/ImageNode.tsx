"use client";

import { memo, useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MaterialNodeData, NodeRef } from "@/store/canvasStore";
import { useCanvasStore } from "@/store/canvasStore";
import { generateImage, pollTaskResult } from "@/lib/api";
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
  ACTION_BUTTON_GROUP,
  deleteButtonClass,
  DeleteIcon,
} from "./nodeStyles";
import ModelSelector from "@/components/ui/ModelSelector";
import { VIDU_IMAGE_MODELS } from "@/components/ui/ModelSelector";
import { useI18n } from "@/lib/i18n";

const ACCENT = "blue";
const RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"];
const RESOLUTIONS = ["1K", "2K", "4K"];
const QUALITIES = ["Standard", "High", "Ultra"];

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

function ImageNode({ id, data, selected }: NodeProps) {
  const { t } = useI18n();
  const typed = data as MaterialNodeData & { model?: string; prompt?: string; resolution?: string; status?: string; video_url?: string; image_url?: string; references?: { images: NodeRef[]; videos: NodeRef[] } };
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const [generating, setGenerating] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [acFilter, setAcFilter] = useState("");
  const [acPos, setAcPos] = useState({ top: 0, left: 0 });
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
  // Ref for autocomplete to avoid recreating handlePromptChange on every refs change
  const allRefsRef = useRef(allRefs);
  allRefsRef.current = allRefs;

  // Sync references into node.data
  useEffect(() => {
    const newRefs = computeReferences(id, edges, nodes);
    const sig = JSON.stringify({ i: newRefs.images.length, v: newRefs.videos.length });
    if (sig === prevRefSig.current) return;
    prevRefSig.current = sig;
    updateNodeData(id, { references: newRefs } as Partial<MaterialNodeData> & Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodes]);

  // Parse ref tags in prompt for validation
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
      const url = d.image_url || d.video_url || d.url || ((d as MaterialNodeData).reference_images?.[0]);
      if (url) urls.push(url as string);
    }
    return urls;
  }, [edges, nodes, id]);

  const upstreamImage = upstreamUrls[0] ?? null;
  const genStatus = typed.status === "running" || typed.status === "pending";
  const hasConnectedSources = refs.images.length > 0 || refs.videos.length > 0;

  /* ---- Per-node Generate ---- */
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await generateImage({
        prompt: typed.prompt ?? "",
        model: typed.model ?? "viduq2",
        aspect_ratio: typed.aspect_ratio ?? "16:9",
        quality: typed.quality ?? "Standard",
        resolution: typed.resolution ?? "2K",
        reference_images: upstreamUrls,
      });
      const poll = async () => {
        const result = await pollTaskResult(res.task_id);
        if (result.status === "success" || result.status === "failed") {
          updateNodeData(id, {
            status: result.status,
            image_url: result.image_url,
            error_message: result.error_message,
          } as Partial<MaterialNodeData> & Record<string, unknown>);
          setGenerating(false);
        } else {
          setTimeout(poll, 2000);
        }
      };
      setTimeout(poll, 2000);
    } catch (err) {
      console.error("Generate failed:", err);
      updateNodeData(id, { status: "failed", error_message: String(err) } as Partial<MaterialNodeData> & Record<string, unknown>);
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
        updateNodeData(id, { prompt: value } as Partial<MaterialNodeData> & Record<string, unknown>);
      }, 500);

      // Detect @ trigger
      const cursorPos = e.target.selectionStart ?? 0;
      const textBefore = value.substring(0, cursorPos);
      const atMatch = textBefore.match(/@([\u4e00-\u9fa5]*)(\d*)$/);
      if (atMatch && allRefsRef.current.length > 0) {
        setAcFilter(atMatch[1] || "");
        setShowAutocomplete(true);
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setAcPos({ top: rect.bottom + 4, left: rect.left });
        }
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
      updateNodeData(id, { prompt: newText } as Partial<MaterialNodeData> & Record<string, unknown>);
      setShowAutocomplete(false);
      setTimeout(() => {
        ta.focus();
        const pos = atIdx + formatRefLabel(ref).length + 2;
        ta.setSelectionRange(pos, pos);
      }, 0);
    },
    [id, updateNodeData],
  );

  // Close autocomplete on outside click
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
    <div className={`${CARD_BASE} ${cardBorder(selected, ACCENT)} group/card`} style={{ width: CARD_W }}>
      <Handle type="target" position={Position.Top} className={`${HANDLE_CLASS} !bg-blue-500`} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1c1c24] bg-[#0f0f14]/80">
        <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
        </svg>
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider truncate flex-1">Image</span>
        {genStatus && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" title="Generating" />}
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

      {/* Image Preview */}
      {typed.image_url && (
        <div className="px-3 pt-3 pb-2">
          <div className="rounded-lg overflow-hidden border border-[#1c1c24] bg-black">
            <img
              src={typed.image_url}
              alt="Generated"
              className="w-full h-40 object-cover"
            />
          </div>
        </div>
      )}

      {/* Model */}
      <div className="px-3 pb-2.5">
        <div className={FIELD_LABEL}>Model</div>
        <ModelSelector
          value={typed.model ?? "viduq2"}
          models={VIDU_IMAGE_MODELS}
          onChange={(v) => updateNodeData(id, { model: v } as Partial<MaterialNodeData> & Record<string, unknown>)}
          accent={ACCENT}
        />
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
          placeholder="Describe the image... Type @ to reference sources"
          value={localPrompt}
          onChange={handlePromptChange}
          onClick={(e) => e.stopPropagation()}
        />

        {/* @ autocomplete dropdown */}
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
                  <img src={ref.thumbnail} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
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

      {/* Aspect Ratio */}
      <div className="px-3 pb-2.5">
        <div className={FIELD_LABEL}>Aspect Ratio</div>
        <Segmented options={RATIOS} value={typed.aspect_ratio} onChange={(v) => updateNodeData(id, { aspect_ratio: v } as Partial<MaterialNodeData> & Record<string, unknown>)} activeClass="bg-blue-500 border-blue-500 text-white" />
      </div>

      {/* Resolution */}
      <div className="px-3 pb-2.5">
        <div className={FIELD_LABEL}>Resolution</div>
        <Segmented options={RESOLUTIONS} value={typed.resolution ?? "2K"} onChange={(v) => updateNodeData(id, { resolution: v } as Partial<MaterialNodeData> & Record<string, unknown>)} activeClass="bg-blue-500 border-blue-500 text-white" />
      </div>

      {/* Quality */}
      <div className="px-3 pb-2.5">
        <div className={FIELD_LABEL}>Quality</div>
        <Segmented options={QUALITIES} value={typed.quality} onChange={(v) => updateNodeData(id, { quality: v } as Partial<MaterialNodeData> & Record<string, unknown>)} activeClass="bg-blue-500 border-blue-500 text-white" />
      </div>

      {/* Generate Button */}
      <div className="px-3 pb-3 pt-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
          disabled={generating}
          className="w-full py-2 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating || genStatus ? "Generating..." : "Generate Image"}
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} className={`${HANDLE_CLASS} !bg-blue-500`} />
    </div>
  );
}

export default ImageNode;

