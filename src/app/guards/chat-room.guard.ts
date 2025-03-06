import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SignalRService } from '@services/signal-r/signal-r.service';

export const chatRoomGuard: CanActivateFn = () => {
  const service = inject(SignalRService);
  const router = inject(Router);
  const { isConnected } = service;
  if (!isConnected) return router.navigate(['/']);

  return isConnected;
};
