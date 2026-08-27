export interface RelaySocketCallbacks {
  onOpen?: () => void;
  onClose?: (reason: string) => void;
  onError?: (err: any) => void;
  onCustomerConnected?: (data: { timestamp: number }) => void;
  onConnectedToShop?: (data: { shopName: string; shopId: string; timestamp: number }) => void;
  onDocMeta?: (data: { metadata: any; iv: number[]; docHash: string; timestamp: number }) => void;
  onDocChunk?: (data: { chunkIndex: number; totalChunks: number; data: string }) => void;
  onDocComplete?: () => void;
  onPrintStatus?: (data: { status: string; pagesPrinted: number; copies: number }) => void;
  onShredConfirmed?: (data: { certificate: any; ledgerBlock: any }) => void;
}

export class RelaySocket {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: RelaySocketCallbacks = {};
  private pingInterval: any = null;
  private useServerlessFallback: boolean = false;
  private pollInterval: any = null;
  private lastPollTimestamp: number = 0;
  private role: 'SHOP' | 'CUSTOMER' | null = null;
  private activeRoomId: string | null = null;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = window.location.port === '5173' ? '8080' : window.location.port || '8080';
      this.url = `${protocol}//${host}:${port}/ws`;
    }
  }

  public connect(callbacks: RelaySocketCallbacks): Promise<void> {
    this.callbacks = callbacks;
    return new Promise((resolve) => {
      try {
        console.log(`[SafePrint RelaySocket] Connecting to: ${this.url}`);
        this.ws = new WebSocket(this.url);

        let resolved = false;

        this.ws.onopen = () => {
          console.log('[SafePrint RelaySocket] WebSocket connection established');
          resolved = true;
          this.startHeartbeat();
          if (this.callbacks.onOpen) this.callbacks.onOpen();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch (err) {
            console.error('[SafePrint RelaySocket] Message parse error:', err);
          }
        };

        this.ws.onclose = () => {
          this.stopHeartbeat();
          if (!resolved) {
            // Activate Serverless Fallback
            this.activateServerlessFallback();
            resolve();
          }
        };

        this.ws.onerror = () => {
          if (!resolved) {
            this.activateServerlessFallback();
            resolve();
          }
        };

        // If WS doesn't connect within 2.5s, activate serverless fallback
        setTimeout(() => {
          if (!resolved) {
            this.activateServerlessFallback();
            resolve();
          }
        }, 2500);
      } catch (e) {
        this.activateServerlessFallback();
        resolve();
      }
    });
  }

  private activateServerlessFallback() {
    if (this.useServerlessFallback) return;
    this.useServerlessFallback = true;
    console.log('[SafePrint Relay] Activating Vercel Serverless Ephemeral Relay Fallback');
    if (this.callbacks.onOpen) this.callbacks.onOpen();
  }

  private startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      if (!this.activeRoomId || !this.role) return;
      try {
        const res = await fetch(
          `/api/relay?action=POLL&roomId=${encodeURIComponent(this.activeRoomId)}&role=${this.role}&since=${this.lastPollTimestamp}`
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
        // quiet poll errors
      }
    }, 800);
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'CUSTOMER_CONNECTED':
        this.callbacks.onCustomerConnected?.(msg);
        break;
      case 'CONNECTED_TO_SHOP':
        this.callbacks.onConnectedToShop?.(msg);
        break;
      case 'DOC_META':
        this.callbacks.onDocMeta?.(msg);
        break;
      case 'DOC_CHUNK':
        this.callbacks.onDocChunk?.(msg);
        break;
      case 'DOC_COMPLETE':
        this.callbacks.onDocComplete?.();
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

    if (msg.type === 'INIT_TERMINAL') {
      this.role = 'SHOP';
      if (this.useServerlessFallback) {
        this.lastPollTimestamp = Date.now();
        this.startPolling();
        fetch('/api/relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'INIT_TERMINAL',
            roomId: msg.roomId,
            shopId: msg.shopId,
            shopName: msg.shopName
          })
        });
      }
    } else if (msg.type === 'JOIN_CUSTOMER') {
      this.role = 'CUSTOMER';
      if (this.useServerlessFallback) {
        this.lastPollTimestamp = Date.now();
        this.startPolling();
        fetch('/api/relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'JOIN_CUSTOMER',
            roomId: msg.roomId
          })
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.status === 'OK') {
              this.callbacks.onConnectedToShop?.({
                shopName: data.shopName,
                shopId: data.shopId,
                timestamp: Date.now()
              });
            }
          });
      }
    }

    if (!this.useServerlessFallback && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (this.useServerlessFallback && this.activeRoomId) {
      const targetRole = this.role === 'SHOP' ? 'CUSTOMER' : 'SHOP';
      fetch('/api/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SEND_MESSAGE',
          roomId: this.activeRoomId,
          targetRole,
          message: msg
        })
      });
    }
  }

  public async sendEncryptedChunks(
    roomId: string,
    encryptedBuffer: ArrayBuffer,
    iv: Uint8Array,
    docHash: string,
    metadata: any,
    onProgress?: (progress: number) => void
  ) {
    // 1. Send DOC_META
    this.send({
      type: 'DOC_META',
      roomId,
      metadata,
      iv: Array.from(iv),
      docHash
    });

    // 2. Chunk buffer into 64KB slices
    const CHUNK_SIZE = 64 * 1024;
    const uint8View = new Uint8Array(encryptedBuffer);
    const totalChunks = Math.ceil(uint8View.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, uint8View.length);
      const chunkBytes = uint8View.subarray(start, end);

      let binary = '';
      for (let j = 0; j < chunkBytes.length; j++) {
        binary += String.fromCharCode(chunkBytes[j]);
      }
      const b64Data = btoa(binary);

      this.send({
        type: 'DOC_CHUNK',
        roomId,
        chunkIndex: i,
        totalChunks,
        data: b64Data
      });

      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      if (totalChunks > 5 && i % 5 === 0) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    // 3. Send DOC_COMPLETE
    this.send({
      type: 'DOC_COMPLETE',
      roomId
    });
  }

  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'PING' });
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public close() {
    this.stopHeartbeat();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
