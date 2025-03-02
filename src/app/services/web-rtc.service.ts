import { inject, Injectable, signal } from '@angular/core';
import { environment } from '@env/environment';
import { SignalRService } from './signal-r/signal-r.service';
import { MediaService } from './media/media.service';
import type { WebRtcStreamConnection } from '@interfaces/web-rtc-stream.interface';
import { WebRtcSignal } from '@interfaces/web-rtc-signal.interface';

@Injectable({
  providedIn: 'root',
})
export class WebRtcService {
  private readonly _peerConnections: Map<string, RTCPeerConnection> = new Map();
  private readonly _signalRService = inject(SignalRService);
  private readonly _mediaService = inject(MediaService);
  private readonly _remoteStreams = signal<WebRtcStreamConnection[]>([]);

  constructor() {
    this._signalRService.offerEventEmitter.subscribe((signal) =>
      this.handleOffer(signal)
    );
    this._signalRService.answerEventEmitter.subscribe((signal) =>
      this.handleAnswer(signal)
    );
    this._signalRService.iceCandidateEventEmitter.subscribe((signal) =>
      this.handleIceCandidate(signal)
    );
  }

  public addStreamToPeers(stream: MediaStream): void {
    for (const peerId in this._peerConnections.keys()) {
      stream.getTracks().forEach((track) => {
        this._peerConnections.get(peerId)!.addTrack(track, stream);
      });
    }
  }

  public async createPeerConnection(
    connectionId: string,
    isInitiator: boolean = false
  ): Promise<RTCPeerConnection | null> {
    console.log('Creating peer connection: ' + connectionId);
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
      if (event.candidate) {
        this._signalRService.onIceCandidate(event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      const stream = event.streams[0];

      this._remoteStreams.update((streams) => {
        const streamIndex = streams.findIndex(
          (s) => s.connectionId === connectionId
        );
        if (streamIndex >= 0) streams[streamIndex].stream = stream;
        else streams.push({ connectionId, stream, connection: peerConnection });

        return [...streams];
      });
    };

    if (isInitiator) this.createOffer(peerConnection);

    this._peerConnections.set(connectionId, peerConnection);

    return peerConnection;
  }

  private async createOffer(connection: RTCPeerConnection): Promise<void> {
    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      this._signalRService.sendOffer(offer);
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  }

  private async sendAnswerToOffer(
    connection: RTCPeerConnection
  ): Promise<void> {
    try {
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      this._signalRService.sendAnswer(answer);
    } catch (err) {
      console.error('Error creating answer:', err);
    }
  }

  private async handleOffer(signal: WebRtcSignal): Promise<void> {
    console.log('signal', signal);
    const { user, data } = signal;
    try {
      const connection =
        this._peerConnections.get(user.connectionId) ||
        (await this.createPeerConnection(user.connectionId));
      if (!connection) return;

      console.log('Handling offer', connection);
      // Only process if we don't already have a connection or if we need to renegotiate
      const currentDescription = connection.currentRemoteDescription;
      if (currentDescription) return;
      const offer = JSON.parse(data);
      await connection.setRemoteDescription(new RTCSessionDescription(offer));
      this.sendAnswerToOffer(connection);
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  }

  private async handleAnswer({ user, data }: WebRtcSignal): Promise<void> {
    try {
      const connection = this._peerConnections.get(user.connectionId);
      if (!connection?.currentRemoteDescription) return;

      const answer = JSON.parse(data);
      await connection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }

  private async handleIceCandidate({
    user,
    data,
  }: WebRtcSignal): Promise<void> {
    try {
      const connection = this._peerConnections.get(user.connectionId);
      if (!connection) return;
      const candidate: RTCIceCandidateInit = JSON.parse(data);
      await connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  }

  public closePeerConnection(connectionId: string): void {
    const connection = this._peerConnections.get(connectionId);
    if (!connection) return;
    connection.close();
    this._peerConnections.delete(connectionId);
  }

  public get remoteStreams() {
    return this._remoteStreams;
  }
}
