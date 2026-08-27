import Peer, { DataConnection } from 'peerjs';

export interface RelaySocketCallbacks {
  onOpen?: () => void;
  onClose?: (reason: string) => void;
  onError?: (err: any) => void;
  onCustomerConnected?: (data: { customerId: string; customerName: string; totalCustomers: number; timestamp: number }) => void;
  onCustomerLeft?: (data: { customerId: string; totalCustomers: number; timestamp: number }) => void;
  onConnectedToShop?: (data: { shopName: string; shopId: string; customerId: string; timestamp: number }) => void;
  onDocPayload?: (data: { customerId: string; customerName?: string; metadata: any; iv: number[]; docHash: string; ciphertextBase64: string; timestamp: number }) => void;
  onPrintStatus?: (data: { status: string; pagesPrinted: number; copies: number }) => void;
  onShredConfirmed?: (data: { certificate: any; ledgerBlock: any }) => void;
}

export class RelaySocket {
  private callbacks: RelaySocketCallbacks = {};
  private role: 'SHOP' | 'CUSTOMER' | null = null;
  private activeRoomId: string | null = null;
  private activeCustomerId: string | null = null;
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private customerConnection: DataConnection | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private pollInterval: any = null;
  private lastPollTimestamp: number = 0;
  private shopInfo: { shopName: string; shopId: string } = { shopName: 'SafePrint Station', shopId: '' };
  private isPeerInitialized: boolean = false;

  constructor() {
    try {
      this.broadcastChannel = new BroadcastChannel('safeprint_local_relay');
      this.broadcastChannel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch {
      // BroadcastChannel fallback
    }
  }

  public connect(callbacks: RelaySocketCallbacks): Promise<void> {
    this.callbacks = callbacks;
    return new Promise((resolve) => {
      this.callbacks.onOpen?.();
      resolve();
    });
  }

  public initShopTerminal(roomId: string, shopId: string, shopName: string) {
    if (this.isPeerInitialized && this.activeRoomId === roomId && this.role === 'SHOP') {
      return;
    }

    this.role = 'SHOP';
    this.activeRoomId = roomId;
    this.shopInfo = { shopName, shopId };
    this.isPeerInitialized = true;

    const peerId = `safeprint-shop-${roomId.replace(/[^a-zA-Z0-9]/g, '')}`;

    try {
      if (this.peer) {
        try { this.peer.destroy(); } catch {}
        this.peer = null;
      }

      this.peer = new Peer(peerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', (id) => {
        console.log(`[SafePrint WebRTC] Shop Terminal Online: ${id}`);
        this.callbacks.onOpen?.();
      });

      this.peer.on('connection', (conn) => {
        const custId = conn.peer.replace('safeprint-cust-', '');
        this.connections.set(custId, conn);

        conn.on('open', () => {
          conn.send({
            type: 'CONNECTED_TO_SHOP',
            shopName: this.shopInfo.shopName,
            shopId: this.shopInfo.shopId,
            customerId: custId,
            timestamp: Date.now(),
          });
        });

        conn.on('data', (data: any) => {
          this.handleMessage(data);
        });

        conn.on('close', () => {
          this.connections.delete(custId);
          this.callbacks.onCustomerLeft?.({
            customerId: custId,
            totalCustomers: this.connections.size,
            timestamp: Date.now(),
          });
        });
      });

      this.peer.on('error', (err) => {
        console.warn('[SafePrint WebRTC] Peer event:', err.type);
      });
    } catch (err) {
      console.warn('[SafePrint] WebRTC init note:', err);
    }

    this.startServerlessPolling();
  }

  public joinCustomerToShop(roomId: string, customerId: string, customerName: string) {
    if (this.isPeerInitialized && this.activeRoomId === roomId && this.role === 'CUSTOMER') {
      return;
    }

    this.role = 'CUSTOMER';
    this.activeRoomId = roomId;
    this.activeCustomerId = customerId;
    this.isPeerInitialized = true;

    const shopPeerId = `safeprint-shop-${roomId.replace(/[^a-zA-Z0-9]/g, '')}`;
    const myPeerId = `safeprint-cust-${customerId.replace(/[^a-zA-Z0-9]/g, '')}`;

    try {
      if (this.peer) {
        try { this.peer.destroy(); } catch {}
        this.peer = null;
      }

      this.peer = new Peer(myPeerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', () => {
        const conn = this.peer!.connect(shopPeerId, { reliable: true });
        this.customerConnection = conn;

        conn.on('open', () => {
          console.log('[SafePrint WebRTC] Direct P2P Channel to Shopkeeper online');
          conn.send({
            type: 'CUSTOMER_CONNECTED',
            customerId,
            customerName,
            timestamp: Date.now(),
          });
        });

        conn.on('data', (data: any) => {
          this.handleMessage(data);
        });
      });

      this.peer.on('error', (err) => {
        console.warn('[SafePrint WebRTC] Customer peer event:', err.type);
      });
    } catch (err) {
      console.warn('[SafePrint] Customer WebRTC init note:', err);
    }

