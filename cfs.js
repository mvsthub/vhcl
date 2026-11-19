/* Business Overview > Customer Feedback Survey.
   Data: tab "CFS Summary" (key csum) and tab "Respondent List-GS" (key cresp).
   Charts and filters are built from the columns found in each tab (text, number, date), so new rows and edits show up right away.
   Needs kpi.js and script.js (KPI, ksel-style helpers: plan, agg, isAvg, fmtN, groups, numv, kcard, kpanel, kclear, optLabel, cmpV, kdisp, PAL, mk, esc, $, pct, isoD, showTab, openKpiEdit). */
const CMON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const asel = { csum: {}, cresp: {}, mcamp: {}, mplan: {} };       // chosen filter values per dataset
const AV = { csum: { list: false }, cresp: { list: true, noun: 'Respondents' }, mcamp: { list: false }, mplan: { list: true, noun: 'Activities' } };   // list = every row is one item to count
const autoRender = (key, keepBar) => {              // list: true / false, or 'auto' = a tab with no numeric columns is a list of items to count, otherwise a table of numbers to total
  const ds = KPI[key], a = AV[key], list = a.list === 'auto' ? !(ds && !ds.error && ds.headers.length && plan(ds).nums.length) : a.list;
  autoView(key, list, keepBar, a.noun);
};

