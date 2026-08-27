/**
 * SafePrint Web Crypto API E2EE Module
 * Zero-Knowledge Client-Side AES-256-GCM Encryption Engine
 * Compatible with Browser Window and Node.js Global Web Crypto
 */

export interface EncryptedPayload {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  docHash: string;
}

const getCrypto = () => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  return globalThis.crypto;
};

// Convert ArrayBuffer to Hex string
export function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Base64URL string to Uint8Array
export function base64UrlToUint8Array(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Convert Uint8Array to Base64URL string
export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a random cryptographic AES-256-GCM key for the session
 */
export async function generateSessionKey(): Promise<CryptoKey> {
  const crypto = getCrypto();
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable so we can place it into URL hash
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports AES key to Base64URL string for inclusion in QR code URL hash (#key=...)
 */
export async function exportKeyToHash(key: CryptoKey): Promise<string> {
  const crypto = getCrypto();
  const exported = await crypto.subtle.exportKey('raw', key);
  return uint8ArrayToBase64Url(new Uint8Array(exported));
}

/**
 * Imports AES key from Base64URL string extracted from URL hash
 */
export async function importKeyFromHash(keyBase64Url: string): Promise<CryptoKey> {
  const crypto = getCrypto();
  const keyBytes = base64UrlToUint8Array(keyBase64Url);
  return await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable after import on the terminal
    ['encrypt', 'decrypt']
  );
}

/**
 * Computes SHA-256 fingerprint of an ArrayBuffer
 */
export async function computeSHA256(data: ArrayBuffer): Promise<string> {
  const crypto = getCrypto();
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/**
 * Encrypts an ArrayBuffer using AES-256-GCM with fresh 12-byte IV
 */
export async function encryptDocument(data: ArrayBuffer, key: CryptoKey): Promise<EncryptedPayload> {
  const crypto = getCrypto();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const docHash = await computeSHA256(data);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource
    },
    key,
    data
  );

  return {
    ciphertext,
    iv,
    docHash
  };
}

/**
 * Decrypts AES-256-GCM ciphertext using the session key and IV
 */
export async function decryptDocument(ciphertext: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<ArrayBuffer> {
  const crypto = getCrypto();
  return await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource
    },
    key,
    ciphertext
  );
}

/**
 * Generates secure random UUID for the session
 */
export function generateRandomSessionId(): string {
  const crypto = getCrypto();
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b, i) => ([4, 6, 8, 10].includes(i) ? `-${b.toString(16).padStart(2, '0')}` : b.toString(16).padStart(2, '0')))
    .join('');
}
