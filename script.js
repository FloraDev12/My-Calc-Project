/* =========================================
   PREMIUM CALCULATOR — script.js
   ========================================= */

'use strict';

// ---- State ----
const state = {
  expression: '',       // full expression string
  display: '0',         // what's shown in big text
  prevResult: null,     // last result for chaining
  isDeg: true,          // trig mode
  openParens: 0,        // tracks unmatched (
  justEvaled: false,    // did we just press =?
  history: [],          // [{expr, ans}]
  historyOpen: false,
};

// ---- DOM refs ----
const $expr   = document.getElementById('expression');
const $result = document.getElementById('result');
const $mode   = document.getElementById('modeLabel');
const $hist   = document.getElementById('historyPanel');
const $histList = document.getElementById('historyList');
const $histToggle = document.getElementById('historyToggleBtn');
const $clearHist  = document.getElementById('clearHistoryBtn');
const $display    = document.querySelector('.display');
const $btnDeg     = document.getElementById('btn-deg');

// ---- Helpers ----
function toRad(d) { return d * Math.PI / 180; }
function fmt(n) {
  if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (isNaN(n)) return 'NaN';
  // Avoid floating point junk
  const s = parseFloat(n.toPrecision(12)).toString();
  return s;
}

function setDisplay(val) {
  $result.classList.remove('large', 'medium', 'small', 'error', 'pop');
  // Trigger reflow for re-animation
  void $result.offsetWidth;

  const str = String(val);
  if (str.length > 18)       $result.classList.add('small');
  else if (str.length > 12)  $result.classList.add('medium');
  else                       $result.classList.add('large');

  $result.textContent = str;
  $result.classList.add('pop');
  state.display = str;
}

function setExpr(val) {
  $expr.textContent = val || '\u00A0';
}

function showError(msg = 'Error') {
  $result.classList.remove('large', 'medium', 'small', 'pop');
  $result.classList.add('error');
  $result.textContent = msg;
  $display.classList.remove('shake');
  void $display.offsetWidth;
  $display.classList.add('shake');
  setTimeout(() => $display.classList.remove('shake'), 400);
}

function resetState() {
  state.expression  = '';
  state.display     = '0';
  state.prevResult  = null;
  state.openParens  = 0;
  state.justEvaled  = false;
}

// ---- Trig mode ----
function toggleDeg() {
  state.isDeg = !state.isDeg;
  $mode.textContent = state.isDeg ? 'DEG' : 'RAD';
  $btnDeg.textContent = state.isDeg ? 'DEG' : 'RAD';
  $btnDeg.style.color = state.isDeg ? '' : 'var(--accent-2)';
}

// ---- History ----
function pushHistory(expr, ans) {
  state.history.unshift({ expr, ans });
  if (state.history.length > 50) state.history.pop();
  renderHistory();
}

