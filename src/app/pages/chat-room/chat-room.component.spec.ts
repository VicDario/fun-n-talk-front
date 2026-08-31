import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MediaService } from '@services/media/media.service';
import { SignalRService } from '@services/signal-r/signal-r.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatRoomComponent } from './chat-room.component';

describe('ChatRoomComponent', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let mediaService: {
    getLocalStream: ReturnType<typeof vi.fn>;
    toggleAudio: ReturnType<typeof vi.fn>;
    toggleVideo: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof signal<string | null>>;
  };
  let stopConnection: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mediaService = {
      // Never settles: the nested video grid stays unpainted so these tests
      // exercise the room controls and nothing else.
      getLocalStream: vi.fn().mockReturnValue(new Promise(() => undefined)),
      toggleAudio: vi.fn(),
      toggleVideo: vi.fn(),
      error: signal<string | null>(null),
    };
    stopConnection = vi.fn().mockResolvedValue(undefined);
    navigate = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: MediaService, useValue: mediaService },
        { provide: SignalRService, useValue: { stopConnection } },
        { provide: Router, useValue: { navigate } },
      ],
    });

    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
  });

  const buttons = () => fixture.debugElement.queryAll(By.css('button'));
  const microphoneButton = () => buttons()[0];
  const videoButton = () => buttons()[1];

  it('starts with both devices live', () => {
    expect(component.isMicrophoneEnabled()).toBe(true);
    expect(component.isVideoEnabled()).toBe(true);
  });

  it('mutes and unmutes the microphone through the media service', () => {
    component.toggleMicrophone();
    expect(component.isMicrophoneEnabled()).toBe(false);
    expect(mediaService.toggleAudio).toHaveBeenLastCalledWith(false);

    component.toggleMicrophone();
    expect(component.isMicrophoneEnabled()).toBe(true);
    expect(mediaService.toggleAudio).toHaveBeenLastCalledWith(true);
  });

  it('stops and resumes the camera through the media service', () => {
    component.toggleVideo();
    expect(component.isVideoEnabled()).toBe(false);
    expect(mediaService.toggleVideo).toHaveBeenLastCalledWith(false);

    component.toggleVideo();
    expect(component.isVideoEnabled()).toBe(true);
    expect(mediaService.toggleVideo).toHaveBeenLastCalledWith(true);
  });

  it('keeps the two toggles independent', () => {
    component.toggleMicrophone();

    expect(component.isVideoEnabled()).toBe(true);
    expect(mediaService.toggleVideo).not.toHaveBeenCalled();
  });

  it('wires the control buttons to their toggles', () => {
    fixture.detectChanges();

    microphoneButton().nativeElement.click();
    expect(mediaService.toggleAudio).toHaveBeenCalledWith(false);

    videoButton().nativeElement.click();
    expect(mediaService.toggleVideo).toHaveBeenCalledWith(false);
  });

  it('marks a muted control red only after change detection runs', () => {
    fixture.detectChanges();
    expect(microphoneButton().nativeElement.classList).toContain('bg-gray-200');

    component.toggleMicrophone();
    // Zoneless: the signal write above does not reach the DOM on its own.
    expect(microphoneButton().nativeElement.classList).toContain('bg-gray-200');

    fixture.detectChanges();
    expect(microphoneButton().nativeElement.classList).toContain('bg-red-500');
  });

  // Navigating first would tear the component down mid-teardown and strand a
  // live hub connection behind the join screen.
  it('finishes SignalR teardown before navigating away', async () => {
    let releaseTeardown!: () => void;
    stopConnection.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseTeardown = resolve;
      })
    );

    const leaving = component.leaveRoom();
    await Promise.resolve();

    expect(stopConnection).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    releaseTeardown();
    await leaving;

    expect(navigate).toHaveBeenCalledWith(['/']);
  });
});
