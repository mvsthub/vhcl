/* Business Overview > Customer Feedback Survey, plus the chart builder (autoView) that the Marketing and Human Resource pages also use.

   CFS Summary tab (key csum): years in row 4 (2024 in column B, 2025 in C, 2026 in D, 2027 in E ... added automatically when data appears),
     CFS percentage in row 9, target in row 10, and rows labelled "attained score" and "maximum score" (found by their label in column A).
   Respondent List-GS tab (key cresp): one row per respondent. Timestamp column, Total Score in column I, Workshop in column K.

   Needs kpi.js and script.js (KPI, plan, agg, isAvg, fmtN, groups, nk, numv, nm, cellNum, kcard, kpanel, kclear, optLabel, cmpV, kdisp, fmtM, PAL, mk, esc, $, pct, isoD, showTab, openKpiEdit). */
const CMON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const asel = { csum: {}, cresp: {}, mcamp: {}, mplan: {} };       // chosen filter values per dataset
const AV = { cresp: { list: true, noun: 'Respondents' }, mcamp: { list: false }, mplan: { list: true, noun: 'Activities' } };   // list = every row is one item to count
const autoRender = (key, keepBar) => {              // list: true / false, or 'auto' = a tab with no numeric columns is a list of items to count, otherwise a table of numbers to total
  const ds = KPI[key], a = AV[key], list = a.list === 'auto' ? !(ds && !ds.error && ds.headers.length && plan(ds).nums.length) : a.list;
  autoView(key, list, keepBar, a.noun);
};
let cfsYear = '';                                    // Summary filter

