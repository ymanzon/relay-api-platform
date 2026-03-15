/* ══════════════════════════════════════════════════════
   Relay — API Gateway Platform  |  app.js v4.0
   ══════════════════════════════════════════════════════ */
'use strict';
const API='';
let allEvs=[],preEvs=[],postEvs=[],curKey='',curEpId='',parsedCurlData=null,curExec=null;
let histRows=[],histReady=false,histTmr=null;
let dashReady=false,dashTmr=null,drillId=null,charts={},testBlob=null;

const THEMES={
  dark:{'--bg':'#080c12','--card':'#0e141d','--surf':'#141c27','--raised':'#1b2436','--border':'#1e2a3a','--bsoft':'#18232f','--a':'#00f5a8','--adim':'rgba(0,245,168,.1)','--aglow':'rgba(0,245,168,.3)','--blue':'#4da6ff','--bdim':'rgba(77,166,255,.12)','--purple':'#a97dff','--pdim':'rgba(169,125,255,.12)','--warn':'#ffbc42','--wdim':'rgba(255,188,66,.12)','--danger':'#ff5757','--ddim':'rgba(255,87,87,.12)','--ok':'#00d98b','--okdim':'rgba(0,217,139,.12)','--teal':'#00d9f5','--tdim':'rgba(0,217,245,.12)','--t1':'#e8edf5','--t2':'#7d8fa6','--t3':'#384860'},
  light:{'--bg':'#f0f3f8','--card':'#ffffff','--surf':'#f5f7fb','--raised':'#ebeff6','--border':'#d5dce8','--bsoft':'#e0e6f0','--a':'#00a870','--adim':'rgba(0,168,112,.1)','--aglow':'rgba(0,168,112,.25)','--blue':'#2a7fff','--bdim':'rgba(42,127,255,.1)','--purple':'#6c4fff','--pdim':'rgba(108,79,255,.1)','--warn':'#e0820a','--wdim':'rgba(224,130,10,.1)','--danger':'#e03030','--ddim':'rgba(224,48,48,.1)','--ok':'#009060','--okdim':'rgba(0,144,96,.1)','--teal':'#0099b8','--tdim':'rgba(0,153,184,.1)','--t1':'#111827','--t2':'#4a5568','--t3':'#9ba8b8'},
  midnight:{'--bg':'#04030e','--card':'#09091a','--surf':'#0e0e24','--raised':'#14142e','--border':'#1c1c38','--bsoft':'#14142c','--a':'#00d4ff','--adim':'rgba(0,212,255,.1)','--aglow':'rgba(0,212,255,.3)','--blue':'#6a8fff','--bdim':'rgba(106,143,255,.12)','--purple':'#c47aff','--pdim':'rgba(196,122,255,.12)','--warn':'#ffd166','--wdim':'rgba(255,209,102,.12)','--danger':'#ff6b6b','--ddim':'rgba(255,107,107,.12)','--ok':'#06d6a0','--okdim':'rgba(6,214,160,.12)','--teal':'#48cae4','--tdim':'rgba(72,202,228,.12)','--t1':'#e8eaf6','--t2':'#7b8aaa','--t3':'#3a4060'},
  forest:{'--bg':'#030c04','--card':'#061008','--surf':'#0c1a0d','--raised':'#122314','--border':'#1a2e1b','--bsoft':'#142316','--a':'#39e979','--adim':'rgba(57,233,121,.1)','--aglow':'rgba(57,233,121,.28)','--blue':'#5bc8fa','--bdim':'rgba(91,200,250,.12)','--purple':'#d08aff','--pdim':'rgba(208,138,255,.12)','--warn':'#ffc845','--wdim':'rgba(255,200,69,.12)','--danger':'#ff6060','--ddim':'rgba(255,96,96,.12)','--ok':'#2edd7e','--okdim':'rgba(46,221,126,.12)','--teal':'#30d5c8','--tdim':'rgba(48,213,200,.12)','--t1':'#e8f5e8','--t2':'#7a9e7a','--t3':'#3a5a3a'},
  solarized:{'--bg':'#001e26','--card':'#002b36','--surf':'#073642','--raised':'#0d4452','--border':'#144e5e','--bsoft':'#0e3d4c','--a':'#2aa198','--adim':'rgba(42,161,152,.15)','--aglow':'rgba(42,161,152,.28)','--blue':'#268bd2','--bdim':'rgba(38,139,210,.15)','--purple':'#6c71c4','--pdim':'rgba(108,113,196,.15)','--warn':'#b58900','--wdim':'rgba(181,137,0,.15)','--danger':'#dc322f','--ddim':'rgba(220,50,47,.15)','--ok':'#859900','--okdim':'rgba(133,153,0,.15)','--teal':'#2aa198','--tdim':'rgba(42,161,152,.12)','--t1':'#fdf6e3','--t2':'#839496','--t3':'#4a6570'}
};

/* ── INIT ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',async()=>{
  M.AutoInit();
  initNav();
  await loadTheme();
  loadStats(); loadEndpoints(); loadEvents(); loadEnvs();
  // t-method is now a plain <select> — no MaterializeCSS needed
  // Pre-fetch secrets list so endpoint modal ref-validation works immediately
  loadSecrets().catch(()=>{});
});

/* ── THEME ────────────────────────────────────────── */
async function loadTheme(){try{applyTheme((await api('/catalog/settings')).theme||'dark');}catch{applyTheme('dark');}}
function applyTheme(id){
  const v=THEMES[id]||THEMES.dark;
  Object.entries(v).forEach(([k,val])=>document.documentElement.style.setProperty(k,val));
  document.querySelectorAll('.tswatch').forEach(b=>b.classList.toggle('on',b.dataset.t===id));
  if(dashReady)setTimeout(redrawCharts,80);
}
async function setTheme(id){
  applyTheme(id);
  try{await api('/catalog/settings',{method:'PUT',body:JSON.stringify({theme:id})});toast('Theme saved ✓');}
  catch{toast('Could not save theme',true);}
}

/* ── NAV ──────────────────────────────────────────── */
function initNav(){
  document.querySelectorAll('.ntab').forEach(t=>t.addEventListener('click',e=>{
    e.preventDefault();
    document.querySelectorAll('.ntab').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
    document.getElementById(t.dataset.target).classList.add('on');
    const tgt=t.dataset.target;
    if(tgt==='pg-history'&&!histReady){histReady=true;populateEpDropdowns();loadHist(true);}
    if(tgt==='pg-dashboard')initDash();
    if(tgt==='pg-secrets')initSecrets();
    if(tgt==='pg-security'){loadGlobalSecEvents();populateSecRLDropdown();}
    if(tgt==='pg-environments')initEnvironments();
    if(tgt==='pg-tester')populateTesterEpDropdown(allEndpoints);
  }));
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.itab');if(!tab)return;
    const root=tab.closest('.modal')||tab.closest('.drillp')||document.body;
    root.querySelectorAll('.itab').forEach(x=>x.classList.remove('on'));
    root.querySelectorAll('.ip').forEach(p=>p.style.display='none');
    tab.classList.add('on');
    const panel=document.getElementById(tab.dataset.p);if(panel)panel.style.display='block';
    if(tab.dataset.p==='ep-pcurl')refreshCurlPrev();
  });
}

/* ── ENDPOINT STATS ───────────────────────────────── */
async function loadStats(){
  try{
    const d=await api('/catalog/endpoints/stats');
    setTxt('s-total',d.total??0);setTxt('s-active',d.enabled??0);
    setTxt('s-proxy',d.withDestination??0);setTxt('s-mock',d.withMock??0);setTxt('s-secured',d.secured??0);
    setTxt('s-collections',d.collections??0);
  }catch{}
}

/* ── ENDPOINTS ────────────────────────────────────── */

/* ── COLLECTIONS + ENDPOINTS ─────────────────────────────── */
let allEndpoints = [];
let openCollections = new Set(['']);  // '' = ungrouped, open by default

async function loadEndpoints() {
  try {
    allEndpoints = await api('/catalog/endpoints');
    renderEpCollections(allEndpoints);
    populateTesterEpDropdown(allEndpoints);
    populateColFilter(allEndpoints);
    // Refresh datalist for collection input in modal
    const dl = document.getElementById('ep-collection-list');
    if (dl) {
      const cols = [...new Set(allEndpoints.map(e => e.collection).filter(Boolean))];
      dl.innerHTML = cols.map(c => `<option value="${c}"></option>`).join('');
    }
  } catch { 
    document.getElementById('ep-collections-wrap').innerHTML =
      `<div class="empty" style="padding:50px"><i class="material-icons" style="color:var(--danger)">error_outline</i><p style="color:var(--danger)">Error loading endpoints</p></div>`;
  }
}

function applyEpFilter() {
  const col = document.getElementById('ep-col-filter')?.value;
  const filtered = col === '' ? allEndpoints : allEndpoints.filter(e => (e.collection||'') === col);
  renderEpCollections(filtered, col !== '');
}

function populateColFilter(list) {
  const sel = document.getElementById('ep-col-filter');
  if (!sel) return;
  const cols = [...new Set(list.map(e => e.collection||''))].sort();
  const cur  = sel.value;
  sel.innerHTML = '<option value="">All collections</option>' +
    cols.filter(c=>c).map(c => `<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
}

function renderEpCollections(list, singleCol=false) {
  const wrap = document.getElementById('ep-collections-wrap');
  if (!list.length) {
    wrap.innerHTML = `<div class="empty card" style="padding:50px 20px"><i class="material-icons">hub</i><p>No endpoints yet — create your first one</p></div>`;
    return;
  }

  // Group by collection
  const groups = {};
  for (const ep of list) {
    const col = ep.collection || '';
    if (!groups[col]) groups[col] = [];
    groups[col].push(ep);
  }

  // Sort: named collections first (alphabetical), then ungrouped
  const sortedKeys = Object.keys(groups).sort((a,b) => {
    if (a === '' && b !== '') return 1;
    if (b === '' && a !== '') return -1;
    return a.localeCompare(b);
  });

  const colColors = ['var(--a)','var(--blue)','var(--purple)','var(--warn)','var(--ok)','var(--teal)'];

  wrap.innerHTML = sortedKeys.map((col, ci) => {
    const eps = groups[col];
    const isOpen = openCollections.has(col);
    const colLabel = col || 'Ungrouped';
    const color = col ? colColors[ci % colColors.length] : 'var(--t3)';
    const icon  = col ? 'folder' : 'folder_open';

    const rowsHtml = eps.map(ep => {
      const feats = [];
      if (ep.requireApiKey) feats.push(`<span class="badge bkey" title="API Key"><i class="material-icons" style="font-size:.68rem">vpn_key</i></span>`);
      if (ep.cacheConfig?.enabled) feats.push(`<span class="badge bcache" title="Cache"><i class="material-icons" style="font-size:.68rem">bolt</i></span>`);
      if (ep.fileConfig?.enabled) feats.push(`<span class="badge bfile" title="File: ${ep.fileConfig.mode}"><i class="material-icons" style="font-size:.68rem">attach_file</i></span>`);
      if (ep.securityConfig?.enabled) feats.push(`<span class="badge" style="background:var(--ddim);color:var(--danger)" title="Security module enabled"><i class="material-icons" style="font-size:.68rem">shield</i></span>`);
      const hasEnvVars = ep.destinationUrl?.includes('[[') || Object.values(ep.destinationHeaders||{}).some(v=>String(v).includes('[['));
      if (hasEnvVars) feats.push(`<span class="badge" style="background:var(--adim);color:var(--a)" title="Uses environment variables"><i class="material-icons" style="font-size:.68rem">layers</i></span>`);
      const evBadges = [
        ep.preEvents?.length  ? `<span style="color:var(--a);background:var(--adim);padding:1px 4px;border-radius:3px;font-size:.6rem">PRE×${ep.preEvents.length}</span>` : '',
        ep.postEvents?.length ? `<span style="color:var(--purple);background:var(--pdim);padding:1px 4px;border-radius:3px;font-size:.6rem">POST×${ep.postEvents.length}</span>` : '',
      ].filter(Boolean).join(' ');

      return `<tr>
        <td><span class="badge b${ep.method}">${ep.method}</span></td>
        <td><span class="epath"><span class="pre">/api/</span>${ep.virtualPath}</span></td>
        <td><div style="font-weight:600;font-size:.79rem">${ep.name}</div>${ep.description?`<div style="font-size:.62rem;color:var(--t3)">${ep.description}</div>`:''}</td>
        <td><span class="badge ${ep.destinationUrl?'bproxy':'bmock'}">${ep.destinationUrl?'Proxy':'Mock'}</span></td>
        <td><div style="display:flex;flex-wrap:wrap;gap:3px">${feats.join('')||'<span style="color:var(--t3);font-size:.63rem">—</span>'}</div></td>
        <td>${evBadges||'<span style="color:var(--t3);font-size:.63rem">—</span>'}</td>
        <td><span style="display:inline-flex;align-items:center;gap:4px"><span class="dot ${ep.enabled?'don':'doff'}"></span><span style="color:${ep.enabled?'var(--a)':'var(--t3)'};font-size:.65rem">${ep.enabled?'Active':'Off'}</span></span></td>
        <td>
          <div style="display:flex;gap:2px">
            <button class="btn-i" onclick="openCodeGenForEp('${ep._id}')" title="Generate code"><i class="material-icons" style="font-size:13px">code</i></button>
            <button class="btn-i" onclick="loadEpIntoTesterById('${ep._id}')" title="Test in Tester"><i class="material-icons" style="font-size:13px">science</i></button>
            <button class="btn-i" onclick="exportCurl('${ep._id}')" title="cURL"><i class="material-icons" style="font-size:13px">terminal</i></button>
            <button class="btn-i" onclick="editEp('${ep._id}')" title="Edit"><i class="material-icons" style="font-size:13px">edit</i></button>
            <button class="btn-i" style="color:var(--danger);border-color:rgba(255,87,87,.25)" onclick="delEp('${ep._id}','${ep.name}')"><i class="material-icons" style="font-size:13px">delete</i></button>
          </div>
        </td>
      </tr>`;
    }).join('');

    return `
    <div class="col-group">
      <div class="col-hdr ${isOpen?'open':''}" onclick="toggleCollection('${col.replace(/'/g,"\\'")}',this)">
        <i class="material-icons" style="font-size:16px;color:${color}">${icon}</i>
        <span style="font-weight:700;font-size:.8rem;color:var(--t1)">${colLabel}</span>
        <span class="col-badge">${eps.length}</span>
        <i class="material-icons col-arrow">chevron_right</i>
        <div class="col-actions" onclick="event.stopPropagation()">
          <button class="btn-i" onclick="exportColAs('${col.replace(/'/g,"\\'")}','postman')" title="Export to Postman"><i class="material-icons" style="font-size:12px">send</i></button>
          <button class="btn-i" onclick="exportColAs('${col.replace(/'/g,"\\'")}','insomnia')" title="Export to Insomnia"><i class="material-icons" style="font-size:12px">science</i></button>
          ${col ? `<button class="btn-i" style="color:var(--danger)" onclick="deleteCollection('${col.replace(/'/g,"\\'")}',${eps.length})" title="Delete collection"><i class="material-icons" style="font-size:12px">delete</i></button>` : ''}
        </div>
      </div>
      <div class="col-body ${isOpen?'open':''}">
        <div class="tw"><table class="tbl"><thead><tr><th>Method</th><th>Path</th><th>Name</th><th>Mode</th><th>Features</th><th>Events</th><th>Status</th><th></th></tr></thead>
        <tbody>${rowsHtml}</tbody></table></div>
      </div>
    </div>`;
  }).join('');
}

function toggleCollection(col, hdrEl) {
  const body = hdrEl.parentElement.querySelector('.col-body');
  const isOpen = body.classList.contains('open');
  if (isOpen) { openCollections.delete(col); } else { openCollections.add(col); }
  body.classList.toggle('open', !isOpen);
  hdrEl.classList.toggle('open', !isOpen);
}

async function deleteCollection(col, count) {
  if (!confirm(`Delete collection "${col}"?\n\nThis will un-group ${count} endpoint(s) — the endpoints themselves will NOT be deleted.`)) return;
  try {
    const ids = allEndpoints.filter(e => e.collection === col).map(e => e._id);
    await api('/catalog/endpoints/bulk/collection', { method:'PUT', body: JSON.stringify({ ids, collection:'' }) });
    toast(`Collection "${col}" removed ✓`);
    loadEndpoints(); loadStats();
  } catch(e) { toast(e.message||'Error', true); }
}

/* ── Export ───────────────────────────────────────── */
function toggleExportMenu() {
  const m = document.getElementById('export-menu');
  const isOpen = m.style.display !== 'none';
  m.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(() => document.addEventListener('click', function close(e) {
      if (!document.getElementById('export-menu-wrap').contains(e.target)) {
        m.style.display = 'none'; document.removeEventListener('click', close);
      }
    }), 50);
  }
}

function exportAs(format) {
  document.getElementById('export-menu').style.display = 'none';
  const col = document.getElementById('ep-col-filter')?.value || '';
  const list = col ? allEndpoints.filter(e => (e.collection||'') === col) : allEndpoints;
  const label = col || 'All Endpoints';
  doExport(format, list, label);
}

function exportColAs(col, format) {
  const list = allEndpoints.filter(e => (e.collection||'') === col);
  doExport(format, list, col || 'Ungrouped');
}

function doExport(format, list, label) {
  const base = window.location.origin;
  let content, filename, mime;

  if (format === 'postman') {
    content = JSON.stringify(buildPostmanCollection(list, label, base), null, 2);
    filename = `relay-${slugify(label)}.postman_collection.json`;
    mime = 'application/json';
  } else if (format === 'insomnia') {
    content = JSON.stringify(buildInsomniaExport(list, label, base), null, 2);
    filename = `relay-${slugify(label)}.insomnia.json`;
    mime = 'application/json';
  } else if (format === 'openapi') {
    content = buildOpenApiYaml(list, label, base);
    filename = `relay-${slugify(label)}.openapi.yaml`;
    mime = 'text/yaml';
  } else if (format === 'k6') {
    content = buildK6Script(list, label, base);
    filename = `relay-${slugify(label)}.k6.js`;
    mime = 'text/javascript';
  }

  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
  toast(`Exported as ${filename} ✓`);
}

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-'); }

/* ── Postman v2.1 ─────────────────────────────────── */
function buildPostmanCollection(list, name, base) {
  const makeItem = (ep) => {
    const url  = `${base}/api/${ep.virtualPath}`;
    const item = {
      name: ep.name,
      request: {
        method: ep.method,
        header: Object.entries(ep.destinationHeaders||{}).map(([k,v]) => ({ key:k, value:v, type:'text' })),
        url: {
          raw: url,
          protocol: 'http', host: [location.hostname], path: ['api', ...ep.virtualPath.split('/')],
          query: (ep.queryParams||[]).map(p => ({ key:p.name, value:p.example||'', description:p.description||'', disabled:!p.required })),
        },
        description: ep.description || '',
      },
      response: [],
    };
    if (ep.requireApiKey) item.request.header.push({ key:'x-api-key', value:'{{X_API_KEY}}', type:'text' });
    if (['POST','PUT','PATCH'].includes(ep.method) && (ep.bodyParams||[]).length) {
      const ex = {};
      (ep.bodyParams||[]).forEach(p => { ex[p.name] = p.example || p.defaultValue || `<${p.type}>`; });
      item.request.body = { mode:'raw', raw: JSON.stringify(ex, null, 2), options:{ raw:{ language:'json' } } };
    }
    return item;
  };

  // Group by collection
  const groups = {};
  for (const ep of list) { const c=ep.collection||''; (groups[c]=groups[c]||[]).push(ep); }

  const items = Object.entries(groups).map(([col, eps]) => ({
    name: col || 'Ungrouped',
    item: eps.map(makeItem),
  }));

  return {
    info: { _postman_id: crypto.randomUUID(), name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: items,
    variable: [{ key:'baseUrl', value: base }, { key:'X_API_KEY', value:'' }],
  };
}

/* ── Insomnia v4 ──────────────────────────────────── */
function buildInsomniaExport(list, name, base) {
  const ts = Date.now();
  const resources = [];
  const wsId = `wrk_${ts}`;
  resources.push({ _id:wsId, _type:'workspace', name, description:'Exported from Relay', scope:'collection' });

  const groups = {};
  for (const ep of list) { const c=ep.collection||''; (groups[c]=groups[c]||[]).push(ep); }
  let i=0;
  for (const [col, eps] of Object.entries(groups)) {
    const gId = `fld_${ts}_${i++}`;
    if (col) resources.push({ _id:gId, _type:'request_group', name:col, parentId:wsId });
    for (const ep of eps) {
      const body = (['POST','PUT','PATCH'].includes(ep.method) && (ep.bodyParams||[]).length)
        ? (() => { const b={}; (ep.bodyParams||[]).forEach(p=>{b[p.name]=p.example||p.defaultValue||`<${p.type}>`;}); return { mimeType:'application/json', text:JSON.stringify(b,null,2) }; })()
        : {};
      resources.push({
        _id: `req_${ts}_${ep._id}`, _type:'request',
        parentId: col ? gId : wsId,
        name: ep.name, method: ep.method,
        url: `{{ _.baseUrl }}/api/${ep.virtualPath}`,
        headers: [
          ...Object.entries(ep.destinationHeaders||{}).map(([n,v]) => ({ name:n, value:v })),
          ...(ep.requireApiKey ? [{ name:'x-api-key', value:'{{ _.apiKey }}' }] : []),
        ],
        parameters: (ep.queryParams||[]).map(p => ({ name:p.name, value:p.example||'' })),
        body,
        description: ep.description || '',
      });
    }
  }
  resources.push({
    _id:`env_${ts}`, _type:'environment', name:'Base Environment', parentId:wsId,
    data:{ baseUrl:base, apiKey:'' },
  });
  return { _type:'export', __export_format:4, __export_source:'relay', resources };
}

/* ── OpenAPI 3.0 YAML ─────────────────────────────── */
function buildOpenApiYaml(list, name, base) {
  const paths = {};
  for (const ep of list) {
    const path = `/api/${ep.virtualPath}`;
    const method = ep.method.toLowerCase();
    const params = [
      ...(ep.queryParams||[]).map(p => ({ in:'query', name:p.name, required:p.required, schema:{ type:p.type }, description:p.description||'' })),
    ];
    const op = {
      summary: ep.name,
      description: ep.description || '',
      parameters: params,
      responses: { [(ep.mockResponse?.statusCode||200).toString()]: { description:'Success' } },
    };
    if (ep.requireApiKey) op.security = [{ ApiKeyAuth:[] }];
    if (['post','put','patch'].includes(method) && (ep.bodyParams||[]).length) {
      const props = {};
      const req   = [];
      (ep.bodyParams||[]).forEach(p => { props[p.name]={ type:p.type, example:p.example||undefined }; if(p.required)req.push(p.name); });
      op.requestBody = { required:true, content:{ 'application/json':{ schema:{ type:'object', properties:props, required:req.length?req:undefined } } } };
    }
    if (!paths[path]) paths[path] = {};
    paths[path][method] = op;
  }
  const lines = [
    `openapi: "3.0.3"`,
    `info:`,
    `  title: "${name}"`,
    `  version: "1.0.0"`,
    `  description: "Exported from Relay API Gateway"`,
    `servers:`,
    `  - url: "${base}"`,
    `    description: "Relay proxy"`,
    `components:`,
    `  securitySchemes:`,
    `    ApiKeyAuth:`,
    `      type: apiKey`,
    `      in: header`,
    `      name: x-api-key`,
    `paths:`,
  ];
  for (const [p, methods] of Object.entries(paths)) {
    lines.push(`  "${p}":`);
    for (const [m, op] of Object.entries(methods)) {
      lines.push(`    ${m}:`);
      lines.push(`      summary: "${op.summary}"`);
      if (op.description) lines.push(`      description: "${op.description}"`);
      if (op.parameters?.length) {
        lines.push(`      parameters:`);
        for (const pr of op.parameters) lines.push(`        - in: ${pr.in}\n          name: ${pr.name}\n          required: ${pr.required}\n          schema:\n            type: ${pr.schema.type}`);
      }
      if (op.security) lines.push(`      security:\n        - ApiKeyAuth: []`);
      lines.push(`      responses:`);
      for (const [s,r] of Object.entries(op.responses)) lines.push(`        "${s}":\n          description: "${r.description}"`);
    }
  }
  return lines.join('\n');
}

/* ── k6 script ───────────────────────────────────────────── */
function buildK6Script(list, name, base) {
  const tests = list.map(ep => {
    const url = `\${BASE_URL}/api/${ep.virtualPath}`;
    const hdrs = { 'Content-Type':'application/json', ...(ep.destinationHeaders||{}) };
    if (ep.requireApiKey) hdrs['x-api-key'] = API_KEY_VAR;
    const body = (['POST','PUT','PATCH'].includes(ep.method) && (ep.bodyParams||[]).length)
      ? (() => { const b={}; (ep.bodyParams||[]).forEach(p=>{b[p.name]=p.example||p.defaultValue||`<${p.type}>`;}); return 'JSON.stringify(' + JSON.stringify(b) + ')'; })()
      : 'null';
    const method = ep.method.toLowerCase();
    return `
  // ${ep.name}
  {
    const headers = ${JSON.stringify(hdrs)};
    const res = http.${method}(\`${url}\`, ${body !== 'null' ? body : 'null'}, { headers });
    check(res, {
      '${ep.name} — status 2xx': (r) => r.status >= 200 && r.status < 300,
      '${ep.name} — duration < 2s': (r) => r.timings.duration < 2000,
    });
  }`;
  }).join('\n');

  return `import http from 'k6/http';
import { check, sleep } from 'k6';

// ── ${name} — Relay Load Test ──────────────────────
const BASE_URL = __ENV.BASE_URL || '${base}';
const API_KEY  = __ENV.API_KEY  || '';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed:   ['rate<0.05'],
  },
};

export default function () {
${tests}
  sleep(1);
}
`;
}

