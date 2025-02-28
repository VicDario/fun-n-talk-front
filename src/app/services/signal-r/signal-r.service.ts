import { EventEmitter, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Message } from '@interfaces/message.interface';
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
  private _messageEventEmitter = new EventEmitter<Message>();

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

  public async stopConnection(roomName: string) {
    try {
      this.leaveRoom(roomName);
      await this._hubConnection.stop();
      if (this.isConnected) throw new Error('Disconnection failed');
    } catch (error) {
      return console.error(error);
    }
  }

  public addEvents() {
    this._hubConnection.on('UserJoined', (username: string) => {
      console.log(username);
    });

    this._hubConnection.on('UserLeft', (connectionId: string) => {
      console.log('User with connectionId ' + connectionId + ' has left.');
    });

    this._hubConnection.on('ReceiveMessage', (message: Message) => {
      this._messageEventEmitter.emit(message);
    });

    this._hubConnection.on(
      'ReceiveIceCandidate',
      (candidate: RTCIceCandidate) => {
        console.log('Received ICE candidate: ' + candidate);
      }
    );

    this._hubConnection.on(
      'ReceiveOffer',
      (offer: RTCSessionDescriptionInit, connectionId: string) => {
        //this._webRtcService.createAnswerToOffer(offer, connectionId);
        console.log('Received offer: ' + offer);
      }
    );

    this._hubConnection.on(
      'ReceiveAnswer',
      (answer: RTCSessionDescriptionInit) => {
        //this.sendAnswer(answer);
      }
    );
  }

  public async joinRoom(roomName: string, userName: string) {
    await this._hubConnection.invoke('JoinRoom', roomName, userName);
  }

  private async leaveRoom(roomName: string) {
    await this._hubConnection.invoke('LeaveRoom', roomName);
  }

  public async sendMessage(roomName: string, message: string) {
    await this._hubConnection.invoke('SendMessage', roomName, message);
  }

  public async onIceConnection(candidate: RTCIceCandidate) {
    await this._hubConnection.invoke('SendIceCandidate', candidate);
  }

  public async sendOffer(offer: RTCSessionDescriptionInit) {
    await this._hubConnection.invoke('SendOffer', offer);
  }

  public async sendAnswer(answer: RTCSessionDescriptionInit) {
    await this._hubConnection.invoke('SendAnswer', answer);
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
}
