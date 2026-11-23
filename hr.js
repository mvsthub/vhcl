/* Business Overview > Human Resource. Reads fixed cells of three Google Sheet tabs:

   "Manpower Status" (key hstat): four branch blocks. Senawang rows 3-8 (subtotal row 9), Ayer Keroh rows 10-15 (subtotal 16), Kempas rows 17-22 (subtotal 23), HQ rows 24-29 (subtotal 30).
       Column C = Approved Budget, column E = Current Status, column F = Vacancy. Designation names are in column B.
   "Manpower Turnover" (key hturn): from row 5, one row per month, turnover in column C.
   "Training" (key htrain): the figures are in row 6: B = HRDC Fund YTD, C/D = HRDC/MVSB budget, E/F = HRDC/MVSB utilized, G/H = HRDC/MVSB balance.

   Needs kpi.js, deduction.js (gat, parseMonth), marketing.js (n2) and script.js. */
const HR_BR = [{ name: 'Senawang', from: 3, to: 8, sub: 9 }, { name: 'Ayer Keroh', from: 10, to: 15, sub: 16 }, { name: 'Kempas', from: 17, to: 22, sub: 23 }, { name: 'HQ', from: 24, to: 29, sub: 30 }];
const HR_DES = ['Senior Mechanic', 'Supervisor Mechanic', 'Mechanic', 'Mechanic 2', 'Admin Clerk', 'Store Clerk'];
const HR_DES_HQ = ['Head of Company', 'Manager', 'Executive - Operations', 'Executive - Finance', 'Executive - Human Resource', 'Executive - Marketing'];
const HR_MEAS = [['Approved Budget', 2], ['Current Status', 4], ['Vacancy', 5]];      // sheet columns C, E, F (A = 0)
const hrs = { measure: 4, branch: null };                                              // Manpower Status: chosen measure and clicked branch
const hrt = { year: '' };                                                              // Manpower Turnover: chosen year

