export const environment = {
  production: true,
  apiUrl: 'https://funntalk-1058570323303.us-central1.run.app',
  // Fallback only. TURN comes from /api/communication/ice-servers; without it
  // peers behind symmetric NAT cannot connect.
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] as RTCIceServer[],
};
