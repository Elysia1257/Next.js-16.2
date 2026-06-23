"use client";

import { memo, useCallback, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ImageSourceData } from "@/store/canvasStore";
import { useCanvasStore } from "@/store/canvasStore";
import { deleteFromSupabase } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
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

function ImageSourceNode({ id, data, selected }: NodeProps) {
  const { t } = useI18n();
  const typed = data as ImageSourceData;
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
      updateNodeData(id, {
        url,
        fileName: file.name,
        fileSize: file.size,
      } as Partial<ImageSourceData> & Record<string, unknown>);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [id, updateNodeData],
  );

  return (
    <div
      className={`${CARD_BASE} ${cardBorder(selected, "blue")} group/card`}
      style={{ width: "fit-content", minWidth: 180, maxWidth: 320 }}
    >
      {/* Hidden file input for replace */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="IMAGE"
        className={`${HANDLE_CLASS} !bg-blue-500`}
        title="IMAGE output"
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1c1c24] bg-[#0f0f14]/80">
        <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
        </svg>
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider truncate flex-1">Image Source</span>
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

      {/* Thumbnail — adaptive sizing */}
      <div className="px-3 pt-3 pb-2">
        <div className="rounded-lg overflow-hidden border border-[#1c1c24] bg-black flex items-center justify-center"
             style={{ maxHeight: 220 }}>
          <img
            src={typed.url}
            alt={typed.fileName}
            className="max-w-full max-h-[220px] w-auto h-auto object-contain"
          />
        </div>
      </div>

      {/* File Info */}
      <div className="px-3 pb-2 space-y-1">
        <p className="text-[10px] text-zinc-300 truncate font-medium">{typed.fileName}</p>
        <p className="text-[10px] text-zinc-500">{formatBytes(typed.fileSize)}</p>
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
        <span className="text-[9px] font-semibold text-blue-400/70 uppercase tracking-wider">
          OUTPUT: IMAGE
        </span>
      </div>
    </div>
  );
}

export default memo(ImageSourceNode);
