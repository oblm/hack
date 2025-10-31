/**
 * useLedger Hook
 * 
 * Subscribes to real-time ledger updates from Somnia Data Streams:
 * - WebSocket subscription with ZERO-FETCH ethCalls pattern
 * - Parses JSON ledger data from LedgerUpdated events
 * - Automatic reconnection handling
 */

import { useEffect, useState } from 'react';
import { encodeFunctionData, decodeFunctionResult, decodeAbiParameters } from 'viem';
import { LEDGER_SCHEMA_ID, PUBLISHER_ADDRESS } from '../utils/constants';
import { getClientSDK } from '../utils/client-sdk';

export interface LedgerEntry {
  userId: string;
  totalSeconds: number;
}

/**
 * React hook for subscribing to real-time ledger updates
 */
export function useLedger() {
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    let isSubscribed = false;

    async function setupSubscription() {
      try {
        console.log('🔌 Setting up ledger WebSocket subscription...');
        
        const sdk = getClientSDK();
        const protocolInfoResult = await sdk.streams.getSomniaDataStreamsProtocolInfo();
        
        if (!protocolInfoResult || protocolInfoResult instanceof Error) {
          throw new Error('Failed to get protocol info');
        }
        
        const protocolInfo = protocolInfoResult;
        
        console.log('✅ Subscribing to LedgerUpdated events');
        console.log(`   Schema ID: ${LEDGER_SCHEMA_ID}`);
        console.log(`   Publisher: ${PUBLISHER_ADDRESS}`);
        
        const sub = await sdk.streams.subscribe({
          somniaStreamsEventId: 'LedgerUpdated',
          
          // ZERO-FETCH PATTERN: Get latest ledger data in the event
          ethCalls: [{
            to: protocolInfo.address as `0x${string}`,
            data: encodeFunctionData({
              abi: protocolInfo.abi,
              functionName: 'getLastPublishedDataForSchema',
              args: [LEDGER_SCHEMA_ID, PUBLISHER_ADDRESS]
            })
          }],
          
          onlyPushChanges: false,
          
          onData: (data: unknown) => {
            try {
              const { result } = data as { result?: { simulationResults?: readonly `0x${string}`[] } };
              
              if (!result?.simulationResults?.[0]) {
                console.warn('⚠️  No simulation results in ledger update');
                return;
              }
              
              const lastPublishedData = decodeFunctionResult({
                abi: protocolInfo.abi,
                functionName: 'getLastPublishedDataForSchema',
                data: result.simulationResults[0]
              }) as `0x${string}`;
              
              if (!lastPublishedData || lastPublishedData === '0x') {
                console.warn('⚠️  Empty ledger data');
                return;
              }
              
              // Decode the schema data (it's encoded as a single string field)
              // The schema is: 'string ledgerJson'
              // We need to decode the ABI-encoded string
              const decoded = decodeAbiParameters(
                [{ name: 'ledgerJson', type: 'string' }],
                lastPublishedData
              );
              
              const ledgerJson = decoded[0] as string;
              
              // Parse the JSON ledger: { "userId": totalSeconds, ... }
              const ledgerObject = JSON.parse(ledgerJson) as Record<string, number>;
              
              // Convert to array of entries
              const entries: LedgerEntry[] = Object.entries(ledgerObject).map(([userId, totalSeconds]) => ({
                userId,
                totalSeconds,
              }));
              
              // Sort by totalSeconds descending (highest first)
              entries.sort((a, b) => b.totalSeconds - a.totalSeconds);
              
              console.log(`📊 Ledger Update: ${entries.length} users`);
              entries.forEach(entry => {
                console.log(`   ${entry.userId.slice(0, 12)}... → ${entry.totalSeconds}s`);
              });
              
              setLedgerEntries(entries);
              setIsConnected(true);
              setError(null);
              
            } catch (error) {
              console.error('❌ Failed to process ledger update:', error);
              setError(error instanceof Error ? error.message : 'Unknown error');
            }
          },
          
          onError: (error: Error) => {
            console.error('❌ Subscription error:', error.message);
            setIsConnected(false);
            setError(error.message);
            isSubscribed = false;
            
            // Auto-reconnect after 3 seconds
            setTimeout(() => {
              if (!isSubscribed) {
                console.log('🔄 Attempting to reconnect...');
                setupSubscription();
              }
            }, 3000);
          }
        });
        
        subscription = sub;
        isSubscribed = true;
        setIsConnected(true);
        console.log('✅ Subscribed! Waiting for ledger updates...');
        
      } catch (error) {
        console.error('❌ Failed to subscribe:', error);
        setIsConnected(false);
        setError(error instanceof Error ? error.message : 'Unknown error');
        
        // Retry after 5 seconds
        setTimeout(() => {
          if (!isSubscribed) {
            console.log('🔄 Retrying subscription...');
            setupSubscription();
          }
        }, 5000);
      }
    }

    // Start subscription
    setupSubscription();

    // Cleanup
    return () => {
      if (subscription) {
        try {
          subscription.unsubscribe();
          console.log('✅ Ledger subscription cleaned up');
        } catch (error) {
          console.error('⚠️  Error during cleanup:', error);
        }
      }
      isSubscribed = false;
    };
  }, []);

  return { ledgerEntries, isConnected, error };
}

