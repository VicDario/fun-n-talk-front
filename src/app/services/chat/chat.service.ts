import { Injectable } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import type { Message } from '@interfaces/message.interface';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly _hubConnection: HubConnection;
  private _userName?: string;
  private _groupName?: string;
  private _messages = new BehaviorSubject<Message[]>([]);

  constructor() {
    this._hubConnection = new HubConnectionBuilder()
      .withUrl(environment.hubUrl)
      .configureLogging(LogLevel.Information)
      .withKeepAliveInterval(5000)
      .withAutomaticReconnect()
      .build();

    this.addEvents();
  }

  public set userName(value: string) {
    this._userName = value;
  }

  public get connectionId() {
    return this._hubConnection.connectionId;
  }

  public set groupName(value: string) {
    this._groupName = value;
  }

  public async startConnection() {
    try {
      await this._hubConnection.start();
      if (!this.isConnected) throw new Error('Connection failed');
      this.joinRoom();
    } catch (error) {
      return console.error(error);
    }
  }

  public async stopConnection() {
    try {
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
      this._messages.next([...this._messages.getValue(), message]);
    });
  }

  public async joinRoom() {
    await this._hubConnection.invoke(
      'JoinRoom',
      this._groupName,
      this._userName
    );
  }

  public async sendMessage(message: string) {
    console.log('Sending message: ' + message);
    await this._hubConnection.invoke('SendMessage', this._groupName, message);
  }

  public get $messages() {
    return this._messages.asObservable();
  }

  public get isConnected() {
    return this._hubConnection.state === 'Connected';
  }
}
