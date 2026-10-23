const $ = selector => document.querySelector(selector);
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Still usable with storage disabled. */ } }
};
let expr = '', memory = 0, angle = 'DEG', justEvaluated = false;
let history = storage.get('cool-calculator-history', []);
if (!Array.isArray(history)) history = [];
history = history.filter(item => item && typeof item.e === 'string' && typeof item.r === 'string').slice(0, 20);
const expressionEl = $('#expression'), resultEl = $('#result');
function format(n) {
  if (!Number.isFinite(n)) throw Error('Undefined result');
  if (Math.abs(n) < 1e-12) n = 0;
  return String(Number(n.toPrecision(12)));
}
function pretty(s) { return s.replace(/sqrt/g, '√').replace(/pi/g, 'π').replace(/\*/g, '×').replace(/\//g, '÷'); }
function render() {
  expressionEl.textContent = pretty(expr) || '0';
  try { resultEl.textContent = expr ? format(calculate(expr)) : '0'; $('#resultStatus').textContent = expr ? 'LIVE RESULT' : 'READY WHEN YOU ARE'; }
  catch { resultEl.textContent = '…'; $('#resultStatus').textContent = 'KEEP GOING…'; }
  $('#memoryStatus').textContent = memory ? 'M' : '';
  $('#angleToggle').innerHTML = `${angle} <span>⌄</span>`;
  expressionEl.scrollLeft = expressionEl.scrollWidth;
}
function add(value) {
  if (justEvaluated && !['+', '−', '-', '×', '÷', '*', '/', '^', '%', '!'].includes(value)) expr = '';
  justEvaluated = false;
  if (expr === '0' && /^\d/.test(value)) expr = '';
  expr += value;
  render();
}
function tokenize(s) {
  s = s.replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi').trim();
  const tokens = [], re = /\s*(sin|cos|tan|log|ln|sqrt|abs|pi|\d*\.?\d+(?:e[+-]?\d+)?|e|[+\-*/%^()!])/gy;
  let i = 0;
  while (i < s.length) { re.lastIndex = i; const m = re.exec(s); if (!m) throw Error('Syntax'); tokens.push(m[1]); i = re.lastIndex; }
  return tokens;
}
function calculate(s) {
  const tokens = tokenize(s); let p = 0;
  const peek = () => tokens[p];
  const eat = expected => { if (expected && peek() !== expected) throw Error('Syntax'); return tokens[p++]; };
  function primary() {
    const x = peek();
    if (x === '(') { eat(); const v = sum(); eat(')'); return v; }
    if (['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'abs'].includes(x)) {
      eat(); eat('('); let v = sum(); eat(')');
      if (['sin', 'cos', 'tan'].includes(x)) {
        if (angle === 'DEG') v *= Math.PI / 180;
        if (x === 'tan' && Math.abs(Math.cos(v)) < 1e-14) throw Error('Undefined tangent');
        return Math[x](v);
      }
      return x === 'log' ? Math.log10(v) : x === 'ln' ? Math.log(v) : x === 'sqrt' ? Math.sqrt(v) : Math.abs(v);
    }
    if (x === 'pi') { eat(); return Math.PI; }
    if (x === 'e') { eat(); return Math.E; }
    if (x && /^(\d|\.)/.test(x)) { eat(); return Number(x); }
    throw Error('Incomplete expression');
  }
  function postfix() {
    let v = primary();
    while (peek() === '!' || peek() === '%') { const op = eat(); v = op === '%' ? v / 100 : factorial(v); }
    return v;
  }
  function power() { let v = postfix(); if (peek() === '^') { eat(); v = Math.pow(v, unary()); } return v; }
  function unary() { if (peek() === '-') { eat(); return -unary(); } if (peek() === '+') { eat(); return unary(); } return power(); }
  function product() {
    let v = unary();
    while (true) {
      if (peek() === '*' || peek() === '/') { const op = eat(), b = unary(); v = op === '*' ? v * b : v / b; }
      else if (peek() && /^(\(|pi$|e$|sin$|cos$|tan$|log$|ln$|sqrt$|abs$)/.test(peek())) v *= unary();
      else break;
    }
    return v;
  }
  function sum() { let v = product(); while (peek() === '+' || peek() === '-') { const op = eat(), b = product(); v = op === '+' ? v + b : v - b; } return v; }
  const result = sum(); if (p !== tokens.length) throw Error('Syntax'); return result;
}
function factorial(n) { if (n < 0 || n > 170 || n % 1) throw Error('Invalid factorial'); let v = 1; for (let i = 2; i <= n; i++) v *= i; return v; }
function equals() {
  if (!expr) return;
  try {
    const value = calculate(expr), display = format(value);
    history.unshift({ e: expr, r: display }); history = history.slice(0, 20);
    storage.set('cool-calculator-history', history);
    expr = String(Number(display)); justEvaluated = true;
    render(); renderHistory(); $('#resultStatus').textContent = 'LOOKS LIKE AN ANSWER';
  } catch { resultEl.textContent = 'Error'; $('#resultStatus').textContent = 'CHECK YOUR EXPRESSION'; }
}
function renderHistory() {
  $('#historyCount').textContent = history.length;
  $('#clearHistory').disabled = !history.length;
  const list = $('#historyList'); list.replaceChildren();
  if (!history.length) { list.innerHTML = '<div class="empty-state"><span class="empty-icon">≋</span><p>A clean slate.</p><small>Your calculations will land here.<br>Go on, make the first move.</small></div>'; return; }
  history.forEach(item => {
    const button = document.createElement('button'); button.className = 'history-item'; button.title = 'Reuse this expression';
    const expression = document.createElement('span'); expression.className = 'history-expression'; expression.textContent = `${pretty(item.e)} =`;
    const result = document.createElement('span'); result.className = 'history-result'; result.textContent = item.r;
    button.append(expression, result); button.onclick = () => { expr = item.e; justEvaluated = false; render(); };
    list.append(button);
  });
}
function action(name) {
  if (name === 'clear') { expr = ''; justEvaluated = false; }
  if (name === 'backspace') { expr = expr.slice(0, -1); justEvaluated = false; }
  if (name === 'equals') return equals();
  if (name === 'sign') { expr = expr ? `-(${expr})` : '-'; justEvaluated = false; }
  if (name === 'memory-clear') memory = 0;
  if (name === 'memory-recall') return add(`(${memory})`);
  if (name === 'memory-add' || name === 'memory-subtract') {
    try { const next = memory + calculate(expr || '0') * (name === 'memory-add' ? 1 : -1); if (Number.isFinite(next)) memory = next; } catch { /* Incomplete input does not change memory. */ }
  }
  render();
}
document.querySelectorAll('[data-value]').forEach(b => b.onclick = () => add(b.dataset.value));
document.querySelectorAll('[data-action]').forEach(b => b.onclick = () => action(b.dataset.action));
$('#angleToggle').onclick = () => { angle = angle === 'DEG' ? 'RAD' : 'DEG'; render(); };
$('#clearHistory').onclick = () => { history = []; storage.set('cool-calculator-history', history); renderHistory(); };
const savedTheme = storage.get('cool-calculator-theme', 'dark');
document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';
$('#themeToggle').onclick = () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; storage.set('cool-calculator-theme', theme); };
$('#copyResult').onclick = async () => {
  const button = $('#copyResult');
  try { const value = format(calculate(expr || '0')); await navigator.clipboard.writeText(value); button.textContent = '✓ Copied'; }
  catch { button.textContent = 'Cannot copy'; }
  setTimeout(() => { button.innerHTML = '▢ <span>Copy</span>'; }, 1600);
};
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('button,a')) return;
  if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); equals(); }
  else if (event.key === 'Escape') { event.preventDefault(); action('clear'); }
  else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); action('backspace'); }
  else if (/^[0-9.,+\-*/%^()!]$/.test(event.key)) { event.preventDefault(); add(event.key.replace('*', '×').replace('/', '÷').replace('-', '−').replace(',', '.')); }
});
render(); renderHistory();
