// mother-ship
// website status monitor tool (WSMT)
// TODO: make it use wss (useless since no data is being transmitted?
// Add ability to have whitelisted ip addresses
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import prettyMilliseconds from 'pretty-ms';
import jwt from 'jsonwebtoken';
import { createWebServer } from './webserver.js';
const { verify } = jwt;
import debug from 'debug';
const log = debug('wsmt:server');
if (process.argv.includes('--debug')) {
    const validScopes = ['server', '*'];
    const passedScopes = process.argv[process.argv.indexOf('--debug') + 1] || '*';
    for (const scope of passedScopes.split(",")) {
        if (!validScopes.includes(scope.trim())) {
            throw new Error(`Invalid debug scope passed: '${scope}'. Can only be one or a combination of the following: ${validScopes.join(', ')}`);
        }
    }
    debug.enable(passedScopes === '*' ? '*' : `wsmt:${passedScopes}`);
}
export class Wsmt {
    options;
    wss;
    statuses;
    _running = false;
    address;
    callback;
    SERVER_SECRET_KEY;
    recallInterval;
    // strictMode: boolean; > TODO: If strict mode is enabled, prevent the website from running unless the status checker is connected.
    constructor(options) {
        this.options = options;
        this.statuses = {};
        this._running = true;
        this.address = undefined;
        this.SERVER_SECRET_KEY = options.password;
        this.callback = options.callback;
        //this.strictMode = false;
        this.recallInterval = undefined;
        // start the status checker
        setInterval(() => {
            log(this.websiteStatus);
        }, 2000);
    }
    // TODO: Split code and move it into functions.
    init = () => {
        // if ((options.server != null) && options.port) {
        //   throw new TypeError('Only one of the "port" or "server" options must be specified');
        // }
        const HTTPServer = createServer().listen(this.options.port);
        this.wss = new WebSocketServer({ noServer: true });
        console.log(`WSS listening on port ${this.options.port}`);
        if (this.options.webServerOptions?.enabled) {
            const app = createWebServer(this);
            const port = this.options.webServerOptions.port || 4832;
            app.listen(port, () => {
                console.log(`Status page running at http://localhost:${port}`);
            });
        }
        // handle errors on the server side
        this.wss.on('error', (error) => {
            // Do something with the error, such as logging it or sending a notification
            console.error(error);
        });
        HTTPServer.on('upgrade', (request, socket, head) => {
            socket.on('error', this.onSocketError);
            this.authenticate(request, (err, client) => {
                if (err || !client) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }
                socket.removeListener('error', this.onSocketError);
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.wss.emit('connection', ws, request, client);
                });
            });
        });
        this.wss.on('connection', (socket, req, client) => {
            socket.on('error', console.error);
            socket.name = client.name;
            log(`A new connection from ${socket.name}`);
            if (!this.statuses[socket.name]) {
                this.statuses[socket.name] = {};
            }
            this.statuses[socket.name].onlineSince = Date.now();
            this.statuses[socket.name].status = "operational";
            if (socket.name in this.statuses && this.statuses[socket.name].status === "down") {
                log(`${socket.name} is back!`);
                this.statuses[socket.name].onlineSince = Date.now();
                this.statuses[socket.name].status = "operational";
                //clearInterval(recall);
            }
            //put only verification inside try catch
            socket.on("message", (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "service-description") {
                    this.statuses[socket.name].serviceDescription = msg.serviceDescription;
                    log(`Client ${socket.name} described: ${msg.serviceDescription}`);
                }
            });
            socket.on('close', (code) => {
                if (code === 1000) {
                    log(`normal closure from ${socket.name}`);
                    this.remove_record(socket.name);
                    return;
                }
                // move into down function
                log(`${socket.name} seems to have gone offline!`);
                if (!this.statuses[socket.name]) {
                    this.statuses[socket.name] = {};
                }
                const lastSeen = Date.now();
                this.statuses[socket.name].lastSeen = lastSeen;
                this.statuses[socket.name].status = "down";
                this.statuses[socket.name].lastSeenHumanReadable =
                    prettyMilliseconds(lastSeen); //this is wrong value, update
                this.callback(socket.name);
            });
        });
        return this.wss;
    };
    close() {
        this.wss?.close();
        this._running = false;
        return true;
    }
    authenticate(request, callback) {
        try {
            const authHeader = request.headers['authorization'];
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return callback(new Error('Missing or invalid Authorization header'), null);
            }
            const token = authHeader?.split(' ')[1];
            const decoded = verify(token, this.SERVER_SECRET_KEY);
            const client = { name: decoded.name };
            callback(null, client);
        }
        catch (err) {
            callback(new Error('Invalid token'), null);
        }
    }
    remove_record(name) {
        return delete this.statuses[name];
    }
    set_password(password) {
        this.SERVER_SECRET_KEY = password;
    }
    /** returns current status of the tool. */
    get running() {
        return this._running;
    }
    onSocketError(err) {
        console.log(err);
    }
    getStatusText(status) {
        switch (status) {
            case 'operational': return 'Operational';
            case 'degraded': return 'Degraded Performance';
            case 'down': return 'Major Outage';
            default: return 'Unknown';
        }
    }
    /** returns the status of websites being monitored
     * @returns {object} statuses
     */
    get websiteStatus() {
        /**
         * Returns the status of the websites being monitored by the WebSocket server.
         * @returns {object} an object with the website URLs as keys and the status objects as values.
         * Each status object has the following properties:
         * - available: {boolean} true if the website is reachable, false otherwise
         * - responseTime: {number} the average response time of the website in milliseconds
         * //TODO: responseTime not implemented as I want to leave it to the user.
         */
        const now = Date.now();
        const result = {};
        for (const [site, data] of Object.entries(this.statuses)) {
            const diffMs = now - data.lastSeen;
            const statusText = this.getStatusText(data.status);
            const isAvailable = data.status === "operational";
            const onlineDuration = isAvailable ? prettyMilliseconds(now - data.onlineSince, { secondsDecimalDigits: 0 }) : "";
            const lastSeenTime = data.lastSeen || "";
            const lastSeenDuration = data.lastSeen ? prettyMilliseconds(diffMs, { secondsDecimalDigits: 0 }) : "";
            result[site] = {
                available: isAvailable,
                status: data.status,
                statusText,
                serviceDescription: data.serviceDescription,
                onlineSinceHumanReadable: onlineDuration,
                lastSeen: lastSeenTime,
                lastSeenHumanReadable: lastSeenDuration
            };
        }
        return result;
    }
}
//# sourceMappingURL=server.js.map