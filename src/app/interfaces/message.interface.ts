export interface Message {
  user: User;
  message: string;
  timestamp: Date;
}

export interface User {
  username: string;
  connectionId: string;
}
