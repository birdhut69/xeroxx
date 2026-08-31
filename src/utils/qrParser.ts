/**
 * Universal QR code & Session URL parser for CipherPrint
 * Robustly extracts roomId and keyHex across all URL formats, hash variations, and query parameters.
 */
export interface ParsedSession {
  roomId: string;
  keyHex: string;
}

export function parseSessionUrl(rawText: string): ParsedSession | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();

  let room = '';
  let keyHex = '';

  // 1. Try URL parser
  try {
    const url = text.startsWith('http://') || text.startsWith('https://')
      ? new URL(text)
      : new URL(text, window.location.origin);

    // Try search parameters
    room = url.searchParams.get('room') || '';
    keyHex = url.searchParams.get('key') || '';

    // Try hash parameters (#key=... or #room=...&key=...)
    if (url.hash) {
      const cleanHash = url.hash.replace(/^[#/]+/, '');
      const hashParams = new URLSearchParams(cleanHash);

      if (!room && hashParams.get('room')) {
        room = hashParams.get('room') || '';
      }
      if (!keyHex && hashParams.get('key')) {
        keyHex = hashParams.get('key') || '';
      }

      // Fallback manual hash slicing
      if (!keyHex && cleanHash.includes('key=')) {
        keyHex = cleanHash.split('key=')[1]?.split('&')[0]?.split('#')[0] || '';
      }
      if (!room && cleanHash.includes('room=')) {
        room = cleanHash.split('room=')[1]?.split('&')[0]?.split('#')[0] || '';
      }
    }
  } catch {
    // If URL parsing fails, continue to regex fallback
  }

  // 2. Regex matching on raw string
  if (!room) {
    const roomMatch = text.match(/[?&#/]room=([a-zA-Z0-9_\-]+)/i);
    if (roomMatch) room = roomMatch[1];
  }
  if (!keyHex) {
    const keyMatch = text.match(/[?&#/]key=([a-zA-Z0-9_\-]+)/i);
    if (keyMatch) keyHex = keyMatch[1];
  }

  // 3. Fallback: "ROOM#key=HEX" or "/#room=ROOM&key=HEX"
  if (!room && text.includes('#key=')) {
    const parts = text.split('#key=');
    const pathPart = parts[0].replace(/^.*\//, '').replace(/^[?&]/, '');
    if (pathPart) room = pathPart;
    keyHex = parts[1]?.split('&')[0] || '';
  }

  if (room && keyHex) {
    return {
      roomId: decodeURIComponent(room.trim()),
      keyHex: decodeURIComponent(keyHex.trim()),
    };
  }

  return null;
}
