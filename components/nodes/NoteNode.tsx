"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NoteNodeData } from "@/store/canvasStore";
import { useCanvasStore } from "@/store/canvasStore";
import {
  CARD_W,
  HANDLE_CLASS,
  CARD_BASE,
  cardBorder,
  INPUT_CLASS,
  inputFocus,
  ACTION_BUTTON_GROUP,
  actionButtonClass,
  deleteButtonClass,
  DeleteIcon,
} from "./nodeStyles";

const ACCENT = "neutral";

function NoteNode({ id, data, selected }: NodeProps) {
  const typed = data as NoteNodeData;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const deleteNode = useCanvasStore((s) => s.deleteNode);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteNode(id);
    },
    [id, deleteNode],
  );

  return (
    <div
      className={CARD_BASE + " " + cardBorder(selected, ACCENT)}
      style={{ width: CARD_W }}
    >
      <Handle type="source" position={Position.Bottom} className={`${HANDLE_CLASS} !bg-zinc-400`} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1c1c24] bg-[#0f0f14]">
        <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>

        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider truncate flex-1">
          Text
        </span>

        <div className={ACTION_BUTTON_GROUP}>
          <button onClick={handleDelete} className={deleteButtonClass()} title="Delete card">
            <DeleteIcon />
          </button>
        </div>
      </div>

      <div className="px-3 py-3 space-y-2">
        <textarea
          className={`${INPUT_CLASS} ${inputFocus(ACCENT)} min-h-[100px] resize-y`}
          rows={5}
          placeholder="Write a note..."
          value={typed.content}
          onChange={(e) => updateNodeData(id, { content: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="text-[9px] text-zinc-600 text-right">
          {typed.content.length} chars
        </div>
      </div>
    </div>
  );
}

export default memo(NoteNode);
