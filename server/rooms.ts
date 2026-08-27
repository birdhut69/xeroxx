import { WebSocket } from 'ws';

export interface RoomSession {
  roomId: string;
  shopId: string;
  shopName: string;
  createdAt: number;
  lastActivity: number;
  shopSocket: WebSocket | null;
  customerSocket: WebSocket | null;
  status: 'IDLE' | 'CONNECTED' | 'STREAMING' | 'RECEIVED' | 'PRINTING' | 'SHREDDED';
  metadata?: {
    filename?: string;
    fileType?: string;
    fileSize?: number;
    pageCount?: number;
    docHash?: string;
  };
}

export class RoomManager {
  private rooms: Map<string, RoomSession> = new Map();

  constructor() {
    // In-memory periodic cleanup of abandoned rooms (every 2 minutes)
    setInterval(() => this.cleanupExpiredRooms(), 120000);
  }

  public createRoom(roomId: string, shopId: string, shopName: string, shopSocket: WebSocket): RoomSession {
    // If existing room exists, clean it up
    if (this.rooms.has(roomId)) {
      this.closeRoom(roomId, 'RECREATED');
    }

    const session: RoomSession = {
      roomId,
      shopId,
      shopName: shopName || 'Xerox Terminal #1',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      shopSocket,
      customerSocket: null,
      status: 'IDLE'
    };

    this.rooms.set(roomId, session);
    console.log(`[SafePrint RoomManager] Created ephemeral room: ${roomId} (Shop: ${shopName})`);
    return session;
  }

  public getRoom(roomId: string): RoomSession | undefined {
    return this.rooms.get(roomId);
  }

  public joinCustomer(roomId: string, customerSocket: WebSocket): boolean {
    const session = this.rooms.get(roomId);
    if (!session || !session.shopSocket) {
      return false;
    }

    session.customerSocket = customerSocket;
    session.status = 'CONNECTED';
    session.lastActivity = Date.now();

    // Notify shopkeeper terminal
    if (session.shopSocket.readyState === WebSocket.OPEN) {
      session.shopSocket.send(JSON.stringify({
        type: 'CUSTOMER_CONNECTED',
        timestamp: Date.now()
      }));
    }

    // Notify customer
    if (customerSocket.readyState === WebSocket.OPEN) {
      customerSocket.send(JSON.stringify({
        type: 'CONNECTED_TO_SHOP',
        shopName: session.shopName,
        shopId: session.shopId,
        timestamp: Date.now()
      }));
    }

    console.log(`[SafePrint RoomManager] Customer paired to room: ${roomId}`);
    return true;
  }

  public touch(roomId: string) {
    const session = this.rooms.get(roomId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  public updateStatus(roomId: string, status: RoomSession['status'], metadata?: any) {
    const session = this.rooms.get(roomId);
    if (session) {
      session.status = status;
      session.lastActivity = Date.now();
      if (metadata) {
        session.metadata = { ...session.metadata, ...metadata };
      }
    }
  }

  public closeRoom(roomId: string, reason: string = 'SESSION_ENDED') {
    const session = this.rooms.get(roomId);
    if (!session) return;

    console.log(`[SafePrint RoomManager] Closing room ${roomId} - Reason: ${reason}`);

    const closePayload = JSON.stringify({
      type: 'ROOM_CLOSED',
      reason,
      timestamp: Date.now()
    });

    if (session.shopSocket && session.shopSocket.readyState === WebSocket.OPEN) {
      session.shopSocket.send(closePayload);
    }
    if (session.customerSocket && session.customerSocket.readyState === WebSocket.OPEN) {
      session.customerSocket.send(closePayload);
    }

    this.rooms.delete(roomId);
  }

  private cleanupExpiredRooms() {
    const now = Date.now();
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes max lifetime

    for (const [roomId, session] of this.rooms.entries()) {
      if (now - session.lastActivity > TIMEOUT_MS) {
        console.log(`[SafePrint RoomManager] Expiring stale room: ${roomId}`);
        this.closeRoom(roomId, 'EXPIRED_INACTIVITY');
      }
    }
  }
}
