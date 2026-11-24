import type { HistoryEntry, PlaygroundWorkspaceState } from "./types";

export const WORKSPACE_STORAGE_KEY = "laya-playground:workspace:v1";
export const HISTORY_STORAGE_KEY = "laya-playground:history:v1";
export const MAX_HISTORY_ENTRIES = 15;

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadWorkspaceState(): PlaygroundWorkspaceState | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as PlaygroundWorkspaceState;
  } catch {
    return null;
  }
}

export function saveWorkspaceState(state: PlaygroundWorkspaceState): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / privacy mode storage errors
  }
}

export function clearWorkspaceState(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function loadHistory(): HistoryEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY_ENTRIES) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): HistoryEntry[] {
  const capped = entries.slice(0, MAX_HISTORY_ENTRIES);
  const storage = getStorage();
  if (!storage) return capped;
  try {
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Ignore quota / privacy mode storage errors
  }
  return capped;
}

export function appendHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const existing = loadHistory().filter((item) => item.id !== entry.id);
  return saveHistory([entry, ...existing]);
}

export function clearHistory(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
