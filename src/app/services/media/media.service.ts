import { inject, Injectable } from '@angular/core';
import { ChatMediatorService } from '@services/chat-mediator/chat-mediator.service';

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly _chatMediator = inject(ChatMediatorService);
  private _localStream?: MediaStream;

  constructor() {
    this._chatMediator.onLeaveRoom$.subscribe(() => this.stopLocalStream());
  }

  public async getLocalStream(): Promise<MediaStream> {
    if (this._localStream) return this._localStream;

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      this._localStream = localStream;
      return localStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);

      // Return an empty stream with no tracks to prevent breaking the app
      const emptyStream = new MediaStream();
      return emptyStream;
    }
  }

  /**
   * Tracks hold the camera and microphone open until they are stopped, so
   * leaving a room without this leaves the recording indicator lit. Clearing
   * the cache also means the next join re-acquires instead of reusing ended
   * tracks.
   */
  public stopLocalStream(): void {
    this._localStream?.getTracks().forEach((track) => track.stop());
    this._localStream = undefined;
  }

  public toggleVideo(enabled: boolean): void {
    if (!this._localStream) return;
    this._localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  public toggleAudio(enabled: boolean): void {
    if (!this._localStream) return;
    this._localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }
}
