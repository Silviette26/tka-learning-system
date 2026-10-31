let APP = { user: null, mapel: [], kategori: [], guru: [], bank: [] };

document.addEventListener('DOMContentLoaded', () => {
  if (!window.google || !google.script || !google.script.run) {
    showMessage('loginMessage', 'API Bridge belum berhasil dimuat. Periksa koneksi dan URL Worker.');
    return;
  }

  google.script.run
    .withSuccessHandler(data => {
      APP.mapel = data.mapel || [];
      APP.kategori = data.kategori || [];
      APP.guru = data.guru || [];
      renderSubjects();
      populateMapelSelects();
    })
    .withFailureHandler(err => showMessage('loginMessage', err.message || 'Gagal mengambil data awal.'))
    .getBootstrapData();

  document.getElementById('qType').addEventListener('change', () => {
    const type = document.getElementById('qType').value;
    document.getElementById('optionsArea').style.display = type === 'PG' ? 'block' : 'none';
  });

  document.getElementById('filterMapel').addEventListener('change', () => {
    populateFilterCategories();
    loadBank();
  });
  document.getElementById('filterKategori').addEventListener('change', loadBank);
  document.getElementById('qMapel').addEventListener('change', populateQuestionCategories);
});

function showMessage(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message || '';
}

function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  showMessage('loginMessage', 'Memeriksa...');

  google.script.run
    .withSuccessHandler(res => {
      if (!res || !res.ok) {
        showMessage('loginMessage', res && res.message ? res.message : 'Login gagal.');
        return;
      }
      APP.user = res.user;
      document.getElementById('loginPage').classList.add('hidden');
      document.getElementById('mainPage').classList.remove('hidden');
      document.getElementById('userName').textContent = res.user.nama || '';
      document.getElementById('userRole').textContent = res.user.role || '';
      showView('dashboard');
    })
    .withFailureHandler(err => showMessage('loginMessage', err.message || 'Login gagal.'))
    .login(username, password);
}

function logout() {
  APP.user = null;
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('password').value = '';
  showMessage('loginMessage', '');
}

function showView(name, button) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(name + 'View');
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  if (button) button.classList.add('active');
  else {
    const nav = [...document.querySelectorAll('.nav-item')].find(b => b.getAttribute('onclick')?.includes(`'${name}'`));
    if (nav) nav.classList.add('active');
  }
  if (name === 'bankSoal') loadBank();
}

function renderSubjects() {
  const box = document.getElementById('subjectGrid');
  box.innerHTML = APP.mapel.map(m => `
    <div class="subject-card">
      <div class="subject-code">${escapeHtml(m.kode)}</div>
      <div class="subject-name">${escapeHtml(m.namaMapel)}</div>
      <div class="muted" style="margin-top:8px">Bank soal &amp; evaluasi TKA</div>
    </div>`).join('');
}

function populateMapelSelects() {
  ['qMapel', 'filterMapel'].forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = '<option value="">Semua / pilih mapel</option>' +
      APP.mapel.map(m => `<option value="${escapeHtml(m.idMapel)}">${escapeHtml(m.namaMapel)}</option>`).join('');
  });
  populateQuestionCategories();
  populateFilterCategories();
}

function populateQuestionCategories() {
  const mapelId = document.getElementById('qMapel').value;
  const el = document.getElementById('qKategori');
  const cats = APP.kategori.filter(k => !mapelId || String(k.idMapel) === String(mapelId));
  el.innerHTML = cats.map(k => `<option value="${escapeHtml(k.idKategori)}">${escapeHtml(k.namaKategori)}</option>`).join('');
}

function populateFilterCategories() {
  const mapelId = document.getElementById('filterMapel').value;
  const el = document.getElementById('filterKategori');
  const cats = APP.kategori.filter(k => !mapelId || String(k.idMapel) === String(mapelId));
  el.innerHTML = '<option value="">Semua kategori</option>' +
    cats.map(k => `<option value="${escapeHtml(k.idKategori)}">${escapeHtml(k.namaKategori)}</option>`).join('');
}

