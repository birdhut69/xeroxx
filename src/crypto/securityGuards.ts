/**
 * SafePrint Security & Defense Guards
 * Comprehensive protection against XSS, MitM, Replay, DoS, Memory Leaks, and DRM Tampering.
 */

export class SecurityGuards {
  private static seenNonces = new Set<string>();
  private static MAX_SEEN_NONCES = 10000;
  private static MAX_PAYLOAD_SIZE = 50 * 1024 * 1024; // 50MB
  private static MAX_TEXT_LENGTH = 1000;

  /**
   * Sanitizes all user-supplied text to prevent XSS and HTML injection.
   */
  public static sanitizeText(input: unknown, maxLen = 256): string {
    if (typeof input !== 'string') return '';
    return input
      .trim()
      .slice(0, maxLen)
      .replace(/[&<>"'/`]/g, (match) => {
        const map: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '/': '&#x2F;',
          '`': '&#x60;',
        };
        return map[match] || match;
      });
  }

  /**
   * Sanitizes filenames to prevent Directory Traversal and injection.
   */
  public static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') return 'document.pdf';
    return filename
      .replace(/[\/\?<>\\:\*\|":]/g, '_')
      .replace(/\.\./g, '_')
      .slice(0, 120);
  }

  /**
   * Validates message timestamp to prevent Replay Attacks.
   * Rejects messages older than 5 minutes or in the future (> 30 seconds).
   */
  public static validateTimestamp(timestamp: number, maxAgeMs = 5 * 60 * 1000): boolean {
    if (typeof timestamp !== 'number' || isNaN(timestamp)) return false;
    const now = Date.now();
    if (timestamp < now - maxAgeMs) return false; // Too old
    if (timestamp > now + 30 * 1000) return false; // Clock skewed into future
    return true;
  }

  /**
   * Validates nonces to prevent duplicate replayed packets.
   */
  public static validateAndRecordNonce(nonce: string): boolean {
    if (!nonce || typeof nonce !== 'string') return false;
    if (this.seenNonces.has(nonce)) return false; // Replayed!
    this.seenNonces.add(nonce);
    if (this.seenNonces.size > this.MAX_SEEN_NONCES) {
      const first = this.seenNonces.values().next().value;
      if (first) this.seenNonces.delete(first);
    }
    return true;
  }

  /**
   * Validates file size limits to prevent DoS / memory exhaustion.
   */
  public static validateFileSize(size: number): boolean {
    return typeof size === 'number' && size > 0 && size <= this.MAX_PAYLOAD_SIZE;
  }

  /**
   * Validates chunk parameters for binary streaming.
   */
  public static validateChunk(chunkIndex: number, totalChunks: number, chunkLength: number): boolean {
    if (typeof chunkIndex !== 'number' || typeof totalChunks !== 'number') return false;
    if (chunkIndex < 0 || totalChunks <= 0 || chunkIndex >= totalChunks) return false;
    if (chunkLength <= 0 || chunkLength > 65536) return false; // Max 64KB per chunk
    return true;
  }

  /**
   * Generates a cryptographically strong random token.
   */
  public static generateCryptoToken(length = 16): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
