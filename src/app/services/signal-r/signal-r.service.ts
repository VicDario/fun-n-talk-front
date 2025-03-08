import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Message } from '@interfaces/message.interface';
import { User, UserOptions } from '@interfaces/user.interface';
import { WebRtcCandidate } from '@interfaces/web-rtc-candidate.interface';
import { WebRtcSignal } from '@interfaces/web-rtc-signal.interface';
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
      await this._hubConnection.invoke('JoinRoom', options.roomName, options.username);
      this.addEvents();
      this._store.user = options;
      this._store.connectionId = this._hubConnection.connectionId!;
      this.getParticipants(options.roomName).subscribe(
        (participants) => {
          this._store.participants = participants;
          this._chatMediator.joinRoom();
        }
      );
    } catch (error) {
      console.error(error);
    }
  }

  public async stopConnection() {
    try {
      await this._hubConnection.invoke('LeaveRoom', this._store.user.roomName);
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

    this._hubConnection.on('ReceiveOffer', (signal: WebRtcSignal) =>
      this._chatMediator.receiveOffer(signal)
    );

    this._hubConnection.on('ReceiveAnswer', (signal: WebRtcSignal) =>
      this._chatMediator.receiveAnswer(signal)
    );

    this._hubConnection.on('ReceiveICECandidate', (signal: WebRtcCandidate) =>
      this._chatMediator.receiveIceCandidate(signal)
    );

    this._chatMediator.onSendOffer$.subscribe((offer) => this.sendOffer(offer));

    this._chatMediator.onSendAnswer$.subscribe(({ answer, connectionId }) =>
      this.sendAnswer(answer, connectionId)
    );
    this._chatMediator.onIceCandidate$.subscribe(({ candidate, connectionId }) =>
      this.sendIceCandidate(candidate, connectionId)
    );
  }

  public async sendMessage(message: string) {
    await this._hubConnection.invoke(
      'SendMessage',
      this._store.user.roomName,
      message
    );
  }

  private handleReceivedMessage(message: Message) {
    this._store.messages.update((messages) => [...messages, message]);
  }

  public async sendOffer(offer: RTCSessionDescriptionInit) {
    await this._hubConnection.invoke(
      'SendOffer',
      this._store.user.roomName,
      offer
    );
  }

  public async sendAnswer(answer: RTCSessionDescriptionInit, targetId: string) {
    await this._hubConnection.invoke(
      'SendAnswer',
      this._store.user.roomName,
      targetId,
      answer
    );
  }

  public async sendIceCandidate(
    candidate: RTCIceCandidateInit,
    targetId: string
  ) {
    await this._hubConnection.invoke(
      'SendICECandidate',
      this._store.user.roomName,
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
