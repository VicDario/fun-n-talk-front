import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MediaService } from '@services/media/media.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// jsdom ships no media stack, so the tests own the smallest doubles that still
// honour the browser rules under test: tracks are stoppable and toggleable,
// and a stream only exposes the kinds it was built with.
class FakeTrack {
  public enabled = true;
  public stopped = false;

  constructor(public readonly kind: 'audio' | 'video') {}

  stop(): void {
    this.stopped = true;
  }
}

class FakeMediaStream {
  constructor(private readonly tracks: FakeTrack[] = []) {}

  getTracks(): FakeTrack[] {
    return this.tracks;
  }

  getAudioTracks(): FakeTrack[] {
    return this.tracks.filter((track) => track.kind === 'audio');
  }

  getVideoTracks(): FakeTrack[] {
    return this.tracks.filter((track) => track.kind === 'video');
  }
}

const audioAndVideoStream = () =>
  new FakeMediaStream([new FakeTrack('audio'), new FakeTrack('video')]);
const audioOnlyStream = () => new FakeMediaStream([new FakeTrack('audio')]);

const deviceError = (name: string) => new DOMException(name, name);

describe('MediaService', () => {
  let service: MediaService;
  let getUserMedia: Mock;

  beforeEach(() => {
    vi.stubGlobal('MediaStream', FakeMediaStream);
    getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(MediaService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for camera and microphone together and reports no error', async () => {
    getUserMedia.mockResolvedValue(audioAndVideoStream());

    const stream = await service.getLocalStream();

    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({
      video: true,
      audio: true,
    });
    expect(stream.getVideoTracks()).toHaveLength(1);
    expect(stream.getAudioTracks()).toHaveLength(1);
    expect(service.error()).toBeNull();
  });

  it('keeps the microphone by retrying audio-only when no camera exists', async () => {
    getUserMedia
      .mockRejectedValueOnce(deviceError('NotFoundError'))
      .mockResolvedValueOnce(audioOnlyStream());

    const stream = await service.getLocalStream();

    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true });
    expect(stream.getAudioTracks()).toHaveLength(1);
    expect(stream.getVideoTracks()).toHaveLength(0);
  });

  it('blames only the camera when the microphone survived the fallback', async () => {
    getUserMedia
      .mockRejectedValueOnce(deviceError('NotFoundError'))
      .mockResolvedValueOnce(audioOnlyStream());

    await service.getLocalStream();

    expect(service.error()).toMatch(/camera/i);
    expect(service.error()).not.toMatch(/microphone/i);
  });

  it('retries audio-only when the camera alone was blocked', async () => {
    getUserMedia
      .mockRejectedValueOnce(deviceError('NotAllowedError'))
      .mockResolvedValueOnce(audioOnlyStream());

    const stream = await service.getLocalStream();

    expect(stream.getAudioTracks()).toHaveLength(1);
    expect(service.error()).toMatch(/camera/i);
  });

  it('caches the audio-only stream instead of prompting again', async () => {
    getUserMedia
      .mockRejectedValueOnce(deviceError('NotFoundError'))
      .mockResolvedValueOnce(audioOnlyStream());

    const first = await service.getLocalStream();
    const second = await service.getLocalStream();

    expect(second).toBe(first);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('still mutes the microphone of an audio-only stream', async () => {
    const fallback = audioOnlyStream();
    getUserMedia
      .mockRejectedValueOnce(deviceError('NotFoundError'))
      .mockResolvedValueOnce(fallback);

    await service.getLocalStream();
    service.toggleAudio(false);

    expect(fallback.getAudioTracks()[0].enabled).toBe(false);
  });

  it('reports both devices and returns an empty stream when audio also fails', async () => {
    getUserMedia.mockRejectedValue(deviceError('NotFoundError'));

    const stream = await service.getLocalStream();

    expect(stream.getTracks()).toHaveLength(0);
    expect(service.error()).toMatch(/camera/i);
    expect(service.error()).toMatch(/microphone/i);
  });

  it('does not cache the empty stream, so the next join retries', async () => {
    getUserMedia.mockRejectedValue(deviceError('NotFoundError'));

    await service.getLocalStream();
    getUserMedia.mockResolvedValue(audioAndVideoStream());
    const stream = await service.getLocalStream();

    expect(stream.getVideoTracks()).toHaveLength(1);
    expect(service.error()).toBeNull();
  });

  it('stops every track and re-acquires on the next join', async () => {
    const granted = audioAndVideoStream();
    getUserMedia.mockResolvedValue(granted);

    await service.getLocalStream();
    service.stopLocalStream();

    expect(granted.getTracks().every((track) => track.stopped)).toBe(true);

    await service.getLocalStream();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });
});