function renderCfs(keepBar) {
  renderCfsSummary(keepBar); autoRender('cresp', keepBar);
  const a = $('#cfsAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}
const periodGroups = (rs, pc) => {                   // rows grouped by period: dates by month (in date order), text periods as they appear
  if (pc.type !== 'date') return groups(rs, pc);
  const m = new Map(); rs.forEach(r => { if (isoD(r[pc.i])) { const k = r[pc.i].slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } });
  return [...m.keys()].sort().map(k => [CMON[+k.slice(5) - 1] + ' ' + k.slice(2, 4), m.get(k)]);
};
const monthLabel = ym => CMON[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4);

/* ---------- Summary: CFS percentage and scores by year ---------- */
function cfsSumData(ds) {
  const g = ds && ds.grid; if (!g) return null;
  const at = r => r >= g.first && r - g.first < g.raw.length ? [g.raw[r - g.first], g.disp[r - g.first]] : null;
  const yr = at(4), years = [];
  if (yr) for (let c = 1; c < yr[0].length; c++) { const m = String(yr[1][c] || yr[0][c] || '').match(/^\s*(20\d\d)\s*$/); if (m) years.push({ year: m[1], c }); }
  const labels = []; for (let r = 1; r <= 20; r++) { const x = at(r); labels.push([r, x ? String(x[1][0] || x[0][0] || '').trim() : '']); }
  const find = re => { const f = labels.find(([r, t]) => r !== 4 && r !== 9 && r !== 10 && re.test(t)); return f ? f[0] : null; };
  const rAtt = find(/attain|obtain|achiev|actual/i), rMax = find(/maxim|full mark|possible|max\b/i), val = (r, c) => { const x = r === null ? null : at(r); return x ? cellNum(x[0][c], x[1][c]) : null; };
  const rows = years.map(y => ({ year: y.year, pct: val(9, y.c), target: val(10, y.c), att: val(rAtt, y.c), max: val(rMax, y.c) })).filter(y => y.pct !== null || y.att !== null);   // only years that have data
  return { rows, rAtt, rMax, labels: labels.filter(l => l[1]).map(l => `row ${l[0]}: ${l[1]}`) };
}
function renderCfsSummary(keepBar) {
  const key = 'csum', ds = KPI[key], bar = $('#kf-' + key); kclear(key);
  const msg = t => { bar.innerHTML = `<span class="sub">${esc(t)}</span>`; $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; };
  if (!ds) return msg('Loading...'); if (ds.error) return msg(ds.error);
  try {
    const S = cfsSumData(ds); if (!S || !S.rows.length) return msg('No years with data found in row 4 (columns B onward) of the "CFS Summary" tab yet.');
    if (cfsYear && !S.rows.some(y => y.year === cfsYear)) cfsYear = '';
    if (!keepBar) bar.innerHTML = `<label>Year <select data-cy="1"><option value="">All years</option>${S.rows.map(y => `<option${y.year === cfsYear ? ' selected' : ''}>${y.year}</option>`).join('')}</select></label><button class="btn" data-areset="csum">Reset</button>`;
    const ys = S.rows.filter(y => !cfsYear || y.year === cfsYear), best = (k) => ys.filter(y => y[k] !== null).sort((a, b) => b[k] - a[k])[0];
    const pcts = ys.map(y => y.pct).filter(v => v !== null), bp = best('pct'), ba = best('att');
    const f2 = v => fmtM(+v.toFixed(2));
    $('#kk-' + key).innerHTML = kcard('Best CFS Year', bp ? bp.year : '-', bp ? f2(bp.pct) + '%' : '', PAL[2]) + kcard('Best CFS Percentage', bp ? f2(bp.pct) + '%' : '-', bp ? 'year ' + bp.year : '', PAL[0]) +
      kcard('Best Attained Score', ba ? f2(ba.att) : '-', ba ? 'year ' + ba.year + (ba.max !== null ? ' (maximum ' + f2(ba.max) + ')' : '') : (S.rAtt === null ? 'row not found' : ''), PAL[1]) +
      kcard('Average CFS Percentage', pcts.length ? f2(pcts.reduce((a, b) => a + b, 0) / pcts.length) + '%' : '-', `${pcts.length} year(s)`, PAL[3]) +
      `<div class="sub" style="grid-column:1/-1;flex:0 0 100%">Data check: years from row 4, percentage from row 9, target from row 10, attained score from ${S.rAtt === null ? 'NOT FOUND' : 'row ' + S.rAtt}, maximum score from ${S.rMax === null ? 'NOT FOUND' : 'row ' + S.rMax}${S.rAtt === null || S.rMax === null ? '. Column A labels seen: ' + esc(S.labels.join('; ')) : ''}.</div>`;
    const L = ys.map(y => y.year), tg = ys.map(y => y.target), tgt = tg.find(v => v !== null), panels = [];
    panels.push([`CFS percentage by year${tgt !== undefined ? ' (target ' + f2(tgt) + '%)' : ''}`, { type: 'bar', data: { labels: L, datasets: [{ label: 'CFS percentage', data: ys.map(y => y.pct), backgroundColor: PAL[0] }, { type: 'line', label: 'Target', data: tg, borderColor: '#e5484d', backgroundColor: '#e5484d', borderDash: [6, 4], pointRadius: 0, borderWidth: 2 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%' } } }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw === null ? '-' : c.raw + '%'}` } } } } }]);
    if (S.rAtt !== null || S.rMax !== null) panels.push(['Attained score vs maximum score by year', { type: 'bar', data: { labels: L, datasets: [{ label: 'Attained score', data: ys.map(y => y.att), backgroundColor: PAL[0] }, { label: 'Maximum score', data: ys.map(y => y.max), backgroundColor: PAL[1] }] }, options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } } }]);
    $('#kg-' + key).innerHTML = panels.map((p, n) => kpanel(esc(p[0]), `kcv_${key}_${n}`)).join('');
    panels.forEach((p, n) => mk(`kcv_${key}_${n}`, p[1]));
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the summary charts: ${esc(e.message)}</div>`; }
}

/* ---------- Respondent List: cards and extra charts ---------- */
const respCols = (ds, pl) => ({                      // Total Score = column I, Workshop = column K, date = the Timestamp column
  si: ds.headers[8] !== undefined ? 8 : ds.headers.findIndex(h => /score/i.test(h)),
  wi: ds.headers[10] !== undefined ? 10 : ds.headers.findIndex(h => /workshop/i.test(h)),
  dc: pl.cols.find(c => c.type === 'date')
});
AV.cresp.skip = ['avg', 'spread'];                   // no "average by category" or "spread" charts here
AV.cresp.cards = (rs, pl, ds, sub) => {
  const { si, dc } = respCols(ds, pl), v = si >= 0 ? rs.map(r => nm(r[si])).filter(x => x !== null) : [], avg = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  let best = null; if (dc && si >= 0) periodGroups(rs, dc).forEach(([m, rr]) => { const t = rr.reduce((a, r) => a + (nm(r[si]) ?? 0), 0); if (!best || t > best.t) best = { m, t }; });
  return kcard('Respondents', rs.length, sub, PAL[0]) + kcard('AVG Score', avg === null ? '-' : fmtM(+avg.toFixed(2)), si >= 0 ? 'column ' + String.fromCharCode(65 + si) : 'score column not found', PAL[1]) +
    kcard('Best Month', best ? best.m : '-', best ? 'total score ' + fmtM(+best.t.toFixed(2)) : '', PAL[2]);
};
AV.cresp.extra = (rs, pl, list, ds) => {
  const { si, wi, dc } = respCols(ds, pl); if (!dc || !rs.length) return;
  const g = periodGroups(rs, dc), labels = g.map(x => x[0]);
  if (si >= 0) {
    const tot = g.map(x => +x[1].reduce((a, r) => a + (nm(r[si]) ?? 0), 0).toFixed(2)), top = Math.max(...tot);
    list.push({ t: 'Total Score by Month', cfg: { type: 'bar', data: { labels, datasets: [{ label: 'Total Score', data: tot, backgroundColor: tot.map(v => v === top ? PAL[2] : PAL[0]) }] }, options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } } });
  }
  if (wi >= 0) {
    const w = new Map(); rs.forEach(r => { const k = nk(r[wi]); if (k && !w.has(k)) w.set(k, String(r[wi]).trim().replace(/\s+/g, ' ')); });
    const sets = [...w.entries()].map(([k, name]) => ({ label: name, data: g.map(x => x[1].filter(r => nk(r[wi]) === k).length), n: rs.filter(r => nk(r[wi]) === k).length })).sort((a, b) => b.n - a.n)
      .map((s, n) => ({ label: s.label, data: s.data, backgroundColor: PAL[n % PAL.length] }));
    list.push({ t: 'Workshop by Month', cfg: { type: 'bar', data: { labels, datasets: sets }, options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } } } });
  }
};

/* ---------- the chart builder (also used by Marketing and Human Resource) ---------- */
function autoView(key, isList, keepBar, noun = 'Respondents') {   // isList = true: every row is one item, so charts count rows; false: a table of numbers, so charts total or average them
  const ds = KPI[key], bar = $('#kf-' + key), cfg = AV[key] || {}; kclear(key);
  if (!ds || ds.error || !ds.headers.length) {
    bar.innerHTML = `<span class="sub">${esc(ds && ds.error ? ds.error : ds ? 'No data found in this tab yet.' : 'Loading...')}</span>`;
    $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; return;
  }
  try {
    const pl = plan(ds), sel = asel[key] || (asel[key] = {});
    if (!keepBar) {
      const fc = [pl.label && pl.label.distinct <= 40 ? pl.label : null, ...pl.cats, pl.period && pl.period.distinct <= 36 ? pl.period : null].filter((c, i, a) => c && a.indexOf(c) === i);
      bar.innerHTML = fc.map(c => {
        let opts;                                    // [value, label]
        if (c.type === 'date') opts = [...new Set(ds.rows.map(r => r[c.i]).filter(isoD).map(v => v.slice(0, 7)))].sort().map(m => [m, monthLabel(m)]);   // dates are filtered by month
        else { const seen = new Map(); ds.rows.forEach(r => { const v = r[c.i]; if (v === '' || v == null) return; const k = nk(v); if (!seen.has(k)) seen.set(k, String(v).trim().replace(/\s+/g, ' ')); }); opts = [...seen.entries()].sort((a, b) => cmpV(a[1], b[1])); }
        if (sel[c.i] && !opts.some(o => o[0] === sel[c.i])) sel[c.i] = '';
        return `<label>${esc(c.h)} <select data-k="${key}" data-ac="${c.i}"><option value="">All</option>${opts.map(([v, t]) => `<option value="${esc(v)}"${sel[c.i] === v ? ' selected' : ''}>${esc(c.type === 'date' ? t : optLabel(c, t))}</option>`).join('')}</select></label>`;
      }).join('') + `<button class="btn" data-areset="${key}">Reset</button>`;
    }
    const rs = ds.rows.filter(r => Object.entries(sel).every(([ci, v]) => !v || (pl.cols[+ci].type === 'date' ? String(r[ci]).slice(0, 7) === v : nk(r[ci]) === v)));
    const mean = c => { const v = rs.map(r => numv(r, c)).filter(x => x !== null); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
    const sub = rs.length === ds.rows.length ? 'all rows' : 'of ' + ds.rows.length + ' (filtered)';
    $('#kk-' + key).innerHTML = cfg.cards ? cfg.cards(rs, pl, ds, sub) : isList
      ? [kcard(noun, rs.length, sub, PAL[0])].concat(pl.nums.slice(0, 3).map((c, n) => kcard('Avg ' + c.h, fmtN(mean(c), c), rs.length + ' ' + noun.toLowerCase(), PAL[(n + 1) % PAL.length]))).join('')
      : [kcard('Rows', rs.length, sub, PAL[0])].concat(pl.nums.slice(0, 4).map((c, n) => kcard((isAvg(c) ? 'Avg ' : 'Total ') + c.h, fmtN(agg(rs, c), c), rs.length + ' rows', PAL[(n + 1) % PAL.length]))).join('');

    const list = [], leg = { position: 'bottom' }, gl = pl.label ? groups(rs, pl.label) : [], skip = cfg.skip || [];
    const topBy = (gs, fn) => gs.map(x => ({ k: x[0], v: fn(x[1]) })).sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, 12);
    const avgOf = c => rows2 => { const v = rows2.map(r => numv(r, c)).filter(x => x !== null); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
    const donut = (title, cc) => { const g = groups(rs, cc).map(x => [x[0], x[1].length]).sort((a, b) => b[1] - a[1]);
      if (g.length) list.push({ t: title, cfg: { type: 'doughnut', data: { labels: g.map(x => x[0]), datasets: [{ data: g.map(x => x[1]), backgroundColor: g.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] }, options: { cutout: '55%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw} (${pct(c.raw, rs.length)}%)` } } } } } }); };
    if (isList) {
      if (pl.period && rs.length) { const g = periodGroups(rs, pl.period); list.push({ t: `${noun} by ${pl.period.type === 'date' ? 'Month' : pl.period.h}`, cfg: { type: 'bar', data: { labels: g.map(x => kdisp(x[0])), datasets: [{ label: noun, backgroundColor: PAL[0], data: g.map(x => x[1].length) }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } } }); }
      pl.cats.slice(0, 2).forEach(cc => donut(`${noun} by ${cc.h}`, cc));
      if (!skip.includes('avg') && pl.cats[0] && pl.nums[0]) { const cc = pl.cats[0], c = pl.nums[0], t = topBy(groups(rs, cc), avgOf(c)); list.push({ t: `Average ${c.h} by ${cc.h}`, cfg: { type: 'bar', data: { labels: t.map(x => x.k), datasets: [{ label: c.h, backgroundColor: PAL[2], data: t.map(x => x.v) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } } }); }
      const sv = pl.nums[0] ? rs.map(r => numv(r, pl.nums[0])).filter(x => x !== null) : [];   // a spread only makes sense for small scores such as 1-5 ratings
      if (!skip.includes('spread') && pl.nums[0] && pl.nums[0].distinct <= 10 && sv.length && Math.min(...sv) >= 0 && Math.max(...sv) <= 10) { const c = pl.nums[0], m = new Map(); rs.forEach(r => { const v = numv(r, c); if (v !== null) m.set(v, (m.get(v) || 0) + 1); }); const ks = [...m.keys()].sort((a, b) => a - b);
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
    if (cfg.extra) cfg.extra(rs, pl, list, ds);
    const shown = list.slice(0, 5);
    $('#kg-' + key).innerHTML = shown.length ? shown.map((x, n) => kpanel(esc(x.t), `kcv_${key}_${n}`)).join('') : `<div class="panel" style="grid-column:1/-1">Not enough numeric, date or category columns in this tab to draw charts yet.</div>`;
    shown.forEach((x, n) => mk(`kcv_${key}_${n}`, x.cfg));
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the charts: ${esc(e.message)}</div>`; }
}

/* ---------- wiring ---------- */
$('#tab-bo-cfs').onchange = e => {
  const s = e.target.closest('[data-ac]'), y = e.target.closest('[data-cy]');
  if (s) { asel[s.dataset.k][s.dataset.ac] = s.value; autoRender(s.dataset.k, true); }
  else if (y) { cfsYear = y.value; renderCfsSummary(true); }
};
$('#tab-bo-cfs').onclick = e => {
  const b = e.target.closest('[data-areset]'); if (!b) return;
  if (b.dataset.areset === 'csum') { cfsYear = ''; renderCfsSummary(); } else { asel[b.dataset.areset] = {}; autoRender(b.dataset.areset); }
};
$('#cfsSumBtn').onclick = () => showTab('bo-cfsS'); $('#cfsRespBtn').onclick = () => showTab('bo-cfsR');
$('#cfsSBack').onclick = () => showTab('bo-cfs'); $('#cfsRBack').onclick = () => showTab('bo-cfs');
$('#cfsSNew').onclick = () => openKpiEdit('csum', -1); $('#cfsRNew').onclick = () => openKpiEdit('cresp', -1);
