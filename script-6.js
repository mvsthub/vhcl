const CATS = ['Engine','Aircond System','Transmission System','Steering System','Door','Wiring','Wheel System','Tyre','Exhaust System','Electronic System','Radio','PPM','Gearbox','Clutch','Immobiliser','Others','Multiple Issues'];
const KW = [['Engine',/eng|enj|enig/],['Aircond System',/air ?cond|a\/c/],['Transmission System',/transmission/],['Steering System',/steering/],['Door',/door|pintu/],['Wiring',/wiring|wayar/],['Wheel System',/wheel/],['Tyre',/tyre|tayar/],['Exhaust System',/exhaust|ekzos/],['Electronic System',/electronic/],['Radio',/radio/],['PPM',/ppm/],['Gearbox',/gear ?box/],['Clutch',/clutch/],['Immobiliser',/immobili/]];
const C = { g:'#2fb67c', y:'#f0a020', r:'#e5484d', b:'#3b82f6' };
const shownPrice = new Map();                       // prices a Manager or Webmaster has unlocked (memory only, cleared at sign-out)
const AGE_COL = ['#2fb67c', '#f5c542', '#f28c28', '#e5484d'];   // Completed, < 7 days, 7 - 30 days, > 30 days
const BUCKETS = [['Completed', AGE_COL[0]], ['< 7 days', AGE_COL[1]], ['7 - 30 days', AGE_COL[2]], ['> 30 days', AGE_COL[3]]];
const SITE_ALIAS = { MLK: 'MKA', HTJ: 'SBN' };        // old site codes are shown under their new names
const siteList = () => [...new Set(CONFIG.SITES.map(x => SITE_ALIAS[x] || x))].sort();

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let lastActive = Date.now(), lastPing = 0, lastVer = null, tok = sessionStorage.getItem('tok'), role = sessionStorage.getItem('role'), me = sessionStorage.getItem('me'), rows = [], charts = {};
const ROLE_LABEL = { webmaster: 'Webmaster', manager: 'Manager', marketing: 'Marketing', mechanic: 'Mechanic', facility_manager: 'Facility Manager', stakeholder: 'Stakeholder' };
const CREATABLE = { webmaster: ['webmaster', 'manager', 'marketing', 'mechanic', 'facility_manager', 'stakeholder'], manager: ['manager', 'marketing', 'mechanic', 'facility_manager', 'stakeholder'] };
/* Access levels (from the access table). Admin = Webmaster + Manager = Owner of everything. */
const ADMINS = ['webmaster', 'manager'];
const ACCESS = {                                    // which roles may open each page (N/A roles are simply left out)
  wom: [...ADMINS, 'mechanic', 'facility_manager', 'stakeholder'],       // Work Order Overview
  list: [...ADMINS, 'mechanic', 'facility_manager', 'stakeholder'],      // Work Order List
  bo: [...ADMINS, 'marketing', 'stakeholder'],                           // Business Overview (main tab)
  'bo-kpi': [...ADMINS, 'marketing', 'stakeholder'], 'bo-kpit': [...ADMINS, 'marketing', 'stakeholder'], 'bo-kpir': [...ADMINS, 'marketing', 'stakeholder'],
  'bo-ded': [...ADMINS, 'stakeholder'],                                  // Deduction Performance
  'bo-cfs': [...ADMINS, 'marketing', 'stakeholder'],                     // Customer Feedback Survey
  'bo-mkt': [...ADMINS, 'marketing', 'stakeholder'],                     // Marketing
  'bo-hr': [...ADMINS, 'stakeholder'], 'bo-fin': [...ADMINS, 'stakeholder'], 'bo-bud': [...ADMINS, 'stakeholder'],
  users: ADMINS
};
const SUB_ACCESS = { wom: [...ADMINS, 'stakeholder'] };               // the "Work Order Management" sub-tab inside Business Overview
const EDITORS = { wo: [...ADMINS, 'mechanic'], kpi: ADMINS, cfs: [...ADMINS, 'marketing'], mkt: [...ADMINS, 'marketing'] };   // who sees Edit / Submit buttons
const can = t => (ACCESS[t] || []).includes(role), canEdit = () => EDITORS.wo.includes(role), canKpiEdit = () => EDITORS.kpi.includes(role);

Chart.defaults.font.family = "'JetBrains Mono',monospace";
Chart.defaults.font.size = 11;
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) { /* storage blocked: theme just won't be remembered */ }
  Chart.defaults.color = t === 'dark' ? '#a8b3c7' : '#667085';
  Chart.defaults.borderColor = t === 'dark' ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';
  $('#theme').textContent = t === 'dark' ? '\u2600 Light' : '\u263E Dark';
}

/* ---------- API ---------- */
async function api(action, payload = {}) {
  if (CONFIG.API_URL.startsWith('PASTE')) throw new Error('Set API_URL in script.js first.');
  const res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action, token: tok, ...payload }) });
  const j = await res.json();
  if (!j.ok) { if (/expired|login/i.test(j.error)) logout(true, 'Your session expired. Please sign in again.'); throw new Error(j.error); }
  return j;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3500); }

