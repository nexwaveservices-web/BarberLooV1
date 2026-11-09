import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Production diagnostics and startup verification
if (typeof window !== 'undefined') {
  (window as any).__BARBERLOO_MOUNTED__ = true;
  window.addEventListener('error', (event) => {
    // Safe non-sensitive diagnostic logging
    console.warn('[BarberLoo Runtime Notice]:', event.message || 'Script notice', event.filename, event.lineno);
  });
  window.addEventListener('unhandledrejection', (event) => {
    // Gracefully handle and prevent transient background promise rejections from causing noise
    const reason = event.reason;
    const msg =
      reason?.message ||
      (typeof reason === 'string'
        ? reason
        : reason && typeof reason === 'object'
        ? JSON.stringify(reason)
        : 'Transient background task rejected');
    console.warn('[BarberLoo Handled Background Notice]:', msg);
    // Mark as handled to prevent browser error reporting tools from triggering
    event.preventDefault();
  });
}

function mountBarberLooApp() {
  let rootElement = document.getElementById('root');
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.appendChild(rootElement);
  }

  try {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    if (typeof window !== 'undefined') {
      (window as any).__BARBERLOO_RENDERED__ = true;
    }
  } catch (err: any) {
    console.error('[BarberLoo Root Mounting Exception]:', err?.message || err);
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAF6EA;color:#111113;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
          <div style="max-width:380px;background:#241719;color:#FFF9E8;padding:26px;border-radius:20px;border:1px solid rgba(241,225,148,0.25);box-shadow:0 20px 40px rgba(0,0,0,0.3);">
            <h2 style="font-size:20px;font-weight:700;color:#FFF9E8;margin-bottom:8px;">Temporarily Unavailable</h2>
            <p style="font-size:12px;color:#8A8178;line-height:1.6;margin-bottom:18px;">The application encountered an unexpected initialization error.</p>
            <button onclick="window.location.reload(true)" style="padding:10px 20px;border-radius:12px;background:#F1E194;color:#111113;font-size:11px;font-weight:700;text-transform:uppercase;cursor:pointer;border:none;">Reload</button>
          </div>
        </div>
      `;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountBarberLooApp);
} else {
  mountBarberLooApp();
}

