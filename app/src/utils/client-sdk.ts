/**
 * Client-side SDK helpers
 * 
 * Important: Use TWO separate clients to avoid WebSocket errors:
 * 1. HTTP client for data fetching (initial load, refetch)
 * 2. WebSocket client ONLY for real-time subscriptions
 * 
 * This pattern prevents "SocketClosedError" when tabs sleep
 */
'use client'

import { SDK } from '@somnia-chain/streams'
import { createPublicClient, http, webSocket } from 'viem'
import { somniaTestnet } from './chains'

/**
 * HTTP client for data fetching (initial load, refetch)
 * Use this for: getAtIndex, totalPublisherDataForSchema, etc.
 */
export function getClientFetchSDK() {
  if (typeof window === 'undefined') {
    throw new Error('getClientFetchSDK can only be called in browser')
  }

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://dream-rpc.somnia.network'

  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(rpcUrl),
  })

  return new SDK({ public: publicClient })
}

/**
 * WebSocket client for real-time subscriptions ONLY
 * Use this for: subscribe()
 * 
 * Note: WebSocket connections can close when tabs sleep.
 * Always implement reconnection logic in your subscription handler.
 */
export function getClientSDK() {
  if (typeof window === 'undefined') {
    throw new Error('getClientSDK can only be called in browser')
  }

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.infra.testnet.somnia.network/ws'

  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: webSocket(wsUrl),
  })

  return new SDK({ public: publicClient })
}

