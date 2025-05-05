import { WsmtClient } from '../build/index.js';
import http from 'http';

// A demo website that serves1 'Hello World' when you visit any path and crashes when
// you visit /crash
const server = http.createServer((req, res) => {
  if (req.url.split('/')[1] === 'crash') {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Simulating a crash now...');
    throw new Error('Server crash signal received!');
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});

server.listen(9435, async () => {
  console.log('🟢 Server listening at http://localhost:9435');

  const wsmt = new WsmtClient({
    name: 'demo_website_1',
    secret: 'se$curePwD%^&',
    serviceDescription: "A demo site to test out the tool.",
    address: {
      ip: '127.0.0.1',
      port: 1234
    }
  });

  try {
    await wsmt.connect();
    console.log('🌐 Visit http://localhost:9435/crash to simulate a crash!');
  } catch (err) {
    console.error('❌ WSMT connection failed:', err.message);
  }
});