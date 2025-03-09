import { DatePipe, NgClass } from '@angular/common';
import { Component, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SignalRService } from '@services/signal-r/signal-r.service';
import { StoreService } from '@services/store/store.service';

@Component({
  selector: 'app-chat-sidebar',
  imports: [NgClass, DatePipe, FormsModule],
  templateUrl: './chat-sidebar.component.html',
  styleUrl: './chat-sidebar.component.css',
})
export class ChatSidebarComponent {
  private readonly _signalRService = inject(SignalRService);
  private readonly _store = inject(StoreService);
  public isChatOpen: WritableSignal<boolean> = signal(false);

  public sendMessage(event: SubmitEvent): void {
    const target = event.target as HTMLFormElement;
    const messageInput = target.elements.namedItem(
      'message'
    ) as HTMLInputElement;
    const message = messageInput.value.trim();
    if (!message.length) return;
    this._signalRService.sendMessage(message);
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
