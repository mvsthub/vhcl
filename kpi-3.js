/* Business Overview > KPI Overview, KPI Table and KPI Revenue.
   Reads the Google Sheet tabs "KPI Overview - KPI Table" and "KPI Overview - Revenue Stream".
   The charts and filters are built from the columns found in each tab (text, number, date), so they follow the sheet.
   Needs script.js ($, $$, api, esc, toast, mk, charts, can, canKpiEdit, showTab, isoD, dmy, pct, tok, role). */
const KPI = { table: null, revenue: null };
const KEYS = ['table', 'revenue'];
const KTITLE = { table: 'KPI Table', revenue: 'Revenue Stream' };
const ksel = { table: {}, revenue: {} };              // chosen filter values
const ksort = { table: { i: -1, d: 1 }, revenue: { i: -1, d: 1 } };
const PAL = ['#3b82f6', '#f28c28', '#2fb67c', '#8b5cf6', '#e5484d', '#06b6d4', '#f5c542', '#a855f7', '#64748b', '#14b8a6'];
const PCT_HDR = /%|rate|ratio|percent|achiev|score|conversion|margin/i;      // these are averaged, not summed
let kEdit = null;

const nm = v => { if (typeof v === 'number') return v; const t = String(v ?? '').replace(/[,\s]|RM/gi, ''); return t !== '' && !isNaN(Number(t)) ? Number(t) : null; };
const cmpV = (a, b) => { const x = nm(a), y = nm(b); return x !== null && y !== null ? x - y : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }); };
const kdisp = v => isoD(v) ? dmy(v) : String(v ?? '');

async function loadKpi(quiet) {
  try {
    const j = await api('kpiData'); lastVer = j.ver;
    KEYS.forEach(k => KPI[k] = j.tabs[k]);
    $('#kpiAsof').textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
    renderKpiAll();
  } catch (e) { if (!quiet) toast(e.message); }
}
function renderKpiAll() { KEYS.forEach(k => { renderKpi(k); renderKpiTable(k); }); }

