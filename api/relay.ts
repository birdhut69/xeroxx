import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Ephemeral In-Memory Relay for Serverless Environments ──
// All data is held strictly in memory — no disk, no database, no persistence.
// Rooms auto-expire after 15 minutes of inactivity.

interface EphemeralMessage {
  id: string;
  targetRole: 'SHOP' | 'CUSTOMER';
  timestamp: number;
  data: Record<string, unknown>;
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
const MAX_ROOMS = 500;
const MAX_MESSAGES_PER_ROOM = 200;
const ROOM_TTL_MS = 15 * 60 * 1000; // 15 min
const MAX_MESSAGE_SIZE = 512 * 1024; // 512 KB per message

// Auto purge stale rooms
function cleanup() {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.lastActivity > ROOM_TTL_MS) {
      rooms.delete(id);
    }
  }
}

// Basic input validation
function isValidRoomId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 128;
}

function isValidRole(role: unknown): role is 'SHOP' | 'CUSTOMER' {
  return role === 'SHOP' || role === 'CUSTOMER';
}

function sanitizeString(input: unknown, maxLen: number = 256): string {
  if (typeof input !== 'string') return '';
  return input.slice(0, maxLen).replace(/[<>"']/g, '');
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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

  // ── Health Check ──
  if (action === 'health' || (req.method === 'GET' && req.url?.includes('health'))) {
    return res.status(200).json({
      status: 'ONLINE',
      mode: 'VERCEL_SERVERLESS_EPHEMERAL_RELAY',
      persistence: false,
      activeRooms: rooms.size,
      timestamp: Date.now(),
    });
  }

  // ── POST Actions ──
  if (req.method === 'POST') {
    const body = req.body || {};

    // Rate limit: max rooms
    if (action === 'INIT_TERMINAL') {
      if (!isValidRoomId(roomId)) {
        return res.status(400).json({ error: 'Invalid roomId' });
      }
      if (rooms.size >= MAX_ROOMS && !rooms.has(roomId)) {
        return res.status(503).json({ error: 'Server at capacity. Try again later.' });
      }

      const shopId = sanitizeString(body.shopId, 64) || 'SHOP-VERCEL';
      const shopName = sanitizeString(body.shopName, 128) || 'SafePrint Station';

      rooms.set(roomId, {
        roomId,
        shopId,
        shopName,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
      });

      return res.status(200).json({ status: 'OK', roomId });
    }

    if (action === 'JOIN_CUSTOMER') {
      if (!isValidRoomId(roomId)) {
        return res.status(400).json({ error: 'Invalid roomId' });
      }

      const room = rooms.get(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found or expired. Ask shopkeeper for a new QR code.' });
      }

      room.lastActivity = Date.now();
      room.messages.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        targetRole: 'SHOP',
        timestamp: Date.now(),
        data: { type: 'CUSTOMER_CONNECTED', timestamp: Date.now() },
      });

      return res.status(200).json({
        status: 'OK',
        shopName: room.shopName,
        shopId: room.shopId,
      });
    }

    if (action === 'SEND_MESSAGE') {
      if (!isValidRoomId(roomId)) {
        return res.status(400).json({ error: 'Invalid roomId' });
      }

      const { targetRole, message } = body;
      if (!isValidRole(targetRole)) {
        return res.status(400).json({ error: 'Invalid targetRole' });
      }
      if (!message || typeof message !== 'object') {
        return res.status(400).json({ error: 'Invalid message payload' });
      }

      // Size check
      const messageStr = JSON.stringify(message);
      if (messageStr.length > MAX_MESSAGE_SIZE) {
        return res.status(413).json({ error: 'Message too large' });
      }

      const room = rooms.get(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room expired' });
      }

      room.lastActivity = Date.now();
      room.messages.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        targetRole,
        timestamp: Date.now(),
        data: message,
      });

      // Keep only the last N messages per room
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
      if (!isValidRoomId(roomId)) {
        return res.status(400).json({ error: 'Invalid roomId' });
      }

      const role = req.query.role as string;
      if (!isValidRole(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const since = parseInt((req.query.since as string) || '0', 10);
      if (isNaN(since)) {
        return res.status(400).json({ error: 'Invalid since timestamp' });
      }

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
        timestamp: Date.now(),
      });
    }
  }

  return res.status(200).json({ status: 'ONLINE', service: 'SafePrint Serverless Relay' });
}
