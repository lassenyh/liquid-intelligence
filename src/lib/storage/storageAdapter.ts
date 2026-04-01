import type { TrackRecord } from "@/lib/types/track";

/**
 * Abstraction for local IndexedDB today; swap for Supabase-backed implementation later.
 * Keep method signatures stable so UI and player logic stay unchanged.
 */
export interface LibraryStorageAdapter {
  getAllTracks(): Promise<TrackRecord[]>;
  getTrack(id: string): Promise<TrackRecord | null>;
  /** Replaces entire track row including blobs */
  saveTrack(
    record: TrackRecord,
    audioBlob: Blob,
    coverBlob?: Blob | null,
  ): Promise<void>;
  updateTrackMeta(
    id: string,
    patch: Partial<Pick<TrackRecord, "title" | "artist" | "album" | "metadataSource">>,
  ): Promise<void>;
  updateTrackWaveform(
    id: string,
    peaks: number[] | null,
    status: TrackRecord["waveformStatus"],
    error?: string,
    durationSec?: number,
  ): Promise<void>;
  patchTrack(id: string, patch: Partial<TrackRecord>): Promise<void>;
  updateCover(id: string, coverBlob: Blob | null): Promise<void>;
  updateOrderIndices(orderedIds: string[]): Promise<void>;
  deleteTrack(id: string): Promise<void>;
  getAudioBlob(id: string): Promise<Blob | null>;
  getCoverBlob(id: string): Promise<Blob | null>;
}
