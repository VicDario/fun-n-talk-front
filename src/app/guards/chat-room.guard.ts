import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { SignalRService } from '@services/signal-r/signal-r.service';

export const chatRoomGuard: CanActivateFn = () => {
  const service = inject(SignalRService);
  return service.isConnected;
};
