import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { SignalRService } from '@services/signal-r/signal-r.service';
import type { Message } from '@interfaces/message.interface';
import type { User } from '@interfaces/user.interface';
import { WebRtcService } from '@services/web-rtc.service';
import { EMPTY, mergeMap, Observable, switchMap, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly _signalRService = inject(SignalRService);
  private readonly _webRtcService = inject(WebRtcService);
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
    this.onMessageEvent();
    this.getParticipants()
      .pipe(
        tap((participants) => this._participants.set(participants)),
        switchMap(() => this._participants()),
        mergeMap((participant) =>
          participant.connectionId !== this._signalRService.connectionId
            ? this._webRtcService.createPeerConnection(participant.connectionId, true)
            : EMPTY
        )
      )
      .subscribe();
  }

  public stopConnection(): void {
    this._signalRService.stopConnection();
  }

  private getParticipants(): Observable<User[]> {
    return this._http.get<User[]>(
      `${environment.apiUrl}/api/communication/room/${this._roomName}/participants`
    );
  }

  public sendMessage(message: string): void {
    this._signalRService.sendMessage(message);
  }

  private onMessageEvent(): void {
    this._signalRService.messageEventEmitter.subscribe((message) => {
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
