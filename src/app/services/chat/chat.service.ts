import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { SignalRService } from '@services/signal-r/signal-r.service';
import type { Message } from '@interfaces/message.interface';
import type { User } from '@interfaces/user.interface';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly _signalRService = inject(SignalRService);
  private readonly _http = inject(HttpClient);
  private _userName?: string;
  private _roomName?: string;
  private _participants = signal<User[]>([]);
  private _messages = signal<Message[]>([]);

  public set userName(value: string) {
    this._userName = value;
  }

  public set roomName(value: string) {
    this._roomName = value;
  }

  public async initConnection(): Promise<void> {
    await this._signalRService.startConnection();
    await this._signalRService.joinRoom(this._roomName!, this._userName!);
    this.getParticipants();
    this.onMessageEvent();
  }

  public stopConnection(): void {
    this._signalRService.stopConnection(this._roomName!);
  }

  private getParticipants(): void {
    this._http
      .get<User[]>(`${environment.apiUrl}/api/communication/room/${this._roomName}/participants`)
      .subscribe((participants) => this._participants.set(participants));
  }

  public sendMessage(message: string): void {
    this._signalRService.sendMessage(this._roomName!, message);
  }

  private onMessageEvent(): void {
    this._signalRService.messageEventEmitter.subscribe((message) => {
      console.log(message);
      this._messages.update((messages) => [...messages, message]);
    });
  }

  public get connectionId(): string {
    return this._signalRService.connectionId ?? '';
  }

  public get messages() {
    return this._messages;
  }

  public get participants() {
    return this._participants;
  }
}
