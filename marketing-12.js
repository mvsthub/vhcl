/* Business Overview > Marketing.
   Data: tab "Marketing Campaign" (key mcamp) and tab "Marketing Planner" (key mplan).
   Uses the same chart builder as the Customer Feedback Survey page (cfs.js: autoRender, asel). Needs kpi.js, cfs.js and script.js. */
function renderMkt(keepBar) {
  autoRender('mcamp', keepBar); autoRender('mplan', keepBar);
  const a = $('#mktAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}

/* ---------- Campaign: ROI scoreboards. Rows such as "Total Spent", "Sales Gained", "Spent Vs Gain %"; one column per year (2025, 2026 ...) ---------- */
const n2 = v => Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
AV.mcamp.dropLabel = t => /\bvs\b|%/i.test(t);        // the "Spent Vs Gain %" row is not drawn in the by-element charts
AV.mcamp.cards = (rs, pl, ds) => {
  const li = pl.label ? pl.label.i : 0, find = re => ds.rows.find(r => re.test(String(r[li] ?? ''))), spent = find(/total\s*spent/i), gain = find(/sales\s*gain/i);
  const years = ds.headers.map((h, i) => ({ h: h.trim(), i })).filter(x => /^20\d\d$/.test(x.h));
  if (!spent || !gain || !years.length) return kcard('ROI', '-', 'rows "Total Spent" and "Sales Gained" with year columns not found', PAL[0]);
  return years.map((y, n) => {
    const s = cellNum(spent[y.i], spent.d[y.i]), g = cellNum(gain[y.i], gain.d[y.i]), roi = s ? (g - s) / s * 100 : null;      // ROI = (sales gained - total spent) / total spent
    return kcard(`${y.h} ROI`, roi === null ? '-' : roi.toFixed(2) + '%', roi === null ? 'no data' : `RM ${n2(g)} gained on RM ${n2(s)} spent`, PAL[n % PAL.length]);
  }).join('');
};

/* ---------- Planner: Status filter, "Most Active Initiative" and "Completed" ---------- */
AV.mplan.filters = pl => pl.cols.filter(c => /status/i.test(c.h));
AV.mplan.moreCards = (rs, pl) => {
  const ini = pl.cols.find(c => /initiative/i.test(c.h)) || pl.label, st = pl.cols.find(c => /status/i.test(c.h));
  let top = null; if (ini) groups(rs, ini).forEach(([name, rr]) => { if (name && (!top || rr.length > top.n)) top = { name, n: rr.length }; });     // the initiative with the most activities
  const done = st ? rs.filter(r => /complet|done|selesai|closed/i.test(String(r[st.i]))).length : null;
  return kcard('Most Active Initiative', top ? top.name : '-', top ? `${top.n} activities` : 'no initiative column found', PAL[3]) + kcard('Completed', done === null ? '-' : done, st ? 'status: completed' : 'no status column found', PAL[2]);
};

/* ---------- wiring ---------- */
$('#tab-bo-mkt').onchange = e => { const s = e.target.closest('[data-ac]'); if (s) { asel[s.dataset.k][s.dataset.ac] = s.value; autoRender(s.dataset.k, true); } };
$('#tab-bo-mkt').onclick = e => { const b = e.target.closest('[data-areset]'); if (b) { asel[b.dataset.areset] = {}; autoRender(b.dataset.areset); } };
$('#mktCampBtn').onclick = () => showTab('bo-mktC'); $('#mktPlanBtn').onclick = () => showTab('bo-mktP');
$('#mktCBack').onclick = () => showTab('bo-mkt'); $('#mktPBack').onclick = () => showTab('bo-mkt');
$('#mktCNew').onclick = () => openKpiEdit('mcamp', -1); $('#mktPNew').onclick = () => openKpiEdit('mplan', -1);
