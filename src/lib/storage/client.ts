import { createIndexedDbStorage } from "./indexedDbStorage";
import type { LibraryStorageAdapter } from "./storageAdapter";

let instance: LibraryStorageAdapter | null = null;

export function getLibraryStorage(): LibraryStorageAdapter {
  if (!instance) instance = createIndexedDbStorage();
  return instance;
}
