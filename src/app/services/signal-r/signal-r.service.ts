import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { Message } from '@interfaces/message.interface';
import { User, UserOptions } from '@interfaces/user.interface';
import type {
  WebRtcCandidate,
  WebRtcIncomingSignal,
  WebRtcSignal,
} from '@interfaces/web-rtc.interface';
import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from '@microsoft/signalr';
import { isWellFormedRoomCode, normalizeRoomCode } from '@services/room-code/room-code';
import {
  clearStoredRoomCode,
  writeStoredRoomCode,
} from '@services/room-code/room-code-storage';
import { ChatMediatorService } from '@services/chat-mediator/chat-mediator.service';
import {
  classifyJoinFailure,
  RoomJoinError,
} from '@services/room/room-failures';
import { StoreService } from '@services/store/store.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private readonly _http = inject(HttpClient);
  private readonly _store = inject(StoreService);
  private readonly _router = inject(Router);
  private readonly _hubConnection: HubConnection;
  private readonly _chatMediator = inject(ChatMediatorService);

  constructor() {
    this._hubConnection = this.buildHubConnection();
    this.registerEvents();
  }

  protected buildHubConnection(): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/communicationHub`)
      .configureLogging(LogLevel.Warning)
      .withAutomaticReconnect()
      .build();
  }

  public async startConnection(options: UserOptions): Promise<void> {
    // Re-validate at the service boundary: the shape gate is a UX fast-fail,
    // never a correctness boundary, but every entry point must pass through
    // it — a caller could bypass a form-level check entirely.
    const roomCode = normalizeRoomCode(options.roomCode);
    if (!isWellFormedRoomCode(roomCode))
      throw new RoomJoinError('invalid-code');

    this._store.user = { ...options, roomCode };

    try {
      await this._hubConnection.start();
      await this.joinRoom();
    } catch (error) {
      const reason = classifyJoinFailure(error);
      this._store.setRoomMembership(false);
      if (reason === 'room-not-found') clearStoredRoomCode();
      // start() rejects (not throws) on a non-Disconnected hub, so a failed
      // join must tear the transport down or every subsequent retry dies on
      // that transport-state message instead of a classifiable reason.
      await this._hubConnection.stop().catch(() => undefined);
      throw new RoomJoinError(reason);
    }
  }

  // Reconnecting gives us a new connection id, and the hub dropped us from the
  // room when the old one died. Every peer is addressed by that id, so the
  // session has to be rebuilt from scratch rather than resumed.
  private async joinRoom() {
    const { roomCode, username } = this._store.user;
    await this._hubConnection.invoke('JoinRoom', roomCode, username);
    this._store.connectionId = this._hubConnection.connectionId!;
    this._store.setRoomMembership(true);
    writeStoredRoomCode(roomCode);
    this._store.participants = await firstValueFrom(
      this.getParticipants(roomCode)
    );
    this._chatMediator.joinRoom();
  }

  public async stopConnection() {
    // A rejected LeaveRoom invoke must not skip the rest of teardown: a
    // server-side leave failure must not strand the client with stale
    // membership, a live hub connection, and open RTCPeerConnections.
    try {
      await this._hubConnection.invoke('LeaveRoom');
    } catch (error) {
      console.error(error);
    } finally {
      this._store.setRoomMembership(false);
      await this._hubConnection.stop().catch(() => undefined);
      this._chatMediator.leaveRoom();
    }
  }

  // Once only. Re-running this per session leaks mediator subscriptions and
  // every signal gets sent twice.
  private registerEvents() {
    this._hubConnection.onreconnected(() => {
      this.rejoinAfterReconnect();
    });

    this._hubConnection.on('UserJoined', (user: User) =>
      this._chatMediator.userJoined(user)
    );

    this._hubConnection.on('UserLeft', (user: User) =>
      this._chatMediator.userLeft(user)
    );

    this._hubConnection.on('ReceiveMessage', (message: Message) =>
      this._chatMediator.receiveMessage(message)
    );

    this._hubConnection.on('ReceiveOffer', (signal: WebRtcIncomingSignal) =>
      this._chatMediator.receiveOffer(signal)
    );

    this._hubConnection.on('ReceiveAnswer', (signal: WebRtcIncomingSignal) =>
      this._chatMediator.receiveAnswer(signal)
    );

    this._hubConnection.on('ReceiveICECandidate', (signal: WebRtcCandidate) =>
      this._chatMediator.receiveIceCandidate(signal)
    );

    this._chatMediator.onSendOffer$.subscribe((offer) => this.sendOffer(offer));

    this._chatMediator.onSendAnswer$.subscribe((signal) =>
      this.sendAnswer(signal)
    );
    this._chatMediator.onIceCandidate$.subscribe(
      ({ candidate, connectionId }) =>
        this.sendIceCandidate(candidate, connectionId)
    );

    this._chatMediator.onSendMessage$.subscribe((message) =>
      this.sendMessage(message)
    );
  }

  // The automatic re-JoinRoom on reconnect can fail once the vacancy TTL has
  // expired. A silent console.error here leaves the user connected-but-
  // roomless with no way back — this ejects them cleanly instead.
  private async rejoinAfterReconnect(): Promise<void> {
    try {
      await this.joinRoom();
    } catch (error) {
      const reason = classifyJoinFailure(error);
      this._store.setRoomMembership(false);
      if (reason === 'room-not-found') clearStoredRoomCode();
      await this._hubConnection.stop().catch(() => undefined);
      // WebRtcService subscribes to onLeaveRoom$ -> stopAllConnections();
      // skipping this leaks RTCPeerConnections and the local media stream.
      this._chatMediator.leaveRoom();
      this._store.sessionNotice = 'reconnect-room-lost';
      this._router.navigate(['/']);
    }
  }

  private async sendMessage(message: string) {
    if (!this.isConnected) return;
    await this._hubConnection.invoke('SendMessage', message);
  }

  public async sendOffer(signal: WebRtcSignal) {
    if (!this.isConnected) return;
    await this._hubConnection.invoke(
      'SendOffer',
      signal.connectionId,
      signal.data
    );
  }

  public async sendAnswer(signal: WebRtcSignal) {
    if (!this.isConnected) return;
    await this._hubConnection.invoke(
      'SendAnswer',
      signal.connectionId,
      signal.data
    );
  }

  public async sendIceCandidate(
    candidate: RTCIceCandidateInit,
    targetId: string
  ) {
    // Peers keep trickling for a moment after the hub is torn down.
    if (!this.isConnected) return;
    await this._hubConnection.invoke(
      'SendICECandidate',
      targetId,
      JSON.stringify(candidate)
    );
  }

  private getParticipants(roomCode: string) {
    return this._http.get<User[]>(
      `${environment.apiUrl}/api/communication/room/${encodeURIComponent(roomCode)}/participants`
    );
  }

  public get isConnected() {
    return this._hubConnection.state === 'Connected';
  }
}
