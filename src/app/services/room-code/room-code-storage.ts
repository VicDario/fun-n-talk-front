import { isWellFormedRoomCode, normalizeRoomCode } from './room-code';

export const ROOM_CODE_STORAGE_KEY = 'funntalk.roomCode';

// Chrome with blocked storage throws SecurityError on the *property access*
// itself, before any method is even called. Wrapping only the property read
// here — each call site below wraps its own method call separately, because
// Safari private mode throws on setItem() even though the property access
// succeeds.
function safeStorage(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function writeStoredRoomCode(code: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(ROOM_CODE_STORAGE_KEY, code);
  } catch {
    // Best-effort persistence — a full or blocked store must not throw.
  }
}

export function getStoredRoomCode(): string | null {
  const storage = safeStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(ROOM_CODE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  const normalized = normalizeRoomCode(raw);
  return isWellFormedRoomCode(normalized) ? normalized : null;
}

export function clearStoredRoomCode(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(ROOM_CODE_STORAGE_KEY);
  } catch {
    // Best-effort — nothing to recover from here either.
  }
}
