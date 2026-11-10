/* Shared Business Status entry form, used inside the website ("Submit New") and by finance_form.html. */
const FIN_FIELDS = [   // [name, label, type, required]
  ['month', 'Month *', 'month', 1], ['segment', 'Segment *', 'select', 1],
  ['revenue', 'Revenue (RM) *', 'number', 1], ['revTarget', 'Revenue Target (RM)', 'number'],
  ['cos', 'Cost of Sales (RM) *', 'number', 1], ['opex', 'Operating Expenses (RM) *', 'number', 1],
  ['deduction', 'Contract Deduction (RM)', 'number'], ['pbtTarget', 'PBT Target (RM)', 'number'],
  ['visited', 'Companies Visited', 'number'], ['secured', 'Companies Secured', 'number'],
  ['nonCaValue', 'Non-CA Secured Value (RM)', 'number'], ['reimb', 'Reimbursable Work (RM)', 'number'],
  ['submissions', 'Submissions (count)', 'number'], ['feedback', 'Customer Feedback (%)', 'number'],
  ['respondents', 'Respondents', 'number'], ['drawdown', 'Loan Drawdown (RM)', 'number'],
  ['repayment', 'Loan Repayment (RM)', 'number'], ['cash', 'Closing Cash Balance (RM)', 'number'],
  ['remarks', 'Remarks', 'textarea']
];
function buildFinForm(form, footer) {
  form.innerHTML = FIN_FIELDS.map(([n, l, t, req]) => {
    const r = req ? ' required' : '';
    const ctl = t === 'select' ? `<select name="${n}"${r}><option value="">Select</option><option>CA</option><option>Non-CA</option></select>`
      : t === 'textarea' ? `<textarea name="${n}" rows="2"></textarea>`
      : t === 'month' ? `<input name="${n}" type="month" pattern="\\d{4}-\\d{2}" placeholder="yyyy-mm"${r}>`
      : `<input name="${n}" type="number" step="0.01"${n === 'cash' ? '' : ' min="0"'}${n === 'feedback' ? ' max="100"' : ''}${r}>`;
    return `<label${t === 'textarea' ? ' class="full"' : ''}>${l}${ctl}</label>`;
  }).join('') + `<div class="full" style="color:var(--mute);font-size:12px">Gross Profit and PBT are calculated by the sheet. One row per month and segment.</div><div class="full">${footer || ''}</div>`;
}
const finPayload = form => Object.fromEntries(new FormData(form));
