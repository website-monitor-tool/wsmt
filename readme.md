### (Incomplete readme)
This is a very early version, expect bugs.

# About
Keeping track of multiple websites can be an excruciating task, this library takes the weight from your shoulders. It also includes an
optional status page dashboard so that you can monitor everything from a single spot! Works with your favorite language!

Currently supported package manager:

- NPM (JavaScript/Node.js) (Official)

Coming soon:

- Python (PyPI)
- Support for additional package managers

# Working
This library leverages authenticated WebSocket connections to stream live status updates between the backend and connected clients.

Each monitored website establishes a connection with a centralized server which leverages authenticated websockets to monitor its status
Clean closures (ctrl + c) are recognized and respected!

When a failure is detected it can be configured to notify you via webhooks, discord, email or a custom callback!

#### Security

All client connections must be authenticated using tokens, making the system secure by default. The optional dashboard visualize real-time service status, uptime, and failure events—instantly and efficiently.

# Setup
1) Install from github with your preferred package manager
```bash
pnpm install https://github.com/NihalNavath/website-monitor-tool
```
OR
```bash
npm install https://github.com/NihalNavath/website-monitor-tool`
```

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