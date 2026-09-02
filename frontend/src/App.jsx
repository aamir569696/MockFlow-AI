import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import PlaygroundPage from './pages/PlaygroundPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AuthModal from './components/auth/AuthModal.jsx';

/**
 * App — root router.
 *
 * Route map:
 *   /            → LandingPage
 *   /playground  → PlaygroundPage  (guest-accessible)
 *   /dashboard   → DashboardPage   (auth-gated, enforced inside component)
 *   *            → NotFoundPage
 */
function App() {
  return (
    <>
      {/* Global auth overlay — rendered here so it sits above all routes */}
      <AuthModal />

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/playground" element={<PlaygroundPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;
