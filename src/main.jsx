import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '../styles.css';

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Offline support. Registered after load so it never competes with the first
// paint on a slow connection.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  /*
   * Take a new deploy without waiting to be hard-reloaded.
   *
   * The worker calls skipWaiting() and claims open pages, so the controller
   * swaps underneath a tab whose HTML and JS are still the previous build. The
   * page carries on running old code — with the URL, the routes and the
   * features of a version that no longer exists — until somebody thinks to
   * press Ctrl+Shift+R. Nobody thinks to.
   *
   * `hadController` is the guard that matters. On a first visit there is no
   * controller, claim() sets one, and controllerchange fires for a worker that
   * is not an update at all; reloading there would restart the page for every
   * new visitor. Only a swap of an EXISTING controller means the build changed.
   */
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline is a bonus, not a requirement */ });
  });
}
