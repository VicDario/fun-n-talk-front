import { DatePipe, NgClass } from '@angular/common';
import { Component, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Message } from '@interfaces/message.interface';
import { ChatService } from '@services/chat/chat.service';

@Component({
  selector: 'app-chat-sidebar',
  imports: [NgClass, DatePipe, FormsModule],
  templateUrl: './chat-sidebar.component.html',
  styleUrl: './chat-sidebar.component.css',
})
export class ChatSidebarComponent {
  private readonly _chatService = inject(ChatService);
  public conversation: WritableSignal<Message[]>;
  public isChatOpen: WritableSignal<boolean> = signal(false);

  constructor() {
    this.conversation = this._chatService.messages;
  }

  public sendMessage(event: SubmitEvent): void {
    const target = event.target as HTMLFormElement;
    const messageInput = target.elements.namedItem(
      'message'
    ) as HTMLInputElement;
    this._chatService.sendMessage(messageInput.value);
    target.reset();
  }

  public get connectionId(): string {
    return this._chatService.connectionId;
  }
  public toggleChat(): void {
    this.isChatOpen.update((state) => !state);
  }
}