    this.startServerlessPolling();

    this.broadcastChannel?.postMessage({
      type: 'CUSTOMER_CONNECTED',
      customerId,
      customerName,
      timestamp: Date.now(),
    });
  }

  private startServerlessPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      if (!this.activeRoomId || !this.role) return;
      try {
        const custParam = this.activeCustomerId ? `&customerId=${encodeURIComponent(this.activeCustomerId)}` : '';
        const res = await fetch(
          `/api/relay?action=POLL&roomId=${encodeURIComponent(this.activeRoomId)}&role=${this.role}${custParam}&since=${this.lastPollTimestamp}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.timestamp) this.lastPollTimestamp = data.timestamp;
          if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              this.handleMessage(msg);
            }
          }
        }
      } catch {
        // quiet fallback
      }
    }, 500);
  }

  private handleMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'CUSTOMER_CONNECTED':
        this.callbacks.onCustomerConnected?.(msg);
        break;
      case 'CUSTOMER_LEFT':
        this.callbacks.onCustomerLeft?.(msg);
        break;
      case 'CONNECTED_TO_SHOP':
        if (msg.customerId) this.activeCustomerId = msg.customerId;
        this.callbacks.onConnectedToShop?.(msg);
        break;
      case 'DOC_PAYLOAD':
        this.callbacks.onDocPayload?.(msg);
        break;
      case 'PRINT_STATUS_UPDATE':
        this.callbacks.onPrintStatus?.(msg);
        break;
      case 'SHRED_CONFIRMED':
        this.callbacks.onShredConfirmed?.(msg);
        break;
    }
  }

  public send(msg: any) {
    if (msg.roomId) this.activeRoomId = msg.roomId;
    if (msg.customerId) this.activeCustomerId = msg.customerId;

    if (msg.type === 'INIT_TERMINAL') {
      this.initShopTerminal(msg.roomId, msg.shopId, msg.shopName);
    } else if (msg.type === 'JOIN_CUSTOMER') {
      this.joinCustomerToShop(msg.roomId, msg.customerId, msg.customerName);
    }

    // 1. Direct WebRTC
    if (this.role === 'CUSTOMER' && this.customerConnection && this.customerConnection.open) {
      this.customerConnection.send(msg);
    } else if (this.role === 'SHOP' && msg.customerId) {
      const conn = this.connections.get(msg.customerId);
      if (conn && conn.open) {
        conn.send(msg);
      }
    }

    // 2. BroadcastChannel
    try {
      this.broadcastChannel?.postMessage(msg);
    } catch {}

    // 3. Serverless HTTP
    if (this.activeRoomId) {
      const targetRole = this.role === 'SHOP' ? 'CUSTOMER' : 'SHOP';
      fetch('/api/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SEND_MESSAGE',
          roomId: this.activeRoomId,
          targetRole,
          targetCustomerId: msg.customerId,
          message: msg,
        }),
      }).catch(() => {});
    }
  }

  public async sendEncryptedPayload(
    roomId: string,
    customerId: string,
    customerName: string,
    encryptedBuffer: ArrayBuffer,
    iv: Uint8Array,
    docHash: string,
    metadata: any,
    onProgress?: (progress: number) => void
  ) {
    onProgress?.(30);

    const bytes = new Uint8Array(encryptedBuffer);
    let binary = '';
    const sliceSize = 32768;
    for (let i = 0; i < bytes.length; i += sliceSize) {
      const slice = bytes.subarray(i, i + sliceSize);
      binary += String.fromCharCode.apply(null, Array.from(slice));
      if (bytes.length > 500000 && i % (sliceSize * 4) === 0) {
        onProgress?.(Math.min(80, Math.round((i / bytes.length) * 80)));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    const b64Data = btoa(binary);

    onProgress?.(90);

    const payload = {
      type: 'DOC_PAYLOAD',
      roomId,
      customerId,
      customerName,
      metadata,
      iv: Array.from(iv),
      docHash,
      ciphertextBase64: b64Data,
      timestamp: Date.now(),
    };

    this.send(payload);
    onProgress?.(100);
  }

  public close() {
    this.isPeerInitialized = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
  }
}
