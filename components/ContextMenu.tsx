"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import type { NodeType } from "@/store/canvasStore";
import type { ImageSourceData, VideoSourceData } from "@/store/canvasStore";
import { NODE_FACTORY } from "@/lib/nodeFactory";
import { uploadToSupabase } from "@/lib/storage";
import { useCanvasStore } from "@/store/canvasStore";

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const menuItems: { label: string; type: NodeType; color: string }[] = [
  { label: "Image", type: "imageNode", color: "#3b82f6" },
  { label: "Video", type: "videoNode", color: "#a855f7" },
  { label: "Text", type: "noteNode", color: "#a3a3a3" },
  { label: "Start-End Video", type: "startEndVideo", color: "#f59e0b" },
];

export default function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false });
  const menuRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const addNodeObject = useCanvasStore((s) => s.addNodeObject);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const flowPosRef = useRef({ x: 0, y: 0 });

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      flowPosRef.current = flowPos;
      setMenu({
        x: event.clientX,
        y: event.clientY,
        visible: true,
      });
    },
    [screenToFlowPosition],
  );

  const close = useCallback(() => {
    setMenu({ x: 0, y: 0, visible: false });
  }, []);

  const handleAddNode = useCallback(
    (type: NodeType) => {
      const pos = flowPosRef.current;
      const factory = NODE_FACTORY[type];
      const node = factory(pos);
      addNodeObject(node);
      close();
    },
    [close, addNodeObject],
  );

  // File upload handlers
  const handleImageUpload = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleVideoUpload = useCallback(() => {
    videoInputRef.current?.click();
  }, []);

  const processFiles = useCallback(
    async (files: FileList | null, mediaType: "imageSource" | "videoSource") => {
      if (!files || files.length === 0) return;
      const pos = flowPosRef.current;
      for (const file of Array.from(files)) {
        const blobUrl = URL.createObjectURL(file);
        // Show preview immediately with blob URL, then upload for real URL
        if (mediaType === "imageSource") {
          const node = NODE_FACTORY.imageSource(pos, { fileName: file.name, fileSize: file.size, url: blobUrl });
          addNodeObject(node);
          try {
            const result = await uploadToSupabase(file, "images");
            updateNodeData(node.id, { url: result.url, fileName: file.name, fileSize: file.size } as Partial<ImageSourceData> & Record<string, unknown>);
          } catch {
            // Keep blob URL as fallback
          }
        } else {
          const node = NODE_FACTORY.videoSource(pos, { fileName: file.name, fileSize: file.size, url: blobUrl });
          addNodeObject(node);
          try {
            const result = await uploadToSupabase(file, "videos");
            updateNodeData(node.id, { url: result.url, fileName: file.name, fileSize: file.size } as Partial<VideoSourceData> & Record<string, unknown>);
          } catch {
            // Keep blob URL as fallback
          }
        }
      }
      close();
    },
    [close, addNodeObject, updateNodeData],
  );

  const onImageFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files, "imageSource");
      if (imageInputRef.current) imageInputRef.current.value = "";
    },
    [processFiles],
  );

  const onVideoFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files, "videoSource");
      if (videoInputRef.current) videoInputRef.current.value = "";
    },
    [processFiles],
  );

  // Close on outside click
  useEffect(() => {
    if (!menu.visible) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menu.visible, close]);

  // Close on Escape
  useEffect(() => {
    if (!menu.visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menu.visible, close]);

  const ContextMenuNode = (
    <>
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        onChange={onImageFiles}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        onChange={onVideoFiles}
      />

      {menu.visible && (
        <div
          ref={menuRef}
          className="fixed z-50 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1.5 overflow-hidden"
          style={{ left: menu.x, top: menu.y }}
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 mb-1">
            Add Node
          </div>
          {menuItems.map((item) => (
            <button
              key={item.type}
              onClick={() => handleAddNode(item.type)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors text-left"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </button>
          ))}

          {/* Upload section */}
          <div className="border-t border-zinc-800 mt-1 pt-1">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Upload
            </div>
            <button
              onClick={handleImageUpload}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors text-left"
            >
              <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              Upload Image
            </button>
            <button
              onClick={handleVideoUpload}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors text-left"
            >
              <svg className="w-4 h-4 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
              </svg>
              Upload Video
            </button>
            <div className="mx-3 my-0.5 border-t border-zinc-800" />
            <button
              disabled
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 text-left cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-9.5h-9a2.25 2.25 0 00-2.25 9.5z" />
              </svg>
              Audio Node
              <span className="text-[9px] text-zinc-700 ml-auto">Soon</span>
            </button>
          </div>
        </div>
      )}
    </>
  );

  return { onPaneContextMenu, ContextMenuNode };
}
