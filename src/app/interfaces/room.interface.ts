export interface RoomDto {
  code: string;
}

export type JoinFailureReason = 'invalid-code' | 'room-not-found' | 'unknown';

export type CreateFailureReason =
  | 'rate-limited'
  | 'allocation-failed'
  | 'unknown';

export type SessionNotice = 'reconnect-room-lost';
