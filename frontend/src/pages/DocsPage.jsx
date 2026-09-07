import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';

// Reuse the app's method badge classes (defined in index.css).
const methodClass = (m) => `method-badge method-${(m || 'GET').toUpperCase()}`;

function fullMockUrl(path) {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

// ── curl builder for an endpoint ────────────────────────────────────────────────
function buildCurl(ep, auth) {
  const url = fullMockUrl(ep.path);
  const parts = [`curl -X ${ep.method}`, `  "${url}"`];
  if (ep.requestBody) {
    parts.splice(1, 0, `  -H "Content-Type: application/json"`);
  }
  // When the API requires auth, every example includes the credential header.
  if (auth?.enabled) {
    parts.push(`  -H "${auth.headerName}: ${auth.headerValue}"`);
  }
  if (ep.requestBody) {
    const body = JSON.stringify(ep.requestBody);
    parts.push(`  -d '${body}'`);
  }
  return parts.join(' \\\n');
}

// ── Copy-to-clipboard button ─────────────────────────────────────────────────────
function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1600); },
      () => {},
    );
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]
                  font-semibold transition-all
                  ${copied
                    ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400'
                    : 'border-gray-700 bg-gray-800/60 text-gray-400 hover:border-gray-600 hover:text-gray-200'} ${className}`}
      aria-label={label}
    >
      {copied ? (
        <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
      ) : (
        <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>{label}</>
      )}
    </button>
  );
}

function JsonBlock({ value }) {
  if (value === null || value === undefined) {
    return <pre className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950/80 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-gray-600">// no content</pre>;
  }
  return (
    <pre className="smooth-scroll max-h-72 overflow-auto rounded-lg border border-gray-800
                    bg-gray-950/80 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-emerald-300/90"
         data-lenis-prevent>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ── Single endpoint card ──────────────────────────────────────────────────────────
function EndpointCard({ ep, auth }) {
  const [tab, setTab] = useState('response');
  const curl = useMemo(() => buildCurl(ep, auth), [ep, auth]);

  return (
    <div className="rounded-xl border border-gray-800/70 bg-gray-900/40">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800/60 px-4 py-3">
        <span className={methodClass(ep.method)}>{ep.method}</span>
        <code className="min-w-0 break-all font-mono text-xs text-gray-300">{ep.path}</code>
        {ep.isCollection && (
          <span className="rounded-full bg-brand-950/60 px-2 py-0.5 text-[10px] text-brand-400 ring-1 ring-brand-800/50">
            collection
          </span>
        )}
        <div className="ml-auto">
          <CopyButton text={fullMockUrl(ep.path)} label="Copy URL" />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        {ep.description && <p className="text-xs text-gray-500">{ep.description}</p>}

        {/* Fields table */}
        {ep.fields?.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              Schema Fields
            </p>
            <div className="overflow-hidden rounded-lg border border-gray-800">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/70 text-gray-500">
                    <th className="px-3 py-1.5 font-semibold uppercase tracking-widest">Field</th>
                    <th className="px-3 py-1.5 font-semibold uppercase tracking-widest">Type</th>
                    <th className="px-3 py-1.5 font-semibold uppercase tracking-widest">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {ep.fields.map((f) => (
                    <tr key={f.name}>
                      <td className="px-3 py-1.5 font-mono text-gray-300">{f.name}</td>
                      <td className="px-3 py-1.5">
                        <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-amber-300">
                          {f.type}{f.format ? ` · ${f.format}` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">{f.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Example tabs */}
        <div>
          <div className="mb-1.5 flex items-center gap-1">
            {[
              { id: 'response', label: 'Example Response' },
              ...(ep.requestBody ? [{ id: 'request', label: 'Request Body' }] : []),
              { id: 'curl', label: 'cURL' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors
                            ${tab === t.id
                              ? 'bg-gray-800 text-gray-100 ring-1 ring-gray-700'
                              : 'text-gray-600 hover:text-gray-300'}`}
              >
                {t.label}
              </button>
            ))}
            <div className="ml-auto">
              <CopyButton
                text={tab === 'curl' ? curl : JSON.stringify(tab === 'request' ? ep.requestBody : ep.sampleResponse, null, 2)}
                label="Copy"
              />
            </div>
          </div>

          {tab === 'curl' ? (
            <pre className="smooth-scroll overflow-auto rounded-lg border border-gray-800
                            bg-gray-950/80 px-3 py-2.5 font-mono text-[11px] leading-relaxed
                            text-indigo-200/90 whitespace-pre" data-lenis-prevent>
              {curl}
            </pre>
          ) : tab === 'request' ? (
            <JsonBlock value={ep.requestBody} />
          ) : (
            <JsonBlock value={ep.sampleResponse} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── DocsPage ───────────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const { sessionId } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', data: null, error: null });
    fetch(`/api/docs/${sessionId}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setState({ status: 'error', data: null, error: body?.error?.message ?? 'Failed to load docs.' });
          return;
        }
        setState({ status: 'ready', data: body, error: null });
      })
      .catch((err) => {
        if (alive) setState({ status: 'error', data: null, error: err.message ?? 'Network error.' });
      });
    return () => { alive = false; };
  }, [sessionId]);

  // Group endpoints by resource for a sectioned layout.
  const grouped = useMemo(() => {
    const g = {};
    for (const ep of state.data?.endpoints ?? []) {
      (g[ep.resource] ??= []).push(ep);
    }
    return g;
  }, [state.data]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-dvh bg-gray-950 text-gray-100">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-gray-800/70 bg-gray-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600
                          shadow-lg shadow-brand-900/50">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight">
            Mock<span className="text-brand-400">Flow</span>
            <span className="ml-1.5 font-normal text-gray-600">API Docs</span>
          </span>
          {state.status === 'ready' && (
            <div className="ml-auto">
              <CopyButton text={shareUrl} label="Copy link" />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Loading */}
        {state.status === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <svg className="h-6 w-6 animate-spin-slow text-brand-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm text-gray-500">Loading documentation…</p>
          </div>
        )}

        {/* Error / not found */}
        {state.status === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl
                            border border-red-900/40 bg-red-950/30">
              <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.34 3.94l-8.4 14.5A1.5 1.5 0 003.24 21h17.52a1.5 1.5 0 001.3-2.56l-8.4-14.5a1.5 1.5 0 00-2.6 0z" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-gray-200">Documentation unavailable</h1>
            <p className="max-w-md text-sm text-gray-500">{state.error}</p>
            <Link to="/playground" className="mt-1 text-xs text-brand-400 hover:underline">
              Go to MockFlow →
            </Link>
          </div>
        )}

        {/* Ready */}
        {state.status === 'ready' && state.data && (
          <>
            {/* API header */}
            <div className="mb-8 animate-fade-in">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">{state.data.apiName}</h1>
              {state.data.description && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500">{state.data.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                <span className="rounded-full bg-gray-800/80 px-2 py-0.5">
                  {state.data.endpoints.length} endpoint{state.data.endpoints.length !== 1 ? 's' : ''}
                </span>
                <span className="rounded-full bg-gray-800/80 px-2 py-0.5">
                  {state.data.resources.length} resource{state.data.resources.length !== 1 ? 's' : ''}
                </span>
                {state.data.auth?.enabled && (
                  <span className="rounded-full bg-amber-950/60 px-2 py-0.5 text-amber-400 ring-1 ring-amber-800/50">
                    🔒 Auth required
                  </span>
                )}
                <span className="text-gray-700">Read-only · publicly shareable</span>
              </div>

              {/* Authentication callout */}
              {state.data.auth?.enabled && (
                <div className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/15 p-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <h3 className="text-sm font-bold text-amber-200">Authentication required</h3>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                    All requests must include a valid credential. Use a Bearer token in the
                    <code className="mx-1 rounded bg-gray-800 px-1 font-mono text-amber-300">Authorization</code>
                    header, or send the API key in the
                    <code className="mx-1 rounded bg-gray-800 px-1 font-mono text-amber-300">x-api-key</code>
                    header. Missing or invalid credentials return
                    <span className="mx-1 font-mono text-red-400">401 Unauthorized</span>.
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Bearer</span>
                      <code className="min-w-0 flex-1 truncate rounded-lg border border-gray-800 bg-gray-950/70 px-2.5 py-1.5 font-mono text-[11px] text-indigo-300/90"
                            title={state.data.auth.headerValue}>
                        Authorization: {state.data.auth.headerValue}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-600">API Key</span>
                      <code className="min-w-0 flex-1 truncate rounded-lg border border-gray-800 bg-gray-950/70 px-2.5 py-1.5 font-mono text-[11px] text-amber-300/90"
                            title={state.data.auth.apiKey}>
                        {state.data.auth.apiKeyHeader}: {state.data.auth.apiKey}
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {state.data.endpoints.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-600">
                This API has no endpoints yet.
              </p>
            ) : (
              <div className="flex flex-col gap-8">
                {Object.entries(grouped).map(([resource, eps]) => (
                  <section key={resource} className="animate-fade-in">
                    <div className="mb-3 flex items-center gap-2">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-300">{resource}</h2>
                      <span className="h-px flex-1 bg-gray-800/60" />
                      <span className="text-[10px] text-gray-700">{eps.length} route{eps.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {eps.map((ep) => (
                        <EndpointCard key={`${ep.method}-${ep.slug}`} ep={ep} auth={state.data.auth} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <footer className="mt-12 border-t border-gray-800/60 pt-6 text-center text-[11px] text-gray-700">
              Generated by MockFlow AI · Docs reflect the current API and update automatically.
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
