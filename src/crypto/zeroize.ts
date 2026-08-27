/**
 * SafePrint Hardware & RAM Memory Zeroization Engine
 * Actively overwrites buffer memory with pseudorandom noise and zeros before deallocation
 */

export function zeroizeBuffer(buffer: ArrayBuffer | Uint8Array | Uint8ClampedArray | null): void {
  if (!buffer) return;

  try {
    let view: Uint8Array;
    if (buffer instanceof ArrayBuffer) {
      view = new Uint8Array(buffer);
    } else if (buffer instanceof Uint8Array) {
      view = buffer;
    } else {
      view = new Uint8Array(buffer.buffer);
    }

    // Step 1: Overwrite with cryptographic random noise
    if (view.length > 0 && typeof window !== 'undefined' && window.crypto) {
      try {
        // Chunked random overwrite if length > 65536
        const chunkSize = 65536;
        for (let i = 0; i < view.length; i += chunkSize) {
          const sub = view.subarray(i, Math.min(i + chunkSize, view.length));
          window.crypto.getRandomValues(sub);
        }
      } catch {
        // fallback
      }
    }

    // Step 2: Final zero out
    view.fill(0);
    console.log(`[SafePrint Zeroize] Scrambled & zeroed ${view.length} bytes of document buffer.`);
  } catch (err) {
    console.warn('[SafePrint Zeroize] Buffer zeroization warning:', err);
  }
}

/**
 * Revokes an array of blob / object URLs to prevent browser caching
 */
export function scrubObjectUrls(urls: (string | null | undefined)[]): void {
  urls.forEach(url => {
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
        console.log(`[SafePrint Zeroize] Revoked Blob URL: ${url}`);
      } catch (err) {
        console.warn('[SafePrint Zeroize] Failed to revoke URL:', err);
      }
    }
  });
}

/**
 * Wipes a Canvas context completely to clean GPU/display buffers
 */
export function scrubCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvas.width = 1;
    canvas.height = 1;
    console.log('[SafePrint Zeroize] Scratched and zeroed Canvas rendering pipeline.');
  } catch (err) {
    console.warn('[SafePrint Zeroize] Canvas scrub warning:', err);
  }
}
