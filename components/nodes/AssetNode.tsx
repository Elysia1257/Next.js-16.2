"use client";

import { memo, useCallback, useState, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AssetNodeData } from "@/store/canvasStore";
import { useCanvasStore } from "@/store/canvasStore";
import {
  CARD_W,
  HANDLE_CLASS,
  CARD_BASE,
  cardBorder,
  ACTION_BUTTON_GROUP,
  deleteButtonClass,
  DeleteIcon,
  Spinner,
} from "./nodeStyles";

function AssetNode({ id, data, selected }: NodeProps) {
  const typed = data as AssetNodeData;
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const [showPopIn, setShowPopIn] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowPopIn(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); deleteNode(id); },
    [id, deleteNode],
  );

  const isLoading = typed.loading;
  const previewUrl = typed.image_url || typed.video_url;
  const isImage = !!typed.image_url;
  const isVideo = !!typed.video_url;

  return (
    <div
      className={`${CARD_BASE} ${cardBorder(selected, "zinc")} ${showPopIn ? "asset-node-enter" : ""} group/card`}
      style={{ width: CARD_W }}
    >
      <Handle type="source" position={Position.Bottom} className={`${HANDLE_CLASS} !bg-zinc-400`} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1c1c24] bg-[#0f0f14]/80">
        <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-5.7l-1.398-1.398" />
        </svg>
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider truncate flex-1">Asset</span>
        <div className={ACTION_BUTTON_GROUP}>
          <button onClick={handleDelete} className={deleteButtonClass()} title="Delete node">
            <DeleteIcon />
          </button>
        </div>
      </div>

      {/* Preview / Loading */}
      <div className="px-3 pt-3 pb-2">
        {isLoading ? (
          <div className="rounded-lg border border-dashed border-[#262636] flex flex-col items-center justify-center h-36 bg-[#0a0a10]/50 gap-2">
            <Spinner className="h-5 w-5 text-zinc-500" />
            <span className="text-[10px] text-zinc-500">Uploading...</span>
          </div>
        ) : isImage && previewUrl ? (
          <div className="rounded-lg overflow-hidden border border-[#1c1c24] bg-black">
            <img src={previewUrl} alt={typed.file_name} className="w-full h-36 object-cover" />
          </div>
        ) : isVideo && previewUrl ? (
          <div className="rounded-lg overflow-hidden border border-[#1c1c24] bg-black">
            <video src={previewUrl} className="w-full h-36 object-cover" controls preload="metadata" />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#262636] flex items-center justify-center h-24 bg-[#0a0a10]/50">
            <div className="text-center space-y-1.5">
              <svg className="w-8 h-8 text-zinc-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12A2.25 2.25 0 004.5 20.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <span className="text-[10px] text-zinc-500 block">{typed.file_name || "Untitled"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 pb-3">
        <p className="text-[10px] text-zinc-500 truncate">
          {isLoading ? "Uploading..." : (typed.file_name || "Untitled asset")}
        </p>
      </div>
    </div>
  );
}

export default memo(AssetNode);
