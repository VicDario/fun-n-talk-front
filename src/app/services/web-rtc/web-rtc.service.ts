import { inject, Injectable, signal } from '@angular/core';
import { environment } from '@env/environment';
import { SignalRService } from '../signal-r/signal-r.service';
import { MediaService } from '../media/media.service';
import type { WebRtcStreamConnection } from '@interfaces/web-rtc-stream.interface';
import { WebRtcSignal } from '@interfaces/web-rtc-signal.interface';
import { WebRtcCandidate } from '@interfaces/web-rtc-candidate.interface';

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
    this._signalRService.leaveRoomEventEmitter.subscribe(() =>
      this.stopAllConnections()
    );
    this._signalRService.userLeftEventEmitter.subscribe((user) =>
      this.closePeerConnection(user.connectionId)
    );
  }

  public addStreamToPeers(stream: MediaStream): void {
    for (const peerId of this._peerConnections.keys()) {
      stream.getTracks().forEach((track) => {
        this._peerConnections.get(peerId)!.addTrack(track, stream);
      });
    }
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
      if (event.candidate) {
        this._signalRService.onIceCandidate(event.candidate, connectionId);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      if (peerConnection.iceConnectionState === 'disconnected')
        this.closePeerConnection(connectionId);
    };

    peerConnection.addEventListener('track', async (event) => {
      const [stream] = event.streams;
      this._remoteStreams.update((remoteStreams) => {
        const streams = [...remoteStreams];

        const streamIndex = streams.findIndex(
          (stream) => stream.connectionId === connectionId
        );

        if (streamIndex >= 0) streams[streamIndex].stream = stream;
        else streams.push({ connectionId, stream, connection: peerConnection });

        return streams;
      });
    });

    if (isInitiator) await this.createOffer(peerConnection);

    this._peerConnections.set(connectionId, peerConnection);

    return peerConnection;
  }

  private async createOffer(connection: RTCPeerConnection): Promise<void> {
    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await this._signalRService.sendOffer(offer);
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  }

  private async sendAnswerToOffer(
    connection: RTCPeerConnection,
    connectionId: string
  ): Promise<void> {
    try {
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await this._signalRService.sendAnswer(answer, connectionId);
    } catch (err) {
      console.error('Error creating answer:', err);
    }
  }

  private async handleOffer({
    user,
    data: offer,
  }: WebRtcSignal): Promise<void> {
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

  private async handleAnswer({
    user,
    data: answer,
  }: WebRtcSignal): Promise<void> {
    try {
      const connection = this._peerConnections.get(user.connectionId);
      if (!connection) return;

      await connection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }

  private async handleIceCandidate({
    user,
    candidate: candidateData,
  }: WebRtcCandidate): Promise<void> {
    try {
      const connection = this._peerConnections.get(user.connectionId);
      if (!connection) return;
      const candidate: RTCIceCandidateInit = JSON.parse(candidateData);
      await connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  }

  private closePeerConnection(connectionId: string): void {
    const connection = this._peerConnections.get(connectionId);
    if (!connection) return;
    this.remoteStreams.update((remoteStreams) =>
      remoteStreams.filter((stream) => stream.connectionId !== connectionId)
    );
    connection.close();
    this._peerConnections.delete(connectionId);
  }

  private stopAllConnections() {
    for (const connection of this._peerConnections.keys())
      this.closePeerConnection(connection);
  }

  public get remoteStreams() {
    return this._remoteStreams;
  }
}
