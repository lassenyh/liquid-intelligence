/** Serializable track metadata stored in IndexedDB (blobs stored alongside). */
export type MetadataSource = "embedded" | "manual" | "filename";

export interface TrackRecord {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  mimeType: string;
  fileName: string;
  createdAt: number;
  orderIndex: number;
  metadataSource: MetadataSource;
  /** Normalized peak values 0–1 for waveform bars */
  waveformPeaks: number[] | null;
  waveformStatus: "pending" | "ready" | "error";
  waveformError?: string;
  /** Set when the file cannot be played or processed in this browser */
  playbackError?: string;
}

export type SortMode = "custom" | "alpha" | "newest" | "duration";
