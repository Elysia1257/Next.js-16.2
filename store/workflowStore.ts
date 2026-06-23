import { create } from "zustand";

interface WorkflowMeta {
  currentWorkflowId: string | null;
  currentProjectId: string | null;
  setCurrentWorkflowId: (id: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;
}

export const useWorkflowStore = create<WorkflowMeta>((set) => ({
  currentWorkflowId: null,
  currentProjectId: null,
  setCurrentWorkflowId: (id) => set({ currentWorkflowId: id }),
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
}));
