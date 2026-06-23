import type { Edge, Node } from "@xyflow/react";

/* ------------------------------------------------------------------ */
/*  Mode types                                                         */
/* ------------------------------------------------------------------ */

/** Generation modes ¡ª MVP only exposes image-to-video */
export type ImageMode = "text-to-image" | "image-to-image";

export type VideoMode = "text-to-video" | "image-to-video";

/* ------------------------------------------------------------------ */
/*  Resolver                                                           */
/* ------------------------------------------------------------------ */

/**
 * Determine the generation mode for an ImageNode based on its incoming edges.
 */
export function resolveImageMode(
  nodeId: string,
  edges: Edge[],
  nodes: Node[],
): ImageMode {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const incomingEdges = edges.filter((e) => e.target === nodeId);

  for (const edge of incomingEdges) {
    const source = nodeMap.get(edge.source);
    if (!source) continue;
    if (source.type === "imageNode") return "image-to-image";
  }

  return "text-to-image";
}

/**
 * Determine the generation mode for a VideoNode based on its incoming edges.
 * MVP: only image-to-video is exposed in the UI.
 */
export function resolveVideoMode(
  nodeId: string,
  edges: Edge[],
  nodes: Node[],
): VideoMode {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const incomingEdges = edges.filter((e) => e.target === nodeId);

  for (const edge of incomingEdges) {
    const source = nodeMap.get(edge.source);
    if (!source) continue;
    if (source.type === "imageNode") return "image-to-video";
  }

  return "text-to-video";
}

/* ------------------------------------------------------------------ */
/*  Mode labels (for display)                                          */
/* ------------------------------------------------------------------ */

export const IMAGE_MODE_LABELS: Record<ImageMode, string> = {
  "text-to-image": "Text ¡ú Image",
  "image-to-image": "Image ¡ú Image",
};

export const VIDEO_MODE_LABELS: Record<VideoMode, string> = {
  "text-to-video": "Text ¡ú Video",
  "image-to-video": "Image ¡ú Video",
};
