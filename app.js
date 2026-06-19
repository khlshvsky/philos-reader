const STORAGE_KEY = 'philos-reader-done-v1';

let done = new Set();
let currentEra = 'all';

// ── Storage ──────────────────────────────────────────────────────
function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
  } catch (e) {}
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) done = new Set(JSON.parse(raw));
  } catch (e) {}
}

function resetProgress() {
  if (!confirm('Сбросить весь прогресс чтения?')) return;
  done.clear();
  saveProgress();
  updateStats();
  render();
}

// ── Stats ─────────────────────────────────────────────────────────
function updateStats() {
  const doneCount = done.size;
  const totalHours = BOOKS.filter(b => done.has(b.n)).reduce((s, b) => s + b.h, 0);
  const leftHours  = BOOKS.filter(b => !done.has(b.n)).reduce((s, b) => s + b.h, 0);
  const pct = Math.round(doneCount / BOOKS.length * 100);

  document.getElementById('s-done').textContent  = doneCount;
  document.getElementById('s-total').textContent = BOOKS.length;
  document.getElementById('s-hours').textContent = totalHours;
  document.getElementById('s-left').textContent  = leftHours;
  document.getElementById('prog').style.width    = pct + '%';
}

// ── Filter / search ───────────────────────────────────────────────
function setEra(era, btn) {
  currentEra = era;
  document.querySelectorAll('.era-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function filteredBooks() {
  const q = document.getElementById('search-inp').value.toLowerCase().trim();
  return BOOKS.filter(b => {
    const eraMatch = currentEra === 'all' || b.era === currentEra;
    const textMatch = !q || b.t.toLowerCase().includes(q) || b.a.toLowerCase().includes(q);
    return eraMatch && textMatch;
  });
}

// ── Toggle ────────────────────────────────────────────────────────
function toggle(n) {
  if (done.has(n)) done.delete(n);
  else done.add(n);
  saveProgress();
  updateStats();
  // update just this card
  const card = document.querySelector(`.book-card[data-n="${n}"]`);
  if (card) updateCard(card, n);
}

function updateCard(card, n) {
  const isDone = done.has(n);
  card.classList.toggle('done', isDone);
  const chk = card.querySelector('.check');
  if (chk) chk.innerHTML = isDone
    ? `<svg viewBox="0 0 14 14" fill="none"><polyline points="2,7 6,11 12,3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : '';
}

// ── Render ────────────────────────────────────────────────────────
function render() {
  const books = filteredBooks();
  const list  = document.getElementById('book-list');
  list.innerHTML = '';

  if (books.length === 0) {
    list.innerHTML = '<p class="empty">Ничего не найдено</p>';
    return;
  }

  const eras = ERA_ORDER.filter(e => books.some(b => b.era === e));

  eras.forEach(era => {
    const group = books.filter(b => b.era === era);
    const meta  = ERA_META[era];

    const section = document.createElement('section');
    section.className = 'era-section';

    const header = document.createElement('div');
    header.className = 'era-section-header';
    header.innerHTML = `
      <div class="era-dot" style="background:${meta.color}"></div>
      <div>
        <h2 class="era-name">${era}</h2>
        <span class="era-dates">${meta.dates} · ${group.length} книг</span>
      </div>
    `;
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'books-grid';

    group.forEach(b => {
      const isDone = done.has(b.n);
      const card = document.createElement('div');
      card.className = 'book-card' + (isDone ? ' done' : '');
      card.dataset.n = b.n;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${b.t} — ${b.a}. ${isDone ? 'Прочитано' : 'Не прочитано'}`);

      card.innerHTML = `
        <div class="card-top">
          <span class="book-num">${b.n}</span>
          ${b.isNew ? '<span class="new-tag">новое</span>' : ''}
          <button class="check" aria-label="Отметить прочитанным">
            ${isDone ? `<svg viewBox="0 0 14 14" fill="none"><polyline points="2,7 6,11 12,3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
          </button>
        </div>
        <div class="card-body">
          <h3 class="book-title">${b.t}</h3>
          <p class="book-author">${b.a}</p>
        </div>
        <div class="card-foot">
          <span class="book-year">${b.y}</span>
          <span class="book-hours">${b.h} ч</span>
        </div>
      `;

      card.addEventListener('click', () => toggle(b.n));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(b.n); } });

      grid.appendChild(card);
    });

    section.appendChild(grid);
    list.appendChild(section);
  });
}

// ── Init ──────────────────────────────────────────────────────────
loadProgress();
updateStats();
render();
