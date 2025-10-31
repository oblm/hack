import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { SomniaStreamsService } from './services/SomniaStreamsService';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const PRICE_PER_SECOND = 0.001; // $0.001 per second

// Active session state - tracks individual sessions
interface ActiveSession {
  sessionId: string;
  userId: string;
  contentId: string;
  startTime: number;
}

// User ledger - tracks cumulative seconds watched per user
// This is what gets published to Somnia every second
interface UserLedger {
  userId: string;
  totalSeconds: number;  // Cumulative seconds across all sessions
  lastUpdate: number;     // Timestamp of last update
}

const activeSessions = new Map<string, ActiveSession>();
const userLedger = new Map<string, UserLedger>(); // userId -> cumulative seconds

// Initialize Somnia service
const somniaService = new SomniaStreamsService();
let isInitialized = false;

async function initializeService() {
  try {
    await somniaService.initialize();
    isInitialized = true;
    console.log('✅ Somnia Streams Service initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize Somnia service:', error);
    process.exit(1);
  }
}

// Helper function to generate session ID
function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `session-${timestamp}-${random}`;
}

// API Endpoints

/**
 * POST /api/stream/start
 * Start a new streaming session
 */
app.post('/api/stream/start', (req: Request, res: Response) => {
  try {
    const { userId, contentId } = req.body;

    if (!userId || !contentId) {
      return res.status(400).json({
        error: 'Missing required fields: userId and contentId'
      });
    }

    if (!isInitialized) {
      return res.status(503).json({
        error: 'Service not initialized yet'
      });
    }

    const sessionId = generateSessionId();
    const startTime = Date.now();

    const session: ActiveSession = {
      sessionId,
      userId,
      contentId,
      startTime,
    };

    activeSessions.set(sessionId, session);

    // Initialize user ledger if first session
    if (!userLedger.has(userId)) {
      userLedger.set(userId, {
        userId,
        totalSeconds: 0,
        lastUpdate: startTime,
      });
    }

    console.log(`🎬 Session started: ${sessionId}`);
    console.log(`   User: ${userId}`);
    console.log(`   Content: ${contentId}`);
    console.log('   📊 Ledger updates: Every 1 second');
    console.log(`   Time: ${new Date(startTime).toISOString()}\n`);

    res.json({
      sessionId,
      pricePerSecond: PRICE_PER_SECOND,
      startTime,
      message: 'Streaming session started'
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

/**
 * POST /api/stream/stop
 * Stop an active streaming session
 */
app.post('/api/stream/stop', async (req: Request, res: Response) => {
  try {
    const { sessionId, userId } = req.body;

    if (!sessionId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId and userId'
      });
    }

    const session = activeSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    if (session.userId !== userId) {
      return res.status(403).json({
        error: 'Unauthorized: User does not own this session'
      });
    }

    // Calculate session duration
    const endTime = Date.now();
    const sessionSeconds = Math.floor((endTime - session.startTime) / 1000);
    const sessionCost = sessionSeconds * PRICE_PER_SECOND;

    // Remove from active sessions
    activeSessions.delete(sessionId);

    console.log(`🛑 Session stopped: ${sessionId}`);
    console.log(`   Duration: ${sessionSeconds}s`);
    console.log(`   Session cost: $${sessionCost.toFixed(4)}`);
    
    // Get user's total from ledger
    const ledgerEntry = userLedger.get(session.userId);
    if (ledgerEntry) {
      console.log(`   User total: ${ledgerEntry.totalSeconds}s ($${(ledgerEntry.totalSeconds * PRICE_PER_SECOND).toFixed(4)})\n`);
    }

    res.json({
      sessionId,
      sessionSeconds,
      sessionCost,
      userTotalSeconds: ledgerEntry?.totalSeconds || 0,
      pricePerSecond: PRICE_PER_SECOND,
      message: 'Session ended successfully'
    });
  } catch (error) {
    console.error('Error stopping session:', error);
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

/**
 * GET /api/stream/status/:sessionId
 * Get current status of an active session
 */
app.get('/api/stream/status/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    const now = Date.now();
    const secondsElapsed = Math.floor((now - session.startTime) / 1000);
    const currentCost = secondsElapsed * PRICE_PER_SECOND;

    res.json({
      sessionId: session.sessionId,
      userId: session.userId,
      contentId: session.contentId,
      startTime: session.startTime,
      secondsElapsed,
      currentCost,
      pricePerSecond: PRICE_PER_SECOND,
      status: 'active'
    });
  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
});

/**
 * GET /api/stream/sessions
 * Get all active sessions
 */
app.get('/api/stream/sessions', (req: Request, res: Response) => {
  try {
    const sessions = Array.from(activeSessions.values()).map(session => {
      const now = Date.now();
      const secondsElapsed = Math.floor((now - session.startTime) / 1000);
      const currentCost = secondsElapsed * PRICE_PER_SECOND;

      return {
        sessionId: session.sessionId,
        userId: session.userId,
        contentId: session.contentId,
        startTime: session.startTime,
        secondsElapsed,
        currentCost,
        pricePerSecond: PRICE_PER_SECOND,
      };
    });

    res.json({
      totalSessions: sessions.length,
      sessions,
    });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    initialized: isInitialized,
    activeSessions: activeSessions.size,
    pricePerSecond: PRICE_PER_SECOND,
  });
});


setInterval(async () => {
  const now = Date.now();

  // Calculate cumulative seconds for each user with active sessions
  const userSecondsMap = new Map<string, number>();

  for (const [_, session] of activeSessions) {
    const sessionSeconds = Math.floor((now - session.startTime) / 1000);
    const currentTotal = userSecondsMap.get(session.userId) || 0;
    userSecondsMap.set(session.userId, currentTotal + sessionSeconds);
  }

  // Update ledger for each active user
  for (const [userId, currentSessionSeconds] of userSecondsMap) {
    const ledgerEntry = userLedger.get(userId);
    
    if (ledgerEntry) {
      ledgerEntry.totalSeconds = currentSessionSeconds;
      ledgerEntry.lastUpdate = now;
    }
  }

  // Publish ENTIRE ledger as a single update
  if (userLedger.size > 0) {
    const ledgerEntries = Array.from(userLedger.values()).map(entry => ({
      userId: entry.userId,
      totalSeconds: entry.totalSeconds,
    }));

    try {
      await somniaService.publishLedgerState(ledgerEntries);
    } catch (error) {
      console.error('⚠️  Failed to publish ledger state:', error instanceof Error ? error.message : error);
    }
  }
}, 1000); // Publish every 1 second

// Optional: Auto-stop stale sessions after timeout
const AUTO_STOP_TIMEOUT = 5 * 60 * 1000; // 5 minutes
setInterval(async () => {
  const now = Date.now();

  for (const [sessionId, session] of activeSessions) {
    const elapsed = now - session.startTime;

    // Auto-stop sessions that have been running too long (safety mechanism)
    if (elapsed > AUTO_STOP_TIMEOUT) {
      console.log(`⚠️  Auto-stopping stale session: ${sessionId}`);

      const totalSeconds = Math.floor(elapsed / 1000);
      const totalCost = totalSeconds * PRICE_PER_SECOND;

      // Just remove from active sessions - ledger already has the total
      activeSessions.delete(sessionId);
      console.log('   Session removed from active list');
    }
  }
}, 30000); // Check every 30 seconds

// Start server
async function startServer() {
  await initializeService();

  app.listen(PORT, () => {
    console.log(`🚀 Pay-Per-Second Streaming Server running on port ${PORT}`);
    console.log(`💰 Price: $${PRICE_PER_SECOND} per second`);
    console.log('📊 Ledger updates: Every 1 second (userId → totalSeconds)');
    console.log('💡 Clients subscribe and calculate balance locally');
    console.log('\nEndpoints:');
    console.log(`  POST   http://localhost:${PORT}/api/stream/start`);
    console.log(`  POST   http://localhost:${PORT}/api/stream/stop`);
    console.log(`  GET    http://localhost:${PORT}/api/stream/status/:sessionId`);
    console.log(`  GET    http://localhost:${PORT}/api/stream/sessions`);
    console.log(`  GET    http://localhost:${PORT}/api/health\n`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

