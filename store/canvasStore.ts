import { create } from "zustand";
import {
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import {
  createWorkflow,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
} from "@/lib/workflowApi";
import { useWorkflowStore } from "@/store/workflowStore";

export type NodeType = "imageNode" | "videoNode" | "noteNode" | "assetNode" | "imageSource" | "videoSource" | "startEndVideo";

export type NodeRefType = "IMAGE" | "VIDEO";

export type NodeRef = {
  nodeId: string;
  fileName: string;
  thumbnail: string;
  type: NodeRefType;
  index: number;
};

export type MaterialNodeData = {
  label: string;
  image_url: string;
  reference_images: string[];
  aspect_ratio: string;
  quality: string;
  references?: { images: NodeRef[]; videos: NodeRef[] };
};
export type StartEndVideoData = {
  label: string;
  prompt: string;
  duration: number;
  model: string;
  provider_name: string;
  aspect_ratio: string;
  resolution: string;
  audio_enabled: boolean;
  start_image_url?: string;
  end_image_url?: string;
  references?: { images: NodeRef[]; videos: NodeRef[] };
};


export type VideoNodeData = {
  label: string;
  prompt: string;
  duration: number;
  model: string;
  provider_name: string;
  aspect_ratio: string;
  resolution: string;
  audio_enabled: boolean;
  subtitle_enabled: boolean;
  vidu_mode?: "img2video" | "reference2video";
  seed?: number;
  seed_lock?: boolean;
  references?: { images: NodeRef[]; videos: NodeRef[] };
};

export type AssetNodeData = {
  label: string;
  file_name: string;
  loading?: boolean;
  image_url?: string;
  video_url?: string;
};

export type NoteNodeData = {
  label: string;
  content: string;
};

export type ImageSourceData = {
  fileName: string;
  fileSize: number;
  url: string;
  thumbnail?: string;
};

export type VideoSourceData = {
  fileName: string;
  fileSize: number;
  url: string;
  thumbnail?: string;
  duration?: number;
};

export type CanvasNode = Node<
  MaterialNodeData | VideoNodeData | NoteNodeData | AssetNodeData | ImageSourceData | VideoSourceData | StartEndVideoData
>;

/* ------------------------------------------------------------------ */
/*  LocalStorage backup                                                */
/* ------------------------------------------------------------------ */
const LS_KEY = "canvas-state";
const LS_WORKFLOW_ID_KEY = "canvas-workflow-id";

function saveToLocalStorage(
  nodes: CanvasNode[],
  edges: Edge[],
  workflowId?: string | null,
) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ nodes, edges }));
    if (workflowId) localStorage.setItem(LS_WORKFLOW_ID_KEY, workflowId);
  } catch {
    /* quota exceeded */
  }
}

function loadFromLocalStorage(): {
  nodes: CanvasNode[];
  edges: Edge[];
  workflowId: string | null;
} | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const workflowId = localStorage.getItem(LS_WORKFLOW_ID_KEY);
    return { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [], workflowId };
  } catch {
    return null;
  }
}

