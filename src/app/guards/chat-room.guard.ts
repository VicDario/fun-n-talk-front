import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { SignalRService } from '@services/signal-r/signal-r.service';
import { StoreService } from '@services/store/store.service';

export const chatRoomGuard: CanActivateFn = () => {
  const { isConnected } = inject(SignalRService);
  const { isRoomMember } = inject(StoreService);
  const router = inject(Router);

  return (isConnected && isRoomMember()) || new RedirectCommand(router.parseUrl('/'));
};