function insertMath(latex) {
  const mf = document.getElementById('mathQuestion');
  if (!mf) return;
  mf.executeCommand(['insert', latex]);
  mf.focus();
}

function saveQuestion() {
  const mf = document.getElementById('mathQuestion');
  const data = {
    mapelId: document.getElementById('qMapel').value,
    kategoriId: document.getElementById('qKategori').value,
    guruId: APP.user ? APP.user.idUser : '',
    tipe: document.getElementById('qType').value,
    pertanyaan: mf.value || '',
    opsiA: document.getElementById('optA').value,
    opsiB: document.getElementById('optB').value,
    opsiC: document.getElementById('optC').value,
    opsiD: document.getElementById('optD').value,
    jawaban: document.getElementById('qAnswer').value,
    bobot: document.getElementById('qWeight').value,
    tingkat: document.getElementById('qLevel').value
  };

  if (!data.mapelId || !data.kategoriId || !data.pertanyaan.trim()) {
    showMessage('saveMessage', 'Mapel, kategori, dan pertanyaan wajib diisi.');
    return;
  }

  showMessage('saveMessage', 'Menyimpan...');
  google.script.run
    .withSuccessHandler(res => {
      showMessage('saveMessage', 'Soal berhasil disimpan: ' + (res.idSoal || ''));
      clearQuestionForm(false);
    })
    .withFailureHandler(err => showMessage('saveMessage', err.message || 'Gagal menyimpan soal.'))
    .saveQuestion(data);
}

function clearQuestionForm(clearMessage = true) {
  document.getElementById('mathQuestion').value = '';
  ['optA', 'optB', 'optC', 'optD'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('qWeight').value = 1;
  if (clearMessage) showMessage('saveMessage', '');
}

function loadBank() {
  const mapelId = document.getElementById('filterMapel').value;
  const kategoriId = document.getElementById('filterKategori').value;
  const box = document.getElementById('bankList');
  box.innerHTML = '<div class="card">Memuat bank soal...</div>';

  google.script.run
    .withSuccessHandler(rows => {
      APP.bank = rows || [];
      if (!APP.bank.length) {
        box.innerHTML = '<div class="card empty-state"><h3>Belum ada soal</h3><p class="muted">Buat soal pertama dari menu + Buat Soal.</p></div>';
        return;
      }
      box.innerHTML = APP.bank.map((q, i) => `
        <div class="question-item">
          <div class="question-meta">
            <span class="tag">${escapeHtml(getMapelName(q.idMapel))}</span>
            <span class="tag">${escapeHtml(getCategoryName(q.idKategori))}</span>
            <span class="tag">${escapeHtml(q.tipe)}</span>
            <span class="tag">${escapeHtml(q.tingkat)}</span>
          </div>
          <div><b>${i + 1}.</b> ${renderQuestion(q.pertanyaan)}</div>
          ${q.tipe === 'PG' ? `<div style="margin-top:12px;line-height:1.7">
            A. ${escapeHtml(q.opsiA)}<br>B. ${escapeHtml(q.opsiB)}<br>
            C. ${escapeHtml(q.opsiC)}<br>D. ${escapeHtml(q.opsiD)}
          </div>` : ''}
        </div>`).join('');
      if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([box]);
    })
    .withFailureHandler(err => {
      box.innerHTML = `<div class="card empty-state">${escapeHtml(err.message || 'Gagal memuat bank soal.')}</div>`;
    })
    .getQuestionBank({ mapelId, kategoriId });
}

function getMapelName(id) {
  const x = APP.mapel.find(m => String(m.idMapel) === String(id));
  return x ? x.namaMapel : id;
}
function getCategoryName(id) {
  const x = APP.kategori.find(k => String(k.idKategori) === String(id));
  return x ? x.namaKategori : id;
}
function renderQuestion(latex) {
  if (!latex) return '';
  return '\\(' + escapeHtml(latex) + '\\)';
}
function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
