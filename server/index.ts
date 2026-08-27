import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './rooms.js';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;

app.use(cors());
app.use(express.json());

const roomManager = new RoomManager();

// Health check and Zero-Storage verification endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    mode: 'ZERO_STORAGE_EPHEMERAL_RELAY',
    timestamp: Date.now(),
    persistence: false,
    diskWrites: 0,
    version: '1.0.0'
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  let userRole: 'SHOP' | 'CUSTOMER' | null = null;
  let activeRoomId: string | null = null;

  ws.on('message', (messageData: string | Buffer) => {
    try {
      const msg = JSON.parse(messageData.toString());
      const { type, roomId } = msg;

      switch (type) {
        case 'INIT_TERMINAL': {
          userRole = 'SHOP';
          activeRoomId = roomId;
          const session = roomManager.createRoom(
            roomId,
            msg.shopId || `SHOP-${Date.now().toString(36).toUpperCase()}`,
            msg.shopName || 'Secure Print Station',
            ws
          );
          ws.send(JSON.stringify({
            type: 'TERMINAL_INITIALIZED',
            roomId: session.roomId,
            shopId: session.shopId,
            shopName: session.shopName
          }));
          break;
        }

        case 'JOIN_CUSTOMER': {
          userRole = 'CUSTOMER';
          activeRoomId = roomId;
          const joined = roomManager.joinCustomer(roomId, ws);
          if (!joined) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Terminal session expired, invalid, or offline. Please re-scan QR.'
            }));
          }
          break;
        }

        case 'DOC_META': {
          if (!activeRoomId) return;
          const session = roomManager.getRoom(activeRoomId);
          if (session && session.shopSocket && session.shopSocket.readyState === WebSocket.OPEN) {
            roomManager.updateStatus(activeRoomId, 'STREAMING', msg.metadata);
            session.shopSocket.send(JSON.stringify({
              type: 'DOC_META',
              metadata: msg.metadata,
              iv: msg.iv,
              salt: msg.salt,
              docHash: msg.docHash,
              authTag: msg.authTag,
              timestamp: Date.now()
            }));
          }
          break;
        }

        case 'DOC_CHUNK': {
          if (!activeRoomId) return;
          const session = roomManager.getRoom(activeRoomId);
          if (session && session.shopSocket && session.shopSocket.readyState === WebSocket.OPEN) {
            roomManager.touch(activeRoomId);
            // Pure in-memory forwarding of encrypted chunk
            session.shopSocket.send(JSON.stringify({
              type: 'DOC_CHUNK',
              chunkIndex: msg.chunkIndex,
              totalChunks: msg.totalChunks,
              data: msg.data
            }));
          }
          break;
        }

        case 'DOC_COMPLETE': {
          if (!activeRoomId) return;
          const session = roomManager.getRoom(activeRoomId);
          if (session && session.shopSocket && session.shopSocket.readyState === WebSocket.OPEN) {
            roomManager.updateStatus(activeRoomId, 'RECEIVED');
            session.shopSocket.send(JSON.stringify({
              type: 'DOC_COMPLETE',
              timestamp: Date.now()
            }));
          }
          break;
        }

        case 'PRINT_STATUS_UPDATE': {
          if (!activeRoomId) return;
          const session = roomManager.getRoom(activeRoomId);
          if (session && session.customerSocket && session.customerSocket.readyState === WebSocket.OPEN) {
            roomManager.updateStatus(activeRoomId, msg.status);
            session.customerSocket.send(JSON.stringify({
              type: 'PRINT_STATUS_UPDATE',
              status: msg.status,
              pagesPrinted: msg.pagesPrinted,
              copies: msg.copies,
              timestamp: Date.now()
            }));
          }
          break;
        }

        case 'SHRED_CONFIRMED': {
          if (!activeRoomId) return;
          const session = roomManager.getRoom(activeRoomId);
          if (session && session.customerSocket && session.customerSocket.readyState === WebSocket.OPEN) {
            roomManager.updateStatus(activeRoomId, 'SHREDDED');
            session.customerSocket.send(JSON.stringify({
              type: 'SHRED_CONFIRMED',
              certificate: msg.certificate,
              ledgerBlock: msg.ledgerBlock,
              timestamp: Date.now()
            }));
          }
          // After shred confirmed, close the room cleanly after 5 seconds
          setTimeout(() => {
            if (activeRoomId) {
              roomManager.closeRoom(activeRoomId, 'SHRED_COMPLETE');
            }
          }, 5000);
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }

        default:
          console.warn(`[SafePrint Relay] Unrecognized message type: ${type}`);
      }
    } catch (err: any) {
      console.error('[SafePrint Relay Error]:', err.message);
    }
  });

  ws.on('close', () => {
    if (activeRoomId && userRole === 'SHOP') {
      roomManager.closeRoom(activeRoomId, 'SHOP_DISCONNECTED');
    }
  });

  ws.on('error', (err) => {
    console.error('[SafePrint WebSocket Error]:', err);
  });
});

server.listen(port, () => {
  console.log(`\n======================================================`);
  console.log(`  🛡️  SafePrint Zero-Trust Ephemeral Relay Server`);
  console.log(`  ⚡  Port: ${port}`);
  console.log(`  🔒  Storage Policy: 100% In-Memory (Zero Disk Writes)`);
  console.log(`  🌐  WebSocket Path: ws://localhost:${port}/ws`);
  console.log(`======================================================\n`);
});
