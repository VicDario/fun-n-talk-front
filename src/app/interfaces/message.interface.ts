import { User } from "./user.interface";

export interface Message {
  user: User;
  message: string;
  timestamp: Date;
}
