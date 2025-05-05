  import { WebSocket } from 'ws';
  import jwt from 'jsonwebtoken';

  interface Address {
    ip: string;
    port: number;
  }

  interface ClientConstructorOptions {
    name: string;
    secret: string;
    serviceDescription?: string,
    address: Address;
    recallInterval?: number;
  }

  export class WsmtClient {
    private ws!: WebSocket;
    private exitCallAmount = 0;
    private isConnected = false;

    constructor(private options: ClientConstructorOptions) { }

    connect = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (this.isConnected) {
          console.warn('Already connected. Ignoring duplicate connect call.');
          return resolve();
        }
        const token = jwt.sign({ name: this.options.name }, this.options.secret);
        const params = `?recallMS=${this.options.recallInterval ?? 2000}`;
        const url = `ws://${this.options.address.ip}:${this.options.address.port}${params}`;

        this.ws = new WebSocket(
          url, {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        this.ws.onopen = () => {
          this.isConnected = true;

          if (this.options.serviceDescription) {
            this.ws.send(
              JSON.stringify({
                type: "service-description",
                serviceDescription: this.options.serviceDescription,
              })
            );
          }

          resolve();
        };

        this.ws.onerror = (err) => {
          reject(err);
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;

          //TODO: This has been deprecated, the newer authentication method the websocket no longer connects. Change this.
          if (event.code === 3000) {
            reject(new Error(`❌ Invalid username/password: ${event.reason}`));
          } else if (event.code !== 1000) {
            reject(new Error(`❌ Connection closed unexpectedly: ${event.reason}`));
          }
        };

        process.on('SIGINT', () => {
          if (this.exitCallAmount < 1) {
            console.log('👋 SIGINT received, closing socket gracefully...');
            this.disconnect();
            process.exit(0);
          }
          this.exitCallAmount++;
        });
      });
    };

    disconnect = (): void => {
      if (this.ws && this.isConnected) {
        this.ws.close(1000, 'Normal closure');
        this.isConnected = false;
      }
    };
  }
