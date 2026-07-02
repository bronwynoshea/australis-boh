import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const entryEnv = (import.meta as any)?.env;
if (entryEnv?.DEV) {
  // eslint-disable-next-line no-console
  console.warn('[ENV DEBUG ENTRY]', {
    mode: entryEnv.MODE,
    base: entryEnv.BASE_URL,
    VITE_DAILY_DOMAIN: entryEnv.VITE_DAILY_DOMAIN,
    DAILY_KEYS: Object.keys(entryEnv).filter((k) => k.includes('DAILY')),
    ALL_VITE_KEYS: Object.keys(entryEnv).filter((k) => k.startsWith('VITE_')).slice(0, 25),
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);