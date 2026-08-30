// Mirrors the backend's RoomCodeExtensions.cs exactly. Alphabet and length
// are shared constants, not parameters — the backend removed that knob
// because it lets generator and validator disagree at runtime.
export const ROOM_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ROOM_CODE_LENGTH = 6;

// Only I, L, O are folded. U is deliberately excluded from the alphabet and
// is NOT folded to anything — a code containing U fails the shape gate.
const CONFUSABLE_FOLD: ReadonlyMap<string, string> = new Map([
  ['I', '1'],
  ['L', '1'],
  ['O', '0'],
]);

export function normalizeRoomCode(raw: string): string {
  const trimmedUpper = raw.trim().toUpperCase();
  let folded = '';
  for (const char of trimmedUpper) {
    folded += CONFUSABLE_FOLD.get(char) ?? char;
  }
  return folded;
}

export function isWellFormedRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const char of code) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}