function renderHr(keepBar) {
  renderHrStatus(keepBar); renderHrTurnover(keepBar); renderHrTraining();
  const a = $('#hrAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}
const hrMsg = (key, t) => { $('#kf-' + key).innerHTML = `<span class="sub">${esc(t)}</span>`; $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; };

/* ---------- Manpower Status ---------- */
function hrBranches(ds) {
  const g = ds && ds.grid; if (!g) return null;
  const cell = (r, c) => { const x = gat(g, r); return x ? [x[0][c], x[1][c]] : [null, null]; };
  const num = (r, c) => { const [a, b] = cell(r, c), v = cellNum(a, b); return v === null ? 0 : v; };
  const text = (r, c) => { const v = String(cell(r, c)[0] ?? '').trim(); return v && nm(v) === null ? v : ''; };
  const isDes = t => [...HR_DES, ...HR_DES_HQ].some(d => d.toLowerCase() === t.toLowerCase());
  const branches = HR_BR.map((b, bi) => {
    let name = b.name; for (let r = b.from; r <= b.sub; r++) { const t = text(r, 0); if (t && !isDes(t) && !/sub\s*total|^total/i.test(t)) { name = t; break; } }   // branch name from column A when it is there
    const defs = bi === 3 ? HR_DES_HQ : HR_DES;
    return { name, sub: b.sub, des: defs.map((d, n) => ({ name: text(b.from + n, 1) || d, row: b.from + n })) };
  });
  return { branches, num };
}
function renderHrStatus(keepBar) {
  const key = 'hstat', ds = KPI[key], bar = $('#kf-' + key); kclear(key);
  if (!ds) return hrMsg(key, 'Loading...'); if (ds.error) return hrMsg(key, ds.error);
  const M = hrBranches(ds); if (!M) return hrMsg(key, 'No data found in this tab yet.');
  const B = M.branches, num = M.num;
  try {
    if (!HR_MEAS.some(m => m[1] === hrs.measure)) hrs.measure = 4;
    if (!keepBar) bar.innerHTML = `<label>Measure <select data-hm="1">${HR_MEAS.map(([n, c]) => `<option value="${c}"${c === hrs.measure ? ' selected' : ''}>${n}</option>`).join('')}</select></label><button class="btn" data-hreset="status">Reset</button>`;
    const tot = c => B.reduce((a, b) => a + num(b.sub, c), 0);                       // sum of the four subtotal rows (9, 16, 23, 30)
    $('#kk-' + key).innerHTML = kcard('Total Approved Budget', fmtM(tot(2)), 'subtotals of the 4 branches', PAL[0]) + kcard('Total Current Status', fmtM(tot(4)), 'subtotals of the 4 branches', PAL[2]) + kcard('Total Vacancy', fmtM(tot(5)), 'subtotals of the 4 branches', PAL[4]);
    const mName = HR_MEAS.find(m => m[1] === hrs.measure)[0], slices = B.map(b => ({ name: b.name, v: num(b.sub, hrs.measure), b })).filter(x => x.v > 0), total = slices.reduce((a, x) => a + x.v, 0);
    const share = (v, t) => `${fmtM(v)} (${t ? pct(v, t) : 0}%)`;
    $('#kg-' + key).innerHTML = `<div class="panel wide"><h2>Current Status vs Approved Budget by Branch</h2><div class="cv"><canvas id="kcv_hstat_0"></canvas></div></div>` +
      (slices.length ? `<div class="panel"><h2>Share by Branch: ${esc(mName)} <span style="font-weight:400;color:var(--mute)">(click a slice)</span></h2><div class="cv"><canvas id="kcv_hstat_1"></canvas></div></div><div class="panel"><h2 id="hrsubt"></h2><div class="cv"><canvas id="kcv_hstat_2"></canvas></div></div>`
        : `<div class="panel" style="grid-column:1/-1"><h2>Share by Branch: ${esc(mName)}</h2><p class="sub">No positive ${esc(mName)} values in the four subtotal rows.</p></div>`);
    mk('kcv_hstat_0', { type: 'bar', data: { labels: B.map(b => b.name), datasets: [{ label: 'Current Status', backgroundColor: PAL[2], data: B.map(b => num(b.sub, 4)) }, { label: 'Approved Budget', backgroundColor: PAL[0], data: B.map(b => num(b.sub, 2)) }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } } });
    if (!slices.length) return;
    const drawSub = () => {
      const s = slices.find(x => x.name === hrs.branch) || slices[0]; hrs.branch = s.name;
      const parts = s.b.des.map(d => ({ name: d.name, v: num(d.row, hrs.measure) })).filter(x => x.v > 0), t = parts.reduce((a, x) => a + x.v, 0);
      $('#hrsubt').textContent = `${s.name} by Designation (${mName})`;
      if (!parts.length) { charts.kcv_hstat_2 && charts.kcv_hstat_2.destroy(); return; }
      mk('kcv_hstat_2', { type: 'pie', data: { labels: parts.map(x => x.name), datasets: [{ data: parts.map(x => x.v), backgroundColor: parts.map((_, n) => PAL[(n + 2) % PAL.length]), borderWidth: 0 }] },
        options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${share(c.raw, t)}` } } } } });
    };
    mk('kcv_hstat_1', { type: 'pie', data: { labels: slices.map(x => x.name), datasets: [{ data: slices.map(x => x.v), backgroundColor: slices.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] },
      options: { onClick: (e, els) => { if (els.length) { hrs.branch = slices[els[0].index].name; drawSub(); } }, onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${share(c.raw, total)}` } } } } });
    drawSub();
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the charts: ${esc(e.message)}</div>`; }
}

/* ---------- Manpower Turnover ---------- */
function turnRows(ds) {
  const g = ds && ds.grid; if (!g) return null;
  const rows = [];
  for (let r = 5; r < g.first + g.raw.length; r++) {                                  // from row 5 onward
    const x = gat(g, r); if (!x) continue;
    let pm = null; for (let c = 0; c < 2 && !pm; c++) pm = parseMonth(x[0][c], x[1][c]);        // the month is in column A (or B)
    const v = cellNum(x[0][2], x[1][2]);                                              // turnover is in column C
    if (pm && v !== null) rows.push({ y: pm.y, m: pm.m, v });
  }
  return rows.sort((a, b) => a.y * 100 + a.m - (b.y * 100 + b.m));
}
function renderHrTurnover(keepBar) {
  const key = 'hturn', ds = KPI[key], bar = $('#kf-' + key); kclear(key);
  if (!ds) return hrMsg(key, 'Loading...'); if (ds.error) return hrMsg(key, ds.error);
  try {
    const all = turnRows(ds); if (!all || !all.length) return hrMsg(key, 'No month rows with a turnover number found from row 5 of the tab yet.');
    const years = [...new Set(all.map(r => r.y))].sort();                             // a new year appears as soon as it has data
    if (hrt.year && !years.includes(+hrt.year)) hrt.year = '';
    if (!keepBar) bar.innerHTML = `<label>YEAR <select data-hy="1"><option value="">All years</option>${years.map(y => `<option${String(y) === hrt.year ? ' selected' : ''}>${y}</option>`).join('')}</select></label><button class="btn" data-hreset="turn">Reset</button>`;
    const rs = all.filter(r => !hrt.year || r.y === +hrt.year), total = rs.reduce((a, r) => a + r.v, 0), best = rs.reduce((b, r) => !b || r.v > b.v ? r : b, null);
    $('#kk-' + key).innerHTML = kcard('Total Turnover', fmtM(total), `${rs.length} months`, PAL[4]) + kcard('Highest Month Turnover', best ? String(best.m).padStart(2, '0') + '-' + String(best.y).slice(2) : '-', best ? `turnover ${fmtM(best.v)}` : '', PAL[1]);
    const byYear = years.map(y => all.filter(r => r.y === y).reduce((a, r) => a + r.v, 0));
    $('#kg-' + key).innerHTML = kpanel('Turnover by Month', 'kcv_hturn_0') + kpanel('Turnover by Year', 'kcv_hturn_1');
    mk('kcv_hturn_0', { type: 'bar', data: { labels: rs.map(r => CMON[r.m - 1] + '-' + String(r.y).slice(2)), datasets: [{ label: 'Turnover', backgroundColor: PAL[4], data: rs.map(r => r.v) }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } });
    mk('kcv_hturn_1', { type: 'bar', data: { labels: years.map(String), datasets: [{ label: 'Turnover', backgroundColor: PAL[1], data: byYear }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } });   // all years, whatever the YEAR filter says
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the charts: ${esc(e.message)}</div>`; }
}

