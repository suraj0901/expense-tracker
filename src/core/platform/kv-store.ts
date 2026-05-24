/**
 * OPFS-backed key-value store — replaces localStorage for all app data.
 *
 * Keeps an in-memory cache for synchronous reads. Writes update the cache
 * immediately and flush to OPFS asynchronously.
 */
import { logger } from '../logger';

const cache = new Map<string, string>();
let dirHandle: FileSystemDirectoryHandle | null = null;
let initialized = false;
let opfsAvailable = false;

async function getDir(): Promise<FileSystemDirectoryHandle> {
  if (!dirHandle) {
    const root = await navigator.storage.getDirectory();
    dirHandle = await root.getDirectoryHandle('kv-store', { create: true });
  }
  return dirHandle;
}

function isOpfsAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage;
}

function encodeKey(key: string): string {
  return encodeURIComponent(key) + '.json';
}

function decodeKey(filename: string): string | null {
  if (!filename.endsWith('.json')) return null;
  return decodeURIComponent(filename.slice(0, -5));
}

/** Load all existing keys from OPFS into the in-memory cache. Call once at app boot. */
export async function initKvStore(): Promise<void> {
  if (initialized) return;
  if (!isOpfsAvailable()) {
    opfsAvailable = false;
    initialized = true;
    return;
  }
  opfsAvailable = true;
  try {
    const dir = await getDir();
    const entries = dir.values();
    for await (const entry of entries) {
      if (entry.kind !== 'file') continue;
      const key = decodeKey(entry.name);
      if (key === null) continue;
      try {
        const file = await entry.getFile();
        const text = await file.text();
        cache.set(key, text);
      } catch {
        // skip corrupted files
      }
    }
    logger.info('kvstore:init', { keysLoaded: cache.size });
  } catch (err) {
    logger.error('kvstore:initFailed', err instanceof Error ? err : new Error(String(err)));
  }
  initialized = true;
}

/** Read a value synchronously from the in-memory cache. */
export function kvGet(key: string): string | null {
  return cache.get(key) ?? null;
}

/** List all keys in the cache. */
export function kvKeys(): string[] {
  return Array.from(cache.keys());
}

/** Write a value: updates cache synchronously, persists to OPFS asynchronously. */
export function kvSet(key: string, value: string): void {
  cache.set(key, value);
  persistKey(key, value);
}

/** Remove a key: updates cache synchronously, deletes from OPFS asynchronously. */
export function kvRemove(key: string): void {
  cache.delete(key);
  removeKey(key);
}

/** Clear all keys from cache and OPFS. */
export function kvClear(): void {
  const keys = Array.from(cache.keys());
  cache.clear();
  for (const key of keys) {
    removeKey(key);
  }
}

/** Blocking write — returns a promise that resolves when the file is flushed. */
export async function kvSetAsync(key: string, value: string): Promise<void> {
  cache.set(key, value);
  await persistKey(key, value);
}

/** Blocking read — reads directly from OPFS, bypassing cache. */
export async function kvGetAsync(key: string): Promise<string | null> {
  try {
    const dir = await getDir();
    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await dir.getFileHandle(encodeKey(key));
    } catch {
      return null;
    }
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

export async function kvRemoveAsync(key: string): Promise<void> {
  cache.delete(key);
  await removeKey(key);
}

async function persistKey(key: string, value: string): Promise<void> {
  if (!opfsAvailable) return;
  try {
    const dir = await getDir();
    const fileHandle = await dir.getFileHandle(encodeKey(key), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(value);
    await writable.close();
  } catch (err) {
    logger.error('kvstore:writeFailed', err instanceof Error ? err : new Error(String(err)), { key });
  }
}

async function removeKey(key: string): Promise<void> {
  if (!opfsAvailable) return;
  try {
    const dir = await getDir();
    await dir.removeEntry(encodeKey(key));
  } catch {
    // file may not exist — ignore
  }
}