/* ---------- auth ---------- */
$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  const b = e.target.querySelector('button'); b.disabled = true; $('#loginErr').textContent = '';
  try {
    const j = await api('login', { user: $('#u').value.trim(), pass: $('#p').value });
    tok = j.token; role = j.role; me = j.user; sessionStorage.setItem('tok', tok); sessionStorage.setItem('role', role); sessionStorage.setItem('me', me); start();
  } catch (err) { $('#loginErr').textContent = err.message; }
  b.disabled = false;
};
function logout(silent, msg) {
  if (!silent && tok) api('logout', { reason: msg ? 'idle' : '' }).catch(() => {});
  sessionStorage.clear(); tok = role = me = null; shownPrice.clear();
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  $('#app').hidden = true; $('#login').hidden = false; $('#p').value = ''; $('#loginErr').textContent = msg || '';
}
$('#logout').onclick = () => logout();

/* ---------- data ---------- */
function norm(t) {
  t = String(t || '').toLowerCase();
  const m = KW.filter(k => k[1].test(t)).map(k => k[0]);
  return m.length > 1 || /multiple/.test(t) ? 'Multiple Issues' : m[0] || 'Others';
}
const isoD = v => /^\d{4}-\d\d-\d\d$/.test(v);
const dmy = v => isoD(v) ? `${v.slice(8)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : String(v ?? '');
const dayDiff = (from, to) => Math.round((to - new Date(from + 'T00:00:00')) / 864e5) + 1;   // to - from + 1
const numOr = v => v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
const bucketOf = n => n < 7 ? 1 : n <= 30 ? 2 : 3;     // 1 = under 7 days, 2 = 7 - 30 days, 3 = over 30 days (0 = Completed)
function parse(a) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const done = String(a[24]).trim().toLowerCase() === 'completed';                  // column Y
  const end = done && isoD(a[25]) ? new Date(a[25] + 'T00:00:00') : today;           // column Z
  // In Progress: counted live from the date. Completed: the sheet's own ageing value is kept.
  const ageOf = (start, sv) => { sv = numOr(sv); return done ? (sv != null ? sv : isoD(start) ? dayDiff(start, end) : 0) : isoD(start) ? dayDiff(start, today) : sv != null ? sv : 0; };
  const age = ageOf(a[5], a[7]), wage = ageOf(a[6], a[8]);                          // H workorder ageing (from F), I workshop ageing (from G)
  const n = parseFloat(a[10]);
  const loan = isNaN(n) ? (/[a-z0-9]/i.test(String(a[10])) ? 1 : 0) : n;
  const sx = String(a[3]).trim().toUpperCase();
  return {
    no: a[0], veh: String(a[1]).trim(), ws: String(a[2]).trim().toUpperCase(), site: SITE_ALIAS[sx] || sx || 'N/A',
    wo: String(a[4]).replace(/\s+/g, ' '), nWo: (String(a[4]).match(/F\d+/gi) || []).length || 1,
    cdate: isoD(a[5]) ? a[5] : String(a[5]), age, wage, done, st: done ? 'Completed' : 'In Progress',
    b: done ? 0 : bucketOf(age), bW: done ? 0 : bucketOf(wage), loan,
    cat: norm(a[11]), raw: a, row: a[26], complaint: String(a[12]), pr: String(a[13]).replace(/\s+/g, ' '), status: String(a[15]), mech: a[16]
  };
}
async function load(quiet) {
  try {
    const j = await api('data'); lastVer = j.ver;
    rows = j.rows.map(parse);
    $('#asof').textContent = 'updated ' + new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
    fillFilters(); render(); renderList();
    $('#repairList').innerHTML = [...new Set(rows.map(repairOf).filter(x => x !== 'Not specified'))].sort().map(x => `<option value="${esc(x)}">`).join('');
  } catch (e) { if (!quiet) toast(e.message); }
}

/* ---------- dashboard ---------- */
const uniq = k => [...new Set(rows.map(r => r[k]))].sort();
function fillFilters() {
  const keep = [$('#fSite').value, $('#fWs').value];
  $('#fSite').innerHTML = '<option value="">All sites</option>' + uniq('site').map(s => `<option>${esc(s)}</option>`).join('');
  $('#fWs').innerHTML = '<option value="">All workshops</option>' + uniq('ws').map(s => `<option>${esc(s)}</option>`).join('');
  $('#fSite').value = keep[0] || ''; $('#fWs').value = keep[1] || '';
}
const bucket = r => $('#fAgeBy').value === 'ws' ? r.bW : r.b;   // which ageing the filter and the three charts use
const filtered = () => rows.filter(r => (!$('#fSite').value || r.site === $('#fSite').value) && (!$('#fWs').value || r.ws === $('#fWs').value) && ($('#fAge').value === '' || bucket(r) === +$('#fAge').value) && (!$('#fCat').value || r.cat === $('#fCat').value));
const cnt = (l, b) => l.filter(r => bucket(r) === b).length;

function mk(id, cfg) {
  charts[id]?.destroy();
  cfg.options = { responsive: true, maintainAspectRatio: false, ...cfg.options };
  charts[id] = new Chart(document.getElementById(id), cfg);
}
function stacked(id, key, list) {
  const keys = uniqBy(list, key);
  mk(id, { type: 'bar', data: { labels: keys, datasets: BUCKETS.map((d, i) => ({ label: d[0], backgroundColor: d[1], data: keys.map(k => list.filter(r => r[key] === k && bucket(r) === i).length) })) },
    options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } } });
}
const uniqBy = (list, key) => key === 'ws' ? [...new Set(list.map(r => r[key]))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [...new Set(list.map(r => r[key]))].sort((a, b) => list.filter(r => r[key] === b).length - list.filter(r => r[key] === a).length);

function render() {
  const l = filtered(), n = l.length, open = l.filter(r => !r.done), by = 'age';   // average ageing is always counted from the complaint date
  const avg = open.length ? Math.round(open.reduce((x, r) => x + r[by], 0) / open.length) : 0;
  const loans = l.reduce((x, r) => x + r.loan, 0);
  const k = (t, v, sub, c) => `<div class="kpi" style="--c:${c}"><small>${t}</small><b>${v}</b><span>${sub}</span></div>`;
  $('#kpis').innerHTML =
    k('Total vehicles', n, `${l.reduce((x, r) => x + r.nWo, 0)} work orders`, '#64748b') +
    k('Open vehicles', open.length, `${open.reduce((x, r) => x + r.nWo, 0)} work orders `, C.b) +
    k('Completed', cnt(l, 0), pct(cnt(l, 0), n) + '% of total', AGE_COL[0]) +
    k('Under 7 days', cnt(l, 1), pct(cnt(l, 1), n) + '% of total', AGE_COL[1]) +
    k('7 \u2013 30 days', cnt(l, 2), pct(cnt(l, 2), n) + '% of total', AGE_COL[2]) +
    k('Over 30 days', cnt(l, 3), pct(cnt(l, 3), n) + '% of total', AGE_COL[3]) +
    k('Loaners out', loans, `${l.filter(r => r.loan).length} vehicles with loaner`, '#8b5cf6') +
    k('Avg ageing', avg, 'days since complaint (open)', '#0ea5e9');

  mk('cAge', { type: 'doughnut', data: { labels: BUCKETS.map(b => b[0]), datasets: [{ data: [0, 1, 2, 3].map(i => cnt(l, i)), backgroundColor: BUCKETS.map(b => b[1]), borderWidth: 0 }] },
    options: { cutout: '62%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw} (${pct(c.raw, n)}%)` } } } } });
  stacked('cSite', 'site', l);
  stacked('cWs', 'ws', l);
  loaner(); category(); loanCo(); supplier();
}
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;

