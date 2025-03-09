import { User } from "./user.interface";

export interface WebRtcCandidate {
  user: User,
  candidate: string,
}

export interface WebRtcIncomingSignal {
  user: User,
  data: RTCSessionDescriptionInit,
}

export interface WebRtcStreamConnection {
  connectionId: string;
  stream: MediaStream;
}

export interface WebRtcSignal {
  connectionId: string;
  data: RTCSessionDescriptionInit;
}
