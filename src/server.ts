// mother-ship
// website status monitor tool (WSMT)

// TODO: make it use wss (useless since no data is being transmitted?)
// Add ability to have whitelisted ip addresses

import { WebSocketServer, type AddressInfo, type WebSocket } from 'ws';
import { createServer } from 'http';
import prettyMilliseconds from 'pretty-ms';
import jwt from 'jsonwebtoken';
import { createWebServer } from './webserver.js';
const { verify } = jwt;
import debug from 'debug';
import { initDatabase, loadAllStatuses, saveStatus, registerDowntime, closeDowntime, getServiceDailyStatus, setCleanClose, resetCleanClose } from './persistence/database.js';

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
  log(`enabled debug mode with the following scopes:- ${passedScopes.split(" ")}`)
}

export interface StatusWebServerOptions {
  enabled?: boolean; 
  port?: number; 
  basePath?: string;
}

// put password checking, min limit and maybe special chars?
export interface WsmtOptions {
  port: number
  password: string
  persistData: boolean
  dbPath?: string;
  webServerOptions?: StatusWebServerOptions;
  callback: (name: string) => void
}

export interface WebsiteStatusEntry {
  id?: number;
  initialConnect: number;
  available: boolean;
  status: string;
  statusText: string;
  serviceDescription?: string;
  onlineSinceHumanReadable: string;
  lastSeen: number | "";
  lastSeenHumanReadable: string;
}

export type WebsiteStatus = Record<string, WebsiteStatusEntry>;

interface JwtPayload {
  name: string
}

interface ws extends WebSocket {
  name: string
  lastSeen: number
  recallMS: number
}

type StatusEntry = {
  id: number;
  name: string;
  initial_connection_ms: number;
  initialConnect: number;
  last_downtime_ms?: number;
  clean_close: number;
};

export class Wsmt {
  private wss?: WebSocketServer;
  private statuses: Record<string, any>;
  private _running: boolean = false;
  private address: string | AddressInfo | undefined;
  private callback: (name: string) => void;
  private SERVER_SECRET_KEY: string;
  private recallInterval: number | undefined;

  constructor(private options: WsmtOptions) {
    this.statuses = {};
    this._running = true;
    this.address = undefined;
    this.SERVER_SECRET_KEY = options.password;
    this.callback = options.callback;
    //this.strictMode = false;
    this.recallInterval = undefined;

    // Initialise the database connection early so the path is locked in
    // before any query runs. Safe to call multiple times — only opens once.
    if (options.persistData) {
      initDatabase(options.dbPath);
    }

    // log(this.websiteStatus)
    // setInterval(() => {
    //   //log(this.websiteStatus)
    //   log(getServiceDailyStatus())
    // }, 10000);
  }

