"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayerProvider, useAudioPlayer } from "@/lib/player";
import { getLibraryStorage } from "@/lib/storage/client";
import type { SortMode, TrackRecord } from "@/lib/types/track";
import { ingestAudioFile } from "@/lib/upload/ingestTrack";
import { NowPlayingBar } from "./NowPlayingBar";
import { TrackEditModal } from "./TrackEditModal";
import { TrackRow } from "./TrackRow";
import { UploadZone } from "./UploadZone";

const storage = getLibraryStorage();

/** Logo text split for per-letter spacing across full width */
const LOGO_WORDMARK = "LIQUID INTELLIGENCE";

function filterTracks(tracks: TrackRecord[], q: string): TrackRecord[] {
  const s = q.trim().toLowerCase();
  if (!s) return tracks;
  return tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(s) || t.artist.toLowerCase().includes(s),
  );
}

function sortTracks(tracks: TrackRecord[], mode: SortMode): TrackRecord[] {
  const copy = [...tracks];
  switch (mode) {
    case "custom":
      return copy.sort((a, b) => a.orderIndex - b.orderIndex);
    case "alpha":
      return copy.sort(
        (a, b) =>
          a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist),
      );
    case "newest":
      return copy.sort((a, b) => b.createdAt - a.createdAt);
    case "duration":
      return copy.sort((a, b) => b.durationSec - a.durationSec);
    default:
      return copy;
  }
}

