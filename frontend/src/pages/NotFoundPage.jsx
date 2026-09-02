import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-bold text-gray-700">404</h1>
      <p className="text-gray-400">That page doesn't exist.</p>
      <button className="btn-ghost" onClick={() => navigate('/')}>
        ← Back to home
      </button>
    </main>
  );
}
