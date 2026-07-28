import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
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
import { ChatMediatorService } from '@services/chat-mediator/chat-mediator.service';
import { StoreService } from '@services/store/store.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private readonly _http = inject(HttpClient);
  private readonly _store = inject(StoreService);
  private readonly _hubConnection: HubConnection;
  private readonly _chatMediator = inject(ChatMediatorService);

  constructor() {
    this._hubConnection = new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/communicationHub`)
      .configureLogging(LogLevel.Warning)
      .withAutomaticReconnect()
      .build();

    this.registerEvents();
  }

  public async startConnection(options: UserOptions) {
    try {
      await this._hubConnection.start();
      this._store.user = options;
      await this.joinRoom();
    } catch (error) {
      console.error(error);
    }
  }

  // Reconnecting gives us a new connection id, and the hub dropped us from the
  // room when the old one died. Every peer is addressed by that id, so the
  // session has to be rebuilt from scratch rather than resumed.
  private async joinRoom() {
    const { roomName, username } = this._store.user;
    await this._hubConnection.invoke('JoinRoom', roomName, username);
    this._store.connectionId = this._hubConnection.connectionId!;
    this._store.participants = await firstValueFrom(
      this.getParticipants(roomName)
    );
    this._chatMediator.joinRoom();
  }

  public async stopConnection() {
    try {
      await this._hubConnection.invoke('LeaveRoom');
      await this._hubConnection.stop();
      this._chatMediator.leaveRoom();
    } catch (error) {
      return console.error(error);
    }
  }

  // Once only. Re-running this per session leaks mediator subscriptions and
  // every signal gets sent twice.
  private registerEvents() {
    this._hubConnection.onreconnected(() =>
      this.joinRoom().catch((error) => console.error(error))
    );

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

  private getParticipants(roomName: string) {
    return this._http.get<User[]>(
      `${environment.apiUrl}/api/communication/room/${roomName}/participants`
    );
  }

  public get isConnected() {
    return this._hubConnection.state === 'Connected';
  }
}
