import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { chatRoomGuard } from './chat-room.guard';

describe('chatRoomGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
      TestBed.runInInjectionContext(() => chatRoomGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