function loaner() {
  const key = $('#loanBy').value, l = filtered(), keys = uniqBy(l, key);
  mk('cLoan', { type: 'bar', data: { labels: keys, datasets: [{ label: 'Loaner ambulances', backgroundColor: '#8b5cf6', data: keys.map(x => l.filter(r => r[key] === x).reduce((s, r) => s + r.loan, 0)) }] },
    options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } });
}
function category() {
  const sc = $('#catScope').value, item = $('#catItem');
  if (sc === 'all') item.hidden = true;
  else {
    const opts = uniq(sc), cur = item.value;
    item.innerHTML = opts.map(o => `<option>${esc(o)}</option>`).join(''); item.hidden = false;
    item.value = opts.includes(cur) ? cur : opts[0];
  }
  const l = sc === 'all' ? rows : rows.filter(r => r[sc] === item.value), n = l.length;
  const data = CATS.map(c => [c, l.filter(r => r.cat === c).length]).filter(d => d[1]).sort((a, b) => b[1] - a[1]);
  mk('cCat', { type: 'bar', data: { labels: data.map(d => `${d[0]} (${pct(d[1], n)}%)`), datasets: [{ backgroundColor: C.b, data: data.map(d => d[1]) }] },
    options: { indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } });
  $('#catTable').innerHTML = `<table><tr><th>Category</th><th>Count</th><th>%</th><th></th></tr>${data.map(d => `<tr><td>${esc(d[0])}</td><td>${d[1]}</td><td>${pct(d[1], n)}%</td><td style="width:90px"><div class="bar" style="width:${pct(d[1], n)}%"></div></td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${n}</b></td><td><b>100%</b></td><td></td></tr></table>`;
}

/* ---------- loaner company and panel workshop / supplier charts (same filter style as the category chart) ---------- */
function breakdown(canvas, scopeId, itemId, tableId, labelsOf) {
  const sc = $(scopeId).value, item = $(itemId);
  if (sc === 'all') item.hidden = true;
  else {
    const opts = uniq(sc), cur = item.value;
    item.innerHTML = opts.map(o => `<option>${esc(o)}</option>`).join(''); item.hidden = false;
    item.value = opts.includes(cur) ? cur : opts[0];
  }
  const l = (sc === 'all' ? rows : rows.filter(r => r[sc] === item.value)).map(r => labelsOf(r)).filter(x => x.length), n = l.length, map = new Map();
  l.forEach(labs => labs.forEach(lb => { const key = lb.toUpperCase(), e = map.get(key) || { name: lb, c: 0 }; e.c++; map.set(key, e); }));
  const data = [...map.values()].sort((a, b) => b.c - a.c || a.name.localeCompare(b.name)), top = data.slice(0, 15);
  mk(canvas, { type: 'bar', data: { labels: top.map(d => `${d.name} (${pct(d.c, n)}%)`), datasets: [{ backgroundColor: C.b, data: top.map(d => d.c) }] },
    options: { indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } });
  $(tableId).innerHTML = `<table><tr><th>Name</th><th>Vehicles</th><th>%</th><th></th></tr>${data.map(d => `<tr><td>${esc(d.name)}</td><td>${d.c}</td><td>${pct(d.c, n)}%</td><td style="width:90px"><div class="bar" style="width:${pct(d.c, n)}%"></div></td></tr>`).join('')}<tr><td><b>Total vehicles</b></td><td><b>${n}</b></td><td></td><td></td></tr></table>`;
}
const vendorsOf = r => {                             // column S can hold several suppliers on separate lines, plus phone numbers
  const seen = new Set(), out = [];
  String(r.raw[18] ?? '').split(/\r?\n|'\s+'/).forEach(x => {
    x = x.replace(/^[\s'"]+|[\s'"]+$/g, '').replace(/\s*\d[\d\s\-\u2013()\/]{5,}$/, '').trim();
    if (!/[a-z]{2}/i.test(x) || seen.has(x.toUpperCase())) return;
    seen.add(x.toUpperCase()); out.push(x);
  });
  return out;
};
const loanCo = () => breakdown('cLoanCo', '#loanCoScope', '#loanCoItem', '#loanCoTable', r => { const t = String(r.raw[9] ?? '').replace(/\s+/g, ' ').trim(); return /[a-z]/i.test(t) ? [t] : []; });
/* Panel workshop / supplier (column S) split by repair method (column R): stacked bars, a share doughnut and a table */
const repairOf = r => { const t = String(r.raw[17] ?? '').replace(/\s+/g, ' ').trim(); return /[a-z0-9]/i.test(t) ? t : 'Not specified'; };
const REP_COL = ['#3b82f6', '#f28c28', '#2fb67c', '#8b5cf6', '#e5484d', '#06b6d4', '#f5c542', '#a855f7'];
function scoped(scopeId, itemId) {                   // rows in the chosen scope (All / one workshop / one site)
  const sc = $(scopeId).value, item = $(itemId);
  if (sc === 'all') { item.hidden = true; return rows; }
  const opts = uniq(sc), cur = item.value;
  item.innerHTML = opts.map(o => `<option>${esc(o)}</option>`).join(''); item.hidden = false;
  item.value = opts.includes(cur) ? cur : opts[0];
  return rows.filter(r => r[sc] === item.value);
}
function supplier() {
  const scope = scoped('#supScope', '#supItem');
  // share of every repair method in this scope (colours are shared with the stacked bars)
  const rm = new Map();
  scope.forEach(r => { const m = repairOf(r), k = m.toUpperCase(), e = rm.get(k) || { name: m, c: 0 }; e.c++; rm.set(k, e); });
  const rl = [...rm.values()].sort((a, b) => b.c - a.c), col = new Map(rl.map((d, i) => [d.name.toUpperCase(), d.name === 'Not specified' ? '#9aa5b8' : REP_COL[i % REP_COL.length]]));
  mk('cRep', { type: 'doughnut', data: { labels: rl.map(d => d.name), datasets: [{ data: rl.map(d => d.c), backgroundColor: rl.map(d => col.get(d.name.toUpperCase())), borderWidth: 0 }] },
    options: { cutout: '55%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw} (${pct(c.raw, scope.length)}%)` } } } } });
  // suppliers, each split by repair method
  const withSup = scope.map(r => ({ v: vendorsOf(r), m: repairOf(r) })).filter(x => x.v.length), n = withSup.length, sup = new Map();
  withSup.forEach(x => x.v.forEach(name => { const k = name.toUpperCase(), e = sup.get(k) || { name, c: 0, by: new Map() }, mk2 = x.m.toUpperCase(); e.c++; e.by.set(mk2, (e.by.get(mk2) || 0) + 1); sup.set(k, e); }));
  const data = [...sup.values()].sort((a, b) => b.c - a.c || a.name.localeCompare(b.name)), top = data.slice(0, 15);
  const mKeys = rl.map(d => d.name.toUpperCase()).filter(k => data.some(e => e.by.has(k)));
  mk('cSup', { type: 'bar', data: { labels: top.map(d => `${d.name} (${pct(d.c, n)}%)`), datasets: mKeys.map(k => ({ label: rm.get(k).name, backgroundColor: col.get(k), data: top.map(d => d.by.get(k) || 0) })) },
    options: { indexAxis: 'y', scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true } }, plugins: { legend: { position: 'bottom' } } } });
  $('#supTable').innerHTML = `<table><tr><th>Supplier</th><th>Vehicles</th><th>%</th><th>Repair method</th></tr>${data.map(d => `<tr><td>${esc(d.name)}</td><td>${d.c}</td><td>${pct(d.c, n)}%</td><td style="color:var(--mute);font-size:12px">${[...d.by].sort((a, b) => b[1] - a[1]).map(([k, c]) => esc(rm.get(k).name) + ' ' + c).join(' \u00b7 ')}</td></tr>`).join('')}<tr><td><b>Total vehicles</b></td><td><b>${n}</b></td><td></td><td></td></tr></table>`;
}

