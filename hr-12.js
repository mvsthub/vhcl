/* Business Overview > Human Resource.
   Data: tabs "Manpower Status" (key hstat), "Manpower Turnover" (key hturn) and "Training" (key htrain).
   Uses the shared chart builder of cfs.js. A tab with numbers is totalled and averaged; a tab that is only a list of people or courses is counted.
   Needs kpi.js, cfs.js and script.js. */
AV.hstat = { list: 'auto', noun: 'Records' }; AV.hturn = { list: 'auto', noun: 'Records' }; AV.htrain = { list: 'auto', noun: 'Records' };
const HR_KEYS = ['hstat', 'hturn', 'htrain'];

function renderHr(keepBar) {
  HR_KEYS.forEach(k => autoRender(k, keepBar));
  const a = $('#hrAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}

/* ---------- wiring ---------- */
$('#tab-bo-hr').onchange = e => { const s = e.target.closest('[data-ac]'); if (s) { asel[s.dataset.k][s.dataset.ac] = s.value; autoRender(s.dataset.k, true); } };
$('#tab-bo-hr').onclick = e => { const b = e.target.closest('[data-areset]'); if (b) { asel[b.dataset.areset] = {}; autoRender(b.dataset.areset); } };
$('#hrStBtn').onclick = () => showTab('bo-hrst'); $('#hrToBtn').onclick = () => showTab('bo-hrto'); $('#hrTrBtn').onclick = () => showTab('bo-hrtr');
['St', 'To', 'Tr'].forEach(s => { $('#hr' + s + 'Back').onclick = () => showTab('bo-hr'); });
$('#hrStNew').onclick = () => openKpiEdit('hstat', -1); $('#hrToNew').onclick = () => openKpiEdit('hturn', -1); $('#hrTrNew').onclick = () => openKpiEdit('htrain', -1);
