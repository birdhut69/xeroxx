import { generateSessionKey, exportKeyToHash, importKeyFromHash, encryptDocument, decryptDocument, computeSHA256 } from '../src/crypto/e2ee';
import { zeroizeBuffer } from '../src/crypto/zeroize';
import { EphemeralLedger } from '../src/crypto/ledger';
import { SecurityGuards } from '../src/crypto/securityGuards';

async function runSecurityAudit() {
  console.log('\n===============================================================');
  console.log('  🛡️  SafePrint Zero-Trust Security & Cryptographic Audit Suite');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      process.exitCode = 1;
    }
  }

  // 1. WebCrypto AES-256-GCM E2EE Test
  console.log('--- 1. Cryptographic Key Exchange & AES-256-GCM Encryption ---');
  try {
    const rawData = new TextEncoder().encode('CONFIDENTIAL AADHAAR ID: 4892-7109-3841');
    const originalHash = await computeSHA256(rawData.buffer as ArrayBuffer);
    
    const key = await generateSessionKey();
    const keyHashFragment = await exportKeyToHash(key);
    assert(keyHashFragment.length > 20, 'Key serialized to URL hash fragment (RFC 3986 client-only format)');

    const importedKey = await importKeyFromHash(keyHashFragment);
    const encrypted = await encryptDocument(rawData.buffer as ArrayBuffer, importedKey);

    assert(encrypted.docHash === originalHash, 'SHA-256 document fingerprint matches original buffer');
    assert(encrypted.ciphertext.byteLength > 0, 'Document successfully encrypted with AES-256-GCM');
    assert(encrypted.iv.byteLength === 12, 'Cryptographically fresh 12-byte initialization vector (IV) generated');

    const decrypted = await decryptDocument(encrypted.ciphertext, encrypted.iv, importedKey);
    const decryptedText = new TextDecoder().decode(decrypted);

    assert(decryptedText === 'CONFIDENTIAL AADHAAR ID: 4892-7109-3841', 'Decrypted document in RAM precisely matches plaintext');
  } catch (err: any) {
    console.error('Crypto Test Exception:', err);
    assert(false, 'E2EE Encryption/Decryption flow succeeded without errors');
  }

  // 2. RAM Memory Zeroization & Buffer Scrubbing Test
  console.log('\n--- 2. Hardware RAM Memory Zeroization & Scrubber ---');
  try {
    const sensitiveData = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22]);
    assert(sensitiveData.some(b => b !== 0), 'Buffer initially contains active confidential document memory');

    zeroizeBuffer(sensitiveData);

    const isAllZeros = sensitiveData.every(b => b === 0);
    assert(isAllZeros, 'Buffer memory completely overwritten and zeroized (0x00 across all bytes)');
  } catch (err: any) {
    assert(false, 'Buffer zeroization succeeded');
  }

  // 3. Ephemeral Blockchain Merkle Proof of Destruction Ledger Test
  console.log('\n--- 3. Ephemeral Blockchain Merkle Audit Ledger ---');
  try {
    const ledger = new EphemeralLedger('SESSION-TEST-UUID', 'SHOP-TEST-01', 'Test Xerox Shop');
    
    // Block 0: Genesis
    const genesis = await ledger.initGenesis();
    assert(genesis.index === 0 && genesis.eventType === 'GENESIS', 'Block 0 (Genesis) created with root parent 0x0000...');

    // Block 1: Ingest
    const ingest = await ledger.recordIngest('DOC-HASH-12345678', 'Aadhaar_ID.jpg', 1, 'Valid only for Xerox on 27-Aug');
    assert(ingest.index === 1 && ingest.prevHash === genesis.blockHash, 'Block 1 (Ingest) cryptographically chained to Block 0 hash');

    // Block 2: Print
    const print = await ledger.recordPrint(1, 1);
    assert(print.index === 2 && print.prevHash === ingest.blockHash, 'Block 2 (Print) cryptographically chained to Block 1 hash');

    // Block 3: Shred & Certificate
    const { block: shred, certificate } = await ledger.recordShred('NONCE-RANDOM-789');
    assert(shred.index === 3 && shred.prevHash === print.blockHash, 'Block 3 (Shred) chained to Block 2 hash');
    assert(certificate.certificateId.startsWith('CERT-'), 'Verifiable Certificate of Destruction generated');
    assert(certificate.ledgerProofChain.length === 4, 'Full 4-block Merkle audit trail included in digital receipt');
    assert(certificate.verified === true, 'Cryptographic chain verification passed');
  } catch (err: any) {
    console.error('Ledger Test Exception:', err);
    assert(false, 'Blockchain ledger verification succeeded');
  }

  // 4. Attack Vector Defense Guards (XSS, MitM, Replay, DoS)
  console.log('\n--- 4. Attack Defense Guards & Sanitization ---');
  try {
    // XSS defense
    const maliciousInput = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
    const sanitized = SecurityGuards.sanitizeText(maliciousInput);
    assert(!sanitized.includes('<script>') && !sanitized.includes('<img'), 'XSS tags properly neutralized and encoded');

    // Path traversal defense
    const maliciousFilename = '../../../../etc/passwd;evil.pdf';
    const safeFilename = SecurityGuards.sanitizeFilename(maliciousFilename);
    assert(!safeFilename.includes('..') && !safeFilename.includes('/'), 'Directory traversal in filename neutralized');

    // Replay attack defense (timestamp expiry)
    const oldTimestamp = Date.now() - (10 * 60 * 1000); // 10 mins ago
    assert(SecurityGuards.validateTimestamp(oldTimestamp) === false, 'Expired messages (>5 min) rejected to prevent Replay attacks');
    assert(SecurityGuards.validateTimestamp(Date.now()) === true, 'Fresh messages validated successfully');

    // Nonce replay defense
    const nonce = SecurityGuards.generateCryptoToken(16);
    assert(SecurityGuards.validateAndRecordNonce(nonce) === true, 'Unique nonce accepted on first use');
    assert(SecurityGuards.validateAndRecordNonce(nonce) === false, 'Duplicate nonce rejected to prevent replay tampering');

    // DoS / Payload size defense
    assert(SecurityGuards.validateFileSize(1024 * 1024) === true, 'Valid 1MB payload accepted');
    assert(SecurityGuards.validateFileSize(100 * 1024 * 1024) === false, 'Excessive >50MB payload rejected to prevent DoS memory exhaustion');
  } catch (err: any) {
    console.error('Defense Guards Exception:', err);
    assert(false, 'Security guards verification succeeded');
  }

  console.log('\n===============================================================');
  console.log(`  📊 Audit Summary: ${passed}/${total} Checks Passed (${Math.round((passed/total)*100)}%)`);
  console.log('===============================================================\n');
}

runSecurityAudit();