/* ---------- work order list ---------- */
const cell = (r, i) => String(r.raw[i] ?? '').replace(/\s+/g, ' ').trim();
const lastLine = r => r.status.split('\n').filter(x => x.trim()).pop() || '';
const priceOf = r => r.raw[23] === '' || isNaN(Number(r.raw[23])) ? cell(r, 23) : Number(r.raw[23]);
/* h = header, v = value used for sorting, t = table cell. Order matches the Summary sheet. */
const pill = n => `<span class="pill ${n < 7 ? 'g' : n <= 30 ? 'y' : 'r'}">${n}</span>`;
const priceTxt = v => typeof v === 'number' ? v.toLocaleString('en-MY') : String(v ?? '');
/* h = header, w = column width in px (change the numbers to resize), cls = tighter spacing for narrow columns,
   hc: true = centre the header title, cc: true = centre the cell text, v = sort value, t = cell */
const allPricesShown = () => { const w = rows.filter(r => r.raw[23]); return w.length > 0 && w.every(r => shownPrice.has(String(r.row))); };
const COLS = [
  { h: 'No', w: 52, v: r => Number(r.no), t: r => `<td>${esc(r.no)}</td>` },
  { h: 'Completion status', w: 105, hc: true,  cls: 'nar', v: r => r.st, t: r => `<td><span class="pill sm ${r.done ? 'g' : 'n'}">${r.st}</span></td>` },
  { h: 'Vehicle', w: 96, v: r => r.veh, t: r => `<td><b>${esc(r.veh)}</b></td>` },
  { h: 'WS', w: 52, v: r => r.ws, t: r => `<td>${esc(r.ws)}</td>` },
  { h: 'Site', w: 62, v: r => r.site, t: r => `<td>${esc(r.site)}</td>` },
  { h: 'WO no', w: 110, v: r => r.wo, t: r => `<td>${esc(r.wo)}</td>` },
  { h: 'Complaint date', w: 92, hc: true, cls: 'nar', v: r => r.cdate, t: r => `<td>${esc(dmy(r.cdate))}</td>` },
  { h: 'Entry date', w: 84, hc: true, cls: 'nar', v: r => cell(r, 6), t: r => `<td>${esc(dmy(cell(r, 6)))}</td>` },
  { h: 'Workorder ageing', w: 86, hc: true, cc: true, cls: 'nar', v: r => r.age, t: r => `<td>${pill(r.age)}</td>` },
  { h: 'Workshop ageing', w: 78, hc: true, cc: true, cls: 'nar', v: r => r.wage, t: r => `<td>${pill(r.wage)}</td>` },
  { h: 'Loaner company', w: 80, cls: 'nar', v: r => cell(r, 9), t: r => `<td>${esc(cell(r, 9))}</td>` },                          // column J
  { h: 'Loaner quantity', w: 84, cls: 'nar', v: r => numOr(cell(r, 10)) ?? cell(r, 10), t: r => `<td>${esc(cell(r, 10))}</td>` },   // column K
  { h: 'Category', w: 130, v: r => r.cat, t: r => `<td>${esc(r.cat)}</td>` },
  { h: 'User complaint', w: 440, v: r => r.complaint, t: r => `<td>${esc(r.complaint)}</td>` },
  { h: 'PR no', w: 200, v: r => cell(r, 13), t: r => `<td>${esc(cell(r, 13))}</td>` },
  { h: 'Progress', w: 680, v: r => lastLine(r), t: r => `<td class="st"><div class="prog-short">${esc(lastLine(r).slice(0, 140))}</div><div class="prog-full">${esc(r.status.trim())}</div></td>` },   // click the row to read everything
  { h: 'Mechanic', w: 216, v: r => cell(r, 16), t: r => `<td>${esc(cell(r, 16))}</td>` },
  { h: 'Repair method', w: 130, v: r => cell(r, 17), t: r => `<td>${esc(cell(r, 17))}</td>` },   // column R
  { h: 'Panel workshop / supplier', w: 240, v: r => cell(r, 18), t: r => `<td>${esc(cell(r, 18))}</td>` },
  { h: 'Price (RM)', w: 100, hc: true, cc: true, hdr: () => allPricesShown() ? '<button class="btn sm" data-hideall="1">Hide</button>' : '<button class="btn sm" data-showall="1">Show</button>', v: r => shownPrice.has(String(r.row)) ? numOr(shownPrice.get(String(r.row))) ?? String(shownPrice.get(String(r.row))) : '',
    t: r => { const k = String(r.row); if (!r.raw[23]) return '<td></td>';   // the server only says whether a price exists; the value stays hidden until a Manager or Webmaster unlocks it
      return shownPrice.has(k) ? `<td>${esc(priceTxt(shownPrice.get(k)))}<br><button class="btn sm" data-hide="${k}">Hide</button></td>` : `<td><button class="btn sm" data-show="${k}">Show</button></td>`; } }
];
const openRows = new Set();                        // rows the user has expanded (kept when the data refreshes)
let sort = { i: COLS.findIndex(c => c.h === 'No'), d: 1 };                          // default: No 1, 2, 3 ...
const isEmpty = v => v === '' || v == null || (typeof v === 'number' && isNaN(v));

