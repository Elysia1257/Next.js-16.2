"use client";

import { useMemo } from "react";
import type { Edge } from "@xyflow/react";
import type { CanvasNode, NodeRef } from "@/store/canvasStore";

/**
 * Compute connected source node references for a given target node.
 * Scans all edges, finds imageSource/videoSource sources targeting this node,
 * and packages them into sorted NodeRef arrays.
 */
export function useReferenceEngine(
  nodeId: string,
  edges: Edge[],
  nodes: CanvasNode[],
): { images: NodeRef[]; videos: NodeRef[] } {
  return useMemo(() => {
    const incoming = edges.filter((e) => e.target === nodeId);
    const imageRefs: NodeRef[] = [];
    const videoRefs: NodeRef[] = [];

    incoming.forEach((edge, edgeIdx) => {
      const src = nodes.find((n) => n.id === edge.source);
      if (!src) return;
      const data = src.data as Record<string, unknown>;
      const srcType = src.type as string;

      if (srcType === "imageSource") {
        imageRefs.push({
          nodeId: src.id,
          fileName: (data.fileName as string) ?? "unknown",
          thumbnail: (data.url as string) ?? "",
          type: "IMAGE",
          index: imageRefs.length + 1,
        });
      } else if (srcType === "videoSource") {
        videoRefs.push({
          nodeId: src.id,
          fileName: (data.fileName as string) ?? "unknown",
          thumbnail: (data.url as string) ?? "",
          type: "VIDEO",
          index: videoRefs.length + 1,
        });
      }
    });

    return { images: imageRefs, videos: videoRefs };
  }, [nodeId, edges, nodes]);
}

/**
 * Hook that also syncs computed references into node.data when they change.
 */
export function computeReferences(
  nodeId: string,
  edges: Edge[],
  nodes: CanvasNode[],
): { images: NodeRef[]; videos: NodeRef[] } {
  const incoming = edges.filter((e) => e.target === nodeId);
  const imageRefs: NodeRef[] = [];
  const videoRefs: NodeRef[] = [];

  incoming.forEach((_edge, _edgeIdx) => {
    const src = nodes.find((n) => n.id === _edge.source);
    if (!src) return;
    const data = src.data as Record<string, unknown>;
    const srcType = src.type as string;

    if (srcType === "imageSource") {
      imageRefs.push({
        nodeId: src.id,
        fileName: (data.fileName as string) ?? "unknown",
        thumbnail: (data.url as string) ?? "",
        type: "IMAGE",
        index: imageRefs.length + 1,
      });
    } else if (srcType === "videoSource") {
      videoRefs.push({
        nodeId: src.id,
        fileName: (data.fileName as string) ?? "unknown",
        thumbnail: (data.url as string) ?? "",
        type: "VIDEO",
        index: videoRefs.length + 1,
      });
    }
  });

  return { images: imageRefs, videos: videoRefs };
}