/* ---------- reading the columns ---------- */
function analyse(ds) {
  return ds.headers.map((h, i) => {
    const vals = ds.rows.map(r => r[i]).filter(v => v !== '' && v != null), n = vals.length;
    const date = n > 0 && vals.every(isoD);
    const numeric = n > 0 && vals.filter(v => nm(v) !== null).length / n >= 0.8;
    const idLike = /^(no\.?|id|bil|#|sn|s\/n)$/i.test(h);
    const isPct = numeric && vals.every(v => typeof v === 'number') && ds.disp.some(r => /%\s*$/.test(String(r[i])));
    return { i, h, type: date ? 'date' : numeric && !idLike ? 'num' : 'text', pct: isPct, distinct: new Set(vals.map(String)).size, n };
  });
}
function plan(ds) {
  const cols = analyse(ds), nums = cols.filter(c => c.type === 'num'), texts = cols.filter(c => c.type === 'text');
  const label = texts.find(c => c.distinct >= 3) || texts[0];
  const cats = texts.filter(c => c !== label && c.distinct >= 2 && c.distinct <= 12).slice(0, 3);
  const period = cols.find(c => c.type === 'date') || texts.find(c => c !== label && /month|period|quarter|year|date|week/i.test(c.h) && c.distinct <= 36);
  const tgt = nums.find(c => /target|budget|plan|forecast/i.test(c.h));
  const act = nums.find(c => c !== tgt && /actual|ytd|achieved|result|current|revenue|amount/i.test(c.h));
  return { cols, nums, label, cats, period, tgt, act };
}
const isAvg = c => c.pct || PCT_HDR.test(c.h);
const numv = (r, c) => { const v = nm(r[c.i]); return v === null ? null : c.pct ? v * 100 : v; };
function agg(rs, c) {
  const v = rs.map(r => numv(r, c)).filter(x => x !== null); if (!v.length) return null;
  const s = v.reduce((a, b) => a + b, 0); return +(isAvg(c) ? s / v.length : s).toFixed(2);
}
const fmtN = (v, c) => v === null ? '-' : v.toLocaleString('en-MY', { maximumFractionDigits: 2 }) + (c.pct ? '%' : '');
const groups = (rs, c, order) => {                    // rows grouped by the values of column c
  const m = new Map(); rs.forEach(r => { const k = String(r[c.i]); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  let keys = [...m.keys()]; if (order === 'sort') keys.sort(cmpV);
  return keys.map(k => [k, m.get(k)]);
};

/* ---------- KPI Overview dashboard ---------- */
function renderKpi(key, keepBar) {
  const ds = KPI[key], bar = $('#kf-' + key);
  if (!ds || ds.error || !ds.headers.length) {
    bar.innerHTML = `<span class="sub">${esc(ds && ds.error ? ds.error : ds ? 'No data found in this tab yet.' : 'Loading...')}</span>`;
    $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; return;
  }
  const pl = plan(ds);
  const fcols = [pl.label && pl.label.distinct <= 40 ? pl.label : null, ...pl.cats, pl.period && pl.period.distinct <= 36 ? pl.period : null].filter((c, i, a) => c && a.indexOf(c) === i);
  if (!keepBar) {
    bar.innerHTML = fcols.map(c => {
      const vals = [...new Set(ds.rows.map(r => r[c.i]).filter(v => v !== '' && v != null).map(String))];
      if (c.type === 'date' || c === pl.period) vals.sort(cmpV); else if (c !== pl.period) vals.sort();
      if (ksel[key][c.i] && !vals.includes(ksel[key][c.i])) ksel[key][c.i] = '';
      return `<label>${esc(c.h)} <select data-k="${key}" data-kc="${c.i}"><option value="">All</option>${vals.map(v => `<option value="${esc(v)}"${ksel[key][c.i] === v ? ' selected' : ''}>${esc(kdisp(v))}</option>`).join('')}</select></label>`;
    }).join('') + `<button class="btn" data-kreset="${key}">Reset</button>`;
  }
  const rs = ds.rows.filter(r => Object.entries(ksel[key]).every(([c, v]) => !v || String(r[c]) === v));
  // summary cards
  const cards = [`<div class="kpi" style="--c:${PAL[0]}"><small>Rows</small><b>${rs.length}</b><span>${rs.length === ds.rows.length ? 'all rows' : 'of ' + ds.rows.length + ' (filtered)'}</span></div>`]
    .concat(pl.nums.slice(0, 4).map((c, n) => `<div class="kpi" style="--c:${PAL[(n + 1) % PAL.length]}"><small>${isAvg(c) ? 'Avg' : 'Total'} ${esc(c.h)}</small><b>${fmtN(agg(rs, c), c)}</b><span>${rs.length} rows</span></div>`));
  $('#kk-' + key).innerHTML = cards.join('');
  // charts
  Object.keys(charts).filter(id => id.startsWith('kcv_' + key)).forEach(id => { charts[id].destroy(); delete charts[id]; });
  const list = [], leg = { position: 'bottom' };
  const gl = pl.label ? groups(rs, pl.label) : [];
  if (pl.period && pl.nums.length && rs.length) {
    const g = groups(rs, pl.period, pl.period.type === 'date' ? 'sort' : '');
    list.push({ t: `Trend by ${pl.period.h}`, cfg: { type: 'line', data: { labels: g.map(x => kdisp(x[0])), datasets: pl.nums.slice(0, 3).map((c, n) => ({ label: c.h, data: g.map(x => agg(x[1], c)), borderColor: PAL[n], backgroundColor: PAL[n], tension: .25, spanGaps: true })) }, options: { plugins: { legend: leg } } } });
  }
  if (pl.label && pl.nums.length && gl.length) {
    if (pl.tgt && pl.act) {
      const top = gl.map(x => ({ k: x[0], a: agg(x[1], pl.act), t: agg(x[1], pl.tgt) })).sort((a, b) => (b.a ?? 0) - (a.a ?? 0)).slice(0, 12);
      list.push({ t: `${pl.act.h} vs ${pl.tgt.h} by ${pl.label.h}`, cfg: { type: 'bar', data: { labels: top.map(x => x.k), datasets: [{ label: pl.act.h, backgroundColor: PAL[0], data: top.map(x => x.a) }, { label: pl.tgt.h, backgroundColor: PAL[1], data: top.map(x => x.t) }] }, options: { plugins: { legend: leg } } } });
    } else {
      const c = pl.nums[0], top = gl.map(x => ({ k: x[0], v: agg(x[1], c) })).sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, 12);
      list.push({ t: `${c.h} by ${pl.label.h}`, cfg: { type: 'bar', data: { labels: top.map(x => x.k), datasets: [{ label: c.h, backgroundColor: PAL[0], data: top.map(x => x.v) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } } });
    }
    if (pl.nums.length > 1 && !(pl.tgt && pl.act && pl.nums.length === 2)) {
      const c = pl.nums.find(x => x !== pl.nums[0] && x !== pl.tgt && x !== pl.act) || pl.nums[1], top = gl.map(x => ({ k: x[0], v: agg(x[1], c) })).sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, 12);
      list.push({ t: `${c.h} by ${pl.label.h}`, cfg: { type: 'bar', data: { labels: top.map(x => x.k), datasets: [{ label: c.h, backgroundColor: PAL[2], data: top.map(x => x.v) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } } });
    }
  }
  pl.cats.slice(0, 2).forEach(cc => {
    const g = groups(rs, cc).map(x => [x[0], x[1].length]).sort((a, b) => b[1] - a[1]);
    if (g.length) list.push({ t: `Count by ${cc.h}`, cfg: { type: 'doughnut', data: { labels: g.map(x => x[0]), datasets: [{ data: g.map(x => x[1]), backgroundColor: g.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] }, options: { cutout: '55%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw} (${pct(c.raw, rs.length)}%)` } } } } } });
  });
  const shown = list.slice(0, 6);
  $('#kg-' + key).innerHTML = shown.length ? shown.map((x, n) => `<div class="panel"><h2>${esc(x.t)}</h2><div class="cv"><canvas id="kcv_${key}_${n}"></canvas></div></div>`).join('')
    : `<div class="panel" style="grid-column:1/-1">Not enough numeric or category columns in this tab to draw charts yet.</div>`;
  shown.forEach((x, n) => mk(`kcv_${key}_${n}`, x.cfg));
}

/* ---------- KPI Table and KPI Revenue pages ---------- */
function renderKpiTable(key) {
  const ds = KPI[key], tbl = $('#kd-' + key);
  if (!ds || ds.error) { tbl.innerHTML = `<tr><td>${esc(ds ? ds.error : 'Loading...')}</td></tr>`; return; }
  const q = $('#kq-' + key).value.toLowerCase(), ed = canKpiEdit(), so = ksort[key];
  const idx = ds.rows.map((_, i) => i).filter(i => !q || ds.disp[i].join(' ').toLowerCase().includes(q));
  if (so.i >= 0) idx.sort((a, b) => cmpV(ds.rows[a][so.i], ds.rows[b][so.i]) * so.d || a - b);
  $('#kn-' + key).textContent = idx.length + ' rows';
  tbl.innerHTML = '<tr>' + ds.headers.map((h, i) => `<th><button class="sortbtn" data-ks="${key}" data-ci="${i}">${esc(h)}<span>${so.i === i ? (so.d > 0 ? '\u25B2' : '\u25BC') : ''}</span></button></th>`).join('') + (ed ? '<th></th>' : '') + '</tr>' +
    idx.map(i => '<tr>' + ds.rows[i].map((v, c) => `<td>${esc(isoD(v) ? dmy(v) : ds.disp[i][c])}</td>`).join('') + (ed ? `<td><button class="btn sm" data-ke="${key}" data-ki="${i}">Edit</button></td>` : '') + '</tr>').join('');
}

/* ---------- Edit a row (Webmaster and Manager only) ---------- */
function openKpiEdit(key, i) {
  const ds = KPI[key], cols = analyse(ds), r = ds.rows[i];
  kEdit = { key, i, cols };
  $('#kpiDlgTitle').textContent = 'Edit ' + KTITLE[key] + ' row';
  $('#kpiForm').innerHTML = cols.map(c => {
    const v = r[c.i], ro = ds.f[i][c.i] ? ' disabled' : '', long = c.type === 'text' && (String(v).length > 60 || /\n/.test(v));
    const inp = c.type === 'date' ? `<input type="date" name="c${c.i}" value="${isoD(v) ? v : ''}"${ro}>`
      : c.type === 'num' ? `<input type="number" step="any" name="c${c.i}" value="${esc(kNumShown(c, v))}"${ro}>`
      : long ? `<textarea name="c${c.i}" rows="3"${ro}>${esc(v)}</textarea>` : `<input name="c${c.i}" value="${esc(v)}"${ro}>`;
    return `<label${long ? ' class="full"' : ''}>${esc(c.h)}${c.pct ? ' (%)' : ''}${ro ? ' (calculated in the sheet)' : ''}${inp}</label>`;
  }).join('') + '<div class="full"><button class="btn primary">Save changes</button> <button type="button" class="btn" id="kpiCancel">Cancel</button></div>';
  $('#kpiCancel').onclick = () => $('#kpiDlg').close();
  $('#kpiDlg').showModal();
}
const kNumShown = (c, v) => v === '' || v == null ? '' : String(c.pct ? +(nm(v) * 100).toFixed(4) : nm(v) ?? v);
$('#kpiForm').onsubmit = async e => {
  e.preventDefault();
  const f = e.target, ds = KPI[kEdit.key], orig = ds.rows[kEdit.i], changes = [];
  kEdit.cols.forEach(c => {
    const el = f.elements['c' + c.i]; if (!el || el.disabled) return;
    const before = c.type === 'date' ? (isoD(orig[c.i]) ? orig[c.i] : '') : c.type === 'num' ? kNumShown(c, orig[c.i]) : String(orig[c.i] ?? '');
    if (el.value !== before) changes.push({ c: c.i, v: el.value, t: c.type === 'num' ? (c.pct ? 'pct' : 'number') : c.type });
  });
  if (!changes.length) { $('#kpiDlg').close(); return; }
  try { await api('kpiUpdate', { tab: kEdit.key, row: ds.rowNums[kEdit.i], changes }); toast('Saved to the Google Sheet'); $('#kpiDlg').close(); await loadKpi(true); }
  catch (err) { toast('Could not save: ' + err.message); }
};

/* ---------- wiring ---------- */
$('#tab-bo-kpi').onchange = e => { const s = e.target.closest('[data-kc]'); if (s) { ksel[s.dataset.k][s.dataset.kc] = s.value; renderKpi(s.dataset.k, true); } };
$('#tab-bo-kpi').onclick = e => { const b = e.target.closest('[data-kreset]'); if (b) { ksel[b.dataset.kreset] = {}; renderKpi(b.dataset.kreset); } };
KEYS.forEach(k => {
  $('#kq-' + k).oninput = () => renderKpiTable(k);
  $('#kd-' + k).onclick = e => {
    const h = e.target.closest('[data-ks]'), b = e.target.closest('[data-ke]');
    if (h) { const i = +h.dataset.ci, so = ksort[k]; ksort[k] = { i, d: so.i === i ? -so.d : 1 }; renderKpiTable(k); }
    else if (b) openKpiEdit(b.dataset.ke, +b.dataset.ki);
  };
});
$('#kpiTblBtn').onclick = () => showTab('bo-kpit'); $('#kpiRevBtn').onclick = () => showTab('bo-kpir');
$('#kpitBack').onclick = () => showTab('bo-kpi'); $('#kpirBack').onclick = () => showTab('bo-kpi');
if (tok && role && can('bo-kpi')) loadKpi(true);       // page reload while signed in
