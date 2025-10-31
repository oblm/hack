import { useState, useEffect, useRef } from 'react';
import './App.css';
import quotesData from './quotes.json';
import { Leaderboard } from './components/Leaderboard';

const allQuotes: string[] = quotesData;

// Configuration
const BIAS_TOWARDS_EARLIER_QUOTES = 50; // Percentage (0-100)
const MAX_NORMAL_SPEED = 0.15; // Maximum speed for normal drift (after deceleration)
const DECELERATION_TIME = 0.5; // Time in seconds to decelerate to max speed

// Screen size reference points for quote scaling
const IPHONE_SCREEN_AREA = 375 * 812; // iPhone screen area (approx)
const MACBOOK_SCREEN_AREA = 1440 * 900; // MacBook screen area (approx)
const IPHONE_QUOTES = 2;
const MACBOOK_QUOTES = 6;

// Calculate number of quotes based on screen size
const calculateQuoteCount = (): number => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const screenArea = width * height;
  
  // Linear interpolation between iPhone and MacBook sizes
  if (screenArea <= IPHONE_SCREEN_AREA) {
    return IPHONE_QUOTES;
  } else if (screenArea >= MACBOOK_SCREEN_AREA) {
    return MACBOOK_QUOTES;
  } else {
    // Interpolate between iPhone and MacBook
    const ratio = (screenArea - IPHONE_SCREEN_AREA) / (MACBOOK_SCREEN_AREA - IPHONE_SCREEN_AREA);
    const quoteCount = IPHONE_QUOTES + (MACBOOK_QUOTES - IPHONE_QUOTES) * ratio;
    return Math.round(quoteCount);
  }
};

interface Quote {
  id: number;
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
}

// API Configuration
const API_BASE_URL = 'http://localhost:3001';

// Generate a unique user ID per tab/session for testing
// In production, this would come from authentication
const getUserId = () => {
  // Use sessionStorage instead of localStorage so each tab gets its own ID
  let userId = sessionStorage.getItem('userId');
  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('userId', userId);
  }
  return userId;
};