const cellHtml = (c, r) => {                         // cls = spacing class, cc = centre the cell text
  const h = c.t(r), cls = [c.cls, c.cc ? 'cc' : ''].filter(Boolean).join(' ');
  return !cls ? h : h.startsWith('<td class="') ? h.replace('<td class="', `<td class="${cls} `) : h.replace('<td', `<td class="${cls}"`);
};
function renderList() {
  const q = $('#q').value.toLowerCase(), col = COLS[sort.i];
  const l = rows.filter(r => !q || Object.values(r).join(' ').toLowerCase().includes(q)).sort((x, y) => {
    const a = col.v(x), b = col.v(y), ea = isEmpty(a), eb = isEmpty(b);
    if (ea || eb) return ea - eb;                    // blanks always last
    const c = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    return c * sort.d || x.row - y.row;
  });
  $('#count').textContent = l.length + ' vehicles';
  const ed = canEdit();
  $('#list').style.width = (COLS.reduce((x, c) => x + c.w, 0) + (ed ? 70 : 0)) + 'px';
  $('#list').innerHTML = '<colgroup>' + COLS.map(c => `<col style="width:${c.w}px">`).join('') + (ed ? '<col style="width:70px">' : '') + '</colgroup><tr>' +
    COLS.map((c, i) => `<th class="${c.cls || ''}${c.hc ? ' hc' : ''}" aria-sort="${i === sort.i ? (sort.d > 0 ? 'ascending' : 'descending') : 'none'}"><button class="sortbtn" data-i="${i}" title="Sort by ${esc(c.h)}">${esc(c.h)}<span>${i === sort.i ? (sort.d > 0 ? '\u25B2' : '\u25BC') : ''}</span></button>${c.hdr ? '<div>' + c.hdr() + '</div>' : ''}</th>`).join('') + (ed ? '<th></th>' : '') + '</tr>' +
    l.map(r => `<tr class="wr${openRows.has(String(r.row)) ? ' open' : ''}" data-r="${r.row}">` + COLS.map(c => cellHtml(c, r)).join('') + (ed ? `<td><button class="btn sm" data-row="${r.row}">Edit</button></td>` : '') + '</tr>').join('');
}

