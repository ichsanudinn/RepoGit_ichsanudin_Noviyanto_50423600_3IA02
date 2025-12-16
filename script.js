document.addEventListener('DOMContentLoaded', () => {

  // ======= Storage key & helpers =======
  const STORAGE_KEY = 'mahasiswa_planner_tasks_v1';

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function readStorage() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; } }
  function writeStorage(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  // ======= Elements =======
  const courseInput = document.getElementById('course');
  const titleInput = document.getElementById('title');
  const dueInput = document.getElementById('due');
  const prioSelect = document.getElementById('prio');
  const notesInput = document.getElementById('notes');

  const addBtn = document.getElementById('addBtn');
  const clearBtn = document.getElementById('clearBtn');
  const cardList = document.getElementById('cardList');
  const totalCountEl = document.getElementById('totalCount');
  const dueTodayEl = document.getElementById('dueToday');
  const pendingCountEl = document.getElementById('pendingCount');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const filterStatus = document.getElementById('filterStatus');
  const seedBtn = document.getElementById('seedBtn');
  const exportBtn = document.getElementById('exportBtn');

  // modal fields
  const modal = document.getElementById('modal');
  const m_course = document.getElementById('m_course');
  const m_title = document.getElementById('m_title');
  const m_due = document.getElementById('m_due');
  const m_prio = document.getElementById('m_prio');
  const m_notes = document.getElementById('m_notes');
  let editingId = null;

  // theme toggle
  const themeToggle = document.getElementById('themeToggle');
  
  const lucideIcons = () => lucide.createIcons();
  
  // init lucide icons
  lucideIcons();

  // ========== UI Helpers ==========
  function formatDate(d) {
    if (!d) return '-';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

  function daysUntil(d) {
    if (!d) return Infinity;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dt = new Date(d + 'T00:00:00');
    const diff = Math.ceil((dt - today) / (1000 * 60 * 60 * 24));
    return diff;
  }

  // ========== Render ==========
  function renderList() {
    let data = readStorage();

    // filter/search
    const q = searchInput.value.trim().toLowerCase();
    if (q) {
      data = data.filter(t => (t.title + ' ' + t.course + ' ' + (t.notes || '')).toLowerCase().includes(q));
    }
    // status filter
    const status = filterStatus.value;
    if (status === 'pending') data = data.filter(t => !t.done);
    if (status === 'done') data = data.filter(t => t.done);

    // sort
    const sort = sortSelect.value;
    if (sort === 'dueAsc') data.sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    else if (sort === 'dueDesc') data.sort((a, b) => (b.due || '').localeCompare(a.due || ''));
    else if (sort === 'prio') data.sort((a, b) => prioVal(b.prio) - prioVal(a.prio));
    else if (sort === 'course') data.sort((a, b) => a.course.localeCompare(b.course));
    else data.sort((a, b) => b.createdAt - a.createdAt);

    // stats
    const total = readStorage().length;
    const pending = readStorage().filter(t => !t.done).length;
    const todayCount = readStorage().filter(t => {
      if (!t.due) return false;
      return daysUntil(t.due) === 0;
    }).length;
    totalCountEl.textContent = total;
    pendingCountEl.textContent = pending;
    dueTodayEl.textContent = todayCount;

    // render cards
    cardList.innerHTML = '';
    data.forEach(t => {
      const el = document.createElement('div');
      el.className = 'task-card';
      el.style.animation = 'fadeIn .28s ease';
      el.innerHTML = `
        <div class="task-left">
          <div style="width:8px;height:48px;border-radius:6px;background:${prioColor(t.prio)}"></div>
          <div>
            <div style="display:flex;gap:8px;align-items:center">
              <strong style="font-size:15px;color:var(--primary)">${escapeHTML(t.title)}</strong>
              <span class="muted" style="font-size:12px">• ${escapeHTML(t.course)}</span>
              ${t.done ? `<span class="badge" style="background:#2ecc71;color:#fff;">Selesai</span>` : ''}
            </div>
            <div class="task-meta">
              <span>Deadline: ${formatDate(t.due)}</span>
              <span style="margin-left:10px">• ${t.notes ? (t.notes.length > 70 ? escapeHTML(t.notes.slice(0, 70)) + '…' : escapeHTML(t.notes)) : '—'}</span>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="icon-btn" title="Tandai selesai" onclick="window.toggleDone('${t.id}')">
            <i data-lucide="${t.done ? 'check-circle' : 'circle'}"></i>
          </button>
          <button class="icon-btn" title="Edit" onclick="window.openEdit('${t.id}')"><i data-lucide="pencil"></i></button>
          <button class="icon-btn" title="Hapus" onclick="window.removeTask('${t.id}')"><i data-lucide="trash-2"></i></button>
        </div>
      `;
      cardList.appendChild(el);
    });

    lucideIcons(); // render icons
  }

  // ======= Escaping & helpers =======
  function escapeHTML(s) { return (s + '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function prioVal(p) { return p === 'high' ? 3 : (p === 'medium' ? 2 : 1); }
  function prioColor(p) { return p === 'high' ? '#e63946' : (p === 'medium' ? '#ffb020' : '#25b864'); }

  // ========== CRUD ==========
  addBtn.addEventListener('click', () => {
    const course = courseInput.value.trim();
    const title = titleInput.value.trim();
    const due = dueInput.value || null;
    const prio = prioSelect.value;
    const notes = notesInput.value.trim();

    if (!title) { alert('Judul tugas wajib diisi'); return; }

    const data = readStorage();
    data.push({
      id: uid(),
      course, title, due, prio, notes, done: false, createdAt: Date.now()
    });
    writeStorage(data);
    clearForm();
    renderList();
  });

  clearBtn.addEventListener('click', clearForm);
  function clearForm() {
    courseInput.value = '';
    titleInput.value = '';
    dueInput.value = '';
    prioSelect.value = 'medium';
    notesInput.value = '';
  }

  window.removeTask = function (id) {
    if (!confirm('Hapus tugas ini?')) return;
    let data = readStorage();
    data = data.filter(t => t.id !== id);
    writeStorage(data);
    renderList();
  }

  window.openEdit = function (id) {
    const data = readStorage();
    const t = data.find(x => x.id === id);
    if (!t) return alert('Data tidak ditemukan');
    editingId = id;
    m_course.value = t.course || '';
    m_title.value = t.title || '';
    m_due.value = t.due || '';
    m_prio.value = t.prio || 'medium';
    m_notes.value = t.notes || '';
    modal.style.display = 'flex';
  }

  document.getElementById('cancelEdit').addEventListener('click', () => { modal.style.display = 'none'; });
  document.getElementById('saveEdit').addEventListener('click', () => {
    if (!editingId) return;
    const data = readStorage();
    const idx = data.findIndex(x => x.id === editingId);
    if (idx === -1) { alert('Kesalahan edit'); return; }
    data[idx].course = m_course.value.trim();
    data[idx].title = m_title.value.trim() || data[idx].title;
    data[idx].due = m_due.value || null;
    data[idx].prio = m_prio.value;
    data[idx].notes = m_notes.value.trim();
    writeStorage(data);
    modal.style.display = 'none';
    renderList();
  });

  window.toggleDone = function (id) {
    const data = readStorage();
    const idx = data.findIndex(x => x.id === id);
    if (idx === -1) return;
    data[idx].done = !data[idx].done;
    writeStorage(data);
    renderList();
  }

  // ========== Events for toolbar ==========
  searchInput.addEventListener('input', renderList);
  sortSelect.addEventListener('change', renderList);
  filterStatus.addEventListener('change', renderList);

  // seed example data
  seedBtn.addEventListener('click', () => {
    const sample = [
      { id: uid(), course: 'Algoritma', title: 'Laporan Praktikum 3', due: plusDays(1), prio: 'high', notes: 'Analisis kompleksitas & diagram flow', done: false, createdAt: Date.now() - 100000 },
      { id: uid(), course: 'Basis Data', title: 'Quiz Minggu 5', due: plusDays(0), prio: 'medium', notes: 'Pelajari normalisasi', done: false, createdAt: Date.now() - 200000 },
      { id: uid(), course: 'Sistem Operasi', title: 'Tugas Individu', due: plusDays(5), prio: 'low', notes: 'Submit via LMS', done: false, createdAt: Date.now() - 300000 },
      { id: uid(), course: 'Statistika', title: 'Presentasi Kelompok', due: plusDays(2), prio: 'medium', notes: 'Siapkan slides 10 menit', done: false, createdAt: Date.now() - 400000 }
    ];
    writeStorage(sample);
    renderList();
  });

  // export CSV
  exportBtn.addEventListener('click', () => {
    const data = readStorage();
    if (!data.length) return alert('Tidak ada data untuk diekspor');
    const header = ['Course', 'Title', 'Due', 'Priority', 'Done', 'Notes'];
    const rows = data.map(r => [
      `"${(r.course || '').replace(/"/g, '""')}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${r.due || ''}"`,
      `"${r.prio || ''}"`,
      `"${r.done ? 'yes' : 'no'}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',')).join('\n');
    const csv = header.join(',') + '\n' + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tasks.csv'; a.click();
    URL.revokeObjectURL(url);
  });

  // utils
  function plusDays(n) {
    const d = new Date(); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // initial render
  renderList();

  // ======= Theme toggle =======
  function setTheme(t) {
    document.body.setAttribute('data-theme', t);
    localStorage.setItem('planner_theme', t);
    lucideIcons();
  }
  themeToggle.addEventListener('click', () => {
    const cur = document.body.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    // Gunakan class theme-transition (didefinisikan di style.css)
    document.documentElement.classList.add('theme-transition');
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 450);
    setTheme(next);
  });
  // restore theme from storage
  const savedTheme = localStorage.getItem('planner_theme') || 'light';
  setTheme(savedTheme);

  // accessibility: close modal on backdrop click
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  // safety: expose to window for debug (optional)
  window._planner = { readStorage, writeStorage, renderList };
});