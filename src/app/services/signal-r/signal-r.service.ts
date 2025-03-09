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
  }

  public async startConnection(options: UserOptions) {
    try {
      await this._hubConnection.start();
      await this._hubConnection.invoke(
        'JoinRoom',
        options.roomName,
        options.username
      );
      this.addEvents();
      this._store.user = options;
      this._store.connectionId = this._hubConnection.connectionId!;
      this.getParticipants(options.roomName).subscribe((participants) => {
        this._store.participants = participants;
        this._chatMediator.joinRoom();
      });
    } catch (error) {
      console.error(error);
    }
  }

  public async stopConnection() {
    try {
      await this._hubConnection.invoke('LeaveRoom');
      this.turnOffEvents();
      await this._hubConnection.stop();
      this._chatMediator.leaveRoom();
    } catch (error) {
      return console.error(error);
    }
  }

  private addEvents() {
    this._hubConnection.on('UserJoined', (user: User) =>
      this._chatMediator.userJoined(user)
    );

    this._hubConnection.on('UserLeft', (user: User) =>
      this._chatMediator.userLeft(user)
    );

    this._hubConnection.on('ReceiveMessage', (message: Message) =>
      this.handleReceivedMessage(message)
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
  }

  private turnOffEvents() {
    const events = [
      'UserJoined',
      'UserLeft',
      'ReceiveMessage',
      'ReceiveOffer',
      'ReceiveAnswer',
      'ReceiveICECandidate',
    ];
    for (const event of events)
      this._hubConnection.off(event);
  }

  public async sendMessage(message: string) {
    await this._hubConnection.invoke('SendMessage', message);
  }

  private handleReceivedMessage(message: Message) {
    this._store.messages.update((messages) => [...messages, message]);
  }

  public async sendOffer(signal: WebRtcSignal) {
    await this._hubConnection.invoke('SendOffer', signal.connectionId, signal.data);
  }

  public async sendAnswer(signal: WebRtcSignal) {
    await this._hubConnection.invoke('SendAnswer', signal.connectionId, signal.data);
  }

  public async sendIceCandidate(
    candidate: RTCIceCandidateInit,
    targetId: string
  ) {
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
