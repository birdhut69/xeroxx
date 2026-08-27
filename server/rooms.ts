import { WebSocket } from 'ws';

export interface CustomerSession {
  customerId: string;
  customerName: string;
  connectedAt: number;
  socket: WebSocket;
  status: 'CONNECTED' | 'STREAMING' | 'RECEIVED' | 'PRINTING' | 'PRINTED' | 'SHREDDED';
}

export interface RoomSession {
  roomId: string;
  shopId: string;
  shopName: string;
  createdAt: number;
  lastActivity: number;
  shopSocket: WebSocket | null;
  customers: Map<string, CustomerSession>;
}

export class RoomManager {
  private rooms: Map<string, RoomSession> = new Map();

  constructor() {
    setInterval(() => this.cleanupExpiredRooms(), 120000);
  }

  public createRoom(roomId: string, shopId: string, shopName: string, shopSocket: WebSocket): RoomSession {
    let session = this.rooms.get(roomId);
    if (session) {
      session.shopSocket = shopSocket;
      session.shopId = shopId;
      session.shopName = shopName;
      session.lastActivity = Date.now();
    } else {
      session = {
        roomId,
        shopId,
        shopName: shopName || 'Xerox Station',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        shopSocket,
        customers: new Map(),
      };
      this.rooms.set(roomId, session);
    }
    console.log(`[SafePrint] Terminal registered: ${roomId} (${shopName})`);
    return session;
  }

  public getRoom(roomId: string): RoomSession | undefined {
    return this.rooms.get(roomId);
  }

  public joinCustomer(
    roomId: string,
    customerId: string,
    customerName: string,
    customerSocket: WebSocket
  ): boolean {
    const session = this.rooms.get(roomId);
    if (!session || !session.shopSocket) {
      return false;
    }

    const customer: CustomerSession = {
      customerId,
      customerName: customerName || `Customer #${session.customers.size + 1}`,
      connectedAt: Date.now(),
      socket: customerSocket,
      status: 'CONNECTED',
    };

    session.customers.set(customerId, customer);
    session.lastActivity = Date.now();

    // Notify shopkeeper terminal of new customer
    if (session.shopSocket.readyState === WebSocket.OPEN) {
      session.shopSocket.send(
        JSON.stringify({
          type: 'CUSTOMER_CONNECTED',
          customerId,
          customerName: customer.customerName,
          totalCustomers: session.customers.size,
          timestamp: Date.now(),
        })
      );
    }

    // Notify customer that they are paired to the shop
    if (customerSocket.readyState === WebSocket.OPEN) {
      customerSocket.send(
        JSON.stringify({
          type: 'CONNECTED_TO_SHOP',
          shopName: session.shopName,
          shopId: session.shopId,
          customerId,
          timestamp: Date.now(),
        })
      );
    }

    console.log(`[SafePrint] Customer ${customerId} (${customer.customerName}) joined room ${roomId}`);
    return true;
  }

  public removeCustomer(roomId: string, customerId: string) {
    const session = this.rooms.get(roomId);
    if (!session) return;
    session.customers.delete(customerId);
    if (session.shopSocket && session.shopSocket.readyState === WebSocket.OPEN) {
      session.shopSocket.send(
        JSON.stringify({
          type: 'CUSTOMER_LEFT',
          customerId,
          totalCustomers: session.customers.size,
          timestamp: Date.now(),
        })
      );
    }
  }

  public touch(roomId: string) {
    const session = this.rooms.get(roomId);
    if (session) session.lastActivity = Date.now();
  }

  public closeRoom(roomId: string, reason: string = 'SESSION_ENDED') {
    const session = this.rooms.get(roomId);
    if (!session) return;

    const payload = JSON.stringify({ type: 'ROOM_CLOSED', reason, timestamp: Date.now() });
    if (session.shopSocket && session.shopSocket.readyState === WebSocket.OPEN) {
      session.shopSocket.send(payload);
    }
    for (const cust of session.customers.values()) {
      if (cust.socket.readyState === WebSocket.OPEN) {
        cust.socket.send(payload);
      }
    }
    this.rooms.delete(roomId);
  }

  private cleanupExpiredRooms() {
    const now = Date.now();
    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes max lifetime
    for (const [roomId, session] of this.rooms.entries()) {
      if (now - session.lastActivity > TIMEOUT_MS) {
        this.closeRoom(roomId, 'EXPIRED_INACTIVITY');
      }
    }
  }
}
