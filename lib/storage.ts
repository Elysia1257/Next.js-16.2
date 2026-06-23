/**
 * Supabase Storage helpers.
 * 
 * Before using, create a public bucket "media" in your Supabase dashboard:
 *   1. Go to Storage → New Bucket → name it "media"
 *   2. Check "Public bucket"
 *   3. Under Policies, add: INSERT allowed for everyone (dev) or authenticated
 */
const BUCKET = "media";

export interface UploadResult {
  url: string;
  path: string;
}

export async function uploadToSupabase(
  file: File,
  folder: "images" | "videos" = "images",
): Promise<UploadResult> {
  const ext = file.name.split(".").pop() || "png";
  const name = `${crypto.randomUUID()}.${ext}`;
  const path = `${folder}/${name}`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Use raw REST API for more reliable upload
  const url = `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: supabaseKey, "x-upsert": "true" },
    body: file,
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[storage] Upload failed:", res.status, body);
    throw new Error(`Upload failed: ${res.status} ${body}`);
  }

  return { url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`, path };
}

export async function deleteFromSupabase(url: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const prefix = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(prefix)) return;
  const filePath = url.substring(prefix.length);
  const deleteUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${filePath}`;
  console.log("[storage] Deleting:", deleteUrl);
  const res = await fetch(deleteUrl, {
    method: "DELETE",
    headers: { apikey: supabaseKey },
  });
  if (!res.ok) console.error("[storage] Delete failed:", res.status, await res.text());
  else console.log("[storage] Deleted OK");
}
