export const environment = {
  production: false,
  apiUrl: 'https://localhost:7055',
  // See environment.ts — fallback used when the backend cannot issue TURN credentials.
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] as RTCIceServer[],
};
