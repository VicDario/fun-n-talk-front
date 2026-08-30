import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { ChatMediatorService } from '@services/chat-mediator/chat-mediator.service';
import {
  getStoredRoomCode,
  writeStoredRoomCode,
} from '@services/room-code/room-code-storage';
import { StoreService } from '@services/store/store.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalRService } from './signal-r.service';

// Minimal fake standing in for @microsoft/signalr's HubConnection. Test
// bodies control `invokeImpl` per case; `onreconnected`'s handler is
// captured so a test can fire it directly.
class FakeHubConnection {
  public state: HubConnectionState = 'Disconnected' as HubConnectionState;
  public connectionId: string | null = 'conn-1';
  public invokeImpl: (
    method: string,
    ...args: unknown[]
  ) => Promise<unknown> = () => Promise.resolve();
  private _onreconnectedHandler: (() => void) | null = null;

  async start(): Promise<void> {
    if (this.state !== ('Disconnected' as HubConnectionState)) {
      throw new Error(
        "Cannot start a HubConnection that is not in the 'Disconnected' state."
      );
    }
    this.state = 'Connected' as HubConnectionState;
  }

  async stop(): Promise<void> {
    this.state = 'Disconnected' as HubConnectionState;
  }

  async invoke(method: string, ...args: unknown[]): Promise<unknown> {
    return this.invokeImpl(method, ...args);
  }

  on(): void {
    // Not exercised by these tests.
  }

  onreconnected(handler: () => void): void {
    this._onreconnectedHandler = handler;
  }

  triggerReconnected(): void {
    this._onreconnectedHandler?.();
  }
}

// Initialization-order trap: the base constructor calls buildHubConnection()
// before any subclass field initializer runs, so a subclass instance field
// read inside the override would still be undefined. A module-scope binding
// assigned in beforeEach, before TestBed.inject(), sidesteps this.
let hub: FakeHubConnection;

class TestSignalRService extends SignalRService {
  protected override buildHubConnection(): HubConnection {
    return hub as unknown as HubConnection;
  }
}

