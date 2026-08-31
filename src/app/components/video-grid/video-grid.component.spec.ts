import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MediaService } from '@services/media/media.service';
import { StoreService } from '@services/store/store.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoGridComponent } from './video-grid.component';

// jsdom implements no media stack: an <video srcObject> assignment needs a
// property to land on, and MediaStream does not exist at all.
class FakeMediaStream {}

const stubMediaElements = () => {
  Object.defineProperty(globalThis.HTMLMediaElement.prototype, 'srcObject', {
    value: null,
    writable: true,
    configurable: true,
  });
};

describe('VideoGridComponent', () => {
  let fixture: ComponentFixture<VideoGridComponent>;
  let mediaService: {
    getLocalStream: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof signal<string | null>>;
  };
  let store: StoreService;

  beforeEach(() => {
    stubMediaElements();
    vi.stubGlobal('MediaStream', FakeMediaStream);

    mediaService = {
      getLocalStream: vi.fn().mockResolvedValue(new FakeMediaStream()),
      error: signal<string | null>(null),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: MediaService, useValue: mediaService },
        // StoreService stays real — signals and plain fields, no I/O.
      ],
    });

    store = TestBed.inject(StoreService);
  });

  const render = async () => {
    fixture = TestBed.createComponent(VideoGridComponent);
    fixture.detectChanges();
    // ngOnInit awaits the stream; let that microtask settle before painting.
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  const videos = () => fixture.debugElement.queryAll(By.css('video'));
  const alert = () => fixture.debugElement.query(By.css('[role="alert"]'));

  it('requests the local stream once on init and exposes it', async () => {
    const component = await render();

    expect(mediaService.getLocalStream).toHaveBeenCalledTimes(1);
    expect(component.localStream()).toBeInstanceOf(FakeMediaStream);
  });

  it('mutes the local preview so the room does not echo', async () => {
    await render();

    const local = videos()[0];
    expect(local.nativeElement.muted).toBe(true);
  });

  it('renders no alert while the media service reports no error', async () => {
    await render();

    expect(alert()).toBeNull();
  });

  it('announces a media failure through a live region', async () => {
    mediaService.error.set('No camera was found on this device.');

    await render();

    expect(alert().nativeElement.textContent.trim()).toBe(
      'No camera was found on this device.'
    );
  });

  // The audio-only fallback: the user IS in the call and the camera warning
  // shows at the same time. A banner that replaced the grid would hide the room.
  it('shows the camera warning without dropping the stream it degraded to', async () => {
    mediaService.error.set('No camera was found, so you joined with audio only.');

    await render();

    expect(alert()).not.toBeNull();
    expect(videos()).toHaveLength(1);
  });

  it('renders one video per remote participant plus the local preview', async () => {
    await render();

    store.addOrReplaceRemoteStream({
      connectionId: 'peer-1',
      stream: new FakeMediaStream() as MediaStream,
    });
    store.addOrReplaceRemoteStream({
      connectionId: 'peer-2',
      stream: new FakeMediaStream() as MediaStream,
    });
    fixture.detectChanges();

    expect(videos()).toHaveLength(3);
  });

  it('leaves remote participants audible', async () => {
    await render();

    store.addOrReplaceRemoteStream({
      connectionId: 'peer-1',
      stream: new FakeMediaStream() as MediaStream,
    });
    fixture.detectChanges();

    const remote = videos()[1];
    expect(remote.nativeElement.muted).toBe(false);
  });

  it('drops the video of a participant who left', async () => {
    await render();

    store.addOrReplaceRemoteStream({
      connectionId: 'peer-1',
      stream: new FakeMediaStream() as MediaStream,
    });
    fixture.detectChanges();
    expect(videos()).toHaveLength(2);

    store.removeRemoteStream('peer-1');
    fixture.detectChanges();

    expect(videos()).toHaveLength(1);
  });
});
