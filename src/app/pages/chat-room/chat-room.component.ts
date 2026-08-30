import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatSidebarComponent } from '@components/chat-sidebar/chat-sidebar.component';
import { VideoGridComponent } from '@components/video-grid/video-grid.component';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { MediaService } from '@services/media/media.service';
import { SignalRService } from '@services/signal-r/signal-r.service';

@Component({
  selector: 'app-chat-room',
  imports: [FormsModule, ChatSidebarComponent, VideoGridComponent, NgClass],
  templateUrl: './chat-room.component.html',
  styleUrl: './chat-room.component.css',
})
export class ChatRoomComponent {
  private readonly _mediaService = inject(MediaService);
  private readonly _router = inject(Router);
  private readonly _signalRService = inject(SignalRService);
  // Signals, not fields: zoneless change detection ignores a reassigned field.
  public readonly isVideoEnabled = signal(true);
  public readonly isMicrophoneEnabled = signal(true);

  public async leaveRoom(): Promise<void> {
    // Await teardown before navigating so navigation cannot outrun it.
    await this._signalRService.stopConnection();
    this._router.navigate(['/']);
  }

  public toggleMicrophone(): void {
    this.isMicrophoneEnabled.update((enabled) => !enabled);
    this._mediaService.toggleAudio(this.isMicrophoneEnabled());
  }

  public toggleVideo(): void {
    this.isVideoEnabled.update((enabled) => !enabled);
    this._mediaService.toggleVideo(this.isVideoEnabled());
  }
}
