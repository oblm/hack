import { SDK, zeroBytes32, SchemaEncoder } from '@somnia-chain/streams';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

interface GPSData {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  entityId: string;
  nonce: number;
}

export class SomniaStreamsService {
  private sdk!: SDK;
  private gpsSchema!: string;
  private schemaEncoder!: SchemaEncoder;
  private schemaId!: Hex;
  private walletAddress!: Hex;

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
  }

  /**
   * Initialize the service by setting up clients and schema
   */
  async initialize() {
    console.log('Initializing Somnia Streams SDK...');

    // Define the GPS schema
    this.gpsSchema = 'uint64 timestamp, int32 latitude, int32 longitude, int32 altitude, uint32 accuracy, bytes32 entityId, uint256 nonce';
    
    // Create schema encoder
    this.schemaEncoder = new SchemaEncoder(this.gpsSchema);

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

    // Compute schema ID
    this.schemaId = await this.sdk.streams.computeSchemaId(this.gpsSchema);
    console.log(`✓ Schema ID computed: ${this.schemaId}`);
    console.log(`✓ Wallet address: ${this.walletAddress}\n`);
  }

  /**
   * Write GPS data to the stream
   */
  async writeGPSData(data: GPSData): Promise<{ txHash: Hex }> {
    console.log('Encoding GPS data...');
    
    // Encode the data according to the schema
    const encodedData: Hex = this.schemaEncoder.encodeData([
      { name: 'timestamp', value: data.timestamp.toString(), type: 'uint64' },
      { name: 'latitude', value: data.latitude.toString(), type: 'int32' },
      { name: 'longitude', value: data.longitude.toString(), type: 'int32' },
      { name: 'altitude', value: data.altitude.toString(), type: 'int32' },
      { name: 'accuracy', value: data.accuracy.toString(), type: 'uint32' },
      { name: 'entityId', value: this.toBytes32(data.entityId), type: 'bytes32' },
      { name: 'nonce', value: data.nonce.toString(), type: 'uint256' },
    ]);

    console.log('Publishing data to stream...');
    
    // Publish the data
    const txHash = await this.sdk.streams.set([
      {
        id: this.toBytes32(data.entityId),
        schemaId: this.schemaId,
        data: encodedData,
      },
    ]);

    return { txHash };
  }

  /**
   * Read GPS data from the stream
   */
  async readGPSData(dataKey: string): Promise<unknown> {
    console.log(`Fetching data for key: ${dataKey}...`);
    
    const data = await this.sdk.streams.getByKey(
      this.schemaId,
      this.walletAddress,
      this.toBytes32(dataKey)
    );

    if (data) {
      // If schema is not public, decode manually
      return this.schemaEncoder.decode(data);
    }

    return null;
  }

  /**
   * Helper method to convert string to bytes32
   */
  private toBytes32(value: string): Hex {
    // If already a hex string, return as is
    if (value.startsWith('0x')) {
      return value as Hex;
    }
    
    // Convert string to hex with proper padding
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Pad to 32 bytes (64 hex characters)
    return `0x${hex.padEnd(64, '0')}` as Hex;
  }
}

