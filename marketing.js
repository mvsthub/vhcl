/* Business Overview > Marketing.
   Data: tab "Marketing Campaign" (key mcamp) and tab "Marketing Planner" (key mplan).
   Campaign: rows such as "Total Spent", "Sales Gained", "Spent Vs Gain %" and one column per year (2025, 2026 ... new years appear automatically).
   Planner: uses the shared chart builder of cfs.js (autoRender, asel). Needs kpi.js, cfs.js and script.js. */
const msel = { element: '', year: '' };               // Campaign filters
const isRatioRow = t => /\bvs\b|%/i.test(t);           // the "Spent Vs Gain %" row is not an element to draw or filter
const n2 = v => Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderMkt(keepBar) {
  renderCampaign(keepBar); autoRender('mplan', keepBar);
  const a = $('#mktAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}

/* ---------- Campaign: ROI cards, "Sales Gained Vs Total Spent by Year" and "ROI by Year" ---------- */
function renderCampaign(keepBar) {
  const key = 'mcamp', ds = KPI[key], bar = $('#kf-' + key); kclear(key);
  const msg = t => { bar.innerHTML = `<span class="sub">${esc(t)}</span>`; $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; };
  if (!ds) return msg('Loading...'); if (ds.error) return msg(ds.error); if (!ds.headers.length) return msg('No data found in this tab yet.');
  try {
    const pl = plan(ds), li = pl.label ? pl.label.i : 0;
    const years = ds.headers.map((h, i) => ({ h: String(h).trim(), i })).filter(x => /^20\d\d$/.test(x.h));
    const rowsEl = ds.rows.filter(r => { const t = String(r[li] ?? '').trim(); return t && !isRatioRow(t); });          // elements without the ratio row
    const val = (r, y) => cellNum(r[y.i], r.d ? r.d[y.i] : '');
    const withData = years.filter(y => rowsEl.some(r => val(r, y) !== null));                                         // a new year column shows up as soon as it has data
    if (!withData.length) return msg('No year columns (2025, 2026 ...) with data found in the tab yet.');
    const names = [...new Set(rowsEl.map(r => String(r[li]).trim()))];
    if (msel.element && !names.includes(msel.element)) msel.element = '';
    if (msel.year && !withData.some(y => y.h === msel.year)) msel.year = '';
    if (!keepBar) bar.innerHTML = `<label>Element <select data-me="1"><option value="">All</option>${names.map(e => `<option${e === msel.element ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select></label>` +
      `<label>Year <select data-my="1"><option value="">All years</option>${withData.map(y => `<option${y.h === msel.year ? ' selected' : ''}>${y.h}</option>`).join('')}</select></label><button class="btn" data-mreset="1">Reset</button>`;
    const ys = withData.filter(y => !msel.year || y.h === msel.year);
    const spent = rowsEl.find(r => /total\s*spent/i.test(r[li])), gain = rowsEl.find(r => /sales\s*gain/i.test(r[li]));
    const isRM = rowsEl.some(r => years.some(y => /^\s*RM/i.test(String(r.d ? r.d[y.i] : '')))), money = v => (isRM ? 'RM ' : '') + n2(v);
    const roi = y => { const s = spent ? val(spent, y) : null, g = gain ? val(gain, y) : null; return { s, g, r: s ? (g - s) / s * 100 : null }; };     // ROI = (sales gained - total spent) / total spent

    $('#kk-' + key).innerHTML = spent && gain ? ys.map((y, n) => { const x = roi(y); return kcard(`${y.h} ROI`, x.r === null ? '-' : x.r.toFixed(2) + '%', x.r === null ? 'no data' : `${money(x.g)} gained on ${money(x.s)} spent`, PAL[n % PAL.length]); }).join('')
      : kcard('ROI', '-', 'rows "Total Spent" and "Sales Gained" not found', PAL[0]);

    const picks = msel.element ? rowsEl.filter(r => String(r[li]).trim() === msel.element) : (spent && gain ? [spent, gain] : rowsEl);
    const sets = picks.map((r, n) => ({ label: String(r[li]).trim(), backgroundColor: r === spent ? PAL[1] : r === gain ? PAL[0] : PAL[n % PAL.length], data: ys.map(y => val(r, y)) }));
    const panels = [['Sales Gained Vs Total Spent by Year', { type: 'bar', data: { labels: ys.map(y => y.h), datasets: sets },
      options: { indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { callback: v => (isRM ? 'RM ' : '') + Number(v).toLocaleString('en-MY') } } }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw === null ? '-' : money(c.raw)}` } } } } }]];
    const slices = spent && gain ? ys.map(y => ({ y: y.h, r: roi(y).r })).filter(x => x.r !== null && x.r > 0) : [];
    panels.push(['ROI by Year', slices.length ? { type: 'pie', data: { labels: slices.map(x => x.y), datasets: [{ data: slices.map(x => +x.r.toFixed(2)), backgroundColor: slices.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] },
      options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label} ROI: ${c.raw}%` } } } } } : null]);
    $('#kg-' + key).innerHTML = panels.map((p, n) => p[1] ? kpanel(esc(p[0]), `kcv_${key}_${n}`) : `<div class="panel"><h2>${esc(p[0])}</h2><p class="sub">No positive ROI to show for the selected year(s).</p></div>`).join('');
    panels.forEach((p, n) => { if (p[1]) mk(`kcv_${key}_${n}`, p[1]); });
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the campaign charts: ${esc(e.message)}</div>`; }
}

/* ---------- Planner: Status filter, "Most Active Initiative" and "Completed" ---------- */
AV.mplan.filters = pl => pl.cols.filter(c => /status/i.test(c.h));
AV.mplan.moreCards = (rs, pl) => {
  const ini = pl.cols.find(c => /initiative/i.test(c.h)) || pl.label, st = pl.cols.find(c => /status/i.test(c.h));
  let top = null; if (ini) groups(rs, ini).forEach(([name, rr]) => { if (name && (!top || rr.length > top.n)) top = { name, n: rr.length }; });     // the initiative with the most activities
  const done = st ? rs.filter(r => /complet|done|selesai|closed/i.test(String(r[st.i]))).length : null;
  return kcard('Most Active Initiative', top ? top.name : '-', top ? `${top.n} activities` : 'no initiative column found', PAL[3]) + kcard('Completed', done === null ? '-' : done, st ? 'status: completed' : 'no status column found', PAL[2]);
};

/* ---------- wiring ---------- */
$('#tab-bo-mkt').onchange = e => {
  const s = e.target.closest('[data-ac]'), me = e.target.closest('[data-me]'), my = e.target.closest('[data-my]');
  if (s) { asel[s.dataset.k][s.dataset.ac] = s.value; autoRender(s.dataset.k, true); }
  else if (me) { msel.element = me.value; renderCampaign(true); }
  else if (my) { msel.year = my.value; renderCampaign(true); }
};
$('#tab-bo-mkt').onclick = e => {
  if (e.target.closest('[data-mreset]')) { msel.element = ''; msel.year = ''; renderCampaign(); return; }
  const b = e.target.closest('[data-areset]'); if (b) { asel[b.dataset.areset] = {}; autoRender(b.dataset.areset); }
};
$('#mktCampBtn').onclick = () => showTab('bo-mktC'); $('#mktPlanBtn').onclick = () => showTab('bo-mktP');
$('#mktCBack').onclick = () => showTab('bo-mkt'); $('#mktPBack').onclick = () => showTab('bo-mkt');
$('#mktCNew').onclick = () => openKpiEdit('mcamp', -1); $('#mktPNew').onclick = () => openKpiEdit('mplan', -1);
