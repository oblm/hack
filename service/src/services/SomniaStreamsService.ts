import { SDK, SchemaEncoder } from '@somnia-chain/streams';
import { createPublicClient, createWalletClient, http, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Ledger entry for a single user
export interface LedgerEntry {
  userId: string;
  totalSeconds: number;
}

// Complete ledger state (all users)
export interface LedgerState {
  entries: LedgerEntry[];
  timestamp: number;
}

export class SomniaStreamsService {
  private sdk!: SDK;
  private walletAddress!: Hex;
  
  // Simple ledger schema: userId -> totalSeconds
  private ledgerSchema!: string;
  private ledgerSchemaEncoder!: SchemaEncoder;
  private ledgerSchemaId!: Hex;

  constructor() {
    // Validate environment variables
    this.validateEnvironment();
  }

  private validateEnvironment() {
    if (!process.env.SOMNIA_RPC_URL) {
      throw new Error('SOMNIA_RPC_URL environment variable is required');
    }
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }
    if (!process.env.LEDGER_SCHEMA_ID) {
      throw new Error('LEDGER_SCHEMA_ID environment variable is required. Run: npm run setup');
    }
  }

  /**
   * Initialize the service by setting up clients and schema
   */
  async initialize() {
    console.log('Initializing Somnia Streams SDK for Pay-Per-Second Service...');

    // Ledger schema: Complete state as JSON string
    // Format: { "0x123...": 42, "0x456...": 18 }
    // Client subscribes to LedgerUpdated event, parses JSON, finds their userId
    this.ledgerSchema = 'string ledgerJson';
    
    // Create schema encoder
    this.ledgerSchemaEncoder = new SchemaEncoder(this.ledgerSchema);

    // Set up wallet account
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }
    const account = privateKeyToAccount(`0x${privateKey}`);
    this.walletAddress = account.address;

    // Create public and wallet clients
    const publicClient = createPublicClient({
      transport: http(process.env.SOMNIA_RPC_URL),
    });

    const walletClient = createWalletClient({
      account,
      transport: http(process.env.SOMNIA_RPC_URL),
    });

    // Initialize SDK
    this.sdk = new SDK({
      public: publicClient,
      wallet: walletClient,
    });

    // Use pre-computed ledger schema ID from environment
    // This avoids recomputing it on every startup
    this.ledgerSchemaId = process.env.LEDGER_SCHEMA_ID as `0x${string}`;
    
    console.log(`✓ Ledger Schema ID: ${this.ledgerSchemaId}`);
    console.log(`✓ Wallet address: ${this.walletAddress}\n`);
  }

  /**
   * Publish entire ledger state to Somnia Streams as JSON with event emission
   * Uses zero-fetch pattern - clients receive data directly in event
   * Publishes all users' balances in a single update
   * Clients subscribe to LedgerUpdated event, parse JSON, and filter locally
   */
  async publishLedgerState(entries: LedgerEntry[]): Promise<string> {
    const timestamp = Date.now();
    
    console.log(`📊 Ledger Update: ${entries.length} users`);
    for (const entry of entries) {
      console.log(`   ${entry.userId.slice(0, 8)}... → ${entry.totalSeconds}s`);
    }

    // Create ledger object: { userId: totalSeconds, ... }
    const ledgerObject: Record<string, number> = {};
    for (const entry of entries) {
      ledgerObject[entry.userId] = entry.totalSeconds;
    }

    // Serialize to JSON string
    const ledgerJson = JSON.stringify(ledgerObject);

    const encodedData: Hex = this.ledgerSchemaEncoder.encodeData([
      { name: 'ledgerJson', value: ledgerJson, type: 'string' },
    ]);


    // Data stream to write
    const dataStream = [{
      id: toHex(timestamp, { size: 32 }),
      schemaId: this.ledgerSchemaId,
      data: encodedData
    }];


    const eventStream = [{
      id: 'LedgerUpdated',
      argumentTopics: [],
      data: '0x' as `0x${string}`
    }];

    // Publish data + emit event in single transaction
    const result = await this.sdk.streams.setAndEmitEvents(dataStream, eventStream);

    if (!result || result instanceof Error) {
      throw new Error('Failed to publish ledger state');
    }

    console.log(`  ✅ Published entire ledger with event (tx: ${result.slice(0, 10)}...)\n`);
    return result;
  }

}

