import { config } from 'dotenv';
import { SomniaStreamsService } from './services/SomniaStreamsService';

// Load environment variables
config();

async function main() {
  console.log('🚀 Starting Somnia Data Streams Service...\n');

  try {
    // Initialize the service
    const service = new SomniaStreamsService();
    await service.initialize();

    // Example 1: Write GPS data
    console.log('📝 Example 1: Writing GPS data to stream...');
    const writeResult = await service.writeGPSData({
      timestamp: Date.now(),
      latitude: 51509865,
      longitude: -118092,
      altitude: 0,
      accuracy: 0,
      entityId: 'london',
      nonce: 0,
    });
    console.log(`✅ Data written! Transaction hash: ${writeResult.txHash}\n`);

    // Example 2: Read data back
    console.log('📖 Example 2: Reading GPS data from stream...');
    const readResult = await service.readGPSData('london');
    if (readResult) {
      console.log('✅ Data retrieved:', readResult);
    } else {
      console.log('❌ No data found');
    }

    console.log('\n✨ Service completed successfully!');
  } catch (error) {
    console.error('❌ Error running service:', error);
    process.exit(1);
  }
}

// Run the service
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

