import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { User } from '@interfaces/user.interface';
import { MediaService } from '@services/media/media.service';
import { WebRtcService } from '@services/web-rtc/web-rtc.service';
import { throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

// Keeps the one browser rule under test: addIceCandidate fails until a remote
// description exists. The rest are no-ops on purpose.
/* eslint-disable @typescript-eslint/no-empty-function */
class FakePeerConnection {
  public static instances = 0;
  public remoteDescription: unknown = null;
  public readonly addedCandidates: unknown[] = [];
  public readonly signalingState = 'stable';
  public onicecandidate: unknown = null;

  constructor() {
    FakePeerConnection.instances++;
  }

  addTrack() {}
  addEventListener() {}
  close() {}
  async createOffer() {
    return { type: 'offer', sdp: '' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: '' };
  }
  async setLocalDescription() {}
  async setRemoteDescription(description: unknown) {
    this.remoteDescription = description;
  }
  async addIceCandidate(candidate: unknown) {
    if (!this.remoteDescription) throw new Error('no remote description');
    this.addedCandidates.push(candidate);
  }
}

const peer: User = { username: 'ana', connectionId: 'peer-1' };

describe('WebRtcService', () => {
  let service: WebRtcService;

  beforeEach(() => {
    FakePeerConnection.instances = 0;
    Object.assign(globalThis, {
      RTCPeerConnection: FakePeerConnection,
      RTCSessionDescription: class {
        constructor(init: unknown) {
          Object.assign(this, init);
        }
      },
      RTCIceCandidate: class {
        constructor(init: unknown) {
          Object.assign(this, init);
        }
      },
    });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: MediaService,
          useValue: { getLocalStream: async () => ({ getTracks: () => [] }) },
        },
        {
          // Forces the STUN-only fallback instead of a real request.
          provide: HttpClient,
          useValue: { get: () => throwError(() => new Error('offline')) },
        },
      ],
    });
    service = TestBed.inject(WebRtcService);
  });

  it('gives concurrent callers the same peer connection', async () => {
    const [first, second] = await Promise.all([
      service.createPeerConnection(peer.connectionId),
      service.createPeerConnection(peer.connectionId),
    ]);

    expect(first).toBe(second);
    expect(FakePeerConnection.instances).toBe(1);
  });

  it('buffers ICE candidates until the remote description is set', async () => {
    await service['handleIceCandidate']({
      user: peer,
      candidate: JSON.stringify({ candidate: 'early' }),
    });

    const connection = (await service.createPeerConnection(
      peer.connectionId
    )) as unknown as FakePeerConnection;
    expect(connection.addedCandidates).toEqual([]);

    await service['handleOffer']({
      user: peer,
      data: { type: 'offer', sdp: '' },
    });

    expect(connection.addedCandidates).toHaveLength(1);
  });
});
