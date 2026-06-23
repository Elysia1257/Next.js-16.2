import type { CanvasNode, MaterialNodeData, VideoNodeData, NoteNodeData, AssetNodeData } from "@/store/canvasStore";
import type { ImageSourceData, VideoSourceData, StartEndVideoData } from "@/store/canvasStore";

let _seq = 0;
function nextId(prefix: string): string {
  return `${prefix}_${Date.now()}_${_seq++}_${Math.random().toString(36).substring(2, 7)}`;
}

const MATERIAL_DEFAULTS: MaterialNodeData = {
  label: "Image",
  image_url: "",
  reference_images: [],
  aspect_ratio: "16:9",
  quality: "Standard",
};

const VIDEO_DEFAULTS: VideoNodeData = {
  label: "Video",
  prompt: "",
  duration: 10,
  model: "viduq3-turbo",
  provider_name: "vidu",
  aspect_ratio: "16:9",
  resolution: "1080p",
  audio_enabled: true,
  subtitle_enabled: false,
  seed_lock: false,
};

const NOTE_DEFAULTS: NoteNodeData = {
  label: "Text",
  content: "",
};

const ASSET_DEFAULTS: AssetNodeData = {
  label: "Asset",
  file_name: "",
};

export function createMaterialNode(
  position: { x: number; y: number },
  overrides?: Partial<MaterialNodeData>,
): CanvasNode {
  return {
    id: nextId("img"),
    type: "imageNode",
    position,
    data: { ...MATERIAL_DEFAULTS, ...overrides },
  };
}

export function createVideoNode(
  position: { x: number; y: number },
  overrides?: Partial<VideoNodeData>,
): CanvasNode {
  return {
    id: nextId("vid"),
    type: "videoNode",
    position,
    data: { ...VIDEO_DEFAULTS, ...overrides },
  };
}

export function createNoteNode(
  position: { x: number; y: number },
  overrides?: Partial<NoteNodeData>,
): CanvasNode {
  return {
    id: nextId("note"),
    type: "noteNode",
    position,
    data: { ...NOTE_DEFAULTS, ...overrides },
  };
}

export function createAssetNode(
  position: { x: number; y: number },
  overrides?: Partial<AssetNodeData>,
): CanvasNode {
  return {
    id: nextId("asset"),
    type: "assetNode",
    position,
    data: { ...ASSET_DEFAULTS, ...overrides },
  };
}

export function createImageSourceNode(
  position: { x: number; y: number },
  overrides?: Partial<ImageSourceData>,
): CanvasNode {
  return {
    id: nextId("imgsrc"),
    type: "imageSource",
    position,
    data: {
      fileName: "untitled.png",
      fileSize: 0,
      url: "",
      ...overrides,
    },
  };
}

export function createVideoSourceNode(
  position: { x: number; y: number },
  overrides?: Partial<VideoSourceData>,
): CanvasNode {
  return {
    id: nextId("vidsrc"),
    type: "videoSource",
    position,
    data: {
      fileName: "untitled.mp4",
      fileSize: 0,
      url: "",
      duration: 0,
      ...overrides,
    },
  };
}

export function createStartEndVideoNode(
  position: { x: number; y: number },
  overrides?: Partial<StartEndVideoData>,
): CanvasNode {
  return {
    id: nextId("sevid"),
    type: "startEndVideo",
    position,
    data: {
      label: "Start-End Video",
      prompt: "",
      duration: 10,
      model: "viduq3-turbo",
      provider_name: "vidu",
      aspect_ratio: "16:9",
      resolution: "1080p",
      audio_enabled: true,
      ...overrides,
    },
  };
}

import type { NodeType } from "@/store/canvasStore";

export const NODE_FACTORY: Record<
  NodeType,
  (pos: { x: number; y: number }, overrides?: Record<string, unknown>) => CanvasNode
> = {
  noteNode: createNoteNode,
  imageNode: createMaterialNode,
  videoNode: createVideoNode,
  assetNode: createAssetNode,
  imageSource: createImageSourceNode,
  videoSource: createVideoSourceNode,
  startEndVideo: createStartEndVideoNode,
};
