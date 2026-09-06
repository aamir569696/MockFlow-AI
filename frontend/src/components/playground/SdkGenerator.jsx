import { useState, useMemo } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

/**
 * SdkGenerator — Multi-Language SDK snippet generator.
 *
 * Parses the active endpoint (method, URL, session, schema resource) and
 * produces copy-pasteable request boilerplate for 10 runtimes.
 *
 * All snippets are built purely client-side from the current playground state.
 */

// ── Language registry ─────────────────────────────────────────────────────────

const LANGUAGES = [
  { id: 'fetch',   label: 'JS · Fetch',   icon: '🟨', mono: false },
  { id: 'axios',   label: 'JS · Axios',   icon: '🔷', mono: false },
  { id: 'python',  label: 'Python',       icon: '🐍', mono: false },
  { id: 'go',      label: 'Go',           icon: '🐹', mono: false },
  { id: 'java',    label: 'Java',         icon: '☕', mono: false },
  { id: 'swift',   label: 'Swift',        icon: '🦉', mono: false },
  { id: 'kotlin',  label: 'Kotlin',       icon: '🟪', mono: false },
  { id: 'php',     label: 'PHP',          icon: '🐘', mono: false },
  { id: 'ruby',    label: 'Ruby',         icon: '💎', mono: false },
  { id: 'curl',    label: 'cURL',         icon: '⌨️', mono: true  },
];

// ── Sample body from schema resource ──────────────────────────────────────────

function sampleBody(ep, schema) {
  const resource = ep.resource ?? Object.keys(schema ?? {})[0];
  const props = schema?.[resource]?.properties ?? {};
  if (!Object.keys(props).length) return { key: 'value' };
  const obj = {};
  for (const [field, spec] of Object.entries(props)) {
    if (field === 'id') continue;                    // server assigns id
    const t = spec?.type;
    if (t === 'string')       obj[field] = spec.format === 'email' ? 'user@example.com' : `sample_${field}`;
    else if (t === 'number' || t === 'integer') obj[field] = spec.minimum ?? 1;
    else if (t === 'boolean') obj[field] = true;
    else if (t === 'array')   obj[field] = [];
    else                       obj[field] = null;
  }
  return obj;
}

// ── Snippet builders — one per runtime ────────────────────────────────────────

function buildSnippet(lang, { method, url, body, hasBody, session }) {
  const jsonBody   = JSON.stringify(body, null, 2);
  const jsonInline = JSON.stringify(body);
  const M = method.toUpperCase();

  switch (lang) {
    case 'fetch':
      return `const res = await fetch("${url}", {
  method: "${M}",
  headers: {
    "Content-Type": "application/json",
    "x-mockflow-session": "${session}"
  }${hasBody ? `,\n  body: JSON.stringify(${jsonBody.replace(/\n/g, '\n  ')})` : ''}
});
const data = await res.json();
console.log(data);`;

    case 'axios':
      return `import axios from "axios";

const { data } = await axios({
  method: "${M.toLowerCase()}",
  url: "${url}",
  headers: {
    "Content-Type": "application/json",
    "x-mockflow-session": "${session}"
  }${hasBody ? `,\n  data: ${jsonBody.replace(/\n/g, '\n  ')}` : ''}
});
console.log(data);`;

    case 'python':
      return `import requests

resp = requests.${M.toLowerCase()}(
    "${url}",
    headers={
        "Content-Type": "application/json",
        "x-mockflow-session": "${session}",
    }${hasBody ? `,\n    json=${jsonInline.replace(/"/g, "'")}` : ''}
)
print(resp.json())`;

    case 'go':
      return `package main

import (
    "bytes"
    "fmt"
    "io"
    "net/http"
)

func main() {
    ${hasBody ? `payload := bytes.NewBufferString(\`${jsonInline}\`)` : `var payload io.Reader = nil`}
    req, _ := http.NewRequest("${M}", "${url}", payload)
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("x-mockflow-session", "${session}")

    res, _ := http.DefaultClient.Do(req)
    defer res.Body.Close()
    b, _ := io.ReadAll(res.Body)
    fmt.Println(string(b))
}`;

    case 'java':
      return `import java.net.URI;
import java.net.http.*;

HttpClient client = HttpClient.newHttpClient();
HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("${url}"))
    .header("Content-Type", "application/json")
    .header("x-mockflow-session", "${session}")
    .method("${M}", ${hasBody
      ? `HttpRequest.BodyPublishers.ofString("${jsonInline.replace(/"/g, '\\"')}")`
      : 'HttpRequest.BodyPublishers.noBody()'})
    .build();

HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
System.out.println(res.body());`;

    case 'swift':
      return `import Foundation

var req = URLRequest(url: URL(string: "${url}")!)
req.httpMethod = "${M}"
req.setValue("application/json", forHTTPHeaderField: "Content-Type")
req.setValue("${session}", forHTTPHeaderField: "x-mockflow-session")
${hasBody ? `req.httpBody = """
${jsonBody}
""".data(using: .utf8)` : ''}
let (data, _) = try await URLSession.shared.data(for: req)
print(String(data: data, encoding: .utf8)!)`;

    case 'kotlin':
      return `import java.net.URI
import java.net.http.*

val client = HttpClient.newHttpClient()
val req = HttpRequest.newBuilder()
    .uri(URI.create("${url}"))
    .header("Content-Type", "application/json")
    .header("x-mockflow-session", "${session}")
    .method("${M}", ${hasBody
      ? `HttpRequest.BodyPublishers.ofString(""" ${jsonInline} """)`
      : 'HttpRequest.BodyPublishers.noBody()'})
    .build()

val res = client.send(req, HttpResponse.BodyHandlers.ofString())
println(res.body())`;

    case 'php':
      return `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => "${M}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        "Content-Type: application/json",
        "x-mockflow-session: ${session}",
    ],${hasBody ? `\n    CURLOPT_POSTFIELDS => '${jsonInline}',` : ''}
]);
$response = curl_exec($ch);
curl_close($ch);
echo $response;`;

    case 'ruby':
      return `require "net/http"
