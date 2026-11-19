/* Business Overview > Marketing.
   Data: tab "Marketing Campaign" (key mcamp) and tab "Marketing Planner" (key mplan).
   Uses the same chart builder as the Customer Feedback Survey page (cfs.js: autoRender, asel). Needs kpi.js, cfs.js and script.js. */
function renderMkt(keepBar) {
  autoRender('mcamp', keepBar); autoRender('mplan', keepBar);
  const a = $('#mktAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}

/* ---------- wiring ---------- */
$('#tab-bo-mkt').onchange = e => { const s = e.target.closest('[data-ac]'); if (s) { asel[s.dataset.k][s.dataset.ac] = s.value; autoRender(s.dataset.k, true); } };
$('#tab-bo-mkt').onclick = e => { const b = e.target.closest('[data-areset]'); if (b) { asel[b.dataset.areset] = {}; autoRender(b.dataset.areset); } };
$('#mktCampBtn').onclick = () => showTab('bo-mktC'); $('#mktPlanBtn').onclick = () => showTab('bo-mktP');
$('#mktCBack').onclick = () => showTab('bo-mkt'); $('#mktPBack').onclick = () => showTab('bo-mkt');
$('#mktCNew').onclick = () => openKpiEdit('mcamp', -1); $('#mktPNew').onclick = () => openKpiEdit('mplan', -1);
