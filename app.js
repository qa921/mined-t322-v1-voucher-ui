/* Community Learning Vouchers - admin application.
   Existing records, status meanings, and behaviour are preserved;
   this file wires the shared interaction system (VouchUI) across
   the admin surfaces. */
(function () {
  'use strict';

  var ui = window.VouchUI;
  var theme = ui.initTheme();

  /* ----- Existing baseline data (unchanged) ----- */
  var records = [
    { id: 'CLV-104', date: '2026-08-03', amount: 350, status: 'Submitted' },
    { id: 'CLV-099', date: '2026-07-29', amount: 500, status: 'Approved' },
    { id: 'CLV-087', date: '2026-07-12', amount: 275, status: 'Redeemed' }
  ];
  var statusMapping = ['Submitted', 'Eligibility review', 'Approved', 'Redeemed'];
  var sortFields = ['Applicant code', 'Submitted date', 'Voucher amount', 'Status'];

  ui.store.setRecords(records);

  function gbp(n) { return '\u00A3' + n.toLocaleString(); }
  function el(id) { return document.getElementById(id); }

  /* ----- Summary + donut stay in sync with the shared records ----- */
  var STATUS_COLORS = ['#1D4ED8', '#3B82F6', '#93C5FD', '#64748B'];
  function renderDashboard(store) {
    el('summary-count').textContent = String(store.records.length);
    el('summary-total').textContent = gbp(
      store.records.reduce(function (s, r) { return s + r.amount; }, 0)
    );

    // Counts derive from the existing ordered mapping; statuses are
    // never merged or renamed.
    var counts = statusMapping.map(function (s) {
      return store.records.filter(function (r) { return r.status === s; }).length;
    });
    var total = counts.reduce(function (a, b) { return a + b; }, 0) || 1;
    var radius = 54;
    var circumference = 2 * Math.PI * radius;
    var offset = 0;
    var svg = '<svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="Status distribution donut chart">';
    counts.forEach(function (count, i) {
      if (!count) return;
      var len = (count / total) * circumference;
      svg += '<circle cx="70" cy="70" r="' + radius + '" fill="none" stroke="' + STATUS_COLORS[i] +
        '" stroke-width="22" stroke-dasharray="' + len + ' ' + (circumference - len) +
        '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 70 70)"></circle>';
      offset += len;
    });
    svg += '</svg>';
    el('donut').innerHTML = svg;

    el('donut-legend').innerHTML = statusMapping.map(function (s, i) {
      return '<li><span class="swatch" style="background:' + STATUS_COLORS[i] + '"></span>' +
        s + ' - ' + counts[i] + '</li>';
    }).join('');

    el('donut-table').innerHTML =
      '<thead><tr><th scope="col">Status</th><th scope="col">Vouchers</th></tr></thead><tbody>' +
      statusMapping.map(function (s, i) {
        return '<tr><td>' + s + '</td><td>' + counts[i] + '</td></tr>';
      }).join('') + '</tbody>';
  }
  ui.subscribe(renderDashboard);
  renderDashboard(ui.store);

  /* ----- Voucher records (contract sort fields) ----- */
  ui.makeSortable(el('voucher-table'), {
    id: 'voucher-records',
    columns: [
      { key: 'id', label: sortFields[0], type: 'text' },
      { key: 'date', label: sortFields[1], type: 'date' },
      { key: 'amount', label: sortFields[2], type: 'number' },
      { key: 'status', label: sortFields[3], type: 'status' }
    ],
    rows: records,
    rowId: function (r) { return r.id; },
    selectable: true,
    renderRow: function (r) {
      return [r.id, r.date, gbp(r.amount), r.status];
    }
  });

  /* ----- Follow-up queue ----- */
  var followUps = [
    { voucher: 'CLV-104', due: '2026-09-16', priority: 'High', status: 'Submitted' },
    { voucher: 'CLV-099', due: '2026-09-18', priority: 'Medium', status: 'Approved' },
    { voucher: 'CLV-087', due: '2026-09-22', priority: 'Low', status: 'Redeemed' }
  ];
  var followTable = ui.makeSortable(el('followup-table'), {
    id: 'follow-up',
    columns: [
      { key: 'voucher', label: 'Voucher', type: 'text' },
      { key: 'due', label: 'Due date', type: 'date' },
      { key: 'priority', label: 'Priority', type: 'priority' },
      { key: 'status', label: 'Status', type: 'status' }
    ],
    rows: followUps,
    rowId: function (r) { return r.voucher; },
    selectable: true,
    renderRow: function (r) { return [r.voucher, r.due, r.priority, r.status]; }
  });
  el('followup-send').addEventListener('click', function () {
    var panel = el('followup-actions');
    var ids = followTable.selectedIds();
    ui.setLoading(panel, true);
    window.setTimeout(function () {
      ui.setLoading(panel, false);
      if (ids.length) {
        ui.toast('Follow-up reminders queued for ' + ids.length + ' selected voucher(s).', 'success');
      } else {
        ui.toast('No vouchers selected. Nothing was queued.', 'info');
      }
    }, 800);
  });

  /* ----- Voucher generation (parameters preserved) ----- */
  var genForm = el('generate-form');
  genForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var count = parseInt(el('gen-count').value, 10);
    var amount = parseFloat(el('gen-amount').value);
    var err = el('gen-error');
    err.textContent = '';
    if (!count || count < 1 || count > 50) {
      err.textContent = 'Enter a number of vouchers between 1 and 50.';
      el('gen-count').focus();
      return;
    }
    if (!(amount > 0)) {
      err.textContent = 'Enter a voucher amount greater than zero.';
      el('gen-amount').focus();
      return;
    }
    ui.setLoading(genForm, true);
    window.setTimeout(function () {
      ui.setLoading(genForm, false);
      ui.toast('Generation queued for ' + count + ' voucher(s) at ' + gbp(amount) + ' each.', 'success');
      el('gen-result-text').textContent =
        count + ' voucher(s) at ' + gbp(amount) + ' each are queued. Existing records are unchanged.';
      ui.reveal(el('gen-result'));
    }, 900);
  });

  /* ----- Orders ----- */
  var orders = [
    { order: 'ORD-2101', date: '2026-08-20', amount: 500, status: 'Fulfilled' },
    { order: 'ORD-2102', date: '2026-08-27', amount: 350, status: 'Pending' },
    { order: 'ORD-2103', date: '2026-09-04', amount: 275, status: 'Fulfilled' }
  ];
  ui.makeSortable(el('orders-table'), {
    id: 'orders',
    columns: [
      { key: 'order', label: 'Order', type: 'text' },
      { key: 'date', label: 'Order date', type: 'date' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' }
    ],
    rows: orders,
    rowId: function (r) { return r.order; },
    renderRow: function (r) { return [r.order, r.date, gbp(r.amount), r.status]; }
  });
  el('orders-export').addEventListener('click', function () {
    var panel = el('orders-actions');
    ui.setLoading(panel, true);
    window.setTimeout(function () {
      ui.setLoading(panel, false);
      ui.toast('Order export prepared.', 'success');
    }, 700);
  });

  /* ----- Mail history ----- */
  var mailHistory = [
    { subject: 'Welcome to the programme', sent: '2026-08-14', recipients: 128, status: 'Sent' },
    { subject: 'Eligibility review started', sent: '2026-08-21', recipients: 96, status: 'Sent' },
    { subject: 'September webinar invite', sent: '2026-09-01', recipients: 140, status: 'Scheduled' }
  ];
  ui.makeSortable(el('mail-history-table'), {
    id: 'mail-history',
    columns: [
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'sent', label: 'Send date', type: 'date' },
      { key: 'recipients', label: 'Recipients', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' }
    ],
    rows: mailHistory,
    rowId: function (r) { return r.subject; },
    selectable: true,
    renderRow: function (r) { return [r.subject, r.sent, String(r.recipients), r.status]; }
  });

  /* ----- Mail templates (filter survives sorting) ----- */
  var mailTemplates = [
    { name: 'Approval notice', updated: '2026-08-11', status: 'Active' },
    { name: 'Eligibility review request', updated: '2026-08-19', status: 'Active' },
    { name: 'Redemption receipt', updated: '2026-07-30', status: 'Draft' }
  ];
  var templateTable = ui.makeSortable(el('mail-templates-table'), {
    id: 'mail-templates',
    columns: [
      { key: 'name', label: 'Template', type: 'text' },
      { key: 'updated', label: 'Last updated', type: 'date' },
      { key: 'status', label: 'Status', type: 'text' }
    ],
    rows: mailTemplates,
    rowId: function (r) { return r.name; },
    renderRow: function (r) { return [r.name, r.updated, r.status]; }
  });
  el('template-status-filter').addEventListener('change', function (e) {
    var value = e.target.value;
    templateTable.setFilter(value === 'All' ? null : function (r) { return r.status === value; });
  });

  /* ----- Composer ----- */
  var composer = el('composer-form');
  composer.addEventListener('submit', function (e) {
    e.preventDefault();
    sendComposer('send');
  });
  el('composer-save').addEventListener('click', function () {
    sendComposer('save');
  });
  function sendComposer(mode) {
    var errors = [];
    if (!el('composer-subject').value.trim()) errors.push('Add a subject.');
    if (!el('composer-body').value.trim()) errors.push('Add a message body.');
    var summary = el('composer-errors');
    if (errors.length) {
      summary.hidden = false;
      summary.innerHTML = '<h3>Check the message</h3><ul><li>' + errors.join('</li><li>') + '</li></ul>';
      summary.focus();
      ui.toast('The message needs attention before continuing.', 'error');
      return;
    }
    summary.hidden = true;
    summary.innerHTML = '';
    ui.setLoading(composer, true);
    window.setTimeout(function () {
      ui.setLoading(composer, false);
      ui.toast(mode === 'send' ? 'Message sent.' : 'Draft saved.', 'success');
    }, 800);
  }

  /* ----- Template library (search/filter behaviour preserved) ----- */
  el('library-search').addEventListener('input', function (e) {
    var q = e.target.value.toLowerCase();
    var cards = document.querySelectorAll('#library-list [data-template]');
    Array.prototype.forEach.call(cards, function (card) {
      card.hidden = card.getAttribute('data-template').toLowerCase().indexOf(q) === -1;
    });
  });

  /* ----- Placeholders (insert/copy behaviour preserved) ----- */
  var copyButtons = document.querySelectorAll('[data-copy-token]');
  Array.prototype.forEach.call(copyButtons, function (btn) {
    btn.addEventListener('click', function () {
      var token = btn.getAttribute('data-copy-token');
      function done() { ui.toast('Copied ' + token + ' to the clipboard.', 'success'); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(token).then(done, function () {
          ui.toast('Copy failed. Select the token and copy it manually.', 'error');
        });
      } else {
        done();
      }
    });
  });

  /* ----- Webinar roster ----- */
  var roster = [
    { attendee: 'A. Khan', session: '2026-08-27', attendance: 1 },
    { attendee: 'B. Osei', session: '2026-08-27', attendance: 1 },
    { attendee: 'C. Park', session: '2026-09-10', attendance: 0 }
  ];
  ui.makeSortable(el('roster-table'), {
    id: 'webinar-roster',
    columns: [
      { key: 'attendee', label: 'Attendee', type: 'text' },
      { key: 'session', label: 'Session date', type: 'date' },
      { key: 'attendance', label: 'Sessions attended', type: 'number' }
    ],
    rows: roster,
    rowId: function (r) { return r.attendee; },
    selectable: true,
    renderRow: function (r) { return [r.attendee, r.session, String(r.attendance)]; }
  });

  /* ----- LMS import (mapping/validation unchanged) ----- */
  el('import-run').addEventListener('click', function () {
    var panel = el('import-panel');
    var progress = el('import-progress');
    ui.setLoading(panel, true);
    progress.hidden = false;
    progress.value = 0;
    var step = 0;
    var timer = window.setInterval(function () {
      step += 1;
      progress.value = step * 34;
      if (step >= 3) {
        window.clearInterval(timer);
        ui.setLoading(panel, false);
        ui.toast('LMS import finished. Mapping and validation were unchanged.', 'success');
        ui.reveal(el('import-result'));
      }
    }, 400);
  });

  /* ----- Import history ----- */
  var imports = [
    { name: 'August cohort', importedAt: '2026-08-11T09:30', records: 42, status: 'Completed', error: '' },
    { name: 'September cohort', importedAt: '2026-09-02T14:05', records: 40, status: 'Completed with errors', error: '2 rows were missing an applicant code.' }
  ];
  ui.makeSortable(el('import-history-table'), {
    id: 'import-history',
    columns: [
      { key: 'name', label: 'Import', type: 'text' },
      { key: 'importedAt', label: 'Imported at', type: 'date' },
      { key: 'records', label: 'Records', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' }
    ],
    rows: imports,
    rowId: function (r) { return r.name; },
    renderRow: function (r) {
      var statusCell = r.error
        ? r.status + '<details class="inline-details"><summary>Error details</summary>' + r.error + '</details>'
        : r.status;
      return [r.name, r.importedAt.replace('T', ' '), String(r.records), statusCell];
    }
  });

  /* ----- Administrator accounts (safeguards preserved) ----- */
  var accounts = [
    { name: 'R. Osei', role: 'Administrator', lastActive: '2026-09-14', status: 'Active' },
    { name: 'J. Park', role: 'Editor', lastActive: '2026-09-10', status: 'Active' },
    { name: 'M. Haddad', role: 'Viewer', lastActive: '2026-08-30', status: 'Invited' }
  ];
  ui.makeSortable(el('accounts-table'), {
    id: 'admin-accounts',
    columns: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'role', label: 'Role', type: 'order', order: ['Administrator', 'Editor', 'Viewer'] },
      { key: 'lastActive', label: 'Last active', type: 'date' },
      { key: 'status', label: 'Status', type: 'text' }
    ],
    rows: accounts,
    rowId: function (r) { return r.name; },
    renderRow: function (r) {
      return [r.name, r.role, r.lastActive, r.status,
        '<button type="button" class="secondary" data-deactivate="' + r.name + '">Deactivate</button>'];
    }
  });
  el('accounts-table').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-deactivate]');
    if (!btn) return;
    var name = btn.getAttribute('data-deactivate');
    // Confirmation path preserved: nothing happens without an explicit yes.
    if (window.confirm('Deactivate the account for ' + name + '?')) {
      ui.toast('Deactivation requested for ' + name + '.', 'success');
    } else {
      ui.toast('Deactivation cancelled.', 'info');
    }
  });

  /* ----- Settings: display ----- */
  var themeInputs = document.querySelectorAll('input[name="theme"]');
  Array.prototype.forEach.call(themeInputs, function (input) {
    input.checked = input.value === theme.get();
    input.addEventListener('change', function () {
      theme.set(input.value);
      ui.toast('Theme preference saved.', 'success');
    });
  });
  var densityToggle = el('density-compact');
  try { densityToggle.checked = window.localStorage.getItem('clv-density') === 'compact'; } catch (e) {}
  if (densityToggle.checked) document.body.classList.add('compact');
  densityToggle.addEventListener('change', function () {
    document.body.classList.toggle('compact', densityToggle.checked);
    try {
      window.localStorage.setItem('clv-density', densityToggle.checked ? 'compact' : 'comfortable');
    } catch (e) {}
    ui.toast('Display density saved.', 'success');
  });

  /* ----- Tutorial (progress preserved) ----- */
  var stepBoxes = document.querySelectorAll('[data-tutorial-step]');
  var savedSteps = {};
  try { savedSteps = JSON.parse(window.localStorage.getItem('clv-tutorial') || '{}'); } catch (e) {}
  Array.prototype.forEach.call(stepBoxes, function (box) {
    box.checked = !!savedSteps[box.getAttribute('data-tutorial-step')];
    box.addEventListener('change', function () {
      savedSteps[box.getAttribute('data-tutorial-step')] = box.checked;
      try { window.localStorage.setItem('clv-tutorial', JSON.stringify(savedSteps)); } catch (e) {}
    });
  });

  /* ----- Status glossary (About) ----- */
  el('status-glossary').innerHTML = statusMapping.map(function (s, i) {
    return '<li><strong>' + (i + 1) + '. ' + s + '</strong></li>';
  }).join('');

  /* ----- Command palette (navigation entries only) ----- */
  ui.initCommandPalette([
    { label: 'Voucher records', hint: 'Daily work', href: '#voucher-records' },
    { label: 'Follow-up queue', hint: 'Daily work', href: '#follow-up' },
    { label: 'Voucher generation', hint: 'Daily work', href: '#generate' },
    { label: 'Orders', hint: 'Daily work', href: '#orders' },
    { label: 'Mail history', hint: 'Content & communications', href: '#mail-history' },
    { label: 'Mail templates', hint: 'Content & communications', href: '#mail-templates' },
    { label: 'Composer', hint: 'Content & communications', href: '#composer' },
    { label: 'Template library', hint: 'Content & communications', href: '#template-library' },
    { label: 'Placeholders', hint: 'Content & communications', href: '#placeholders' },
    { label: 'Webinars', hint: 'Programmes', href: '#webinars' },
    { label: 'LMS import', hint: 'Programmes', href: '#lms-import' },
    { label: 'Import history', hint: 'Programmes', href: '#import-history' },
    { label: 'Tutorial', hint: 'Programmes', href: '#tutorial' },
    { label: 'Administrator accounts', hint: 'Settings', href: '#admin-accounts' },
    { label: 'Display', hint: 'Settings', href: '#display' },
    { label: 'About', hint: 'Settings', href: '#about' },
    { label: 'Public claim page', hint: 'Public surface', href: 'claim.html' }
  ]);

  /* ----- Hash routing with accessible focus handling ----- */
  var views = document.querySelectorAll('[data-view]');
  var navLinks = document.querySelectorAll('[data-nav]');
  function route() {
    var hash = (window.location.hash || '#voucher-records').slice(1);
    var target = document.querySelector('[data-view="' + hash + '"]');
    if (!target) {
      hash = 'voucher-records';
      target = document.querySelector('[data-view="voucher-records"]');
    }
    Array.prototype.forEach.call(views, function (v) { v.hidden = v !== target; });
    Array.prototype.forEach.call(navLinks, function (a) {
      if (a.getAttribute('href') === '#' + hash) {
        a.setAttribute('aria-current', 'page');
        var group = a.closest('details');
        if (group) group.open = true;
      } else {
        a.removeAttribute('aria-current');
      }
    });
    var heading = target.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }
  window.addEventListener('hashchange', route);
  route();
})();