require "json"
require "uri"

uri = URI("${url}")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = uri.scheme == "https"

req = Net::HTTP::${M.charAt(0) + M.slice(1).toLowerCase()}.new(uri)
req["Content-Type"] = "application/json"
req["x-mockflow-session"] = "${session}"
${hasBody ? `req.body = ${jsonInline}.to_json` : ''}
res = http.request(req)
puts res.body`;

    case 'curl':
      return `curl -s -X ${M} "${url}" \\
  -H "Content-Type: application/json" \\
  -H "x-mockflow-session: ${session}"${hasBody ? ` \\\n  -d '${jsonInline}'` : ''}`;

    default:
      return '';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SdkGenerator() {
  const { activeEndpoint, sessionId, generatedSchema, endpoints } = usePlaygroundStore();
  const [lang, setLang]     = useState('fetch');
  const [copied, setCopied] = useState(false);

  // Fall back to the first endpoint if none is explicitly active
  const ep = activeEndpoint ?? endpoints?.[0] ?? null;

  const snippet = useMemo(() => {
    if (!ep || !sessionId) return '';
    const base    = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const url     = `${base}/api/mock/${sessionId}/${ep.slug}`;
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(ep.method);
    const body    = hasBody ? sampleBody(ep, generatedSchema) : {};
    return buildSnippet(lang, { method: ep.method, url, body, hasBody, session: sessionId });
  }, [ep, sessionId, generatedSchema, lang]);

  const copy = () => {
    navigator.clipboard.writeText(snippet).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!endpoints?.length) return null;   // nothing to generate for yet

  return (
    <div className="card flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg
                          bg-indigo-600/20 ring-1 ring-indigo-600/40">
            <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-200">
            SDK Generator
          </h2>
          <span className="rounded-full bg-indigo-950/60 px-2 py-0.5 text-[10px]
                           font-bold text-indigo-400 ring-1 ring-indigo-800/50">
            10 runtimes
          </span>
        </div>

        {/* Active endpoint pill */}
        {ep && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md
                           border border-gray-800 bg-gray-900/60 px-2 py-0.5
                           font-mono text-[10px] text-gray-500">
            <span className={`font-bold ${
              ep.method === 'GET'    ? 'text-emerald-400' :
              ep.method === 'POST'   ? 'text-blue-400'    :
              ep.method === 'PUT'    ? 'text-amber-400'   :
              ep.method === 'PATCH'  ? 'text-purple-400'  : 'text-red-400'
            }`}>{ep.method}</span>
            /{ep.slug}
          </span>
        )}
      </div>

      {/* Language tab strip — horizontal scroll on mobile */}
      <div className="flex gap-1 overflow-x-auto pb-1"
           role="tablist" aria-label="SDK language">
        {LANGUAGES.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={lang === l.id}
            onClick={() => setLang(l.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5
                        text-xs font-medium transition-all duration-150
                        focus-visible:outline-none focus-visible:ring-2
                        focus-visible:ring-indigo-500
                        ${lang === l.id
                          ? 'bg-indigo-950/60 text-indigo-200 ring-1 ring-indigo-700/50'
                          : 'text-gray-600 hover:bg-gray-800/60 hover:text-gray-400'
                        }`}
          >
            <span aria-hidden="true">{l.icon}</span>
            {l.label}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div
        className="relative overflow-hidden rounded-xl border border-indigo-900/25
                   bg-gray-950/90"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.04) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-1.5 border-b border-gray-800/50
                        bg-gray-900/60 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500/60" />
          <span className="h-2 w-2 rounded-full bg-amber-500/60" />
          <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
          <span className="ml-2 font-mono text-[10px] text-gray-700">
            {LANGUAGES.find(l => l.id === lang)?.label}
          </span>

          {/* Copy button */}
          <button
            onClick={copy}
            className={`ml-auto flex items-center gap-1.5 rounded-md border px-2 py-0.5
                        text-[10px] font-semibold transition-all duration-150
                        ${copied
                          ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400'
                          : 'border-gray-700 bg-gray-800/60 text-gray-500 hover:text-gray-300'
                        }`}
            aria-label="Copy snippet"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {/* Snippet text */}
        <pre className="max-h-72 overflow-auto px-4 py-3 font-mono text-[11px]
                        leading-relaxed text-emerald-300/90 whitespace-pre">
          {snippet || '// Select an endpoint to generate a snippet'}
        </pre>
      </div>
    </div>
  );
}
