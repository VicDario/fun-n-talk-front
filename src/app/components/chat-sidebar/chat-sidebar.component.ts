import { DatePipe, NgClass } from '@angular/common';
import { Component, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatMediatorService } from '@services/chat-mediator/chat-mediator.service';
import { StoreService } from '@services/store/store.service';

@Component({
  selector: 'app-chat-sidebar',
  imports: [NgClass, DatePipe, FormsModule],
  templateUrl: './chat-sidebar.component.html',
  styleUrl: './chat-sidebar.component.css',
})
export class ChatSidebarComponent {
  private readonly _chatMediator = inject(ChatMediatorService);
  private readonly _store = inject(StoreService);
  public isChatOpen: WritableSignal<boolean> = signal(false);

  public sendMessage(event: SubmitEvent): void {
    const target = event.target as HTMLFormElement;
    const messageInput = target.elements.namedItem(
      'message'
    ) as HTMLInputElement;
    const message = messageInput.value.trim();
    if (!message.length) return;
    this._chatMediator.sendMessage(message);
    target.reset();
  }

  public get connectionId(): string {
    return this._store.connectionId!;
  }
  public toggleChat(): void {
    this.isChatOpen.update((state) => !state);
  }

  public get conversation() {
    return this._store.messages;
  }
}
