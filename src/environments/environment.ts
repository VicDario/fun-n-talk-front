export const environment = {
  production: true,
  apiUrl: 'https://funntalk-1058570323303.us-central1.run.app',
  // Fallback only. TURN credentials are never bundled into the client; the
  // backend issues short-lived ones through /api/communication/ice-servers.
  // Without TURN, peers behind symmetric NAT cannot connect.
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] as RTCIceServer[],
};
