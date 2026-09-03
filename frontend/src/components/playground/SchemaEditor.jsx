import { useState, useRef, useEffect, useCallback } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

// ── JSON tree node ────────────────────────────────────────────────────────────

function JsonNode({ value, depth = 0, keyName = null }) {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const indent = depth * 14;
  const toggle = (e) => { e.stopPropagation(); setCollapsed((c) => !c); };

  if (value === null) return (
    <span className="flex items-center gap-1" style={{ paddingLeft: indent }}>
      {keyName !== null && <><span className="json-key">"{keyName}"</span><span className="text-gray-600">:</span></>}
      <span className="json-null">null</span>
    </span>
  );
  if (typeof value === 'boolean') return (
    <span className="flex items-center gap-1" style={{ paddingLeft: indent }}>
      {keyName !== null && <><span className="json-key">"{keyName}"</span><span className="text-gray-600">:</span></>}
      <span className="json-bool">{String(value)}</span>
    </span>
  );
  if (typeof value === 'number') return (
    <span className="flex items-center gap-1" style={{ paddingLeft: indent }}>
      {keyName !== null && <><span className="json-key">"{keyName}"</span><span className="text-gray-600">:</span></>}
      <span className="json-number">{value}</span>
    </span>
  );
  if (typeof value === 'string') return (
    <span className="flex items-center gap-1 break-all" style={{ paddingLeft: indent }}>
      {keyName !== null && <><span className="json-key">"{keyName}"</span><span className="text-gray-600">:</span></>}
      <span className="json-string">"{value}"</span>
    </span>
  );
  if (Array.isArray(value)) {
    return (
      <div style={{ paddingLeft: indent }}>
        <button onClick={toggle} className="flex items-center gap-1 text-left hover:opacity-80 focus:outline-none" aria-expanded={!collapsed}>
          {keyName !== null && <><span className="json-key">"{keyName}"</span><span className="text-gray-600">:</span></>}
          <span className="text-gray-500">{collapsed ? '▶' : '▼'}</span>
          <span className="text-gray-400">[</span>
          {collapsed && <span className="text-gray-600 italic text-xs">Array[{value.length}]</span>}
          {collapsed && <span className="text-gray-400">]</span>}
        </button>
        {!collapsed && (
          <div className="border-l border-gray-800 ml-2 pl-2">
            {value.map((item, i) => <div key={i} className="py-0.5"><JsonNode value={item} depth={0} keyName={String(i)} /></div>)}
            <span className="text-gray-400">]</span>
          </div>
        )}
      </div>
    );
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const preview = keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '');
    return (
      <div style={{ paddingLeft: indent }}>
        <button onClick={toggle} className="flex items-center gap-1 text-left hover:opacity-80 focus:outline-none" aria-expanded={!collapsed}>
          {keyName !== null && <><span className="json-key">"{keyName}"</span><span className="text-gray-600">:</span></>}
          <span className="text-gray-500">{collapsed ? '▶' : '▼'}</span>
          <span className="text-gray-400">{'{'}</span>
          {collapsed && <span className="text-gray-600 italic text-xs">{preview}</span>}
          {collapsed && <span className="text-gray-400">{'}'}</span>}
        </button>
        {!collapsed && (
          <div className="border-l border-gray-800 ml-2 pl-2">
            {keys.map((k) => <div key={k} className="py-0.5"><JsonNode value={value[k]} depth={0} keyName={k} /></div>)}
            <span className="text-gray-400">{'}'}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

// ── Schema Graph ──────────────────────────────────────────────────────────────

/**
 * TYPE_COLORS — maps a JSON Schema type string to a graph fill/stroke colour
 * palette expressed as Tailwind-compatible HSL values we inline directly.
 */
const TYPE_PALETTE = {
  string:   { fill: '#0c4a6e', stroke: '#38bdf8', label: '#7dd3fc' },  // sky
  number:   { fill: '#451a03', stroke: '#fb923c', label: '#fed7aa' },  // amber
  integer:  { fill: '#451a03', stroke: '#fb923c', label: '#fed7aa' },  // amber
  boolean:  { fill: '#2e1065', stroke: '#a78bfa', label: '#ddd6fe' },  // violet
  array:    { fill: '#052e16', stroke: '#4ade80', label: '#bbf7d0' },  // emerald
  object:   { fill: '#1e1b4b', stroke: '#818cf8', label: '#c7d2fe' },  // indigo
  default:  { fill: '#1c1917', stroke: '#a8a29e', label: '#d6d3d1' },  // stone
};

function typeColor(t) {
  return TYPE_PALETTE[t] ?? TYPE_PALETTE.default;
}

/**
 * Build a flat graph structure from the JSON Schema map.
 *
 * Returns:
 *   nodes: [{ id, label, type, kind, x, y, r }]
 *   edges: [{ from, to }]
 *
 * Layout algorithm: resources placed on an outer ring; fields fanned
 * out from their parent resource using polar coordinates.
 */
function buildGraph(schema, width, height) {
  if (!schema || typeof schema !== 'object') return { nodes: [], edges: [] };

  const resources = Object.entries(schema);
  if (!resources.length) return { nodes: [], edges: [] };

  const cx = width / 2;
  const cy = height / 2;
  const outerR = Math.min(cx, cy) * 0.42;   // resource ring radius
  const fieldR = Math.min(cx, cy) * 0.20;   // field orbit radius
  const NODE_R  = 26;
  const FIELD_R = 14;

  const nodes = [];
  const edges = [];

  // ── Resource nodes (outer ring) ──────────────────────────────────────────
  resources.forEach(([resName, resDef], ri) => {
    const angle = (2 * Math.PI * ri) / resources.length - Math.PI / 2;
    const rx = cx + outerR * Math.cos(angle);
    const ry = cy + outerR * Math.sin(angle);
    const resId = `res-${ri}`;

    nodes.push({ id: resId, label: resName, type: 'object', kind: 'resource', x: rx, y: ry, r: NODE_R });

    // ── Centre node connector ────────────────────────────────────────────
    edges.push({ from: 'root', to: resId });

    // ── Field nodes (inner fan around resource) ──────────────────────────
    const props = resDef?.properties ?? {};
    const fields = Object.entries(props);
    const maxVisible = Math.min(fields.length, 8);  // cap at 8 to avoid clutter

    fields.slice(0, maxVisible).forEach(([fieldName, fieldDef], fi) => {
      const spread = Math.min(Math.PI * 0.9, (maxVisible / 8) * Math.PI);
      const startAngle = angle - spread / 2;
      const fieldAngle = startAngle + (spread / (maxVisible - 1 || 1)) * fi;
      const fx = rx + fieldR * Math.cos(fieldAngle);
      const fy = ry + fieldR * Math.sin(fieldAngle);
      const fieldId = `field-${ri}-${fi}`;
      const ftype = fieldDef?.type ?? 'string';

      nodes.push({ id: fieldId, label: fieldName, type: ftype, kind: 'field', x: fx, y: fy, r: FIELD_R });
      edges.push({ from: resId, to: fieldId });
    });

    if (fields.length > maxVisible) {
      // "+N more" phantom node
      const moreAngle = angle + Math.PI * 0.5 * (ri % 2 === 0 ? 1 : -1);
      const mx = rx + fieldR * 0.8 * Math.cos(moreAngle);
      const my = ry + fieldR * 0.8 * Math.sin(moreAngle);
      const moreId = `more-${ri}`;
      nodes.push({ id: moreId, label: `+${fields.length - maxVisible}`, type: 'default', kind: 'more', x: mx, y: my, r: 12 });
      edges.push({ from: resId, to: moreId });
    }
  });

  // ── Centre "API" root node ────────────────────────────────────────────────
  nodes.unshift({ id: 'root', label: 'API', type: 'object', kind: 'root', x: cx, y: cy, r: 32 });

  return { nodes, edges };
}

/**
 * SVG curved edge between two nodes.
 */
function Edge({ from, to, nodes, animated }) {
  const a = nodes.find(n => n.id === from);
  const b = nodes.find(n => n.id === to);
  if (!a || !b) return null;

  // Quadratic bezier: control point midway but offset perpendicular
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const curl = Math.min(len * 0.15, 18);
  const cpx = mx - (dy / len) * curl;
  const cpy = my + (dx / len) * curl;

  const isField = b.kind === 'field' || b.kind === 'more';
  const color = isField ? typeColor(b.type).stroke : '#4f52ea';
  const opacity = isField ? 0.35 : 0.55;

  return (
    <path
      d={`M ${a.x} ${a.y} Q ${cpx} ${cpy} ${b.x} ${b.y}`}
      fill="none"
      stroke={color}
      strokeWidth={isField ? 1 : 1.5}
      strokeOpacity={opacity}
      strokeDasharray={animated ? '4 4' : undefined}
      className={animated ? 'animate-[dash_3s_linear_infinite]' : undefined}
    />
  );
}

/**
 * SVG node circle with label, glow ring, and hover interaction.
 */
function Node({ node, onHover, hovered }) {
  const c = typeColor(node.type);
  const isHov = hovered === node.id;
  const isRoot = node.kind === 'root';
  const isResource = node.kind === 'resource';

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'default' }}
      role="img"
      aria-label={`${node.kind}: ${node.label}`}
    >
      {/* Glow ring — visible on root/resource or when hovered */}
      {(isRoot || isResource || isHov) && (
        <circle
          r={node.r + (isHov ? 8 : 5)}
          fill="none"
          stroke={isRoot ? '#6272f5' : c.stroke}
          strokeWidth="1"
          strokeOpacity={isHov ? 0.7 : 0.25}
          className="transition-all duration-300"
          style={{
            filter: isHov ? `drop-shadow(0 0 6px ${c.stroke})` : undefined,
          }}
        />
      )}

      {/* Node body */}
      <circle
        r={node.r}
        fill={isRoot ? '#1e1d52' : c.fill}
        stroke={isRoot ? '#6272f5' : c.stroke}
        strokeWidth={isRoot ? 2 : isResource ? 1.5 : 1}
        style={{
          filter: isHov ? `drop-shadow(0 0 8px ${c.stroke})` : undefined,
          transition: 'filter 0.2s ease',
        }}
      />

      {/* Label */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fill={isRoot ? '#a4bcfd' : c.label}
        fontSize={isRoot ? 10 : isResource ? 9 : 7.5}
        fontFamily="JetBrains Mono, monospace"
        fontWeight={isRoot || isResource ? '700' : '400'}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.label.length > 10 ? node.label.slice(0, 9) + '…' : node.label}
      </text>

      {/* Type badge for field nodes */}
      {node.kind === 'field' && (
        <text
          y={node.r + 8}
          textAnchor="middle"
          fill={c.stroke}
          fontSize={6}
          fontFamily="JetBrains Mono, monospace"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          opacity={0.7}
        >
          {node.type}
        </text>
      )}
    </g>
  );
}

