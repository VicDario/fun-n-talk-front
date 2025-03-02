import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private _localStream?: MediaStream;

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
