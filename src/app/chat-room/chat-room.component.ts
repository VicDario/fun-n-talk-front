import { Component, inject } from '@angular/core';
import { ChatService } from '@services/chat/chat.service';
import { FormsModule } from '@angular/forms';
import { ChatSidebarComponent } from '@app/chat-sidebar/chat-sidebar.component';
import { VideoGridComponent } from '@app/video-grid/video-grid.component';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { MediaService } from '@services/media/media.service';

@Component({
  selector: 'app-chat-room',
  imports: [FormsModule, ChatSidebarComponent, VideoGridComponent, NgClass],
  templateUrl: './chat-room.component.html',
  styleUrl: './chat-room.component.css',
})
export class ChatRoomComponent {
  private readonly _chatService = inject(ChatService);
  private readonly _mediaService = inject(MediaService);
  private readonly _router = inject(Router);
  public messageToSend = '';
  public participants: any[] = [];
  public isVideoEnabled = true;
  public isMicrophoneEnabled = true;

  public leaveRoom(): void {
    this._chatService.stopConnection();
    this._router.navigate(['/']);
  }

  public toggleAudio(): void {
    this.isMicrophoneEnabled = !this.isMicrophoneEnabled;
    this._mediaService.toggleAudio(this.isMicrophoneEnabled);
  }

  public toggleVideo(): void {
    this.isVideoEnabled = !this.isVideoEnabled;
    this._mediaService.toggleVideo(this.isVideoEnabled);
  }
}
