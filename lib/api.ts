import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

/* ------------------------------------------------------------------ */
/*  Per-node generation APIs                                           */
/* ------------------------------------------------------------------ */

export interface GenerateImagePayload {
  prompt: string;
  model: string;
  aspect_ratio: string;
  quality: string;
  resolution?: string;
  reference_images?: string[];
}

export interface GenerateVideoPayload {
  prompt: string;
  model: string;
  duration: number;
  aspect_ratio: string;
  resolution: string;
  audio_enabled: boolean;
  vidu_mode?: string;
  seed?: number;
  subtitle_enabled?: boolean;
  reference_images?: string[];
  start_frame_url?: string;
  end_frame_url?: string;
}

export interface GenerateResponse {
  task_id: string;
  status: string;
}

export interface TaskResultResponse {
  id: string;
  status: string;
  result: string | null;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  error_message?: string;
}

export async function generateImage(
  payload: GenerateImagePayload,
): Promise<GenerateResponse> {
  const res = await api.post<GenerateResponse>("/generate/image", payload);
  return res.data;
}

export async function generateVideo(
  payload: GenerateVideoPayload,
): Promise<GenerateResponse> {
  const res = await api.post<GenerateResponse>("/generate/video", payload);
  return res.data;
}

export async function pollTaskResult(
  taskId: string,
): Promise<TaskResultResponse> {
  const res = await api.get<TaskResultResponse>(`/task/${taskId}`);
  return res.data;
}

/* ------------------------------------------------------------------ */
/*  Image upload                                                        */
/* ------------------------------------------------------------------ */

export interface UploadImageResponse {
  success: boolean;
  filename: string;
  url: string;
}

export async function uploadImage(file: File): Promise<UploadImageResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<UploadImageResponse>("/upload/image", form);
  const data = res.data;
  if (data.url && !data.url.startsWith("http")) {
    data.url = API_BASE_URL + data.url;
  }
  return data;
}
