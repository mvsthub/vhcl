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
let kview = 'val';                                    // KPI table bar chart: actual values or % of target
const rsel = { col: null, sub: {} };                   // revenue: chosen value column and the clicked slice of each pie
const MAINS = ['Workshop', 'Mobile Service', 'Fleet Service', 'Reimbursable Work', 'Dealership'];
const col = i => String.fromCharCode(65 + i);
const fmtM = v => v == null ? '-' : v.toLocaleString('en-MY', { maximumFractionDigits: 2 });
const cellNum = (raw, disp) => {                      // number from a cell: 0.9 shown as 90% -> 90, "RM2.63m" -> 2630000, "(1.0m)" -> -1000000
  if (typeof raw === 'number') return /%\s*$/.test(String(disp)) ? raw * 100 : raw;
  const t = String(disp || raw || '').replace(/,/g, ''), m = t.match(/\d+(\.\d+)?/); if (!m) return null;
  let v = parseFloat(m[0]); if (/\d\s*m\b/i.test(t)) v *= 1e6; else if (/\d\s*k\b/i.test(t)) v *= 1e3;
  return /^\s*\(.*\)\s*$/.test(t) || /-\s*(RM)?\s*\d/i.test(t) ? -v : v;
};
const kcard = (t, v, s, c) => `<div class="kpi" style="--c:${c}"><small>${esc(t)}</small><b>${v}</b><span>${esc(s)}</span></div>`;
const kpanel = (title, id, tall) => `<div class="panel"><h2>${title}</h2><div class="cv${tall ? ' tall' : ''}"><canvas id="${id}"></canvas></div></div>`;
const kclear = key => Object.keys(charts).filter(id => id.startsWith('kcv_' + key)).forEach(id => { charts[id].destroy(); delete charts[id]; });

