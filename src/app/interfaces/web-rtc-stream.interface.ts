export interface WebRtcStreamConnection {
  connectionId: string;
  stream: MediaStream;
  connection: RTCPeerConnection
}