/* ---------- form ---------- */
$('#woForm [name=site]').innerHTML = '<option value="">Select</option>' + siteList().map(x => `<option>${x}</option>`).join('');
$('#catSel').innerHTML = '<option value="">Select</option>' + CATS.map(c => `<option>${c}</option>`).join('');
$('#woForm').onsubmit = async e => {
  e.preventDefault();
  const b = $('#saveBtn'); b.disabled = true; b.textContent = 'Saving...';
  try {
    await api('add', { row: Object.fromEntries(new FormData(e.target)) });
    toast('Work order added to the Summary sheet'); e.target.reset(); $('#newDlg').close(); await load();
  } catch (err) { toast('Could not save: ' + err.message); }
  b.disabled = false; b.textContent = 'Add to Summary sheet';
};

/* ---------- ui wiring ---------- */
const MAIN_OF = t => t === 'list' ? 'wom' : t.startsWith('bo-') ? 'bo' : t;       // which main tab a page belongs to
const SUB_OF = t => t === 'bo-kpit' || t === 'bo-kpir' ? 'bo-kpi' : t;
function showTab(t) {
  if (!can(t)) return;
  $$('nav button').forEach(x => x.classList.toggle('on', x.dataset.tab === MAIN_OF(t)));
  $('#subnav').hidden = !t.startsWith('bo-');
  $$('#subnav button').forEach(x => x.classList.toggle('on', x.dataset.sub === SUB_OF(t)));
  $$('.tab').forEach(x => x.hidden = x.id !== 'tab-' + t);
  if (t === 'users') loadUsers();
}
const NAV_TARGET = { wom: 'wom', bo: 'bo-kpi', users: 'users' };                      // Business Overview opens on KPI Overview
$$('nav button').forEach(b => b.onclick = () => showTab(NAV_TARGET[b.dataset.tab]));
$$('#subnav button').forEach(b => b.onclick = () => showTab(b.dataset.sub));           // the "Work Order Management" sub-tab redirects to the main tab
$('#womListBtn').onclick = () => showTab('list'); $('#listBack').onclick = () => showTab('wom');
$('#fCat').innerHTML = '<option value="">All categories</option>' + CATS.map(c => `<option>${c}</option>`).join('');
['#fSite', '#fWs', '#fAge', '#fCat'].forEach(x => $(x).onchange = render);
$('#fAgeBy').onchange = () => { $('#fAgeLbl').textContent = $('#fAgeBy').selectedOptions[0].text; render(); };
$('#reset').onclick = () => { $('#fSite').value = $('#fWs').value = $('#fAge').value = $('#fCat').value = ''; $('#fAgeBy').value = 'wo'; $('#fAgeLbl').textContent = 'Workorder Ageing'; render(); };
$('#loanBy').onchange = loaner; $('#catScope').onchange = category; $('#catItem').onchange = category;
$('#loanCoScope').onchange = loanCo; $('#loanCoItem').onchange = loanCo; $('#supScope').onchange = supplier; $('#supItem').onchange = supplier;
$('#submitNew').onclick = () => $('#newDlg').showModal(); $('#newCancel').onclick = () => $('#newDlg').close();
$('#q').oninput = renderList; $('#refresh').onclick = () => refreshAll();
$('#theme').onclick = () => { applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); if (rows.length && can('wom')) render(); if (typeof renderKpiAll === 'function') renderKpiAll(); };
applyTheme(document.documentElement.dataset.theme || 'light');
setInterval(() => $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }) + ' MYT', 1000);

