import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import { router } from './api/routes.ts';
import { startAutonomousDaemon } from './scheduler/daemon.ts';
import { db } from './db/database.ts';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = parseInt(process.env.PORT || '5050', 10);

app.use(cors());
app.use(express.json());

// API endpoints
app.use('/api', router);

// Serve static frontend build in production
const clientDistPath = path.resolve(process.cwd(), '../client/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) res.status(404).send('Signal Atlas Server Running. Client build not found yet.');
  });
});

// WebSocket Connection broadcast
wss.on('connection', (ws) => {
  db.addLog('INFO', 'WEBSOCKET', 'Dashboard client connected to real-time event bus.');
  ws.send(JSON.stringify({ type: 'INIT', timestamp: new Date().toISOString() }));
});

server.listen(PORT, () => {
  db.addLog('SUCCESS', 'SERVER', `Signal Atlas Server running on http://localhost:${PORT}`);
  console.log(`=================================================`);
  console.log(`🚀 SIGNAL ATLAS SERVER ONLINE`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`⚡ Mode: ${process.env.DEMO_MODE !== 'false' ? 'DEMO_MODE (Simulated)' : 'PRODUCTION (Live)'}`);
  console.log(`=================================================`);

  // Start Autonomous Scheduler Daemon
  startAutonomousDaemon();
});
