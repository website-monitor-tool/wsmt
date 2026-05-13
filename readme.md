### (Incomplete readme)
This is a very early version, expect bugs and rapid development.

# About
Keeping track of multiple services and ensuring they stay online shouldn’t be a hassle. This library provides secure, real-time service monitoring powered by authenticated WebSocket connections. An optional status page dashboard gives you a centralized view of uptime, performance metrics, and outages across all your services. Fully open source and designed to be plug-and-play, it works with your favorite language and only takes a few lines of code to get started.

<img src="/images/dashboard.png" alt="showing the dashboard with statuses indicated using coloured boxes">

Currently supported package manager:

- NPM (JavaScript/Node.js) (Official)

Coming soon:

- Python (PyPI)
- Support for additional package managers
- one shot installation script for linux
<!-- # Features
- Websocket powered 
- Dashboard with status history and incident logs -->
# Working

This library uses authenticated WebSocket connections to stream live status updates between monitored services and connected clients in real time.

Each service establishes a secure authenticated WebSocket connection with the monitoring server, allowing the system to continuously track uptime and connection health with minimal overhead.

Clean shutdowns (such as `CTRL + C`) are detected and handled gracefully, so intentional stops aren’t treated as crashes or outages.

When a failure or unexpected disconnect is detected, a callback is triggered, allowing you to run your own custom notification logic — whether that’s sending alerts through webhooks, Discord, email, Slack, or anything else you want.

#### Security

All client connections must be authenticated using tokens, making the system secure by default. The optional dashboard visualize real-time service status, uptime, and failure events—instantly and efficiently.

---

## Getting Started

You need to run the server component first.

### 1. Create a Server

Create a new folder for your server:

```bash
mkdir wsmt-server
cd wsmt-server
npm init -y
npm install website-monitor-tool
```

---

### 2. Create an Entry File

Create a file called `index.js`:

```js
import { Wsmt } from "website-monitor-tool"

const wsmt = new Wsmt({
  port: 1234, // Port for the monitoring server
  password: <your-secure-password>,
  persistData: true, // Save monitored data
  webServerOptions: {
    enabled: true, // Enable status dashboard
    port: 1010     // Dashboard port
  },
  callback: (name) => {
    console.log(`Status changed for: ${name}`);
  }
});

wsmt.init();
```

---

### 3. Run the Server

```bash
node index.js
```

Nice! The server component is now running and listening for client connections. Next, connect a service to it.

---

### 4. Connect a Client

In the service you want to monitor, install the package:

```bash
npm install website-monitor-tool
```

Then connect it to your monitoring server:

```js
import { WsmtClient } from "website-monitor-tool/client";

const wsmtClient = new WsmtClient({
  name: "my_service",
  secret: "<your-secure-password>",
  serviceDescription: "My monitored service.",
  address: {
    ip: "127.0.0.1",
    port: 1234
  },
});

await wsmtClient.connect();
```

---
### Examples

Please see the [examples](/examples/) to see more demos.

---

## Configuration Options

| Option | Description |
|--------|-------------|
| `port` | Port used by the monitoring server |
| `password` | Authentication password (use a strong one) |
| `persistData` | Whether to save monitoring data |
| `webServerOptions.enabled` | Enable/disable web dashboard |
| `webServerOptions.port` | Port for dashboard UI |
| `callback` | Function triggered when status changes |

---

## Notes

- Make sure the ports you choose are not already in use.
- If you're self-hosting, ensure your firewall allows incoming connections.
- Use a strong password if exposing the server publicly.

---

 

## TODO: Tell about prettier and eslint for other devs

# Project Example

### Quick Start Demo

To quickly run the demo with a single command:
```bash
pnpm install
pnpm run demo
```

This will start:
1. The "mothership" server
2. Two example websites (demo1 and demo2)

### Detailed Demo Setup

The `demo` folder contains examples demonstrating:
- A "mothership" setup
- Two example websites

The demo website simulates a normal webpage that crashes when you visit `/crash` (simulating a real-world server error).

### Step-by-Step Setup

1. Install dependencies:
```bash
pnpm install
```

2. Run the server-side code:
```bash
pnpm run demo:server
```

3. In another terminal, Run the first demo website:
```bash
pnpm run demo:site1
```

4. (Optional) Run the second demo website in a separate terminal:
```bash
pnpm run demo:site2
```

### Running in Separate Terminals

> **NOTE** 
Running these commands in separate terminals makes processes easier to track, keeps logs properly separated, and simplifies debugging. Hence if you are looking to develop, I would suggest following the [step-by-step setup](#step-by-step-setup).

### Demo Behavior

Visit these routes to see different behaviors:
- `/crash` - Simulates a server error
- Other routes - Normal website behavior

### Development
The project makes it easier to develop using live reloading with the help of `nodemon`, `tsc`, `browser-sync` and `chokidar-cli`. This setup ensures any change in your TypeScript code or view files is automatically compiled, served, and reflected in the browser — without needing manual restarts or reloads.

Start the full live development environment:
This will:
- Watch and recompile TypeScript files
- Use nodemon for automatic restarts
- Copy view files on change
- Start a LiveReload server to refresh the browser automatically
```bash
pnpm run dev
```

Open the demo site:
Make sure you're running `pnpm run dev` in another terminal, then visit:
```bash
http://localhost:2020
```
This is the live version.

##### Run demo website (optional)
In another terminal open up the demo website
```bash
pnpm run dev:site1
```

if you would like the second demo site also, run
```bash
pnpm run dev:site2
```
