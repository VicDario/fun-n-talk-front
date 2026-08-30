import {
  inject,
  Injectable,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { Message } from '@interfaces/message.interface';
import type { SessionNotice } from '@interfaces/room.interface';
import { User, UserOptions } from '@interfaces/user.interface';
import { WebRtcStreamConnection } from '@interfaces/web-rtc.interface';
import { ChatMediatorService } from '@services/chat-mediator/chat-mediator.service';

@Injectable({
  providedIn: 'root',
})
export class StoreService {
  private readonly _chatMediator = inject(ChatMediatorService);
  private _connectionId: string | null = null;
  private _user: UserOptions = { username: '', roomCode: '' };
  private _users = signal<User[]>([]);
  private _messages = signal<Message[]>([]);
  private readonly _remoteStreams = signal<WebRtcStreamConnection[]>([]);
  private readonly _isRoomMember = signal(false);
  public sessionNotice: SessionNotice | null = null;

  constructor() {
    this._chatMediator.onUserJoined$.subscribe((user) =>
      this.addParticipant(user)
    );
    this._chatMediator.onUserLeft$.subscribe((user) =>
      this.removeParticipant(user.connectionId)
    );
    this._chatMediator.onMessage$.subscribe((message) =>
      this.addMessage(message)
    );
  }

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
      users.filter((user) => user.connectionId !== connectionId)
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

  public get isRoomMember(): Signal<boolean> {
    return this._isRoomMember;
  }

  public setRoomMembership(isMember: boolean): void {
    this._isRoomMember.set(isMember);
  }

  public addOrReplaceRemoteStream(stream: WebRtcStreamConnection) {
    this._remoteStreams.update((streams) => {
      const known = streams.some(
        (s) => s.connectionId === stream.connectionId
      );
      if (!known) return [...streams, stream];

      // Replace the entry instead of assigning through to its stream, so the
      // identity change is visible to OnPush templates.
      return streams.map((existing) =>
        existing.connectionId === stream.connectionId ? stream : existing
      );
    });
  }

  public removeRemoteStream(connectionId: string) {
    this._remoteStreams.update((streams) =>
      streams.filter((stream) => stream.connectionId !== connectionId)
    );
  }
}
