import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { TrackRecord } from "@/lib/types/track";
import type { LibraryStorageAdapter } from "./storageAdapter";

const DB_NAME = "music-library-v1";
const DB_VERSION = 1;

interface MusicDB extends DBSchema {
  tracks: {
    key: string;
    value: {
      track: TrackRecord;
      audioBlob: Blob;
      coverBlob?: Blob;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<MusicDB>> | null = null;

function getDb(): Promise<IDBPDatabase<MusicDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MusicDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("tracks")) {
          db.createObjectStore("tracks");
        }
      },
    });
  }
  return dbPromise;
}

export function createIndexedDbStorage(): LibraryStorageAdapter {
  return {
    async getAllTracks() {
      const db = await getDb();
      const keys = await db.getAllKeys("tracks");
      const rows = await Promise.all(
        keys.map((k) => db.get("tracks", k as string)),
      );
      return rows
        .filter(Boolean)
        .map((r) => (r as { track: TrackRecord }).track)
        .sort((a, b) => a.orderIndex - b.orderIndex);
    },

    async getTrack(id: string) {
      const db = await getDb();
      const row = await db.get("tracks", id);
      return row?.track ?? null;
    },

    async saveTrack(record, audioBlob, coverBlob) {
      const db = await getDb();
      await db.put("tracks", {
        track: record,
        audioBlob,
        coverBlob: coverBlob ?? undefined,
      }, record.id);
    },

    async updateTrackMeta(id, patch) {
      const db = await getDb();
      const row = await db.get("tracks", id);
      if (!row) return;
      row.track = {
        ...row.track,
        ...patch,
      };
      await db.put("tracks", row, id);
    },

    async updateTrackWaveform(id, peaks, status, error, durationSec) {
      const db = await getDb();
      const row = await db.get("tracks", id);
      if (!row) return;
      row.track.waveformPeaks = peaks;
      row.track.waveformStatus = status;
      row.track.waveformError = error;
      if (typeof durationSec === "number" && durationSec > 0) {
        row.track.durationSec = durationSec;
      }
      await db.put("tracks", row, id);
    },

    async patchTrack(id, patch) {
      const db = await getDb();
      const row = await db.get("tracks", id);
      if (!row) return;
      row.track = { ...row.track, ...patch };
      await db.put("tracks", row, id);
    },

    async updateCover(id, coverBlob) {
      const db = await getDb();
      const row = await db.get("tracks", id);
      if (!row) return;
      if (coverBlob) row.coverBlob = coverBlob;
      else delete row.coverBlob;
      await db.put("tracks", row, id);
    },

    async updateOrderIndices(orderedIds) {
      const db = await getDb();
      const tx = db.transaction("tracks", "readwrite");
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        const row = await tx.store.get(id);
        if (row) {
          row.track.orderIndex = i;
          await tx.store.put(row, id);
        }
      }
      await tx.done;
    },

    async deleteTrack(id) {
      const db = await getDb();
      await db.delete("tracks", id);
    },

    async getAudioBlob(id) {
      const db = await getDb();
      const row = await db.get("tracks", id);
      return row?.audioBlob ?? null;
    },

    async getCoverBlob(id) {
      const db = await getDb();
      const row = await db.get("tracks", id);
      return row?.coverBlob ?? null;
    },
  };
}
