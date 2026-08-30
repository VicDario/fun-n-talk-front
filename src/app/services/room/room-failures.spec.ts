import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  classifyCreateFailure,
  classifyJoinFailure,
  HUB_INVALID_ROOM_CODE,
  HUB_ROOM_NOT_FOUND,
  RoomJoinError,
} from './room-failures';

describe('hub literal pinning (D7, S10)', () => {
  it(
    'HUB_INVALID_ROOM_CODE matches the backend literal exactly',
    () => {
      expect(
        HUB_INVALID_ROOM_CODE,
        'Hub copy drift. Source of truth: FunNTalk.API/Hubs/CommunicationHub.cs:23. ' +
          'Update HUB_INVALID_ROOM_CODE in services/room/room-failures.ts and re-verify BOTH literals.'
      ).toBe('Invalid room code.');
    }
  );

  it(
    'HUB_ROOM_NOT_FOUND matches the backend literal exactly',
    () => {
      expect(
        HUB_ROOM_NOT_FOUND,
        'Hub copy drift. Source of truth: FunNTalk.Infrastructure/Handlers/JoinRoomHandler.cs:25. ' +
          'Update HUB_ROOM_NOT_FOUND in services/room/room-failures.ts and re-verify BOTH literals.'
      ).toBe('Room not found.');
    }
  );
});

describe('classifyJoinFailure', () => {
  it('classifies the exact "Invalid room code." literal (S8)', () => {
    expect(classifyJoinFailure(new Error('Invalid room code.'))).toBe(
      'invalid-code'
    );
  });

  it('classifies the exact "Room not found." literal (S7)', () => {
    expect(classifyJoinFailure(new Error('Room not found.'))).toBe(
      'room-not-found'
    );
  });

  it('falls through to unknown on a lowercase near-match — proves exact match, not fuzzy (S9)', () => {
    expect(classifyJoinFailure(new Error('room not found'))).toBe('unknown');
  });

  it('falls through to unknown on an unrecognized message (S9)', () => {
    expect(classifyJoinFailure(new Error('Connection lost'))).toBe('unknown');
  });

  it('falls through to unknown for a non-Error input', () => {
    expect(classifyJoinFailure(42)).toBe('unknown');
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'prototype-pollution guard: message %s classifies to unknown, not an inherited value',
    (message) => {
      expect(classifyJoinFailure(new Error(message))).toBe('unknown');
    }
  );

  it('carries the classified reason on RoomJoinError', () => {
    const error = new RoomJoinError('room-not-found');
    expect(error.reason).toBe('room-not-found');
  });
});

describe('classifyCreateFailure', () => {
  it('classifies HTTP 429 as rate-limited regardless of body', () => {
    const error = new HttpErrorResponse({
      status: 429,
      error: { unexpected: 'shape' },
    });
    expect(classifyCreateFailure(error)).toBe('rate-limited');
  });

  it('classifies HTTP 429 as rate-limited with an empty body', () => {
    const error = new HttpErrorResponse({ status: 429, error: null });
    expect(classifyCreateFailure(error)).toBe('rate-limited');
  });

  it('classifies HTTP 503 as allocation-failed regardless of body shape', () => {
    const error = new HttpErrorResponse({
      status: 503,
      error: 'not the documented { message } shape',
    });
    expect(classifyCreateFailure(error)).toBe('allocation-failed');
  });

  it('classifies any other HTTP status as unknown', () => {
    const error = new HttpErrorResponse({ status: 500 });
    expect(classifyCreateFailure(error)).toBe('unknown');
  });

  it('classifies a non-HTTP error (e.g. network failure) as unknown', () => {
    expect(classifyCreateFailure(new Error('network down'))).toBe('unknown');
  });
});
