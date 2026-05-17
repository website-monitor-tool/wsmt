import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

export interface WsmtClientAddress {
  ip: string;
  port: number;
}

export interface WsmtClientOptions {
  name: string;
  secret: string;
  serviceDescription?: string;
  address: WsmtClientAddress;
  recallInterval?: number;
  maxRetries?: number;       // default 10
  baseRetryDelayMs?: number; // default 1000
}

export class WsmtClient {
  private ws: WebSocket | null = null;

  private isConnected = false;
  private isConnecting = false;
  private manuallyDisconnected = false;
  private hasConnectedOnce = false;

  private sigintHandler: (() => void) | null = null;

  private retryCount = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;

  constructor(private options: WsmtClientOptions) {
    this.maxRetries = options.maxRetries ?? 10;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 1000;
  }

  connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (this.isConnected || this.isConnecting) {
        console.warn('Already connected/connecting. Ignoring duplicate connect call.');
        return resolve();
      }

      this.isConnecting = true;
      this.manuallyDisconnected = false;

      const token = jwt.sign(
        { name: this.options.name },
        this.options.secret,
      );

      const params = `?recallMS=${this.options.recallInterval ?? 2000}`;

      const url =
        `ws://${this.options.address.ip}:${this.options.address.port}${params}`;

      this.ws = new WebSocket(url, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      let settled = false;

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.hasConnectedOnce = true;

        // Successful reconnect => clear retry state
        this.retryCount = 0;

        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }

        if (this.options.serviceDescription) {
          this.ws!.send(
            JSON.stringify({
              type: 'service-description',
              serviceDescription: this.options.serviceDescription,
            }),
          );
        }

        this.registerSigintHandler();

        settle(resolve);
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err.message);

        this.isConnecting = false;

        settle(() => reject(err));
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.isConnecting = false;

        this.ws = null;

        // invalid credentials
        if (event.code === 3000) {
          this.manuallyDisconnected = true;

          settle(() =>
            reject(
              new Error(`Invalid credentials: ${event.reason}`),
            ),
          );

          return;
        }

        // Normal/manual disconnect
        if (event.code === 1000 || this.manuallyDisconnected) {
          return;
        }

        settle(() =>
          reject(
            new Error(
              `❌ Connection closed unexpectedly (${event.code}): ${event.reason}`,
            ),
          ),
        );

        // Only reconnect after at least one successful connection
        if (this.hasConnectedOnce) {
          this.scheduleReconnect();
        }
      };
    });
  };

  private scheduleReconnect = (): void => {
    // Prevent duplicate reconnect timers
    if (this.reconnectTimeout || this.manuallyDisconnected) {
      return;
    }

    if (this.retryCount >= this.maxRetries) {
      console.error(
        `Max reconnection attempts (${this.maxRetries}) reached. Giving up.`,
      );

      return;
    }

    const baseDelay = Math.min(
      this.baseRetryDelayMs * 2 ** this.retryCount,
      30_000,
    );

    // 0–1000ms jitter
    const jitter = Math.random() * 1000;

    const delay = Math.floor(baseDelay + jitter);

    this.retryCount++;

    console.warn(
      `Reconnecting in ${delay}ms... ` +
      `(attempt ${this.retryCount}/${this.maxRetries})`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;

      this.connect()
        .then(() => {
          console.log('Reconnected successfully.');
        })
        .catch((err) => {
          console.error(
            '❌ Reconnect attempt failed:',
            err.message,
          );
        });
    }, delay);
  };

  disconnect = (): void => {
    this.manuallyDisconnected = true;
    this.removeSigintHandler();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.ws = null;
  };

  private registerSigintHandler = (): void => {
    this.removeSigintHandler();

    this.sigintHandler = () => {
      console.log(
        '👋 SIGINT received, closing socket gracefully...',
      );

      this.disconnect();

      process.exit(0);
    };

    process.once('SIGINT', this.sigintHandler);
  };

  private removeSigintHandler = (): void => {
    if (this.sigintHandler) {
      process.off('SIGINT', this.sigintHandler);
      this.sigintHandler = null;
    }
  };
}