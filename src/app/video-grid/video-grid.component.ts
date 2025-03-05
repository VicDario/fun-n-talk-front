import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MediaService } from '@services/media/media.service';
import { WebRtcService } from '@services/web-rtc/web-rtc.service';

@Component({
  selector: 'app-video-grid',
  imports: [NgClass],
  templateUrl: './video-grid.component.html',
  styleUrl: './video-grid.component.css',
})
export class VideoGridComponent {
  private readonly _mediaService = inject(MediaService);
  private readonly _webRtcService = inject(WebRtcService);
  public readonly localStream = signal<MediaStream | null>(null);
  public isVideoEnabled = true;
  public isAudioEnabled = true;

  ngOnInit() {
    this.startLocalStream();
  }

  async startLocalStream() {
    const stream = await this._mediaService.getLocalStream();
    stream.getAudioTracks().forEach((track) => (track.enabled = false));
    this.localStream.set(stream);
  }

  public get remoteStreamsConnections() {
    return this._webRtcService.remoteStreams;
  }
}
