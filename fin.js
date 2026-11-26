/* Business Overview > Finance and Budget.
   Finance dashboard: tab "P&L Overview" (key fov). Ten pages with a live embed of the tabs P&L Overview, P&L - Project Type, P&L - Total Company by Service, P&L - WR1, WR2, WR3, HQ, Balance Sheet, Cashflow, Trade Receivable and Payable (each with an Edit link to Google Sheets).
   Budget dashboard: tab "Budget" (key bud), built with the shared chart builder of cfs.js.
   The P&L is read as a table with one row per line item (revenue, cost of sales, gross profit, expenses, PBT ...) and one column per month, plus optional Total / YTD / Budget columns.
   Needs kpi.js, cfs.js and script.js. */
AV.bud = { list: 'auto', noun: 'Records' };
const FIN_PG = [['fov', 'bo-finov'], ['fpt', 'bo-finpt'], ['fsv', 'bo-finsv'], ['fw1', 'bo-finw1'], ['fw2', 'bo-finw2'], ['fw3', 'bo-finw3'], ['fhq', 'bo-finhq'], ['fbs', 'bo-finbs'], ['fcf', 'bo-fincf'], ['ftr', 'bo-fintr']];
/* The ten Finance pages show the live Google Sheet tab (published view) and the Edit button opens the same tab in Google Sheets.
   Change a sheet number here if a tab is ever replaced (the gid is the number after "gid=" in the sheet's address). */
const FIN_EDIT = 'https://docs.google.com/spreadsheets/d/1MdWEGwB8wx9_zfghU1DBhtDow7_oyx6YG12Eir3K0xc/edit?pli=1&gid=';
const FIN_EMBED = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmpmlW4pm_HNZdHapb2sC3zJqW8WEOnYiM3E4QgcEE0lTL-gthyeTjNN7XLliRNltYLAdQ06pCopwA/pubhtml?gid=';
const FIN_GID = { fov: '1819352796', fpt: '1348841219', fsv: '405273376', fw1: '982697617', fw2: '1083725569', fw3: '821157382', fhq: '1028006475', fbs: '1939214308', fcf: '1815837560', ftr: '2092759729' };
function finOpen(t) {                                // load a page's embed the first time it is opened
  const hit = FIN_PG.find(p => p[1] === t); if (!hit) return;
  const fr = $('#finFrame_' + hit[0]); if (!fr.src) fr.src = FIN_EMBED + FIN_GID[hit[0]] + '&single=true&widget=true&headers=false';
}
const fsel = { item: '', period: '' };               // Finance filters
const SUMCOL = /total|ytd|budget|forecast|variance|\bvar\b|%|\bfy\b|target|average|avg/i;      // columns that are not a single month

