/* Business Overview > Deduction Performance. Reads fixed cells of the Google Sheet:

   Tab "Deduction Performance - Summary":  January in row 5 ... December in row 16.  Column C = Deduction % for the first year (2025), column D = second year (2026).

   Tab "Deduction Performance-Hospital":
     Deduction table (rows 3-40):  Jan-25 in row 5 ... Dec-27 in row 40.  Deduction (RM) per hospital in columns B (HSA) ... X (JLB).
     Revenue table  (rows 46-83):  Jan-25 in row 48 ... Dec-27 in row 83.  Revenue (RM) per hospital in columns B ... X.
     Workshops by column:  WR3 = B-J (HSA ... MKJ),  WR2 = K-R (MUR ... JSN),  WR1 = S-X (SBN ... JLB).

   Needs kpi.js and script.js (KPI, PAL, cellNum, fmtM, kcard, kpanel, kclear, col, nm, mk, charts, esc, $, pct, isoD, showTab). */
const WSC = { WR1: '#3b82f6', WR2: '#f28c28', WR3: '#2fb67c' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YPAL = ['#3b82f6', '#f28c28', '#2fb67c', '#8b5cf6'];
const wsOf = c => c <= 9 ? 'WR3' : c <= 17 ? 'WR2' : 'WR1';          // sheet column index (B = 1): B-J = WR3, K-R = WR2, S-X = WR1
const ssel = { year: '' };                                           // summary filter
const hsel = { ws: '', hospital: '', year: '', month: '' };          // hospital filters

function renderDed(keepBar) { renderDedSummary(keepBar); renderDedHospital(keepBar); const a = $('#dedAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }); }

const gat = (g, r) => r >= g.first && r - g.first < g.raw.length ? [g.raw[r - g.first], g.disp[r - g.first]] : null;     // [raw, display] of a sheet row
function parseMonth(raw, disp) {                                     // 2025-01-01, "Jan-25", "Jan 2025" ...
  if (typeof raw === 'string' && isoD(raw)) return { y: +raw.slice(0, 4), m: +raw.slice(5, 7) };
  const m = String(disp || raw || '').match(/([A-Za-z]{3,9})[\s\-\/.']*(\d{2,4})/); if (!m) return null;
  const mi = MON.findIndex(x => x.toLowerCase() === m[1].slice(0, 3).toLowerCase()); if (mi < 0) return null;
  let y = +m[2]; if (y < 100) y += 2000; return { y, m: mi + 1 };
}
const msg = (key, text) => { $('#kf-' + key).innerHTML = `<span class="sub">${esc(text)}</span>`; $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; };
const tick = s => v => v + s;

/* ---------- Summary: Deduction % by month, 2025 vs 2026 ---------- */
function sumData(ds) {
  const g = ds && ds.grid; if (!g) return null;
  const yearOf = c => { for (let r = 1; r <= 4; r++) { const x = gat(g, r); const m = x && String(x[1][c] || x[0][c] || '').match(/20\d\d/); if (m) return m[0]; } return null; };
  const rows = [];
  for (let r = 5; r <= 16; r++) {
    const x = gat(g, r); if (!x) continue;
    let name = ''; for (let c = 0; c < 2; c++) { const v = String(x[0][c] ?? '').trim(); if (v && nm(v) === null) { name = v; break; } }
    rows.push({ name: (name || MON[r - 5]).slice(0, 3), a: cellNum(x[0][2], x[1][2]), b: cellNum(x[0][3], x[1][3]) });
  }
  return { y1: yearOf(2) || '2025', y2: yearOf(3) || '2026', rows };
}
function renderDedSummary(keepBar) {
  const key = 'dsum', ds = KPI[key]; kclear(key);
  if (!ds || ds.error) return msg(key, ds && ds.error ? ds.error : 'Loading...');
  const S = sumData(ds); if (!S || !S.rows.length) return msg(key, 'No data found in rows 5 to 16 of the tab yet.');
  try {
    if (ssel.year && ssel.year !== S.y1 && ssel.year !== S.y2) ssel.year = '';
    if (!keepBar) $('#kf-' + key).innerHTML = `<label>Year <select data-sf="year"><option value="">All years</option><option${ssel.year === S.y1 ? ' selected' : ''}>${S.y1}</option><option${ssel.year === S.y2 ? ' selected' : ''}>${S.y2}</option></select></label><button class="btn" data-sreset="1">Reset</button>`;
    const show1 = !ssel.year || ssel.year === S.y1, show2 = !ssel.year || ssel.year === S.y2;
    const vals = k => S.rows.map(r => r[k]).filter(v => v !== null), avg = k => { const v = vals(k); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const a1 = avg('a'), a2 = avg('b'), tgt = (typeof CONFIG !== 'undefined' && CONFIG.FIN_TARGETS && CONFIG.FIN_TARGETS.deduction) ?? 0.5;
    let lastI = -1; S.rows.forEach((r, i) => { if (r.b !== null) lastI = i; });
    const pc = v => v === null ? '-' : v.toFixed(2) + '%';
    $('#kk-' + key).innerHTML = (show1 ? kcard(`Average ${S.y1}`, pc(a1), `${vals('a').length} months`, YPAL[0]) : '') + (show2 ? kcard(`Average ${S.y2}`, pc(a2), `${vals('b').length} months`, YPAL[1]) : '') +
      (show2 && lastI >= 0 ? kcard(`Latest month ${S.y2}`, pc(S.rows[lastI].b), S.rows[lastI].name, YPAL[2]) : '') +
      (a1 !== null && a2 !== null ? kcard(`Change ${S.y2} vs ${S.y1}`, (a2 - a1 >= 0 ? '+' : '') + (a2 - a1).toFixed(2) + ' pp', a2 <= a1 ? 'lower is better: improved' : 'higher: worse', a2 <= a1 ? '#2fb67c' : '#e5484d') : '');
    const L = S.rows.map(r => r.name), leg = { position: 'bottom' }, pctTip = { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw === null ? '-' : c.raw + '%'}` } }, panels = [];
    const lines = [];
    if (show1) lines.push({ label: S.y1, data: S.rows.map(r => r.a), borderColor: YPAL[0], backgroundColor: YPAL[0], tension: .25, spanGaps: true });
    if (show2) lines.push({ label: S.y2, data: S.rows.map(r => r.b), borderColor: YPAL[1], backgroundColor: YPAL[1], tension: .25, spanGaps: true });
    lines.push({ label: `Target (${tgt}%)`, data: L.map(() => tgt), borderColor: '#e5484d', borderDash: [6, 4], pointRadius: 0, borderWidth: 2 });
    panels.push(['Deduction % by month', { type: 'line', data: { labels: L, datasets: lines }, options: { scales: { y: { beginAtZero: true, ticks: { callback: tick('%') } } }, plugins: { legend: leg, tooltip: pctTip } } }]);
    const diff = S.rows.map(r => r.a !== null && r.b !== null ? +(r.b - r.a).toFixed(3) : null);
    if (diff.some(v => v !== null)) panels.push([`Change ${S.y2} vs ${S.y1} (percentage points)`, { type: 'bar', data: { labels: L, datasets: [{ label: 'Change', data: diff, backgroundColor: diff.map(v => v !== null && v > 0 ? '#e5484d' : '#2fb67c') }] }, options: { scales: { y: { ticks: { callback: tick(' pp') } } }, plugins: { legend: { display: false } } } }]);
    panels.push(['Average deduction % per year', { type: 'bar', data: { labels: [S.y1, S.y2], datasets: [{ label: 'Average deduction %', data: [a1 === null ? null : +a1.toFixed(3), a2 === null ? null : +a2.toFixed(3)], backgroundColor: [YPAL[0], YPAL[1]] }] }, options: { scales: { y: { beginAtZero: true, ticks: { callback: tick('%') } } }, plugins: { legend: { display: false }, tooltip: pctTip } } }]);
    $('#kg-' + key).innerHTML = panels.map((p, n) => kpanel(esc(p[0]), `kcv_${key}_${n}`)).join('');
    panels.forEach((p, n) => mk(`kcv_${key}_${n}`, p[1]));
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the summary charts: ${esc(e.message)}</div>`; }
}

/* ---------- Hospital: Deduction (RM) and Revenue (RM) per hospital per month ---------- */
function hospGrid(ds, firstRow, lastRow) {
  const g = ds && ds.grid; if (!g) return null;
  let hr = firstRow - 1;                                             // header row: the row above the first month that holds the hospital codes (HSA ...)
  for (let r = firstRow - 1; r >= Math.max(g.first, firstRow - 4); r--) { const x = gat(g, r); if (x && x[0].some(c => /^\s*HSA\s*$/i.test(String(c)))) { hr = r; break; } }
  const hh = gat(g, hr), names = [];
  for (let c = 1; c <= 23; c++) names.push((hh && String(hh[0][c] ?? '').trim()) || 'Col ' + col(c));   // columns B..X
  const months = [];
  for (let r = firstRow; r <= lastRow; r++) {
    const x = gat(g, r); if (!x) continue; const pm = parseMonth(x[0][0], x[1][0]); if (!pm) continue;
    months.push({ y: pm.y, m: pm.m, key: pm.y * 100 + pm.m, label: MON[pm.m - 1] + '-' + String(pm.y).slice(2), v: names.map((_, i) => cellNum(x[0][i + 1], x[1][i + 1])) });
  }
  return { names, months };
}
function renderDedHospital(keepBar) {
  const key = 'dhosp'; kclear(key);
  if (!KPI.dded) return msg(key, 'Loading...');
  if (KPI.dded.error) return msg(key, KPI.dded.error);
  const D = hospGrid(KPI.dded, 5, 40), R = hospGrid(KPI.drev, 48, 83);
  if (!D || !D.months.length) return msg(key, 'No month rows found in rows 5 to 40 of the tab yet.');
  try {
    const rmap = new Map((R ? R.months : []).map(m => [m.key, m])), years = [...new Set(D.months.map(m => m.y))].sort();
    const hosp = D.names.map((n, i) => ({ n, i, ws: wsOf(i + 1) })), inWs = hosp.filter(h => !hsel.ws || h.ws === hsel.ws);
    if (hsel.hospital && !inWs.some(h => h.n === hsel.hospital)) hsel.hospital = '';
    if (hsel.year && !years.includes(+hsel.year)) hsel.year = '';
    if (!keepBar) $('#kf-' + key).innerHTML =
      `<label>Workshop <select data-hf="ws"><option value="">All workshops</option>${['WR1', 'WR2', 'WR3'].map(w => `<option${w === hsel.ws ? ' selected' : ''}>${w}</option>`).join('')}</select></label>` +
      `<label>Hospital <select data-hf="hospital"><option value="">All hospitals</option>${inWs.map(h => `<option${h.n === hsel.hospital ? ' selected' : ''}>${esc(h.n)}</option>`).join('')}</select></label>` +
      `<label>Year <select data-hf="year"><option value="">All years</option>${years.map(y => `<option${String(y) === hsel.year ? ' selected' : ''}>${y}</option>`).join('')}</select></label>` +
      `<label>Month <select data-hf="month"><option value="">All months</option>${MON.map((m, i) => `<option value="${i + 1}"${String(i + 1) === hsel.month ? ' selected' : ''}>${m}</option>`).join('')}</select></label><button class="btn" data-hreset="1">Reset</button>`;
    const cols = inWs.filter(h => !hsel.hospital || h.n === hsel.hospital);
    const ms = D.months.filter(m => (!hsel.year || m.y === +hsel.year) && (!hsel.month || m.m === +hsel.month));
    const dOf = (m, cs) => cs.reduce((a, h) => a + (m.v[h.i] ?? 0), 0), rOf = (m, cs) => { const r = rmap.get(m.key); return r ? cs.reduce((a, h) => a + (r.v[h.i] ?? 0), 0) : 0; };
    const has = (m, cs) => cs.some(h => m.v[h.i] !== null);
    const per = cols.map(h => ({ h, d: ms.reduce((a, m) => a + (m.v[h.i] ?? 0), 0), r: ms.reduce((a, m) => a + rOf(m, [h]), 0) }));
    const sumD = per.reduce((a, x) => a + x.d, 0), sumR = per.reduce((a, x) => a + x.r, 0), top = [...per].sort((a, b) => b.d - a.d)[0];
    $('#kk-' + key).innerHTML = kcard('Total deduction', 'RM ' + fmtM(Math.round(sumD)), `${ms.length} months, ${cols.length} hospitals`, '#e5484d') +
      kcard('Total revenue', R ? 'RM ' + fmtM(Math.round(sumR)) : '-', R ? 'same months and hospitals' : 'Revenue table not found', '#3b82f6') +
      kcard('Deduction % of revenue', sumR ? (sumD / sumR * 100).toFixed(2) + '%' : '-', 'deduction \u00f7 revenue', '#f28c28') +
      kcard('Highest deduction', top && top.d > 0 ? top.h.n : '-', top && top.d > 0 ? `RM ${fmtM(Math.round(top.d))} (${top.h.ws})` : '', '#8b5cf6');
    const leg = { position: 'bottom' }, rm = { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw === null ? '-' : typeof c.raw === 'number' && c.dataset.yAxisID !== 'y1' ? 'RM ' + fmtM(c.raw) : c.raw + (c.dataset.yAxisID === 'y1' ? '%' : '')}` } };
    const out = [];
    // 1. monthly trend (bars = deduction, line = % of revenue)
    const tm = ms.filter(m => has(m, cols)), dser = tm.map(m => dOf(m, cols)), rser = tm.map(m => rOf(m, cols));
    out.push({ t: 'Monthly deduction' + (hsel.hospital ? ` - ${hsel.hospital}` : hsel.ws ? ` - ${hsel.ws}` : ''), wide: 1, cfg: { type: 'bar', data: { labels: tm.map(m => m.label), datasets: [{ label: 'Deduction (RM)', data: dser, backgroundColor: '#e5484d', order: 2 }].concat(R ? [{ type: 'line', label: 'Deduction % of revenue', data: dser.map((d, i) => rser[i] ? +(d / rser[i] * 100).toFixed(2) : null), borderColor: '#f28c28', backgroundColor: '#f28c28', yAxisID: 'y1', tension: .25, order: 1, spanGaps: true }] : []) },
      options: { scales: { y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: tick('%') }, display: !!R } }, plugins: { legend: leg, tooltip: rm } } } });
    // 2. share by workshop
    const wsTot = ['WR1', 'WR2', 'WR3'].map(w => [w, per.filter(x => x.h.ws === w).reduce((a, x) => a + x.d, 0)]).filter(x => x[1] > 0);
    if (wsTot.length) out.push({ t: 'Deduction by workshop', cfg: { type: 'doughnut', data: { labels: wsTot.map(x => x[0]), datasets: [{ data: wsTot.map(x => x[1]), backgroundColor: wsTot.map(x => WSC[x[0]]), borderWidth: 0 }] },
      options: { cutout: '55%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: RM ${fmtM(c.raw)} (${pct(c.raw, wsTot.reduce((a, x) => a + x[1], 0))}%)` } } } } } });
    // 3. year on year by calendar month (ignores the Year and Month filters, follows Workshop and Hospital)
    const yoy = years.map((y, n) => ({ label: String(y), backgroundColor: YPAL[n % YPAL.length], data: MON.map((_, mi) => { const m = D.months.find(x => x.y === y && x.m === mi + 1); return m && has(m, cols) ? dOf(m, cols) : null; }) }));
    out.push({ t: 'Deduction by month, year on year', cfg: { type: 'bar', data: { labels: MON, datasets: yoy }, options: { plugins: { legend: leg, tooltip: rm } } } });
    // 4. by hospital, coloured by workshop
    const byH = per.filter(x => x.d > 0).sort((a, b) => b.d - a.d);
    if (byH.length) out.push({ t: 'Deduction by hospital', tall: 1, cfg: { type: 'bar', data: { labels: byH.map(x => x.h.n), datasets: ['WR1', 'WR2', 'WR3'].filter(w => byH.some(x => x.h.ws === w)).map(w => ({ label: w, backgroundColor: WSC[w], data: byH.map(x => x.h.ws === w ? x.d : null) })) },
      options: { indexAxis: 'y', scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: leg, tooltip: rm } } } });
    // 5. deduction % of revenue by hospital
    const byP = per.filter(x => x.r > 0 && x.d > 0).map(x => ({ h: x.h, p: x.d / x.r * 100 })).sort((a, b) => b.p - a.p);
    if (byP.length) out.push({ t: 'Deduction % of revenue by hospital', tall: 1, cfg: { type: 'bar', data: { labels: byP.map(x => x.h.n), datasets: [{ label: 'Deduction % of revenue', data: byP.map(x => +x.p.toFixed(2)), backgroundColor: byP.map(x => WSC[x.h.ws]) }] },
      options: { indexAxis: 'y', scales: { x: { ticks: { callback: tick('%') } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.raw}% (${byP[c.dataIndex].h.ws})` } } } } } });
    $('#kg-' + key).innerHTML = out.map((x, n) => `<div class="panel${x.wide ? ' wide' : ''}"><h2>${esc(x.t)}</h2><div class="cv${x.tall ? ' tall' : ''}"><canvas id="kcv_${key}_${n}"></canvas></div></div>`).join('');
    out.forEach((x, n) => mk(`kcv_${key}_${n}`, x.cfg));
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the hospital charts: ${esc(e.message)}</div>`; }
}

/* ---------- wiring ---------- */
$('#tab-bo-ded').onchange = e => {
  const s = e.target.closest('[data-sf]'), h = e.target.closest('[data-hf]');
  if (s) { ssel[s.dataset.sf] = s.value; renderDedSummary(true); }
  else if (h) { hsel[h.dataset.hf] = h.value; renderDedHospital(h.dataset.hf !== 'ws'); }          // changing the workshop refreshes the hospital list
};
$('#tab-bo-ded').onclick = e => {
  if (e.target.closest('[data-sreset]')) { ssel.year = ''; renderDedSummary(); }
  else if (e.target.closest('[data-hreset]')) { Object.assign(hsel, { ws: '', hospital: '', year: '', month: '' }); renderDedHospital(); }
};
$('#dedSumBtn').onclick = () => showTab('bo-dedS'); $('#dedHospBtn').onclick = () => showTab('bo-dedH');
$('#dedSBack').onclick = () => showTab('bo-ded'); $('#dedHBack').onclick = () => showTab('bo-ded');
