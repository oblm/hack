import './App.css';
import quotesData from './quotes.json';

const allQuotes: string[] = quotesData;

// Configuration
const NUM_QUOTES_TO_DISPLAY = 2;
const BIAS_TOWARDS_EARLIER_QUOTES = 50; // Percentage (0-100)

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

  const quotes = getRandomQuotes(NUM_QUOTES_TO_DISPLAY, BIAS_TOWARDS_EARLIER_QUOTES);

  return (
    <div className="app">
      {quotes.map((quote, index) => (
        <div key={index} className="quote">
          {quote}
        </div>
      ))}
    </div>
  );
}

export default App;