function SchemaGraph({ schema }) {
  const svgRef = useRef(null);
  const [dims, setDims] = useState({ w: 420, h: 320 });
  const [hovered, setHovered] = useState(null);

  // Measure SVG container width on mount + resize
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      const h = Math.max(260, Math.floor(w * 0.72));
      setDims({ w, h });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { nodes, edges } = buildGraph(schema, dims.w, dims.h);

  if (!nodes.length) return (
    <p className="py-8 text-center text-xs text-gray-600">
      No schema structure to visualise.
    </p>
  );

  // Hovered node info for tooltip
  const hovNode = nodes.find(n => n.id === hovered);

  return (
    <div className="relative animate-fade-in">
      {/* Inline keyframe for dash animation */}
      <style>{`@keyframes dash{to{stroke-dashoffset:-16}}`}</style>

      <svg
        ref={svgRef}
        width={dims.w}
        height={dims.h}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        className="w-full rounded-xl border border-gray-800 bg-gray-950/80"
        aria-label="Schema relationship graph"
        role="img"
      >
        {/* Radial gradient background glow */}
        <defs>
          <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#6272f5" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#6272f5" stopOpacity="0"    />
          </radialGradient>
        </defs>
        <rect width={dims.w} height={dims.h} fill="url(#bgGlow)" />

        {/* Edges */}
        <g>
          {edges.map((e, i) => (
            <Edge
              key={`${e.from}-${e.to}`}
              from={e.from}
              to={e.to}
              nodes={nodes}
              animated={e.to.startsWith('field-') && i % 3 === 0}
            />
          ))}
        </g>

        {/* Nodes — resources rendered after fields so they sit on top */}
        <g>
          {nodes.filter(n => n.kind === 'field' || n.kind === 'more').map(n => (
            <Node key={n.id} node={n} onHover={setHovered} hovered={hovered} />
          ))}
          {nodes.filter(n => n.kind !== 'field' && n.kind !== 'more').map(n => (
            <Node key={n.id} node={n} onHover={setHovered} hovered={hovered} />
          ))}
        </g>
      </svg>

      {/* Hover tooltip */}
      {hovNode && hovNode.kind === 'field' && (
        <div className="pointer-events-none absolute bottom-2 right-2
                        rounded-lg border border-gray-700 bg-gray-900/95
                        px-2.5 py-1.5 backdrop-blur-sm animate-fade-in">
          <p className="font-mono text-xs text-sky-300">{hovNode.label}</p>
          <p className="font-mono text-xs text-gray-600">
            type: <span style={{ color: typeColor(hovNode.type).stroke }}>{hovNode.type}</span>
          </p>
        </div>
      )}
      {hovNode && hovNode.kind === 'resource' && (
        <div className="pointer-events-none absolute bottom-2 right-2
                        rounded-lg border border-brand-800/60 bg-brand-950/90
                        px-2.5 py-1.5 backdrop-blur-sm animate-fade-in">
          <p className="font-mono text-xs text-brand-300">{hovNode.label}</p>
          <p className="font-mono text-xs text-gray-600">resource</p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-2 px-1">
        {Object.entries(TYPE_PALETTE).filter(([k]) => k !== 'default').slice(0, 6).map(([type, c]) => (
          <span key={type} className="flex items-center gap-1 text-xs text-gray-600">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.stroke }} />
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── SchemaEditor ──────────────────────────────────────────────────────────────

const TABS = ['graph', 'tree', 'raw'];

export default function SchemaEditor() {
  const { generatedSchema, isGenerating } = usePlaygroundStore();
  const [viewMode, setViewMode] = useState('graph');

  return (
    <div className="card flex flex-col gap-3"
         style={{
           backgroundImage: [
             'radial-gradient(circle, rgba(56,189,248,0.04) 1px, transparent 1px)',
             'rgba(17,24,39,0)',
           ].join(', '),
           backgroundSize: '24px 24px, 100% 100%',
         }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg
                          bg-sky-600/20 ring-1 ring-sky-600/40">
            <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-200">Schema</h2>
        </div>

        {generatedSchema && (
          <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-0.5">
            {TABS.map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium
                            capitalize transition-all duration-150
                            ${viewMode === mode
                              ? 'bg-gray-700 text-gray-100 shadow'
                              : 'text-gray-500 hover:text-gray-300'
                            }`}
              >
                {mode === 'graph' ? (
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" />
                      <circle cx="19" cy="19" r="2" />
                      <line x1="12" y1="7" x2="5" y2="17" strokeLinecap="round" />
                      <line x1="12" y1="7" x2="19" y2="17" strokeLinecap="round" />
                    </svg>
                    Graph
                  </span>
                ) : mode === 'tree' ? 'Tree' : 'Raw'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {isGenerating ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {[1, 4/5, 3/5, 4/5, 2/3].map((w, i) => (
            <div key={i} className={`skeleton h-3 rounded`}
                 style={{ width: `${w * 100}%`, marginLeft: i % 2 ? 16 : 0 }} />
          ))}
        </div>
      ) : !generatedSchema ? (
        <div
          className="relative flex flex-col items-center justify-center overflow-hidden
                     rounded-xl py-8 text-center"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(56,189,248,0.05) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {/* Corner accents */}
          <span className="pointer-events-none absolute left-0 top-0 h-6 w-px bg-gradient-to-b from-sky-500/40 to-transparent" aria-hidden="true" />
          <span className="pointer-events-none absolute left-0 top-0 h-px w-6 bg-gradient-to-r from-sky-500/40 to-transparent" aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-0 right-0 h-6 w-px bg-gradient-to-t from-sky-500/40 to-transparent" aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-0 right-0 h-px w-6 bg-gradient-to-l from-sky-500/40 to-transparent" aria-hidden="true" />

          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl
                          border border-sky-900/40 bg-gray-900/80 ring-1 ring-sky-900/20"
               style={{ boxShadow: '0 0 16px rgba(56,189,248,0.06)' }}>
            <svg className="h-6 w-6 text-sky-700" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M8 13h8M8 17h4" />
            </svg>
          </div>
          <p className="text-xs text-gray-600">Schema will appear after generation</p>
        </div>
      ) : viewMode === 'graph' ? (
        <SchemaGraph schema={generatedSchema} />
      ) : viewMode === 'tree' ? (
        <div
          className="max-h-80 overflow-y-auto rounded-lg border border-gray-800
                     bg-gray-950/60 px-3 py-3 font-mono text-xs leading-6 animate-fade-in"
          role="region" aria-label="JSON schema tree"
        >
          <JsonNode value={generatedSchema} depth={0} />
        </div>
      ) : (
        <textarea
          className="input max-h-80 min-h-[160px] resize-y font-mono text-xs
                     text-green-300 leading-relaxed animate-fade-in"
          value={JSON.stringify(generatedSchema, null, 2)}
          readOnly
          aria-label="Raw JSON schema"
          spellCheck={false}
        />
      )}
    </div>
  );
}