function renderCfs(keepBar) {
  autoRender('csum', keepBar); autoRender('cresp', keepBar);
  const a = $('#cfsAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}
const periodGroups = (rs, pc) => {                   // rows grouped by period: dates by month (in date order), text periods as they appear
  if (pc.type !== 'date') return groups(rs, pc);
  const m = new Map(); rs.forEach(r => { if (isoD(r[pc.i])) { const k = r[pc.i].slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } });
  return [...m.keys()].sort().map(k => [CMON[+k.slice(5) - 1] + ' ' + k.slice(2, 4), m.get(k)]);
};

function autoView(key, isList, keepBar, noun = 'Respondents') {            // isList = true: every row is one respondent, so charts count rows; false: a summary table, so charts total or average the numbers
  const ds = KPI[key], bar = $('#kf-' + key); kclear(key);
  if (!ds || ds.error || !ds.headers.length) {
    bar.innerHTML = `<span class="sub">${esc(ds && ds.error ? ds.error : ds ? 'No data found in this tab yet.' : 'Loading...')}</span>`;
    $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; return;
  }
  try {
    const pl = plan(ds), sel = asel[key] || (asel[key] = {});
    if (!keepBar) {
      const fc = [pl.label && pl.label.distinct <= 40 ? pl.label : null, ...pl.cats, pl.period && pl.period.distinct <= 36 ? pl.period : null].filter((c, i, a) => c && a.indexOf(c) === i);
      bar.innerHTML = fc.map(c => {
        const vals = [...new Set(ds.rows.map(r => r[c.i]).filter(v => v !== '' && v != null).map(String))];
        if (c.type === 'date' || c === pl.period) vals.sort(cmpV); else vals.sort();
        if (sel[c.i] && !vals.includes(sel[c.i])) sel[c.i] = '';
        return `<label>${esc(c.h)} <select data-k="${key}" data-ac="${c.i}"><option value="">All</option>${vals.map(v => `<option value="${esc(v)}"${sel[c.i] === v ? ' selected' : ''}>${esc(optLabel(c, v))}</option>`).join('')}</select></label>`;
      }).join('') + `<button class="btn" data-areset="${key}">Reset</button>`;
    }
    const rs = ds.rows.filter(r => Object.entries(sel).every(([c, v]) => !v || String(r[c]) === v));
    const mean = c => { const v = rs.map(r => numv(r, c)).filter(x => x !== null); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
    const sub = rs.length === ds.rows.length ? 'all rows' : 'of ' + ds.rows.length + ' (filtered)';
    $('#kk-' + key).innerHTML = isList
      ? [kcard(noun, rs.length, sub, PAL[0])].concat(pl.nums.slice(0, 3).map((c, n) => kcard('Avg ' + c.h, fmtN(mean(c), c), rs.length + ' ' + noun.toLowerCase(), PAL[(n + 1) % PAL.length]))).join('')
      : [kcard('Rows', rs.length, sub, PAL[0])].concat(pl.nums.slice(0, 4).map((c, n) => kcard((isAvg(c) ? 'Avg ' : 'Total ') + c.h, fmtN(agg(rs, c), c), rs.length + ' rows', PAL[(n + 1) % PAL.length]))).join('');

    const list = [], leg = { position: 'bottom' }, gl = pl.label ? groups(rs, pl.label) : [];
    const topBy = (gs, fn) => gs.map(x => ({ k: x[0], v: fn(x[1]) })).sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, 12);
    const avgOf = c => rows2 => { const v = rows2.map(r => numv(r, c)).filter(x => x !== null); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
    const donut = (title, cc) => { const g = groups(rs, cc).map(x => [x[0], x[1].length]).sort((a, b) => b[1] - a[1]);
      if (g.length) list.push({ t: title, cfg: { type: 'doughnut', data: { labels: g.map(x => x[0]), datasets: [{ data: g.map(x => x[1]), backgroundColor: g.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] }, options: { cutout: '55%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw} (${pct(c.raw, rs.length)}%)` } } } } } }); };
    if (isList) {
      if (pl.period && rs.length) { const g = periodGroups(rs, pl.period); list.push({ t: `${noun} by ${pl.period.h}`, cfg: { type: 'bar', data: { labels: g.map(x => kdisp(x[0])), datasets: [{ label: noun, backgroundColor: PAL[0], data: g.map(x => x[1].length) }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } } }); }
      pl.cats.slice(0, 2).forEach(cc => donut(`${noun} by ${cc.h}`, cc));
      if (pl.cats[0] && pl.nums[0]) { const cc = pl.cats[0], c = pl.nums[0], t = topBy(groups(rs, cc), avgOf(c)); list.push({ t: `Average ${c.h} by ${cc.h}`, cfg: { type: 'bar', data: { labels: t.map(x => x.k), datasets: [{ label: c.h, backgroundColor: PAL[2], data: t.map(x => x.v) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } } }); }
      const sv = pl.nums[0] ? rs.map(r => numv(r, pl.nums[0])).filter(x => x !== null) : [];   // a spread only makes sense for small scores such as 1-5 ratings
      if (pl.nums[0] && pl.nums[0].distinct <= 10 && sv.length && Math.min(...sv) >= 0 && Math.max(...sv) <= 10) { const c = pl.nums[0], m = new Map(); rs.forEach(r => { const v = numv(r, c); if (v !== null) m.set(v, (m.get(v) || 0) + 1); }); const ks = [...m.keys()].sort((a, b) => a - b);
        if (ks.length) list.push({ t: `Spread of ${c.h}`, cfg: { type: 'bar', data: { labels: ks.map(k => String(k) + (c.pct ? '%' : '')), datasets: [{ label: noun, backgroundColor: PAL[3], data: ks.map(k => m.get(k)) }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } } }); }
    } else {
      if (pl.period && pl.nums.length && rs.length) { const g = periodGroups(rs, pl.period);
        list.push({ t: `Trend by ${pl.period.h}`, cfg: { type: 'line', data: { labels: g.map(x => kdisp(x[0])), datasets: pl.nums.slice(0, 3).map((c, n) => ({ label: c.h, data: g.map(x => agg(x[1], c)), borderColor: PAL[n], backgroundColor: PAL[n], tension: .25, spanGaps: true })) }, options: { plugins: { legend: leg } } } }); }
      if (pl.label && pl.nums.length && gl.length) {
        if (pl.tgt && pl.act) { const t = gl.map(x => ({ k: x[0], a: agg(x[1], pl.act), t: agg(x[1], pl.tgt) })).sort((a, b) => (b.a ?? 0) - (a.a ?? 0)).slice(0, 12);
          list.push({ t: `${pl.act.h} vs ${pl.tgt.h} by ${pl.label.h}`, cfg: { type: 'bar', data: { labels: t.map(x => x.k), datasets: [{ label: pl.act.h, backgroundColor: PAL[0], data: t.map(x => x.a) }, { label: pl.tgt.h, backgroundColor: PAL[1], data: t.map(x => x.t) }] }, options: { plugins: { legend: leg } } } }); }
        else { const c = pl.nums[0], t = topBy(gl, x => agg(x, c)); list.push({ t: `${c.h} by ${pl.label.h}`, cfg: { type: 'bar', data: { labels: t.map(x => x.k), datasets: [{ label: c.h, backgroundColor: PAL[0], data: t.map(x => x.v) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } } }); }
        const c2 = pl.nums.find(x => x !== pl.nums[0] && x !== pl.tgt && x !== pl.act);
        if (c2) { const t = topBy(gl, x => agg(x, c2)); list.push({ t: `${c2.h} by ${pl.label.h}`, cfg: { type: 'bar', data: { labels: t.map(x => x.k), datasets: [{ label: c2.h, backgroundColor: PAL[2], data: t.map(x => x.v) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } } }); }
      }
      pl.cats.slice(0, 2).forEach(cc => donut(`Count by ${cc.h}`, cc));
    }
    const shown = list.slice(0, 5);
    $('#kg-' + key).innerHTML = shown.length ? shown.map((x, n) => kpanel(esc(x.t), `kcv_${key}_${n}`)).join('') : `<div class="panel" style="grid-column:1/-1">Not enough numeric, date or category columns in this tab to draw charts yet.</div>`;
    shown.forEach((x, n) => mk(`kcv_${key}_${n}`, x.cfg));
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the charts: ${esc(e.message)}</div>`; }
}

/* ---------- wiring ---------- */
$('#tab-bo-cfs').onchange = e => { const s = e.target.closest('[data-ac]'); if (s) { asel[s.dataset.k][s.dataset.ac] = s.value; autoRender(s.dataset.k, true); } };
$('#tab-bo-cfs').onclick = e => { const b = e.target.closest('[data-areset]'); if (b) { asel[b.dataset.areset] = {}; autoRender(b.dataset.areset); } };
$('#cfsSumBtn').onclick = () => showTab('bo-cfsS'); $('#cfsRespBtn').onclick = () => showTab('bo-cfsR');
$('#cfsSBack').onclick = () => showTab('bo-cfs'); $('#cfsRBack').onclick = () => showTab('bo-cfs');
$('#cfsSNew').onclick = () => openKpiEdit('csum', -1); $('#cfsRNew').onclick = () => openKpiEdit('cresp', -1);
