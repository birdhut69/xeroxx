import Peer, { DataConnection } from 'peerjs';

export interface RelaySocketCallbacks {
  onOpen?: () => void;
  onClose?: (reason: string) => void;
  onError?: (err: any) => void;
  onCustomerConnected?: (data: { customerId: string; customerName: string; totalCustomers: number; timestamp: number }) => void;
  onCustomerLeft?: (data: { customerId: string; totalCustomers: number; timestamp: number }) => void;
  onConnectedToShop?: (data: {
    shopName: string;
    shopId: string;
    customerId: string;
    timestamp: number;
    upiId?: string;
    bwRate?: number;
    colorRate?: number;
  }) => void;
  onDocPayload?: (data: { customerId: string; customerName?: string; metadata: any; iv: number[]; docHash: string; ciphertextBase64: string; timestamp: number }) => void;
  onPrintStatus?: (data: { status: string; pagesPrinted: number; copies: number }) => void;
  onShredConfirmed?: (data: { certificate: any; ledgerBlock: any }) => void;
  onChatMessage?: (data: {
    id: string;
    sender: 'CUSTOMER' | 'SHOP';
    text?: string;
    voiceBase64?: string;
    customerId: string;
    customerName?: string;
    timestamp: number;
  }) => void;
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
  private chunkAssemblyMap: Map<string, { chunks: string[]; total: number; meta: any; iv: number[]; custId: string; custName?: string }> = new Map();

  private ws: WebSocket | null = null;
  private wsConnected: boolean = false;

