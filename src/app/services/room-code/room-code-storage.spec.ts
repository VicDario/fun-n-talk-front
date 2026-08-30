import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearStoredRoomCode,
  getStoredRoomCode,
  ROOM_CODE_STORAGE_KEY,
  writeStoredRoomCode,
} from './room-code-storage';

describe('room-code-storage', () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
  });

  it('round trips a well-formed code through write/read/clear (S26)', () => {
    writeStoredRoomCode('A4K9X2');
    expect(getStoredRoomCode()).toBe('A4K9X2');

    clearStoredRoomCode();
    expect(getStoredRoomCode()).toBeNull();
  });

  it('writes under the exported storage key', () => {
    writeStoredRoomCode('A4K9X2');
    expect(globalThis.sessionStorage.getItem(ROOM_CODE_STORAGE_KEY)).toBe(
      'A4K9X2'
    );
  });

  it('discards a malformed/tampered stored value on read', () => {
    globalThis.sessionStorage.setItem(ROOM_CODE_STORAGE_KEY, 'not-a-code!!');
    expect(getStoredRoomCode()).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredRoomCode()).toBeNull();
  });

  describe('when sessionStorage property access throws', () => {
    let original: PropertyDescriptor | undefined;

    beforeEach(() => {
      original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });

    afterEach(() => {
      if (original) {
        Object.defineProperty(globalThis, 'sessionStorage', original);
      }
    });

    it('read returns null without throwing', () => {
      expect(() => getStoredRoomCode()).not.toThrow();
      expect(getStoredRoomCode()).toBeNull();
    });

    it('write does not throw', () => {
      expect(() => writeStoredRoomCode('A4K9X2')).not.toThrow();
    });

    it('clear does not throw', () => {
      expect(() => clearStoredRoomCode()).not.toThrow();
    });
  });

  describe('when setItem throws (e.g. Safari private mode quota)', () => {
    let original: PropertyDescriptor | undefined;

    beforeEach(() => {
      original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: {
          getItem: () => null,
          setItem: () => {
            throw new DOMException('quota exceeded', 'QuotaExceededError');
          },
          removeItem: () => undefined,
        },
      });
    });

    afterEach(() => {
      if (original) {
        Object.defineProperty(globalThis, 'sessionStorage', original);
      }
    });

    it('write does not throw', () => {
      expect(() => writeStoredRoomCode('A4K9X2')).not.toThrow();
    });
  });
});
