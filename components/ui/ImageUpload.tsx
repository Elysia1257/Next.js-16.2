"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { uploadImage } from "@/lib/api";
import { Spinner } from "@/components/nodes/nodeStyles";


const DRAG_CLASSES: Record<string, string> = {
  blue:    "border-blue-400 bg-blue-500/10 text-blue-400",
  purple:  "border-purple-400 bg-purple-500/10 text-purple-400",
  green:   "border-green-400 bg-green-500/10 text-green-400",
  red:     "border-red-400 bg-red-500/10 text-red-400",
  amber:   "border-amber-400 bg-amber-500/10 text-amber-400",
  zinc:    "border-zinc-400 bg-zinc-500/10 text-zinc-400",
  neutral: "border-neutral-400 bg-neutral-500/10 text-neutral-400",
};
const dc = (accent: string): string => DRAG_CLASSES[accent] ?? DRAG_CLASSES.zinc;
/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ImageUploadProps {
  /** List of uploaded image URLs */
  images: string[];
  /** Called with the full new array when an image is added */
  onImagesChange: (urls: string[]) => void;
  accent?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ImageUpload({
  images,
  onImagesChange,
  accent = "blue",
}: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  /* ---- upload handler ---- */
  const doUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadImage(file);
      onImagesChange([...images, res.url]);
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  }, [images, onImagesChange]);

  /* ---- file input ---- */
  const handleFileChange = useCallback(() => {
    const file = fileRef.current?.files?.[0];
    if (file) doUpload(file);
  }, [doUpload]);

  /* ---- drag events ---- */
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      doUpload(file);
    } else {
      setDragOver(false);
    }
  }, [doUpload]);

  const removeImage = useCallback((index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  }, [images, onImagesChange]);

  /* ---- render ---- */
  return (
    <div className="space-y-1.5">
      {/* Existing images grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {images.map((url, i) => (
            <div
              key={url}
              className="relative group rounded-lg overflow-hidden border border-zinc-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Reference ${i + 1}`}
                className="w-full h-20 object-cover"
              />

              {/* Hover actions */}
              <div className="absolute inset-0 bg-zinc-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                  className="px-2.5 py-1 text-[10px] font-medium bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/30 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {/* Add another tile */}
          <div
            onClick={(e) => { e.stopPropagation(); if (!uploading) fileRef.current?.click(); }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`w-full h-20 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors cursor-pointer ${
              dragOver
                ? dc(accent)
                : "border-zinc-600 text-zinc-500 hover:border-zinc-500 hover:text-zinc-400"
            } ${uploading ? "pointer-events-none opacity-50" : ""}`}
          >
            {uploading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Empty state: full-width drop zone */}
      {images.length === 0 && (
        <div
          onClick={(e) => { e.stopPropagation(); if (!uploading) fileRef.current?.click(); }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            dragOver
              ? dc(accent)
              : "border-zinc-600 text-zinc-500 hover:border-zinc-500 hover:text-zinc-400"
          } ${uploading ? "pointer-events-none opacity-50" : ""}`}
        >
          {uploading ? (
            <>
              <Spinner className="h-5 w-5" />
              <span className="text-[10px]">Uploading...</span>
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <span className="text-[10px] font-medium">
                {dragOver ? "Drop images here" : "Upload or drag images"}
              </span>
              <span className="text-[9px] text-zinc-600">PNG, JPG, WEBP — multiple</span>
            </>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}