/* Shared interaction system for Community Learning Vouchers.
   One set of primitives used by every admin surface and the public
   claim page: shared state, live toasts, non-disruptive loading and
   reveal, typed stable table sorting, command palette, and a
   persisted theme that respects the system preference. */
(function () {
  'use strict';

  var STATUS_ORDER = ['Submitted', 'Eligibility review', 'Approved', 'Redeemed'];
  var PRIORITY_ORDER = ['High', 'Medium', 'Low'];

  /* ---------------- Shared state ---------------- */
  var listeners = [];
  var store = {
    records: [],
    selections: {}, // tableId -> { rowId: true }; survives re-sorts
    setRecords: function (records) {
      store.records = records.slice();
      notify();
    }
  };
  function notify() {
    for (var i = 0; i < listeners.length; i++) listeners[i](store);
  }
  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  /* ---------------- Live toasts ---------------- */
  function ensureToastRegion() {
    var region = document.getElementById('vui-toasts');
    if (!region) {
      region = document.createElement('div');
      region.id = 'vui-toasts';
      region.className = 'vui-toasts';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    return region;
  }
  function toast(message, type) {
    var region = ensureToastRegion();
    var item = document.createElement('div');
    item.className = 'vui-toast vui-toast-' + (type || 'info');
    item.textContent = message;
    region.appendChild(item);
    window.setTimeout(function () {
      item.classList.add('is-leaving');
      window.setTimeout(function () {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 300);
    }, 4000);
  }

  /* -------- Non-disruptive loading + progressive reveal -------- */
  function setLoading(el, on) {
    if (!el) return;
    el.classList.toggle('is-loading', !!on);
    el.setAttribute('aria-busy', on ? 'true' : 'false');
    var controls = el.querySelectorAll('button, input, select, textarea');
    for (var i = 0; i < controls.length; i++) controls[i].disabled = !!on;
  }
  function reveal(el) {
    if (!el) return;
    el.hidden = false;
    el.classList.add('reveal');
    void el.offsetWidth; // restart the transition
    el.classList.add('is-revealed');
  }

  /* ------- Typed, stable, keyboard-accessible sorting ------- */
  function typedComparator(type, order) {
    if (type === 'number') return function (a, b) { return a - b; };
    if (type === 'date') {
      return function (a, b) {
        return new Date(a).getTime() - new Date(b).getTime();
      };
    }
    if (type === 'status') {
      return function (a, b) {
        return STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b);
      };
    }
    if (type === 'priority') {
      return function (a, b) {
        return PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b);
      };
    }
    if (type === 'order' && order) {
      return function (a, b) { return order.indexOf(a) - order.indexOf(b); };
    }
    return function (a, b) { return String(a).localeCompare(String(b)); };
  }
  function stableSort(rows, key, type, direction, order) {
    var cmp = typedComparator(type, order);
    var dir = direction === 'desc' ? -1 : 1;
    return rows
      .map(function (row, index) { return { row: row, index: index }; })
      .sort(function (a, b) {
        var result = cmp(a.row[key], b.row[key]);
        if (result === 0) return a.index - b.index; // keep the sort stable
        return result * dir;
      })
      .map(function (entry) { return entry.row; });
  }

  /*
    makeSortable(table, config)
    config = {
      id,                          // unique table id (selection store key)
      columns: [{ key, label, type, order? }],
      rows,                        // data rows
      rowId(row),                  // optional stable id per row
      selectable,                  // optional leading checkbox column
      renderRow(row) -> [html..],  // cell markup per row
      onRender(rows)               // optional hook after render
    }
    Sorting is stable, keyboard-invoked (Enter/Space on header buttons),
    and visibly announced via aria-sort, arrows, and a live region.
    Filters and row selection survive sorting.
  */
  function makeSortable(table, config) {
    var theadRow = table.querySelector('thead tr');
    var tbody = table.querySelector('tbody');
    var sortState = { key: null, direction: 'asc' };

    var status = document.createElement('p');
    status.className = 'sort-status visually-hidden';
    status.setAttribute('aria-live', 'polite');
    table.parentNode.insertBefore(status, table);

    function columnFor(key) {
      for (var i = 0; i < config.columns.length; i++) {
        if (config.columns[i].key === key) return config.columns[i];
      }
      return null;
    }

    function buildHeader() {
      var ths = theadRow.querySelectorAll('th[data-key]');
      Array.prototype.forEach.call(ths, function (th) {
        var key = th.getAttribute('data-key');
        var label = th.textContent;
        th.setAttribute('scope', 'col');
        th.setAttribute('aria-sort', 'none');
        th.textContent = '';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sort-btn';
        btn.setAttribute('aria-label', 'Sort by ' + label);
        var text = document.createElement('span');
        text.textContent = label;
        var arrow = document.createElement('span');
        arrow.className = 'sort-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        btn.appendChild(text);
        btn.appendChild(arrow);
        th.appendChild(btn);
        btn.addEventListener('click', function () { sortBy(key); });
      });
    }

    function sortBy(key) {
      if (sortState.key === key) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.key = key;
        sortState.direction = 'asc';
      }
      render();
      var col = columnFor(key);
      status.textContent = 'Sorted by ' + col.label + ', ' +
        (sortState.direction === 'asc' ? 'ascending' : 'descending') + '.';
    }

    function currentRows() {
      var rows = config.rows;
      if (config.filter) rows = rows.filter(config.filter);
      if (sortState.key) {
        var col = columnFor(sortState.key);
        rows = stableSort(rows, sortState.key, col.type, sortState.direction, col.order);
      }
      return rows;
    }

    function render() {
      var ths = theadRow.querySelectorAll('th[data-key]');
      Array.prototype.forEach.call(ths, function (th) {
        var key = th.getAttribute('data-key');
        var arrow = th.querySelector('.sort-arrow');
        if (key === sortState.key) {
          th.setAttribute('aria-sort', sortState.direction === 'asc' ? 'ascending' : 'descending');
          arrow.textContent = sortState.direction === 'asc' ? '\u25B2' : '\u25BC';
        } else {
          th.setAttribute('aria-sort', 'none');
          arrow.textContent = '';
        }
      });

      var rows = currentRows();
      tbody.innerHTML = '';
      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        var rowId = config.rowId ? config.rowId(row) : null;
        if (rowId) tr.setAttribute('data-row-id', rowId);
        if (config.selectable && rowId) {
          var td = document.createElement('td');
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.setAttribute('aria-label', 'Select row ' + rowId);
          var saved = store.selections[config.id] || {};
          cb.checked = !!saved[rowId];
          cb.addEventListener('change', function () {
            if (!store.selections[config.id]) store.selections[config.id] = {};
            if (cb.checked) store.selections[config.id][rowId] = true;
            else delete store.selections[config.id][rowId];
            notify();
          });
          td.appendChild(cb);
          tr.appendChild(td);
        }
        config.renderRow(row).forEach(function (html) {
          var cell = document.createElement('td');
          cell.innerHTML = html;
          tr.appendChild(cell);
        });
        tbody.appendChild(tr);
      });
      if (config.onRender) config.onRender(rows);
    }

    buildHeader();
    render();

    return {
      render: render,
      setFilter: function (fn) { config.filter = fn; render(); },
      selectedIds: function () {
        return Object.keys(store.selections[config.id] || {});
      }
    };
  }

  /* ---------------- Command palette (Ctrl/Cmd+K) ----------------
     Entries navigate only; no destructive actions live here.
     Escape closes the palette and focus returns to the opener. */
  function initCommandPalette(commands) {
    var opener = null;
    var activeIndex = 0;
    var visible = commands.slice();

    var backdrop = document.createElement('div');
    backdrop.className = 'vui-palette-backdrop';
    backdrop.hidden = true;

    var palette = document.createElement('div');
    palette.className = 'vui-palette';
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', 'true');
    palette.setAttribute('aria-label', 'Command menu');
    palette.hidden = true;

    var input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', 'vui-command-list');
    input.setAttribute('aria-label', 'Type a command or page name');
    input.placeholder = 'Type a command or page name\u2026';

    var list = document.createElement('ul');
    list.id = 'vui-command-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Commands');

    palette.appendChild(input);
    palette.appendChild(list);
    document.body.appendChild(backdrop);
    document.body.appendChild(palette);

    function isOpen() { return !palette.hidden; }

    function open() {
      opener = document.activeElement;
      backdrop.hidden = false;
      palette.hidden = false;
      input.value = '';
      filter('');
      input.focus();
      document.addEventListener('keydown', onKey, true);
    }
    function close() {
      backdrop.hidden = true;
      palette.hidden = true;
      document.removeEventListener('keydown', onKey, true);
      if (opener && opener.focus) opener.focus();
    }
    function filter(q) {
      var needle = q.toLowerCase();
      visible = commands.filter(function (c) {
        return c.label.toLowerCase().indexOf(needle) !== -1;
      });
      activeIndex = 0;
      renderList();
    }
    function renderList() {
      list.innerHTML = '';
      if (!visible.length) {
        var empty = document.createElement('li');
        empty.textContent = 'No matches.';
        list.appendChild(empty);
        return;
      }
      visible.forEach(function (c, i) {
        var li = document.createElement('li');
        li.id = 'vui-command-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
        var label = document.createElement('span');
        label.textContent = c.label;
        li.appendChild(label);
        if (c.hint) {
          var hint = document.createElement('span');
          hint.className = 'hint';
          hint.textContent = c.hint;
          li.appendChild(hint);
        }
        li.addEventListener('click', function () { go(c); });
        li.addEventListener('mousemove', function () {
          if (activeIndex !== i) { activeIndex = i; renderList(); }
        });
        list.appendChild(li);
      });
      input.setAttribute('aria-activedescendant', 'vui-command-' + activeIndex);
    }
    function go(c) {
      close();
      if (c.href) window.location.href = c.href; // navigate only
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, visible.length - 1);
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (visible[activeIndex]) go(visible[activeIndex]);
      } else if (e.key === 'Tab') {
        close();
      }
    }

    input.addEventListener('input', function () { filter(input.value); });
    backdrop.addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (isOpen()) close(); else open();
      }
    });
    var triggers = document.querySelectorAll('[data-command-palette-open]');
    Array.prototype.forEach.call(triggers, function (btn) {
      btn.addEventListener('click', open);
    });
  }

  /* ------- Persisted theme (respects system preference) ------- */
  function initTheme() {
    var mode = 'system';
    try { mode = window.localStorage.getItem('clv-theme') || 'system'; } catch (e) {}
    function apply(m) {
      mode = m;
      var dark = m === 'dark' ||
        (m === 'system' && window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    }
    apply(mode);
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', function () {
          if (mode === 'system') apply('system');
        });
    }
    return {
      get: function () { return mode; },
      set: function (m) {
        try { window.localStorage.setItem('clv-theme', m); } catch (e) {}
        apply(m);
      }
    };
  }

  window.VouchUI = {
    STATUS_ORDER: STATUS_ORDER,
    PRIORITY_ORDER: PRIORITY_ORDER,
    store: store,
    subscribe: subscribe,
    notify: notify,
    toast: toast,
    setLoading: setLoading,
    reveal: reveal,
    stableSort: stableSort,
    makeSortable: makeSortable,
    initCommandPalette: initCommandPalette,
    initTheme: initTheme
  };
})();
