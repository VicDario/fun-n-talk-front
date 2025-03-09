import { NgClass } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { MediaService } from '@services/media/media.service';
import { StoreService } from '@services/store/store.service';

@Component({
  selector: 'app-video-grid',
  imports: [NgClass],
  templateUrl: './video-grid.component.html',
  styleUrl: './video-grid.component.css',
})
export class VideoGridComponent implements OnInit {
  private readonly _mediaService = inject(MediaService);
  private readonly _store = inject(StoreService);
  public readonly localStream = signal<MediaStream | null>(null);

  ngOnInit() {
    this.startLocalStream();
  }

  async startLocalStream() {
    const stream = await this._mediaService.getLocalStream();
    this.localStream.set(stream);
  }

  public get remoteStreamsConnections() {
    return this._store.remoteStreams;
  }
}
