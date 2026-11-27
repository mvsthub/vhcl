/* Business Overview > Finance and Budget.
   Finance dashboard: tab "P&L Overview" (key fov). Ten pages with a live embed of the tabs P&L Overview, P&L - Project Type, P&L - Total Company by Service, P&L - WR1, WR2, WR3, HQ, Balance Sheet, Cashflow, Trade Receivable and Payable (each with an Edit link to Google Sheets).
   Budget dashboard: tab "Budget" (key bud), read from fixed cells (see below).
   The P&L is read as a table with one row per line item (revenue, cost of sales, gross profit, expenses, PBT ...) and one column per month, plus optional Total / YTD / Budget columns.
   Needs kpi.js, deduction.js (gat), marketing.js (n2), cfs.js and script.js. */
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
const fsel = { type: 'Actual', year: '', item: '' };  // Finance filters: Type, Year (sub filter) and Data
const FIN_ITEMS = [['Net Revenue', 8], ['Cost of Sales', 9], ['Gross Profit', 17], ['EBITDA', 19], ['PBT', 23], ['PAT', 25]];                                   // sheet rows
const FIN_COS = [['Maintenance Contract', 10], ['Maintenance Cost', 11], ['Consumable Part', 12], ['Manpower', 13], ['Consultant Fee', 14], ['Rental Office/Equipment', 15], ['Others', 16]];