function start() {
  $('#login').hidden = true; $('#app').hidden = false;
  $('#who').textContent = `${me} (${ROLE_LABEL[role]})`;
  $$('nav button').forEach(b => b.hidden = !can(b.dataset.tab));
  $$('#subnav button').forEach(b => b.hidden = b.dataset.sub === 'wom' ? !SUB_ACCESS.wom.includes(role) : !can(b.dataset.sub));
  $('#submitNew').hidden = !canEdit();
  showTab(['wom', 'bo-kpi', 'users'].find(can)); refreshAll();
}
async function refreshAll(quiet) {                   // loads only what this role may see
  const jobs = [];
  if (can('wom')) jobs.push(load(quiet));
  if (can('bo-kpi') && typeof loadKpi === 'function') jobs.push(loadKpi(quiet));
  await Promise.all(jobs);
}
if (tok && role) start();
async function poll() {                              // refresh only when the sheet has changed
  checkIdle();
  if (!tok || document.hidden) return;
  try { const j = await api('ver'); if (j.ver !== lastVer) await refreshAll(true); } catch (e) { /* keep quiet; next poll retries */ }
}
setInterval(poll, CONFIG.POLL_SEC * 1000);
document.addEventListener('visibilitychange', poll);

/* ---------- edit a row (Webmaster, Manager, Staff) ---------- */
const MAP = { veh: 1, ws: 2, site: 3, wo: 4, cdate: 5, edate: 6, loan: 10, complaint: 12, prNo: 13, prDate: 14, status: 15, mech: 16, repair: 17, panel: 18, panelTel: 19, rTitle: 20, rNo: 21, rDate: 22, done: 24, doneDate: 25, loanCo: 9 };
let editing = null;
$('#list').onclick = e => {
  const h = e.target.closest('[data-i]');
  if (h) { const i = +h.dataset.i; sort = { i, d: sort.i === i ? -sort.d : 1 }; renderList(); return; }   // click a header to sort; click again to reverse
  if (e.target.closest('[data-showall]')) { askPrice('all'); return; }
  if (e.target.closest('[data-hideall]')) { shownPrice.clear(); renderList(); return; }
  const sb = e.target.closest('[data-show]'), hb = e.target.closest('[data-hide]');
  if (sb) { askPrice(sb.dataset.show); return; }
  if (hb) { shownPrice.delete(hb.dataset.hide); renderList(); return; }
  const b = e.target.closest('[data-row]');
  if (b) { openEdit(rows.find(r => r.row == b.dataset.row)); return; }
  const tr = e.target.closest('tr.wr');                // click a row to show or hide its full Progress text
  if (tr && !e.target.closest('.prog-full')) { const id = tr.dataset.r; openRows.has(id) ? openRows.delete(id) : openRows.add(id); tr.classList.toggle('open'); }
};
function openEdit(r) {
  editing = r; const f = $('#editForm');
  f.innerHTML = $('#woForm').innerHTML;
  f.querySelector('[name=price]')?.closest('label')?.remove();   // price is shown only through the Show button, so it is not editable here
  f.querySelector('#saveBtn').parentElement.innerHTML = '<button class="btn primary">Save changes</button> <button type="button" class="btn" id="editCancel">Cancel</button>';
  for (const [name, i] of Object.entries(MAP)) {
    const v = r.raw[i], el = f.elements[name];
    el.value = /date$/i.test(name) ? (/^\d{4}-\d\d-\d\d$/.test(v) ? v : '') : name === 'done' ? (/completed/i.test(v) ? 'Completed' : 'In Progress') : name === 'loan' ? (isNaN(parseFloat(v)) ? '' : v) : v;
    if (name === 'loan' && isNaN(parseFloat(v)) && v) el.placeholder = String(v);
  }
  f.elements.cat.value = r.cat;
  if (r.site && f.elements.site.value !== r.site) { f.elements.site.add(new Option(r.site, r.site)); f.elements.site.value = r.site; }   // keep sites that are not in the list
  $('#editCancel').onclick = () => $('#editDlg').close();
  f.onsubmit = async e => {
    e.preventDefault();
    const row = Object.fromEntries(new FormData(f));
    if (row.loan === '' && editing.raw[10] !== '' && isNaN(parseFloat(editing.raw[10]))) row.loan = editing.raw[10];   // keep text such as ZAR
    row.row = editing.row; row.orig = editing.veh;
    try { await api('update', { row }); $('#editDlg').close(); toast('Work order updated'); load(); }
    catch (err) { toast('Could not save: ' + err.message); }
  };
  $('#editDlg').showModal();
}

