import { authFetch } from "./authHelper";

export interface WorkflowRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  name: string;
  nodes_json: string | null;
  edges_json: string | null;
  created_at: string;
  updated_at: string | null;
}

export async function createWorkflow(payload: {
  name: string;
  project_id?: string | null;
  nodes_json?: string | null;
  edges_json?: string | null;
}): Promise<WorkflowRow> {
  const res = await authFetch("/workflows/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createWorkflow failed: ${res.status}`);
  return res.json();
}

export async function listWorkflows(): Promise<WorkflowRow[]> {
  const res = await authFetch("/workflows/");
  if (!res.ok) throw new Error(`listWorkflows failed: ${res.status}`);
  return res.json();
}

export async function getWorkflow(id: string): Promise<WorkflowRow> {
  const res = await authFetch(`/workflows/${id}`);
  if (!res.ok) throw new Error(`getWorkflow failed: ${res.status}`);
  return res.json();
}

export async function updateWorkflow(
  id: string,
  payload: { name?: string; nodes_json?: string | null; edges_json?: string | null },
): Promise<WorkflowRow> {
  const res = await authFetch(`/workflows/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateWorkflow failed: ${res.status}`);
  return res.json();
}

export async function deleteWorkflow(id: string): Promise<void> {
  const res = await authFetch(`/workflows/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteWorkflow failed: ${res.status}`);
}
