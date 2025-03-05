import { User } from "./user.interface";

export interface WebRtcSignal {
  user: User,
  data: RTCSessionDescriptionInit,
}
