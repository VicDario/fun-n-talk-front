import { User } from "./user.interface";

export interface WebRtcCandidate {
  user: User,
  candidate: string,
}
