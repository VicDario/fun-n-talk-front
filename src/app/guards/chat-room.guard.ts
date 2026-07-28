import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { SignalRService } from '@services/signal-r/signal-r.service';

export const chatRoomGuard: CanActivateFn = () => {
  const { isConnected } = inject(SignalRService);
  const router = inject(Router);

  return isConnected || new RedirectCommand(router.parseUrl('/'));
};
