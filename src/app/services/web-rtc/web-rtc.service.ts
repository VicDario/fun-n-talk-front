import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
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
  private readonly _peerConnections: Map<string, RTCPeerConnection> = new Map<
    string,
    RTCPeerConnection
  >();
  private readonly _chatMediator = inject(ChatMediatorService);
  private readonly _mediaService = inject(MediaService);
  private readonly _store = inject(StoreService);

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

  public async createPeerConnection(
    connectionId: string,
    isInitiator: boolean = false
  ): Promise<RTCPeerConnection | null> {
    if (this._peerConnections.has(connectionId))
      return this._peerConnections.get(connectionId)!;

    const peerConnection = new RTCPeerConnection({
      iceServers: environment.iceServers,
    });

    const localStream = await this._mediaService.getLocalStream();
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate)
        this._chatMediator.onIceCandidate(event.candidate, connectionId);
    };

    peerConnection.addEventListener('signalingstatechange', () => {
      if (peerConnection.signalingState === 'closed')
        this.closePeerConnection(connectionId);
    });

    peerConnection.addEventListener('track', (event) => {
      const [stream] = event.streams;
      this._store.addOrReplaceRemoteStream({ connectionId, stream });
    });

    if (isInitiator) await this.createOffer(connectionId, peerConnection);

    this._peerConnections.set(connectionId, peerConnection);
    return peerConnection;
  }

  private async createOffer(
    connectionId: string,
    peerConnection: RTCPeerConnection
  ): Promise<void> {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      const offerData: WebRtcSignal = {
        connectionId,
        data: offer,
      }
      this._chatMediator.sendOffer(offerData);
    } catch (err) {
      console.error('Error creating offer:', err);
    }
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
      const connection =
        this._peerConnections.get(user.connectionId) ??
        (await this.createPeerConnection(user.connectionId, false));
      if (!connection) return;

      await connection.setRemoteDescription(new RTCSessionDescription(offer));
      await this.sendAnswerToOffer(connection, user.connectionId);
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  }

  private async handleAnswer({ user, data }: WebRtcIncomingSignal) {
    try {
      const connection = this._peerConnections.get(user.connectionId);
      if (!connection) return;

      const answer = new RTCSessionDescription(data);
      await connection.setRemoteDescription(answer);
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }

  private async handleIceCandidate({
    user,
    candidate: candidateData,
  }: WebRtcCandidate) {
    try {
      const connection = this._peerConnections.get(user.connectionId);
      if (!connection) return;

      const candidate: RTCIceCandidateInit = JSON.parse(candidateData);
      await connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  }

  private closePeerConnection(connectionId: string) {
    const connection = this._peerConnections.get(connectionId);
    if (!connection) return;

    this._store.removeRemoteStream(connectionId);
    this._peerConnections.delete(connectionId);
    connection.close();
  }

  private stopAllConnections() {
    for (const connectionId of this._peerConnections.keys()) {
      this.closePeerConnection(connectionId);
    }
  }
}
