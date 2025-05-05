// webserver.ts
// uses polling for now, use sockets? will have to implement auth etc though
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function createWebServer(wsmt) {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, './view'));
    app.get('/api/status', (req, res) => {
        const services = wsmt.websiteStatus;
        res.json(services || {});
    });
    app.get('/', (req, res) => {
        const services = wsmt.websiteStatus;
        res.render('status', {
            headerStatus: 'System Monitor Tool | Powered by wasmt',
            service: services
        });
    });
    return app;
}
//# sourceMappingURL=webserver.js.map