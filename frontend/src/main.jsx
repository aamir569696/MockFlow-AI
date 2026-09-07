import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ReactLenis } from 'lenis/react';
import App from './App.jsx';
import './index.css';

/**
 * Lenis smooth-scroll options.
 *
 * Tuned for a premium-but-responsive feel — enough easing/inertia to feel
 * polished on both wheel and trackpad, without the floaty lag that makes an
 * app feel unresponsive:
 *   • lerp 0.12       — quick catch-up (higher = snappier, lower = floatier)
 *   • wheelMultiplier — 1 keeps wheel distance natural/precise
 *   • touch smoothing OFF — native touch scroll stays crisp on mobile
 *
 * Nested scroll containers opt OUT of page-Lenis via `data-lenis-prevent`
 * (see the `.smooth-scroll` utility) so they scroll independently.
 */
const LENIS_OPTIONS = {
  lerp: 0.12,
  wheelMultiplier: 1,
  smoothWheel: true,
  smoothTouch: false,
  syncTouch: false,
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ReactLenis root options={LENIS_OPTIONS}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ReactLenis>
  </React.StrictMode>
);