function App() {
  // Track whether animation is running
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Track target quote count (what screen size wants) vs current quote count
  const targetQuoteCountRef = useRef<number>(calculateQuoteCount());
  const [numQuotes, setNumQuotes] = useState(() => targetQuoteCountRef.current);
  
  // Update target quote count when window resizes (but don't change actual quotes yet)
  useEffect(() => {
    const handleResize = () => {
      targetQuoteCountRef.current = calculateQuoteCount();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get random quotes with bias towards earlier quotes
  const getRandomQuotes = (count: number, biasPercent: number) => {
    const selected: string[] = [];
    const usedIndices = new Set<number>();

    while (selected.length < count && selected.length < allQuotes.length) {
      // Calculate weights favoring earlier indices
      const weights: number[] = [];
      let totalWeight = 0;

      for (let i = 0; i < allQuotes.length; i++) {
        if (usedIndices.has(i)) {
          weights[i] = 0;
        } else {
          // Bias calculation: earlier quotes get higher weight
          // biasPercent of 0 = uniform, 100 = heavily favor early
          const normalizedBias = biasPercent / 100;
          const positionRatio = 1 - i / allQuotes.length; // 1 for first quote, 0 for last
          const weight = 1 + normalizedBias * positionRatio * 9; // Range: 1 to 10
          weights[i] = weight;
          totalWeight += weight;
        }
      }

      // Select based on weighted probability
      let random = Math.random() * totalWeight;
      let selectedIndex = -1;

      for (let i = 0; i < weights.length; i++) {
        random -= weights[i]!;
        if (random <= 0) {
          selectedIndex = i;
          break;
        }
      }

      if (selectedIndex >= 0 && !usedIndices.has(selectedIndex)) {
        selected.push(allQuotes[selectedIndex]!);
        usedIndices.add(selectedIndex);
      }
    }

    return selected;
  };

  // Track current quote index for rotation
  const currentQuoteIndexRef = useRef<number>(numQuotes);
  
  // Initialize quotes with random positions and velocities
  const [quotes, setQuotes] = useState<Quote[]>(() => {
    const quoteTexts = getRandomQuotes(numQuotes, BIAS_TOWARDS_EARLIER_QUOTES);
    return quoteTexts.map((text, index) => ({
      id: index,
      text,
      x: Math.random() * 80 + 10, // 10-90% of screen width
      y: Math.random() * 80 + 10, // 10-90% of screen height
      vx: (Math.random() - 0.5) * 0.15, // Random velocity -0.075 to 0.075 (slower start)
      vy: (Math.random() - 0.5) * 0.15,
      opacity: 1,
    }));
  });

  const quoteRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  // API handlers for start/stop streaming
  const handleStart = async () => {
    try {
      const userId = getUserId();
      const response = await fetch(`${API_BASE_URL}/api/stream/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start stream');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setIsRunning(true);
      
      console.log('Stream started:', data);
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Failed to start stream. Make sure the server is running on port 3001.');
    }
  };

  const handleStop = async () => {
    if (!sessionId) {
      setIsRunning(false);
      return;
    }

    try {
      const userId = getUserId();
      const response = await fetch(`${API_BASE_URL}/api/stream/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to stop stream');
      }

      const data = await response.json();
      console.log('Stream stopped:', data);
      
      setIsRunning(false);
      setSessionId(null);
    } catch (error) {
      console.error('Error stopping stream:', error);
      alert('Failed to stop stream. Make sure the server is running on port 3001.');
      // Still stop the animation even if API call fails
      setIsRunning(false);
      setSessionId(null);
    }
  };

  // Cycle quotes every 8 seconds: fade out, wait 1s, fade in new quotes
  useEffect(() => {
    if (!isRunning) return;
    
    const cycleQuotes = () => {
      // Check if we need to update quote count based on screen size
      const targetCount = targetQuoteCountRef.current;
      if (targetCount !== numQuotes) {
        setNumQuotes(targetCount);
        currentQuoteIndexRef.current = targetCount;
      }

      // Fade out current quotes
      setQuotes((prevQuotes) =>
        prevQuotes.map((quote) => ({ ...quote, opacity: 0 }))
      );

      // After 1 second, fade in new quotes
      setTimeout(() => {
        // Use the current target count (may have changed)
        const currentTargetCount = targetQuoteCountRef.current;
        
        // Get next quotes from the list (rotating through)
        const newQuoteTexts: string[] = [];
        for (let i = 0; i < currentTargetCount; i++) {
          const index = (currentQuoteIndexRef.current + i) % allQuotes.length;
          newQuoteTexts.push(allQuotes[index]!);
        }
        currentQuoteIndexRef.current =
          (currentQuoteIndexRef.current + currentTargetCount) %
          allQuotes.length;

        // Create new quotes with new positions and velocities
        setQuotes(
          newQuoteTexts.map((text, index) => ({
            id: index,
            text,
            x: Math.random() * 80 + 10,
            y: Math.random() * 80 + 10,
            vx: (Math.random() - 0.5) * 0.15,
            vy: (Math.random() - 0.5) * 0.15,
            opacity: 0, // Start invisible, will fade in
          }))
        );

        // Fade in new quotes
        setTimeout(() => {
          setQuotes((prevQuotes) =>
            prevQuotes.map((quote) => ({ ...quote, opacity: 1 }))
          );
        }, 50); // Small delay to ensure DOM update
      }, 1000);
    };

    // Start cycling every 8 seconds
    const intervalId = setInterval(cycleQuotes, 8000);

    return () => {
      clearInterval(intervalId);
    };
  }, [numQuotes, isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    
    const animate = () => {
      const container = containerRef.current;
      if (!container) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      setQuotes((prevQuotes) => {
        const updatedQuotes = prevQuotes.map((quote) => ({ ...quote }));

        // First, update positions based on velocity
        updatedQuotes.forEach((quote) => {
          quote.x += quote.vx;
          quote.y += quote.vy;

          // Get element bounds to check actual screen edges
          const el = quoteRefs.current.get(quote.id);
          if (el && container) {
            const rect = el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Check left edge (quote center should account for half width)
            const leftEdge = rect.left - containerRect.left;
            const rightEdge = rect.right - containerRect.left;
            const topEdge = rect.top - containerRect.top;
            const bottomEdge = rect.bottom - containerRect.top;

            // Bounce off left/right edges
            if (leftEdge < 0) {
              quote.vx *= -0.8;
              quote.x += (0 - leftEdge) / containerRect.width * 100;
              quote.x = Math.max(0, quote.x);
            } else if (rightEdge > containerRect.width) {
              quote.vx *= -0.8;
              const overflow = rightEdge - containerRect.width;
              quote.x -= overflow / containerRect.width * 100;
              quote.x = Math.min(100, quote.x);
            }

            // Bounce off top/bottom edges
            if (topEdge < 0) {
              quote.vy *= -0.8;
              quote.y += (0 - topEdge) / containerRect.height * 100;
              quote.y = Math.max(0, quote.y);
            } else if (bottomEdge > containerRect.height) {
              quote.vy *= -0.8;
              const overflow = bottomEdge - containerRect.height;
              quote.y -= overflow / containerRect.height * 100;
              quote.y = Math.min(100, quote.y);
            }
          } else {
            // Fallback to percentage-based bounds if element not ready
            if (quote.x < 5 || quote.x > 95) {
              quote.vx *= -0.8;
              quote.x = Math.max(5, Math.min(95, quote.x));
            }
            if (quote.y < 5 || quote.y > 95) {
              quote.vy *= -0.8;
              quote.y = Math.max(5, Math.min(95, quote.y));
            }
          }
        });

        // Update DOM positions before collision detection
        updatedQuotes.forEach((quote) => {
          const el = quoteRefs.current.get(quote.id);
          if (el) {
            el.style.left = `${quote.x}%`;
            el.style.top = `${quote.y}%`;
          }
        });

        // Magnetic repulsion system - detect proximity and apply repulsion force
        for (let i = 0; i < updatedQuotes.length; i++) {
          for (let j = i + 1; j < updatedQuotes.length; j++) {
            const q1 = updatedQuotes[i]!;
            const q2 = updatedQuotes[j]!;
            const el1 = quoteRefs.current.get(q1.id);
            const el2 = quoteRefs.current.get(q2.id);

            if (!el1 || !el2) continue;
            
            // Skip collision detection for quotes that are fading in/out
            if (q1.opacity < 0.5 || q2.opacity < 0.5) continue;

            const rect1 = el1.getBoundingClientRect();
            const rect2 = el2.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Calculate centers
            const center1X = rect1.left + rect1.width / 2;
            const center1Y = rect1.top + rect1.height / 2;
            const center2X = rect2.left + rect2.width / 2;
            const center2Y = rect2.top + rect2.height / 2;

            const dx = center2X - center1X;
            const dy = center2Y - center1Y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance === 0) continue;

            const nx = dx / distance;
            const ny = dy / distance;

            // Calculate minimum distance needed (sum of half-widths/half-heights + padding)
            const minDistance = Math.max(
              (rect1.width + rect2.width) / 2,
              (rect1.height + rect2.height) / 2
            ) + 20; // Add 20px padding for magnetic field

            // Check if quotes are too close (magnetic repulsion zone)
            if (distance < minDistance) {
              const overlap = minDistance - distance;
              const repulsionStrength = Math.pow(overlap / minDistance, 1.5); // Stronger when closer

              // Apply repulsion force to velocities (like magnets repelling)
              const repulsionForce = repulsionStrength * 0.15; // Strong repulsion coefficient
              
              q1.vx -= repulsionForce * nx;
              q1.vy -= repulsionForce * ny;
              q2.vx += repulsionForce * nx;
              q2.vy += repulsionForce * ny;

              // If they're actually overlapping, separate immediately
              const overlapX = Math.min(rect1.right - rect2.left, rect2.right - rect1.left);
              const overlapY = Math.min(rect1.bottom - rect2.top, rect2.bottom - rect1.top);

              if (overlapX > 0 && overlapY > 0) {
                const overlapPx = Math.min(overlapX, overlapY);
                const containerWidth = containerRect.width;
                const containerHeight = containerRect.height;
                
                // Strong immediate separation
                const separationAmount = overlapPx * 1.5; // 150% separation
                const separationPctX = (separationAmount / containerWidth) * 100;
                const separationPctY = (separationAmount / containerHeight) * 100;

                q1.x -= separationPctX * nx * 0.5;
                q1.y -= separationPctY * ny * 0.5;
                q2.x += separationPctX * nx * 0.5;
                q2.y += separationPctY * ny * 0.5;

                // Clamp positions
                q1.x = Math.max(5, Math.min(95, q1.x));
                q1.y = Math.max(5, Math.min(95, q1.y));
                q2.x = Math.max(5, Math.min(95, q2.x));
                q2.y = Math.max(5, Math.min(95, q2.y));

                // Update DOM immediately
                el1.style.left = `${q1.x}%`;
                el1.style.top = `${q1.y}%`;
                el2.style.left = `${q2.x}%`;
                el2.style.top = `${q2.y}%`;

                // Strong bounce on collision
                const relVelX = q1.vx - q2.vx;
                const relVelY = q1.vy - q2.vy;
                const velAlongNormal = relVelX * nx + relVelY * ny;

                if (velAlongNormal < 0) {
                  const bounce = 1.2; // Stronger bounce (elastic)
                  const impulse = velAlongNormal * bounce;

                  q1.vx -= impulse * nx;
                  q1.vy -= impulse * ny;
                  q2.vx += impulse * nx;
                  q2.vy += impulse * ny;
                }
              }
            }

            // Limit velocity
            const maxVel = 0.8; // Increased max velocity for bouncier feel
            q1.vx = Math.max(-maxVel, Math.min(maxVel, q1.vx));
            q1.vy = Math.max(-maxVel, Math.min(maxVel, q1.vy));
            q2.vx = Math.max(-maxVel, Math.min(maxVel, q2.vx));
            q2.vy = Math.max(-maxVel, Math.min(maxVel, q2.vy));
          }
        }

        // Apply deceleration to slow quotes back down to max normal speed
        // Calculate deceleration rate based on deltaTime (frame-rate independent)
        // Target: reduce speed to MAX_NORMAL_SPEED over DECELERATION_TIME seconds
        const deltaTime = 1 / 60; // Assume 60fps, ~16.67ms per frame
        const decelerationRate = 1 / DECELERATION_TIME; // Per second
        
        updatedQuotes.forEach((quote) => {
          const currentSpeed = Math.sqrt(quote.vx * quote.vx + quote.vy * quote.vy);
          
          if (currentSpeed > MAX_NORMAL_SPEED) {
            // Calculate target velocity (maintain direction, reduce to max speed)
            const directionX = quote.vx / currentSpeed;
            const directionY = quote.vy / currentSpeed;
            const targetVx = directionX * MAX_NORMAL_SPEED;
            const targetVy = directionY * MAX_NORMAL_SPEED;
            
            // Decelerate towards target velocity over DECELERATION_TIME seconds
            // Lerp factor: how much to move towards target this frame
            const lerpFactor = decelerationRate * deltaTime;
            quote.vx = quote.vx + (targetVx - quote.vx) * lerpFactor;
            quote.vy = quote.vy + (targetVy - quote.vy) * lerpFactor;
          }
        });

        return updatedQuotes;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning]);

  return (
    <div className="app" ref={containerRef}>
      <Leaderboard />
      
      <div className="controls">
        {!isRunning ? (
          <button 
            type="button"
            className="control-button start-button" 
            onClick={handleStart}
          >
            Start
          </button>
        ) : (
          <button 
            type="button"
            className="control-button stop-button" 
            onClick={handleStop}
          >
            Stop
          </button>
        )}
      </div>
      
      {isRunning && quotes.map((quote) => (
        <div
          key={quote.id}
          ref={(el) => {
            if (el) {
              quoteRefs.current.set(quote.id, el);
            } else {
              quoteRefs.current.delete(quote.id);
            }
          }}
          className="quote"
          style={{
            left: `${quote.x}%`,
            top: `${quote.y}%`,
            opacity: quote.opacity,
          }}
        >
          {quote.text}
        </div>
      ))}
    </div>
  );
}

export default App;
