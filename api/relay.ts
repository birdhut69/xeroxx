import type { VercelRequest, VercelResponse } from '@vercel/node';

// Ephemeral in-memory message queues for serverless environments
interface EphemeralMessage {
  id: string;
  targetRole: 'SHOP' | 'CUSTOMER';
  timestamp: number;
  data: any;
}

interface ServerlessRoom {
  roomId: string;
  shopId: string;
  shopName: string;
  createdAt: number;
  lastActivity: number;
  messages: EphemeralMessage[];
}

const rooms = new Map<string, ServerlessRoom>();

// Auto purge stale rooms older than 15 mins
function cleanup() {
  const now = Date.now();
  for (const [id, r] of rooms.entries()) {
    if (now - r.lastActivity > 15 * 60 * 1000) {
      rooms.delete(id);
    }
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  cleanup();

  const action = req.query.action || req.body?.action;
  const roomId = (req.query.roomId || req.body?.roomId) as string;

  if (req.method === 'GET' && req.url?.includes('health')) {
    return res.status(200).json({
      status: 'ONLINE',
      mode: 'VERCEL_SERVERLESS_EPHEMERAL_RELAY',
      persistence: false,
      timestamp: Date.now()
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};

    if (action === 'INIT_TERMINAL') {
      const { shopId, shopName } = body;
      rooms.set(roomId, {
        roomId,
        shopId: shopId || 'SHOP-VERCEL',
        shopName: shopName || 'SafePrint Vercel Station',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: []
      });
      return res.status(200).json({ status: 'OK', roomId });
    }

    if (action === 'JOIN_CUSTOMER') {
      const room = rooms.get(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found or expired' });
      }
      room.lastActivity = Date.now();
      // Enqueue notification for shopkeeper
      room.messages.push({
        id: Math.random().toString(36).substring(2),
        targetRole: 'SHOP',
        timestamp: Date.now(),
        data: { type: 'CUSTOMER_CONNECTED', timestamp: Date.now() }
      });
      return res.status(200).json({
        status: 'OK',
        shopName: room.shopName,
        shopId: room.shopId
      });
    }

    if (action === 'SEND_MESSAGE') {
      const { targetRole, message } = body;
      const room = rooms.get(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room expired' });
      }
      room.lastActivity = Date.now();
      room.messages.push({
        id: Math.random().toString(36).substring(2),
        targetRole,
        timestamp: Date.now(),
        data: message
      });

      // Keep only last 100 in-flight messages
      if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
      }

      return res.status(200).json({ status: 'SENT' });
    }
  }

  if (req.method === 'GET') {
    if (action === 'POLL') {
      const role = req.query.role as 'SHOP' | 'CUSTOMER';
      const since = parseInt((req.query.since as string) || '0');
      const room = rooms.get(roomId);

      if (!room) {
        return res.status(200).json({ messages: [], roomClosed: true });
      }

      room.lastActivity = Date.now();
      const newMessages = room.messages.filter(
        (m) => m.targetRole === role && m.timestamp > since
      );

      return res.status(200).json({
        messages: newMessages.map((m) => m.data),
        timestamp: Date.now()
      });
    }
  }

  return res.status(200).json({ status: 'ONLINE', message: 'SafePrint Serverless Relay' });
}
