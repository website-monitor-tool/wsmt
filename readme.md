# About
Keeping track of multiple websites can be an excruciating task, this library takes the weight from your shoulders. It also includes an
optional status page dashboard so that you can monitor everything from one spot itself!

# Working
This library leverages authenticated WebSocket connections to stream live status updates between the backend and connected clients.

Each monitored website is assigned a dedicated worker that tracks its health and performance internally. These workers push real-time updates through a secure WebSocket channel, ensuring instant feedback without unnecessary network overhead.

All client connections must be authenticated using tokens or session credentials, making the system secure by default. The optional dashboard listens over this WebSocket connection to visualize real-time service status, uptime, and failure events—instantly and efficiently.

# Setup
1) Install from github with your preferred package manager
`$ npm install https://github.com/NihalNavath/website-monitor-tool`
or  
`$ pnpm install https://github.com/NihalNavath/website-monitor-tool`

## Tell about prettier and eslint for other devs

# Example

The `demo` folder contains examples on how to setup a "mothership" and 2 example websites.

Demo website simulates a normal webpage that crashes when you visit /crash, in a real word scenario this would be a server error