import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../services/chat/chat.service';

@Component({
  selector: 'app-join-screen',
  imports: [FormsModule],
  templateUrl: './join-screen.component.html',
  styleUrl: './join-screen.component.css',
})
export class JoinScreenComponent {
  private readonly _router = inject(Router);
  private readonly _chatService = inject(ChatService);

  public joinRoom(event: SubmitEvent): void {
    const target = event.target as HTMLFormElement;
    this._chatService.userName = target['userName'].value;
    this._chatService.roomName = target['roomName'].value;
    this._chatService
      .initConnection()
      .then(() => this._router.navigate(['/chat-room']));
  }
}
