/* Business Overview > Deduction Performance.
   Data: tab "Deduction Performance - Summary" (key dsum) and tab "Deduction Performance-Hospital" with two tables:
   "Deduction" (rows 3-40, key dded) and "Revenue" (rows 46-83, key drev).
   The charts follow the columns found in the tabs. Needs kpi.js and script.js (KPI, ksel, PAL, analyse, plan, agg, isAvg, fmtN, groups, cellNum, fmtM, kcard, kpanel, kclear, optLabel, cmpV, mk, charts, esc, $, pct, showTab). */
const hsel = { hospital: '', period: '', top: '10' };          // hospital filters
const dnorm = t => String(t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function renderDed(keepBar) { renderDedSummary(keepBar); renderDedHospital(keepBar); const a = $('#dedAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }); }

/* ---------- Summary tab: charts built from its columns ---------- */
function renderDedSummary(keepBar) {
  const key = 'dsum', ds = KPI[key], bar = $('#kf-' + key);
  kclear(key);
  if (!ds || ds.error || !ds.headers.length) {
    bar.innerHTML = `<span class="sub">${esc(ds && ds.error ? ds.error : ds ? 'No data found in this tab yet.' : 'Loading...')}</span>`;
    $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; return;
  }
  try {
    const pl = plan(ds);
    if (!keepBar) {
      const fc = [pl.label && pl.label.distinct <= 40 ? pl.label : null, ...pl.cats, pl.period && pl.period.distinct <= 36 ? pl.period : null].filter((c, i, a) => c && a.indexOf(c) === i);
      bar.innerHTML = fc.map(c => {
        const vals = [...new Set(ds.rows.map(r => r[c.i]).filter(v => v !== '' && v != null).map(String))];
        if (c.type === 'date' || c === pl.period) vals.sort(cmpV); else vals.sort();
        if (ksel[key][c.i] && !vals.includes(ksel[key][c.i])) ksel[key][c.i] = '';
        return `<label>${esc(c.h)} <select data-k="${key}" data-kc="${c.i}"><option value="">All</option>${vals.map(v => `<option value="${esc(v)}"${ksel[key][c.i] === v ? ' selected' : ''}>${esc(optLabel(c, v))}</option>`).join('')}</select></label>`;
      }).join('') + `<button class="btn" data-kreset="${key}">Reset</button>`;
    }
    const rs = ds.rows.filter(r => Object.entries(ksel[key]).every(([c, v]) => !v || String(r[c]) === v));
    $('#kk-' + key).innerHTML = [kcard('Rows', rs.length, rs.length === ds.rows.length ? 'all rows' : 'of ' + ds.rows.length + ' (filtered)', PAL[0])]
      .concat(pl.nums.slice(0, 4).map((c, n) => kcard((isAvg(c) ? 'Avg ' : 'Total ') + c.h, fmtN(agg(rs, c), c), rs.length + ' rows', PAL[(n + 1) % PAL.length]))).join('');
    const list = [], leg = { position: 'bottom' }, gl = pl.label ? groups(rs, pl.label) : [];
    if (pl.period && pl.nums.length && rs.length) {
      const g = groups(rs, pl.period, pl.period.type === 'date' ? 'sort' : '');
      list.push({ t: `Trend by ${pl.period.h}`, cfg: { type: 'line', data: { labels: g.map(x => kdisp(x[0])), datasets: pl.nums.slice(0, 3).map((c, n) => ({ label: c.h, data: g.map(x => agg(x[1], c)), borderColor: PAL[n], backgroundColor: PAL[n], tension: .25, spanGaps: true })) }, options: { plugins: { legend: leg } } } });
    }
    if (pl.label && pl.nums.length && gl.length) {
      const c = pl.nums[0], top = gl.map(x => ({ k: x[0], v: agg(x[1], c) })).sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, 12);
      list.push({ t: `${c.h} by ${pl.label.h}`, cfg: { type: 'bar', data: { labels: top.map(x => x.k), datasets: [{ label: c.h, backgroundColor: PAL[0], data: top.map(x => x.v) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } } });
    }
    pl.cats.slice(0, 2).forEach(cc => {
      const g = groups(rs, cc).map(x => [x[0], x[1].length]).sort((a, b) => b[1] - a[1]);
      if (g.length) list.push({ t: `Count by ${cc.h}`, cfg: { type: 'doughnut', data: { labels: g.map(x => x[0]), datasets: [{ data: g.map(x => x[1]), backgroundColor: g.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] }, options: { cutout: '55%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } } } } });
    });
    const shown = list.slice(0, 4);
    $('#kg-' + key).innerHTML = shown.length ? shown.map((x, n) => kpanel(esc(x.t), `kcv_${key}_${n}`)).join('') : `<div class="panel" style="grid-column:1/-1">Not enough numeric or category columns in this tab to draw charts yet.</div>`;
    shown.forEach((x, n) => mk(`kcv_${key}_${n}`, x.cfg));
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the summary charts: ${esc(e.message)}</div>`; }
}

/* ---------- Hospital tab: Deduction table + Revenue table ---------- */
function hospData(ds) {                               // hospital name column + numeric columns (months and a total, if any)
  if (!ds || ds.error || !ds.headers.length) return null;
  const an = analyse(ds), nameCol = an.find(c => c.type === 'text' && c.distinct >= 3) || an.find(c => c.type === 'text');
  if (!nameCol) return null;
  const nums = an.filter(c => c.type === 'num'), totalCol = nums.find(c => /total|ytd|sum|jumlah/i.test(c.h)), periods = nums.filter(c => c !== totalCol).map(c => c.h);
  const items = ds.rows.map((r, i) => {
    const name = String(r[nameCol.i] ?? '').trim(); if (!name) return null;
    const v = {}; nums.forEach(c => { v[c.h] = cellNum(r[c.i], ds.disp[i][c.i]); });
    return { name, key: dnorm(name), total: /^(grand\s*)?total/i.test(name), v };
  }).filter(Boolean);
  return { items, periods, totalHdr: totalCol ? totalCol.h : null };
}
const hval = (m, it, period) => {                     // value of one hospital row: a chosen month, otherwise the Total column (or the sum of the months)
  if (period) return it.v[period] ?? 0;
  if (m.totalHdr && it.v[m.totalHdr] != null) return it.v[m.totalHdr];
  return m.periods.reduce((a, p) => a + (it.v[p] ?? 0), 0);
};

function renderDedHospital(keepBar) {
  const key = 'dhosp', bar = $('#kf-' + key), D = hospData(KPI.dded), R = hospData(KPI.drev);
  kclear(key);
  if (!D || !D.items.length) {
    const ds = KPI.dded, msg = ds && ds.error ? ds.error : ds ? 'No hospital data found in rows 3 to 40 of the tab yet.' : 'Loading...';
    bar.innerHTML = `<span class="sub">${esc(msg)}</span>`; $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; return;
  }
  try {
    const hosp = D.items.filter(x => !x.total);
    if (hsel.hospital && !hosp.some(x => x.name === hsel.hospital)) hsel.hospital = '';
    if (hsel.period && !D.periods.includes(hsel.period)) hsel.period = '';
    if (!keepBar) bar.innerHTML = `<label>Hospital <select data-hf="hospital"><option value="">All hospitals</option>${hosp.map(x => `<option${x.name === hsel.hospital ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` +
      `<label>Period <select data-hf="period"><option value="">All (total)</option>${D.periods.map(p => `<option${p === hsel.period ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select></label>` +
      `<label>Show top <select data-hf="top">${['5', '10', '15', 'all'].map(t => `<option value="${t}"${t === hsel.top ? ' selected' : ''}>${t === 'all' ? 'All' : t}</option>`).join('')}</select></label><button class="btn" data-hreset="1">Reset</button>`;
    const rv = new Map((R ? R.items : []).map(x => [x.key, x])), topN = hsel.top === 'all' ? 1e9 : +hsel.top, per = hsel.period;
    const list = hosp.filter(x => !hsel.hospital || x.name === hsel.hospital).map(x => ({ name: x.name, d: hval(D, x, per), r: rv.has(x.key) ? hval(R, rv.get(x.key), per) : 0, it: x, rit: rv.get(x.key) }));
    const dTot = D.items.find(x => x.total), rTot = R && R.items.find(x => x.total);
    const sumD = !hsel.hospital && dTot ? hval(D, dTot, per) : list.reduce((a, x) => a + x.d, 0), sumR = !hsel.hospital && rTot ? hval(R, rTot, per) : list.reduce((a, x) => a + x.r, 0);
    $('#kk-' + key).innerHTML = kcard('Total deduction', fmtM(+sumD.toFixed(2)), (per || 'all periods') + (!hsel.hospital && dTot ? ' (sheet total row)' : ''), PAL[4]) +
      kcard('Total revenue', R ? fmtM(+sumR.toFixed(2)) : '-', R ? (per || 'all periods') : 'Revenue table not found', PAL[0]) +
      kcard('Deduction % of revenue', sumR ? (sumD / sumR * 100).toFixed(2) + '%' : '-', 'deduction \u00f7 revenue', PAL[1]) +
      kcard('Hospitals', list.length, hsel.hospital ? 'filtered' : 'in the Deduction table', PAL[2]);
    const out = [], leg = { position: 'bottom' }, money = { callbacks: { label: c => ` ${c.dataset.label}: ${typeof c.raw === 'number' ? fmtM(c.raw) : c.raw}` } };
    const topD = list.filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, topN);
    out.push({ t: 'Deduction by hospital', cfg: { type: 'bar', data: { labels: topD.map(x => x.name), datasets: [{ label: 'Deduction', backgroundColor: PAL[4], data: topD.map(x => x.d) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: money } } }, tall: 1 });
    if (R) {
      const topP = list.filter(x => x.r > 0 && x.d > 0).map(x => ({ n: x.name, p: x.d / x.r * 100 })).sort((a, b) => b.p - a.p).slice(0, topN);
      out.push({ t: 'Deduction % of revenue by hospital', cfg: { type: 'bar', data: { labels: topP.map(x => x.n), datasets: [{ label: 'Deduction % of revenue', backgroundColor: PAL[1], data: topP.map(x => +x.p.toFixed(2)) }] }, options: { indexAxis: 'y', scales: { x: { ticks: { callback: v => v + '%' } } }, plugins: { legend: { display: false } } } }, tall: 1 });
    }
    // trend across the months: deduction (bars) and deduction % of revenue (line), for the chosen hospital or all hospitals
    if (D.periods.length > 1) {
      const rmap = R ? new Map(R.periods.map(p => [dnorm(p), p])) : new Map();
      const sel = hsel.hospital ? hosp.filter(x => x.name === hsel.hospital) : hosp;
      const dser = D.periods.map(p => sel.reduce((a, x) => a + (x.v[p] ?? 0), 0));
      const rser = D.periods.map(p => { const rp = rmap.get(dnorm(p)); return rp ? sel.reduce((a, x) => { const r = rv.get(x.key); return a + (r ? (r.v[rp] ?? 0) : 0); }, 0) : null; });
      const ds2 = [{ label: 'Deduction', backgroundColor: PAL[4], data: dser, order: 2 }];
      if (rser.some(v => v)) ds2.push({ type: 'line', label: 'Deduction % of revenue', borderColor: PAL[1], backgroundColor: PAL[1], yAxisID: 'y1', tension: .25, order: 1, data: dser.map((d, i) => rser[i] ? +(d / rser[i] * 100).toFixed(2) : null), spanGaps: true });
      out.push({ t: 'Monthly deduction' + (hsel.hospital ? ` - ${hsel.hospital}` : ''), cfg: { type: 'bar', data: { labels: D.periods, datasets: ds2 }, options: { scales: { y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' }, display: ds2.length > 1 } }, plugins: { legend: leg, tooltip: money } } } });
    }
    // share of the total deduction
    const shareList = list.filter(x => x.d > 0).sort((a, b) => b.d - a.d), head = shareList.slice(0, 8), rest = shareList.slice(8).reduce((a, x) => a + x.d, 0);
    if (shareList.length > 1) {
      const labs = head.map(x => x.name).concat(rest > 0 ? ['Others'] : []), vals = head.map(x => x.d).concat(rest > 0 ? [rest] : []);
      out.push({ t: 'Share of deduction by hospital', cfg: { type: 'pie', data: { labels: labs, datasets: [{ data: vals, backgroundColor: labs.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] }, options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtM(c.raw)} (${pct(c.raw, vals.reduce((a, b) => a + b, 0))}%)` } } } } } });
    }
    $('#kg-' + key).innerHTML = out.map((x, n) => kpanel(esc(x.t), `kcv_${key}_${n}`, x.tall)).join('');
    out.forEach((x, n) => mk(`kcv_${key}_${n}`, x.cfg));
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the hospital charts: ${esc(e.message)}</div>`; }
}

/* ---------- wiring ---------- */
$('#tab-bo-ded').onchange = e => {
  const s = e.target.closest('[data-kc]'), h = e.target.closest('[data-hf]');
  if (s) { ksel[s.dataset.k][s.dataset.kc] = s.value; renderDedSummary(true); }
  else if (h) { hsel[h.dataset.hf] = h.value; renderDedHospital(true); }
};
$('#tab-bo-ded').onclick = e => {
  const r = e.target.closest('[data-kreset]'), h = e.target.closest('[data-hreset]');
  if (r) { ksel.dsum = {}; renderDedSummary(); }
  else if (h) { hsel.hospital = ''; hsel.period = ''; hsel.top = '10'; renderDedHospital(); }
};
$('#dedSumBtn').onclick = () => showTab('bo-dedS'); $('#dedHospBtn').onclick = () => showTab('bo-dedH');
$('#dedSBack').onclick = () => showTab('bo-ded'); $('#dedHBack').onclick = () => showTab('bo-ded');
