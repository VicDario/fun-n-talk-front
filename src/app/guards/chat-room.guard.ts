import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { ChatService } from '@services/chat/chat.service';

export const chatRoomGuard: CanActivateFn = () => {
  const chatService = inject(ChatService);
  return chatService.isConnected;
};
