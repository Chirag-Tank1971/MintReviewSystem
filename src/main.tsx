import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

// Suppress known internal Chrome DevTools Live Metrics timer bug (reportAllChanges / startTime)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (
      event.message?.includes("reading 'startTime'") ||
      event.message?.includes('reportAllChanges') ||
      (typeof event.filename === 'string' && event.filename.includes('VM') && event.message?.includes('startTime'))
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