function LibraryInner() {
  const {
    activeTrackId,
    setOrderedTrackIds,
    setActiveTrackMeta,
    clearActive,
    refreshActiveArtwork,
  } = useAudioPlayer();

  const [tracks, setTracks] = useState<TrackRecord[]>([]);
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [artistFilter, setArtistFilter] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("custom");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [editTrack, setEditTrack] = useState<TrackRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverTargetIdRef = useRef<string | null>(null);

  const revokeCover = useCallback((id: string) => {
    setCoverUrls((prev) => {
      const next = new Map(prev);
      const u = next.get(id);
      if (u) URL.revokeObjectURL(u);
      next.delete(id);
      return next;
    });
  }, []);

  const refreshLibrary = useCallback(async () => {
    const list = await storage.getAllTracks();
    setTracks(list);
    setCoverUrls((prev) => {
      for (const u of prev.values()) URL.revokeObjectURL(u);
      return new Map();
    });
    const next = new Map<string, string>();
    for (const t of list) {
      const b = await storage.getCoverBlob(t.id);
      if (b) next.set(t.id, URL.createObjectURL(b));
    }
    setCoverUrls(next);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void refreshLibrary();
    });
    return () => cancelAnimationFrame(id);
  }, [refreshLibrary]);

  useEffect(() => {
    if (!tracks.some((t) => t.waveformStatus === "pending")) return;
    const id = window.setInterval(() => {
      void refreshLibrary();
    }, 700);
    return () => window.clearInterval(id);
  }, [tracks, refreshLibrary]);

  const uniqueArtists = useMemo(() => {
    const names = new Set<string>();
    for (const t of tracks) {
      const a = t.artist.trim();
      if (a) names.add(a);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [tracks]);

  const artistFilterEffective = useMemo(() => {
    if (artistFilter === "All") return "All";
    if (uniqueArtists.includes(artistFilter)) return artistFilter;
    return "All";
  }, [artistFilter, uniqueArtists]);

  const displayed = useMemo(() => {
    let f = filterTracks(tracks, search);
    if (artistFilterEffective !== "All") {
      f = f.filter((t) => t.artist.trim() === artistFilterEffective);
    }
    return sortTracks(f, sortMode);
  }, [tracks, search, sortMode, artistFilterEffective]);

  const displayedIds = useMemo(() => displayed.map((t) => t.id), [displayed]);

  const allowReorder =
    sortMode === "custom" &&
    search.trim() === "" &&
    artistFilterEffective === "All";

  useEffect(() => {
    setOrderedTrackIds(displayedIds);
  }, [displayedIds, setOrderedTrackIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = displayedIds.indexOf(active.id as string);
      const newIndex = displayedIds.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(displayed, oldIndex, newIndex);
      const ids = reordered.map((t) => t.id);
      await storage.updateOrderIndices(ids);
      setTracks((prev) => {
        const map = new Map(prev.map((t) => [t.id, { ...t }]));
        ids.forEach((id, i) => {
          const row = map.get(id);
          if (row) row.orderIndex = i;
        });
        return Array.from(map.values());
      });
    },
    [displayed, displayedIds],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;
      setUploadBusy(true);
      setUploadErrors([]);
      const errs: string[] = [];
      let baseOrder =
        tracks.length === 0
          ? 0
          : Math.max(...tracks.map((t) => t.orderIndex)) + 1;

      for (const file of arr) {
        const result = await ingestAudioFile(file, storage, baseOrder);
        baseOrder += 1;
        if (!result.ok) {
          errs.push(`${result.fileName}: ${result.message}`);
        }
      }

      await refreshLibrary();
      await refreshActiveArtwork();
      setUploadErrors(errs);
      setUploadBusy(false);
    },
    [tracks, refreshLibrary, refreshActiveArtwork],
  );

  const openEdit = (t: TrackRecord) => {
    setEditTrack(t);
    setEditOpen(true);
  };

  const saveEdit = async (payload: {
    title: string;
    artist: string;
    album?: string;
  }) => {
    if (!editTrack) return;
    await storage.updateTrackMeta(editTrack.id, {
      ...payload,
      metadataSource: "manual",
    });
    await refreshLibrary();
    if (activeTrackId === editTrack.id) {
      const updated = await storage.getTrack(editTrack.id);
      if (updated) setActiveTrackMeta(updated);
    }
    await refreshActiveArtwork();
  };

  const openCover = (id: string) => {
    coverTargetIdRef.current = id;
    coverInputRef.current?.click();
  };

  const onCoverPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = coverTargetIdRef.current;
    e.target.value = "";
    coverTargetIdRef.current = null;
    if (!file || !id) return;
    revokeCover(id);
    await storage.updateCover(id, file);
    await refreshLibrary();
    if (activeTrackId === id) await refreshActiveArtwork();
  };

  const removeTrack = async (id: string) => {
    if (activeTrackId === id) clearActive();
    revokeCover(id);
    await storage.deleteTrack(id);
    await refreshLibrary();
  };

  const activeCoverUrl =
    activeTrackId && coverUrls.has(activeTrackId)
      ? coverUrls.get(activeTrackId)!
      : null;

  const listSection =
    allowReorder ? (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={displayedIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="divide-y divide-white/[0.04]">
            {displayed.map((t) => (
              <div key={t.id} className="content-visibility-auto">
                <TrackRow
                  track={t}
                  coverUrl={coverUrls.get(t.id) ?? null}
                  sortable
                  onEdit={() => openEdit(t)}
                  onChangeCover={() => openCover(t.id)}
                  onDelete={() => void removeTrack(t.id)}
                />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    ) : (
      <div className="divide-y divide-white/[0.04]">
        {displayed.map((t) => (
          <div key={t.id} className="content-visibility-auto">
            <TrackRow
              track={t}
              coverUrl={coverUrls.get(t.id) ?? null}
              sortable={false}
              onEdit={() => openEdit(t)}
              onChangeCover={() => openCover(t.id)}
              onDelete={() => void removeTrack(t.id)}
            />
          </div>
        ))}
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-2">
      <header className="shrink-0 border-b border-white/[0.06] pb-4 pt-[50px]">
        {/* Logo: each letter spaced evenly across full width (same as upload zone) */}
        <h1
          id="logo"
          className="block w-full text-[clamp(1.35rem,4.2vw,2.5rem)] font-semibold leading-tight text-zinc-300 sm:text-[3rem]"
          style={{ fontFamily: "var(--font-rajdhani), ui-sans-serif, sans-serif" }}
          aria-label={LOGO_WORDMARK}
        >
          <span className="flex w-full justify-between" aria-hidden>
            {LOGO_WORDMARK.split("").map((ch, i) => (
              <span key={i} className="inline-block shrink-0">
                {ch === " " ? "\u00a0" : ch}
              </span>
            ))}
          </span>
        </h1>
        <div className="mt-[50px] flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Search title or artist"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white placeholder:text-zinc-600 sm:max-w-xs"
          />
          <label className="flex min-w-0 items-center gap-2 text-sm text-zinc-400">
            Sort
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-lg border border-white/10 bg-[#151515] px-2 py-1.5 text-white"
            >
              <option value="custom">Manual</option>
              <option value="alpha">A–Z</option>
              <option value="newest">Newest</option>
              <option value="duration">Duration</option>
            </select>
          </label>
          <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-zinc-400 sm:max-w-[min(100%,280px)]">
            Artist
            <select
              value={artistFilterEffective}
              onChange={(e) => setArtistFilter(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#151515] px-2 py-1.5 text-white sm:flex-none sm:min-w-[200px]"
            >
              <option value="All">All</option>
              {uniqueArtists.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {sortMode === "custom" &&
          (search.trim() !== "" || artistFilterEffective !== "All") && (
          <p className="mt-2 text-xs text-zinc-600">
            Clear search and artist filter to drag-reorder tracks.
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        <UploadZone onFiles={handleFiles} busy={uploadBusy} />
        {uploadErrors.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
            {uploadErrors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        )}
        {displayed.length === 0 ? (
          <p className="mt-8 text-center text-sm text-zinc-600">
            No tracks yet. Upload audio above.
          </p>
        ) : (
          <div className="mt-6">{listSection}</div>
        )}
      </div>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onCoverPicked}
      />

      <NowPlayingBar coverUrl={activeCoverUrl} />

      <TrackEditModal
        key={editOpen && editTrack ? editTrack.id : "closed"}
        track={editTrack}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditTrack(null);
        }}
        onSave={(p) => void saveEdit(p)}
      />
    </div>
  );
}

export function MusicLibraryPage() {
  return (
    <AudioPlayerProvider storage={storage}>
      <LibraryInner />
    </AudioPlayerProvider>
  );
}