function renderFin(keepBar) {
  renderFinance(keepBar);
  const a = $('#finAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}
function renderBud(keepBar) {
  autoRender('bud', keepBar);
  const a = $('#budAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}

/* ---------- Finance: P&L Overview ---------- */
function plModel(ds) {
  if (!ds || ds.error || !ds.headers.length) return null;
  const an = analyse(ds), lab = an.find(c => c.type === 'text'); if (!lab) return null;
  const nums = an.filter(c => c.type === 'num' && c !== lab), sums = nums.filter(c => SUMCOL.test(c.h)), periods = nums.filter(c => !SUMCOL.test(c.h));
  const val = (x, c) => cellNum(x.r[c.i], x.r.d ? x.r.d[c.i] : '');
  const items = ds.rows.map(r => ({ name: String(r[lab.i] ?? '').trim(), r })).filter(x => x.name && nums.some(c => val(x, c) !== null));
  const totCol = sums.find(c => /total|ytd|\bfy\b/i.test(c.h)) || null;
  const total = x => totCol && val(x, totCol) !== null ? val(x, totCol) : periods.reduce((a, c) => a + (val(x, c) ?? 0), 0);
  const find = re => items.find(x => re.test(x.name));
  const rev = find(/^(total\s+)?(revenue|sales|income|turnover)\b/i), gp = find(/gross\s*profit/i);
  const pbt = find(/profit\s*before\s*tax|^pbt\b|net\s*profit|profit\s*after\s*tax/i) || [...items].reverse().find(x => /profit/i.test(x.name) && x !== gp);
  const costs = items.filter(x => x !== rev && x !== gp && x !== pbt && /cost|expense|overhead|salar|rent|deprec|utilit|repair|staff|insurance/i.test(x.name) && !/^total/i.test(x.name));
  return { items, periods, sums, totCol, val, total, rev, gp, pbt, costs, lab };
}
function renderFinance(keepBar) {
  const key = 'fov', ds = KPI[key], bar = $('#kf-' + key); kclear(key);
  const msg = t => { bar.innerHTML = `<span class="sub">${esc(t)}</span>`; $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; };
  if (!ds) return msg('Loading...'); if (ds.error) return msg(ds.error);
  try {
    const P = plModel(ds); if (!P || !P.items.length) return msg('No profit and loss rows with numbers found in the "P&L Overview" tab yet.');
    if (fsel.item && !P.items.some(x => x.name === fsel.item)) fsel.item = '';
    if (fsel.period && !P.periods.some(c => c.h === fsel.period)) fsel.period = '';
    if (!keepBar) bar.innerHTML = `<label>Line item <select data-fi="1"><option value="">Key lines (revenue, gross profit, PBT)</option>${P.items.map(x => `<option${x.name === fsel.item ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` +
      `<label>Period <select data-fp="1"><option value="">All (total)</option>${P.periods.map(c => `<option${c.h === fsel.period ? ' selected' : ''}>${esc(c.h)}</option>`).join('')}</select></label><button class="btn" data-freset="1">Reset</button>`;
    const pc = fsel.period ? P.periods.find(c => c.h === fsel.period) : null, at = x => x ? (pc ? (P.val(x, pc) ?? 0) : P.total(x)) : null;      // value of a line for the chosen period, or its total
    const f2 = v => v === null ? '-' : fmtM(+v.toFixed(2)), r = at(P.rev), g = at(P.gp), p = at(P.pbt);
    $('#kk-' + key).innerHTML = (P.rev ? kcard(P.rev.name, f2(r), fsel.period || 'total', PAL[0]) : '') + (P.gp ? kcard(P.gp.name, f2(g), r ? `${(g / r * 100).toFixed(1)}% of revenue` : (fsel.period || 'total'), PAL[2]) : '') +
      (P.pbt ? kcard(P.pbt.name, f2(p), r ? `${(p / r * 100).toFixed(1)}% of revenue` : (fsel.period || 'total'), p < 0 ? '#e5484d' : PAL[3]) : '') +
      `<div class="sub" style="grid-column:1/-1;flex:0 0 100%">Data check: revenue row = ${P.rev ? '"' + esc(P.rev.name) + '"' : 'not found'}; gross profit row = ${P.gp ? '"' + esc(P.gp.name) + '"' : 'not found'}; profit row = ${P.pbt ? '"' + esc(P.pbt.name) + '"' : 'not found'}; ${P.periods.length} period columns${P.totCol ? ', total from "' + esc(P.totCol.h) + '"' : ', totals added up from the periods'}.</div>`;
    const out = [], leg = { position: 'bottom' }, L = P.periods.map(c => c.h);
    const line = (x, n) => ({ label: x.name, data: P.periods.map(c => P.val(x, c)), borderColor: PAL[n % PAL.length], backgroundColor: PAL[n % PAL.length], tension: .25, spanGaps: true });
    if (L.length > 1) {
      const sel = fsel.item ? [P.items.find(x => x.name === fsel.item)] : [P.rev, P.gp, P.pbt].filter(Boolean), pick = sel.length ? sel : P.items.slice(0, 3);
      out.push({ t: fsel.item ? `${fsel.item} by month` : 'Revenue, gross profit and PBT by month', cfg: { type: 'line', data: { labels: L, datasets: pick.map(line) }, options: { plugins: { legend: leg } } } });
      if (P.rev && (P.gp || P.pbt)) out.push({ t: 'Margins by month (% of revenue)', cfg: { type: 'line', data: { labels: L, datasets: [P.gp, P.pbt].filter(Boolean).map((x, n) => ({ label: x.name + ' %', data: P.periods.map(c => { const rv = P.val(P.rev, c); return rv ? +((P.val(x, c) ?? 0) / rv * 100).toFixed(2) : null; }), borderColor: PAL[n + 2], backgroundColor: PAL[n + 2], tension: .25, spanGaps: true })) }, options: { scales: { y: { ticks: { callback: v => v + '%' } } }, plugins: { legend: leg } } } });
    }
    const cs = P.costs.map(x => ({ n: x.name, v: Math.abs(at(x) ?? 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 12);
    if (cs.length) {
      out.push({ t: `Cost and expense lines (${fsel.period || 'total'})`, cfg: { type: 'bar', data: { labels: cs.map(x => x.n), datasets: [{ label: 'Amount', backgroundColor: PAL[4], data: cs.map(x => x.v) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } } });
      const tot = cs.reduce((a, x) => a + x.v, 0);
      out.push({ t: `Share of costs (${fsel.period || 'total'})`, cfg: { type: 'doughnut', data: { labels: cs.map(x => x.n), datasets: [{ data: cs.map(x => x.v), backgroundColor: cs.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] }, options: { cutout: '55%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtM(c.raw)} (${pct(c.raw, tot)}%)` } } } } } });
    }
    $('#kg-' + key).innerHTML = out.length ? out.map((x, n) => kpanel(esc(x.t), `kcv_${key}_${n}`)).join('') : `<div class="panel" style="grid-column:1/-1">Not enough month columns or cost lines in this tab to draw charts yet.</div>`;
    out.forEach((x, n) => mk(`kcv_${key}_${n}`, x.cfg));
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the finance charts: ${esc(e.message)}</div>`; }
}

/* ---------- wiring ---------- */
$('#tab-bo-fin').onchange = e => {
  const i = e.target.closest('[data-fi]'), p = e.target.closest('[data-fp]');
  if (i) { fsel.item = i.value; renderFinance(true); } else if (p) { fsel.period = p.value; renderFinance(true); }
};
$('#tab-bo-fin').onclick = e => { if (e.target.closest('[data-freset]')) { fsel.item = ''; fsel.period = ''; renderFinance(); } };
FIN_PG.forEach(([k, pg]) => { $('#finBtn_' + k).onclick = () => showTab(pg); $('#finBack_' + k).onclick = () => showTab('bo-fin'); $('#finEdit_' + k).href = FIN_EDIT + FIN_GID[k] + '#gid=' + FIN_GID[k]; });

$('#tab-bo-bud').onchange = e => { const s = e.target.closest('[data-ac]'); if (s) { asel[s.dataset.k][s.dataset.ac] = s.value; autoRender(s.dataset.k, true); } };
$('#tab-bo-bud').onclick = e => { const b = e.target.closest('[data-areset]'); if (b) { asel[b.dataset.areset] = {}; autoRender(b.dataset.areset); } };
$('#budInfoBtn').onclick = () => showTab('bo-budT'); $('#budBack').onclick = () => showTab('bo-bud');
$('#budNew').onclick = $('#budNewT').onclick = () => openKpiEdit('bud', -1);
