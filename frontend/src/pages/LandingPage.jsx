import { useNavigate } from 'react-router-dom';

const FEATURES = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'AI-Powered Generation',
    desc: 'Describe your API in plain English. Gemini AI designs a full schema and live endpoints instantly.',
    color: 'text-brand-400',
    bg: 'bg-brand-600/10 ring-brand-700/30',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Live Mock Endpoints',
    desc: 'Every endpoint is immediately hittable — fire real HTTP requests and inspect JSON responses.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-600/10 ring-emerald-700/30',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    title: 'No Sign-Up Required',
    desc: 'Guest sessions give you a full playground immediately. Sign up only when you want to save.',
    color: 'text-sky-400',
    bg: 'bg-sky-600/10 ring-sky-700/30',
  },
];

const STEPS = [
  { n: '01', label: 'Describe', detail: 'Type a plain-English description of your API' },
  { n: '02', label: 'Generate', detail: 'Gemini AI builds a full schema + endpoints' },
  { n: '03', label: 'Hit It',   detail: 'Fire live requests and inspect realistic data' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gray-950">

      {/* ── Background glow ────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Top-center radial */}
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px]
                        -translate-x-1/2 -translate-y-1/3 rounded-full
                        bg-brand-600/10 blur-3xl" />
        {/* Bottom-right accent */}
        <div className="absolute -bottom-32 right-0 h-[400px] w-[500px]
                        rounded-full bg-purple-700/8 blur-3xl" />
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 shadow-md shadow-brand-900/60">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight">
            Mock<span className="text-brand-400">Flow</span>
            <span className="ml-1 font-normal text-gray-600">AI</span>
          </span>
        </div>
        <button
          className="btn-ghost py-1.5 px-4 text-sm"
          onClick={() => navigate('/playground')}
        >
          Open Playground →
        </button>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 flex-col items-center
                       justify-center px-6 py-20 text-center">

        {/* Badge */}
        <div className="mb-6 inline-flex animate-fade-in items-center gap-2 rounded-full
                        border border-brand-800/60 bg-brand-950/60 px-4 py-1.5
                        backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-xs font-medium text-brand-300 tracking-wide">
            Powered by Gemini 2.5 Flash · Zero cost · No sign-up
          </span>
        </div>

        {/* Headline */}
        <h1 className="animate-slide-up text-5xl font-extrabold leading-tight
                       tracking-tight sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '0.05s' }}>
          <span className="text-white">Mock APIs,</span>
          <br />
          <span className="text-gradient">Instantly.</span>
        </h1>

        {/* Sub-headline */}
        <p className="mt-6 max-w-xl animate-slide-up text-lg text-gray-400
                      leading-relaxed"
           style={{ animationDelay: '0.1s' }}>
          Describe your API in plain English. MockFlow AI generates a full schema,
          realistic fake data, and live hittable endpoints — in under 5 seconds.
        </p>

        {/* CTA group */}
        <div className="mt-10 flex animate-slide-up flex-col items-center gap-3 sm:flex-row"
             style={{ animationDelay: '0.15s' }}>
          <button
            className="btn-primary glow-brand px-8 py-3.5 text-base font-bold"
            onClick={() => navigate('/playground')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Launch Playground
          </button>
          <span className="text-xs text-gray-600">No account needed · Works immediately</span>
        </div>

        {/* Steps */}
        <div className="mt-16 flex animate-fade-in flex-col items-center gap-6 sm:flex-row sm:gap-0"
             style={{ animationDelay: '0.25s' }}>
          {STEPS.map((step, i) => (
            <div key={step.n} className="flex items-center">
              <div className="flex flex-col items-center gap-2 px-8 text-center">
                <span className="font-mono text-xs font-bold text-brand-600">{step.n}</span>
                <span className="text-sm font-semibold text-gray-200">{step.label}</span>
                <span className="max-w-[140px] text-xs text-gray-600">{step.detail}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="hidden h-px w-12 bg-gradient-to-r from-gray-700 to-gray-800 sm:block" />
              )}
            </div>
          ))}
        </div>
      </main>

      {/* ── Features grid ─────────────────────────────────────────────────── */}
      <section className="relative z-10 border-t border-gray-800/50 bg-gray-900/30
                          px-6 py-16 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-lg font-semibold text-gray-400">
            Everything you need for rapid API prototyping
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-glass flex flex-col gap-3 transition-all duration-200
                           hover:border-white/10 hover:bg-white/[0.05]"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl
                                 ring-1 ${f.bg} ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-200">{f.title}</h3>
                <p className="text-xs leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-gray-800/40 px-8 py-5
                         text-center text-xs text-gray-700">
        MockFlow AI · Built for hackathons · Zero-cost stack
      </footer>
    </div>
  );
}