function renderFin(keepBar) {
  renderFinance(keepBar);
  const a = $('#finAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}
function renderBud(keepBar) {
  renderBudget(keepBar);
  const a = $('#budAsof'); if (a) a.textContent = 'updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
}

/* ---------- Finance: "P&L Overview" tab ----------
   Column A = line, B = Actual 2026, C = Budget 2026, D = Actual 2025, E = variance 2026 vs budget, F = variance 2026 vs 2025.
   Rows: 8 Net Revenue, 9 Cost of Sales (10-16 its parts), 17 Gross Profit, 19 EBITDA, 23 PBT, 25 PAT.
   Columns headed "Actual <year>" or "Budget <year>" are found automatically, so a new year shows up in the Type / Year filters. */
function finColumns(g) {
  const found = [];
  for (let c = 1; c < 24; c++) {
    const txt = [1, 2, 3, 4, 5, 6, 7].map(r => { const x = gat(g, r); return x ? String(x[1][c] || x[0][c] || '') : ''; }).join(' ');
    const type = /actual/i.test(txt) ? 'Actual' : /budget/i.test(txt) ? 'Budget' : null, year = (txt.match(/20\d\d/) || [])[0];
    if (type && year && !/varian/i.test(txt)) found.push({ c, type, year });
  }
  [{ c: 1, type: 'Actual', year: '2026' }, { c: 2, type: 'Budget', year: '2026' }, { c: 3, type: 'Actual', year: '2025' }].forEach(d => { if (!found.some(x => x.c === d.c)) found.push(d); });   // B, C, D as described
  return found.sort((a, b) => a.c - b.c);
}
function renderFinance(keepBar) {
  const key = 'fov', ds = KPI[key], bar = $('#kf-' + key); kclear(key);
  const msg = t => { bar.innerHTML = `<span class="sub">${esc(t)}</span>`; $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; };
  if (!ds) return msg('Loading...'); if (ds.error) return msg(ds.error);
  const g = ds.grid; if (!g) return msg('No data found in the "P&L Overview" tab yet.');
  try {
    const cols = finColumns(g), cell = (r, c) => { const x = gat(g, r); return x ? [x[0][c], x[1][c]] : [null, null]; };
    const num = (r, c) => { const [a, b] = cell(r, c); return cellNum(a, b); }, shown = (r, c) => { const [a, b] = cell(r, c); return String(b || a || '-'); };
    const label = (r, d) => { const v = String(cell(r, 0)[0] ?? '').trim(); return v && nm(v) === null ? v : d; };
    const rm = [8, 9, 17, 19, 23, 25].some(r => cols.some(k => /^\s*RM/i.test(String(cell(r, k.c)[1])))), money = v => v === null ? '-' : (rm ? 'RM ' : '') + n2(v);
    const years = type => [...new Set(cols.filter(k => k.type === type).map(k => k.year))].sort();
    if (!['Actual', 'Budget'].includes(fsel.type) || !years(fsel.type).length) fsel.type = 'Actual';
    if (!years(fsel.type).includes(fsel.year)) fsel.year = years(fsel.type).slice(-1)[0] || '';
    const items = FIN_ITEMS.map(([d, r]) => ({ name: label(r, d), row: r }));
    if (fsel.item && !items.some(x => x.name === fsel.item)) fsel.item = '';
    if (!keepBar) bar.innerHTML = `<label>Type <select data-ft="1">${['Actual', 'Budget'].filter(t => years(t).length).map(t => `<option${t === fsel.type ? ' selected' : ''}>${t}</option>`).join('')}</select></label>` +
      `<label>Year <select data-fy="1">${years(fsel.type).map(y => `<option${y === fsel.year ? ' selected' : ''}>${y}</option>`).join('')}</select></label>` +
      `<label>Data <select data-fd="1"><option value="">All (Net Revenue ... PAT)</option>${items.map(x => `<option${x.name === fsel.item ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><button class="btn" data-freset="1">Reset</button>`;
    const col = (type, year) => cols.find(k => k.type === type && k.year === year), a26 = col('Actual', '2026') || cols.find(k => k.type === 'Actual'), b26 = col('Budget', '2026') || cols.find(k => k.type === 'Budget');
    const pick = fsel.item ? items.filter(x => x.name === fsel.item) : items;

    // cards: PBT (row 23) and its variances (columns E and F as the sheet shows them)
    const yA = a26 ? a26.year : '2026', yB = b26 ? b26.year : yA, yP = (col('Actual', String(+yA - 1)) || { year: String(+yA - 1) }).year, sign = (r, c) => { const v = num(r, c); return v === null ? PAL[0] : v < 0 ? '#e5484d' : '#2fb67c'; };
    $('#kk-' + key).innerHTML = kcard(`PBT ${yA}`, shown(23, a26 ? a26.c : 1), 'actual (cell B23)', PAL[0]) + kcard(`PBT Budget ${yB}`, shown(23, b26 ? b26.c : 2), 'budget (cell C23)', PAL[1]) +
      kcard(`PBT Variance ${yA} Vs Budget`, shown(23, 4), 'cell E23', sign(23, 4)) + kcard(`PBT Variance ${yA} Vs ${yP}`, shown(23, 5), 'cell F23', sign(23, 5));

    const out = [], leg = { position: 'bottom' }, tip = { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw === null ? '-' : money(c.raw)}` } }, axis = { ticks: { callback: v => (rm ? 'RM ' : '') + Number(v).toLocaleString('en-MY') } };
    // 1. Actual vs Budget (multiple bars)
    if (a26 && b26) out.push({ t: `Actual ${a26.year} Vs Budget ${b26.year}`, cfg: { type: 'bar', data: { labels: pick.map(x => x.name), datasets: [{ label: `Actual ${a26.year}`, backgroundColor: PAL[0], data: pick.map(x => num(x.row, a26.c)) }, { label: `Budget ${b26.year}`, backgroundColor: PAL[1], data: pick.map(x => num(x.row, b26.c)) }] }, options: { scales: { y: axis }, plugins: { legend: leg, tooltip: tip } } } });
    // 2. Actual by year (multiple lines, one line per item)
    const act = cols.filter(k => k.type === 'Actual').sort((a, b) => a.year - b.year);
    if (act.length > 1) out.push({ t: `Actual ${act.map(k => k.year).join(' Vs ')}`, cfg: { type: 'line', data: { labels: act.map(k => k.year), datasets: pick.map((x, n) => ({ label: x.name, data: act.map(k => num(x.row, k.c)), borderColor: PAL[n % PAL.length], backgroundColor: PAL[n % PAL.length], tension: .25, pointRadius: 4 })) }, options: { scales: { y: axis }, plugins: { legend: leg, tooltip: tip } } } });
    // 3. Cost of Sales breakdown for the chosen Type and Year
    const sc = col(fsel.type, fsel.year);
    const parts = sc ? FIN_COS.map(([d, r]) => ({ n: label(r, d), v: Math.abs(num(r, sc.c) ?? 0) })).filter(x => x.v > 0) : [], tot = parts.reduce((a, x) => a + x.v, 0);
    out.push({ t: 'Cost of Sales', sub: `${fsel.type} ${fsel.year}`, cfg: parts.length ? { type: 'pie', data: { labels: parts.map(x => x.n), datasets: [{ data: parts.map(x => x.v), backgroundColor: parts.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] }, options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${money(c.raw)} (${pct(c.raw, tot)}%)` } } } } } : null });
    $('#kg-' + key).innerHTML = out.map((x, n) => x.cfg ? `<div class="panel"><h2>${esc(x.t)}${x.sub ? ` <span style="font-weight:400;color:var(--mute)">${esc(x.sub)}</span>` : ''}</h2><div class="cv"><canvas id="kcv_${key}_${n}"></canvas></div></div>` : `<div class="panel"><h2>${esc(x.t)} <span style="font-weight:400;color:var(--mute)">${esc(x.sub || '')}</span></h2><p class="sub">No cost of sales amounts in rows 10 to 16 for ${esc(fsel.type)} ${esc(fsel.year)}.</p></div>`).join('');
    out.forEach((x, n) => { if (x.cfg) mk(`kcv_${key}_${n}`, x.cfg); });
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the finance charts: ${esc(e.message)}</div>`; }
}

/* ---------- Budget: "Budget" tab ----------
   Column A = line, E = Budget, I = Actual, M = Balance. Rows: 6 Revenue, 8 Net Revenue, 9 Cost of Sales (10-16 its parts), 17 Gross Profit, 19 EBITDA, 23 PBT, 25 PAT.
   PBT row 23: F, G, H = Utilized PBT of CA, NCA, HQ (names in F4, G4, H4); I = Utilized PBT; J, K, L = Non-utilized PBT of CA, NCA, HQ; M = Non-utilized PBT. */
const bsel = { type: 'Actual', year: '', item: '' };       // Budget filters: Type (sub filter Year) and Data
const bsub = { slice: null };                              // clicked slice of the PBT Utilization pie
const BUD_ITEMS = [['Revenue', 6], ['Net Revenue', 8], ['Cost of Sales', 9], ['Gross Profit', 17], ['EBITDA', 19], ['PBT', 23], ['PAT', 25]];
const BUD_DATA = ['Net Revenue', 'Cost of Sales', 'Gross Profit', 'EBITDA', 'PBT', 'PAT'];       // choices of the Data filter
const BUD_COS = [['Maintenance Contract', 10], ['Maintenance Cost', 11], ['Consumable Part', 12], ['Manpower', 13], ['Consultant Fee', 14], ['Rental Office/Equipment', 15], ['Others', 16]];
const BUD_COL = { Actual: 8, Budget: 4, Balance: 12 };     // I, E, M

function budColumns(g) {                                   // I, E and M, plus any other column headed "Actual / Budget / Balance <year>" (so a new year can appear)
  const found = [];
  for (let c = 1; c < 24; c++) {
    const txt = [1, 2, 3, 4, 5].map(r => { const x = gat(g, r); return x ? String(x[1][c] || x[0][c] || '') : ''; }).join(' ');
    const type = /actual/i.test(txt) ? 'Actual' : /budget/i.test(txt) ? 'Budget' : /balance/i.test(txt) ? 'Balance' : null, year = (txt.match(/20\d\d/) || [])[0] || '';
    if (type && !/varian/i.test(txt)) found.push({ c, type, year });
  }
  Object.entries(BUD_COL).forEach(([type, c]) => { const f = found.find(x => x.c === c); if (!f) found.push({ c, type, year: type === 'Balance' ? '' : '2026' }); else f.type = type; });   // the columns you named win
  return found.sort((a, b) => a.c - b.c);
}
function renderBudget(keepBar) {
  const key = 'bud', ds = KPI[key], bar = $('#kf-' + key); kclear(key);
  const msg = t => { bar.innerHTML = `<span class="sub">${esc(t)}</span>`; $('#kk-' + key).innerHTML = $('#kg-' + key).innerHTML = ''; };
  if (!ds) return msg('Loading...'); if (ds.error) return msg(ds.error);
  const g = ds.grid; if (!g) return msg('No data found in the "Budget" tab yet.');
  try {
    const cols = budColumns(g), cell = (r, c) => { const x = gat(g, r); return x ? [x[0][c], x[1][c]] : [null, null]; };
    const num = (r, c) => { const [a, b] = cell(r, c); return cellNum(a, b); }, shown = (r, c) => { const [a, b] = cell(r, c); return String(b || a || '-'); };
    const text = (r, c, d) => { const v = String(cell(r, c)[0] ?? '').trim(); return v && nm(v) === null ? v : d; };
    const rm = [6, 8, 9, 17, 19, 23, 25].some(r => cols.some(k => /^\s*RM/i.test(String(cell(r, k.c)[1])))), money = v => v === null ? '-' : (rm ? 'RM ' : '') + n2(v);
    const yearsOf = t => [...new Set(cols.filter(k => k.type === t).map(k => k.year))].filter(Boolean).sort();
    if (!['Actual', 'Budget', 'Balance'].includes(bsel.type)) bsel.type = 'Actual';
    const ys = yearsOf(bsel.type); if (bsel.year && !ys.includes(bsel.year)) bsel.year = ''; if (!bsel.year) bsel.year = ys.slice(-1)[0] || '';
    if (bsel.item && !BUD_DATA.includes(bsel.item)) bsel.item = '';
    if (!keepBar) bar.innerHTML = `<label>Type <select data-bt="1">${['Actual', 'Budget', 'Balance'].map(t => `<option${t === bsel.type ? ' selected' : ''}>${t}</option>`).join('')}</select></label>` +
      (ys.length ? `<label>Year <select data-by="1">${ys.map(y => `<option${y === bsel.year ? ' selected' : ''}>${y}</option>`).join('')}</select></label>` : '') +
      `<label>Data <select data-bd="1"><option value="">All</option>${BUD_DATA.map(d => `<option${d === bsel.item ? ' selected' : ''}>${d}</option>`).join('')}</select></label><button class="btn" data-breset="1">Reset</button>`;
    const A = BUD_COL.Actual, B = BUD_COL.Budget, M = BUD_COL.Balance, yA = (cols.find(k => k.c === A) || {}).year || '2026';

    // cards
    let hi = null; BUD_COS.forEach(([d, r]) => { const v = Math.abs(num(r, A) ?? 0); if (v > 0 && (!hi || v > hi.v)) hi = { n: text(r, 0, d), v, s: shown(r, A) }; });                 // biggest cost in A10:A16 by I10:I16
    let bu = null; [5, 6, 7].forEach(c => { const v = num(23, c); if (v !== null && (!bu || v > bu.v)) bu = { n: text(4, c, ['CA', 'NCA', 'HQ'][c - 5]), v, s: shown(23, c) }; });              // biggest of F23, G23, H23 named from F4, G4, H4
    $('#kk-' + key).innerHTML = kcard(`PBT Actual ${yA}`, shown(23, A), 'cell I23', PAL[0]) + kcard(`PBT Budget ${yA}`, shown(23, B), 'cell E23', PAL[1]) + kcard('PBT Balance', shown(23, M), 'cell M23', PAL[3]) +
      kcard('Highest Cost Contribution', hi ? hi.n : '-', hi ? `${hi.s} (Actual, I10 to I16)` : 'no cost amounts', PAL[4]) + kcard('Highest Business Utilization', bu ? bu.n : '-', bu ? `${bu.s} (F23, G23, H23)` : 'no amounts', PAL[2]);

    const out = [], leg = { position: 'bottom' }, axis = { ticks: { callback: v => (rm ? 'RM ' : '') + Number(v).toLocaleString('en-MY') } };
    const pick = bsel.item ? BUD_ITEMS.filter(x => x[0] === bsel.item) : BUD_ITEMS;
    // 1. Actual Vs Budget
    out.push({ t: 'Actual Vs Budget', cfg: { type: 'bar', data: { labels: pick.map(([d, r]) => text(r, 0, d)), datasets: [{ label: 'Actual', backgroundColor: PAL[0], data: pick.map(([, r]) => num(r, A)) }, { label: 'Budget', backgroundColor: PAL[1], data: pick.map(([, r]) => num(r, B)) }] },
      options: { scales: { y: axis }, plugins: { legend: leg, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw === null ? '-' : money(c.raw)}` } } } } } });
    // 2. Cost of Sales for the chosen Type and Year
    const tc = cols.find(k => k.type === bsel.type && (k.year === bsel.year || !bsel.year)) || { c: BUD_COL[bsel.type] };
    const parts = BUD_COS.map(([d, r]) => ({ n: text(r, 0, d), v: Math.abs(num(r, tc.c) ?? 0) })).filter(x => x.v > 0), tot = parts.reduce((a, x) => a + x.v, 0);
    out.push({ t: 'Cost of Sales', sub: `${bsel.type}${bsel.year ? ' ' + bsel.year : ''}`, cfg: parts.length ? { type: 'pie', data: { labels: parts.map(x => x.n), datasets: [{ data: parts.map(x => x.v), backgroundColor: parts.map((_, n) => PAL[n % PAL.length]), borderWidth: 0 }] },
      options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${money(c.raw)} (${pct(c.raw, tot)}%)` } } } } } : null, empty: `No cost of sales amounts in rows 10 to 16 for ${bsel.type}.` });
    // 3. PBT Utilization (click a slice for the CA / NCA / HQ split)
    const ut = num(23, 8), nu = num(23, 12), slices = [{ n: 'Utilized PBT', v: ut ?? 0, cols: [5, 6, 7] }, { n: 'Non-utilized PBT', v: nu ?? 0, cols: [9, 10, 11] }].filter(x => x.v > 0), stot = slices.reduce((a, x) => a + x.v, 0);
    out.push({ t: 'PBT Utilization', hint: slices.length ? '(click a slice)' : '', cfg: slices.length ? { type: 'pie', data: { labels: slices.map(x => x.n), datasets: [{ data: slices.map(x => x.v), backgroundColor: [PAL[2], PAL[4]], borderWidth: 0 }] },
      options: { onClick: (e, els) => { if (els.length) { bsub.slice = slices[els[0].index].n; drawSub(); } }, onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${money(c.raw)} (${pct(c.raw, stot)}%)` } } } } } : null, empty: 'No utilized or non-utilized PBT in I23 and M23.' });
    if (slices.length) out.push({ t: '', sub: '', id: 'sub', cfg: {} });
    $('#kg-' + key).innerHTML = out.map((x, n) => x.id === 'sub' ? `<div class="panel"><h2 id="budsubt"></h2><div class="cv"><canvas id="kcv_${key}_sub"></canvas></div></div>`
      : x.cfg ? `<div class="panel"><h2>${esc(x.t)}${x.sub ? ` <span style="font-weight:400;color:var(--mute)">${esc(x.sub)}</span>` : ''}${x.hint ? ` <span style="font-weight:400;color:var(--mute)">${x.hint}</span>` : ''}</h2><div class="cv"><canvas id="kcv_${key}_${n}"></canvas></div></div>`
      : `<div class="panel"><h2>${esc(x.t)} <span style="font-weight:400;color:var(--mute)">${esc(x.sub || '')}</span></h2><p class="sub">${esc(x.empty)}</p></div>`).join('');
    function drawSub() {
      const s = slices.find(x => x.n === bsub.slice) || slices[0]; bsub.slice = s.n;
      const parts2 = s.cols.map((c, i) => ({ n: text(4, c, ['CA', 'NCA', 'HQ'][i]), v: num(23, c) ?? 0 })).filter(x => x.v > 0), t2 = parts2.reduce((a, x) => a + x.v, 0);
      $('#budsubt').textContent = `${s.n} by business`;
      if (!parts2.length) { if (charts[`kcv_${key}_sub`]) { charts[`kcv_${key}_sub`].destroy(); delete charts[`kcv_${key}_sub`]; } return; }
      mk(`kcv_${key}_sub`, { type: 'pie', data: { labels: parts2.map(x => x.n), datasets: [{ data: parts2.map(x => x.v), backgroundColor: parts2.map((_, n) => PAL[(n + 5) % PAL.length]), borderWidth: 0 }] },
        options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${money(c.raw)} (${pct(c.raw, t2)}%)` } } } } });
    }
    out.forEach((x, n) => { if (x.cfg && x.id !== 'sub') mk(`kcv_${key}_${n}`, x.cfg); });
    if (slices.length) drawSub();
  } catch (e) { $('#kg-' + key).innerHTML = `<div class="panel" style="grid-column:1/-1">Could not draw the budget charts: ${esc(e.message)}</div>`; }
}

