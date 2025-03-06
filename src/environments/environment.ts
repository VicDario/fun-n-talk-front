export const environment = {
  production: true,
  apiUrl: 'https://funntalk-1058570323303.us-central1.run.app',
  iceServers: [
    {
      urls: 'stun:stun.relay.metered.ca:80',
    },
    {
      urls: 'turn:sa.relay.metered.ca:80',
      username: 'acb4f434d300cbec6c741c96',
      credential: 'zwFadx6AO+f+iO7x',
    },
    {
      urls: 'turn:sa.relay.metered.ca:80?transport=tcp',
      username: 'acb4f434d300cbec6c741c96',
      credential: 'zwFadx6AO+f+iO7x',
    },
    {
      urls: 'turn:sa.relay.metered.ca:443',
      username: 'acb4f434d300cbec6c741c96',
      credential: 'zwFadx6AO+f+iO7x',
    },
    {
      urls: 'turns:sa.relay.metered.ca:443?transport=tcp',
      username: 'acb4f434d300cbec6c741c96',
      credential: 'zwFadx6AO+f+iO7x',
    },
  ],
};
