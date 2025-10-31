import { useState, useEffect, useRef } from 'react';
import './App.css';
import quotesData from './quotes.json';

const allQuotes: string[] = quotesData;

// Configuration
const NUM_QUOTES_TO_DISPLAY = 2;
const BIAS_TOWARDS_EARLIER_QUOTES = 50; // Percentage (0-100)
const MAX_NORMAL_SPEED = 0.15; // Maximum speed for normal drift (after deceleration)
const DECELERATION_TIME = 0.5; // Time in seconds to decelerate to max speed

interface Quote {
  id: number;
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function App() {
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

  const quoteTexts = getRandomQuotes(NUM_QUOTES_TO_DISPLAY, BIAS_TOWARDS_EARLIER_QUOTES);
  
  // Initialize quotes with random positions and velocities
  const [quotes, setQuotes] = useState<Quote[]>(() => {
    return quoteTexts.map((text, index) => ({
      id: index,
      text,
      x: Math.random() * 80 + 10, // 10-90% of screen width
      y: Math.random() * 80 + 10, // 10-90% of screen height
      vx: (Math.random() - 0.5) * 0.15, // Random velocity -0.075 to 0.075 (slower start)
      vy: (Math.random() - 0.5) * 0.15,
    }));
  });

  const quoteRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
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
  }, []);

  return (
    <div className="app" ref={containerRef}>
      {quotes.map((quote) => (
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
          }}
        >
          {quote.text}
        </div>
      ))}
    </div>
  );
}

export default App;
