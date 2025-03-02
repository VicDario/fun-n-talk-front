import { NgClass } from '@angular/common';
import { Component, inject, Input, signal } from '@angular/core';
import { MediaService } from '@services/media/media.service';
import { WebRtcService } from '@services/web-rtc.service';

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
    this.localStream.set(stream);
  }

  public get remoteStreams() {
    return this._webRtcService.remoteStreams;
  }

  public get gridClass() {
    const count = this.remoteStreams().length;
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  }
}
