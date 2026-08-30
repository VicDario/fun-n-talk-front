import { describe, expect, it } from 'vitest';
import {
  isWellFormedRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from './room-code';

describe('normalizeRoomCode', () => {
  it('trims whitespace and upper-cases (S1)', () => {
    expect(normalizeRoomCode(' a4k9x2 ')).toBe('A4K9X2');
  });

  it('folds confusable characters I->1, L->1, O->0 (S2)', () => {
    expect(normalizeRoomCode('AILO12')).toBe('A11012');
  });

  it('does NOT fold U — the fold set is exactly {I, L, O}', () => {
    // Hand-typed literal, independent of ROOM_CODE_ALPHABET.
    expect(normalizeRoomCode('abcdeu')).toBe('ABCDEU');
  });
});

describe('isWellFormedRoomCode', () => {
  it('rejects a 5-character code (S3)', () => {
    expect(isWellFormedRoomCode('A4K9X')).toBe(false);
  });

  it('rejects a 7-character code (S3)', () => {
    expect(isWellFormedRoomCode('A4K9X2Z')).toBe(false);
  });

  it('rejects U — U is excluded from the alphabet, unlike I/L/O it is not folded', () => {
    expect(isWellFormedRoomCode('ABCDEU')).toBe(false);
  });

  it('accepts every alphabet character individually (never-stricter-than-server)', () => {
    // Hand-typed literal — mirrors RoomCodeExtensions.cs, never the exported constant.
    const handTypedAlphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    for (const char of handTypedAlphabet) {
      expect(isWellFormedRoomCode(char.repeat(6))).toBe(true);
    }
  });

  it('rejects an empty string', () => {
    expect(isWellFormedRoomCode('')).toBe(false);
  });
});

describe('shared constants', () => {
  it('pins ROOM_CODE_ALPHABET to the backend alphabet (hand-typed literal)', () => {
    expect(ROOM_CODE_ALPHABET).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ');
  });

  it('pins ROOM_CODE_LENGTH to 6 (hand-typed literal)', () => {
    expect(ROOM_CODE_LENGTH).toBe(6);
  });
});