function renderKpi(key, keepBar) {
  const ds = KPI[key], bar = $('#kf-' + key);
  if (!ds || ds.error || !ds.headers.length) {
    bar.innerHTML = `<span class="sub">${esc(ds && ds.error ? ds.error : ds ? 'No data found in this tab yet.' : 'Loading...')}</span>`;
    $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; return;
  }
  kclear(key);
  try { (key === 'revenue' ? renderRevenue : renderKpiCharts)(ds, key, keepBar); }
  catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the charts: ${esc(e.message)}</div>`; }
}

/* KPI Table: weightage pie + Target (column D) vs Status June 2026 (column F) double bars */
function renderKpiCharts(ds, key, keepBar) {
  const H = ds.headers, f = re => H.findIndex(h => re.test(h));
  let ki = f(/key performance indicator|^kpi/i);
  if (ki < 0) ki = H.findIndex((h, i) => ds.rows.some(r => typeof r[i] === 'string' && r[i].trim() && nm(r[i]) === null));
  const wi = f(/weight/i), ti = 3, si = 5, tName = H[ti] || 'Target', sName = H[si] || 'Status', pl = plan(ds);
  if (!keepBar) {
    const fc = [pl.label && pl.label.distinct <= 40 ? pl.label : null, ...pl.cats, pl.period && pl.period.distinct <= 36 ? pl.period : null].filter((c, i, a) => c && a.indexOf(c) === i);
    $('#kf-' + key).innerHTML = fc.map(c => {
      const vals = [...new Set(ds.rows.map(r => r[c.i]).filter(v => v !== '' && v != null).map(String))].sort(cmpV);
      if (ksel[key][c.i] && !vals.includes(ksel[key][c.i])) ksel[key][c.i] = '';
      return `<label>${esc(c.h)} <select data-k="${key}" data-kc="${c.i}"><option value="">All</option>${vals.map(v => `<option value="${esc(v)}"${ksel[key][c.i] === v ? ' selected' : ''}>${esc(kdisp(v))}</option>`).join('')}</select></label>`;
    }).join('') + `<label>Bar values <select data-kview="1"><option value="val"${kview === 'val' ? ' selected' : ''}>Actual values</option><option value="pct"${kview === 'pct' ? ' selected' : ''}>% of target</option></select></label><button class="btn" data-kreset="${key}">Reset</button>`;
  }
  const idx = ds.rows.map((_, i) => i).filter(i => Object.entries(ksel[key]).every(([c, v]) => !v || String(ds.rows[i][c]) === v));
  const items = idx.map(i => { const r = ds.rows[i], d = ds.disp[i]; return { name: String(r[ki] ?? '').trim(), w: wi >= 0 ? cellNum(r[wi], d[wi]) : null, t: cellNum(r[ti], d[ti]), s: cellNum(r[si], d[si]) }; })
    .filter(x => x.name && !/^total/i.test(x.name) && (x.w !== null || x.t !== null || x.s !== null));
  const wsum = items.reduce((a, x) => a + (x.w || 0), 0), wPct = wi >= 0 && ds.disp.some(r => /%\s*$/.test(String(r[wi])));
  $('#kk-' + key).innerHTML = kcard('KPIs', items.length, idx.length === ds.rows.length ? 'all rows' : 'filtered', PAL[0]) + (wi >= 0 ? kcard('Total weightage', fmtM(+wsum.toFixed(2)) + (wPct ? '%' : ''), 'sum of ' + H[wi], PAL[2]) : '');
  const out = [], leg = { position: 'bottom' };
  const wl = items.filter(x => x.w > 0);
  out.push(wl.length ? kpanel('Weightage by Key Performance Indicator', 'kcv_table_0', 1) : `<div class="panel"><h2>Weightage by Key Performance Indicator</h2><p class="sub">No "Weightage" column found in the tab.</p></div>`);
  const bl = items.filter(x => x.t !== null || x.s !== null), pctMode = kview === 'pct';
  out.push(kpanel(`${esc(tName)} vs ${esc(sName)} by Key Performance Indicator`, 'kcv_table_1', 1));
  $('#kg-' + key).innerHTML = out.join('');
  if (wl.length) mk('kcv_table_0', { type: 'pie', data: { labels: wl.map(x => x.name), datasets: [{ data: wl.map(x => x.w), backgroundColor: wl.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw}${wPct ? '%' : ''}` } } } } });
  mk('kcv_table_1', { type: 'bar', data: { labels: bl.map(x => x.name), datasets: [
      { label: pctMode ? tName + ' (100%)' : tName, backgroundColor: PAL[0], data: bl.map(x => pctMode ? (x.t ? 100 : null) : x.t) },
      { label: pctMode ? sName + ' (% of target)' : sName, backgroundColor: PAL[1], data: bl.map(x => pctMode ? (x.t ? +(x.s / x.t * 100).toFixed(1) : null) : x.s) }] },
    options: { indexAxis: 'y', plugins: { legend: leg, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmtM(c.raw)}` } } } } });
}

/* Revenue Stream: pies by stream with a sub-pie on click. Column C = Secured (CA), column D = Unsecured (NCA) */
function renderRevenue(ds, key, keepBar) {
  const H = ds.headers, R = ds.rows, D = ds.disp;
  const lab = r => { for (let c = 0; c < Math.min(3, H.length); c++) { const v = R[r][c]; if (typeof v === 'string' && v.trim() && nm(v) === null && !isoD(v)) return v.trim(); } return ''; };
  const nk = t => String(t).toLowerCase().replace(/^\s*[\da-z]{1,2}[.)]\s+/, '').replace(/[^a-z0-9]/g, '').replace(/s$/, '');
  const labels = R.map((_, i) => lab(i)), keys = labels.map(nk);
  const found = MAINS.map(m => ({ name: m, r: keys.indexOf(nk(m)) })).filter(x => x.r >= 0).sort((a, b) => a.r - b.r);
  if (!found.length) {
    $('#kf-' + key).innerHTML = ''; $('#kk-' + key).innerHTML = '';
    $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not find the rows ${MAINS.join(', ')} in the tab. First labels found: ${esc(labels.filter(Boolean).slice(0, 8).join(', '))}</div>`; return;
  }
  const totalRow = keys.findIndex(k => k.startsWith('total'));
  const kidsOf = (x, cc) => {                         // sub-rows under a stream, up to the next stream, a "Total" row or a blank label
    const next = found.find(y => y.r > x.r), end = Math.min(next ? next.r : R.length, totalRow > x.r ? totalRow : R.length), out = [];
    for (let j = x.r + 1; j < end && labels[j]; j++) { const v = cellNum(R[j][cc], D[j][cc]); if (v !== null) out.push({ name: labels[j], v }); }
    return out;
  };
  const valsFor = cc => found.map(x => { const ch = kidsOf(x, cc), own = cellNum(R[x.r][cc], D[x.r][cc]); return { name: x.name, v: own !== null && own > 0 ? own : ch.reduce((a, y) => a + y.v, 0), kids: ch }; });
  const textCol = c => { const v = R.map(r => r[c]).filter(x => x !== '' && x != null); return v.length > 0 && v.filter(x => typeof x === 'string' && /[a-z]{3}/i.test(x)).length / v.length > 0.5; };
  const numCols = H.map((_, i) => i).filter(i => i > 0 && !textCol(i) && (valsFor(i).some(s => s.v > 0) || (totalRow >= 0 && cellNum(R[totalRow][i], D[totalRow][i]) !== null)));
  const secIdx = numCols.includes(2) ? 2 : numCols.find(i => /^secured/i.test(H[i]));       // Secured (CA)   = column C
  const unsIdx = numCols.includes(3) ? 3 : numCols.find(i => /unsecured/i.test(H[i]));     // Unsecured (NCA) = column D
  const cname = i => i === secIdx ? 'Secured (CA)' : i === unsIdx ? 'Unsecured (NCA)' : H[i];
  if (rsel.col === null || !numCols.includes(rsel.col)) rsel.col = unsIdx ?? numCols[0];   // default: Unsecured (NCA)
  const pc = rsel.col;
  if (!keepBar) $('#kf-' + key).innerHTML = `<label>Show <select data-krc="1">${numCols.map(i => `<option value="${i}"${i === pc ? ' selected' : ''}>${esc(cname(i))}</option>`).join('')}</select></label><button class="btn" data-kreset="${key}">Reset</button>`;
  // cards: Secured (CA) first, then Unsecured (NCA), then the rest. Uses the sheet's own Total row when there is one, otherwise the sum of the streams.
  const order = [secIdx, unsIdx, ...numCols].filter((v, n, a) => v !== undefined && a.indexOf(v) === n).slice(0, 4);
  $('#kk-' + key).innerHTML = order.map((i, n) => {
    const tv = totalRow >= 0 ? cellNum(R[totalRow][i], D[totalRow][i]) : null, v = tv !== null ? tv : valsFor(i).reduce((a, x) => a + x.v, 0);
    return kcard((/^total/i.test(cname(i)) ? '' : 'Total ') + cname(i), fmtM(v), tv !== null ? `from the "${labels[totalRow]}" row` : 'sum of the streams', PAL[n % PAL.length]);
  }).join('') + `<div class="sub" style="grid-column:1/-1">Data check: ${[secIdx, unsIdx].filter(v => v !== undefined).map(i => `column ${col(i)} = ${cname(i)}`).join(', ')}. Rows found: ${found.map(x => `${esc(x.name)} (sheet row ${ds.rowNums[x.r]})`).join(', ')}${found.length < MAINS.length ? '. Not found: ' + esc(MAINS.filter(m => !found.some(x => x.name === m)).join(', ')) : ''}.</div>`;
  // pies: the one chosen in "Show" (default Unsecured (NCA)) and a fixed "Secured by revenue stream" (column C), each with a sub-pie
  const sets = [{ id: 'p', c: pc, title: `${cname(pc)} by revenue stream` }];
  if (secIdx !== undefined) sets.push({ id: 's', c: secIdx, title: 'Secured by revenue stream' });
  sets.forEach(b => { b.streams = valsFor(b.c).filter(x => x.v > 0); b.tot = b.streams.reduce((a, x) => a + x.v, 0); });
  $('#kg-' + key).innerHTML = sets.map(b => b.streams.length
    ? `<div class="panel"><h2>${esc(b.title)} <span style="font-weight:400;color:var(--mute)">(click a slice)</span></h2><div class="cv"><canvas id="kcv_revenue_${b.id}"></canvas></div></div><div class="panel"><h2 id="rsubt_${b.id}"></h2><div class="cv"><canvas id="kcv_revenue_${b.id}_sub"></canvas></div></div>`
    : `<div class="panel" style="grid-column:1/-1">${esc(b.title)}: every stream is 0 or empty in column ${col(b.c)}.</div>`).join('');
  const share = (v, t) => `${fmtM(v)} (${t ? pct(v, t) : 0}%)`;
  sets.filter(b => b.streams.length).forEach(b => {
    const drawSub = () => {
      const s = b.streams.find(x => x.name === rsel.sub[b.id]) || b.streams[0]; rsel.sub[b.id] = s.name;
      const kids = s.kids.filter(y => y.v > 0), parts = kids.length ? kids : [{ name: s.name, v: s.v }], t = parts.reduce((a, y) => a + y.v, 0);
      $('#rsubt_' + b.id).textContent = `${s.name} breakdown`;
      mk(`kcv_revenue_${b.id}_sub`, { type: 'pie', data: { labels: parts.map(y => y.name), datasets: [{ data: parts.map(y => y.v), backgroundColor: parts.map((_, n) => PAL[(n + 2) % PAL.length]), borderWidth: 0 }] },
        options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: x => ` ${x.label}: ${share(x.raw, t)}` } } } } });
    };
    mk(`kcv_revenue_${b.id}`, { type: 'pie', data: { labels: b.streams.map(x => x.name), datasets: [{ data: b.streams.map(x => x.v), backgroundColor: b.streams.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] },
      options: { onClick: (e, els) => { if (els.length) { rsel.sub[b.id] = b.streams[els[0].index].name; drawSub(); } }, onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: x => ` ${x.label}: ${share(x.raw, b.tot)}` } } } } });
    drawSub();
  });
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
$('#tab-bo-kpi').onchange = e => {
  const s = e.target.closest('[data-kc]'), v = e.target.closest('[data-kview]'), r = e.target.closest('[data-krc]');
  if (s) { ksel[s.dataset.k][s.dataset.kc] = s.value; renderKpi(s.dataset.k, true); }
  else if (v) { kview = v.value; renderKpi('table', true); }
  else if (r) { rsel.col = +r.value; renderKpi('revenue', true); }
};
$('#tab-bo-kpi').onclick = e => { const b = e.target.closest('[data-kreset]'); if (b) { ksel[b.dataset.kreset] = {}; if (b.dataset.kreset === 'table') kview = 'val'; else { rsel.col = null; rsel.sub = {}; } renderKpi(b.dataset.kreset); } };
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
