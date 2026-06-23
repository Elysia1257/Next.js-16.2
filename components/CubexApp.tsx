"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useCanvasStore, type NodeType } from "@/store/canvasStore";
import { useWorkflowStore } from "@/store/workflowStore";
import CubexCanvas from "@/components/CubexCanvas";
import DebugPanel from "@/components/DebugPanel";
import { NODE_FACTORY } from "@/lib/nodeFactory";
import { ensureAuth } from "@/lib/authHelper";
import { deleteWorkflow as deleteWorkflowApi } from "@/lib/workflowApi";
import { useI18n } from "@/lib/i18n";

const nodeButtons: { label: string; type: NodeType; buttonClass: string }[] = [
  { label: "Image", type: "imageNode", buttonClass: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700" },
  { label: "Video", type: "videoNode", buttonClass: "bg-purple-500 hover:bg-purple-600 active:bg-purple-700" },
  { label: "Text", type: "noteNode", buttonClass: "bg-zinc-500 hover:bg-zinc-600 active:bg-zinc-700" },
];

let sidebarCol = 0;
const SIDEBAR_BASE = { x: 100, y: 50 };
const SIDEBAR_STEP = { x: 280, y: 120 };
const SIDEBAR_COLS = 3;

function nextGridPos(): { x: number; y: number } {
  const col = sidebarCol % SIDEBAR_COLS;
  const row = Math.floor(sidebarCol / SIDEBAR_COLS);
  sidebarCol++;
  return {
    x: SIDEBAR_BASE.x + col * SIDEBAR_STEP.x,
    y: SIDEBAR_BASE.y + row * SIDEBAR_STEP.y,
  };
}

export default function CubexApp() {
  const { t } = useI18n();
  const addNodeObject = useCanvasStore((s) => s.addNodeObject);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const loadWorkflowList = useCanvasStore((s) => s.loadWorkflowList);
  const loadWorkflowById = useCanvasStore((s) => s.loadWorkflowById);
  const saveCanvas = useCanvasStore((s) => s.saveCanvas);
  const newCanvas = useCanvasStore((s) => s.newCanvas);
  const isSaving = useCanvasStore((s) => s.isSaving);
  const workflowName = useCanvasStore((s) => s.workflowName);
  const workflowId = useCanvasStore((s) => s.workflowId);
  const setCurrentWorkflowId = useWorkflowStore((s) => s.setCurrentWorkflowId);

  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([]);
  const [showList, setShowList] = useState(false);
  const listLoaded = useRef(false);

  // Init auth then load
  useEffect(() => {
    ensureAuth().then(() => loadCanvas()).catch((err) => console.error("Auth init failed:", err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh workflow list
  const refreshList = useCallback(async () => {
    try {
      const list = await loadWorkflowList();
      setWorkflows(list);
    } catch {
      // ignore
    }
  }, [loadWorkflowList]);

  useEffect(() => {
    if (showList && !listLoaded.current) {
      listLoaded.current = true;
      refreshList();
    }
  }, [showList, refreshList]);

  const handleAddNode = useCallback(
    (type: NodeType) => {
      const node = NODE_FACTORY[type](nextGridPos());
      addNodeObject(node);
    },
    [addNodeObject],
  );

  const handleSave = useCallback(() => {
    saveCanvas();
    refreshList();
  }, [saveCanvas, refreshList]);

  const handleLoad = useCallback(
    (id: string) => {
      loadWorkflowById(id);
      setCurrentWorkflowId(id);
    },
    [loadWorkflowById, setCurrentWorkflowId],
  );

  const handleDeleteWorkflow = useCallback(
    async (id: string) => {
      await deleteWorkflowApi(id);
      if (id === workflowId) {
        newCanvas();
      }
      refreshList();
    },
    [workflowId, newCanvas, refreshList],
  );

  const handleNew = useCallback(() => {
    newCanvas();
    refreshList();
  }, [newCanvas, refreshList]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex flex-col gap-2 w-56 shrink-0 bg-zinc-900 border-r border-zinc-700 p-4 overflow-y-auto">
        {/* Save / New buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-3 py-1.5 rounded text-xs font-medium"
          >
            {isSaving ? t("app.saving") : t("app.save")}
          </button>
          <button
            onClick={handleNew}
            className="flex-1 bg-zinc-600 hover:bg-zinc-500 text-white px-3 py-1.5 rounded text-xs font-medium"
          >
            New
          </button>
        </div>

        {/* Workflow info */}
        {workflowId && (
          <p className="text-[10px] text-zinc-500 truncate">
            {workflowName}
          </p>
        )}

        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Nodes
        </h2>
        {nodeButtons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => handleAddNode(btn.type)}
            className={`${btn.buttonClass} text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm`}
          >
            {btn.label}
          </button>
        ))}

        <div className="mt-2 border-t border-zinc-700 pt-2">
          <button
            onClick={() => setShowList(!showList)}
            className="w-full text-left text-xs text-zinc-400 hover:text-zinc-200"
          >
            {showList ? "▼" : "▶"} Workflows
          </button>
          {showList && (
            <div className="mt-1 max-h-40 overflow-y-auto">
              {workflows.length === 0 && (
                <p className="text-[10px] text-zinc-600">{t("app.empty")}</p>
              )}
              {workflows.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleLoad(w.id)}
                  className={`block w-full text-left text-[10px] px-1 py-0.5 rounded hover:bg-zinc-700 group/wf flex items-center justify-between ${
                    w.id === workflowId ? "text-green-400" : "text-zinc-400"
                  }`}
                >
                  <span className="truncate flex-1">{w.name}</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); handleDeleteWorkflow(w.id); }}
                    className="text-zinc-600 hover:text-red-400 opacity-0 group-hover/wf:opacity-100 transition-opacity ml-1 shrink-0"
                    title={t("app.deleteWorkflow")}
                  >×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-zinc-500 leading-relaxed mt-2">
          {t("app.dragHint")}
        </p>
      </aside>

      {/* Canvas */}
      <main className="flex-1 h-full">
        <CubexCanvas />
      </main>

      <DebugPanel />
    </div>
  );
}
