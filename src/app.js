(() => {
  const KEY = 'budget-tracker-v1';
  const CATS = [
    { id: 'boodschappen', name: 'Boodschappen', icon: '<path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>' },
    { id: 'leuk', name: 'Leuke Dingen', icon: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8c-1.5-3-5-4-5-1.5S10 8 12 8zm0 0c1.5-3 5-4 5-1.5S14 8 12 8z"/>' },
    { id: 'benzine', name: 'Benzine', icon: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M7 7h5v4H7zM15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3"/>' },
  ];

  const load = () => {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.budgets) return d; } catch (e) {}
    return { budgets: { boodschappen: 500, leuk: 250, benzine: 200 }, startDay: 25, items: [] };
  };
  let state = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

  const $ = (id) => document.getElementById(id);
  const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
  const money = (n) => eur.format(n).replace(/ /g, ' ');
  const dShort = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });
  const dLong = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const DAY = 86400000;
  const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };

  let offset = 0; // 0 = huidige periode
  let mode = 'week';

  function periodOf(o) {
    const t = today(), sd = state.startDay;
    let start = new Date(t.getFullYear(), t.getMonth() - (t.getDate() < sd ? 1 : 0), sd);
    start = new Date(start.getFullYear(), start.getMonth() + o, sd);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, sd - 1);
    const days = Math.round((end - start) / DAY) + 1;
    return { start, end, days };
  }
  const inRange = (s, a, b) => { const d = parseIso(s); return d >= a && d <= b; };
  const total = () => CATS.reduce((s, c) => s + (state.budgets[c.id] || 0), 0);
  const pct = (a, b) => (b > 0 ? Math.max(0, Math.round((a / b) * 100)) : 0);

  function bar(el, p) {
    el.style.transform = `scaleX(${Math.min(p, 100) / 100})`;
    el.classList.toggle('over', p > 100);
  }

  function render() {
    const P = periodOf(offset);
    const items = state.items.filter((i) => inRange(i.date, P.start, P.end));
    const spentBy = Object.fromEntries(CATS.map((c) => [c.id, 0]));
    items.forEach((i) => { spentBy[i.cat] = (spentBy[i.cat] || 0) + i.amount; });
    const budget = total();
    const spent = Object.values(spentBy).reduce((a, b) => a + b, 0);
    const left = budget - spent;
    const p = pct(spent, budget);

    $('periodLabel').textContent = `${dShort.format(P.start)} – ${dLong.format(P.end)}`;
    $('periodSub').textContent = offset === 0 ? `Budgetperiode (${P.days} dagen)` : offset < 0 ? 'Eerdere periode' : 'Volgende periode';
    $('next').disabled = offset >= 0;

    $('ringFill').style.strokeDashoffset = 326.73 * (1 - Math.min(p, 100) / 100);
    $('ring').classList.toggle('over', p > 100);
    $('ringPct').textContent = `${p}%`;
    $('tBudget').textContent = money(budget);
    $('tSpent').textContent = money(spent);
    $('tLeft').textContent = money(left);
    $('tLeftRow').classList.toggle('over', left < 0);

    $('cats').innerHTML = CATS.map((c) => {
      const b = state.budgets[c.id] || 0, s = spentBy[c.id], r = b - s, cp = pct(s, b);
      return `<li class="cat" data-cat="${c.id}">
        <span class="cat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${c.icon}</svg></span>
        <div><h2>${c.name}</h2><span class="budget num">Budget: ${money(b)}</span></div>
        <div><div class="spent num">${money(s)}</div><div class="rest num${r < 0 ? ' over' : ''}">${r < 0 ? 'Te veel' : 'Resterend'}: ${money(Math.abs(r))}</div></div>
        <div class="bar"><div class="bar-track"><div class="bar-fill${cp > 100 ? ' over' : ''}" style="transform:scaleX(${Math.min(cp, 100) / 100})"></div></div><span class="pct num">${cp}%</span></div>
      </li>`;
    }).join('');

    // per week / per dag: wat er nog over is, verdeeld over de resterende dagen
    const t = today();
    const daysLeft = offset === 0 ? Math.max(1, Math.round((P.end - t) / DAY) + 1) : P.days;
    const factor = mode === 'week' ? Math.min(7, daysLeft) / daysLeft : 1 / daysLeft;
    $('allow').innerHTML = CATS.map((c) => {
      const r = Math.max(0, (state.budgets[c.id] || 0) - spentBy[c.id]);
      return `<li class="num"><span>${c.name}</span><strong>${money(r * factor)}</strong></li>`;
    }).join('');
    $('allowNote').textContent = offset === 0
      ? `Nog ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagen'} in deze periode.`
      : 'Verdeeld over de hele periode.';

    // voortgang
    const ref = offset === 0 ? t : P.start;
    const wStart = new Date(ref.getTime() - ((ref.getDay() + 6) % 7) * DAY);
    const wEnd = new Date(wStart.getTime() + 6 * DAY);
    const wSpent = state.items.filter((i) => inRange(i.date, wStart, wEnd)).reduce((a, i) => a + i.amount, 0);
    const wBudget = (budget / P.days) * 7;
    const wp = pct(wSpent, wBudget);
    $('weekRange').textContent = `(${dShort.format(wStart)} – ${dShort.format(wEnd)})`;
    $('weekNums').textContent = `${money(wSpent)} / ${money(wBudget)}`;
    $('weekPct').textContent = `${wp}%`; bar($('weekBar'), wp);
    $('monthRange').textContent = `(${dShort.format(P.start)} – ${dShort.format(P.end)})`;
    $('monthNums').textContent = `${money(spent)} / ${money(budget)}`;
    $('monthPct').textContent = `${p}%`; bar($('monthBar'), p);

    // lijst
    const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    $('items').innerHTML = sorted.map((i) => {
      const c = CATS.find((x) => x.id === i.cat);
      const label = i.note ? escapeHtml(i.note) : c.name;
      return `<li class="item" data-cat="${i.cat}"><span class="swatch" aria-hidden="true"></span>
        <div class="what">${label}<span>${c.name}, ${dShort.format(parseIso(i.date))}</span></div>
        <span class="amt num${i.amount < 0 ? ' plus' : ''}">${i.amount < 0 ? '+ ' + money(-i.amount) : money(i.amount)}</span>
        <button class="icon-btn" type="button" data-del="${i.id}" aria-label="Verwijder ${label} ${money(Math.abs(i.amount))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
        </button></li>`;
    }).join('');
    $('empty').hidden = sorted.length > 0;
    $('reset').disabled = state.items.length === 0;
  }

  function escapeHtml(s) { return s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  const num = (s) => {
    let t = String(s).replace(/[\s€]/g, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : NaN;
  };

  // periode wisselen
  $('prev').addEventListener('click', () => { offset--; render(); });
  $('next').addEventListener('click', () => { if (offset < 0) { offset++; render(); } });

  // tabs
  const setMode = (m) => {
    mode = m;
    $('tabWeek').setAttribute('aria-selected', m === 'week');
    $('tabDay').setAttribute('aria-selected', m === 'dag');
    render();
  };
  $('tabWeek').addEventListener('click', () => setMode('week'));
  $('tabDay').addEventListener('click', () => setMode('dag'));

  // afboeken
  $('choices').innerHTML = CATS.map((c, i) => `<label class="choice" data-cat="${c.id}"><input type="radio" name="cat" value="${c.id}"${i === 0 ? ' checked' : ''}><span>${c.name}</span></label>`).join('');
  const book = $('book'), openBtn = $('openBook'), bijBtn = $('openBij');
  let bookMode = 'af';
  const showBook = (show, m) => {
    if (m) bookMode = m;
    book.hidden = !show; $('actions').hidden = show;
    openBtn.setAttribute('aria-expanded', show && bookMode === 'af');
    bijBtn.setAttribute('aria-expanded', show && bookMode === 'bij');
    if (show) {
      $('bookTitle').textContent = bookMode === 'bij' ? 'Bedrag bijboeken' : 'Uitgave afboeken';
      $('bookHint').hidden = bookMode !== 'bij';
      $('note').placeholder = bookMode === 'bij' ? 'bv. statiegeld terug' : 'bv. Albert Heijn';
      $('date').value = iso(today()); $('amount').focus();
    } else {
      book.reset(); $('amountErr').textContent = ''; $('amount').removeAttribute('aria-invalid');
      (bookMode === 'bij' ? bijBtn : openBtn).focus();
    }
  };
  openBtn.addEventListener('click', () => showBook(true, 'af'));
  bijBtn.addEventListener('click', () => showBook(true, 'bij'));
  $('cancelBook').addEventListener('click', () => showBook(false));
  book.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = Math.round(num($('amount').value) * 100) / 100;
    if (!(amount > 0)) {
      $('amountErr').textContent = 'Vul een bedrag in, bijvoorbeeld 12,50.';
      $('amount').setAttribute('aria-invalid', 'true'); $('amount').focus(); return;
    }
    const cat = book.querySelector('input[name="cat"]:checked').value;
    const bij = bookMode === 'bij';
    state.items.push({ id: Date.now(), amount: bij ? -amount : amount, cat, note: $('note').value.trim(), date: $('date').value || iso(today()) });
    save(); offset = 0; showBook(false); render();
    toast(`${money(amount)} ${bij ? 'bijgeboekt' : 'afgeboekt'}`, null);
  });

  // reset: alle uitgaven wissen, met ongedaan maken
  $('reset').addEventListener('click', () => {
    if (!state.items.length) return;
    const backup = state.items;
    state.items = []; save(); offset = 0; render();
    toast(`${backup.length} ${backup.length === 1 ? 'boeking' : 'boekingen'} gewist`, () => { state.items = backup; save(); render(); });
  });

  // verwijderen met ongedaan maken
  $('items').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const id = Number(b.dataset.del);
    const idx = state.items.findIndex((i) => i.id === id); if (idx < 0) return;
    const [removed] = state.items.splice(idx, 1);
    save(); render();
    toast(`${money(removed.amount)} verwijderd`, () => { state.items.push(removed); save(); render(); });
  });

  let toastTimer;
  function toast(text, undo) {
    $('toastText').textContent = text;
    $('undo').hidden = !undo;
    $('undo').onclick = () => { if (undo) undo(); $('toast').hidden = true; };
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
  }

  // instellingen
  const fillSettings = () => {
    $('bBood').value = state.budgets.boodschappen; $('bLeuk').value = state.budgets.leuk;
    $('bBenz').value = state.budgets.benzine; $('startDay').value = state.startDay;
  };
  fillSettings();
  $('settings').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (id, d) => { const n = num($(id).value); return n >= 0 ? n : d; };
    state.budgets = { boodschappen: v('bBood', 500), leuk: v('bLeuk', 250), benzine: v('bBenz', 200) };
    const sd = parseInt($('startDay').value, 10);
    state.startDay = sd >= 1 && sd <= 28 ? sd : state.startDay;
    save(); fillSettings(); offset = 0; render();
    toast('Instellingen bewaard', null);
  });

  render();
})();
