/**
 * Somnia Streams Constants
 * 
 * These values should match your service configuration.
 * The LEDGER_SCHEMA_ID should match the one in your service's .env file.
 */

// Schema ID for the ledger (from service setup)
// This should match LEDGER_SCHEMA_ID in your service's .env
const schemaId = import.meta.env.VITE_LEDGER_SCHEMA_ID;
if (!schemaId) {
  throw new Error(
    'VITE_LEDGER_SCHEMA_ID is not set. Create app/.env file with:\n' +
    'VITE_LEDGER_SCHEMA_ID=0x9589ae3944a2db18677ccdd50d7854b050a06ecdf13e01c964e3365dbfcc4d6c\n' +
    'VITE_PUBLISHER_ADDRESS=0x34DD3f91BCA6f50cB2721A69B84C9E7Db50474bE'
  );
}
export const LEDGER_SCHEMA_ID = schemaId as `0x${string}`;

// Publisher address (the wallet address publishing ledger updates)
// This should match the wallet address from your service
const publisherAddr = import.meta.env.VITE_PUBLISHER_ADDRESS;
if (!publisherAddr) {
  throw new Error(
    'VITE_PUBLISHER_ADDRESS is not set. Create app/.env file with:\n' +
    'VITE_LEDGER_SCHEMA_ID=0x9589ae3944a2db18677ccdd50d7854b050a06ecdf13e01c964e3365dbfcc4d6c\n' +
    'VITE_PUBLISHER_ADDRESS=0x34DD3f91BCA6f50cB2721A69B84C9E7Db50474bE'
  );
}
export const PUBLISHER_ADDRESS = publisherAddr as `0x${string}`;

