/**
 * Leaderboard Component
 * 
 * Displays real-time user watch times from Somnia Data Streams
 */

import { useLedger } from '../hooks/useLedger';
import './Leaderboard.css';

const PRICE_PER_SECOND = 0.001; // Match server configuration

export function Leaderboard() {
  const { ledgerEntries, isConnected, error } = useLedger();

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h3>📊 Leaderboard</h3>
        <div className="connection-status">
          {isConnected ? (
            <span className="status-indicator connected">🟢 Live</span>
          ) : (
            <span className="status-indicator disconnected">🔴 Offline</span>
          )}
        </div>
      </div>

      {error && (
        <div className="leaderboard-error">
          ⚠️ {error}
        </div>
      )}

      <div className="leaderboard-content">
        {ledgerEntries.length === 0 ? (
          <div className="leaderboard-empty">
            {isConnected ? '⏳ Waiting for data...' : '🔌 Connecting...'}
          </div>
        ) : (
          <div className="leaderboard-list">
            {ledgerEntries.map((entry, index) => {
              const cost = entry.totalSeconds * PRICE_PER_SECOND;
              const isCurrentUser = entry.userId === sessionStorage.getItem('userId');
              
              return (
                <div 
                  key={entry.userId} 
                  className={`leaderboard-entry ${isCurrentUser ? 'current-user' : ''}`}
                >
                  <div className="entry-rank">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </div>
                  <div className="entry-details">
                    <div className="entry-user">
                      {isCurrentUser ? '👤 You' : `${entry.userId.slice(0, 8)}...${entry.userId.slice(-6)}`}
                    </div>
                    <div className="entry-stats">
                      <span className="stat-time">{entry.totalSeconds}s</span>
                      <span className="stat-separator">•</span>
                      <span className="stat-cost">${cost.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

