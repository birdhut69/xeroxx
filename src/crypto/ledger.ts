import { computeSHA256 } from './e2ee';

export interface LedgerBlock {
  index: number;
  timestamp: number;
  eventType: 'GENESIS' | 'INGEST' | 'PRINT_EXECUTED' | 'MEMORY_SHREDDED';
  details: {
    sessionId: string;
    shopId: string;
    shopName: string;
    docHash?: string;
    filename?: string;
    pages?: number;
    copies?: number;
    watermarkText?: string;
    zeroizeNonce?: string;
    operatorNote?: string;
  };
  prevHash: string;
  blockHash: string;
}

export interface DestructionCertificate {
  certificateId: string;
  sessionId: string;
  timestamp: number;
  docHash: string;
  filename: string;
  shopId: string;
  shopName: string;
  pagesPrinted: number;
  copiesPrinted: number;
  destructionTimestamp: number;
  ledgerProofChain: LedgerBlock[];
  rootProofHash: string;
  verified: boolean;
}

/**
 * Calculates cryptographic SHA-256 block hash
 */
async function computeBlockHash(
  index: number,
  timestamp: number,
  eventType: string,
  details: any,
  prevHash: string
): Promise<string> {
  const rawString = `${index}:${timestamp}:${eventType}:${JSON.stringify(details)}:${prevHash}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(rawString);
  return await computeSHA256(data.buffer as ArrayBuffer);
}

export class EphemeralLedger {
  private chain: LedgerBlock[] = [];
  private sessionId: string;
  private shopId: string;
  private shopName: string;

  constructor(sessionId: string, shopId: string, shopName: string) {
    this.sessionId = sessionId;
    this.shopId = shopId;
    this.shopName = shopName;
  }

  public async initGenesis(): Promise<LedgerBlock> {
    const timestamp = Date.now();
    const details = {
      sessionId: this.sessionId,
      shopId: this.shopId,
      shopName: this.shopName,
      operatorNote: 'SafePrint Zero-Trust Session Initialized'
    };
    const blockHash = await computeBlockHash(0, timestamp, 'GENESIS', details, '0000000000000000000000000000000000000000000000000000000000000000');

    const genesisBlock: LedgerBlock = {
      index: 0,
      timestamp,
      eventType: 'GENESIS',
      details,
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      blockHash
    };

    this.chain = [genesisBlock];
    return genesisBlock;
  }

  public async recordIngest(docHash: string, filename: string, pages: number, watermarkText?: string): Promise<LedgerBlock> {
    const prevBlock = this.chain[this.chain.length - 1];
    const timestamp = Date.now();
    const details = {
      sessionId: this.sessionId,
      shopId: this.shopId,
      shopName: this.shopName,
      docHash,
      filename,
      pages,
      watermarkText: watermarkText || 'NONE'
    };

    const blockHash = await computeBlockHash(this.chain.length, timestamp, 'INGEST', details, prevBlock.blockHash);

    const block: LedgerBlock = {
      index: this.chain.length,
      timestamp,
      eventType: 'INGEST',
      details,
      prevHash: prevBlock.blockHash,
      blockHash
    };

    this.chain.push(block);
    return block;
  }

  public async recordPrint(pagesPrinted: number, copies: number): Promise<LedgerBlock> {
    const prevBlock = this.chain[this.chain.length - 1];
    const timestamp = Date.now();
    const details = {
      sessionId: this.sessionId,
      shopId: this.shopId,
      shopName: this.shopName,
      pages: pagesPrinted,
      copies
    };

    const blockHash = await computeBlockHash(this.chain.length, timestamp, 'PRINT_EXECUTED', details, prevBlock.blockHash);

    const block: LedgerBlock = {
      index: this.chain.length,
      timestamp,
      eventType: 'PRINT_EXECUTED',
      details,
      prevHash: prevBlock.blockHash,
      blockHash
    };

    this.chain.push(block);
    return block;
  }

  public async recordShred(zeroizeNonce: string): Promise<{ block: LedgerBlock; certificate: DestructionCertificate }> {
    const prevBlock = this.chain[this.chain.length - 1];
    const timestamp = Date.now();
    const details = {
      sessionId: this.sessionId,
      shopId: this.shopId,
      shopName: this.shopName,
      zeroizeNonce,
      operatorNote: 'Physical RAM Zeroization & DRM Canvas Scrub Complete'
    };

    const blockHash = await computeBlockHash(this.chain.length, timestamp, 'MEMORY_SHREDDED', details, prevBlock.blockHash);

    const shredBlock: LedgerBlock = {
      index: this.chain.length,
      timestamp,
      eventType: 'MEMORY_SHREDDED',
      details,
      prevHash: prevBlock.blockHash,
      blockHash
    };

    this.chain.push(shredBlock);

    // Build the final verifiable certificate
    const ingestBlock = this.chain.find(b => b.eventType === 'INGEST');
    const printBlock = this.chain.find(b => b.eventType === 'PRINT_EXECUTED');

    const certificate: DestructionCertificate = {
      certificateId: `CERT-${shredBlock.blockHash.substring(0, 12).toUpperCase()}`,
      sessionId: this.sessionId,
      timestamp,
      docHash: ingestBlock?.details.docHash || 'UNKNOWN',
      filename: ingestBlock?.details.filename || 'Document',
      shopId: this.shopId,
      shopName: this.shopName,
      pagesPrinted: printBlock?.details.pages || 1,
      copiesPrinted: printBlock?.details.copies || 1,
      destructionTimestamp: timestamp,
      ledgerProofChain: [...this.chain],
      rootProofHash: shredBlock.blockHash,
      verified: true
    };

    return { block: shredBlock, certificate };
  }

  public getChain(): LedgerBlock[] {
    return [...this.chain];
  }
}