/* ---------- Training: figures in row 6 ---------- */
function renderHrTraining() {
  const key = 'htrain', ds = KPI[key]; kclear(key); $('#kf-' + key).style.display = 'none';       // no filter needed here
  const msg = t => { $('#kk-' + key).innerHTML = ''; $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">${esc(t)}</div>`; };
  if (!ds) return msg('Loading...'); if (ds.error) return msg(ds.error);
  try {
    const x = ds.grid && gat(ds.grid, 6); if (!x) return msg('Row 6 of the "Training" tab was not found.');
    const v = c => cellNum(x[0][c], x[1][c]), rm = [1, 2, 3, 4, 5, 6, 7].some(c => /^\s*RM/i.test(String(x[1][c]))), money = n => n === null ? '-' : (rm ? 'RM ' : '') + n2(n), add = (a, b) => (a ?? 0) + (b ?? 0);
    $('#kk-' + key).innerHTML = kcard('HRDC Fund YTD Jan', money(v(1)), 'cell B6', PAL[0]) + kcard('Total Budget', money(add(v(2), v(3))), 'HRDC (C6) + MVSB (D6)', PAL[1]) + kcard('Total Utilized', money(add(v(4), v(5))), 'HRDC (E6) + MVSB (F6)', PAL[2]) + kcard('Total Balance', money(add(v(6), v(7))), 'HRDC (G6) + MVSB (H6)', PAL[3]);
    const pies = [['HRDC Budget Utilization', v(4), v(2), 'kcv_htrain_0'], ['MVSB Budget Utilization', v(5), v(3), 'kcv_htrain_1']];
    $('#kg-' + key).innerHTML = pies.map(p => p[2] ? kpanel(esc(p[0]), p[3]) : `<div class="panel"><h2>${esc(p[0])}</h2><p class="sub">No budget amount found.</p></div>`).join('');
    pies.forEach(([title, used, budget, id]) => {
      if (!budget) return;
      const u = Math.max(used ?? 0, 0), rest = Math.max(budget - u, 0);
      mk(id, { type: 'pie', data: { labels: ['Utilized', 'Remaining'], datasets: [{ data: [u, rest], backgroundColor: [PAL[1], PAL[2]], borderWidth: 0 }] },
        options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${money(c.raw)} (${pct(c.raw, budget)}% of budget)` } } } } });
    });
  } catch (e) { msg('Could not draw the training charts: ' + e.message); }
}

/* ---------- wiring ---------- */
$('#tab-bo-hr').onchange = e => {
  const m = e.target.closest('[data-hm]'), y = e.target.closest('[data-hy]');
  if (m) { hrs.measure = +m.value; renderHrStatus(true); } else if (y) { hrt.year = y.value; renderHrTurnover(true); }
};
$('#tab-bo-hr').onclick = e => {
  const b = e.target.closest('[data-hreset]'); if (!b) return;
  if (b.dataset.hreset === 'status') { hrs.measure = 4; hrs.branch = null; renderHrStatus(); } else { hrt.year = ''; renderHrTurnover(); }
};
$('#hrStBtn').onclick = () => showTab('bo-hrst'); $('#hrToBtn').onclick = () => showTab('bo-hrto'); $('#hrTrBtn').onclick = () => showTab('bo-hrtr');
['St', 'To', 'Tr'].forEach(s => { $('#hr' + s + 'Back').onclick = () => showTab('bo-hr'); });
$('#hrStNew').onclick = () => openKpiEdit('hstat', -1); $('#hrToNew').onclick = () => openKpiEdit('hturn', -1); $('#hrTrNew').onclick = () => openKpiEdit('htrain', -1);
