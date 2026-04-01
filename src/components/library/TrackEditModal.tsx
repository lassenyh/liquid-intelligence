"use client";

import { useState } from "react";
import type { TrackRecord } from "@/lib/types/track";

interface TrackEditModalProps {
  track: TrackRecord | null;
  open: boolean;
  onClose: () => void;
  onSave: (payload: { title: string; artist: string; album?: string }) => void;
}

export function TrackEditModal({
  track,
  open,
  onClose,
  onSave,
}: TrackEditModalProps) {
  const [title, setTitle] = useState(track?.title ?? "");
  const [artist, setArtist] = useState(track?.artist ?? "");
  const [album, setAlbum] = useState(track?.album ?? "");

  if (!open || !track) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-white/10 bg-[#1a1a1a] p-4 shadow-2xl sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-white">Edit track</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-zinc-500">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Artist
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Album (optional)
            <input
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({
                title: title.trim() || "Untitled",
                artist: artist.trim() || "Unknown artist",
                album: album.trim() || undefined,
              });
              onClose();
            }}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