/* ---------- users (Webmaster, Manager) ---------- */
async function loadUsers() {
  try {
    $('#roleSel').innerHTML = CREATABLE[role].map(r => `<option value="${r}">${ROLE_LABEL[r]}</option>`).join('');
    const j = await api('listUsers');
    $('#userList').innerHTML = '<tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>' + j.users.map(u => {
      const mine = CREATABLE[role].includes(u.role) && u.username.toLowerCase() !== me.toLowerCase();
      return `<tr><td>${esc(u.username)}</td><td>${esc(u.email)}</td><td>${ROLE_LABEL[u.role] || esc(u.role)}</td><td>${u.active ? 'Active' : 'Disabled'}</td><td>${mine ? `<button class="btn sm" data-u="${esc(u.username)}" data-a="${u.active ? 'off' : 'on'}">${u.active ? 'Disable' : 'Enable'}</button> <button class="btn sm" data-u="${esc(u.username)}" data-a="pw">Reset password</button>` : ''}</td></tr>`;
    }).join('');
  } catch (e) { toast(e.message); }
}
$('#userForm').onsubmit = async e => {
  e.preventDefault();
  try { await api('addUser', Object.fromEntries(new FormData(e.target))); toast('User added'); e.target.reset(); loadUsers(); }
  catch (err) { toast(err.message); }
};
$('#userList').onclick = async e => {
  const b = e.target.closest('[data-u]'); if (!b) return;
  const p = { username: b.dataset.u };
  if (b.dataset.a === 'pw') { p.password = prompt('New password for ' + p.username + ' (min 8 characters):'); if (!p.password) return; }
  else p.active = b.dataset.a === 'on';
  try { await api('setUser', p); toast('Updated ' + p.username); loadUsers(); } catch (err) { toast(err.message); }
};

/* ---------- automatic sign-out after inactivity ---------- */
const IDLE_MIN = CONFIG.IDLE_MIN || 10;
function checkIdle() { if (tok && Date.now() - lastActive > IDLE_MIN * 60000) logout(false, `You were signed out after ${IDLE_MIN} minutes of inactivity.`); }
['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(ev => addEventListener(ev, () => {
  lastActive = Date.now();
  if (tok && lastActive - lastPing > 60000) { lastPing = lastActive; api('ping').catch(() => {}); }   // tells the server the user is still here
}, { passive: true }));
setInterval(checkIdle, 15000);

/* ---------- price: hidden until a Manager or Webmaster signs in ---------- */
let priceRow = null;
function askPrice(row) {
  priceRow = row; const f = $('#priceForm'); f.reset(); $('#priceErr').textContent = '';
  $('#priceMsg').textContent = row === 'all' ? 'Only a Manager or Webmaster account can show all prices.' : 'Only a Manager or Webmaster account can show this price.';
  $('#priceGo').textContent = row === 'all' ? 'Show all prices' : 'Show price';
  $('#priceDlg').showModal(); f.elements.user.focus();
}
$('#priceCancel').onclick = () => $('#priceDlg').close();
$('#priceForm').onsubmit = async e => {
  e.preventDefault(); const f = e.target, b = f.querySelector('.primary'); b.disabled = true; $('#priceErr').textContent = '';
  try {
    const cred = { user: f.elements.user.value.trim(), pass: f.elements.pass.value };
    if (priceRow === 'all') { const j = await api('prices', cred); Object.entries(j.prices).forEach(([r, v]) => shownPrice.set(String(r), v)); }
    else { const j = await api('price', { ...cred, row: priceRow }); shownPrice.set(String(priceRow), j.price); }
    f.reset(); $('#priceDlg').close(); renderList();
  } catch (err) { $('#priceErr').textContent = err.message; f.elements.pass.value = ''; }
  b.disabled = false;
};
