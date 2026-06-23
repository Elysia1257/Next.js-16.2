"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCanvasStore } from "@/store/canvasStore";
import type { Node } from "@xyflow/react";
import { nodeTypes } from "@/components/nodes";
import useContextMenu from "@/components/ContextMenu";
import { NodeErrorBoundary } from "@/components/nodes/ErrorBoundary";
import { useEdgeHighlighting } from "@/hooks/useEdgeHighlighting";
import { uploadToSupabase } from "@/lib/storage";
import { deleteFromSupabase } from "@/lib/storage";

export default function CubexCanvas() {
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    setSelectedNodeId, addNodeObject, updateNodeData,
    saveCanvas, isSaving, selectedNodeId, deleteNode,
  } = useCanvasStore();

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCount = useRef(nodes.length + edges.length);
  const [isDragOver, setIsDragOver] = useState(false);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: { id: string }[]; edges: { id: string }[] }) => {
      setSelectedNodeId(selectedNodes[0]?.id ?? null);
    },
    [setSelectedNodeId],
  );

  const { onPaneContextMenu, ContextMenuNode } = useContextMenu();

  const {
    highlightedNodes,
    highlightedEdges,
    onNodeMouseEnter,
    onNodeMouseLeave,
  } = useEdgeHighlighting(nodes, edges);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((_event: React.DragEvent) => {
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(event.dataTransfer.files);
      if (!files.length) return;

      for (const file of files) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) continue;

        const id = "asset_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
        const x = event.clientX - 400 - 160;
        const y = event.clientY - 80 - 40;

        addNodeObject({
          id,
          type: "assetNode",
          position: { x, y },
          data: { label: file.name, file_name: file.name, loading: true },
        });

        try {
          const folder = file.type.startsWith("image/") ? "images" : "videos";
          const result = await uploadToSupabase(file, folder);
          updateNodeData(id, {
            loading: false,
            image_url: folder === "images" ? result.url : undefined,
            video_url: folder === "videos" ? result.url : undefined,
          });
        } catch (err) {
          console.error("[CubexCanvas] upload failed:", err);
          updateNodeData(id, { loading: false });
        }
      }
    },
    [addNodeObject, updateNodeData],
  );

  // Auto-save: debounce 2 seconds after nodes or edges change
  useEffect(() => {
    const count = nodes.length + edges.length;
    if (count === 0 && prevCount.current === 0) return;
    prevCount.current = count;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveCanvas();
    }, 2000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [nodes, edges, saveCanvas]);

  // Supabase cleanup on node delete (handles keyboard + UI deletes)
  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    for (const n of deletedNodes) {
      const d = n.data as Record<string,unknown>;
      const url = (d?.url as string) || (d?.image_url as string) || (d?.video_url as string) || "";
      if (url) deleteFromSupabase(url);
    }
  }, []);

  return (
    <div className={"h-full w-full" + (isDragOver ? " is-drop-active" : "")}>
      <NodeErrorBoundary>
      <ReactFlow
        nodes={highlightedNodes}
        edges={highlightedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onSelectionChange={onSelectionChange}
        onPaneContextMenu={onPaneContextMenu}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: "#09090b" }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          animated: false,
          style: { stroke: "#2a2a3a", strokeWidth: 1, opacity: 0.5 },
        }}
      />
      </NodeErrorBoundary>
      {isSaving && (
        <div className="absolute top-3 right-3 bg-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-md shadow-lg z-50 pointer-events-none flex items-center gap-2">
          <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          Saving...
        </div>
      )}
      {ContextMenuNode}
    </div>
  );
}
