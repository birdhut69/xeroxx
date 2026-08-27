import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Multi-Customer Ephemeral Relay for Serverless Environments ──
// All memory is transient in-memory — no persistence, no disk storage.

interface EphemeralMessage {
  id: string;
  targetRole: 'SHOP' | 'CUSTOMER';
  targetCustomerId?: string;
  timestamp: number;
  data: Record<string, unknown>;
}

interface ServerlessCustomer {
  customerId: string;
  customerName: string;
  connectedAt: number;
  lastActivity: number;
}

interface ServerlessRoom {
  roomId: string;
  shopId: string;
  shopName: string;
  createdAt: number;
  lastActivity: number;
  customers: Map<string, ServerlessCustomer>;
  messages: EphemeralMessage[];
}

const rooms = new Map<string, ServerlessRoom>();
const MAX_ROOMS = 1000;
const MAX_MESSAGES_PER_ROOM = 500;
const ROOM_TTL_MS = 30 * 60 * 1000; // 30 min TTL
const MAX_MESSAGE_SIZE = 15 * 1024 * 1024; // 15 MB payload limit

function cleanup() {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.lastActivity > ROOM_TTL_MS) {
      rooms.delete(id);
    }
  }
}

function sanitizeString(input: unknown, maxLen: number = 256): string {
  if (typeof input !== 'string') return '';
  return input.slice(0, maxLen).replace(/[<>"']/g, '');
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  cleanup();

  const action = (req.query.action || req.body?.action) as string | undefined;
  const roomId = (req.query.roomId || req.body?.roomId) as string | undefined;
  const customerId = (req.query.customerId || req.body?.customerId) as string | undefined;

  // Health check
  if (action === 'health' || (req.method === 'GET' && req.url?.includes('health'))) {
    return res.status(200).json({
      status: 'ONLINE',
      mode: 'VERCEL_SERVERLESS_EPHEMERAL_RELAY',
      multiUser: true,
      activeRooms: rooms.size,
      timestamp: Date.now(),
    });
  }

  // ── POST Actions ──
  if (req.method === 'POST') {
    const body = req.body || {};

    if (action === 'INIT_TERMINAL') {
      if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

      const shopId = sanitizeString(body.shopId, 64) || 'SHOP-VERCEL';
      const shopName = sanitizeString(body.shopName, 128) || 'SafePrint Station';

      let room = rooms.get(roomId);
      if (!room) {
        room = {
          roomId,
          shopId,
          shopName,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          customers: new Map(),
          messages: [],
        };
        rooms.set(roomId, room);
      } else {
        room.shopId = shopId;
        room.shopName = shopName;
        room.lastActivity = Date.now();
      }

      return res.status(200).json({ status: 'OK', roomId });
    }

    if (action === 'JOIN_CUSTOMER') {
      if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

      let room = rooms.get(roomId);
      // Auto create room stub if shop initialized with same roomId
      if (!room) {
        room = {
          roomId,
          shopId: 'SHOP-AUTO',
          shopName: 'SafePrint Express Station',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          customers: new Map(),
          messages: [],
        };
        rooms.set(roomId, room);
      }

      const assignedCustId = customerId || `CUST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const customerName = sanitizeString(body.customerName, 64) || `Customer #${room.customers.size + 1}`;

      room.customers.set(assignedCustId, {
        customerId: assignedCustId,
        customerName,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });
      room.lastActivity = Date.now();

      // Notify Shopkeeper Terminal
      room.messages.push({
        id: Math.random().toString(36).substring(2),
        targetRole: 'SHOP',
        timestamp: Date.now(),
        data: {
          type: 'CUSTOMER_CONNECTED',
          customerId: assignedCustId,
          customerName,
          totalCustomers: room.customers.size,
          timestamp: Date.now(),
        },
      });

      return res.status(200).json({
        status: 'OK',
        customerId: assignedCustId,
        shopName: room.shopName,
        shopId: room.shopId,
      });
    }

    if (action === 'SEND_MESSAGE') {
      if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

      const { targetRole, targetCustomerId, message } = body;
      let room = rooms.get(roomId);
      if (!room) {
        room = {
          roomId,
          shopId: 'SHOP-AUTO',
          shopName: 'SafePrint Express Station',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          customers: new Map(),
          messages: [],
        };
        rooms.set(roomId, room);
      }

      room.lastActivity = Date.now();
      room.messages.push({
        id: Math.random().toString(36).substring(2),
        targetRole: targetRole || 'SHOP',
        targetCustomerId,
        timestamp: Date.now(),
        data: message,
      });

      if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
        room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
      }

      return res.status(200).json({ status: 'SENT' });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  // ── GET Actions ──
  if (req.method === 'GET') {
    if (action === 'POLL') {
      if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

      const role = req.query.role as 'SHOP' | 'CUSTOMER';
      const custId = req.query.customerId as string | undefined;
      const since = parseInt((req.query.since as string) || '0', 10);

      const room = rooms.get(roomId);
      if (!room) {
        return res.status(200).json({ messages: [], timestamp: Date.now() });
      }

      room.lastActivity = Date.now();

      const newMessages = room.messages.filter((m) => {
        if (m.timestamp <= since) return false;
        if (role === 'SHOP') return m.targetRole === 'SHOP';
        if (role === 'CUSTOMER') {
          return m.targetRole === 'CUSTOMER' && (!m.targetCustomerId || m.targetCustomerId === custId);
        }
        return false;
      });

      return res.status(200).json({
        messages: newMessages.map((m) => m.data),
        timestamp: Date.now(),
      });
    }
  }

  return res.status(200).json({ status: 'ONLINE', service: 'SafePrint Ephemeral Relay' });
}