  constructor() {
    try {
      this.broadcastChannel = new BroadcastChannel('safeprint_local_relay');
      this.broadcastChannel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch {
      // BroadcastChannel fallback
    }
    this.initWebSocket();
  }

  private initWebSocket() {
    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'localhost:8080'
        : window.location.host;
      
      const wsUrl = `${wsProtocol}//${host}/ws`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        this.ws = socket;
        this.wsConnected = true;
        console.log('[SafePrint WebSocket] Connected to local relay server');

        // Re-register if role and roomId already set
        if (this.role === 'SHOP' && this.activeRoomId) {
          socket.send(
            JSON.stringify({
              type: 'INIT_TERMINAL',
              roomId: this.activeRoomId,
              shopId: this.shopInfo.shopId,
              shopName: this.shopInfo.shopName,
            })
          );
        } else if (this.role === 'CUSTOMER' && this.activeRoomId && this.activeCustomerId) {
          socket.send(
            JSON.stringify({
              type: 'JOIN_CUSTOMER',
              roomId: this.activeRoomId,
              customerId: this.activeCustomerId,
              customerName: 'Customer',
            })
          );
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch {}
      };

      socket.onclose = () => {
        this.ws = null;
        this.wsConnected = false;
        // Auto-reconnect after 2.5 seconds
        setTimeout(() => {
          if (!this.ws && (this.activeRoomId || this.role)) {
            this.initWebSocket();
          }
        }, 2500);
      };

      socket.onerror = () => {
        this.ws = null;
        this.wsConnected = false;
      };
    } catch {
      // WebSocket optional fallback
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
        console.warn('[SafePrint WebRTC] Peer note:', err.type);
      });
    } catch (err) {
      console.warn('[SafePrint] WebRTC init note:', err);
    }

    this.startServerlessPolling();

    // Register with Serverless endpoint
    fetch('/api/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'INIT_TERMINAL',
        roomId,
        shopId,
        shopName,
      }),
    }).catch(() => {});
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
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', () => {
        const conn = this.peer!.connect(shopPeerId, { reliable: true });
        this.customerConnection = conn;

        conn.on('open', () => {
          console.log('[SafePrint WebRTC] Direct P2P Channel to Shop online');
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

    // Register customer with Serverless endpoint
    fetch('/api/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'JOIN_CUSTOMER',
        roomId,
        customerId,
        customerName,
      }),
    }).catch(() => {});
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
    }, 450);
  }

  private processedMessageIds: Set<string> = new Set();
  private processedDocHashes: Set<string> = new Set();

  private handleMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;

    // Deduplicate by explicit message ID if present
    if (msg.id) {
      if (this.processedMessageIds.has(msg.id)) return;
      this.processedMessageIds.add(msg.id);
      if (this.processedMessageIds.size > 500) {
        const first = this.processedMessageIds.values().next().value;
        if (first) this.processedMessageIds.delete(first);
      }
    }

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
        if (msg.docHash) {
          if (this.processedDocHashes.has(msg.docHash)) return;
          this.processedDocHashes.add(msg.docHash);
        }
        this.callbacks.onDocPayload?.(msg);
        break;
      case 'DOC_PAYLOAD_CHUNK':
        this.handlePayloadChunk(msg);
        break;
      case 'PRINT_STATUS_UPDATE':
        this.callbacks.onPrintStatus?.(msg);
        break;
      case 'SHRED_CONFIRMED':
        this.callbacks.onShredConfirmed?.(msg);
        break;
      case 'CHAT_MESSAGE':
        this.callbacks.onChatMessage?.(msg);
        break;
    }
  }

  private handlePayloadChunk(msg: any) {
    const key = `${msg.customerId}_${msg.docHash}`;
    
    // If this full docHash was already completed and dispatched, skip any redundant chunks
    if (this.processedDocHashes.has(msg.docHash)) return;

    let assembly = this.chunkAssemblyMap.get(key);
    if (!assembly) {
      assembly = {
        chunks: new Array(msg.totalChunks),
        total: msg.totalChunks,
        meta: msg.metadata,
        iv: msg.iv,
        custId: msg.customerId,
        custName: msg.customerName,
      };
      this.chunkAssemblyMap.set(key, assembly);
    }

    assembly.chunks[msg.chunkIndex] = msg.chunkData;

    // Check if all chunks received
    let complete = true;
    for (let i = 0; i < assembly.total; i++) {
      if (!assembly.chunks[i]) {
        complete = false;
        break;
      }
    }

    if (complete) {
      const fullBase64 = assembly.chunks.join('');
      this.chunkAssemblyMap.delete(key);
      this.processedDocHashes.add(msg.docHash);

      this.callbacks.onDocPayload?.({
        customerId: assembly.custId,
        customerName: assembly.custName,
        metadata: assembly.meta,
        iv: assembly.iv,
        docHash: msg.docHash,
        ciphertextBase64: fullBase64,
        timestamp: Date.now(),
      });
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

    // 1. WebSocket Relay
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        console.warn('[SafePrint WebSocket] Send note:', err);
      }
    }

    // 2. Direct WebRTC
    if (this.role === 'CUSTOMER' && this.customerConnection && this.customerConnection.open) {
      try {
        this.customerConnection.send(msg);
      } catch (err) {
        console.warn('[SafePrint WebRTC] Send note:', err);
      }
    } else if (this.role === 'SHOP' && msg.customerId) {
      const conn = this.connections.get(msg.customerId);
      if (conn && conn.open) {
        try {
          conn.send(msg);
        } catch (err) {
          console.warn('[SafePrint WebRTC] Shop send note:', err);
        }
      }
    }

    // 3. BroadcastChannel (Same browser instant inter-tab)
    try {
      this.broadcastChannel?.postMessage(msg);
    } catch {}

    // 4. Serverless HTTP
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
    onProgress?.(15);

    // Fast binary to base64 conversion
    const bytes = new Uint8Array(encryptedBuffer);
    let binary = '';
    const sliceSize = 32768;
    for (let i = 0; i < bytes.length; i += sliceSize) {
      const slice = bytes.subarray(i, i + sliceSize);
      binary += String.fromCharCode.apply(null, Array.from(slice));
      if (bytes.length > 500000 && i % (sliceSize * 4) === 0) {
        onProgress?.(Math.min(50, Math.round((i / bytes.length) * 50)));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    const b64Data = btoa(binary);

    onProgress?.(55);

    // Chunk base64 into safe 48KB pieces to avoid WebRTC buffer overflow and HTTP limits
    const CHUNK_SIZE = 48 * 1024;
    const totalChunks = Math.ceil(b64Data.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, b64Data.length);
      const chunkStr = b64Data.substring(start, end);

      const chunkMsg = {
        type: 'DOC_PAYLOAD_CHUNK',
        roomId,
        customerId,
        customerName,
        metadata,
        iv: Array.from(iv),
        docHash,
        chunkIndex: i,
        totalChunks,
        chunkData: chunkStr,
        timestamp: Date.now(),
      };

      this.send(chunkMsg);

      const percent = Math.min(99, Math.round(55 + ((i + 1) / totalChunks) * 44));
      onProgress?.(percent);

      if (totalChunks > 1) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }

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
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
      this.wsConnected = false;
    }
  }
}
