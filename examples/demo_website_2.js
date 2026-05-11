import express from 'express';
import { WsmtClient } from '../build/client.js';

await new WsmtClient({  
  name: 'demo_website_2',
  secret: 'se$curePwD%^&',
  serviceDescription: "Express powered website.",
  address: {
    ip: '127.0.0.1',
    port: 1234
  },
  recallInterval: 1000}).connect();

const app = express();
const PORT = 2873;

app.get('/', (req, res) => {
  res.send('WSMT client is active!');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
