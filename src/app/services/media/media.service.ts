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

      this.error.set(null);
      return this.cacheStream(localStream);
    } catch (videoError) {
      return this.getAudioOnlyStream(videoError);
    }
  }

  // A combined request is all-or-nothing, so a missing or blocked camera also
  // rejects a perfectly usable microphone. Asking again for audio alone tells
  // the two failures apart and keeps the user audible.
  private async getAudioOnlyStream(videoError: unknown): Promise<MediaStream> {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      this.error.set(this.describeCameraFailure(videoError));
      return this.cacheStream(audioStream);
    } catch (audioError) {
      this.error.set(this.describeFailure(audioError));

      // An empty stream keeps the call alive: the user stays in the room and
      // can still see and hear everyone else. It is left uncached so the next
      // join retries instead of reusing a stream with nothing in it.
      return new MediaStream();
    }
  }

  private cacheStream(stream: MediaStream): MediaStream {
    this._localStream = stream;
    return stream;
  }

  private describeCameraFailure(error: unknown): string {
    switch (this.errorName(error)) {
      case 'NotAllowedError':
        return 'Camera access was blocked, so you joined with audio only. Allow it in your browser settings, then rejoin the room.';
      case 'NotFoundError':
        return 'No camera was found on this device, so you joined with audio only.';
      case 'NotReadableError':
        return 'Your camera is already being used by another application, so you joined with audio only.';
      default:
        return 'Your camera could not be started, so you joined with audio only.';
    }
  }

  private describeFailure(error: unknown): string {
    switch (this.errorName(error)) {
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

  private errorName(error: unknown): string {
    return error instanceof DOMException ? error.name : '';
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