/* ---------- wiring ---------- */
$('#tab-bo-fin').onchange = e => {
  const t = e.target.closest('[data-ft]'), y = e.target.closest('[data-fy]'), d = e.target.closest('[data-fd]');
  if (t) { fsel.type = t.value; fsel.year = ''; renderFinance(); }                  // the Year list depends on the Type
  else if (y) { fsel.year = y.value; renderFinance(true); }
  else if (d) { fsel.item = d.value; renderFinance(true); }
};
$('#tab-bo-fin').onclick = e => { if (e.target.closest('[data-freset]')) { Object.assign(fsel, { type: 'Actual', year: '', item: '' }); renderFinance(); } };
FIN_PG.forEach(([k, pg]) => { $('#finBtn_' + k).onclick = () => showTab(pg); $('#finBack_' + k).onclick = () => showTab('bo-fin'); $('#finEdit_' + k).href = FIN_EDIT + FIN_GID[k] + '#gid=' + FIN_GID[k]; });

$('#tab-bo-bud').onchange = e => {
  const t = e.target.closest('[data-bt]'), y = e.target.closest('[data-by]'), d = e.target.closest('[data-bd]');
  if (t) { bsel.type = t.value; bsel.year = ''; renderBudget(); }                  // the Year list depends on the Type
  else if (y) { bsel.year = y.value; renderBudget(true); }
  else if (d) { bsel.item = d.value; renderBudget(true); }
};
$('#tab-bo-bud').onclick = e => { if (e.target.closest('[data-breset]')) { Object.assign(bsel, { type: 'Actual', year: '', item: '' }); bsub.slice = null; renderBudget(); } };
$('#budInfoBtn').onclick = () => showTab('bo-budT'); $('#budBack').onclick = () => showTab('bo-bud');
$('#budNew').onclick = $('#budNewT').onclick = () => openKpiEdit('bud', -1);
