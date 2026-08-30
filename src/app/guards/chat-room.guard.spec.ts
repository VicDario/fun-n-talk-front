import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RedirectCommand, Router } from '@angular/router';
import { StoreService } from '@services/store/store.service';
import { SignalRService } from '@services/signal-r/signal-r.service';
import { beforeEach, describe, expect, it } from 'vitest';
import { chatRoomGuard } from './chat-room.guard';

describe('chatRoomGuard', () => {
  let store: StoreService;

  const runGuard = () =>
    TestBed.runInInjectionContext(() =>
      // Route/state snapshots are irrelevant to this guard's decision.
      chatRoomGuard(
        {} as never,
        {} as never
      )
    );

  const configure = (isConnected: boolean) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SignalRService, useValue: { isConnected } },
        // The repo's literal-mock idiom for SignalRService — a hub is
        // irrelevant to a guard (D11).
        {
          provide: Router,
          useValue: { parseUrl: (url: string) => url },
        },
      ],
    });
    store = TestBed.inject(StoreService);
  };

  beforeEach(() => {
    configure(true);
  });

  it('allows access when connected and a room member (S19)', () => {
    store.setRoomMembership(true);

    expect(runGuard()).toBe(true);
  });

  it('redirects when connected but not a room member (S18 — the regression)', () => {
    store.setRoomMembership(false);

    expect(runGuard()).toBeInstanceOf(RedirectCommand);
  });

  it('redirects when membership was set and then cleared, even while connected (S20)', () => {
    store.setRoomMembership(true);
    store.setRoomMembership(false);

    expect(runGuard()).toBeInstanceOf(RedirectCommand);
  });

  it('redirects when disconnected, even if a member', () => {
    configure(false);
    store.setRoomMembership(true);

    expect(runGuard()).toBeInstanceOf(RedirectCommand);
  });
});
