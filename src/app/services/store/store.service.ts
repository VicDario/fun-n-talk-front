import { Injectable, signal, WritableSignal } from '@angular/core';
import { Message } from '@interfaces/message.interface';
import { User, UserOptions } from '@interfaces/user.interface';
import { WebRtcStreamConnection } from '@interfaces/web-rtc.interface';

@Injectable({
  providedIn: 'root',
})
export class StoreService {
  private _connectionId: string | null = null;
  private _user: UserOptions = { username: '', roomName: '' };
  private _users = signal<User[]>([]);
  private _messages = signal<Message[]>([]);
  private readonly _remoteStreams = signal<WebRtcStreamConnection[]>([]);

  public get connectionId() {
    return this._connectionId ?? '';
  }

  public set connectionId(connectionId: string) {
    this._connectionId = connectionId;
  }

  public get user() {
    return this._user;
  }

  public set user(user: UserOptions) {
    this._user = user;
  }

  public get participants(): WritableSignal<User[]> {
    return this._users;
  }

  public set participants(users: User[]) {
    this._users.set(users);
  }

  public addParticipant(user: User) {
    this._users.update((users) => [...users, user]);
  }

  public removeParticipant(connectionId: string) {
    this._users.update((users) =>
      [...users].filter((user) => user.connectionId !== connectionId)
    );
  }

  public get messages(): WritableSignal<Message[]> {
    return this._messages;
  }

  public addMessage(message: Message) {
    this._messages.update((messages) => [...messages, message]);
  }

  public get remoteStreams(): WritableSignal<WebRtcStreamConnection[]> {
    return this._remoteStreams;
  }

  public addOrReplaceRemoteStream(stream: WebRtcStreamConnection) {
    this._remoteStreams.update((remoteStreams) => {
      const streams = [...remoteStreams];
      const index = streams.findIndex(
        (s) => s.connectionId === stream.connectionId
      );

      if (index >= 0) streams[index].stream = stream.stream;
      else streams.push(stream);

      return streams;
    });
  }

  public removeRemoteStream(connectionId: string) {
    this._remoteStreams.update((streams) =>
      [...streams].filter((stream) => stream.connectionId !== connectionId)
    );
  }
}
