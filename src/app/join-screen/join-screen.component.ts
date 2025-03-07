import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../services/chat/chat.service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-join-screen',
  imports: [NgClass, ReactiveFormsModule],
  templateUrl: './join-screen.component.html',
  styleUrl: './join-screen.component.css',
})
export class JoinScreenComponent {
  private readonly _router = inject(Router);
  private readonly _chatService = inject(ChatService);
  public joinForm: FormGroup;

  constructor() {
    this.joinForm = new FormGroup({
      userName: new FormControl('', [Validators.required, Validators.minLength(3)]),
      roomName: new FormControl('', [Validators.required, Validators.minLength(3)]),
    });
  }

  public onSubmit(): void {
    if (this.joinForm.invalid) {
      this.joinForm.markAllAsTouched();
      return;
    }
    this.joinRoom(this.joinForm.value);
    this.joinForm.reset();
  }

  public joinRoom({
    userName,
    roomName,
  }: {
    userName: string;
    roomName: string;
  }): void {
    this._chatService.userName = userName;
    this._chatService.roomName = roomName;
    this._chatService
      .initConnection()
      .then(() => this._router.navigate(['/chat-room']));
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
