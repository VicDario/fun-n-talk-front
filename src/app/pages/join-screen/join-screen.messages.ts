import type {
  CreateFailureReason,
  JoinFailureReason,
} from '@interfaces/room.interface';

// Shared by the client-side shape gate and the hub's "Invalid room code."
// rejection, so both paths render identical copy (S8).
export const ROOM_CODE_SHAPE_MESSAGE = 'Room codes are 6 characters.';

// A Readonly<Record<...>> over a closed union is exhaustive at compile time:
// a new JoinFailureReason without copy here is a type error, not a runtime
// gap discovered later.
export const JOIN_FAILURE_COPY: Readonly<Record<JoinFailureReason, string>> = {
  'invalid-code': ROOM_CODE_SHAPE_MESSAGE,
  'room-not-found':
    "We couldn't find that room. It may have expired or never existed.",
  unknown: "We couldn't join the room. Please try again.",
};

export const CREATE_FAILURE_COPY: Readonly<
  Record<CreateFailureReason, string>
> = {
  'rate-limited': "You're creating rooms too quickly. Please wait a moment and try again.",
  'allocation-failed':
    "We couldn't create a room right now. Please try again.",
  unknown: "We couldn't create a room. Please try again.",
};
