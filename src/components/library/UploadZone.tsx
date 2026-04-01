"use client";

import { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  onFiles: (files: FileList | File[]) => void;
  busy?: boolean;
}

export function UploadZone({ onFiles, busy }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || busy) return;
      const arr = Array.from(list);
      if (arr.length) onFiles(arr);
    },
    [onFiles, busy],
  );

  return (
    <div
      className={`rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
        dragOver
          ? "border-white/30 bg-white/[0.06]"
          : "border-white/[0.12] bg-[#151515]"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aiff,.aif,.flac"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-sm text-zinc-400">
        Drag audio here or{" "}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="font-medium text-white underline-offset-2 hover:underline disabled:opacity-50"
        >
          choose files
        </button>
      </p>
    </div>
  );
}
