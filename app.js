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

function makeCard(b) {
  const isDone = done.has(b.n);
  const hasReview = !!getReview(b.n);
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
    <button class="review-trigger${hasReview ? ' has-review' : ''}" type="button" data-review-n="${b.n}">
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3.5 2.5h7.6c.5 0 1 .2 1.3.6l1.6 1.6c.4.4.6.8.6 1.3v7.5c0 .55-.45 1-1 1h-10c-.55 0-1-.45-1-1v-10c0-.55.45-1 1-1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <span>${hasReview ? 'Моя рецензия' : 'Написать рецензию'}</span>
    </button>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('.review-trigger')) return; // handled separately
    toggle(b.n);
  });
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(b.n); } });

  const reviewBtn = card.querySelector('.review-trigger');
  reviewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openReviewModal(b);
  });

  return card;
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

    // Build sub-groups: consecutive runs sharing the same `group` field get their own
    // labeled cluster (e.g. "Платон · диалоги"); ungrouped books fall into one shared grid.
    let i = 0;
    while (i < group.length) {
      const b0 = group[i];

      if (b0.group) {
        const runGroupName = b0.group;
        const run = [];
        while (i < group.length && group[i].group === runGroupName) {
          run.push(group[i]);
          i++;
        }

        const cluster = document.createElement('div');
        cluster.className = 'subgroup-cluster';

        const clusterHead = document.createElement('div');
        clusterHead.className = 'subgroup-header';
        clusterHead.innerHTML = `<span class="subgroup-name">${runGroupName}</span><span class="subgroup-count">${run.length} текстов · читать в этом порядке</span>`;
        cluster.appendChild(clusterHead);

        const subGrid = document.createElement('div');
        subGrid.className = 'books-grid subgroup-grid';

        let lastNote = null;
        run.forEach(b => {
          if (b.groupNote && b.groupNote !== lastNote) {
            const noteEl = document.createElement('div');
            noteEl.className = 'subgroup-note';
            noteEl.textContent = b.groupNote;
            subGrid.appendChild(noteEl);
            lastNote = b.groupNote;
          }
          subGrid.appendChild(makeCard(b));
        });

        cluster.appendChild(subGrid);
        section.appendChild(cluster);
      } else {
        const run = [];
        while (i < group.length && !group[i].group) {
          run.push(group[i]);
          i++;
        }
        const grid = document.createElement('div');
        grid.className = 'books-grid';
        run.forEach(b => grid.appendChild(makeCard(b)));
        section.appendChild(grid);
      }
    }

    list.appendChild(section);
  });
}

// ── Reviews ──────────────────────────────────────────────────────
const REVIEWS_KEY = 'philos-reader-reviews-v1';
let reviews = {};
let activeReviewBook = null;
let saveTimer = null;

function loadReviews() {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    if (raw) reviews = JSON.parse(raw);
  } catch (e) {}
}

function saveReviews() {
  try {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  } catch (e) {}
}

function getReview(n) {
  return (reviews[n] || '').trim();
}

function setReview(n, text) {
  const trimmed = text.trim();
  if (trimmed) reviews[n] = text;
  else delete reviews[n];
  saveReviews();
}

function openReviewModal(book) {
  activeReviewBook = book;
  const overlay   = document.getElementById('review-overlay');
  const numEl     = document.getElementById('review-num');
  const titleEl   = document.getElementById('review-modal-title');
  const authorEl  = document.getElementById('review-author');
  const textarea  = document.getElementById('review-textarea');
  const statusEl  = document.getElementById('review-status');

  numEl.textContent    = '№ ' + book.n;
  titleEl.textContent  = book.t;
  authorEl.textContent = book.a + ' · ' + book.y;
  textarea.value       = getReview(book.n);
  statusEl.textContent = '';

  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => textarea.focus(), 50);
}

function closeReviewModal() {
  const overlay = document.getElementById('review-overlay');
  overlay.hidden = true;
  document.body.style.overflow = '';
  if (activeReviewBook) {
    // refresh just this card so the "has review" indicator updates
    const card = document.querySelector(`.book-card[data-n="${activeReviewBook.n}"]`);
    if (card) {
      const btn = card.querySelector('.review-trigger');
      const has = !!getReview(activeReviewBook.n);
      btn.classList.toggle('has-review', has);
      btn.querySelector('span').textContent = has ? 'Моя рецензия' : 'Написать рецензию';
    }
  }
  activeReviewBook = null;
}

function saveActiveReview(showStatus) {
  if (!activeReviewBook) return;
  const textarea = document.getElementById('review-textarea');
  setReview(activeReviewBook.n, textarea.value);
  if (showStatus) {
    const statusEl = document.getElementById('review-status');
    statusEl.textContent = 'Сохранено';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { statusEl.textContent = ''; }, 1500);
  }
}

function initReviewModal() {
  const overlay     = document.getElementById('review-overlay');
  const closeBtn    = document.getElementById('review-close-btn');
  const cancelBtn   = document.getElementById('review-cancel-btn');
  const saveBtn     = document.getElementById('review-save-btn');
  const textarea    = document.getElementById('review-textarea');

  const doClose = () => { saveActiveReview(false); closeReviewModal(); };

  closeBtn.addEventListener('click', doClose);
  cancelBtn.addEventListener('click', doClose);
  saveBtn.addEventListener('click', () => saveActiveReview(true));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) doClose();
  });

  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') doClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveActiveReview(true);
  });

  // autosave while typing (debounced), no status flash to avoid noise
  textarea.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveActiveReview(false), 600);
  });
}

// ── Init ──────────────────────────────────────────────────────────
loadProgress();
loadReviews();
initReviewModal();
updateStats();
render();
