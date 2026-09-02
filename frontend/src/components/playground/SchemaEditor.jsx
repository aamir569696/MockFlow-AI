import { useState } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

// ── JSON tree node ────────────────────────────────────────────────────────────

function JsonNode({ value, depth = 0, keyName = null }) {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const indent = depth * 14;

  const toggle = (e) => { e.stopPropagation(); setCollapsed((c) => !c); };

  // ── Primitives ──────────────────────────────────────────────────────────
  if (value === null) {
    return (
      <span className="flex items-center gap-1" style={{ paddingLeft: indent }}>
        {keyName !== null && <span className="json-key">"{keyName}"</span>}
        {keyName !== null && <span className="text-gray-600">:</span>}
        <span className="json-null">null</span>
      </span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span className="flex items-center gap-1" style={{ paddingLeft: indent }}>
        {keyName !== null && <span className="json-key">"{keyName}"</span>}
        {keyName !== null && <span className="text-gray-600">:</span>}
        <span className="json-bool">{String(value)}</span>
      </span>
    );
  }

  if (typeof value === 'number') {
    return (
      <span className="flex items-center gap-1" style={{ paddingLeft: indent }}>
        {keyName !== null && <span className="json-key">"{keyName}"</span>}
        {keyName !== null && <span className="text-gray-600">:</span>}
        <span className="json-number">{value}</span>
      </span>
    );
  }

  if (typeof value === 'string') {
    return (
      <span className="flex items-center gap-1 break-all" style={{ paddingLeft: indent }}>
        {keyName !== null && <span className="json-key">"{keyName}"</span>}
        {keyName !== null && <span className="text-gray-600">:</span>}
        <span className="json-string">"{value}"</span>
      </span>
    );
  }

  // ── Array ───────────────────────────────────────────────────────────────
  if (Array.isArray(value)) {
    const preview = `Array[${value.length}]`;
    return (
      <div style={{ paddingLeft: indent }}>
        <button
          onClick={toggle}
          className="flex items-center gap-1 text-left hover:opacity-80 focus:outline-none"
          aria-expanded={!collapsed}
        >
          {keyName !== null && <span className="json-key">"{keyName}"</span>}
          {keyName !== null && <span className="text-gray-600">:</span>}
          <span className="text-gray-500">{collapsed ? '▶' : '▼'}</span>
          <span className="text-gray-400">[</span>
          {collapsed && (
            <span className="text-gray-600 italic text-xs">{preview}</span>
          )}
          {collapsed && <span className="text-gray-400">]</span>}
        </button>
        {!collapsed && (
          <div className="border-l border-gray-800 ml-2 pl-2">
            {value.map((item, i) => (
              <div key={i} className="py-0.5">
                <JsonNode value={item} depth={0} keyName={String(i)} />
              </div>
            ))}
            <span className="text-gray-400">]</span>
          </div>
        )}
      </div>
    );
  }

  // ── Object ──────────────────────────────────────────────────────────────
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const preview = keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '');
    return (
      <div style={{ paddingLeft: indent }}>
        <button
          onClick={toggle}
          className="flex items-center gap-1 text-left hover:opacity-80 focus:outline-none"
          aria-expanded={!collapsed}
        >
          {keyName !== null && <span className="json-key">"{keyName}"</span>}
          {keyName !== null && <span className="text-gray-600">:</span>}
          <span className="text-gray-500">{collapsed ? '▶' : '▼'}</span>
          <span className="text-gray-400">{'{'}</span>
          {collapsed && (
            <span className="text-gray-600 italic text-xs">{preview}</span>
          )}
          {collapsed && <span className="text-gray-400">{'}'}</span>}
        </button>
        {!collapsed && (
          <div className="border-l border-gray-800 ml-2 pl-2">
            {keys.map((k) => (
              <div key={k} className="py-0.5">
                <JsonNode value={value[k]} depth={0} keyName={k} />
              </div>
            ))}
            <span className="text-gray-400">{'}'}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── SchemaEditor component ────────────────────────────────────────────────────

export default function SchemaEditor() {
  const { generatedSchema, isGenerating } = usePlaygroundStore();
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'raw'

  return (
    <div className="card flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600/20 ring-1 ring-sky-600/40">
            <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-200">Schema</h2>
        </div>

        {generatedSchema && (
          <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-0.5">
            {['tree', 'raw'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  viewMode === mode
                    ? 'bg-gray-700 text-gray-100 shadow'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {mode === 'tree' ? 'Tree' : 'Raw'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {isGenerating ? (
        <div className="flex flex-col gap-2 animate-pulse">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-4/5 ml-4" />
          <div className="skeleton h-3 w-3/5 ml-8" />
          <div className="skeleton h-3 w-4/5 ml-4" />
          <div className="skeleton h-3 w-2/3 ml-8" />
        </div>
      ) : !generatedSchema ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800 ring-1 ring-gray-700">
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M8 13h8M8 17h4" />
            </svg>
          </div>
          <p className="text-xs text-gray-600">Schema will appear after generation</p>
        </div>
      ) : viewMode === 'tree' ? (
        <div
          className="max-h-80 overflow-y-auto rounded-lg border border-gray-800
                     bg-gray-950/60 px-3 py-3 font-mono text-xs leading-6 animate-fade-in"
          role="region"
          aria-label="JSON schema tree"
        >
          <JsonNode value={generatedSchema} depth={0} />
        </div>
      ) : (
        <textarea
          className="input max-h-80 min-h-[160px] resize-y font-mono text-xs
                     text-green-300 leading-relaxed animate-fade-in"
          value={JSON.stringify(generatedSchema, null, 2)}
          onChange={() => {}} // read-only for now
          readOnly
          aria-label="Raw JSON schema"
          spellCheck={false}
        />
      )}
    </div>
  );
}
