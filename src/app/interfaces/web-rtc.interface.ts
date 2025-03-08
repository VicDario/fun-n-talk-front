import { User } from "./user.interface";

export interface WebRtcCandidate {
  user: User,
  candidate: string,
}

export interface WebRtcSignal {
  user: User,
  data: RTCSessionDescriptionInit,
}

export interface WebRtcStreamConnection {
  connectionId: string;
  stream: MediaStream;
}