describe('SignalRService', () => {
  let service: SignalRService;
  let store: StoreService;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Without this, jsdom's sessionStorage persists across tests in this
    // file and a later assertion can pass on stale state written by an
    // earlier test rather than on its own precondition (G2).
    globalThis.sessionStorage.clear();
    hub = new FakeHubConnection();
    navigate = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
        { provide: SignalRService, useClass: TestSignalRService },
        // StoreService and ChatMediatorService stay real — Subjects and
        // signals, no I/O.
      ],
    });

    service = TestBed.inject(SignalRService);
    store = TestBed.inject(StoreService);
    http = TestBed.inject(HttpTestingController);
  });

  // The participants GET is issued only after `start()` and `invoke()` each
  // resolve their own microtask, so it never appears synchronously right
  // after calling startConnection(). vi.waitFor retries until the request
  // has actually landed in the testing backend's queue.
  const flushParticipants = async (roomCode: string) => {
    const request = await vi.waitFor(() =>
      http.expectOne(
        `${environment.apiUrl}/api/communication/room/${roomCode}/participants`
      )
    );
    request.flush([]);
  };

  describe('startConnection', () => {
    it('resolves membership and navigable state on a confirmed join (S4, S5)', async () => {
      hub.invokeImpl = async () => undefined;

      const pending = service.startConnection({
        username: 'ana',
        roomCode: 'a4k9x2',
      });
      await Promise.all([pending, flushParticipants('A4K9X2')]);

      expect(store.isRoomMember()).toBe(true);
    });

    it('rejects with a classified RoomJoinError when the hub rejects (S6, S7)', async () => {
      hub.invokeImpl = async () => {
        throw new Error('Room not found.');
      };

      await expect(
        service.startConnection({ username: 'ana', roomCode: 'A4K9X2' })
      ).rejects.toSatisfy((e) => (e as { reason: string }).reason === 'room-not-found');
    });

    it('sets membership false and leaves the hub Disconnected after a rejected join, so retry can start() again', async () => {
      hub.invokeImpl = async () => {
        throw new Error('Room not found.');
      };

      await service
        .startConnection({ username: 'ana', roomCode: 'A4K9X2' })
        .catch(() => undefined);

      expect(store.isRoomMember()).toBe(false);
      expect(hub.state).toBe('Disconnected');

      // Retry: start() must not reject with the transport-state message.
      hub.invokeImpl = async () => undefined;
      const retry = service.startConnection({
        username: 'ana',
        roomCode: 'A4K9X2',
      });
      await Promise.all([
        expect(retry).resolves.toBeUndefined(),
        flushParticipants('A4K9X2'),
      ]);
    });

    it('writes the code to storage only after a confirmed join (S23a)', async () => {
      hub.invokeImpl = async () => undefined;

      const pending = service.startConnection({
        username: 'ana',
        roomCode: 'A4K9X2',
      });
      await Promise.all([pending, flushParticipants('A4K9X2')]);

      expect(getStoredRoomCode()).toBe('A4K9X2');
    });

    it('requests the participants URL with the normalized, encoded code', async () => {
      hub.invokeImpl = async () => undefined;

      const pending = service.startConnection({
        username: 'ana',
        roomCode: ' a4k9x2 ',
      });
      await Promise.all([pending, flushParticipants('A4K9X2')]);
    });

    it('rejects a malformed code at the boundary without invoking the hub (S3)', async () => {
      const invoke = vi.spyOn(hub, 'invoke');

      await expect(
        service.startConnection({ username: 'ana', roomCode: 'TOO-LONG' })
      ).rejects.toSatisfy((e) => (e as { reason: string }).reason === 'invalid-code');

      expect(invoke).not.toHaveBeenCalled();
    });

    // C2: this is the user-initiated resume Join the S24/S25 ratification
    // record designates as the clear-on-room-not-found trigger — distinct
    // from the onreconnected path already covered above.
    it('clears a stale stored code when the resume Join rejects with room-not-found (S25)', async () => {
      writeStoredRoomCode('A4K9X2');
      hub.invokeImpl = async () => {
        throw new Error('Room not found.');
      };

      await service
        .startConnection({ username: 'ana', roomCode: 'A4K9X2' })
        .catch(() => undefined);

      expect(getStoredRoomCode()).toBeNull();
    });
  });

  describe('onreconnected', () => {
    const joinSuccessfully = async () => {
      hub.invokeImpl = async () => undefined;
      const pending = service.startConnection({
        username: 'ana',
        roomCode: 'A4K9X2',
      });
      await Promise.all([pending, flushParticipants('A4K9X2')]);
    };

    it('ejects cleanly on a rejected reconnect: clears membership, leaves the room, navigates away (S21)', async () => {
      await joinSuccessfully();
      const leaveRoomSpy = vi.fn();
      TestBed.inject(ChatMediatorService).onLeaveRoom$.subscribe(leaveRoomSpy);

      hub.invokeImpl = async () => {
        throw new Error('Room not found.');
      };
      hub.triggerReconnected();

      await vi.waitFor(() => {
        expect(navigate).toHaveBeenCalledWith(['/']);
      });

      expect(store.isRoomMember()).toBe(false);
      expect(leaveRoomSpy).toHaveBeenCalled();
      // S21's "a message is shown" clause: signal-r.service.ts:169 sets the
      // notice JoinScreenComponent reads to render the ejection banner.
      expect(store.sessionNotice).toBe('reconnect-room-lost');
    });

    it('clears the stored code when the reconnect rejoin fails with room-not-found (S25)', async () => {
      await joinSuccessfully();
      expect(getStoredRoomCode()).toBe('A4K9X2');

      hub.invokeImpl = async () => {
        throw new Error('Room not found.');
      };
      hub.triggerReconnected();

      await vi.waitFor(() => {
        expect(getStoredRoomCode()).toBeNull();
      });
    });

    it('keeps the user in place on a successful reconnect rejoin, without disruptive navigation (S22)', async () => {
      await joinSuccessfully();

      hub.invokeImpl = async () => undefined;
      hub.triggerReconnected();
      await flushParticipants('A4K9X2');

      await vi.waitFor(() => {
        expect(store.isRoomMember()).toBe(true);
      });
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('stopConnection', () => {
    const joinSuccessfully = async () => {
      hub.invokeImpl = async () => undefined;
      const pending = service.startConnection({
        username: 'ana',
        roomCode: 'A4K9X2',
      });
      await Promise.all([pending, flushParticipants('A4K9X2')]);
    };

    // C1: a rejected LeaveRoom invoke must not skip teardown. Asserted
    // through a real onLeaveRoom$ subscription, the same pattern the
    // existing reconnect test (S21) uses, not by spying on a stub.
    it('clears membership, stops the transport, and leaves the room even when LeaveRoom rejects', async () => {
      await joinSuccessfully();
      const leaveRoomSpy = vi.fn();
      TestBed.inject(ChatMediatorService).onLeaveRoom$.subscribe(leaveRoomSpy);

      hub.invokeImpl = async () => {
        throw new Error('Some server error');
      };

      await service.stopConnection();

      expect(store.isRoomMember()).toBe(false);
      expect(hub.state).toBe('Disconnected');
      expect(leaveRoomSpy).toHaveBeenCalled();
    });

    it('clears membership, stops the transport, and leaves the room on a successful LeaveRoom', async () => {
      await joinSuccessfully();
      const leaveRoomSpy = vi.fn();
      TestBed.inject(ChatMediatorService).onLeaveRoom$.subscribe(leaveRoomSpy);

      hub.invokeImpl = async () => undefined;

      await service.stopConnection();

      expect(store.isRoomMember()).toBe(false);
      expect(hub.state).toBe('Disconnected');
      expect(leaveRoomSpy).toHaveBeenCalled();
    });
  });
});