const API_KEY_VAR = '\${API_KEY}';


function openEpModal(ep=null){resetEpForm();if(ep)fillEpForm(ep);popEvSels();M.updateTextFields();openMod('modal-ep');}
function resetEpForm(){
  curKey='';curEpId='';
  ['ep-id','ep-name','ep-path','ep-desc','ep-dest-url'].forEach(id=>setVal(id,''));
  setVal('ep-timeout','30000');setVal('ep-mock-st','200');setVal('ep-mock-delay','0');
  setVal('ep-mock-body','{\n  "message": "ok"\n}');
  setVal('ep-cttl','60');setVal('ep-ffield','file');setVal('ep-fmax','10');setVal('ep-klen','32');
  document.getElementById('ep-enabled').checked=true;
  ['ep-keon','ep-fon','ep-con','ep-cnobody','ep-cnoquery'].forEach(id=>{const el=document.getElementById(id);if(el)el.checked=false;});
  setTxt('key-disp','—');
  ['key-s','file-s','cache-s'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const mfi=document.getElementById('ep-mfile-info');if(mfi)mfi.style.display='none';
  setVal('ep-mfb64','');setVal('ep-mfname','');setVal('ep-mfmime','');
  ['ep-dhdrs','ep-qp','ep-bp','ep-mhdrs'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
  preEvs=[];postEvs=[];
  renderPills('ep-pre-pills',preEvs,'pre');renderPills('ep-post-pills',postEvs,'post');
  document.getElementById('ep-title').textContent='New Endpoint';setVal('ep-collection','');
  resetEpSecForm();
  resetItabs('modal-ep');
}
function fillEpForm(ep){
  document.getElementById('ep-title').textContent='Edit Endpoint';
  setVal('ep-id',ep._id);curEpId=ep._id;
  setVal('ep-name',ep.name);setVal('ep-path',ep.virtualPath);setVal('ep-desc',ep.description||'');
  setVal('ep-dest-url',ep.destinationUrl||'');setVal('ep-timeout',ep.timeoutMs||30000);
  setVal('ep-mock-st',ep.mockResponse?.statusCode||200);setVal('ep-mock-delay',ep.mockResponse?.delayMs||0);
  setVal('ep-mock-body',ep.mockResponse?.body?JSON.stringify(ep.mockResponse.body,null,2):'');
  document.getElementById('ep-enabled').checked=ep.enabled!==false;
  if(ep.requireApiKey){document.getElementById('ep-keon').checked=true;curKey=ep.apiKey||'';setVal('ep-klen',ep.apiKeyLength||32);setTxt('key-disp',curKey||'—');document.getElementById('key-s').style.display='block';}
  if(ep.fileConfig?.enabled){document.getElementById('ep-fon').checked=true;document.getElementById('file-s').style.display='block';setTimeout(()=>setSelVal('ep-fmode',ep.fileConfig.mode||'upload'),50);setVal('ep-ffield',ep.fileConfig.fieldName||'file');setVal('ep-fmax',ep.fileConfig.maxSizeMb||10);if(ep.mockResponse?.fileName){setVal('ep-mfb64',ep.mockResponse.fileBase64||'');setVal('ep-mfname',ep.mockResponse.fileName);setVal('ep-mfmime',ep.mockResponse.fileMimeType||'');document.getElementById('ep-mfile-info').style.display='block';document.getElementById('ep-mfile-info').textContent=`📄 ${ep.mockResponse.fileName}`;}}
  if(ep.cacheConfig?.enabled){document.getElementById('ep-con').checked=true;document.getElementById('cache-s').style.display='block';setVal('ep-cttl',ep.cacheConfig.ttlSeconds||60);document.getElementById('ep-cnobody').checked=!!ep.cacheConfig.ignoreBody;document.getElementById('ep-cnoquery').checked=!!ep.cacheConfig.ignoreQuery;}
  setVal('ep-collection', ep.collection||'');setTimeout(()=>setSelVal('ep-method',ep.method),40);
  Object.entries(ep.destinationHeaders||{}).forEach(([k,v])=>addHdr('ep-dhdrs',k,v));
  Object.entries(ep.mockResponse?.headers||{}).forEach(([k,v])=>addHdr('ep-mhdrs',k,v));
  (ep.queryParams||[]).forEach(p=>addPrm('ep-qp',p));(ep.bodyParams||[]).forEach(p=>addPrm('ep-bp',p));
  preEvs=(ep.preEvents||[]).map(e=>({_id:e._id||e,name:e.name||'…'}));
  postEvs=(ep.postEvents||[]).map(e=>({_id:e._id||e,name:e.name||'…'}));
  renderPills('ep-pre-pills',preEvs,'pre');renderPills('ep-post-pills',postEvs,'post');
  // Load security configuration
  fillEpSecForm(ep.securityConfig || {});
  setTimeout(refreshCurlPrev,80);
}
async function editEp(id){try{openEpModal(await api(`/catalog/endpoints/${id}`));}catch{toast('Error loading',true);}}
async function saveEp(){
  const id=getVal('ep-id'),name=getVal('ep-name').trim(),vp=getVal('ep-path').trim().replace(/^\/+/,''),method=document.getElementById('ep-method').value;
  if(!name||!vp){toast('Name and Path required',true);return;}
  let mb=null;try{mb=JSON.parse(getVal('ep-mock-body')||'null');}catch{}
  const collection=getVal('ep-collection').trim();
  const p={name,virtualPath:vp,method,collection,description:getVal('ep-desc'),destinationUrl:getVal('ep-dest-url').trim()||null,timeoutMs:parseInt(getVal('ep-timeout'))||30000,enabled:document.getElementById('ep-enabled').checked,destinationHeaders:colHdrs('ep-dhdrs'),queryParams:colPrms('ep-qp'),bodyParams:colPrms('ep-bp'),mockResponse:{statusCode:parseInt(getVal('ep-mock-st'))||200,delayMs:parseInt(getVal('ep-mock-delay'))||0,body:mb,headers:colHdrs('ep-mhdrs'),fileBase64:getVal('ep-mfb64')||undefined,fileName:getVal('ep-mfname')||undefined,fileMimeType:getVal('ep-mfmime')||undefined},preEvents:preEvs.map(e=>e._id),postEvents:postEvs.map(e=>e._id),requireApiKey:document.getElementById('ep-keon').checked,apiKey:document.getElementById('ep-keon').checked?(curKey||undefined):undefined,apiKeyLength:parseInt(getVal('ep-klen'))||32,fileConfig:{enabled:document.getElementById('ep-fon').checked,mode:document.getElementById('ep-fmode')?.value||'upload',fieldName:getVal('ep-ffield')||'file',maxSizeMb:parseInt(getVal('ep-fmax'))||10},cacheConfig:{enabled:document.getElementById('ep-con').checked,ttlSeconds:parseInt(getVal('ep-cttl'))||60,ignoreBody:document.getElementById('ep-cnobody').checked,ignoreQuery:document.getElementById('ep-cnoquery').checked},securityConfig:collectSecForm()};
  // Validate secret refs in dest headers/URL before saving
  const destHdrs = colHdrs('ep-dhdrs');
  const missing  = await validateEndpointSecretRefs(getVal('ep-dest-url'), destHdrs);
  if (missing.length) {
    const go = confirm(`⚠ These secrets are referenced but don't exist yet:\n\n  ${missing.map(m=>`{{${m}}}`).join('\n  ')}\n\nSave anyway?`);
    if (!go) return;
  }
  try{const r=await api(id?`/catalog/endpoints/${id}`:'/catalog/endpoints',{method:id?'PUT':'POST',body:JSON.stringify(p)});if(r.apiKey&&r.apiKey!==curKey){curKey=r.apiKey;setTxt('key-disp',curKey);}curEpId=r._id;closeMod('modal-ep');toast(id?'Updated ✓':'Created ✓');loadEndpoints();loadStats();}
  catch(e){toast(e.message||'Error',true);}
}
async function delEp(id,name){if(!confirm(`Delete "${name}"?`))return;try{await fetch(`${API}/catalog/endpoints/${id}`,{method:'DELETE'});toast('Deleted');loadEndpoints();loadStats();}catch{toast('Error',true);}}
function toggleFileS(){document.getElementById('file-s').style.display=document.getElementById('ep-fon').checked?'block':'none';}
function toggleCacheS(){document.getElementById('cache-s').style.display=document.getElementById('ep-con').checked?'block':'none';}
function loadMockFile(){const f=document.getElementById('ep-mfile').files[0];if(!f)return;const r=new FileReader();r.onload=e=>{setVal('ep-mfb64',e.target.result.split(',')[1]);setVal('ep-mfname',f.name);setVal('ep-mfmime',f.type||'application/octet-stream');const el=document.getElementById('ep-mfile-info');el.style.display='block';el.textContent=`📄 ${f.name} (${(f.size/1024).toFixed(1)} KB)`;toast('File loaded ✓');};r.readAsDataURL(f);}

/* ── API KEY ──────────────────────────────────────── */
function toggleKeyS(){const on=document.getElementById('ep-keon').checked;document.getElementById('key-s').style.display=on?'block':'none';if(on&&!curKey)genKey();}
async function genKey(){const len=parseInt(document.getElementById('ep-klen').value)||32;if(curEpId){try{curKey=(await api(`/catalog/endpoints/${curEpId}/generate-key`,{method:'POST',body:JSON.stringify({length:len})})).apiKey;}catch{curKey=mkKey(len);}}else{curKey=mkKey(len);}setTxt('key-disp',curKey);toast('Key generated ✓');}
function mkKey(n){const c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';return Array.from({length:n},()=>c[Math.floor(Math.random()*c.length)]).join('');}
function copyKey(){if(!curKey){toast('No key yet',true);return;}navigator.clipboard.writeText(curKey).then(()=>toast('Key copied ✓'));}

/* ── cURL ─────────────────────────────────────────── */
function buildCurl(ep,base=window.location.origin){
  if(!ep)return'# no endpoint';
  const url=`${base}/api/${ep.virtualPath}`;
  const lines=[`curl -X ${ep.method} '${url}'`];
  lines.push(`  -H 'Content-Type: application/json'`);
  if(ep.requireApiKey&&ep.apiKey)lines.push(`  -H 'x-api-key: ${ep.apiKey}'`);
  Object.entries(ep.destinationHeaders||{}).forEach(([k,v])=>lines.push(`  -H '${k}: ${v}'`));
  const qp=(ep.queryParams||[]).map(p=>`${p.name}=${p.example||p.defaultValue||'<val>'}`);
  if(qp.length)lines[0]=`curl -X ${ep.method} '${url}?${qp.join('&')}'`;
  if(ep.fileConfig?.enabled&&['upload','both'].includes(ep.fileConfig.mode))lines.push(`  -F '${ep.fileConfig.fieldName||'file'}=@/path/to/file'`);
  else if(['POST','PUT','PATCH'].includes(ep.method)){const bx={};(ep.bodyParams||[]).forEach(p=>{bx[p.name]=p.example||'<val>';});if(Object.keys(bx).length)lines.push(`  -d '${JSON.stringify(bx)}'`);}
  return lines.join(' \\\n');
}
async function exportCurl(id){try{await navigator.clipboard.writeText(buildCurl(await api(`/catalog/endpoints/${id}`)));toast('cURL copied ✓');}catch{toast('Error',true);}}
function refreshCurlPrev(){const el=document.getElementById('ep-curl-pre');if(!el)return;el.textContent=buildCurl({method:document.getElementById('ep-method')?.value||'GET',virtualPath:getVal('ep-path')||'endpoint',requireApiKey:document.getElementById('ep-keon')?.checked,apiKey:curKey,destinationHeaders:colHdrs('ep-dhdrs'),queryParams:colPrms('ep-qp'),bodyParams:colPrms('ep-bp'),fileConfig:{enabled:document.getElementById('ep-fon')?.checked,mode:document.getElementById('ep-fmode')?.value||'upload',fieldName:getVal('ep-ffield')||'file'}});}
function copyCurl(pid){const t=document.getElementById(pid)?.textContent;if(!t||t.startsWith('Fill')){toast('Fill form first',true);return;}navigator.clipboard.writeText(t).then(()=>toast('cURL copied ✓'));}
function openCurlImport(){setVal('curl-in','');document.getElementById('curl-prev').style.display='none';document.getElementById('curl-create').style.display='none';parsedCurlData=null;openMod('modal-curl');}
function parseCurlIn(){
  const raw=getVal('curl-in').trim();if(!raw){toast('Paste a cURL command',true);return;}
  try{
    parsedCurlData=parseCurlStr(raw);
    document.getElementById('curl-parsed').innerHTML=`<strong>Method:</strong> ${parsedCurlData.method}<br/><strong>URL:</strong> <span style="color:var(--a)">${parsedCurlData.url}</span><br/><strong>Headers:</strong> ${Object.entries(parsedCurlData.headers).map(([k,v])=>`${k}: ${v}`).join(', ')||'—'}<br/><strong>Body:</strong> ${parsedCurlData.body?JSON.stringify(parsedCurlData.body).substring(0,100)+'…':'—'}`;
    const p=new URL(parsedCurlData.url).pathname.replace(/^\//,'').replace(/\//g,'-');
    setVal('curl-name',p||'imported');setVal('curl-path',p||'imported');
    document.getElementById('curl-prev').style.display='block';document.getElementById('curl-create').style.display='inline-flex';
    M.updateTextFields();toast('Parsed ✓');
  }catch(e){toast(`Parse error: ${e.message}`,true);}
}
function parseCurlStr(raw){
  const line=raw.replace(/\\\s*\n\s*/g,' ').replace(/\s+/g,' ').trim();
  const mM=line.match(/-X\s+([A-Z]+)/i),method=mM?mM[1].toUpperCase():'GET';
  const uM=line.match(/['"]?(https?:\/\/[^\s'"&]+)['"]?/i);if(!uM)throw new Error('URL not found');
  const url=new URL(uM[1].replace(/['"]/g,'')),hdrs={};
  [...line.matchAll(/-H\s+['"]([^'"]+)['"]/gi)].forEach(m=>{const[k,...v]=m[1].split(':');hdrs[k.trim()]=v.join(':').trim();});
  const dm=line.match(/(?:-d|--data(?:-raw)?)\s+'([^']+)'/s)||line.match(/(?:-d|--data(?:-raw)?)\s+"([^"]+)"/s);
  let body=null;if(dm){try{body=JSON.parse(dm[1].replace(/\\"/g,'"'));}catch{body=dm[1];}}
  return{method,url:url.origin+url.pathname,headers:hdrs,body};
}
async function importCurl(){
  if(!parsedCurlData)return;
  const name=getVal('curl-name').trim(),vp=getVal('curl-path').trim().replace(/^\/+/,'');
  if(!name||!vp){toast('Name and path required',true);return;}
  const hdrs={...parsedCurlData.headers};delete hdrs['Content-Type'];delete hdrs['content-type'];
  const bp=parsedCurlData.body&&typeof parsedCurlData.body==='object'?Object.keys(parsedCurlData.body).map(k=>({name:k,type:'string',required:false})):[];
  try{await api('/catalog/endpoints',{method:'POST',body:JSON.stringify({name,virtualPath:vp,method:parsedCurlData.method,destinationUrl:parsedCurlData.url,destinationHeaders:hdrs,bodyParams:bp,enabled:true})});closeMod('modal-curl');toast(`"${name}" created ✓`);loadEndpoints();loadStats();}
  catch(e){toast(e.message||'Error',true);}
}

/* ── EVENTS ───────────────────────────────────────── */
async function loadEvents(){try{allEvs=await api('/catalog/events');renderEvs(allEvs);}catch{renderErr('ev-tbody',5,'Error loading events');}}
function renderEvs(list){
  const tb=document.getElementById('ev-tbody');
  if(!list.length){tb.innerHTML=`<tr><td colspan="5"><div class="empty"><i class="material-icons">bolt</i><p>No events yet</p></div></td></tr>`;return;}
  tb.innerHTML=list.map(ev=>`<tr>
    <td><div style="font-weight:600;font-size:.8rem">${ev.name}</div>${ev.description?`<div style="font-size:.63rem;color:var(--t3)">${ev.description}</div>`:''}</td>
    <td><span class="badge ${ev.type==='webhook'?'bproxy':'bmock'}">${ev.type}</span></td>
    <td style="font-family:var(--mono);font-size:.63rem;color:var(--t3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ev.type==='webhook'?(ev.url||'—'):((ev.script||'').substring(0,60)+'…')}</td>
    <td><span style="display:inline-flex;align-items:center;gap:4px"><span class="dot ${ev.enabled?'don':'doff'}"></span><span style="font-size:.66rem;color:${ev.enabled?'var(--a)':'var(--t3)'}">${ev.enabled?'Active':'Off'}</span></span></td>
    <td><div style="display:flex;gap:2px">
      <button class="btn-i" onclick="editEv('${ev._id}')"><i class="material-icons">edit</i></button>
      <button class="btn-i" style="color:var(--danger);border-color:rgba(255,87,87,.25)" onclick="delEv('${ev._id}','${ev.name}')"><i class="material-icons">delete</i></button>
    </div></td>
  </tr>`).join('');
}
function openEvModal(ev=null){
  ['ev-id','ev-name','ev-desc','ev-url','ev-script'].forEach(id=>setVal(id,''));
  document.getElementById('ev-enabled').checked=true;document.getElementById('ev-hdrs').innerHTML='';
  document.getElementById('ev-wh').style.display='block';document.getElementById('ev-sc').style.display='none';
  document.getElementById('ev-title').textContent=ev?'Edit Event':'New Event';
  if(ev){setVal('ev-id',ev._id);setVal('ev-name',ev.name);setVal('ev-desc',ev.description||'');setVal('ev-url',ev.url||'');setVal('ev-script',ev.script||'');document.getElementById('ev-enabled').checked=ev.enabled!==false;Object.entries(ev.headers||{}).forEach(([k,v])=>addHdr('ev-hdrs',k,v));setTimeout(()=>{setSelVal('ev-type',ev.type||'webhook');setSelVal('ev-meth',ev.method||'POST');toggleEvType();},40);}
  M.updateTextFields();openMod('modal-ev');
}
async function editEv(id){try{openEvModal(await api(`/catalog/events/${id}`));}catch{toast('Error',true);}}
async function saveEv(){
  const id=getVal('ev-id'),name=getVal('ev-name').trim(),type=document.getElementById('ev-type').value;
  if(!name){toast('Name required',true);return;}
  const p={name,type,description:getVal('ev-desc'),enabled:document.getElementById('ev-enabled').checked,url:getVal('ev-url').trim()||undefined,method:document.getElementById('ev-meth').value,headers:colHdrs('ev-hdrs'),script:getVal('ev-script')||undefined};
  try{await api(id?`/catalog/events/${id}`:'/catalog/events',{method:id?'PUT':'POST',body:JSON.stringify(p)});closeMod('modal-ev');toast(id?'Updated ✓':'Created ✓');loadEvents();}
  catch(e){toast(e.message||'Error',true);}
}
async function delEv(id,name){if(!confirm(`Delete "${name}"?`))return;try{await fetch(`${API}/catalog/events/${id}`,{method:'DELETE'});toast('Deleted');loadEvents();}catch{toast('Error',true);}}
function toggleEvType(){const t=document.getElementById('ev-type').value;document.getElementById('ev-wh').style.display=t==='webhook'?'block':'none';document.getElementById('ev-sc').style.display=t==='script'?'block':'none';}
function popEvSels(){
  ['ep-pre-sel','ep-post-sel'].forEach((sid,idx)=>{const sel=document.getElementById(sid);sel.innerHTML=`<option value="">— ${idx===0?'PRE':'POST'} event —</option>`;allEvs.forEach(ev=>{const o=document.createElement('option');o.value=ev._id;o.textContent=ev.name;sel.appendChild(o);});});
  document.getElementById('ep-pre-sel').onchange=function(){const ev=allEvs.find(e=>e._id===this.value);if(ev&&!preEvs.find(e=>e._id===ev._id)){preEvs.push({_id:ev._id,name:ev.name});renderPills('ep-pre-pills',preEvs,'pre');}this.value='';};
  document.getElementById('ep-post-sel').onchange=function(){const ev=allEvs.find(e=>e._id===this.value);if(ev&&!postEvs.find(e=>e._id===ev._id)){postEvs.push({_id:ev._id,name:ev.name});renderPills('ep-post-pills',postEvs,'post');}this.value='';};
}
function renderPills(cId,evs,phase){const c=document.getElementById(cId);c.innerHTML=evs.length?evs.map((ev,i)=>`<span class="epill ${phase}">${ev.name}<span class="rm" onclick="rmPill('${cId}',${i},'${phase}')"> ✕</span></span>`).join(''):`<span style="font-size:.63rem;color:var(--t3)">No events</span>`;}
function rmPill(cId,i,phase){if(phase==='pre')preEvs.splice(i,1);else postEvs.splice(i,1);renderPills(cId,phase==='pre'?preEvs:postEvs,phase);}

/* ── HISTORY ──────────────────────────────────────── */
async function populateEpDropdowns(){
  try{const eps=await api('/catalog/endpoints');
  const hs=document.getElementById('h-ep');hs.innerHTML='<option value="">All endpoints</option>';eps.forEach(ep=>{const o=document.createElement('option');o.value=ep._id;o.textContent=`${ep.method} /api/${ep.virtualPath}`;hs.appendChild(o);});}catch{}
}
function onHCtrl(){clearHTimer();loadHist(true);startHTimer();}
function startHTimer(){const iv=parseInt(document.getElementById('h-refresh').value)*1000;document.getElementById('live-dot').classList.toggle('dlive',!!iv);if(iv)histTmr=setInterval(()=>loadHist(false),iv);}
function clearHTimer(){if(histTmr){clearInterval(histTmr);histTmr=null;}}
async function loadHist(reset=false){
  const range=document.getElementById('h-range')?.value||'all';
  const epId=document.getElementById('h-ep')?.value||'';
  const st=document.getElementById('h-st')?.value||'';
  try{
    const stats=await api(`/catalog/executions/stats?range=${range}`);
    setTxt('hs-total',stats.total??0);setTxt('hs-ok',stats.success??0);setTxt('hs-err',stats.errors??0);
    setTxt('hs-avg',(stats.avgMs??0)+'ms');setTxt('hs-cache',stats.cacheHits??0);
    const params=new URLSearchParams({range,limit:'200'});if(epId)params.set('endpointId',epId);
    const rows=await api(`/catalog/executions?${params}`);
    const filtered=st?rows.filter(r=>r.status===st):rows;
    if(reset){histRows=filtered;}else{const ids=new Set(histRows.map(r=>r._id));const nr=filtered.filter(r=>!ids.has(r._id));if(nr.length)histRows=[...nr,...histRows].slice(0,500);}
    renderHistLog();setTxt('h-cnt',histRows.length);setTxt('h-sel',0);setTxt('h-ts',new Date().toLocaleTimeString());
    document.getElementById('sel-all').checked=false;document.getElementById('btn-del-sel').style.display='none';
  }catch(e){console.error('History:',e);}
}
function renderHistLog(){
  const c=document.getElementById('hist-log');
  if(!histRows.length){c.innerHTML=`<div class="empty"><i class="material-icons">history</i><p>No records</p></div>`;return;}
  c.innerHTML=histRows.map(ex=>{
    const d=new Date(ex.startedAt);const ts=d.toLocaleDateString('en',{month:'2-digit',day:'2-digit'})+' '+d.toLocaleTimeString('en',{hour12:false});
    const hc=ex.responseStatus<300?'var(--a)':ex.responseStatus<500?'var(--warn)':'var(--danger)';
    const dc=ex.totalDurationMs<200?'dfast':ex.totalDurationMs<1000?'dmid':'dslow';
    return `<div class="logrow ${ex.status==='error'?'lerr':''}" data-id="${ex._id}">
      <input type="checkbox" class="rck row-chk" data-id="${ex._id}" onchange="onRowChk()"/>
      <span style="color:var(--t3);font-size:.6rem">${ts}</span>
      <span><span class="badge b${ex.method}" style="font-size:.56rem">${ex.method}</span></span>
      <span style="font-family:var(--mono);font-size:.66rem;color:${hc};font-weight:700">${ex.responseStatus}</span>
      <span style="font-size:.64rem;font-weight:700;color:${ex.status==='success'?'var(--a)':'var(--danger)'}">${ex.status}</span>
      <span><span class="badge ${ex.mode==='proxy'?'bproxy':'bmock'}" style="font-size:.56rem">${ex.mode}</span></span>
      <span class="${dc}" style="font-family:var(--mono)">${ex.totalDurationMs}ms</span>
      <span style="color:var(--t2);font-size:.66rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" onclick='showExec(${JSON.stringify(ex)})'><span style="color:var(--t3)">/api/</span>${ex.virtualPath}</span>
      <span>${ex.cacheHit?'<i class="material-icons" style="font-size:.7rem;color:var(--teal)">bolt</i>':''}</span>
    </div>`;
  }).join('');
}
function onRowChk(){const n=document.querySelectorAll('.row-chk:checked').length;setTxt('h-sel',n);document.getElementById('btn-del-sel').style.display=n?'inline-flex':'none';}
function toggleSelAll(){const on=document.getElementById('sel-all').checked;document.querySelectorAll('.row-chk').forEach(c=>c.checked=on);onRowChk();}
async function delSelected(){const ids=[...document.querySelectorAll('.row-chk:checked')].map(c=>c.dataset.id);if(!ids.length)return;if(!confirm(`Delete ${ids.length} record(s)?`))return;try{const r=await api('/catalog/executions/bulk',{method:'DELETE',body:JSON.stringify({ids})});toast(`${r.deleted} deleted ✓`);histRows=histRows.filter(row=>!ids.includes(row._id));renderHistLog();setTxt('h-cnt',histRows.length);setTxt('h-sel',0);document.getElementById('btn-del-sel').style.display='none';document.getElementById('sel-all').checked=false;}catch{toast('Error',true);}}
async function confDelAll(){const range=document.getElementById('h-range')?.value||'all';const epId=document.getElementById('h-ep')?.value||'';if(!confirm(`Delete ALL records?`))return;try{const body={};if(epId)body.endpointId=epId;if(range!=='all')body.range=range;const r=await api('/catalog/executions/bulk',{method:'DELETE',body:JSON.stringify(body)});toast(`${r.deleted} deleted ✓`);loadHist(true);}catch{toast('Error',true);}}
function showExec(ex){
  curExec=ex;
  document.getElementById('exec-title').textContent=`${ex.method} /api/${ex.virtualPath}`;
  const sc=ex.status==='success'?'var(--a)':'var(--danger)';
  document.getElementById('exec-kpis').innerHTML=`
    <div class="kpi" style="padding:9px 11px"><div class="kval" style="font-size:1rem;color:${sc}">${ex.status.toUpperCase()}</div><div class="klbl">Status</div></div>
    <div class="kpi" style="padding:9px 11px"><div class="kval" style="font-size:1rem">${ex.totalDurationMs}ms</div><div class="klbl">Total</div></div>
    <div class="kpi" style="padding:9px 11px"><div class="kval" style="font-size:1rem">${ex.responseStatus}</div><div class="klbl">HTTP</div></div>
    <div class="kpi" style="padding:9px 11px"><div class="kval" style="font-size:1rem">${ex.mode}</div><div class="klbl">Mode</div></div>
    <div class="kpi" style="padding:9px 11px"><div class="kval" style="font-size:1rem">${ex.cacheHit?'HIT':'MISS'}</div><div class="klbl">Cache</div></div>`;
  const pre=(ex.preEventResults||[]).reduce((a,e)=>a+(e.durationMs||0),0);
  const post=(ex.postEventResults||[]).reduce((a,e)=>a+(e.durationMs||0),0);
  const call=ex.proxyDurationMs??Math.max(0,ex.totalDurationMs-pre-post);
  const tot=Math.max(ex.totalDurationMs,1);
  document.getElementById('exec-tl').innerHTML=`
    <div style="display:flex;gap:2px;height:18px;border-radius:3px;overflow:hidden;margin-bottom:7px">
      ${pre?`<div style="width:${Math.max(pre/tot*100,1.5)}%;background:var(--a);opacity:.8" title="PRE ${pre}ms"></div>`:''}
      <div style="flex:1;background:var(--blue);opacity:.8" title="Call ${call}ms"></div>
      ${post?`<div style="width:${Math.max(post/tot*100,1.5)}%;background:var(--warn);opacity:.8" title="POST ${post}ms"></div>`:''}
    </div>
    <div style="display:flex;gap:12px;font-size:.6rem;color:var(--t3)">
      <span style="color:var(--a)">● PRE ${pre}ms</span>
      <span style="color:var(--blue)">● Call ${call}ms</span>
      <span style="color:var(--warn)">● POST ${post}ms</span>
      ${ex.cacheHit?'<span style="color:var(--teal)">⚡ Cache HIT</span>':''}
    </div>
    ${ex.validationErrors?.length?`<div style="margin-top:7px;padding:5px 9px;background:var(--ddim);border:1px solid rgba(255,87,87,.18);border-radius:4px;font-size:.66rem;color:var(--danger)">⚠ ${ex.validationErrors.join(' | ')}</div>`:''}`;
  document.getElementById('exec-req').textContent=JSON.stringify({query:ex.requestQuery,body:ex.requestBody,headers:ex.requestHeaders},null,2);
  document.getElementById('exec-res').textContent=JSON.stringify({statusCode:ex.responseStatus,body:ex.responseBody},null,2);
  document.getElementById('exec-evs').textContent=JSON.stringify({pre:ex.preEventResults,post:ex.postEventResults},null,2);
  const ext=ex.ctxExtras||{};document.getElementById('exec-ext').textContent=Object.keys(ext).length?JSON.stringify(ext,null,2):'// ctx.extras empty';
  resetItabs('modal-exec');openMod('modal-exec');
}
function copyExecCurl(){if(!curExec)return;const ex=curExec;const qs=Object.keys(ex.requestQuery||{}).length?'?'+Object.entries(ex.requestQuery).map(([k,v])=>`${k}=${v}`).join('&'):'';const lines=[`curl -X ${ex.method} '${window.location.origin}/api/${ex.virtualPath}${qs}'`,`  -H 'Content-Type: application/json'`];if(ex.apiKeyUsed)lines.push(`  -H 'x-api-key: <your-key>'`);if(ex.requestBody&&Object.keys(ex.requestBody).length)lines.push(`  -d '${JSON.stringify(ex.requestBody)}'`);navigator.clipboard.writeText(lines.join(' \\\n')).then(()=>toast('cURL copied ✓'));}

/* ── DASHBOARD ────────────────────────────────────── */
function initDash(){
  if(!dashReady){dashReady=true;populateEpDropdowns();}
  loadDash();
  clearInterval(dashTmr);
  dashTmr=setInterval(loadDash,30000); // silent 30s refresh
}
async function loadDash(){
  const range=document.getElementById('dash-range')?.value||'1h';
  try{
    const s=await api(`/catalog/executions/stats?range=${range}`);
    renderDashKPIs(s);renderDashCharts(s);renderPerfTable(s.topEndpoints||[]);
    setTxt('dash-ts','Updated '+new Date().toLocaleTimeString());
  }catch(e){console.error('Dashboard:',e);}
}

/* KPIs */
function renderDashKPIs(s){
  const fmt=n=>n>=1000?(n/1000).toFixed(1)+'k':String(n);
  const delta=(v,invert=false)=>{if(v===null||v===undefined)return'';const good=invert?v<0:v>0;const cls=v===0?'neu':good?'up':'dn';return `<div class="kdelta ${cls}">${v>0?'▲':'▼'} ${Math.abs(v)}% vs prev</div>`;};
  setTxt('dk-total',fmt(s.total||0));setTxt('dk-ok',fmt(s.success||0));setTxt('dk-err',fmt(s.errors||0));
  setTxt('dk-avg',(s.avgMs||0)+'ms');setTxt('dk-p95',(s.p95Ms||0)+'ms');setTxt('dk-p99',(s.p99Ms||0)+'ms');
  setTxt('dk-cache',fmt(s.cacheHits||0));setTxt('dk-errrate',(s.errorRate||0)+'%');
  // deltas
  document.querySelectorAll('#pg-dashboard .kpi').forEach(k=>{const ex=k.querySelector('.kdelta');if(ex)ex.remove();});
  const kd=s.delta||{};const kpis=document.querySelectorAll('#pg-dashboard > .kgrid .kpi');
  if(kd.total!==null)kpis[0]?.insertAdjacentHTML('beforeend',delta(kd.total));
  if(kd.errors!==null)kpis[2]?.insertAdjacentHTML('beforeend',delta(kd.errors,true));
  if(kd.avgMs!==null)kpis[3]?.insertAdjacentHTML('beforeend',delta(kd.avgMs,true));
  // error badge
  const rate=s.errorRate||0;const eb=document.getElementById('err-badge');
  if(eb){eb.textContent=rate+'% error rate';eb.style.background=rate>10?'var(--ddim)':rate>2?'var(--wdim)':'var(--okdim)';eb.style.color=rate>10?'var(--danger)':rate>2?'var(--warn)':'var(--ok)';}
}

/* chart colour helper */
function C(){const s=getComputedStyle(document.documentElement),g=v=>s.getPropertyValue(v).trim();return{a:g('--a'),blue:g('--blue'),purple:g('--purple'),warn:g('--warn'),danger:g('--danger'),ok:g('--ok'),teal:g('--teal'),t1:g('--t1'),t2:g('--t2'),t3:g('--t3'),card:g('--card'),surf:g('--surf'),border:g('--border')};}
function dch(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function redrawCharts(){if(dashReady)loadDash();if(drillId)loadDrill();}
function baseOpts(c,extra={}){return{responsive:true,maintainAspectRatio:false,animation:{duration:450},plugins:{legend:{labels:{color:c.t2,font:{size:10,family:'Space Grotesk'},boxWidth:9}},tooltip:{backgroundColor:c.card,borderColor:c.border,borderWidth:1,titleColor:c.t2,bodyColor:c.t2,padding:9,cornerRadius:5}},scales:{x:{ticks:{color:c.t3,font:{size:9}},grid:{color:c.border+'30'}},y:{ticks:{color:c.t3,font:{size:9}},grid:{color:c.border+'30'}}},...extra};}

/* all charts */
function renderDashCharts(s){
  const c=C(),tl=s.timeline||[],eps=s.topEndpoints||[];

  /* Timeline dual-axis */
  dch('ch-tl');const ctx0=document.getElementById('ch-tl');
  if(ctx0){
    const labs=tl.map(b=>{const d=new Date(b.ts);return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');});
    charts['ch-tl']=new Chart(ctx0,{data:{labels:labs,datasets:[
      {type:'bar', label:'Requests',data:tl.map(b=>b.count), backgroundColor:c.a+'44',borderColor:c.a,borderWidth:1,borderRadius:2,yAxisID:'yC'},
      {type:'bar', label:'Errors',  data:tl.map(b=>b.errors),backgroundColor:c.danger+'44',borderColor:c.danger,borderWidth:1,borderRadius:2,yAxisID:'yC'},
      {type:'line',label:'Avg ms',  data:tl.map(b=>b.avgMs), borderColor:c.blue,backgroundColor:'transparent',tension:.4,pointRadius:2,borderWidth:2,yAxisID:'yMs'},
    ]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:450},interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:c.t2,font:{size:10,family:'Space Grotesk'},boxWidth:9}},tooltip:{backgroundColor:c.card,borderColor:c.border,borderWidth:1,titleColor:c.t2,bodyColor:c.t2,padding:9,cornerRadius:5}},scales:{x:{ticks:{color:c.t3,font:{size:9}},grid:{color:c.border+'25'}},yC:{position:'left',ticks:{color:c.t3,font:{size:9}},grid:{color:c.border+'25'},title:{display:true,text:'req',color:c.t3,font:{size:9}}},yMs:{position:'right',ticks:{color:c.blue,font:{size:9}},grid:{display:false},title:{display:true,text:'ms',color:c.blue,font:{size:9}}}}}});
    // overlay
    const ov=document.getElementById('tl-ovrl');if(ov&&s.total)ov.innerHTML=`<div class="tlovrl-i"><div class="tlovrl-v">${s.avgMs}ms</div><div class="tlovrl-l">avg</div></div><div class="tlovrl-i"><div class="tlovrl-v">${s.p95Ms}ms</div><div class="tlovrl-l">p95</div></div><div class="tlovrl-i"><div class="tlovrl-v">${s.p99Ms}ms</div><div class="tlovrl-l">p99</div></div>`;
  }

  /* By endpoint bar */
  dch('ch-byep');const ctx1=document.getElementById('ch-byep');
  if(ctx1){charts['ch-byep']=new Chart(ctx1,{type:'bar',data:{labels:eps.map(e=>`/api/${e.path||e.name}`),datasets:[{label:'Calls',data:eps.map(e=>e.calls),backgroundColor:c.a+'bb',borderRadius:3},{label:'Errors',data:eps.map(e=>e.errors),backgroundColor:c.danger+'bb',borderRadius:3}]},options:baseOpts(c)});}

  /* Status donut */
  dch('ch-status');const ctx2=document.getElementById('ch-status');
  if(ctx2){const bs=s.byStatus||[];const cmap={'2':c.a,'3':c.teal,'4':c.warn,'5':c.danger};const bgs=bs.map(b=>(cmap[String(b.code)[0]]||c.blue)+'cc');charts['ch-status']=new Chart(ctx2,{type:'bar',data:{labels:bs.map(b=>b.code),datasets:[{label:'Count',data:bs.map(b=>b.count),backgroundColor:bgs,borderRadius:3}]},options:{...baseOpts(c),plugins:{...baseOpts(c).plugins,legend:{display:false}}}});}

  /* Success/Error doughnut */
  dch('ch-donut');const ctx3=document.getElementById('ch-donut');
  if(ctx3){charts['ch-donut']=new Chart(ctx3,{type:'doughnut',data:{labels:['Success','Error'],datasets:[{data:[s.success||0,s.errors||0],backgroundColor:[c.a+'dd',c.danger+'dd'],borderColor:[c.a,c.danger],borderWidth:2,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',animation:{duration:450},plugins:{legend:{position:'right',labels:{color:c.t2,font:{size:10,family:'Space Grotesk'},boxWidth:9}},tooltip:{backgroundColor:c.card,borderColor:c.border,borderWidth:1,titleColor:c.t2,bodyColor:c.t2,padding:9,cornerRadius:5}}}});}

  /* Avg ms horizontal */
  dch('ch-avgms');const ctx4=document.getElementById('ch-avgms');
  if(ctx4){const ms=eps.map(e=>e.avgMs),mx=Math.max(...ms,1);charts['ch-avgms']=new Chart(ctx4,{type:'bar',data:{labels:eps.map(e=>`/api/${e.path||e.name}`),datasets:[{label:'Avg ms',data:ms,backgroundColor:ms.map(v=>{const r=v/mx;return(r>.8?c.danger:r>.5?c.warn:c.blue)+'bb';}),borderRadius:3}]},options:{...baseOpts(c,{indexAxis:'y'}),plugins:{...baseOpts(c).plugins,legend:{display:false}}}});}

  /* By method doughnut */
  dch('ch-method');const ctx5=document.getElementById('ch-method');
  if(ctx5){const bm=s.byMethod||[];const mc={GET:c.a,POST:c.purple,PUT:c.warn,PATCH:c.blue,DELETE:c.danger};charts['ch-method']=new Chart(ctx5,{type:'doughnut',data:{labels:bm.map(m=>m.method),datasets:[{data:bm.map(m=>m.count),backgroundColor:bm.map(m=>(mc[m.method]||c.teal)+'cc'),borderColor:bm.map(m=>mc[m.method]||c.teal),borderWidth:2,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:'58%',animation:{duration:450},plugins:{legend:{position:'right',labels:{color:c.t2,font:{size:10,family:'Space Grotesk'},boxWidth:9}},tooltip:{backgroundColor:c.card,borderColor:c.border,borderWidth:1,titleColor:c.t2,bodyColor:c.t2,padding:9,cornerRadius:5}}}});}
}

/* Performance table */
function renderPerfTable(eps){
  const tb=document.getElementById('perf-tbody');
  if(!eps.length){tb.innerHTML=`<tr><td colspan="10"><div class="empty" style="padding:22px"><i class="material-icons">bar_chart</i><p>No data yet — make some API calls first</p></div></td></tr>`;return;}
  const mx=Math.max(...eps.map(e=>e.avgMs),1);
  tb.innerHTML=eps.map(ep=>{
    const er=ep.errorRate||0;const hw=er>10?'hbad':er>2?'hwarn':'hgood';const hl=er>10?'Critical':er>2?'Degraded':'Healthy';
    const bw=Math.round(ep.avgMs/mx*100);
    return `<tr onclick="openDrill('${ep.id}','${ep.name}','/api/${ep.path}')">
      <td><span class="epath"><span class="pre">/api/</span>${ep.path||ep.name}</span></td>
      <td><span class="badge b${ep.method}">${ep.method}</span></td>
      <td><strong>${ep.calls}</strong></td>
      <td><div>${ep.avgMs}ms</div><div class="bartrack"><div class="barfill" style="width:${bw}%;background:var(--blue)"></div></div></td>
      <td style="color:var(--t3)">${ep.minMs}ms</td>
      <td style="color:var(--warn)">${ep.maxMs}ms</td>
      <td style="color:var(--danger)">${ep.errors}</td>
      <td><span style="font-weight:700;color:${er>10?'var(--danger)':er>2?'var(--warn)':'var(--a)'}">${er}%</span></td>
      <td style="color:var(--teal)">${ep.cacheHits||0}</td>
      <td><span class="health ${hw}">${hl}</span></td>
    </tr>`;
  }).join('');
}

/* Drill-down */
function openDrill(id,name,path){drillId=id;setTxt('drill-name',name);setTxt('drill-path',path);document.getElementById('drill').style.display='block';document.getElementById('drill').scrollIntoView({behavior:'smooth',block:'nearest'});loadDrill();}
function closeDrill(){document.getElementById('drill').style.display='none';drillId=null;dch('ch-dtl');dch('ch-dpie');}
async function loadDrill(){
  if(!drillId)return;
  const range=document.getElementById('drill-range')?.value||'1h';
  try{const d=await api(`/catalog/executions/endpoint/${drillId}/stats?range=${range}`);renderDrillKPIs(d);renderDrillCharts(d);renderDrillErrs(d.recentErrors||[]);}
  catch(e){console.error('Drill:',e);}
}
function renderDrillKPIs(d){
  const sum=d.summary||[];const ok=sum.find(s=>s._id==='success')?.count||0;const er=sum.find(s=>s._id==='error')?.count||0;const avg=sum.find(s=>s._id==='success')?.avgMs??sum[0]?.avgMs??0;const tot=ok+er;
  document.getElementById('drill-kpis').innerHTML=`
    <div class="kpi" style="padding:9px 12px"><div class="kval">${tot}</div><div class="klbl">Calls</div></div>
    <div class="kpi" style="padding:9px 12px"><div class="kval" style="color:var(--a)">${ok}</div><div class="klbl">Success</div></div>
    <div class="kpi" style="padding:9px 12px"><div class="kval" style="color:var(--danger)">${er}</div><div class="klbl">Errors</div></div>
    <div class="kpi" style="padding:9px 12px"><div class="kval">${Math.round(avg)}ms</div><div class="klbl">Avg ms</div></div>
    <div class="kpi" style="padding:9px 12px"><div class="kval">${d.p95Ms||0}ms</div><div class="klbl">P95</div></div>
    <div class="kpi" style="padding:9px 12px"><div class="kval">${d.p99Ms||0}ms</div><div class="klbl">P99</div></div>`;
}
function renderDrillCharts(d){
  const c=C(),tl=d.timeline||[];const labs=tl.map(b=>{const dt=new Date(b.ts);return dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0');});
  dch('ch-dtl');const ct=document.getElementById('ch-dtl');
  if(ct){charts['ch-dtl']=new Chart(ct,{data:{labels:labs,datasets:[{type:'line',label:'Avg ms',data:tl.map(b=>b.avgMs),borderColor:c.purple,backgroundColor:c.purple+'18',fill:true,tension:.4,pointRadius:2,yAxisID:'yMs'},{type:'bar',label:'Calls',data:tl.map(b=>b.count),backgroundColor:c.a+'55',borderRadius:2,yAxisID:'yC'},{type:'bar',label:'Errors',data:tl.map(b=>b.errors),backgroundColor:c.danger+'77',borderRadius:2,yAxisID:'yC'}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:350},interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:c.t2,font:{size:10,family:'Space Grotesk'},boxWidth:9}},tooltip:{backgroundColor:c.card,borderColor:c.border,borderWidth:1,titleColor:c.t2,bodyColor:c.t2,padding:9,cornerRadius:5}},scales:{x:{ticks:{color:c.t3,font:{size:9}},grid:{color:c.border+'25'}},yMs:{position:'left',ticks:{color:c.purple,font:{size:9}},grid:{color:c.border+'25'},title:{display:true,text:'ms',color:c.purple,font:{size:9}}},yC:{position:'right',ticks:{color:c.t3,font:{size:9}},grid:{display:false},title:{display:true,text:'req',color:c.t3,font:{size:9}}}}}});}
  dch('ch-dpie');const cp=document.getElementById('ch-dpie');
  if(cp){const ok=d.summary?.find(s=>s._id==='success')?.count||0;const er=d.summary?.find(s=>s._id==='error')?.count||0;charts['ch-dpie']=new Chart(cp,{type:'doughnut',data:{labels:['Success','Error'],datasets:[{data:[ok,er],backgroundColor:[c.a+'dd',c.danger+'dd'],borderColor:[c.a,c.danger],borderWidth:2,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',animation:{duration:350},plugins:{legend:{position:'right',labels:{color:c.t2,font:{size:10,family:'Space Grotesk'},boxWidth:9}},tooltip:{backgroundColor:c.card,borderColor:c.border,borderWidth:1,titleColor:c.t2,bodyColor:c.t2,padding:9,cornerRadius:5}}}});}
}
function renderDrillErrs(errs){
  const el=document.getElementById('drill-errs');if(!errs.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="slabel" style="margin-bottom:7px">Recent Errors</div><div style="display:flex;flex-direction:column;gap:4px">${errs.map(e=>`<div style="background:var(--ddim);border:1px solid rgba(255,87,87,.14);border-radius:5px;padding:7px 11px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:5px"><span style="font-family:var(--mono);font-size:.66rem;color:var(--danger)">${e.errorMessage||'Unknown error'}</span><div style="display:flex;gap:8px;font-size:.62rem;color:var(--t3)"><span>HTTP ${e.responseStatus}</span><span>${e.totalDurationMs}ms</span><span>${new Date(e.startedAt).toLocaleTimeString()}</span></div></div>`).join('')}</div>`;
}

/* ── TESTER ───────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════
   TESTER — with history + code gen
   ═══════════════════════════════════════════════════════════ */
let testBlob  = null;
let testHistory = [];       // max 50 entries
let testHistoryIdx = -1;   // currently viewed entry

/* ── Load endpoint into tester ─────────────────────── */
function populateTesterEpDropdown(list) {
  const sel = document.getElementById('t-ep-load');
  if (!sel) return;
  sel.innerHTML = '<option value="">Load endpoint…</option>' +
    list.map(ep => `<option value="${ep._id}" data-path="${ep.virtualPath}" data-method="${ep.method}">${ep.method} /${ep.virtualPath} — ${ep.name}</option>`).join('');
}

async function loadEpIntoTester(id) {
  if (!id) return;
  try {
    const ep = await api(`/catalog/endpoints/${id}`);
    // Switch to test tab
    document.querySelectorAll('.ntab').forEach(t => t.classList.toggle('on', t.dataset.target === 'pg-tester'));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'pg-tester'));
    // Fill fields
    document.getElementById('t-method').value = ep.method;
    setVal('t-path', ep.virtualPath);
    if (ep.requireApiKey && ep.apiKey) setVal('t-apikey', ep.apiKey);
    // Prefill body from bodyParams
    if (['POST','PUT','PATCH'].includes(ep.method) && (ep.bodyParams||[]).length) {
      const ex = {};
      (ep.bodyParams||[]).forEach(p => { ex[p.name] = p.example || p.defaultValue || ''; });
      setVal('t-body', JSON.stringify(ex, null, 2));
    }
    // Prefill query from queryParams
    if ((ep.queryParams||[]).length) {
      setVal('t-query', ep.queryParams.map(p => `${p.name}=${p.example||p.defaultValue||''}`).join('\n'));
    }
    // Fill headers
    const hdrsEl = document.getElementById('t-hdrs');
    if (hdrsEl) {
      hdrsEl.innerHTML = '';
      Object.entries(ep.destinationHeaders||{}).forEach(([k,v]) => addHdr('t-hdrs', k, v));
    }
    toast(`Loaded: ${ep.method} /${ep.virtualPath}`);
  } catch(e) { toast('Error loading endpoint', true); }
}

async function loadEpIntoTesterById(id) {
  const sel = document.getElementById('t-ep-load');
  if (sel) sel.value = id;
  return loadEpIntoTester(id);
}

/* ── Run ─────────────────────────────────────────────── */
async function runTest() {
  const method  = document.getElementById('t-method').value;
  const path    = getVal('t-path').trim().replace(/^\//,'');
  const apiKey  = getVal('t-apikey').trim();
  if (!path) { toast('Enter a virtual path', true); return; }

  const qls = getVal('t-query').split('\n').filter(l => l.includes('='));
  const qs  = qls.map(l => { const [k,...v]=l.split('='); return `${encodeURIComponent(k.trim())}=${encodeURIComponent(v.join('=').trim())}`; }).join('&');
  const fi  = document.getElementById('t-file');
  testBlob  = null;

  // Collect manual headers
  const manualHdrs = colHdrs('t-hdrs');

  // Snapshot request for history
  const histEntry = {
    id:     Date.now(),
    method, path, qs,
    apiKey,
    query:  getVal('t-query'),
    body:   getVal('t-body'),
    headers: manualHdrs,
    ts:     new Date(),
    status: null, dur: null, response: null, meta: null,
  };

  // Send button feedback
  const btn = document.getElementById('t-send-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="material-icons" style="font-size:14px;animation:spin 1s linear infinite">refresh</i>Sending…'; }

  try {
    let opts;
    const allHdrs = { ...manualHdrs };
    if (apiKey) allHdrs['x-api-key'] = apiKey;

    if (fi.files.length) {
      const fd = new FormData();
      fd.append('file', fi.files[0]);
      Object.entries(allHdrs).forEach(([k,v]) => fd.append(`__hdr_${k}`, v));
      opts = { method, headers: apiKey?{'x-api-key':apiKey}:{}, body: fd };
    } else {
      let body = {};
      try { body = JSON.parse(getVal('t-body') || '{}'); } catch {}
      opts = {
        method,
        headers: { 'Content-Type':'application/json', ...allHdrs },
        body: !['GET','DELETE'].includes(method) ? JSON.stringify(body) : undefined,
      };
    }

    const t0  = Date.now();
    const res = await fetch(`${API}/api/${path}${qs?'?'+qs:''}`, opts);
    const dur = Date.now() - t0;
    const ct  = res.headers.get('content-type') || '';

    histEntry.status = res.status;
    histEntry.dur    = dur;

    document.getElementById('t-empty').style.display  = 'none';
    document.getElementById('t-result').style.display = 'block';

    const hb = document.getElementById('t-hbadge');
    hb.textContent = res.status;
    hb.className   = `badge b${res.status<300?'GET':res.status<500?'PUT':'DELETE'}`;
    document.getElementById('t-cbadge').style.display = res.headers.get('x-cache')==='HIT' ? 'inline-flex' : 'none';

    if (!ct.includes('application/json')) {
      const blob = await res.blob();
      testBlob = { blob, name: res.headers.get('content-disposition')?.match(/filename="?([^";\n]+)"?/i)?.[1] || 'download' };
      document.getElementById('t-dlbtn').style.display = 'inline-flex';
      document.getElementById('t-body-out').textContent = `[File: ${testBlob.name} — ${(blob.size/1024).toFixed(1)} KB]`;
      document.getElementById('t-meta-out').textContent = '';
      histEntry.response = `[File: ${testBlob.name}]`;
    } else {
      const json = await res.json();
      document.getElementById('t-dlbtn').style.display = 'none';
      const mb = document.getElementById('t-mbadge'), kb = document.getElementById('t-kbadge');
      if (json._meta) {
        mb.textContent = json._meta.mode;
        mb.className   = `badge b${json._meta.mode==='proxy'?'proxy':'mock'}`;
        const aks = json._meta.apiKeyStatus;
        kb.innerHTML   = aks && aks!=='not_required' ? `<span class="badge bkey"><i class="material-icons" style="font-size:.68rem">vpn_key</i>${aks}</span>` : '';
        document.getElementById('t-dur').textContent  = `${json._meta.totalDurationMs}ms`;
        document.getElementById('t-body-out').textContent = JSON.stringify(json.data, null, 2);
        const metaOut = { mode:json._meta.mode, cacheHit:json._meta.cacheHit, endpoint:json._meta.endpointName, ctxExtras:json._meta.ctxExtras };
        document.getElementById('t-meta-out').textContent = JSON.stringify(metaOut, null, 2);
        histEntry.meta     = metaOut;
        histEntry.dur      = json._meta.totalDurationMs;
      } else {
        mb.textContent = '—'; mb.className = 'badge'; kb.innerHTML = '';
        document.getElementById('t-dur').textContent = `${dur}ms`;
        document.getElementById('t-body-out').textContent = JSON.stringify(json, null, 2);
        document.getElementById('t-meta-out').textContent = '—';
      }
      histEntry.response = JSON.stringify(json, null, 2);
    }

    // Add to history
    addToTestHistory(histEntry);
  } catch(e) {
    histEntry.status = 0;
    addToTestHistory(histEntry);
    toast('Error: ' + e.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="material-icons" style="font-size:14px">send</i>Send'; }
  }
}

/* ── Test History ────────────────────────────────────── */
function addToTestHistory(entry) {
  testHistory.unshift(entry);
  if (testHistory.length > 50) testHistory.pop();
  renderTestHistory();
}

function renderTestHistory() {
  const list  = document.getElementById('th-list');
  const empty = document.getElementById('th-empty');
  const count = document.getElementById('th-count');
  if (!list) return;
  if (!testHistory.length) {
    if (empty) empty.style.display = 'block';
    list.innerHTML = '';
    if (count) count.textContent = '0 requests';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (count) count.textContent = `${testHistory.length} request${testHistory.length!==1?'s':''}`;

  list.innerHTML = testHistory.map((e, i) => {
    const statusColor = !e.status ? 'var(--t3)' : e.status < 300 ? 'var(--ok)' : e.status < 500 ? 'var(--warn)' : 'var(--danger)';
    const methodColor = { GET:'var(--ok)', POST:'var(--blue)', PUT:'var(--warn)', PATCH:'var(--purple)', DELETE:'var(--danger)' }[e.method] || 'var(--t3)';
    const t = new Date(e.ts);
    const timeStr = `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}:${t.getSeconds().toString().padStart(2,'0')}`;
    return `<div class="th-entry ${testHistoryIdx===i?'active':''}" onclick="restoreTestEntry(${i})">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span class="th-method" style="background:${methodColor}20;color:${methodColor}">${e.method}</span>
        <span class="th-status" style="color:${statusColor}">${e.status||'—'}</span>
        <span class="th-time" style="margin-left:auto">${timeStr}</span>
      </div>
      <div class="th-path">/${e.path}</div>
      ${e.dur ? `<div class="th-time">${e.dur}ms</div>` : ''}
    </div>`;
  }).join('');
}

function restoreTestEntry(idx) {
  testHistoryIdx = idx;
  const e = testHistory[idx];
  if (!e) return;

  // Restore request fields
  document.getElementById('t-method').value = e.method;
  setVal('t-path', e.path);
  setVal('t-query', e.query);
  setVal('t-body', e.body||'');
  setVal('t-apikey', e.apiKey||'');
  // Restore headers
  const hdrsEl = document.getElementById('t-hdrs');
  if (hdrsEl) { hdrsEl.innerHTML=''; Object.entries(e.headers||{}).forEach(([k,v]) => addHdr('t-hdrs',k,v)); }

  // Restore response
  if (e.response) {
    document.getElementById('t-empty').style.display  = 'none';
    document.getElementById('t-result').style.display = 'block';
    const statusColor = e.status < 300 ? 'GET' : e.status < 500 ? 'PUT' : 'DELETE';
    const hb = document.getElementById('t-hbadge');
    hb.textContent = e.status; hb.className = `badge b${statusColor}`;
    document.getElementById('t-body-out').textContent = e.response;
    document.getElementById('t-meta-out').textContent = e.meta ? JSON.stringify(e.meta, null, 2) : '—';
    document.getElementById('t-dur').textContent = e.dur ? `${e.dur}ms` : '';
    document.getElementById('t-cbadge').style.display = 'none';
    document.getElementById('t-dlbtn').style.display  = 'none';
  }
  renderTestHistory(); // Update active highlight
}

function clearTestHistory() {
  if (testHistory.length && !confirm('Clear all test history?')) return;
  testHistory = []; testHistoryIdx = -1;
  renderTestHistory();
}

function clearTest() {
  ['t-query','t-body','t-apikey'].forEach(id => setVal(id,''));
  const hdrsEl = document.getElementById('t-hdrs');
  if (hdrsEl) hdrsEl.innerHTML = '';
  document.getElementById('t-file').value = '';
  testBlob = null;
  document.getElementById('t-result').style.display = 'none';
  document.getElementById('t-empty').style.display  = 'block';
  document.getElementById('t-method').value = 'GET';
}

function dlTestFile() {
  if (!testBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(testBlob.blob); a.download = testBlob.name; a.click();
  URL.revokeObjectURL(a.href);
}

function copyTestResponse() {
  const txt = document.getElementById('t-body-out')?.textContent;
  if (txt) navigator.clipboard.writeText(txt).then(() => toast('Response copied ✓'));
}

/* ═══════════════════════════════════════════════════════════
   CODE GENERATION
   ═══════════════════════════════════════════════════════════ */
let cgEp = null;   // current endpoint object for code gen
let cgLang = 'curl';

async function openCodeGen() {
  const path = getVal('t-path').trim();
  if (!path) { toast('Enter a virtual path first', true); return; }
  // Try to find from allEndpoints by path
  const ep = allEndpoints.find(e => e.virtualPath === path);
  if (ep) { return openCodeGenForEp(ep._id); }
  // Build synthetic ep from tester state
  cgEp = {
    name: path, virtualPath: path,
    method: document.getElementById('t-method').value,
    destinationUrl: null,
    destinationHeaders: colHdrs('t-hdrs'),
    queryParams: [],
    bodyParams: [],
    requireApiKey: !!getVal('t-apikey'),
    apiKey: getVal('t-apikey'),
    collection: '',
  };
  _openCodeGenModal();
}

async function openCodeGenForEp(id) {
  try { cgEp = await api(`/catalog/endpoints/${id}`); _openCodeGenModal(); }
  catch { toast('Error loading endpoint', true); }
}

function _openCodeGenModal() {
  setTxt('cg-ep-name', cgEp.name);
  document.getElementById('cg-ep-id').value = cgEp._id || '';
  document.getElementById('cg-baseurl').value = window.location.origin;
  document.getElementById('cg-use-vars').checked = false;
  // Reset lang tabs
  document.querySelectorAll('.lang-tab').forEach(t => t.classList.toggle('on', t.dataset.lang === cgLang));
  renderCodeGen();
  openMod('modal-codegen');
}

function switchLang(btn, lang) {
  document.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('on'));
  btn.classList.add('on');
  cgLang = lang;
  renderCodeGen();
}

function renderCodeGen() {
  const out = document.getElementById('cg-output');
  if (!out || !cgEp) return;
  const base    = document.getElementById('cg-baseurl')?.value || window.location.origin;
  const useVars = document.getElementById('cg-use-vars')?.checked;
  out.textContent = generateCode(cgLang, cgEp, base, useVars);
}

function copyCodeGen() {
  const t = document.getElementById('cg-output')?.textContent;
  if (t) navigator.clipboard.writeText(t).then(() => toast('Code copied ✓'));
}

function generateCode(lang, ep, base, useVars=false) {
  const url     = `${base}/api/${ep.virtualPath}`;
  const varUrl  = useVars ? '${BASE_URL}/api/' + ep.virtualPath : url;
  const method  = ep.method;
  const hdrs    = { 'Content-Type':'application/json', ...(ep.destinationHeaders||{}) };
  if (ep.requireApiKey) hdrs['x-api-key'] = ep.apiKey || (useVars ? '${API_KEY}' : '<your-api-key>');
  const body    = (['POST','PUT','PATCH'].includes(method) && (ep.bodyParams||[]).length)
    ? (() => { const b={}; (ep.bodyParams||[]).forEach(p=>{b[p.name]=p.example||p.defaultValue||`<${p.type}>`;}); return b; })()
    : null;
  const qp      = (ep.queryParams||[]).map(p=>`${p.name}=${p.example||'<val>'}`).join('&');

  switch (lang) {
    case 'curl':   return genCurl(ep, url, hdrs, body, qp);
    case 'fetch':  return genFetch(ep, varUrl, hdrs, body, qp, useVars);
    case 'axios':  return genAxios(ep, varUrl, hdrs, body, qp, useVars);
    case 'jquery': return genJQuery(ep, varUrl, hdrs, body, qp, useVars);
    case 'python': return genPython(ep, url, hdrs, body, qp, useVars);
    case 'k6':     return genK6(ep, varUrl, hdrs, body, qp, useVars);
    case 'php':    return genPhp(ep, url, hdrs, body, qp, useVars);
    default:       return '';
  }
}

/* generators ─────────────────────────────────────────── */

function genCurl(ep, url, hdrs, body, qp) {
  const lines = [`curl -X ${ep.method} '${url}${qp?'?'+qp:''}'`];
  for (const [k,v] of Object.entries(hdrs)) lines.push(`  -H '${k}: ${v}'`);
  if (body) lines.push(`  -d '${JSON.stringify(body)}'`);
  return lines.join(' \\\n');
}

function genFetch(ep, url, hdrs, body, qp, useVars) {
  const bodyStr = body ? JSON.stringify(body, null, 2) : null;
  const hdrsStr = JSON.stringify(hdrs, null, 2);
  return `${useVars ? "const BASE_URL = process.env.BASE_URL || '';\nconst API_KEY  = process.env.API_KEY  || '';\n\n" : ''}async function call${pascalCase(ep.name)}() {${body ? `
  const body = ${bodyStr};` : ''}

  const headers = ${hdrsStr};

  const response = await fetch(\`${url}${qp?'?'+qp:''}\`, {
    method: '${ep.method}',
    headers,${body ? '\n    body: JSON.stringify(body),' : ''}
  });

  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
  const data = await response.json();
  console.log(data);
  return data;
}

call${pascalCase(ep.name)}();`;
}

function genAxios(ep, url, hdrs, body, qp, useVars) {
  return `import axios from 'axios';
${useVars ? "\nconst BASE_URL = process.env.BASE_URL || '';\nconst API_KEY  = process.env.API_KEY  || '';\n" : ''}
async function call${pascalCase(ep.name)}() {${body ? `
  const body = ${JSON.stringify(body, null, 2)};` : ''}

  const { data } = await axios({
    method: '${ep.method.toLowerCase()}',
    url: \`${url}${qp?'?'+qp:''}\`,
    headers: ${JSON.stringify(hdrs, null, 2)},${body ? '\n    data: body,' : ''}
  });

  console.log(data);
  return data;
}

call${pascalCase(ep.name)}();`;
}

function genJQuery(ep, url, hdrs, body, qp, useVars) {
  return `// Requires jQuery
${useVars ? "const BASE_URL = '';\nconst API_KEY  = '';\n\n" : ''}$.ajax({
  url: '${url}${qp?'?'+qp:''}',
  method: '${ep.method}',
  contentType: 'application/json',
  headers: ${JSON.stringify(Object.fromEntries(Object.entries(hdrs).filter(([k])=>k!=='Content-Type')), null, 2)},${body ? `
  data: JSON.stringify(${JSON.stringify(body, null, 2)}),` : ''}
  success: function(data) {
    console.log(data);
  },
  error: function(xhr) {
    console.error('Error:', xhr.status, xhr.responseJSON);
  }
});`;
}

function genPython(ep, url, hdrs, body, qp, useVars) {
  return `import requests
${useVars ? "\nBASE_URL = os.getenv('BASE_URL', '')\nAPI_KEY  = os.getenv('API_KEY',  '')\n" : ''}
url     = '${url}${qp?'?'+qp:''}'
headers = ${JSON.stringify(hdrs, null, 4).replace(/"/g,"'")}
${body ? `payload = ${JSON.stringify(body, null, 4).replace(/"/g,"'")}\n` : ''}
response = requests.${ep.method.toLowerCase()}(
    url,
    headers=headers,${body ? '\n    json=payload,' : ''}
)

response.raise_for_status()
data = response.json()
print(data)`;
}

function genK6(ep, url, hdrs, body, qp, useVars) {
  const bodyStr = body ? 'JSON.stringify(body)' : 'null';
  return `import http from 'k6/http';
import { check, sleep } from 'k6';

${useVars ? "const BASE_URL = __ENV.BASE_URL || '';\nconst API_KEY  = __ENV.API_KEY  || '';\n\n" : ''}export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed:   ['rate<0.05'],
  },
};

export default function () {${body ? `
  const body = ${JSON.stringify(body, null, 2)};` : ''}

  const headers = ${JSON.stringify(hdrs, null, 2)};

  const res = http.${ep.method.toLowerCase()}(
    \`${url}${qp?'?'+qp:''}\`,
    ${bodyStr},
    { headers }
  );

  check(res, {
    'status 2xx':    (r) => r.status >= 200 && r.status < 300,
    'duration < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}`;
}

function genPhp(ep, url, hdrs, body, qp, useVars) {
  const hdrsArr = Object.entries(hdrs).map(([k,v]) => `    '${k}: ${v}'`).join(',\n');
  return `<?php
${useVars ? "\$baseUrl = getenv('BASE_URL') ?: '';\n\$apiKey  = getenv('API_KEY')  ?: '';\n\n" : ''}
\$url  = '${url}${qp?'?'+qp:''}';
\$data = ${body ? JSON.stringify(body) : 'null'};

\$ch = curl_init();
curl_setopt_array(\$ch, [
  CURLOPT_URL            => \$url,
  CURLOPT_CUSTOMREQUEST  => '${ep.method}',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER     => [
${hdrsArr}
  ],${body ? "\n  CURLOPT_POSTFIELDS => json_encode(\$data)," : ''}
]);

\$response = curl_exec(\$ch);
\$status   = curl_getinfo(\$ch, CURLINFO_HTTP_CODE);
curl_close(\$ch);

\$result = json_decode(\$response, true);
var_dump(\$result);`;
}

function pascalCase(s) {
  return s.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => c ? c.toUpperCase() : '').replace(/^./, c => c.toUpperCase());
}


/* ── PARAM / HEADER ROWS ──────────────────────────── */
function addPrm(cId,d={}){const div=document.createElement('div');div.className='prow';div.innerHTML=`<input type="text" placeholder="param name" value="${d.name||''}" data-f="name"/><select data-f="type">${['string','number','boolean','object','array'].map(t=>`<option ${d.type===t?'selected':''}>${t}</option>`).join('')}</select><label class="rchk-lbl"><input type="checkbox" ${d.required?'checked':''} data-f="required"/><span class="rb">✓</span><span class="rl">Req</span></label><button class="rmb" onclick="this.closest('.prow').remove()">✕</button>`;document.getElementById(cId).appendChild(div);}
function addHdr(cId,k='',v=''){const div=document.createElement('div');div.className='prow';div.style.gridTemplateColumns='1fr 1fr auto';div.innerHTML=`<input type="text" placeholder="Header" value="${k}" data-f="key"/><input type="text" placeholder="Value" value="${v}" data-f="val"/><button class="rmb" onclick="this.closest('.prow').remove()">✕</button>`;document.getElementById(cId).appendChild(div);}
function colPrms(cId){return[...document.getElementById(cId).querySelectorAll('.prow')].map(r=>({name:r.querySelector('[data-f="name"]')?.value.trim(),type:r.querySelector('[data-f="type"]')?.value,required:r.querySelector('[data-f="required"]')?.checked||false})).filter(p=>p.name);}
function colHdrs(cId){const r={};document.getElementById(cId).querySelectorAll('.prow').forEach(row=>{const k=row.querySelector('[data-f="key"]')?.value.trim(),v=row.querySelector('[data-f="val"]')?.value.trim();if(k)r[k]=v;});return r;}

/* ── UTILITIES ────────────────────────────────────── */
async function api(path,opts={}){const res=await fetch(`${API}${path}`,{headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||`HTTP ${res.status}`);return data;}
function openMod(id){const el=document.getElementById(id);(M.Modal.getInstance(el)||M.Modal.init(el,{dismissible:true})).open();}
function closeMod(id){const i=M.Modal.getInstance(document.getElementById(id));if(i)i.close();}
function resetItabs(mid){const m=document.getElementById(mid);if(!m)return;m.querySelectorAll('.itab').forEach((t,i)=>t.classList.toggle('on',i===0));m.querySelectorAll('.ip').forEach((p,i)=>p.style.display=i===0?'block':'none');}
function setTxt(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function getVal(id){return document.getElementById(id)?.value||'';}
function setVal(id,v){const el=document.getElementById(id);if(el)el.value=v;}
function setSelVal(id,v){const el=document.getElementById(id);if(!el)return;el.value=v;M.FormSelect.init(el);}
function renderErr(tId,cols,msg){document.getElementById(tId).innerHTML=`<tr><td colspan="${cols}"><div class="empty"><i class="material-icons" style="color:var(--danger)">error_outline</i><p style="color:var(--danger)">${msg}</p></div></td></tr>`;}
function toast(msg,isErr=false){M.toast({html:msg,classes:isErr?'terr':'',displayLength:3000});}

/* ═══════════════════════════════════════════════════════════
   SECRETS MODULE
   ═══════════════════════════════════════════════════════════ */

let secReady = false;
let allSecrets = [];   // public views (no values)

// ── Type config ───────────────────────────────────────────────
const SEC_TYPE = {
  api_key:      { label:'API Key',      icon:'vpn_key',   color:'var(--warn)' },
  token:        { label:'Token / JWT',  icon:'token',     color:'var(--blue)' },
  password:     { label:'Password',     icon:'password',  color:'var(--danger)' },
  oauth_secret: { label:'OAuth Secret', icon:'security',  color:'var(--purple)' },
  certificate:  { label:'Certificate',  icon:'verified',  color:'var(--ok)' },
  other:        { label:'Other',        icon:'key',       color:'var(--t3)' },
};

// ── Init (called when tab opens) ──────────────────────────────
function initSecrets() {
  if (!secReady) { secReady = true; }
  loadSecrets();
}

// ── Load & render grid ────────────────────────────────────────
async function loadSecrets() {
  try {
    allSecrets = await api('/catalog/secrets');
    renderSecGrid(allSecrets);
    renderSecKPIs(allSecrets);
  } catch (e) { console.error('Secrets:', e); }
}

function renderSecKPIs(list) {
  setTxt('sec-total', list.length);
  setTxt('sec-api',   list.filter(s => s.type === 'api_key').length);
  setTxt('sec-tok',   list.filter(s => s.type === 'token').length);
  setTxt('sec-uses',  list.reduce((a, s) => a + (s.usageCount || 0), 0));
  const withRefs = new Set(list.flatMap(s => s.referencedBy || [])).size;
  setTxt('sec-refs',  withRefs);
}

function renderSecGrid(list) {
  const g = document.getElementById('sec-grid');
  if (!list.length) {
    g.innerHTML = `<div class="empty" style="grid-column:1/-1;padding:50px 20px"><i class="material-icons">lock</i><p>No secrets yet — create your first one</p></div>`;
    return;
  }

  const maxUse = Math.max(...list.map(s => s.usageCount || 0), 1);

  g.innerHTML = list.map(s => {
    const tc  = SEC_TYPE[s.type] || SEC_TYPE.other;
    const pct = Math.round((s.usageCount || 0) / maxUse * 100);
    const lastUsed = s.lastUsedAt
      ? `<span class="sec-stat"><i class="material-icons" style="font-size:11px">schedule</i>${relTime(s.lastUsedAt)}</span>`
      : `<span class="sec-stat"><i class="material-icons" style="font-size:11px">schedule</i>Never used</span>`;
    const refs = (s.referencedBy || []).length
      ? `<span class="ref-chip"><i class="material-icons" style="font-size:9px">link</i>${s.referencedBy.length} endpoint${s.referencedBy.length>1?'s':''}</span>`
      : '';

    return `
    <div class="sec-card" id="sec-card-${s._id}">
      <div class="sec-hdr">
        <div class="sec-ico" style="background:${tc.color}18;border:1px solid ${tc.color}30">
          <i class="material-icons" style="font-size:17px;color:${tc.color}">${tc.icon}</i>
        </div>
        <div class="sec-meta">
          <div class="sec-name">{{${s.name}}}</div>
          <div class="sec-desc">${s.description || '<span style="color:var(--t3)">No description</span>'}</div>
        </div>
        <div style="display:flex;gap:3px;flex-shrink:0">
          <span class="stype-badge st-${s.type}">${tc.label}</span>
        </div>
      </div>
      <div class="sec-body">
        <span class="masked">••••••••••••••••</span>
        <div style="flex:1"></div>
        ${lastUsed}
        <span class="sec-stat"><i class="material-icons" style="font-size:11px">bar_chart</i>${s.usageCount || 0} uses</span>
        ${refs}
        <div class="usage-bar"><div class="usage-fill" style="width:${pct}%"></div></div>
        <div style="display:flex;gap:3px;margin-left:4px">
          <button class="btn-i" onclick='copySecRef("${s.name}")' title="Copy {{reference}}">
            <i class="material-icons" style="font-size:13px">content_copy</i>
          </button>
          <button class="btn-i" onclick='editSec("${s._id}")' title="Edit / Rotate">
            <i class="material-icons" style="font-size:13px">edit</i>
          </button>
          <button class="btn-i" style="color:var(--danger);border-color:rgba(255,87,87,.2)" onclick='delSec("${s._id}","${s.name}")' title="Delete">
            <i class="material-icons" style="font-size:13px">delete</i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── How-to toggle ─────────────────────────────────────────────
function toggleHowTo() {
  const b = document.getElementById('howto-body');
  const a = document.getElementById('howto-arrow');
  const open = b.style.display === 'none';
  b.style.display = open ? 'block' : 'none';
  a.textContent   = open ? '▲ collapse' : '▼ expand';
}

// ── Modal open/close ──────────────────────────────────────────
function openSecModal(sec = null) {
  resetSecForm();
  if (sec) fillSecForm(sec);
  M.updateTextFields();
  openMod('modal-sec');
}

function resetSecForm() {
  setVal('sec-id', '');
  setVal('sec-name', '');
  setVal('sec-val', '');
  setVal('sec-desc', '');
  document.getElementById('sec-modal-title').textContent = 'New Secret';
  document.getElementById('sec-edit-notice').style.display  = 'none';
  document.getElementById('sec-val-wrap').style.display     = 'block';
  document.getElementById('sec-meta-block').style.display   = 'none';
  document.getElementById('sec-strength').style.display     = 'none';
  updateSecUsageSnippets('');
  resetItabs('modal-sec');
  setTimeout(() => setSelVal('sec-type', 'api_key'), 40);
}

function fillSecForm(s) {
  document.getElementById('sec-modal-title').textContent = `Edit — ${s.name}`;
  setVal('sec-id',   s._id);
  setVal('sec-name', s.name);
  setVal('sec-desc', s.description || '');
  // Value deliberately not filled — user must rotate explicitly
  document.getElementById('sec-edit-notice').style.display = 'block';
  document.getElementById('sec-name').readOnly = true;  // name immutable after create
  document.getElementById('sec-name').style.opacity = '.5';

  // Audit block
  const mb = document.getElementById('sec-meta-block');
  mb.style.display = 'block';
  document.getElementById('sec-audit-info').innerHTML = `
    <span><i class="material-icons" style="font-size:12px;vertical-align:middle;margin-right:2px">bar_chart</i><strong>${s.usageCount}</strong> uses</span>
    <span><i class="material-icons" style="font-size:12px;vertical-align:middle;margin-right:2px">schedule</i>Last used: ${s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : 'never'}</span>
    <span><i class="material-icons" style="font-size:12px;vertical-align:middle;margin-right:2px">event</i>Created: ${new Date(s.createdAt).toLocaleString()}</span>
    ${(s.referencedBy||[]).length ? `<span><i class="material-icons" style="font-size:12px;vertical-align:middle;margin-right:2px">link</i>${s.referencedBy.length} endpoint(s) reference this</span>` : ''}
  `;

  updateSecUsageSnippets(s.name);
  setTimeout(() => setSelVal('sec-type', s.type || 'api_key'), 40);
}

async function editSec(id) {
  try { openSecModal(allSecrets.find(s => s._id === id)); }
  catch { toast('Error', true); }
}

// ── Save ──────────────────────────────────────────────────────
async function saveSec() {
  const id   = getVal('sec-id');
  const name = getVal('sec-name').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const val  = getVal('sec-val').trim();
  const desc = getVal('sec-desc').trim();
  const type = document.getElementById('sec-type').value;

  if (!name) { toast('Name is required', true); return; }
  if (!id && !val) { toast('Value is required for new secrets', true); return; }

  const body = { name, description: desc, type };
  if (val) body.value = val;

  try {
    await api(id ? `/catalog/secrets/${id}` : '/catalog/secrets', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    closeMod('modal-sec');
    toast(id ? `Secret rotated ✓` : `Secret "${name}" created ✓`);
    loadSecrets();
  } catch (e) {
    toast(e.message || 'Error saving secret', true);
  }
}

// ── Delete ────────────────────────────────────────────────────
async function delSec(id, name) {
  const s = allSecrets.find(x => x._id === id);
  const refs = (s?.referencedBy || []).length;
  const msg  = refs
    ? `Delete secret "${name}"?\n\n⚠ It is referenced by ${refs} endpoint(s). Those endpoints will fail until the secret is recreated or the references are removed.`
    : `Delete secret "${name}"?`;
  if (!confirm(msg)) return;
  try {
    await fetch(`/catalog/secrets/${id}`, { method: 'DELETE' });
    toast(`"${name}" deleted`);
    loadSecrets();
  } catch { toast('Error deleting', true); }
}

// ── Copy {{reference}} to clipboard ──────────────────────────
function copySecRef(name) {
  navigator.clipboard.writeText(`{{${name}}}`).then(() => toast(`{{${name}}} copied ✓`));
}

// ── Usage snippets (live-update when editing) ─────────────────
function updateSecUsageSnippets(name) {
  const n = name || 'YOUR_SECRET_NAME';
  const s1 = document.getElementById('sec-usage-snippet1');
  const s2 = document.getElementById('sec-usage-snippet2');
  if (!s1 || !s2) return;

  s1.innerHTML = `<span class="cm">// In endpoint Destination Headers:</span>
Authorization: Bearer <span class="sc">{{${n}}}</span>
x-api-key:     <span class="sc">{{${n}}}</span>

<span class="cm">// In endpoint Destination URL:</span>
https://api.service.com/v1?token=<span class="sc">{{${n}}}</span>

<span class="cm">// Relay resolves {{${n}}} at proxy time — never stored in logs.</span>`;

  s2.innerHTML = `<span class="cm">// PRE-script event — inject dynamically:</span>
<span class="kw">const</span> value = ctx.secrets.<span class="sc">${n}</span>;
ctx.request.headers[<span class="str">'Authorization'</span>] = <span class="str">\`Bearer \${value}\`</span>;

<span class="cm">// Conditional by environment:</span>
<span class="kw">const</span> isProd = ctx.request.body.env === <span class="str">'production'</span>;
ctx.request.headers[<span class="str">'x-api-key'</span>] = isProd
  ? ctx.secrets.<span class="sc">PROD_${n}</span>
  : ctx.secrets.<span class="sc">STAGING_${n}</span>;`;
}

// ── Live name normalizer ──────────────────────────────────────
function normalizeSecName(el) {
  const pos = el.selectionStart;
  el.value  = el.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  el.setSelectionRange(pos, pos);
  updateSecUsageSnippets(el.value);
  // Strength when typing in value field
  measureStrength(getVal('sec-val'));
}

// ── Password strength indicator ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const vf = document.getElementById('sec-val');
  if (vf) {
    vf.addEventListener('input', () => {
      document.getElementById('sec-strength').style.display = vf.value ? 'block' : 'none';
      measureStrength(vf.value);
    });
  }
});

function measureStrength(v) {
  if (!v) return;
  let score = 0;
  if (v.length >= 16) score++;
  if (v.length >= 32) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/[0-9]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;
  const w   = [0, 20, 40, 65, 85, 100][score];
  const col = score <= 1 ? 'var(--danger)' : score <= 3 ? 'var(--warn)' : 'var(--ok)';
  const lbl = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][score];
  const bar = document.getElementById('sec-strength-bar');
  const lel = document.getElementById('sec-strength-lbl');
  if (bar) { bar.style.width = w + '%'; bar.style.background = col; }
  if (lel) { lel.textContent = lbl; lel.style.color = col; }
}

// ── Show/hide value ───────────────────────────────────────────
function toggleSecValVis() {
  const inp = document.getElementById('sec-val');
  const ico = document.getElementById('sec-eye-ico');
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type    = show ? 'text' : 'password';
  ico.textContent = show ? 'visibility_off' : 'visibility';
}

// ── Relative time helper ──────────────────────────────────────
function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

// ── Validate refs when saving endpoint (UI hint) ──────────────
async function validateEndpointSecretRefs(destUrl, headers) {
  const strings = [destUrl, ...Object.values(headers)].filter(Boolean);
  try {
    const r = await api('/catalog/secrets/validate-refs', {
      method: 'POST',
      body: JSON.stringify({ strings }),
    });
    return r.missing || [];
  } catch { return []; }
}

/* ── Secret ref quick-insert (endpoint modal) ──────────────── */
async function insertSecretRef(headersContainerId) {
  if (!allSecrets.length) {
    toast('No secrets yet — create one in the Secrets tab first', true);
    return;
  }

  // Build a tiny selector modal inline
  const names = allSecrets.map(s => `
    <div onclick="doInsertRef('${headersContainerId}','${s.name}',this.closest('#sec-picker'))"
      style="padding:8px 13px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:9px;transition:background .1s"
      onmouseover="this.style.background='var(--surf)'" onmouseout="this.style.background=''">
      <i class="material-icons" style="font-size:14px;color:var(--warn)">${(SEC_TYPE[s.type]||SEC_TYPE.other).icon}</i>
      <div style="flex:1">
        <div style="font-family:var(--mono);font-size:.75rem;color:var(--a)">{{${s.name}}}</div>
        <div style="font-size:.62rem;color:var(--t3)">${s.description || s.type}</div>
      </div>
      <span style="font-size:.58rem;color:var(--t3);font-family:var(--mono)">${s.usageCount} uses</span>
    </div>`).join('');

  // Inject picker overlay
  let picker = document.getElementById('sec-picker');
  if (picker) picker.remove();
  picker = document.createElement('div');
  picker.id = 'sec-picker';
  picker.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:var(--card);border:1px solid var(--border);border-radius:var(--r);box-shadow:0 20px 60px rgba(0,0,0,.7);width:380px;max-height:380px;overflow:hidden;display:flex;flex-direction:column`;
  picker.innerHTML = `
    <div style="padding:11px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:.75rem;font-weight:700;color:var(--t1)"><i class="material-icons" style="font-size:13px;vertical-align:middle;margin-right:4px">lock</i>Insert secret reference</span>
      <button onclick="this.closest('#sec-picker').remove()" style="background:none;border:none;cursor:pointer;color:var(--t3)"><i class="material-icons" style="font-size:16px">close</i></button>
    </div>
    <div style="overflow-y:auto;flex:1">${names}</div>
    <div style="padding:7px 11px;border-top:1px solid var(--border);font-size:.6rem;color:var(--t3)">
      This inserts <code style="color:var(--warn);font-family:var(--mono)">{{NAME}}</code> as the header value. Relay resolves it at proxy time.
    </div>`;

  document.body.appendChild(picker);

  // Show hint
  const hint = document.getElementById('ep-sec-hint');
  if (hint) hint.style.display = 'block';

  // Click-outside to close
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close); }
    });
  }, 100);
}

function doInsertRef(containerId, secretName, picker) {
  // Add a header row with the ref pre-filled as value
  addHdr(containerId, 'Authorization', `Bearer {{${secretName}}}`);
  if (picker) picker.remove();
  toast(`{{${secretName}}} inserted ✓`);
}

/* ═══════════════════════════════════════════════════════════
   SECURITY MODULE — UI
   ═══════════════════════════════════════════════════════════ */

// ── Panel toggles ─────────────────────────────────────────────
function toggleEpSecPanel() {
  const on  = document.getElementById('ep-sec-on')?.checked;
  const panel = document.getElementById('sec-panel');
  if (panel) panel.style.display = on ? 'block' : 'none';
}

function switchEpSecTab(btn, panelId) {
  // Hide all sp sub-panels inside sec-panel
  document.querySelectorAll('#sec-panel .sp').forEach(p => p.style.display = 'none');
  document.querySelectorAll('#sec-panel .lang-tab').forEach(t => t.classList.remove('on'));
  document.getElementById(panelId).style.display = 'block';
  btn.classList.add('on');
}

// ── Fill security form ─────────────────────────────────────────
function fillEpSecForm(sec) {
  if (!sec) return;
  const setChk = (id, v) => { const el=document.getElementById(id); if(el) el.checked = !!v; };
  const setV   = (id, v) => { const el=document.getElementById(id); if(el) el.value  = v ?? ''; };

  setChk('ep-sec-on', sec.enabled);
  document.getElementById('sec-panel').style.display = sec.enabled ? 'block' : 'none';

  // Rate limit
  const rl = sec.rateLimit || {};
  setChk('ep-rl-on',    rl.enabled);
  setV('ep-rl-reqs',    rl.requests  || 60);
  setV('ep-rl-win',     rl.windowSecs || 60);
  setV('ep-rl-block',   rl.blockDurationSecs || 0);
  setV('ep-rl-strat',   rl.strategy  || 'ip');

  // IP control
  setV('ep-ip-allow',   (sec.ipAllowlist || []).join('\n'));
  setV('ep-ip-block',   (sec.ipBlocklist || []).join('\n'));

  // Fingerprint
  setChk('ep-fp-on',   sec.fingerprintEnabled);
  setV('ep-fp-blocklist', (sec.fingerprintBlocklist || []).join('\n'));

  // Threat detection
  setChk('ep-td-on',   sec.threatDetectionEnabled);
  setV('ep-sec-bodymax', sec.maxBodySizeKb || 0);

  // HMAC
  setChk('ep-hmac-on',   sec.hmacEnabled);
  setV('ep-hmac-header', sec.hmacHeader   || 'X-Signature');
  setV('ep-hmac-secret', sec.hmacSecret   || '');
  setV('ep-hmac-algo',   sec.hmacAlgorithm || 'sha256');

  // CORS
  setChk('ep-cors-on',   sec.corsEnabled);
  setV('ep-cors-origins', (sec.corsOrigins || ['*']).join('\n'));
}

// ── Collect security form ──────────────────────────────────────
function collectSecForm() {
  const chk = (id) => !!document.getElementById(id)?.checked;
  const val = (id) => document.getElementById(id)?.value || '';

  return {
    enabled:  chk('ep-sec-on'),
    rateLimit: {
      enabled:          chk('ep-rl-on'),
      requests:         parseInt(val('ep-rl-reqs'))  || 60,
      windowSecs:       parseInt(val('ep-rl-win'))   || 60,
      blockDurationSecs: parseInt(val('ep-rl-block')) || 0,
      strategy:         val('ep-rl-strat') || 'ip',
    },
    ipAllowlist:  val('ep-ip-allow').split('\n').map(s=>s.trim()).filter(Boolean),
    ipBlocklist:  val('ep-ip-block').split('\n').map(s=>s.trim()).filter(Boolean),
    fingerprintEnabled:  chk('ep-fp-on'),
    fingerprintBlocklist: val('ep-fp-blocklist').split('\n').map(s=>s.trim()).filter(Boolean),
    threatDetectionEnabled: chk('ep-td-on'),
    maxBodySizeKb: parseInt(val('ep-sec-bodymax')) || 0,
    hmacEnabled:    chk('ep-hmac-on'),
    hmacSecret:     val('ep-hmac-secret'),
    hmacHeader:     val('ep-hmac-header') || 'X-Signature',
    hmacAlgorithm:  val('ep-hmac-algo')   || 'sha256',
    corsEnabled:    chk('ep-cors-on'),
    corsOrigins:    val('ep-cors-origins').split('\n').map(s=>s.trim()).filter(Boolean),
  };
}

// ── Reset security form ───────────────────────────────────────
function resetEpSecForm() {
  document.getElementById('ep-sec-on').checked    = false;
  document.getElementById('sec-panel').style.display = 'none';
  document.getElementById('ep-rl-on').checked     = false;
  document.getElementById('ep-rl-reqs').value     = '60';
  document.getElementById('ep-rl-win').value      = '60';
  document.getElementById('ep-rl-block').value    = '0';
  document.getElementById('ep-rl-strat').value    = 'ip';
  document.getElementById('ep-ip-allow').value    = '';
  document.getElementById('ep-ip-block').value    = '';
  document.getElementById('ep-fp-on').checked     = false;
  document.getElementById('ep-fp-blocklist').value = '';
  document.getElementById('ep-td-on').checked     = false;
  document.getElementById('ep-sec-bodymax').value = '0';
  document.getElementById('ep-hmac-on').checked   = false;
  document.getElementById('ep-hmac-secret').value = '';
  document.getElementById('ep-hmac-header').value = 'X-Signature';
  document.getElementById('ep-hmac-algo').value   = 'sha256';
  document.getElementById('ep-cors-on').checked   = false;
  document.getElementById('ep-cors-origins').value = '*';
  document.getElementById('ep-sec-events').innerHTML = '<div style="font-size:.68rem;color:var(--t3);padding:10px">Click refresh to load events.</div>';
  document.getElementById('hmac-snippet').style.display = 'none';
  // Reset to first sub-tab
  document.querySelectorAll('#sec-panel .sp').forEach((p,i) => p.style.display = i===0?'block':'none');
  document.querySelectorAll('#sec-panel .lang-tab').forEach((t,i) => t.classList.toggle('on', i===0));
}

// ── HMAC helpers ──────────────────────────────────────────────
function toggleHmacVis() {
  const inp = document.getElementById('ep-hmac-secret');
  const ico = document.getElementById('hmac-eye-ico');
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  ico.textContent = show ? 'visibility_off' : 'visibility';
}

function genHmacSecret() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr, b => b.toString(16).padStart(2,'0')).join('');
  document.getElementById('ep-hmac-secret').value = hex;
  document.getElementById('ep-hmac-secret').type  = 'text';
  document.getElementById('hmac-eye-ico').textContent = 'visibility_off';
  toast('Secret generated ✓');
}

function copyHmacSnippet() {
  const secret = document.getElementById('ep-hmac-secret')?.value;
  const header = document.getElementById('ep-hmac-header')?.value || 'X-Signature';
  const algo   = document.getElementById('ep-hmac-algo')?.value   || 'sha256';
  const path   = getVal('ep-path') || 'your/path';
  const method = document.getElementById('ep-method')?.value || 'POST';
  if (!secret) { toast('Enter a secret first', true); return; }

  const snippet = `// HMAC-${algo.toUpperCase()} request signing
const crypto  = require('crypto');
const SECRET  = '${secret}';
const METHOD  = '${method}';
const PATH    = '/${path}';
const query   = {};  // your sorted query params
const body    = {};  // your request body

const payload = [
  METHOD,
  PATH,
  JSON.stringify(Object.keys(query).sort().reduce((a,k)=>(a[k]=query[k],a),{})),
  JSON.stringify(Object.keys(body).sort().reduce((a,k)=>(a[k]=body[k],a),{})),
].join('\\n');

const signature = crypto
  .createHmac('${algo}', SECRET)
  .update(payload)
  .digest('hex');

// Add to your request:
headers['${header}'] = signature;`;

  const el = document.getElementById('hmac-snippet');
  const out = document.getElementById('hmac-snippet-out');
  el.style.display = 'block';
  out.textContent  = snippet;
  navigator.clipboard.writeText(snippet).then(() => toast('Signing snippet copied ✓'));
}

// ── Security events for endpoint ──────────────────────────────
async function loadSecEvents() {
  const id = getVal('ep-id');
  if (!id) { toast('Save endpoint first', true); return; }
  const container = document.getElementById('ep-sec-events');
  container.innerHTML = '<div style="font-size:.68rem;color:var(--t3);padding:10px">Loading…</div>';
  try {
    const events = await api(`/catalog/security/events/endpoint/${id}?limit=30`);
    if (!events.length) {
      container.innerHTML = '<div style="font-size:.68rem;color:var(--t3);padding:10px">No security events yet.</div>';
      return;
    }
    container.innerHTML = events.map(e => {
      const typeKey = e.type.replace(/_/g, '_');
      const t = new Date(e.createdAt);
      const timeStr = `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}:${t.getSeconds().toString().padStart(2,'0')}`;
      return `<div class="sec-evt-row">
        <span class="sec-evt-type set-${e.type}">${e.type.replace(/_/g,' ')}</span>
        <span style="font-family:var(--mono);color:var(--t2)">${e.clientIp}</span>
        ${e.fingerprint ? `<span style="font-family:var(--mono);font-size:.58rem;color:var(--purple)" title="Fingerprint">${e.fingerprint}</span>` : ''}
        ${e.detail ? `<span style="color:var(--t3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.detail}</span>` : ''}
        <span style="color:var(--t3);flex-shrink:0">${timeStr}</span>
      </div>`;
    }).join('');
  } catch(e) {
    container.innerHTML = `<div style="font-size:.68rem;color:var(--danger);padding:10px">${e.message}</div>`;
  }
}

/* ── Security Events Page ──────────────────────────────── */
let _allSecEvents = [];

async function loadGlobalSecEvents() {
  const container = document.getElementById('gsec-events');
  const byTypeEl  = document.getElementById('gsec-bytype');
  if (!container) return;
  container.innerHTML = '<div style="padding:30px;text-align:center;font-size:.7rem;color:var(--t3)">Loading…</div>';
  try {
    const [events, stats] = await Promise.all([
      api('/catalog/security/events?limit=100'),
      api('/catalog/security/stats'),
    ]);
    _allSecEvents = events;

    // KPIs
    setTxt('gsec-total',   stats.total24h      || 0);
    setTxt('gsec-rl',      stats.byType?.rate_limit_exceeded || 0);
    setTxt('gsec-threat',  stats.byType?.threat_detected     || 0);
    setTxt('gsec-blocked', stats.blockedIps     || 0);
    setTxt('gsec-ip',      (stats.byType?.ip_blocked||0) + (stats.byType?.ip_not_allowed||0));

    // Top IPs bar chart
    const topIpsEl = document.getElementById('gsec-top-ips');
    if (topIpsEl && stats.topIps?.length) {
      const maxC = Math.max(...stats.topIps.map(x => x.count), 1);
      topIpsEl.innerHTML = stats.topIps.map(x => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bsoft)">
          <span style="font-family:var(--mono);font-size:.67rem;color:var(--t1);min-width:110px;overflow:hidden;text-overflow:ellipsis">${x.ip}</span>
          <div style="flex:1;background:var(--border);border-radius:2px;height:5px">
            <div style="width:${Math.round(x.count/maxC*100)}%;height:5px;background:var(--danger);border-radius:2px"></div>
          </div>
          <span style="font-size:.65rem;color:var(--danger);font-family:var(--mono);min-width:24px;text-align:right">${x.count}</span>
        </div>`).join('');
    } else if (topIpsEl) {
      topIpsEl.innerHTML = '<div style="font-size:.68rem;color:var(--t3)">No data yet</div>';
    }

    // Type breakdown
    if (byTypeEl && stats.byType) {
      const typeColors = {
        rate_limit_exceeded:'var(--warn)', ip_blocked:'var(--danger)', ip_not_allowed:'var(--danger)',
        threat_detected:'var(--danger)', fingerprint_blocked:'var(--purple)', hmac_invalid:'var(--blue)',
        body_too_large:'var(--warn)', cors_rejected:'var(--blue)', suspicious_pattern:'var(--danger)',
      };
      const total = Object.values(stats.byType).reduce((a, v) => a + v, 0) || 1;
      byTypeEl.innerHTML = Object.entries(stats.byType).map(([k, v]) => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <span style="font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;color:${typeColors[k]||'var(--t3)'};min-width:120px">${k.replace(/_/g,' ')}</span>
          <div style="flex:1;background:var(--border);border-radius:2px;height:4px">
            <div style="width:${Math.round(v/total*100)}%;height:4px;background:${typeColors[k]||'var(--t3)'};border-radius:2px"></div>
          </div>
          <span style="font-size:.65rem;font-family:var(--mono);color:var(--t2)">${v}</span>
        </div>`).join('');
    }

    renderSecEventsList(events);
  } catch(e) {
    container.innerHTML = `<div class="empty" style="padding:40px"><i class="material-icons" style="color:var(--danger)">error</i><p style="color:var(--danger)">${e.message}</p></div>`;
  }
}

function renderSecEventsList(events) {
  const container = document.getElementById('gsec-events');
  if (!container) return;
  if (!events.length) {
    container.innerHTML = '<div class="empty" style="padding:40px"><i class="material-icons">security</i><p>No security events yet</p></div>';
    return;
  }
  container.innerHTML = events.map(e => {
    const t = new Date(e.createdAt);
    const timeStr = t.toLocaleTimeString('en-US', { hour12:false });
    const dateStr = t.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    return `<div class="sec-evt-row" style="padding:8px 0">
      <span class="sec-evt-type set-${e.type}" style="min-width:130px">${e.type.replace(/_/g,' ')}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <span style="font-family:var(--mono);font-size:.7rem;color:var(--t1)">${e.clientIp}</span>
          ${e.endpointName ? `<span style="font-size:.65rem;color:var(--t3)">on ${e.endpointName}</span>` : ''}
          ${e.fingerprint ? `<span style="font-family:var(--mono);font-size:.6rem;color:var(--purple);background:var(--pdim);padding:1px 5px;border-radius:3px">${e.fingerprint}</span>` : ''}
        </div>
        ${e.detail ? `<div style="font-size:.62rem;color:var(--t3);margin-top:2px;font-family:var(--mono)">${e.detail}</div>` : ''}
        ${e.userAgent ? `<div style="font-size:.59rem;color:var(--t3);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:400px">${e.userAgent.substring(0,90)}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:.62rem;color:var(--t3)">${dateStr}</div>
        <div style="font-size:.65rem;color:var(--t3);font-family:var(--mono)">${timeStr}</div>
        ${e.blocked ? '<div style="font-size:.58rem;color:var(--danger);font-weight:700">BLOCKED</div>' : ''}
      </div>
    </div>`;
  }).join('');
}

function filterSecEvents() {
  const type = document.getElementById('gsec-type-filter')?.value || '';
  const filtered = type ? _allSecEvents.filter(e => e.type === type) : _allSecEvents;
  renderSecEventsList(filtered);
}

/* ── Rate Limit Manager ───────────────────────────────── */
function populateSecRLDropdown() {
  const sel = document.getElementById('gsec-rl-ep-sel');
  if (!sel || !allEndpoints.length) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Select endpoint…</option>' +
    allEndpoints.map(ep => `<option value="${ep._id}" ${ep._id===cur?'selected':''}>${ep.method} /${ep.virtualPath}</option>`).join('');
}

async function loadRLCounters() {
  const epId = document.getElementById('gsec-rl-ep-sel')?.value;
  const container = document.getElementById('gsec-rl-counters');
  if (!container) return;
  if (!epId) { container.innerHTML = '<div style="font-size:.65rem;color:var(--t3)">No endpoint selected</div>'; return; }
  try {
    const counters = await api(`/catalog/security/rate-limits/${epId}`);
    if (!counters.length) {
      container.innerHTML = '<div style="font-size:.65rem;color:var(--t3)">No active counters</div>'; return;
    }
    container.innerHTML = counters.map(c => {
      const blocked = c.blockedUntil && new Date(c.blockedUntil) > new Date();
      const until   = blocked ? new Date(c.blockedUntil).toLocaleTimeString() : '';
      return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--bsoft);font-size:.65rem">
        <span style="font-family:var(--mono);font-size:.62rem;flex:1;color:var(--t2);overflow:hidden;text-overflow:ellipsis">${c.identifier}</span>
        <span style="color:${blocked?'var(--danger)':'var(--t3)'};">${c.count} req</span>
        ${blocked ? `<span style="color:var(--danger);font-size:.58rem">locked until ${until}</span>` : ''}
        <button class="btn-i" onclick="unblockIdentifier('${epId}','${c.identifier.replace(/'/g,"\\'")}',this)" title="Unblock">
          <i class="material-icons" style="font-size:11px">lock_open</i>
        </button>
      </div>`;
    }).join('');
  } catch(e) { container.innerHTML = `<div style="font-size:.65rem;color:var(--danger)">${e.message}</div>`; }
}

async function unblockIdentifier(epId, identifier, btn) {
  btn.disabled = true;
  try {
    await api('/catalog/security/unblock', { method:'POST', body: JSON.stringify({ endpointId: epId, identifier }) });
    toast('Unblocked \u2713');
    loadRLCounters();
  } catch(e) { toast(e.message, true); btn.disabled = false; }
}

async function clearRLForEp() {
  const epId = document.getElementById('gsec-rl-ep-sel')?.value;
  if (!epId) { toast('Select an endpoint first', true); return; }
  if (!confirm('Clear all rate-limit counters for this endpoint?')) return;
  try {
    await api(`/catalog/security/rate-limits/${epId}`, { method:'DELETE' });
    toast('Counters cleared \u2713');
    document.getElementById('gsec-rl-counters').innerHTML = '<div style="font-size:.65rem;color:var(--t3)">No active counters</div>';
  } catch(e) { toast(e.message, true); }
}

/* ── Security events in endpoint modal ──────────────────── */
async function loadSecEvents() {
  const id = getVal('ep-id');
  if (!id) { toast('Save endpoint first', true); return; }
  const container = document.getElementById('ep-sec-events');
  container.innerHTML = '<div style="font-size:.68rem;color:var(--t3);padding:10px">Loading\u2026</div>';
  try {
    const events = await api(`/catalog/security/events/endpoint/${id}?limit=30`);
    if (!events.length) {
      container.innerHTML = '<div style="font-size:.68rem;color:var(--t3);padding:10px">No security events yet.</div>';
      return;
    }
    container.innerHTML = events.map(e => {
      const t = new Date(e.createdAt);
      const timeStr = `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}:${t.getSeconds().toString().padStart(2,'0')}`;
      return `<div class="sec-evt-row">
        <span class="sec-evt-type set-${e.type}">${e.type.replace(/_/g,' ')}</span>
        <span style="font-family:var(--mono);color:var(--t2)">${e.clientIp}</span>
        ${e.fingerprint ? `<span style="font-family:var(--mono);font-size:.6rem;color:var(--purple)">${e.fingerprint}</span>` : ''}
        ${e.detail ? `<span style="color:var(--t3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.detail}</span>` : ''}
        <span style="color:var(--t3);flex-shrink:0">${timeStr}</span>
      </div>`;
    }).join('');
  } catch(e) {
    container.innerHTML = `<div style="font-size:.68rem;color:var(--danger);padding:10px">${e.message}</div>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   ENVIRONMENTS MODULE
   ═══════════════════════════════════════════════════════════ */

let allEnvs = [];
let activeEnvId = null;

async function initEnvironments() {
  await loadEnvs();
}

async function loadEnvs() {
  try {
    allEnvs = await api('/catalog/environments');
    renderEnvGrid();
    syncNavEnvSelector();
    activeEnvId = allEnvs.find(e => e.isActive)?._id || null;
  } catch(e) { console.error('loadEnvs:', e); }
}

function renderEnvGrid() {
  const grid = document.getElementById('env-grid');
  if (!grid) return;
  if (!allEnvs.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;padding:60px">
      <i class="material-icons">layers</i><p>No environments yet — create one to start</p></div>`;
    return;
  }
  grid.innerHTML = allEnvs.map(env => {
    const varCount = (env.variables || []).length;
    const isActive = env.isActive;
    return `<div class="env-card${isActive ? ' active-env' : ''}" onclick="openEnvModal('${env._id}')">
      <div class="env-card-bar" style="background:${env.color || '#6c63ff'}"></div>
      <div class="env-card-body">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-weight:700;font-size:.83rem;color:var(--t1)">${env.name}</span>
          ${isActive
            ? `<span style="font-size:.59rem;font-weight:700;color:var(--ok);background:var(--gdim);padding:2px 7px;border-radius:3px;letter-spacing:.05em">ACTIVE</span>`
            : `<span style="font-size:.59rem;color:var(--t3)">${varCount} var${varCount !== 1 ? 's' : ''}</span>`}
        </div>
        ${env.description ? `<div style="font-size:.65rem;color:var(--t3);margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${env.description}</div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;min-height:22px">
          ${(env.variables || []).slice(0, 4).map(v =>
            `<span class="var-ref-badge" title="${v.value || '(empty)'}" onclick="event.stopPropagation();copyEnvRef('${v.key}')">[[ ${v.key} ]]</span>`
          ).join('')}
          ${varCount > 4 ? `<span style="font-size:.6rem;color:var(--t3)">+${varCount - 4} more</span>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          ${isActive
            ? `<button class="btn-w btn-sm" onclick="event.stopPropagation();deactivateEnv()" style="flex:1">
                <i class="material-icons" style="font-size:11px">radio_button_unchecked</i>Deactivate</button>`
            : `<button class="btn-g btn-sm" onclick="event.stopPropagation();activateEnv('${env._id}')" style="flex:1">
                <i class="material-icons" style="font-size:11px">radio_button_checked</i>Activate</button>`}
          <button class="btn-i" onclick="event.stopPropagation();deleteEnv('${env._id}','${env.name}')" title="Delete">
            <i class="material-icons" style="font-size:13px">delete</i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function syncNavEnvSelector() {
  const sel = document.getElementById('nav-env-sel');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">No environment</option>' +
    allEnvs.map(e => `<option value="${e._id}" ${e.isActive ? 'selected' : ''}>${e.name}</option>`).join('');
  // Color the selector if active env exists
  const active = allEnvs.find(e => e.isActive);
  sel.style.borderColor = active ? (active.color || '#6c63ff') : 'var(--border)';
  sel.style.color       = active ? 'var(--t1)' : 'var(--t3)';
}

async function switchActiveEnv(envId) {
  try {
    if (!envId) {
      await api('/catalog/environments/deactivate-all', { method: 'POST' });
      toast('Environment deactivated');
    } else {
      await api(`/catalog/environments/${envId}/activate`, { method: 'POST' });
      const env = allEnvs.find(e => e._id === envId);
      toast(`Environment "${env?.name}" activated ✓`);
    }
    await loadEnvs();
  } catch(e) { toast(e.message, true); }
}

async function activateEnv(id) {
  try {
    await api(`/catalog/environments/${id}/activate`, { method: 'POST' });
    const env = allEnvs.find(e => e._id === id);
    toast(`"${env?.name}" is now active ✓`);
    await loadEnvs();
  } catch(e) { toast(e.message, true); }
}

async function deactivateEnv() {
  try {
    await api('/catalog/environments/deactivate-all', { method: 'POST' });
    toast('Environment deactivated');
    await loadEnvs();
  } catch(e) { toast(e.message, true); }
}

async function deleteEnv(id, name) {
  if (!confirm(`Delete environment "${name}"?`)) return;
  try {
    await api(`/catalog/environments/${id}`, { method: 'DELETE' });
    toast(`"${name}" deleted`);
    await loadEnvs();
  } catch(e) { toast(e.message, true); }
}

// ── Env Modal ─────────────────────────────────────────────────
function openEnvModal(id = null) {
  resetEnvModal();
  document.getElementById('env-modal-title').textContent = id ? 'Edit Environment' : 'New Environment';
  document.getElementById('env-id').value = id || '';
  if (id) {
    const env = allEnvs.find(e => e._id === id);
    if (env) {
      setVal('env-name', env.name);
      setVal('env-desc', env.description || '');
      document.getElementById('env-color').value = env.color || '#6c63ff';
      (env.variables || []).forEach(v => addEnvVarRow(v.key, v.value, v.description));
    }
  }
  openMod('modal-env');
}

function resetEnvModal() {
  setVal('env-id', ''); setVal('env-name', ''); setVal('env-desc', '');
  document.getElementById('env-color').value = '#6c63ff';
  document.getElementById('env-vars-container').innerHTML = '';
  // Add one empty row to start
  addEnvVarRow('', '', '');
}

function addEnvVarRow(key = '', value = '', desc = '') {
  const container = document.getElementById('env-vars-container');
  const row = document.createElement('div');
  row.className = 'env-var-row';
  row.innerHTML = `
    <input type="text" placeholder="VARIABLE_NAME" value="${key}"
      style="text-transform:uppercase;font-family:var(--mono);font-size:.7rem"
      oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9_]/g,'')"/>
    <input type="text" placeholder="value" value="${value}"
      style="font-family:var(--mono);font-size:.7rem"/>
    <button class="btn-i" onclick="this.closest('.env-var-row').remove()" title="Remove">
      <i class="material-icons" style="font-size:13px">close</i></button>`;
  container.appendChild(row);
}

function addEnvVar() { addEnvVarRow(); }

function collectEnvVars() {
  const rows = document.querySelectorAll('#env-vars-container .env-var-row');
  const vars = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const key   = inputs[0]?.value?.trim();
    const value = inputs[1]?.value ?? '';
    if (key) vars.push({ key, value });
  });
  return vars;
}

async function saveEnv() {
  const id   = getVal('env-id');
  const name = getVal('env-name').trim();
  if (!name) { toast('Environment name required', true); return; }
  const body = {
    name,
    description: getVal('env-desc').trim(),
    color:       document.getElementById('env-color').value,
    variables:   collectEnvVars(),
  };
  try {
    if (id) {
      await api(`/catalog/environments/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Environment updated ✓');
    } else {
      await api('/catalog/environments', { method: 'POST', body: JSON.stringify(body) });
      toast('Environment created ✓');
    }
    closeMod('modal-env');
    await loadEnvs();
  } catch(e) { toast(e.message, true); }
}

function copyEnvRef(key) {
  navigator.clipboard.writeText(`[[${key}]]`).then(() => toast(`[[${key}]] copied ✓`));
}

/* ═══════════════════════════════════════════════════════════
   OPENAPI IMPORT MODULE
   ═══════════════════════════════════════════════════════════ */

let _importSpecText = '';  // current raw spec text (from paste, file, or URL)

function openImportModal() {
  document.getElementById('imp-spec-text').value = '';
  document.getElementById('imp-preview').style.display = 'none';
  document.getElementById('imp-result').style.display  = 'none';
  document.getElementById('imp-url').value    = '';
  document.getElementById('imp-url-status').textContent = '';
  document.getElementById('imp-file-name').style.display = 'none';
  document.getElementById('imp-btn').disabled = false;
  _importSpecText = '';
  openMod('modal-import');
}

// ── File upload ───────────────────────────────────────────────
function loadImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _importSpecText = e.target.result;
    document.getElementById('imp-file-name').style.display = 'block';
    document.getElementById('imp-file-name').textContent = `✓ Loaded: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
  };
  reader.readAsText(file);
}

// ── URL fetch ─────────────────────────────────────────────────
async function fetchImportUrl() {
  const url = getVal('imp-url').trim();
  const status = document.getElementById('imp-url-status');
  if (!url) { toast('Enter a URL', true); return; }
  status.textContent = 'Fetching…'; status.style.color = 'var(--t3)';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _importSpecText = await res.text();
    status.textContent = `✓ Fetched ${(_importSpecText.length/1024).toFixed(1)} KB`;
    status.style.color = 'var(--ok)';
  } catch(e) {
    status.textContent = `Error: ${e.message}`;
    status.style.color = 'var(--danger)';
  }
}

// ── Parse spec from current active tab ───────────────────────
function getSpecFromActiveTab() {
  const activeTab = document.querySelector('#modal-import .itab.on');
  const tabId = activeTab?.dataset.p;
  if (tabId === 'imp-p-paste') return document.getElementById('imp-spec-text').value.trim();
  return _importSpecText;
}

function parseSpec(raw) {
  if (!raw) throw new Error('No spec content to parse');
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
  // Basic YAML key detection — send as yaml string to backend
  return { _rawYaml: raw };
}

// ── Preview ───────────────────────────────────────────────────
async function previewImport() {
  const raw = getSpecFromActiveTab();
  if (!raw) { toast('Paste or load a spec first', true); return; }
  try {
    let spec;
    try { spec = parseSpec(raw); } catch(e) { toast(`Parse error: ${e.message}`, true); return; }

    const payload = spec._rawYaml ? { yaml: spec._rawYaml } : { spec };
    const previewEl = document.getElementById('imp-preview');
    const listEl    = document.getElementById('imp-preview-list');
    listEl.innerHTML = '<div style="color:var(--t3);padding:8px">Loading preview…</div>';
    previewEl.style.display = 'block';

    // Collect paths locally for a fast preview (no server round-trip needed)
    const paths = spec._rawYaml ? null : (spec.paths || {});
    if (paths) {
      const methods = ['get','post','put','patch','delete'];
      const rows = [];
      for (const [path, item] of Object.entries(paths)) {
        for (const method of methods) {
          if (!(item as any)[method]) continue;
          const op = (item as any)[method];
          const tag = op.tags?.[0] || '';
          rows.push({ method: method.toUpperCase(), path, summary: op.summary || op.operationId || path, tag });
        }
      }
      if (!rows.length) { listEl.innerHTML = '<div style="color:var(--t3)">No paths found</div>'; return; }
      listEl.innerHTML = rows.slice(0, 50).map(r => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bsoft)">
          <span class="meth-badge m-${r.method.toLowerCase()}">${r.method}</span>
          <span style="font-family:var(--mono);font-size:.68rem;color:var(--t1);flex:1">${r.path}</span>
          ${r.tag ? `<span style="font-size:.6rem;color:var(--t3);background:var(--surf);padding:1px 6px;border-radius:3px">${r.tag}</span>` : ''}
        </div>`).join('') + (rows.length > 50 ? `<div style="color:var(--t3);padding:8px">… and ${rows.length - 50} more</div>` : '');
      document.getElementById('imp-btn').disabled = false;
    } else {
      listEl.innerHTML = '<div style="color:var(--t3)">YAML spec — preview available after import</div>';
    }
  } catch(e) { toast(e.message, true); }
}

// ── Run import ────────────────────────────────────────────────
async function runImport() {
  const raw = getSpecFromActiveTab();
  if (!raw) { toast('Paste or load a spec first', true); return; }

  let spec;
  try { spec = parseSpec(raw); } catch(e) { toast(`Parse error: ${e.message}`, true); return; }

  const btn    = document.getElementById('imp-btn');
  const result = document.getElementById('imp-result');
  btn.disabled = true;
  btn.innerHTML = '<i class="material-icons" style="font-size:14px;animation:spin .8s linear infinite">sync</i>Importing…';
  result.style.display = 'none';

  try {
    const payload = spec._rawYaml ? { yaml: spec._rawYaml } : { spec };
    const data = await api('/catalog/import/openapi', { method: 'POST', body: JSON.stringify(payload) });

    const hasErrors = data.errors?.length > 0;
    result.style.display = 'block';
    result.innerHTML = `
      <div style="padding:13px;background:var(--surf);border-radius:var(--rsm);border:1px solid ${data.created > 0 ? 'var(--ok)' : 'var(--border)'}">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:${hasErrors ? '11px' : '0'}">
          <span style="font-size:.8rem"><strong style="color:var(--ok)">${data.created}</strong> <span style="color:var(--t3)">created</span></span>
          <span style="font-size:.8rem"><strong style="color:var(--t3)">${data.skipped}</strong> <span style="color:var(--t3)">skipped</span></span>
          ${hasErrors ? `<span style="font-size:.8rem"><strong style="color:var(--danger)">${data.errors.length}</strong> <span style="color:var(--t3)">errors</span></span>` : ''}
        </div>
        ${hasErrors ? `<div style="margin-top:9px;max-height:120px;overflow-y:auto">
          ${data.errors.map(e => `<div style="font-size:.63rem;color:var(--danger);padding:3px 0;border-bottom:1px solid var(--bsoft);font-family:var(--mono)">${e.method} ${e.path}: ${e.reason}</div>`).join('')}
        </div>` : ''}
      </div>`;

    if (data.created > 0) {
      toast(`Imported ${data.created} endpoints ✓`);
      await loadEndpoints();  // refresh endpoint list
    }
  } catch(e) {
    result.style.display = 'block';
    result.innerHTML = `<div style="padding:11px;background:var(--ddim);border-radius:var(--rsm);color:var(--danger);font-size:.72rem">${e.message}</div>`;
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="material-icons" style="font-size:14px">upload</i>Import';
  }
}

// ── Insert [[VAR]] ref into endpoint form fields ──────────────
function insertEnvRef(fieldId) {
  const activeEnv = allEnvs.find(e => e.isActive);
  if (!activeEnv?.variables?.length) {
    toast('No active environment with variables', true); return;
  }
  // Simple picker popup
  const vars = activeEnv.variables;
  const picker = document.createElement('div');
  picker.style.cssText = 'position:fixed;z-index:9999;background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:8px;min-width:200px;max-height:220px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.3)';
  picker.innerHTML = `<div style="font-size:.62rem;color:var(--t3);margin-bottom:7px;font-weight:700">Insert variable ref</div>` +
    vars.map(v => `<div style="padding:5px 8px;border-radius:var(--rsm);cursor:pointer;font-family:var(--mono);font-size:.7rem;color:var(--t1)"
      onmouseenter="this.style.background='var(--surf)'" onmouseleave="this.style.background=''"
      onclick="doInsertEnvRef('${fieldId}','${v.key}',this.closest('div[style]'))"
    >[[ ${v.key} ]] <span style="color:var(--t3);font-size:.6rem">${(v.value||'').substring(0,20)}</span></div>`).join('');
  document.body.appendChild(picker);
  const field = document.getElementById(fieldId);
  if (field) {
    const rect = field.getBoundingClientRect();
    picker.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
    picker.style.left = (rect.left + window.scrollX) + 'px';
  }
  setTimeout(() => document.addEventListener('click', function rm(e) {
    if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', rm); }
  }), 50);
}

function doInsertEnvRef(fieldId, key, picker) {
  const field = document.getElementById(fieldId);
  if (field) {
    const pos = field.selectionStart ?? field.value.length;
    field.value = field.value.slice(0, pos) + `[[${key}]]` + field.value.slice(pos);
    field.focus();
  }
  picker?.remove();
}
