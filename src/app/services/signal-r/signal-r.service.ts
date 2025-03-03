import { EventEmitter, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Message } from '@interfaces/message.interface';
import { User } from '@interfaces/user.interface';
import { WebRtcSignal } from '@interfaces/web-rtc-signal.interface';
import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from '@microsoft/signalr';

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private readonly _hubConnection: HubConnection;
  private _roomName?: string;
  private _messageEventEmitter = new EventEmitter<Message>();
  private _offerEventEmitter = new EventEmitter<WebRtcSignal>();
  private _answerEventEmitter = new EventEmitter<WebRtcSignal>();
  private _iceCandidateEventEmitter = new EventEmitter<WebRtcSignal>();

  constructor() {
    this._hubConnection = new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/communicationHub`)
      .configureLogging(LogLevel.Information)
      .withKeepAliveInterval(5000)
      .withAutomaticReconnect()
      .build();

    this.addEvents();
  }

  public async startConnection() {
    try {
      await this._hubConnection.start();
      if (!this.isConnected) throw new Error('Connection failed');
    } catch (error) {
      return console.error(error);
    }
  }

  public async stopConnection() {
    try {
      this.leaveRoom();
      await this._hubConnection.stop();
      if (this.isConnected) throw new Error('Disconnection failed');
    } catch (error) {
      return console.error(error);
    }
  }

  public addEvents() {
    this._hubConnection.on('UserJoined', (user: User) => {
      console.log(user);
    });

    this._hubConnection.on('UserLeft', (user: User) => {
      console.log(user);
    });

    this._hubConnection.on('ReceiveMessage', (message: Message) =>
      this._messageEventEmitter.emit(message)
    );

    this._hubConnection.on('ReceiveOffer', (signal: WebRtcSignal) =>
      this._offerEventEmitter.emit(signal)
    );
    this._hubConnection.on('ReceiveAnswer', (signal: WebRtcSignal) =>
      this._answerEventEmitter.emit(signal)
    );
    this._hubConnection.on('ReceiveICECandidate', (signal: WebRtcSignal) =>
      this._iceCandidateEventEmitter.emit(signal)
    );
  }

  public async joinRoom(roomName: string, userName: string) {
    this._roomName = roomName;
    await this._hubConnection.invoke('JoinRoom', roomName, userName);
  }

  private async leaveRoom() {
    await this._hubConnection.invoke('LeaveRoom', this._roomName);
  }

  public async sendMessage(message: string) {
    await this._hubConnection.invoke('SendMessage', this._roomName, message);
  }

  public async onIceCandidate(candidate: RTCIceCandidate) {
    await this._hubConnection.invoke(
      'SendICECandidate',
      this._roomName,
      JSON.stringify(candidate)
    );
  }

  public async sendOffer(offer: RTCSessionDescriptionInit) {
    await this._hubConnection.invoke(
      'SendOffer',
      this._roomName,
      JSON.stringify(offer)
    );
  }

  public async sendAnswer(answer: RTCSessionDescriptionInit) {
    await this._hubConnection.invoke(
      'SendAnswer',
      this._roomName,
      JSON.stringify(answer)
    );
  }

  public get connectionId() {
    return this._hubConnection.connectionId;
  }

  public get isConnected() {
    return this._hubConnection.state === 'Connected';
  }

  public get messageEventEmitter() {
    return this._messageEventEmitter;
  }

  public get offerEventEmitter() {
    return this._offerEventEmitter;
  }
  public get answerEventEmitter() {
    return this._answerEventEmitter;
  }
  public get iceCandidateEventEmitter() {
    return this._iceCandidateEventEmitter;
  }
}
