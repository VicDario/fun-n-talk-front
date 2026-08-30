import { HttpErrorResponse } from '@angular/common/http';
import type {
  CreateFailureReason,
  JoinFailureReason,
} from '@interfaces/room.interface';

// Verified against the live backend source (see the pinning test for exact
// file:line references). SignalR delivers HubException messages verbatim —
// no prefixing, no wrapping — so these are the literal rejection messages.
export const HUB_INVALID_ROOM_CODE = 'Invalid room code.';
export const HUB_ROOM_NOT_FOUND = 'Room not found.';

// A Map, not an object literal: an object literal inherits from
// Object.prototype, so a message of "constructor" or "toString" would
// return an inherited truthy value that `??` cannot fall through on. Map
// keys live outside the prototype chain, so the lookup is genuinely total.
const HUB_FAILURE_REASONS: ReadonlyMap<string, JoinFailureReason> = new Map([
  [HUB_INVALID_ROOM_CODE, 'invalid-code'],
  [HUB_ROOM_NOT_FOUND, 'room-not-found'],
]);

export function classifyJoinFailure(error: unknown): JoinFailureReason {
  const message = error instanceof Error ? error.message : String(error);
  return HUB_FAILURE_REASONS.get(message) ?? 'unknown';
}

export function classifyCreateFailure(error: unknown): CreateFailureReason {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 429) return 'rate-limited';
    if (error.status === 503) return 'allocation-failed';
  }
  return 'unknown';
}

export class RoomJoinError extends Error {
  constructor(public readonly reason: JoinFailureReason) {
    super(`Room join failed: ${reason}`);
    this.name = 'RoomJoinError';
  }
}
