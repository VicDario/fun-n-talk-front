import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { SignalRService } from '@services/signal-r/signal-r.service';
import { WebRtcService } from '@services/web-rtc/web-rtc.service';

@Component({
  selector: 'app-join-screen',
  imports: [NgClass, ReactiveFormsModule],
  templateUrl: './join-screen.component.html',
  styleUrl: './join-screen.component.css',
})
export class JoinScreenComponent {
  private readonly _router = inject(Router);
  private readonly _signalRService = inject(SignalRService);
  private readonly _ = inject(WebRtcService);
  public joinForm: FormGroup;

  constructor() {
    this.joinForm = new FormGroup({
      username: new FormControl('', [Validators.required, Validators.minLength(3)]),
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
    username,
    roomName,
  }: {
    username: string;
    roomName: string;
  }): void {
    this._signalRService
      .startConnection({ username, roomName })
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
