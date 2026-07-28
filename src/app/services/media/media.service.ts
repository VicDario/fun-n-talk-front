import { inject, Injectable, signal } from '@angular/core';
import { ChatMediatorService } from '@services/chat-mediator/chat-mediator.service';

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly _chatMediator = inject(ChatMediatorService);
  private _localStream?: MediaStream;
  public readonly error = signal<string | null>(null);

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
      this.error.set(null);
      return localStream;
    } catch (error) {
      this.error.set(this.describeError(error));

      // An empty stream keeps the call alive: the user stays in the room and
      // can still see and hear everyone else.
      return new MediaStream();
    }
  }

  private describeError(error: unknown): string {
    switch (error instanceof DOMException ? error.name : '') {
      case 'NotAllowedError':
        return 'Camera and microphone access was blocked. Allow it in your browser settings, then rejoin the room.';
      case 'NotFoundError':
        return 'No camera or microphone was found on this device.';
      case 'NotReadableError':
        return 'Your camera or microphone is already being used by another application.';
      default:
        return 'Your camera and microphone could not be started. Others can still see and hear each other.';
    }
  }

  // Tracks keep the camera lit until stopped. Clearing the cache makes the
  // next join re-acquire instead of reusing ended tracks.
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
