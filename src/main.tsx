import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './app/App';
import { injectStructuredData } from './app/seo/structuredData';
import { registerSW } from 'virtual:pwa-register';

// Schema.org JSON-LD for rich results. Injected (not inline in index.html)
// because the strict CSP blocks inline scripts — see the module header.
injectStructuredData();

// Register the offline service worker. Bundled here (same-origin) rather than
// via an injected inline <script>, which the strict CSP would block.
// autoUpdate: a new deploy activates on the next load, no prompt. Fully
// best-effort — a registration failure never blocks the app from rendering.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
