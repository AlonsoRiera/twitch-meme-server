const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = {
    extensions: new Set(),
    bots: new Set()
};

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('Received message:', message);

            switch (message.type) {
                case 'extension_connect':
                    clients.extensions.add(ws);
                    ws.clientType = 'extension';
                    console.log('Extension connected');
                    break;

                case 'bot_connect':
                    clients.bots.add(ws);
                    ws.clientType = 'bot';
                    console.log('Bot connected');
                    break;

                case 'meme_request':
                    // Forward meme request from extension to all connected bots
                    console.log('Forwarding meme request to bots');
                    clients.bots.forEach(botWs => {
                        if (botWs.readyState === WebSocket.OPEN) {
                            botWs.send(JSON.stringify(message));
                        }
                    });
                    break;

                case 'meme_status':
                    // Forward status updates from bot to extensions
                    clients.extensions.forEach(extWs => {
                        if (extWs.readyState === WebSocket.OPEN) {
                            extWs.send(JSON.stringify(message));
                        }
                    });
                    break;
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
        if (ws.clientType === 'extension') {
            clients.extensions.delete(ws);
        } else if (ws.clientType === 'bot') {
            clients.bots.delete(ws);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        extensions: clients.extensions.size,
        bots: clients.bots.size,
        uptime: process.uptime()
    });
});

// Keep-alive endpoint (prevents sleeping)
app.get('/ping', (req, res) => {
    res.json({ pong: Date.now() });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});