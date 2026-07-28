import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';
import { MediaService } from '../media/media.service';
import type {
  WebRtcSignal,
  WebRtcCandidate,
  WebRtcIncomingSignal,
} from '@interfaces/web-rtc.interface';
import { ChatMediatorService } from '@services/chat-mediator/chat-mediator.service';
import { StoreService } from '@services/store/store.service';

@Injectable({
  providedIn: 'root',
})
export class WebRtcService {
  // Promises, so a peer is claimed synchronously before setup awaits.
  private readonly _peerConnections = new Map<
    string,
    Promise<RTCPeerConnection>
  >();
  private readonly _pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private readonly _makingOffer = new Set<string>();
  private readonly _chatMediator = inject(ChatMediatorService);
  private readonly _mediaService = inject(MediaService);
  private readonly _store = inject(StoreService);
  private readonly _http = inject(HttpClient);
  private _iceServers?: Promise<RTCIceServer[]>;

  constructor() {
    this._chatMediator.onJoinRoom$.subscribe(() => this.start());
    this._chatMediator.onOffer$.subscribe((signal) => this.handleOffer(signal));
    this._chatMediator.onAnswer$.subscribe((signal) =>
      this.handleAnswer(signal)
    );
    this._chatMediator.onReceiveIceCandidate$.subscribe((signal) =>
      this.handleIceCandidate(signal)
    );
    this._chatMediator.onUserLeft$.subscribe((user) =>
      this.closePeerConnection(user.connectionId)
    );
    this._chatMediator.onLeaveRoom$.subscribe(() => this.stopAllConnections());
  }

  // TURN credentials are readable in any browser bundle, so the backend issues
  // short-lived ones per session. STUN-only is the fallback.
  private getIceServers(): Promise<RTCIceServer[]> {
    this._iceServers ??= firstValueFrom(
      this._http.get<RTCIceServer[]>(
        `${environment.apiUrl}/api/communication/ice-servers`
      )
    ).catch(() => {
      console.warn('Could not fetch ICE servers, falling back to STUN only.');
      return environment.iceServers;
    });
    return this._iceServers;
  }

  private async start() {
    const connections = this._store
      .participants()
      .filter((user) => user.connectionId !== this._store.connectionId);
    await Promise.all(
      connections.map((user) =>
        this.createPeerConnection(user.connectionId, true)
      )
    );
  }

  public createPeerConnection(
    connectionId: string,
    isInitiator = false
  ): Promise<RTCPeerConnection> {
    const existing = this._peerConnections.get(connectionId);
    if (existing) return existing;

    const created = this.setupPeerConnection(connectionId, isInitiator).catch(
      (err) => {
        // Never cache a failed setup, the peer may be reachable later.
        this._peerConnections.delete(connectionId);
        throw err;
      }
    );
    this._peerConnections.set(connectionId, created);
    return created;
  }

  private async setupPeerConnection(
    connectionId: string,
    isInitiator: boolean
  ): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection({
      iceServers: await this.getIceServers(),
    });

    const localStream = await this._mediaService.getLocalStream();
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate)
        this._chatMediator.onIceCandidate(event.candidate, connectionId);
    };

    peerConnection.addEventListener('connectionstatechange', () => {
      const state = peerConnection.connectionState;
      if (state === 'closed') this.closePeerConnection(connectionId);
      // Only the impolite peer restarts, otherwise both would offer at once.
      if (state === 'failed' && !this.isPolite(connectionId))
        this.restartIce(connectionId, peerConnection);
    });

    peerConnection.addEventListener('track', (event) => {
      const [stream] = event.streams;
      this._store.addOrReplaceRemoteStream({ connectionId, stream });
    });

    if (isInitiator) await this.createOffer(connectionId, peerConnection);

    return peerConnection;
  }

  // Both peers can offer at once. The one with the lower connection id is
  // polite and yields; the other ignores the colliding offer. Comparing ids
  // needs no extra signalling and both sides always agree on the answer.
  private isPolite(connectionId: string): boolean {
    return this._store.connectionId < connectionId;
  }

  private async createOffer(
    connectionId: string,
    peerConnection: RTCPeerConnection
  ): Promise<void> {
    this._makingOffer.add(connectionId);
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      const offerData: WebRtcSignal = {
        connectionId,
        data: offer,
      };
      this._chatMediator.sendOffer(offerData);
    } catch (err) {
      console.error('Error creating offer:', err);
    } finally {
      this._makingOffer.delete(connectionId);
    }
  }

  // A failed connection is recoverable: the peers are still signalling, only
  // the media path died. Gathering fresh candidates is far cheaper than
  // tearing the connection down and rebuilding it.
  private async restartIce(
    connectionId: string,
    peerConnection: RTCPeerConnection
  ): Promise<void> {
    peerConnection.restartIce();
    await this.createOffer(connectionId, peerConnection);
  }

  private async sendAnswerToOffer(
    peerConnection: RTCPeerConnection,
    connectionId: string
  ) {
    try {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      const signal: WebRtcSignal = { connectionId, data: answer };
      this._chatMediator.sendAnswer(signal);
    } catch (err) {
      console.error('Error creating answer:', err);
    }
  }

  private async handleOffer({ user, data: offer }: WebRtcIncomingSignal) {
    try {
      const connection = await this.createPeerConnection(
        user.connectionId,
        false
      );

      const collision =
        this._makingOffer.has(user.connectionId) ||
        connection.signalingState !== 'stable';
      if (collision && !this.isPolite(user.connectionId)) return;

      // setRemoteDescription rolls our own pending offer back implicitly.
      await connection.setRemoteDescription(new RTCSessionDescription(offer));
      await this.flushPendingCandidates(user.connectionId, connection);
      await this.sendAnswerToOffer(connection, user.connectionId);
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  }

  private async handleAnswer({ user, data }: WebRtcIncomingSignal) {
    try {
      const connection = await this._peerConnections.get(user.connectionId);
      if (!connection) return;

      const answer = new RTCSessionDescription(data);
      await connection.setRemoteDescription(answer);
      await this.flushPendingCandidates(user.connectionId, connection);
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }

  private async handleIceCandidate({
    user,
    candidate: candidateData,
  }: WebRtcCandidate) {
    try {
      const candidate: RTCIceCandidateInit = JSON.parse(candidateData);
      const connection = await this._peerConnections.get(user.connectionId);

      // Peers trickle before their offer or answer lands, and addIceCandidate
      // rejects until the remote description exists.
      if (!connection?.remoteDescription) {
        const pending = this._pendingCandidates.get(user.connectionId) ?? [];
        pending.push(candidate);
        this._pendingCandidates.set(user.connectionId, pending);
        return;
      }

      await connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  }

  private async flushPendingCandidates(
    connectionId: string,
    connection: RTCPeerConnection
  ) {
    const pending = this._pendingCandidates.get(connectionId);
    if (!pending) return;

    this._pendingCandidates.delete(connectionId);
    for (const candidate of pending) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding buffered ICE candidate:', err);
      }
    }
  }

  private async closePeerConnection(connectionId: string) {
    const connection = this._peerConnections.get(connectionId);
    if (!connection) return;

    // Delete before awaiting, so the signalingstatechange that close() fires
    // finds nothing and the recursion stops.
    this._peerConnections.delete(connectionId);
    this._pendingCandidates.delete(connectionId);
    this._store.removeRemoteStream(connectionId);
    (await connection.catch(() => null))?.close();
  }

  private stopAllConnections() {
    for (const connectionId of [...this._peerConnections.keys()]) {
      this.closePeerConnection(connectionId);
    }
  }
}
