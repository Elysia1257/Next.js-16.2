"use client";

import { memo, useCallback, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { VideoSourceData } from "@/store/canvasStore";
import { useCanvasStore } from "@/store/canvasStore";
import { deleteFromSupabase } from "@/lib/storage";
import {
  HANDLE_CLASS,
  CARD_BASE,
  cardBorder,
  ACTION_BUTTON_GROUP,
  deleteButtonClass,
  DeleteIcon,
} from "./nodeStyles";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoSourceNode({ id, data, selected }: NodeProps) {
  const typed = data as VideoSourceData;
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); deleteFromSupabase(typed.url).finally(() => deleteNode(id)); },
    [id, deleteNode, typed.url]);

  const handleReplace = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      fileInputRef.current?.click();
    },
    [],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);

      // Try to read video duration from metadata
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.onloadedmetadata = () => {
        updateNodeData(id, {
          url,
          fileName: file.name,
          fileSize: file.size,
          duration: vid.duration,
        } as Partial<VideoSourceData> & Record<string, unknown>);
        URL.revokeObjectURL(vid.src);
      };
      vid.onerror = () => {
        updateNodeData(id, {
          url,
          fileName: file.name,
          fileSize: file.size,
        } as Partial<VideoSourceData> & Record<string, unknown>);
      };
      vid.src = url;

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [id, updateNodeData],
  );

  return (
    <div
      className={`${CARD_BASE} ${cardBorder(selected, "purple")} group/card`}
      style={{ width: "fit-content", minWidth: 180, maxWidth: 320 }}
    >
      {/* Hidden file input for replace */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="VIDEO"
        className={`${HANDLE_CLASS} !bg-purple-500`}
        title="VIDEO output"
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1c1c24] bg-[#0f0f14]/80">
        <svg className="w-4 h-4 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
        </svg>
        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider truncate flex-1">Video Source</span>
        <div className={ACTION_BUTTON_GROUP}>
          <button onClick={handleReplace} className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors" title="Replace file">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </button>
          <button onClick={handleDelete} className={deleteButtonClass()} title="Delete node">
            <DeleteIcon />
          </button>
        </div>
      </div>

      {/* Video Preview — adaptive sizing */}
      <div className="px-3 pt-3 pb-2">
        <div className="rounded-lg overflow-hidden border border-[#1c1c24] bg-black flex items-center justify-center"
             style={{ maxHeight: 220 }}>
          <video
            src={typed.url}
            className="max-w-full max-h-[220px] w-auto h-auto object-contain"
            controls
            preload="metadata"
          />
        </div>
      </div>

      {/* File Info */}
      <div className="px-3 pb-2 space-y-1">
        <p className="text-[10px] text-zinc-300 truncate font-medium">{typed.fileName}</p>
        <div className="flex gap-3">
          <p className="text-[10px] text-zinc-500">{formatBytes(typed.fileSize)}</p>
          <p className="text-[10px] text-zinc-500">{formatDuration(typed.duration)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 pb-2.5">
        <button
          onClick={handleReplace}
          className="w-full py-1.5 rounded text-[10px] font-medium border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          Replace File
        </button>
      </div>

      {/* Output label */}
      <div className="px-3 pb-2.5">
        <span className="text-[9px] font-semibold text-purple-400/70 uppercase tracking-wider">
          OUTPUT: VIDEO
        </span>
      </div>
    </div>
  );
}

export default memo(VideoSourceNode);
