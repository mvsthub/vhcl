/* Edit this file once. You never need to touch it when script.js or index.html are updated. */
const CONFIG = {
  // Your Google Apps Script web app URL (Deploy > Manage deployments). It must end in /exec
  API_URL: 'https://script.google.com/macros/s/AKfycbwEUrVjSEB5pIypfW_umuEHf8y-B0pM9SonFRNW5JvD-3LCFECzM94PzKi8QjeBQnJj/exec',

  // How often (seconds) the website checks the sheet for changes
  POLL_SEC: 10,

  // Only for form.html. Must match the FORM_KEY script property in Apps Script. Leave '' if you did not set one.
  FORM_KEY: '',

  // Profit & Loss targets shown on the P&L dashboard cards and charts
  FIN_TARGETS: { deduction: 0.5, feedback: 85, reimb: 250000, nonCaBudget: 8394000 },

  // Options in the Site drop-down on both forms
  SITES: ['AGJ','BPH','HSA','HSI','JLB','JMP','JSN','KLN','KPL','KTG','KUL','MER','MKA','MKJ','MUR','PDX','PER','PGD','PON','ROM','SBN','SGT','TGK','TMP']
};
