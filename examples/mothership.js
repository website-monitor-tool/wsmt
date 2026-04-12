import { Wsmt } from '../build/index.js';

const wsmt = new Wsmt({
  port: 1234,
  password: 'se$curePwD%^&',
  persistData: true,
  webServerOptions: {
    enabled: true,
    port: 1010
  },
  callback: (name) => {
    console.log(`Alert! ${name} just went down!`);
    setTimeout(() => {
      console.log(wsmt.websiteStatus);
    }, 5000); // Wait 5 seconds to see meaningful human-readable time
  }
});
wsmt.init();

console.log('Mothership listening on port 1234');