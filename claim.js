/* Public claim surface.
   Inline validation is the existing behaviour and is preserved;
   the shared system adds loading, success/failure toasts, and
   progressive reveal of the confirmation. */
(function () {
  'use strict';

  var ui = window.VouchUI;
  ui.initTheme();

  // Current programme records - the only codes the claim path accepts.
  var KNOWN_CODES = ['CLV-104', 'CLV-099', 'CLV-087'];

  var form = document.getElementById('claim-form');
  var code = document.getElementById('claim-code');
  var name = document.getElementById('claim-name');
  var email = document.getElementById('claim-email');
  var summary = document.getElementById('claim-errors');
  var result = document.getElementById('claim-result');

  function errorFor(input, message) {
    var slot = document.getElementById(input.id + '-error');
    slot.textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !message;
  }

  // Inline validation - the existing behaviour, preserved.
  function validateCode() {
    var v = code.value.trim().toUpperCase();
    if (!v) return errorFor(code, 'Enter your voucher code.');
    if (!/^CLV-\d{3}$/.test(v)) return errorFor(code, 'Voucher codes look like CLV-104.');
    return errorFor(code, '');
  }
  function validateName() {
    return errorFor(name, name.value.trim() ? '' : 'Enter your full name.');
  }
  function validateEmail() {
    var v = email.value.trim();
    if (!v) return errorFor(email, 'Enter your email address.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return errorFor(email, 'Enter a valid email address.');
    return errorFor(email, '');
  }

  code.addEventListener('blur', validateCode);
  name.addEventListener('blur', validateName);
  email.addEventListener('blur', validateEmail);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var checks = [
      { ok: validateCode(), label: 'Voucher code' },
      { ok: validateName(), label: 'Full name' },
      { ok: validateEmail(), label: 'Email address' }
    ];
    var failed = checks.filter(function (c) { return !c.ok; });
    if (failed.length) {
      summary.hidden = false;
      summary.innerHTML = '<h3>Check your answers</h3><ul>' + failed.map(function (f) {
        return '<li>' + f.label + ' needs attention.</li>';
      }).join('') + '</ul>';
      summary.focus();
      ui.toast('Some answers need attention before the claim can be submitted.', 'error');
      return;
    }
    summary.hidden = true;
    summary.innerHTML = '';
    ui.setLoading(form, true);
    window.setTimeout(function () {
      ui.setLoading(form, false);
      var v = code.value.trim().toUpperCase();
      if (KNOWN_CODES.indexOf(v) !== -1) {
        document.getElementById('claim-result-code').textContent = v;
        ui.reveal(result);
        ui.toast('Claim received for ' + v + '.', 'success');
        result.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        ui.toast('We could not find voucher code ' + v + '. Check the code and try again.', 'error');
        code.focus();
      }
    }, 800);
  });
})();