function clearLocalStorage() {
  try {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_WORKFLOW_ID_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Store interface                                                    */
/* ------------------------------------------------------------------ */
interface CanvasState {
  nodes: CanvasNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  workflowId: string | null;
  workflowName: string;
  isSaving: boolean;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNodeObject: (node: CanvasNode) => void;
  setSelectedNodeId: (id: string | null) => void;
  updateNodeData: (
    id: string,
    data: Partial<
      MaterialNodeData | VideoNodeData | NoteNodeData | AssetNodeData | ImageSourceData | VideoSourceData | StartEndVideoData
    > &
      Record<string, unknown>,
  ) => void;
  saveCanvas: () => Promise<void>;
  loadCanvas: () => Promise<void>;
  loadWorkflowList: () => Promise<{ id: string; name: string }[]>;
  loadWorkflowById: (id: string) => Promise<void>;
  newCanvas: () => void;
  deleteNode: (id: string) => void;
  clearCanvas: () => void;
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */
export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  workflowId: null,
  workflowName: "Untitled",
  isSaving: false,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as CanvasNode[] });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection: Connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },

  addNodeObject: (node: CanvasNode) => {
    set({ nodes: [...get().nodes, node] });
  },

  setSelectedNodeId: (id) => {
    set({ selectedNodeId: id });
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...data } }
          : node,
      ),
    });
  },

  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  /* ----- Server persistence ------------------------------------- */
  saveCanvas: async () => {
    const { nodes, edges, workflowId, workflowName } = get();
    set({ isSaving: true });
    try {
      const payload = {
        name: workflowName,
        nodes_json: JSON.stringify(nodes),
        edges_json: JSON.stringify(edges),
      };
      let row: { id: string };
      if (workflowId) {
        try {
          row = await updateWorkflow(workflowId, payload);
        } catch {
          localStorage.removeItem(LS_WORKFLOW_ID_KEY);
          set({ workflowId: null });
          row = await createWorkflow(payload);
        }
      } else {
        row = await createWorkflow(payload);
      }
      set({ workflowId: row.id, isSaving: false });
      useWorkflowStore.getState().setCurrentWorkflowId(row.id);
      saveToLocalStorage(nodes, edges, row.id);
    } catch (err) {
      console.error("[canvasStore] saveCanvas failed:", err);
      saveToLocalStorage(nodes, edges, null);
      set({ isSaving: false });
    }
  },

  loadCanvas: async () => {
    try {
      const rows = await listWorkflows();
      const latest = rows[0];
      if (latest && (latest.nodes_json || latest.edges_json)) {
        const nodes = JSON.parse(latest.nodes_json ?? "[]") as CanvasNode[];
        const edges = JSON.parse(latest.edges_json ?? "[]") as Edge[];
        set({
          nodes,
          edges,
          workflowId: latest.id,
          workflowName: latest.name,
          selectedNodeId: null,
        });
        useWorkflowStore.getState().setCurrentWorkflowId(latest.id);
        return;
      }
    } catch (err) {
      console.error("[canvasStore] loadCanvas from server failed:", err);
    }

    const local = loadFromLocalStorage();
    if (local) {
      const nodes = (local.nodes ?? []).map(
        (node: Record<string, unknown>) => {
          const { selected: _s, dragging: _d, positionAbsolute: _p, ...rest } =
            node;
          const data = rest.data as Record<string, unknown> | undefined;
          if (
            data &&
            typeof data.image_url === "string" &&
            data.image_url &&
            !data.reference_images
          ) {
            data.reference_images = [data.image_url];
          }
          if (data && !data.reference_images) {
            data.reference_images = [];
          }
          return rest;
        },
      ) as CanvasNode[];
      set({
        nodes,
        edges: local.edges ?? [],
        workflowId: local.workflowId,
        selectedNodeId: null,
      });
    }
  },

  loadWorkflowList: async () => {
    const rows = await listWorkflows();
    return rows.map((r) => ({ id: r.id, name: r.name }));
  },

  loadWorkflowById: async (id: string) => {
    const rows = await listWorkflows();
    const match = rows.find((r) => r.id === id);
    if (match) {
      const nodes = JSON.parse(match.nodes_json ?? "[]") as CanvasNode[];
      const edges = JSON.parse(match.edges_json ?? "[]") as Edge[];
      set({
        nodes,
        edges,
        workflowId: match.id,
        workflowName: match.name,
        selectedNodeId: null,
      });
      useWorkflowStore.getState().setCurrentWorkflowId(match.id);
    }
  },

  newCanvas: () => {
    set({
      nodes: [],
      edges: [],
      workflowId: null,
      workflowName: "Untitled",
      selectedNodeId: null,
    });
    useWorkflowStore.getState().setCurrentWorkflowId(null);
    clearLocalStorage();
  },

  clearCanvas: () => {
    const { workflowId } = get();
    if (workflowId) {
      deleteWorkflow(workflowId).catch((err) =>
        console.error("[canvasStore] deleteWorkflow failed:", err),
      );
    }
    clearLocalStorage();
    set({
      nodes: [],
      edges: [],
      workflowId: null,
      workflowName: "Untitled",
      selectedNodeId: null,
    });
    useWorkflowStore.getState().setCurrentWorkflowId(null);
  },
}));
