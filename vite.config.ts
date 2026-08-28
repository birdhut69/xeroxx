import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'embedded-relay-mock',
      configureServer(server) {
        const localRooms = new Map<string, any>();
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api/relay')) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');

            const url = new URL(req.url, `http://${req.headers.host}`);
            const action = url.searchParams.get('action');
            const roomId = url.searchParams.get('roomId');

            if (req.method === 'GET' && action === 'health') {
              return res.end(JSON.stringify({ status: 'ONLINE', timestamp: Date.now() }));
            }

            if (req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => (body += chunk));
              req.on('end', () => {
                try {
                  const data = JSON.parse(body || '{}');
                  const targetRoomId = data.roomId || roomId;
                  if (!targetRoomId) return res.end(JSON.stringify({ error: 'No roomId' }));

                  let room = localRooms.get(targetRoomId);
                  if (!room) {
                    room = { messages: [] };
                    localRooms.set(targetRoomId, room);
                  }

                  if (data.action === 'SEND_MESSAGE' && data.message) {
                    room.messages.push({
                      timestamp: Date.now(),
                      targetRole: data.targetRole,
                      targetCustomerId: data.targetCustomerId,
                      data: data.message,
                    });
                    if (room.messages.length > 500) room.messages.shift();
                  }
                  return res.end(JSON.stringify({ status: 'OK' }));
                } catch {
                  return res.end(JSON.stringify({ error: 'Bad JSON' }));
                }
              });
              return;
            }

            if (req.method === 'GET' && action === 'POLL' && roomId) {
              const role = url.searchParams.get('role');
              const since = parseInt(url.searchParams.get('since') || '0', 10);
              const room = localRooms.get(roomId);
              if (!room) return res.end(JSON.stringify({ messages: [], timestamp: Date.now() }));

              const newMsgs = room.messages.filter((m: any) => {
                if (m.timestamp <= since) return false;
                if (role === 'SHOP') return m.targetRole === 'SHOP';
                if (role === 'CUSTOMER') return m.targetRole === 'CUSTOMER';
                return false;
              });

              return res.end(JSON.stringify({
                messages: newMsgs.map((m: any) => m.data),
                timestamp: Date.now(),
              }));
            }

            return res.end(JSON.stringify({ status: 'ONLINE' }));
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-engine': ['pdfjs-dist'],
          'react-vendor': ['react', 'react-dom'],
          'ui-icons': ['lucide-react', 'qrcode.react']
        }
      }
    }
  }
});
