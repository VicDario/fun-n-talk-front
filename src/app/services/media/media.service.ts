import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private _localStream?: MediaStream;

  public async getLocalStream(): Promise<MediaStream> {
    if (this._localStream) return this._localStream;

    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    this._localStream ??= localStream;
    return localStream;
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