  // TODO: Split code and move it into functions.
  init = (): WebSocketServer => {
    // if ((options.server != null) && options.port) {
    //   throw new TypeError('Only one of the "port" or "server" options must be specified');
    // }
    const HTTPServer = createServer().listen(this.options.port);
    this.wss = new WebSocketServer({ noServer: true });
    console.log(`WSS listening on port ${this.options.port}`);

    let DBdata: StatusEntry[];
    let AllServiceNamesInDB: string[] = []

    // TODO: make this into a function and then recall when needed, the cache refreshing is done
    // again which is unnecessary.
    if (this.options.persistData) {
      DBdata = this.reloadCache()["serviceResult"]
      AllServiceNamesInDB = DBdata.map(row => row.name)

      log("persist mode is enabled. DB data\n" + JSON.stringify(DBdata))

      DBdata.forEach(entry => {
        if (entry.clean_close) return;

        this.hydrateStatusFromDatabase(entry);
      });

      log("Following services has been loaded from the database", AllServiceNamesInDB);
    }

    if (this.options.webServerOptions?.enabled) {
      const app = createWebServer(this);
      const port = this.options.webServerOptions.port || 4832;
      app.listen(port, () => {
        console.log(`Status page running at http://localhost:${port}`);
      });
    }

    this.wss.on('error', (error) => {
      // Do something with the error, such as logging it or sending a notification
      console.error(error);
    });

    HTTPServer.on('upgrade', (request, socket, head) => {
      socket.on('error', this.onSocketError);
      this.authenticate(request, (err: Error | null, client: any) => {
        if (err || !client) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        socket.removeListener('error', this.onSocketError);

        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request, client);
        });
      });
    });

    this.wss.on('connection', (socket: ws, req: any, client: { name: string }) => {
      try {
        const connection_time_ms = Date.now();
        socket.on('error', console.error);

        socket.name = client.name;

        log(`A new connection from ${socket.name}`);

        // refresh DB data to check if new services were added after the class has been initialized.
        // unnecessary repetition of code
        DBdata = this.reloadCache()["serviceResult"]
        AllServiceNamesInDB = DBdata.map(row => row.name)

        DBdata.forEach(entry => {
          if (entry.clean_close) return;

          this.hydrateStatusFromDatabase(entry);
        });

        // end of repeated code

        if (!this.statuses[socket.name]) {
          const entry = DBdata.find(item => item.name === socket.name);

          this.statuses[socket.name] = {
            id: entry?.id,
            initialConnect: entry?.initialConnect ?? Date.now(),
          };
        }

        this.statuses[socket.name].onlineSince = connection_time_ms
        this.statuses[socket.name].status = "operational";

        if (this.options.persistData && !AllServiceNamesInDB.includes(socket.name)) {
          saveStatus(socket.name, connection_time_ms);
          this.statuses[socket.name].initialConnect = connection_time_ms;
        }

        const entry = DBdata.find(item => item.name === socket.name);
        this.statuses[socket.name].id = entry?.id;
        if (this.options.persistData && entry) {
          resetCleanClose(entry.id);
        }

        if (this.options.persistData && entry && entry.last_downtime_ms) {
          closeDowntime(entry["id"], connection_time_ms)
        }

        if (socket.name in this.statuses && this.statuses[socket.name].status === "down") {
          log(`${socket.name} is back!`)
          this.statuses[socket.name].status = "operational";
        }

        socket.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === "service-description") {
              // cap description length
              const desc = String(msg.serviceDescription ?? '').slice(0, 512); 
              this.statuses[socket.name].serviceDescription = desc
              log(`Client ${socket.name} described: ${desc}`);
            }
          } catch (err) {
            console.error('message handler threw:', err);
          }
        });

        log(this.statuses)

        socket.on('close', (code: number) => {
          try {
            const lastSeen = Date.now();

            if (code === 1000) {
              log(`normal closure from ${socket.name}`);
              const entry = DBdata.find(item => item.name === socket.name);
              this.remove_record(socket.name);
              if (this.options.persistData && entry) {
                setCleanClose(entry.id);
              }
              return;
            }

            log(`${socket.name} disconnected with code ${code}`);

            const entry = DBdata.find(item => item.name === socket.name);

            if (this.options.persistData && entry) {
              log("registering downtime");
              registerDowntime(entry["id"], lastSeen);
            } else {
              log("not registering downtime because persist mode or entry check failed");
            }

            if (!this.statuses[socket.name]) {
              this.statuses[socket.name] = {};
            }

            this.statuses[socket.name].lastSeen = lastSeen;
            this.statuses[socket.name].status = "down";
            this.callback(socket.name);
          } catch (err) {
            console.error('close handler threw:', err);
          }
        });

      } catch (err) {
        console.error('connection handler threw:', err);
        socket.close(1011, 'Internal error');
      }
    });
    return this.wss;
  };

  close(): boolean {
    this.wss?.close();
    this._running = false;
    return true;
  }

  private authenticate(request: any, callback: (err: Error | null, client: any) => void) {
    try {
      const authHeader = request.headers['authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return callback(new Error('Missing or invalid Authorization header'), null);
      }

      const token = authHeader?.split(' ')[1];
      const decoded = verify(token, this.SERVER_SECRET_KEY) as JwtPayload;

      // validate name
      const nameRegex = /^[a-zA-Z0-9_\-]{1,64}$/;
      if (!nameRegex.test(decoded.name)) {
        return callback(new Error('Invalid service name'), null);
      }

      const client = { name: decoded.name };
      callback(null, client);
    } catch (err) {
      callback(new Error('Invalid token'), null);
    }
  }

  private remove_record(name: string): boolean {
    return delete this.statuses[name];
  }

  private set_password(password: string): void {
    this.SERVER_SECRET_KEY = password;
  }

  /** returns current status of the tool. */
  get running(): boolean {
    return this._running;
  }

  private onSocketError(err: Error) {
    console.log(err)
  }

  private fetchDatabaseServices() {
    return loadAllStatuses() as StatusEntry[];
  }

  private hydrateStatusFromDatabase(entry: StatusEntry) {
    const currentStatus = this.statuses[entry.name] ?? {};

    this.statuses[entry.name] = {
      ...currentStatus,
      id: entry.id,
      initialConnect: entry.initialConnect,
      status: entry.last_downtime_ms ? "down" : "operational",
      lastSeen: entry.last_downtime_ms ?? undefined,
    };
  }

  private reloadCache() {
    const serviceResult = this.fetchDatabaseServices().map(row => ({
      ...row,
      initialConnect: row.initial_connection_ms!
    }));

    const AllServiceNamesInDB = serviceResult.map(row => row.name);


    return {
      AllServiceNamesInDB,
      serviceResult
    };
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'operational': return 'Operational';
      case 'degraded': return 'Degraded Performance';
      case 'down': return 'Major Outage';
      default: return 'Unknown';
    }
  }

  /** returns if persistence has been enabled
  * @returns {boolean} isPersistent
  */
  get isPersistent(): boolean{
    return this.options.persistData ?? false;
  }

  /** returns the status of websites being monitored
   * @returns {object} statuses
   */
  get websiteStatus(): WebsiteStatus {
    /**
     * Returns the status of the websites being monitored by the WebSocket server.
     * @returns {object} an object with the website URLs as keys and the status objects as values.
     * Each status object has the following properties:
     * - available: {boolean} true if the website is reachable, false otherwise
     * - responseTime: {number} the average response time of the website in milliseconds
     * //TODO: responseTime not implemented as I want to leave it to the user.
     */
    const now = Date.now();

    const result: WebsiteStatus = {};
    for (const [site, data] of Object.entries(this.statuses)) {
      const diffMs = now - data.lastSeen;
      const statusText = this.getStatusText(data.status)

      const isAvailable = data.status === "operational";
      const onlineDuration = isAvailable && data.onlineSince && isFinite(now - data.onlineSince)
        ? prettyMilliseconds(now - data.onlineSince, { secondsDecimalDigits: 0 })
        : "";
      const lastSeenTime = data.lastSeen || "";
      const lastSeenDuration = data.lastSeen ? prettyMilliseconds(diffMs, { secondsDecimalDigits: 0 }) : "a while ago";

      result[site] = {
        id: data.id,
        initialConnect: data.initialConnect,
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