function renderHistory() {
  if (state.history.length === 0) {
    $histList.innerHTML = '<li class="history-empty">No calculations yet</li>';
    return;
  }
  $histList.innerHTML = state.history.map((h, i) => `
    <li class="history-item" data-idx="${i}">
      <div class="history-item-expr">${escHtml(h.expr)}</div>
      <div class="history-item-ans">${escHtml(h.ans)}</div>
    </li>
  `).join('');
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

$histList.addEventListener('click', e => {
  const item = e.target.closest('.history-item');
  if (!item) return;
  const idx = parseInt(item.dataset.idx, 10);
  const ans = state.history[idx].ans;
  state.expression = ans;
  state.display    = ans;
  state.justEvaled = true;
  setDisplay(ans);
  setExpr(state.history[idx].expr + ' =');
  clearActiveOp();
});

$clearHist.addEventListener('click', () => {
  state.history = [];
  renderHistory();
});

$histToggle.addEventListener('click', () => {
  state.historyOpen = !state.historyOpen;
  $hist.classList.toggle('open', state.historyOpen);
  $histToggle.style.color = state.historyOpen ? 'var(--accent-2)' : '';
});

// ---- Evaluate safely ----
function evaluate(expr) {
  // Replace display chars with JS operators
  let e = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, `(${Math.PI})`)
    .replace(/ℇ/g, `(${Math.E})`);

  // Handle trig with degree conversion
  if (state.isDeg) {
    e = e
      .replace(/sin\(/g, 'Math.sin((Math.PI/180)*')
      .replace(/cos\(/g, 'Math.cos((Math.PI/180)*')
      .replace(/tan\(/g, 'Math.tan((Math.PI/180)*');
  } else {
    e = e
      .replace(/sin\(/g, 'Math.sin(')
      .replace(/cos\(/g, 'Math.cos(')
      .replace(/tan\(/g, 'Math.tan(');
  }
  e = e
    .replace(/√\(/g, 'Math.sqrt(')
    .replace(/log\(/g, 'Math.log10(')
    .replace(/ln\(/g, 'Math.log(')
    .replace(/\^/g,  '**');

  // Auto-close unclosed parens
  const opens = (e.match(/\(/g) || []).length;
  const closes = (e.match(/\)/g) || []).length;
  e += ')'.repeat(Math.max(0, opens - closes));

  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + e + ')')();
    if (typeof result !== 'number') throw new Error('Non-numeric result');
    return result;
  } catch {
    return null;
  }
}

// ---- Active operator tracking ----
let activeOpBtn = null;
function setActiveOp(action) {
  clearActiveOp();
  const el = document.querySelector(`[data-action="${action}"]`);
  if (el) { el.classList.add('active-op'); activeOpBtn = el; }
}
function clearActiveOp() {
  if (activeOpBtn) { activeOpBtn.classList.remove('active-op'); activeOpBtn = null; }
}

// ---- Core actions ----
const actions = {
  digit(val) {
    if (state.justEvaled) {
      state.expression = '';
      state.openParens = 0;
      state.justEvaled = false;
    }
    clearActiveOp();
    state.expression += val;
    setDisplay(state.expression);
    setExpr('');
  },

  decimal() {
    if (state.justEvaled) {
      state.expression = '0';
      state.justEvaled = false;
    }
    // Prevent double decimal in the current number segment
    const parts = state.expression.split(/[+\-×÷]/);
    const last = parts[parts.length - 1] || '';
    if (last.includes('.')) return;
    if (!last || /[+\-×÷]/.test(state.expression.slice(-1))) {
      state.expression += '0';
    }
    state.expression += '.';
    clearActiveOp();
    setDisplay(state.expression);
    setExpr('');
  },

  add()      { appendOp('+'); setActiveOp('add'); },
  subtract() { appendOp('−'); setActiveOp('subtract'); },
  multiply() { appendOp('×'); setActiveOp('multiply'); },
  divide()   { appendOp('÷'); setActiveOp('divide'); },

  openParen() {
    if (state.justEvaled) { state.expression = ''; state.justEvaled = false; }
    clearActiveOp();
    state.expression += '(';
    state.openParens++;
    setDisplay(state.expression);
    setExpr('');
  },

  closeParen() {
    if (state.openParens <= 0) return;
    clearActiveOp();
    state.expression += ')';
    state.openParens--;
    setDisplay(state.expression);
    setExpr('');
  },

  sqrt()   { appendFn('√('); },
  square() { appendSquare(); },
  log()    { appendFn('log('); },
  ln()     { appendFn('ln('); },
  sin()    { appendFn('sin('); },
  cos()    { appendFn('cos('); },
  tan()    { appendFn('tan('); },

  pi() {
    if (state.justEvaled) { state.expression = ''; state.justEvaled = false; }
    clearActiveOp();
    state.expression += 'π';
    setDisplay(state.expression);
    setExpr('');
  },

  e() {
    if (state.justEvaled) { state.expression = ''; state.justEvaled = false; }
    clearActiveOp();
    state.expression += 'ℇ';
    setDisplay(state.expression);
    setExpr('');
  },

  toggleDeg,

  backspace() {
    if (state.justEvaled) { resetState(); setDisplay('0'); setExpr(''); return; }
    clearActiveOp();
    // Check if last chars are a function name
    const fnMatch = state.expression.match(/(sin|cos|tan|log|ln|√)\($/) ||
                    state.expression.match(/(sin|cos|tan|log|ln|√)$/);
    if (fnMatch) {
      state.expression = state.expression.slice(0, -fnMatch[0].length);
    } else {
      const last = state.expression.slice(-1);
      if (last === '(') state.openParens = Math.max(0, state.openParens - 1);
      if (last === ')') state.openParens++;
      state.expression = state.expression.slice(0, -1);
    }
    setDisplay(state.expression || '0');
    setExpr('');
  },

  clearEntry() {
    if (state.justEvaled) { resetState(); setDisplay('0'); setExpr(''); return; }
    clearActiveOp();
    // Clear last number segment
    state.expression = state.expression.replace(/[\d.]+$/, '') || '';
    setDisplay(state.expression || '0');
    setExpr('');
  },

  allClear() {
    resetState();
    clearActiveOp();
    setDisplay('0');
    setExpr('');
  },

  equals() {
    if (!state.expression) return;
    const exprForHistory = state.expression;
    const result = evaluate(state.expression);
    clearActiveOp();

    if (result === null || isNaN(result)) {
      showError('Error');
      return;
    }
    if (!isFinite(result)) {
      showError(result > 0 ? 'Infinity' : '-Infinity');
      return;
    }

    const ans = fmt(result);
    setExpr(exprForHistory + ' =');
    setDisplay(ans);
    pushHistory(exprForHistory, ans);
    state.expression = ans;
    state.justEvaled = true;
  },
};

// ---- Operator helper ----
function appendOp(op) {
  if (!state.expression && op === '−') {
    state.expression = '−';
    state.justEvaled = false;
    setDisplay('−');
    setExpr('');
    return;
  }
  if (state.justEvaled) { state.justEvaled = false; }
  if (!state.expression) return;
  // Replace trailing operator
  if (/[+\-×÷−]$/.test(state.expression)) {
    state.expression = state.expression.slice(0, -1);
  }
  state.expression += op;
  setDisplay(state.expression);
  setExpr('');
}

function appendFn(fn) {
  if (state.justEvaled) { state.expression = ''; state.justEvaled = false; }
  clearActiveOp();
  state.expression += fn;
  state.openParens++;
  setDisplay(state.expression);
  setExpr('');
}

function appendSquare() {
  if (!state.expression) return;
  if (state.justEvaled) { state.justEvaled = false; }
  clearActiveOp();
  // Wrap last number or expression
  const match = state.expression.match(/[\d.]+$/) || state.expression.match(/\)$/);
  if (match) {
    state.expression += '^2';
  } else {
    state.expression += '^2';
  }
  setDisplay(state.expression);
  setExpr('');
}

// ---- Button event delegation ----
document.querySelector('.button-grid').addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const action = btn.dataset.action;
  const value  = btn.dataset.value;
  if (!action || !actions[action]) return;
  actions[action](value);
});

// ---- Keyboard support ----
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const k = e.key;

  const map = {
    '0':'digit-0','1':'digit-1','2':'digit-2','3':'digit-3',
    '4':'digit-4','5':'digit-5','6':'digit-6','7':'digit-7',
    '8':'digit-8','9':'digit-9',
    '.':'decimal', ',':'decimal',
    '+':'add', '-':'subtract', '*':'multiply', '/':'divide',
    'Enter':'equals','=':'equals',
    'Backspace':'backspace', 'Delete':'allClear',
    '(':'openParen', ')':'closeParen',
    'Escape':'allClear',
  };

  const cmd = map[k];
  if (!cmd) return;

  e.preventDefault();

  if (cmd.startsWith('digit-')) {
    actions.digit(cmd.replace('digit-',''));
    flashBtn(`[data-action="digit"][data-value="${cmd.replace('digit-','')}"]`);
  } else {
    if (actions[cmd]) actions[cmd]();
    flashBtn(`[data-action="${cmd}"]`);
  }
});

function flashBtn(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.add('active-flash');
  el.style.transform = 'scale(0.93)';
  setTimeout(() => { el.style.transform = ''; el.classList.remove('active-flash'); }, 150);
}

// ---- Init ----
setDisplay('0');
setExpr('');
renderHistory();
