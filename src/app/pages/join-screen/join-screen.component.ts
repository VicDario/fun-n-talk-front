import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { isWellFormedRoomCode, normalizeRoomCode } from '@services/room-code/room-code';
import {
  getStoredRoomCode,
  writeStoredRoomCode,
} from '@services/room-code/room-code-storage';
import {
  classifyCreateFailure,
  RoomJoinError,
} from '@services/room/room-failures';
import { RoomService } from '@services/room/room.service';
import { SignalRService } from '@services/signal-r/signal-r.service';
import { StoreService } from '@services/store/store.service';
import {
  CREATE_FAILURE_COPY,
  JOIN_FAILURE_COPY,
  ROOM_CODE_SHAPE_MESSAGE,
} from './join-screen.messages';

@Component({
  selector: 'app-join-screen',
  imports: [NgClass, ReactiveFormsModule],
  templateUrl: './join-screen.component.html',
  styleUrl: './join-screen.component.css',
})
export class JoinScreenComponent {
  private readonly _router = inject(Router);
  private readonly _signalRService = inject(SignalRService);
  private readonly _roomService = inject(RoomService);
  private readonly _store = inject(StoreService);

  public joinForm: FormGroup;

  public readonly mintedCode = signal<string | null>(null);
  public readonly isCreating = signal(false);
  public readonly isJoining = signal(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly copyState = signal<'idle' | 'copied'>('idle');

  // Written once before navigation elsewhere and read once here — never
  // rendered reactively.
  public readonly notice = this._store.sessionNotice;

  constructor() {
    this._store.sessionNotice = null;

    this.joinForm = new FormGroup({
      username: new FormControl('', [
        Validators.required,
        Validators.minLength(3),
      ]),
      // No shape validator on the control itself: Create ignores this
      // field entirely, so gating form validity on it would also block
      // Create. The join handler validates the shape explicitly instead.
      roomCode: new FormControl(getStoredRoomCode() ?? ''),
    });
  }

  public onJoinSubmit(): void {
    if (this.isJoining()) return;

    const username = (this.joinForm.value.username as string) ?? '';
    const rawCode = (this.joinForm.value.roomCode as string) ?? '';
    const roomCode = normalizeRoomCode(rawCode);

    if (!isWellFormedRoomCode(roomCode)) {
      this.errorMessage.set(ROOM_CODE_SHAPE_MESSAGE);
      return;
    }

    void this.joinWithCode(username, roomCode);
  }

  public onCreateSubmit(): void {
    if (this.isCreating()) return;
    void this.createRoom();
  }

  public onCopy(): void {
    const code = this.mintedCode();
    if (!code) return;
    navigator.clipboard
      .writeText(code)
      .then(() => this.copyState.set('copied'));
  }

  public onContinue(): void {
    const roomCode = this.mintedCode();
    if (!roomCode || this.isJoining()) return;
    const username = (this.joinForm.value.username as string) ?? '';
    void this.joinWithCode(username, roomCode);
  }

  private async joinWithCode(username: string, roomCode: string): Promise<void> {
    this.isJoining.set(true);
    this.errorMessage.set(null);
    try {
      await this._signalRService.startConnection({ username, roomCode });
      this._router.navigate(['/chat-room']);
    } catch (error) {
      const reason =
        error instanceof RoomJoinError ? error.reason : 'unknown';
      this.errorMessage.set(JOIN_FAILURE_COPY[reason]);
    } finally {
      this.isJoining.set(false);
    }
  }

  private async createRoom(): Promise<void> {
    this.isCreating.set(true);
    this.errorMessage.set(null);
    try {
      const code = await this._roomService.createRoom();
      this.mintedCode.set(code);
      writeStoredRoomCode(code);
    } catch (error) {
      this.errorMessage.set(CREATE_FAILURE_COPY[classifyCreateFailure(error)]);
    } finally {
      this.isCreating.set(false);
    }
  }

  public isValidField(field: string): boolean | null {
    return (
      this.joinForm.controls[field].errors &&
      this.joinForm.controls[field].touched
    );
  }

  public getFieldError(field: string): string | null {
    if (!this.joinForm.controls[field]) return null;

    const errors = this.joinForm.controls[field].errors || {};

    for (const key of Object.keys(errors)) {
      switch (key) {
        case 'required':
          return 'This field is required!';

        case 'minlength':
          return `Needs at least ${errors['minlength'].requiredLength} characters.`;
      }
    }
    return null;
  }
}
