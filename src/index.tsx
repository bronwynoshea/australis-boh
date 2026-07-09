import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import NativeSlotzApp from '../imports/upstream-apps/slotz-app/src/App';
import NativeLoftApp from '../imports/upstream-apps/loft-app/App';
import '../imports/upstream-apps/slotz-app/src/index.css';
import '../imports/upstream-apps/loft-app/index.css';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const queryClient = new QueryClient();

const root = ReactDOM.createRoot(rootElement);
const pathParts = window.location.pathname.split('/').filter(Boolean);
const isExternalSlotzRoute =
  window.location.hostname === 'slotz.boh.australis.cloud' ||
  (pathParts[0] === 'slotz' && (
    (pathParts.length === 4 && pathParts[1] !== 'manage') ||
    (pathParts.length === 3 && pathParts[1] === 'manage')
  ));
const isExternalLoftRoute = window.location.hostname === 'loft.boh.australis.cloud';

if (isExternalLoftRoute) {
  document.title = 'Loft';
}

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {isExternalSlotzRoute ? (
        <BrowserRouter>
          <NativeSlotzApp />
        </BrowserRouter>
      ) : isExternalLoftRoute ? (
        <NativeLoftApp />
      ) : (
        <BrowserRouter>
          <App />
        </BrowserRouter>
      )}
    </QueryClientProvider>
  </React.StrictMode>
);

