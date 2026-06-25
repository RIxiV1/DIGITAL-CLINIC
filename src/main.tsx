import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './app/App';
import { injectStructuredData } from './app/seo/structuredData';

// Schema.org JSON-LD for rich results. Injected (not inline in index.html)
// because the strict CSP blocks inline scripts — see the module header.
injectStructuredData();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
