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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    mode: 'ZERO_STORAGE_EPHEMERAL_RELAY',
    timestamp: Date.now(),
    persistence: false,
    diskWrites: 0,
    version: '2.0.0',
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  let userRole: 'SHOP' | 'CUSTOMER' | null = null;
  let activeRoomId: string | null = null;
  let activeCustomerId: string | null = null;

  ws.on('message', (messageData: string | Buffer) => {
    try {
      const msg = JSON.parse(messageData.toString());
      const { type, roomId, customerId } = msg;

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
          ws.send(
            JSON.stringify({
              type: 'TERMINAL_INITIALIZED',
              roomId: session.roomId,
              shopId: session.shopId,
              shopName: session.shopName,
            })
          );
          break;
        }

        case 'JOIN_CUSTOMER': {
          userRole = 'CUSTOMER';
          activeRoomId = roomId;
          const assignedCustId: string = customerId || `CUST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          activeCustomerId = assignedCustId;
          const joined = roomManager.joinCustomer(
            roomId,
            assignedCustId,
            msg.customerName,
            ws
          );
          if (!joined) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                message: 'Terminal session expired, invalid, or offline. Please re-scan QR.',
              })
            );
          }
          break;
        }

        case 'DOC_META': {
          if (!activeRoomId) return;
          const session = roomManager.getRoom(activeRoomId);
          if (session && session.shopSocket && session.shopSocket.readyState === WebSocket.OPEN) {
            session.shopSocket.send(
              JSON.stringify({
                type: 'DOC_META',
                customerId: msg.customerId || activeCustomerId,
                customerName: msg.customerName,
                metadata: msg.metadata,
                iv: msg.iv,
                docHash: msg.docHash,
                timestamp: Date.now(),
              })
            );
          }
          break;
        }

        case 'DOC_CHUNK': {
          if (!activeRoomId) return;
          const session = roomManager.getRoom(activeRoomId);
          if (session && session.shopSocket && session.shopSocket.readyState === WebSocket.OPEN) {
            roomManager.touch(activeRoomId);
            session.shopSocket.send(
              JSON.stringify({
                type: 'DOC_CHUNK',
                customerId: msg.customerId || activeCustomerId,
                chunkIndex: msg.chunkIndex,
                totalChunks: msg.totalChunks,
                data: msg.data,
              })
            );
          }
          break;
        }

        case 'DOC_COMPLETE': {
          if (!activeRoomId) return;
          const session = roomManager.getRoom(activeRoomId);
          if (session && session.shopSocket && session.shopSocket.readyState === WebSocket.OPEN) {
            session.shopSocket.send(
              JSON.stringify({
                type: 'DOC_COMPLETE',
                customerId: msg.customerId || activeCustomerId,
                timestamp: Date.now(),
              })
            );
          }
          break;
        }

        case 'PRINT_STATUS_UPDATE': {
          if (!activeRoomId) return;
          const session = roomManager.getRoom(activeRoomId);
          if (session) {
            const targetCustId = msg.customerId;
            if (targetCustId) {
              const cust = session.customers.get(targetCustId);
              if (cust && cust.socket.readyState === WebSocket.OPEN) {
                cust.socket.send(
                  JSON.stringify({
                    type: 'PRINT_STATUS_UPDATE',
                    status: msg.status,
                    pagesPrinted: msg.pagesPrinted,
                    copies: msg.copies,
                    timestamp: Date.now(),
                  })
                );
              }
            } else {
              // Broadcast to all customers
              for (const cust of session.customers.values()) {
                if (cust.socket.readyState === WebSocket.OPEN) {
                  cust.socket.send(JSON.stringify(msg));
                }
              }
            }
          }
          break;
        }

        case 'SHRED_CONFIRMED': {
          if (!activeRoomId) return;
          const session = roomManager.getRoom(activeRoomId);
          if (session) {
            const targetCustId = msg.customerId;
            if (targetCustId) {
              const cust = session.customers.get(targetCustId);
              if (cust && cust.socket.readyState === WebSocket.OPEN) {
                cust.socket.send(
                  JSON.stringify({
                    type: 'SHRED_CONFIRMED',
                    certificate: msg.certificate,
                    ledgerBlock: msg.ledgerBlock,
                    timestamp: Date.now(),
                  })
                );
              }
            }
          }
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }
      }
    } catch (err: any) {
      console.error('[SafePrint Relay Error]:', err.message);
    }
  });

  ws.on('close', () => {
    if (activeRoomId) {
      if (userRole === 'SHOP') {
        roomManager.closeRoom(activeRoomId, 'SHOP_DISCONNECTED');
      } else if (userRole === 'CUSTOMER' && activeCustomerId) {
        roomManager.removeCustomer(activeRoomId, activeCustomerId);
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[SafePrint WebSocket Error]:', err);
  });
});

server.listen(port, () => {
  console.log(`\n======================================================`);
  console.log(`  🛡️  SafePrint WhatsApp-Style Multi-Customer Relay`);
  console.log(`  ⚡  Port: ${port}`);
  console.log(`  👥  Multi-Customer Queuing Active`);
  console.log(`======================================================\n`);
});
