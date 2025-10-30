import { useState } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <header className="header">
        <h1>🚀 React + Vite App</h1>
        <p className="subtitle">Modern, fast, and beautiful</p>
      </header>

      <main className="main">
        <div className="card">
          <h2>Welcome to Your Boilerplate!</h2>
          <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>
            This is a clean React + TypeScript + Vite starter with Biome for linting and formatting.
          </p>
          
          <div style={{ marginBottom: '2rem' }}>
            <button type="button" onClick={() => setCount(count + 1)}>
              Count is {count}
            </button>
          </div>

          <div className="features">
            <h3 style={{ marginBottom: '1rem' }}>✨ Features</h3>
            <ul style={{ textAlign: 'left', lineHeight: '2' }}>
              <li>⚡️ React 18 + TypeScript</li>
              <li>🚀 Vite for blazing fast builds</li>
              <li>🎨 Beautiful dark theme UI</li>
              <li>🔧 Biome for linting & formatting</li>
              <li>📦 ES6 modules</li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Built with React + Vite + TypeScript</p>
      </footer>
    </div>
  );
}

export default App;
