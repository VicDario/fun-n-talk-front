import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import {
  getStoredRoomCode,
  writeStoredRoomCode,
} from '@services/room-code/room-code-storage';
import { RoomJoinError } from '@services/room/room-failures';
import { RoomService } from '@services/room/room.service';
import { SignalRService } from '@services/signal-r/signal-r.service';
import { StoreService } from '@services/store/store.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinScreenComponent } from './join-screen.component';
import {
  CREATE_FAILURE_COPY,
  ROOM_CODE_SHAPE_MESSAGE,
} from './join-screen.messages';

describe('JoinScreenComponent', () => {
  let fixture: ComponentFixture<JoinScreenComponent>;
  let component: JoinScreenComponent;
  let signalRService: { startConnection: ReturnType<typeof vi.fn> };
  let roomService: { createRoom: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;
  let store: StoreService;

  beforeEach(() => {
    globalThis.sessionStorage.clear();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });

    signalRService = { startConnection: vi.fn() };
    roomService = { createRoom: vi.fn() };
    navigate = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SignalRService, useValue: signalRService },
        { provide: RoomService, useValue: roomService },
        { provide: Router, useValue: { navigate } },
        // StoreService stays real — a plain field and a signal, no I/O.
      ],
    });

    store = TestBed.inject(StoreService);
  });

  const createComponent = () => {
    fixture = TestBed.createComponent(JoinScreenComponent);
    component = fixture.componentInstance;
  };

  it('issues exactly one create POST on double-activation (S17)', () => {
    createComponent();
    roomService.createRoom.mockReturnValue(new Promise(() => undefined));

    component.onCreateSubmit();
    component.onCreateSubmit();

    expect(roomService.createRoom).toHaveBeenCalledTimes(1);
  });

  it('reveals the code with no navigation on a successful create (S12)', async () => {
    createComponent();
    roomService.createRoom.mockResolvedValue('A4K9X2');

    component.onCreateSubmit();
    await Promise.resolve();
    await Promise.resolve();

    expect(component.mintedCode()).toBe('A4K9X2');
    expect(navigate).not.toHaveBeenCalled();

    // Zoneless: the signal write above does not reach the DOM until an
    // explicit detectChanges() runs — that is the point of this assertion.
    fixture.detectChanges();
    const codeInput = fixture.nativeElement.querySelector('input[readonly]');
    expect(codeInput).not.toBeNull();
    expect(codeInput.value).toBe('A4K9X2');
  });

  it('writes the minted code to storage at mint time (S23b)', async () => {
    createComponent();
    roomService.createRoom.mockResolvedValue('A4K9X2');

    component.onCreateSubmit();
    await Promise.resolve();
    await Promise.resolve();

    expect(getStoredRoomCode()).toBe('A4K9X2');
  });

  it('invokes copy with the exact minted string (S13)', async () => {
    createComponent();
    roomService.createRoom.mockResolvedValue('A4K9X2');
    component.onCreateSubmit();
    await Promise.resolve();
    await Promise.resolve();

    component.onCopy();

    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith(
      'A4K9X2'
    );
  });

  it('renders a copy affordance on the minted-code screen (S13)', async () => {
    createComponent();
    roomService.createRoom.mockResolvedValue('A4K9X2');

    component.onCreateSubmit();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = fixture.debugElement
      .queryAll(By.css('button'))
      .map((debugEl) => debugEl.nativeElement);
    const copyButton = buttons.find((button) =>
      button.textContent?.trim().includes('Copy')
    );
    expect(copyButton).not.toBeUndefined();

    copyButton!.click();
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith(
      'A4K9X2'
    );
  });

  it('continues into the room using the minted code (S14)', async () => {
    createComponent();
    component.joinForm.patchValue({ username: 'ana' });
    roomService.createRoom.mockResolvedValue('A4K9X2');
    signalRService.startConnection.mockResolvedValue(undefined);

    component.onCreateSubmit();
    await Promise.resolve();
    await Promise.resolve();

    component.onContinue();
    await Promise.resolve();
    await Promise.resolve();

    expect(signalRService.startConnection).toHaveBeenCalledWith({
      username: 'ana',
      roomCode: 'A4K9X2',
    });
    expect(navigate).toHaveBeenCalledWith(['/chat-room']);
  });

  it('never calls the service for malformed join input (S3)', () => {
    createComponent();
    component.joinForm.patchValue({ username: 'ana', roomCode: 'TOO-LONG' });

    component.onJoinSubmit();

    expect(signalRService.startConnection).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe(ROOM_CODE_SHAPE_MESSAGE);
  });

  it('does not navigate on a failing join (restates S6 at the component level)', async () => {
    createComponent();
    component.joinForm.patchValue({ username: 'ana', roomCode: 'A4K9X2' });
    signalRService.startConnection.mockRejectedValue(
      new RoomJoinError('room-not-found')
    );

    component.onJoinSubmit();
    await Promise.resolve();
    await Promise.resolve();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders the rate-limit message and no code on a 429 create failure (S15b)', async () => {
    createComponent();
    roomService.createRoom.mockRejectedValue(
      new HttpErrorResponse({ status: 429 })
    );

    // Pins the selector against a sibling element carrying the same
    // `.text-red-600` utility class (the username validation span,
    // join-screen.component.html:59): forcing it to also render must not
    // retarget the create-error assertion below (N1).
    component.joinForm.controls['username'].markAsTouched();

    component.onCreateSubmit();
    await Promise.resolve();
    await Promise.resolve();

    expect(component.errorMessage()).toBe(CREATE_FAILURE_COPY['rate-limited']);
    expect(component.mintedCode()).toBeNull();

    // Zoneless: the signal writes above do not reach the DOM until an
    // explicit detectChanges() runs.
    fixture.detectChanges();
    // The untouched-username precondition no longer holds here — assert the
    // validation span really is rendered, so the assertion below is proven
    // to bind to the create-error hook rather than passing by accident.
    expect(
      fixture.nativeElement.querySelector('span.text-red-600')
    ).not.toBeNull();
    const errorEl: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="create-error"]'
    );
    expect(errorEl?.textContent?.trim()).toBe(
      CREATE_FAILURE_COPY['rate-limited']
    );
    expect(
      fixture.nativeElement.querySelector('input[readonly]')
    ).toBeNull();
  });

  it('renders the allocation-failure message with retry available on a 503 create failure (S16b)', async () => {
    createComponent();
    roomService.createRoom.mockRejectedValue(
      new HttpErrorResponse({ status: 503 })
    );

    // Same precondition-pinning as S15b above (N1): the username span must
    // be rendered too, and the create-error hook must still be the one
    // asserted against.
    component.joinForm.controls['username'].markAsTouched();

    component.onCreateSubmit();
    await Promise.resolve();
    await Promise.resolve();

    expect(component.errorMessage()).toBe(
      CREATE_FAILURE_COPY['allocation-failed']
    );
    // Retry available: the control is re-enabled after the failure settles.
    expect(component.isCreating()).toBe(false);

    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('span.text-red-600')
    ).not.toBeNull();
    const errorEl: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="create-error"]'
    );
    expect(errorEl?.textContent?.trim()).toBe(
      CREATE_FAILURE_COPY['allocation-failed']
    );
    const createButton: HTMLButtonElement | null = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button')
    ).find((button) => button.textContent?.trim() === 'Create a room') ?? null;
    expect(createButton).not.toBeNull();
    expect(createButton!.disabled).toBe(false);
  });

  it('prefills the room-code field from a stored code on construction (S24)', () => {
    writeStoredRoomCode('A4K9X2');

    createComponent();

    expect(component.joinForm.value.roomCode).toBe('A4K9X2');
  });

  it('renders an ejection notice once from sessionNotice', () => {
    store.sessionNotice = 'reconnect-room-lost';

    createComponent();

    expect(component.notice).toBe('reconnect-room-lost');
    expect(store.sessionNotice).toBeNull();
  });
});
