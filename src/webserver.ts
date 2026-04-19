// webserver.ts

// uses polling for now, use sockets? will have to implement auth etc though

import express, { Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getServiceDailyStatus } from './persistence/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createWebServer(wsmt: any): Express {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, './view'));

  app.get('/api/status', (req, res) => {
    const services = wsmt.websiteStatus;
    res.json(services || {});
  });

  app.get('/api/down', (req, res) => {
    res.json(getServiceDailyStatus());
  });

  app.get('/', (req, res) => {
    const services = wsmt.websiteStatus;
    const count = Object.keys(services).length;
    const downtimes = getServiceDailyStatus();

    console.log('downtimes:', downtimes);
    console.log('services:', services);

    res.render('status', {
      headerStatus: 'System Monitor Tool | Powered by wasmt',
      service: services,
      count,
      downtimes,
      isPersistent: wsmt.isPersistent
    });
  });

  app.get('/status/:id', (req, res) => {
    const html = "<h2>This feature is still under construction!</h2>"
    res.send(html);
  });

  return app;
}
