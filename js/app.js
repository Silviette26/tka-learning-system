let APP={user:null,mapel:[],kategori:[],guru:[],bank:[],exams:[],studentExams:[],attempt:null,timer:null,currentIndex:0,answers:{},imageBaseUrl:''};
// =====================================
// SESSION PERSISTENCE
// =====================================

const TKA_SESSION_KEY = 'TKA_LOGIN_SESSION';
const TKA_VIEW_KEY = 'TKA_LAST_VIEW';

function saveLoginSession(user) {
  try {
    localStorage.setItem(TKA_SESSION_KEY, JSON.stringify({
      user: user,
      savedAt: Date.now()
    }));
  } catch (e) {
    console.error('Gagal menyimpan sesi:', e);
  }
}

function getLoginSession() {
  try {
    const raw = localStorage.getItem(TKA_SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw);

    // Masa sesi browser: 12 jam
    const maxAge = 12 * 60 * 60 * 1000;

    if (!session.user || !session.savedAt ||
        Date.now() - session.savedAt > maxAge) {
      clearLoginSession();
      return null;
    }

    return session.user;
  } catch (e) {
    clearLoginSession();
    return null;
  }
}

function clearLoginSession() {
  localStorage.removeItem(TKA_SESSION_KEY);
  localStorage.removeItem(TKA_VIEW_KEY);
}

function restoreLoginSession() {
  const user = getLoginSession();

  if (!user) return;

  APP.user = user;

  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainPage').classList.remove('hidden');

  document.getElementById('userName').textContent = user.nama;
  document.getElementById('userRole').textContent = user.role;

  let lastView = localStorage.getItem(TKA_VIEW_KEY);

  if (user.role === 'SISWA') {
    document.getElementById('teacherSidebar').classList.add('hidden');
    document.getElementById('studentSidebar').classList.remove('hidden');

    document.getElementById('studentHomeName').textContent = user.nama;

    // Jika sebelumnya sedang mengerjakan ujian,
    // arahkan ke daftar ujian agar bisa melanjutkan.
    if (lastView === 'studentWork' || lastView === 'studentResult') {
      lastView = 'studentExams';
    }

    if (!['studentHome', 'studentExams'].includes(lastView)) {
      lastView = 'studentHome';
    }
  } else {
    document.getElementById('teacherSidebar').classList.remove('hidden');
    document.getElementById('studentSidebar').classList.add('hidden');

    if (!['dashboard', 'bankSoal', 'kategori', 'buatSoal', 'ujian', 'analisisTes'].includes(lastView)) {
      lastView = 'dashboard';
    }
  }

  showView(lastView);
}
document.addEventListener('DOMContentLoaded', () => {

  google.script.run
    .withSuccessHandler(d => {
      APP.mapel = d.mapel || [];
      APP.kategori = d.kategori || [];
      APP.guru = d.guru || [];
      APP.imageBaseUrl = d.imageBaseUrl || '';

      renderSubjects();
      populateMapelSelects();
      populatePercentOptions();
      renderQuestionTypeFields();
      initQuestionEditor();
    })
    .getBootstrapData();

  const t = document.getElementById('qType');
  if (t) {
    t.addEventListener('change', renderQuestionTypeFields);
  }

  // Pulihkan sesi setelah halaman dimuat
  restoreLoginSession();

});
function doLogin() {
  const msg = document.getElementById('loginMessage');
  msg.textContent = 'Memeriksa...';

  google.script.run
    .withSuccessHandler(r => {

      if (!r.ok) {
        msg.textContent = r.message;
        return;
      }

      APP.user = r.user;

      // Simpan sesi tanpa menyimpan password
      saveLoginSession(r.user);

      if (r.user.role === 'SISWA') {
        localStorage.setItem(TKA_VIEW_KEY, 'studentHome');
      } else {
        localStorage.setItem(TKA_VIEW_KEY, 'dashboard');
      }

      document.getElementById('loginPage').classList.add('hidden');
      document.getElementById('mainPage').classList.remove('hidden');

      document.getElementById('userName').textContent = r.user.nama;
      document.getElementById('userRole').textContent = r.user.role;

      if (r.user.role === 'SISWA') {
        document.getElementById('teacherSidebar').classList.add('hidden');
        document.getElementById('studentSidebar').classList.remove('hidden');

        document.getElementById('studentHomeName').textContent = r.user.nama;

        showView('studentHome');
      } else {
        document.getElementById('teacherSidebar').classList.remove('hidden');
        document.getElementById('studentSidebar').classList.add('hidden');

        showView('dashboard');
      }

    })
    .withFailureHandler(e => {
      msg.textContent = e.message || 'Terjadi kesalahan saat login.';
    })
    .login(
      document.getElementById('username').value,
      document.getElementById('password').value
    );
}
function logout() {
  if (APP.timer) clearInterval(APP.timer);

  // Hapus sesi tersimpan
  clearLoginSession();

  APP = {
    user: null,
    mapel: [],
    kategori: [],
    guru: [],
    bank: [],
    exams: [],
    studentExams: [],
    attempt: null,
    timer: null,
    currentIndex: 0,
    answers: {},
    imageBaseUrl: ''
  };

  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');

  document.getElementById('password').value = '';
}
function toggleNavGroup(button) {
  const group = button.closest('.nav-group');
  if (!group) return;

  const isOpen = group.classList.toggle('is-open');
  button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function showView(name, button) {
  if (APP.user) {
  localStorage.setItem(TKA_VIEW_KEY, name);
}
  if (name === 'analisisTes') {
  loadAnalysisExams();
}
  document.querySelectorAll('.view').forEach(v => {
    v.classList.add('hidden');
  });

  const target = document.getElementById(name + 'View');
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.remove('active');
  });

  document.querySelectorAll('.nav-group-toggle').forEach(b => {
    b.classList.remove('is-active');
  });

  if (button) {
    button.classList.add('active');

    const group = button.closest('.nav-group');
    if (group) {
      group.classList.add('is-open');

      const toggle = group.querySelector('.nav-group-toggle');
      if (toggle) {
        toggle.classList.add('is-active');
        toggle.setAttribute('aria-expanded', 'true');
      }
    }
  }

  if (name === 'bankSoal') loadBank();
  if (name === 'kategori') renderCategoryList();
  if (name === 'ujian') loadExams();
  if (name === 'studentHome' || name === 'studentExams') {
    loadStudentExams();
  }

  queueMathTypeset();
}
function renderSubjects(){document.getElementById('subjectGrid').innerHTML=APP.mapel.map(m=>`<div class="subject-card"><div class="subject-code">${escapeHtml(m.kode)}</div><div class="subject-name">${escapeHtml(m.namaMapel)}</div><div class="muted" style="margin-top:8px">Bank soal & evaluasi TKA</div></div>`).join('');}
function populateMapelSelects(){['qMapel','filterMapel','examMapel','catMapel'].forEach(id=>{const e=document.getElementById(id);if(!e)return;e.innerHTML='<option value="">Pilih mata pelajaran</option>'+APP.mapel.map(m=>`<option value="${m.idMapel}">${escapeHtml(m.namaMapel)}</option>`).join('');});populateQuestionCategories();populateFilterCategories();}
function populateQuestionCategories(){const id=document.getElementById('qMapel').value,e=document.getElementById('qKategori');const cats=APP.kategori.filter(k=>k.idMapel===id);e.innerHTML='<option value="">Pilih kategori</option>'+cats.map(k=>`<option value="${k.idKategori}">${escapeHtml(k.namaKategori)}</option>`).join('');}
function populateFilterCategories(){const id=document.getElementById('filterMapel').value,e=document.getElementById('filterKategori');if(!e)return;e.innerHTML='<option value="">Semua kategori</option>'+APP.kategori.filter(k=>k.idMapel===id).map(k=>`<option value="${k.idKategori}">${escapeHtml(k.namaKategori)}</option>`).join('');}
function onFilterMapelChange(){populateFilterCategories();loadBank();}
function populatePercentOptions(){const vals=[-75,-50,-25,0,25,33,34,50];document.querySelectorAll('.score-percent').forEach(e=>{e.innerHTML=vals.map(v=>`<option value="${v}">${v>0?'+':''}${v}%</option>`).join('');});['cPctA','cPctB','cPctC','cPctD','tAPct','tBPct','tCPct','tDPct'].forEach((id,i)=>{const e=document.getElementById(id);if(e)e.value=[50,50,-25,-25][i]??0;});}
function initQuestionEditor(){
  const editor=document.getElementById('questionEditor'),mathBtn=document.getElementById('mathToolBtn');
  if(!editor)return; APP.questionEditor=editor; if(!editor.dataset.exitBound){editor.dataset.exitBound='1';editor.addEventListener('mousedown',e=>{if(!e.target.closest('math-field')&&APP.activeMathField&&APP.activeMathField.closest('#questionEditor')){APP.activeMathField.blur();clearActiveMathField(APP.activeMathField);}});}
  editor.addEventListener('input',()=>{syncHiddenQuestion();queueMathTypeset();});
  ['keyup','mouseup','focus'].forEach(ev=>editor.addEventListener(ev,rememberQuestionSelection));
  if(mathBtn)mathBtn.addEventListener('mousedown',rememberQuestionSelection);
}
function rememberQuestionSelection(){const editor=document.getElementById('questionEditor'),sel=window.getSelection();if(!editor||!sel||!sel.rangeCount)return;const range=sel.getRangeAt(0);if(editor.contains(range.commonAncestorContainer))APP.questionSelection=range.cloneRange();}
function restoreQuestionSelection(){const editor=document.getElementById('questionEditor'),sel=window.getSelection();if(!editor||!sel)return;sel.removeAllRanges();if(APP.questionSelection){try{sel.addRange(APP.questionSelection);return;}catch(e){}}const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);sel.addRange(range);}
function toggleMathPalette(ev){ev?.stopPropagation();APP.richTarget='questionEditor';rememberQuestionSelection();document.getElementById('mathPalette')?.classList.toggle('hidden');}
function closeMathPalette(){document.getElementById('mathPalette')?.classList.add('hidden');}
document.addEventListener('click',e=>{const wrap=document.querySelector('.math-tool-wrap');if(wrap&&!wrap.contains(e.target))closeMathPalette();});
function openMatrixPicker(){rememberQuestionSelection();document.getElementById('matrixPicker')?.classList.toggle('hidden');}
function insertMatrix(rows,cols){
 const cells=[];for(let r=0;r<rows;r++){const row=[];for(let c=0;c<cols;c++)row.push('#?');cells.push(row.join('&'));}
 const latex='\\begin{pmatrix}'+cells.join('\\\\')+'\\end{pmatrix}';document.getElementById('matrixPicker')?.classList.add('hidden');insertMathLatex(latex);
}
function getMathTargetId(){return APP.richTarget||'questionEditor';}
function getActiveMathField(id){
 const mf=APP.activeMathField;
 if(mf&&mf.isConnected&&mf.closest('#'+id))return mf;
 const ae=document.activeElement;
 if(ae&&ae.tagName&&ae.tagName.toLowerCase()==='math-field'&&ae.closest('#'+id))return ae;
 return null;
}
function mathSelectionIsNonEmpty(mf){
  try{
    const ranges = mf?.selection?.ranges || [];
    return ranges.some(r => Number(r[0]) !== Number(r[1]));
  }catch(e){
    return false;
  }
}
function mathTemplateForSelection(latex, mf){
  const x = String(latex || '');

  // Tidak ada selection → gunakan template biasa
  if(!mathSelectionIsNonEmpty(mf)){
    return x;
  }

  // FRACTION
  if(x === '\\frac{#?}{#?}'){
    return '\\frac{#@}{#?}';
  }

  // ROOT
  if(x === '\\sqrt{#?}'){
    return '\\sqrt{#@}';
  }

  // NTH ROOT
  if(x === '\\sqrt[#?]{#?}'){
    return '\\sqrt[#?]{#@}';
  }

  // POWER
  if(x === 'x^{#?}'){
    return '^{#@}';
  }

  // SUBSCRIPT
  if(x === 'x_{#?}'){
    return '_{#@}';
  }

  // SIGMA
  if(x === '\\sum_{#?}^{#?} #?'){
    return '\\sum_{#?}^{#?} #@';
  }

  // INTEGRAL
  if(x === '\\int_{#?}^{#?} #?\\,dx'){
    return '\\int_{#?}^{#?} #@\\,dx';
  }

  // LOG
  if(x === '\\log_{#?}(#?)'){
    return '\\log_{#?}(#@)';
  }

  return x;
}
function rememberActiveMathField(mf){if(mf&&mf.tagName&&mf.tagName.toLowerCase()==='math-field'){APP.activeMathField=mf;APP.richTarget=mf.closest('.rich-option-editor')?.id||APP.richTarget;}}
function clearActiveMathField(mf){if(APP.activeMathField===mf)APP.activeMathField=null;}
function placeCaretOutsideMathField(mf,direction,insertText=''){
  const editor=mf?.closest('[contenteditable="true"]');
  if(!mf||!editor)return;
  let node,offset;
  if(direction==='forward'){
    if(!mf.nextSibling)mf.parentNode.insertBefore(document.createTextNode('\u200B'),mf.nextSibling);
    node=mf.nextSibling;
    if(insertText){
      if(node.nodeType===Node.TEXT_NODE)node.nodeValue=insertText+node.nodeValue;
      else{const t=document.createTextNode(insertText);mf.parentNode.insertBefore(t,node);node=t;}
    }
    offset=node.nodeType===Node.TEXT_NODE?insertText.length:0;
  }else{
    if(!mf.previousSibling)mf.parentNode.insertBefore(document.createTextNode('\u200B'),mf);
    node=mf.previousSibling;
    if(insertText){
      if(node.nodeType===Node.TEXT_NODE)node.nodeValue=node.nodeValue+insertText;
      else{const t=document.createTextNode(insertText);mf.parentNode.insertBefore(t,mf);node=t;}
    }
    offset=node.nodeType===Node.TEXT_NODE?node.nodeValue.length:node.childNodes.length;
  }
  const sel=window.getSelection(); if(!sel)return;
  const r=document.createRange(); r.setStart(node,offset); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
  mf.blur(); clearActiveMathField(mf);
  const id=editor.id; APP.richTarget=id;
  if(id==='questionEditor')APP.questionSelection=r.cloneRange(); else {APP.richSelections=APP.richSelections||{};APP.richSelections[id]=r.cloneRange();}
  if(id==='questionEditor')syncHiddenQuestion(); else if(typeof syncRichHidden==='function')syncRichHidden(id);
}
function mathFieldAtEnd(mf){try{return !!mf.selectionIsCollapsed && mf.position===mf.lastOffset;}catch(e){return false;}}
function mathFieldAtStart(mf){try{return !!mf.selectionIsCollapsed && mf.position===0;}catch(e){return false;}}
function insertLineBreakAfterMath(mf){
  const editor=mf?.closest('[contenteditable="true"]'); if(!mf||!editor)return;
  let br=mf.nextSibling;
  if(!br || br.nodeType!==Node.ELEMENT_NODE || br.tagName!=='BR'){
    br=document.createElement('br'); mf.parentNode.insertBefore(br,mf.nextSibling);
  }
  const t=document.createTextNode(''); mf.parentNode.insertBefore(t,br.nextSibling);
  const r=document.createRange();r.setStart(t,0);r.collapse(true);
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);
  mf.blur();clearActiveMathField(mf);
  APP.richTarget=editor.id;
  if(editor.id==='questionEditor')APP.questionSelection=r.cloneRange();else{APP.richSelections=APP.richSelections||{};APP.richSelections[editor.id]=r.cloneRange();}
  if(editor.id==='questionEditor')syncHiddenQuestion();else if(typeof syncRichHidden==='function')syncRichHidden(editor.id);
}
function normalizeInlineMathField(mf){
  if(!mf)return;
  try{mf.defaultMode='inline-math';}catch(e){}
  try{mf.style.fontSize='1em';}catch(e){}
  mf.style.display='inline-block';
  mf.style.verticalAlign='baseline';
  mf.style.height='auto';
  mf.style.minHeight='0';
  mf.style.maxHeight='none';
  mf.style.lineHeight='1';
}
function removeInlineMathField(mf,direction='backward'){

  if(!mf || !mf.parentNode) return;

  const parent = mf.parentNode;

  /*
   * Tentukan node tempat cursor akan diletakkan.
   */
  let targetNode;

  if(direction === 'forward'){
    targetNode = mf.nextSibling;
  }else{
    targetNode = mf.previousSibling;
  }

  /*
   * Hapus math-field.
   */
  mf.remove();

  /*
   * Jika node tujuan belum ada,
   * buat text node kosong.
   */
  if(!targetNode){

    targetNode = document.createTextNode('');

    if(direction === 'forward'){
      parent.appendChild(targetNode);
    }else{
      parent.insertBefore(
        targetNode,
        parent.firstChild
      );
    }
  }

  /*
   * Letakkan cursor di posisi yang tepat.
   */
  const range = document.createRange();

  range.selectNodeContents(targetNode);

  if(direction === 'forward'){
    range.collapse(true);
  }else{
    range.collapse(false);
  }

  const sel = window.getSelection();

  sel.removeAllRanges();
  sel.addRange(range);

  /*
   * Bersihkan active MathLive.
   */
  if(APP.activeMathField === mf){
    APP.activeMathField = null;
  }

  /*
   * Simpan selection editor.
   */
  const editor = parent.closest(
    '[contenteditable="true"]'
  );

  if(editor){

    APP.richTarget = editor.id;

    if(editor.id === 'questionEditor'){

      APP.questionSelection =
        range.cloneRange();

      syncHiddenQuestion();

    }else{

      APP.richSelections =
        APP.richSelections || {};

      APP.richSelections[editor.id] =
        range.cloneRange();

      if(typeof syncRichHidden === 'function'){
        syncRichHidden(editor.id);
      }
    }
  }
}
function attachMathFieldBehavior(mf){
  normalizeInlineMathField(mf);
  if(!mf||mf.dataset.behaviorAttached==='1')return;
  mf.dataset.behaviorAttached='1';
  mf.addEventListener('focus',()=>rememberActiveMathField(mf));
  mf.addEventListener('blur',()=>{if(APP.activeMathField===mf)APP.activeMathField=null;});
  mf.addEventListener('move-out',ev=>{
    const d=ev.detail?.direction;
    if(d==='forward'||d==='backward'){
      ev.preventDefault();
      placeCaretOutsideMathField(mf,d);
    }
  });
  mf.addEventListener('keydown',ev=>{
      // =================================================
    // BACKSPACE
    // =================================================
    if(ev.key === 'Backspace'){

      /*
       * Jika cursor berada di awal equation,
       * hapus seluruh equation.
       */
      if(mathFieldAtStart(mf)){

        ev.preventDefault();
        ev.stopPropagation();

        removeInlineMathField(
          mf,
          'backward'
        );

        return;
      }
    }

    // =================================================
    // DELETE
    // =================================================
    if(ev.key === 'Delete'){

      /*
       * Jika cursor berada di akhir equation,
       * hapus seluruh equation.
       */
      if(mathFieldAtEnd(mf)){

        ev.preventDefault();
        ev.stopPropagation();

        removeInlineMathField(
          mf,
          'forward'
        );

        return;
      }
    }
    // Word-like inline behavior: space at the right edge leaves the equation.
    if(ev.key===' ' && mathFieldAtEnd(mf)){
      ev.preventDefault();
      ev.stopPropagation();
      placeCaretOutsideMathField(mf,'forward',' ');
      return;
    }
    // Enter leaves the equation and starts a new line in the editor.
    if(ev.key==='Enter'){
      ev.preventDefault();
      ev.stopPropagation();
      insertLineBreakAfterMath(mf);
      return;
    }
    // Fallback for browsers/MathLive versions where move-out is not emitted.
    if(ev.key==='ArrowRight' && mathFieldAtEnd(mf)){
      ev.preventDefault();
      ev.stopPropagation();
      placeCaretOutsideMathField(mf,'forward');
    }else if(ev.key==='ArrowLeft' && mathFieldAtStart(mf)){
      ev.preventDefault();
      ev.stopPropagation();
      placeCaretOutsideMathField(mf,'backward');
    }
  });
  mf.addEventListener('dblclick',ev=>ev.stopPropagation());
}
document.addEventListener('focusin',e=>{if(e.target?.tagName?.toLowerCase()==='math-field')rememberActiveMathField(e.target);},true);
function mathLatexForInsert(s){
 let x=String(s||'');
 x=x.replace(/\\placeholder\{([^{}]*)\}/g,'#?');
 return x;
}
function insertMathIntoEditor(latex,id){

  // Mencegah satu klik toolbar diproses dua kali
  if(APP.mathInsertLock) return;

  APP.mathInsertLock = true;

  setTimeout(()=>{
    APP.mathInsertLock = false;
  },180);

  const editor = document.getElementById(id);
  if(!editor) return;

  const active = getActiveMathField(id);

  // =====================================================
  // JIKA SEDANG BERADA DI DALAM EQUATION
  // =====================================================
  if(active){

    try{

      /*
       * Simpan selection sebelum tombol palette kehilangan focus.
       */
      const originalSelection = active.selection;

      /*
       * Tentukan template berdasarkan selection.
       *
       * Contoh:
       * 4 → √ → √4
       * x → pangkat → x^□
       * 4 → pecahan → 4 menjadi pembilang
       */
      const expr = mathTemplateForSelection(latex,active);

      /*
       * Kembalikan selection.
       * Ini penting karena ketika tombol palette diklik,
       * browser dapat memindahkan focus dari math-field.
       */
      try{
        if(originalSelection){
          active.selection = originalSelection;
        }
      }catch(e){}

      /*
       * Masukkan hanya SATU KALI.
       */
      active.insert(expr,{
        selectionMode:'placeholder',
        focus:true
      });

      rememberActiveMathField(active);

      closeMathPalette();

      if(id === 'questionEditor'){
        syncHiddenQuestion();
      }else if(typeof syncRichHidden === 'function'){
        syncRichHidden(id);
      }

      return;

    }catch(e){

      console.warn(
        'MathLive insertion error:',
        e
      );

    }
  }

  // =====================================================
  // JIKA TIDAK ADA EQUATION AKTIF
  // =====================================================

  if(id === 'questionEditor'){
    restoreQuestionSelection();
  }else if(typeof restoreRichSelection === 'function'){
    restoreRichSelection(id);
  }

  const sel = window.getSelection();

  if(!sel || !sel.rangeCount){
    return;
  }

  const range = sel.getRangeAt(0);

  /*
   * Pastikan cursor masih berada di editor.
   */
  if(!editor.contains(range.commonAncestorContainer)){
    range.selectNodeContents(editor);
    range.collapse(false);
  }

  range.deleteContents();

  /*
   * Buat math-field baru.
   */
  const mf = document.createElement('math-field');

  mf.className = 'inline-math-field';

  mf.setAttribute(
    'virtual-keyboard-mode',
    'manual'
  );

  mf.setAttribute(
    'menu-items',
    'none'
  );

  mf.setAttribute(
    'smart-mode',
    'false'
  );

  try{
    mf.defaultMode = 'inline-math';
  }catch(e){}

  mf.style.fontSize = '1em';

  /*
   * Masukkan template.
   */
  try{
    mf.value = mathLatexForInsert(latex);
  }catch(e){
    mf.value = String(latex || '');
  }

  /*
   * Tambahkan ke editor.
   */
  range.insertNode(mf);

  /*
   * Sisipkan text node setelah equation.
   * Ini membuat cursor bisa keluar seperti Word.
   */
  const space = document.createTextNode(' ');

  if(mf.nextSibling){
    mf.parentNode.insertBefore(
      space,
      mf.nextSibling
    );
  }else{
    mf.parentNode.appendChild(space);
  }

  /*
   * Pasang behavior MathLive.
   */
  attachMathFieldBehavior(mf);

  /*
   * Focus ke equation.
   */
  try{
    mf.focus();
  }catch(e){}

  rememberActiveMathField(mf);

  /*
   * Sync data.
   */
  if(id === 'questionEditor'){
    syncHiddenQuestion();
  }else if(typeof syncRichHidden === 'function'){
    syncRichHidden(id);
  }

  closeMathPalette();
}
function insertMathLatex(latex){insertMathIntoEditor(latex,getMathTargetId());}
function insertMathTemplate(type){const t={fraction:'\\frac{#?}{#?}',power:'x^{#?}',root:'\\sqrt{#?}',rootn:'\\sqrt[#?]{#?}',subscript:'x_{#?}',pm:'\\pm',pi:'\\pi',theta:'\\theta',degree:'^{\\circ}',infinity:'\\infty',leq:'\\leq',neq:'\\ne',sum:'\\sum_{#?}^{#?} #?',integral:'\\int_{#?}^{#?} #?\\,dx',matrix:'\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}',log:'\\log_{#?}(#?)'};if(t[type])insertMathIntoEditor(t[type],getMathTargetId());}
function insertMath(latex){
 const map={
  '\\frac{a}{b}':'fraction','x^{2}':'power','x^2':'power','\\sqrt{x}':'root','\\sqrt[n]{x}':'rootn','\\pi':'pi','\\theta':'theta',
  '\\sum_{i=1}^{n} i':'sum','\\int_a^b f(x)\\,dx':'integral','\\begin{matrix}a&b\\\\c&d\\end{matrix}':'matrix',
  '\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}':'fraction','\\leq':'leq','\\infty':'infinity','\\ne':'neq','^{\\circ}':'degree'
 };
 insertMathTemplate(map[latex]||'pi');
}
// Helper global: membersihkan placeholder LaTeX dari MathLive sebelum disimpan.
// Diletakkan di lingkup global agar dapat dipakai editor soal dan editor opsi.
function cleanMathLatex(raw){
  let s = String(raw || '');
  for (let i = 0; i < 5; i++) {
    const next = s.replace(/\\placeholder\{([^{}]*)\}/g, '$1');
    if (next === s) break;
    s = next;
  }
  return s;
}

function serializeQuestionNode(node){

  if(node.nodeType === Node.TEXT_NODE){
    return node.nodeValue || '';
  }

  if(node.nodeType !== Node.ELEMENT_NODE){
    return '';
  }

  if(node.tagName === 'BR'){
    return '\n';
  }

  if(
    node.tagName.toLowerCase() === 'math-field'
  ){

    let value = '';

    try{

      value =
        node.getValue?.(
          'latex-without-placeholders'
        ) ||
        node.value ||
        '';

    }catch(e){

      value =
        node.value ||
        '';
    }

    return '\\(' +
      cleanMathLatex(value) +
      '\\)';
  }

  let out = '';

  node.childNodes.forEach(
    n => out += serializeQuestionNode(n)
  );

  if(
    ['DIV','P'].includes(node.tagName)
  ){
    out += '\n';
  }

  return out;
}
function serializeQuestionEditor(){const editor=document.getElementById('questionEditor');if(!editor)return '';let out='';editor.childNodes.forEach(n=>out+=serializeQuestionNode(n));return out.replace(/\n{3,}/g,'\n\n').trim();}
function syncHiddenQuestion(){const ta=document.getElementById('textQuestion');if(ta)ta.value=serializeQuestionEditor();}
function renderQuestionEditorContent(raw){const editor=document.getElementById('questionEditor');if(!editor)return;editor.innerHTML='';let text=String(raw??'').replace(/^TEXT::/,'');const re=/\\\(([\s\S]*?)\\\)/g;let last=0,m;while((m=re.exec(text))){if(m.index>last)editor.appendChild(document.createTextNode(text.slice(last,m.index)));const mf=document.createElement('math-field');mf.className='inline-math-field';mf.setAttribute('virtual-keyboard-mode','manual');mf.setAttribute('menu-items','none');mf.setAttribute('smart-mode','false');try{mf.defaultMode='inline-math';}catch(e){}mf.style.fontSize='1em';mf.value=m[1];attachMathFieldBehavior(mf);editor.appendChild(mf);editor.appendChild(document.createTextNode(' '));last=re.lastIndex;}if(last<text.length)editor.appendChild(document.createTextNode(text.slice(last)));if(typeof attachMathFieldBehavior==='function')editor.querySelectorAll('math-field').forEach(attachMathFieldBehavior);syncHiddenQuestion();}
function execQuestionFormat(command){const editor=document.getElementById('questionEditor');if(!editor)return;editor.focus();try{document.execCommand(command,false,null);}catch(e){}syncHiddenQuestion();}
function queueMathTypeset(){clearTimeout(APP.mathTimer);APP.mathTimer=setTimeout(()=>{try{window.MathJax?.typesetPromise?.();}catch(e){}},80);}
function getQuestionText(){syncHiddenQuestion();return 'TEXT::'+(document.getElementById('textQuestion')?.value||'');}
function compressImageFile(file){return new Promise((resolve,reject)=>{if(!file)return resolve('');if(file.size>5*1024*1024)return reject(new Error('Ukuran gambar maksimal 5 MB.'));const img=new Image(),reader=new FileReader();reader.onload=e=>{img.onload=()=>{const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82));};img.onerror=()=>reject(new Error('Gambar tidak dapat dibaca.'));img.src=e.target.result;};reader.onerror=()=>reject(new Error('Gagal membaca gambar.'));reader.readAsDataURL(file);});}
function previewQuestionImage(ev){const file=ev.target.files?.[0],box=document.getElementById('questionImagePreview');if(!file)return;compressImageFile(file).then(data=>{APP.pendingImageData=data;APP.removeQuestionImage=false;box.classList.remove('hidden');box.innerHTML='<img src="'+data+'" alt="Pratinjau gambar soal"><span>Gambar siap diunggah saat soal disimpan.</span>';document.getElementById('removeQuestionImageBtn')?.classList.remove('hidden');}).catch(e=>{ev.target.value='';APP.pendingImageData='';alert(e.message);});}
function removeQuestionImage(){APP.pendingImageData='';APP.removeQuestionImage=true;const input=document.getElementById('questionImage');if(input)input.value='';const box=document.getElementById('questionImagePreview');if(box){box.classList.add('hidden');box.innerHTML='';}document.getElementById('removeQuestionImageBtn')?.classList.add('hidden');}
function setExistingQuestionImage(url,position){APP.pendingImageData='';APP.removeQuestionImage=false;const pos=document.getElementById('questionImagePosition');if(pos)pos.value=position||'after';const box=document.getElementById('questionImagePreview');if(!box)return;if(url){box.classList.remove('hidden');box.innerHTML='<img src="'+escapeHtml(url)+'" alt="Gambar soal tersimpan"><span>Gambar soal tersimpan. Pilih gambar baru untuk menggantinya.</span>';document.getElementById('removeQuestionImageBtn')?.classList.remove('hidden');}else{box.classList.add('hidden');box.innerHTML='';document.getElementById('removeQuestionImageBtn')?.classList.add('hidden');}}
function renderQuestionTypeFields(){const t=document.getElementById('qType')?.value||'PG';document.getElementById('pgOptions')?.classList.toggle('hidden',t!=='PG');document.getElementById('complexOptions')?.classList.toggle('hidden',t!=='PG_KOMPLEKS');document.getElementById('tableOptions')?.classList.toggle('hidden',t!=='TABEL');}
function readScoringConfig(q){let o={};try{o=JSON.parse(q?.jawaban||'{}')}catch(e){}if(q?.tipe==='PG_KOMPLEKS'&&Array.isArray(o))return{correct:o,percentages:{}};return o||{};}
function collectQuestionData(){const t=qType.value,d={idSoal:APP.editingQuestion?.idSoal||'',mapelId:qMapel.value,kategoriId:qKategori.value,guruId:APP.user?.idUser||'',tipe:t,pertanyaan:getQuestionText(),bobot:Number(qWeight.value||1),tingkat:qLevel.value,imageUrl:APP.editingQuestion?.imageUrl||'',imagePosition:document.getElementById('questionImagePosition')?.value||'after',removeImage:!!APP.removeQuestionImage};if(t==='PG'){d.opsiA=optA.value;d.opsiB=optB.value;d.opsiC=optC.value;d.opsiD=optD.value;d.jawaban=qAnswer.value;}if(t==='PG_KOMPLEKS'){d.opsiA=cA.value;d.opsiB=cB.value;d.opsiC=cC.value;d.opsiD=cD.value;d.jawaban=[...document.querySelectorAll('.complex-answer:checked')].map(x=>x.value);d.percentages={A:Number(cPctA.value),B:Number(cPctB.value),C:Number(cPctC.value),D:Number(cPctD.value)};}if(t==='TABEL'){d.opsiA=tA.value;d.opsiB=tB.value;d.opsiC=tC.value;d.opsiD=tD.value;d.jawabanObj={labels:[tfLabel1.value,tfLabel2.value],keys:{A:tAKey.value,B:tBKey.value,C:tCKey.value,D:tDKey.value},percentages:{A:Number(tAPct.value),B:Number(tBPct.value),C:Number(tCPct.value),D:Number(tDPct.value)}};}return d;}
function saveQuestion(){
  const d=collectQuestionData(),msg=saveMessage,editingId=APP.editingQuestion?.idSoal||'';
  if(!d.mapelId||!d.kategoriId||!d.pertanyaan.replace(/^TEXT::/,'').trim()){msg.textContent='Mapel, kategori, dan pertanyaan wajib diisi.';return;}
  msg.textContent=editingId?'Menyimpan perubahan soal...':'Menyimpan soal...';
  const finish=(payload)=>{const call=google.script.run.withSuccessHandler(r=>{msg.textContent=editingId?'Perubahan soal berhasil disimpan.':'Soal berhasil disimpan: '+r.idSoal;APP.editingQuestion=null;clearQuestionForm(false);loadBank();}).withFailureHandler(e=>msg.textContent=e.message||'Gagal menyimpan soal.');if(editingId)call.updateQuestion({...payload,idSoal:editingId});else call.saveQuestion(payload);};
  const file=document.getElementById('questionImage')?.files?.[0];
  if(file){msg.textContent='Mengunggah gambar soal...';compressImageFile(file).then(data=>google.script.run.withSuccessHandler(r=>finish({...d,imageUrl:r.url})).withFailureHandler(e=>msg.textContent=e.message||'Gagal mengunggah gambar.').uploadQuestionImage(data,file.name,APP.user?.idUser||'')).catch(e=>msg.textContent=e.message);}
  else finish(d);
}
function newQuestion(){clearQuestionForm(false);showView('buatSoal');}
function clearQuestionForm(clear=true){APP.editingQuestion=null;APP.pendingImageData='';APP.removeQuestionImage=false;if(document.getElementById('questionEditor'))document.getElementById('questionEditor').innerHTML='';if(document.getElementById('textQuestion'))textQuestion.value='';APP.questionSelection=null;['optA','optB','optC','optD','cA','cB','cC','cD','tA','tB','tC','tD'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});const img=document.getElementById('questionImage');if(img)img.value='';const pos=document.getElementById('questionImagePosition');if(pos)pos.value='after';const box=document.getElementById('questionImagePreview');if(box){box.classList.add('hidden');box.innerHTML='';}document.getElementById('removeQuestionImageBtn')?.classList.add('hidden');qWeight.value=1;document.querySelectorAll('.complex-answer').forEach(x=>x.checked=false);['cPctA','cPctB','cPctC','cPctD','tAPct','tBPct','tCPct','tDPct'].forEach((id,i)=>{const e=document.getElementById(id);if(e)e.value=[50,50,-25,-25][i];});qAnswer.value='A';qLevel.value='Sedang';qType.value='PG';qMapel.value='';populateQuestionCategories();renderQuestionTypeFields();const btn=document.getElementById('questionSaveBtn');if(btn)btn.textContent='Simpan ke Bank Soal';const heading=document.querySelector('#buatSoalView .page-heading h2');if(heading)heading.textContent='Buat Soal';const sub=document.querySelector('#buatSoalView .page-heading .muted');if(sub)sub.textContent='Buat soal langsung dan simpan ke bank soal.';if(clear)saveMessage.textContent='';}
function editQuestion(id){
  google.script.run.withSuccessHandler(q=>{
    APP.editingQuestion=q;
    showView('buatSoal');
    qMapel.value=q.idMapel||''; populateQuestionCategories(); qKategori.value=q.idKategori||'';
    qType.value=q.tipe||'PG'; qLevel.value=q.tingkat||'Sedang'; qWeight.value=Number(q.bobot||1);
    // reset all answer fields first, then restore the exact saved values
    ['optA','optB','optC','optD','cA','cB','cC','cD','tA','tB','tC','tD'].forEach(id2=>{const el=document.getElementById(id2);if(el)el.value=q['opsi'+id2.slice(-1)]||'';});
    document.querySelectorAll('.complex-answer').forEach(x=>x.checked=false);
    let cfg=readScoringConfig(q);
    if(q.tipe==='PG'){qAnswer.value=q.jawaban||'A';}
    if(q.tipe==='PG_KOMPLEKS'){
      document.querySelectorAll('.complex-answer').forEach(x=>x.checked=(cfg.correct||[]).map(String).includes(String(x.value)));
      ['A','B','C','D'].forEach(k=>{const el=document.getElementById('cPct'+k);if(el)el.value=String(cfg.percentages?.[k]??0);});
    }
    if(q.tipe==='TABEL'){
      tfLabel1.value=cfg.labels?.[0]||'Benar'; tfLabel2.value=cfg.labels?.[1]||'Salah';
      ['A','B','C','D'].forEach(k=>{
        const key=document.getElementById('t'+k+'Key'),pct=document.getElementById('t'+k+'Pct');
        if(key)key.value=String(cfg.keys?.[k]||'1'); if(pct)pct.value=String(cfg.percentages?.[k]??0);
      });
    }
    const raw=String(q.pertanyaan||'');let qContent=null;
    if(raw.startsWith('QUESTION::')){try{qContent=JSON.parse(raw.slice(10));}catch(e){}}
    renderQuestionEditorContent(qContent?.text ?? (raw.startsWith('MATH::')?'\\('+raw.slice(6)+'\\)':raw.replace(/^TEXT::/,'')));
    setExistingQuestionImage(qContent?.image||q.imageUrl||'',qContent?.imagePosition||q.imagePosition||'after');
    renderQuestionTypeFields();
    const btn=document.getElementById('questionSaveBtn'); if(btn)btn.textContent='Simpan Perubahan';
    const heading=document.querySelector('#buatSoalView .page-heading h2'); if(heading)heading.textContent='Edit Soal';
    const sub=document.querySelector('#buatSoalView .page-heading .muted'); if(sub)sub.textContent='Perubahan akan memperbarui soal yang sama di Bank Soal.';
    saveMessage.textContent='Mode edit aktif — ID Soal: '+q.idSoal;
  }).withFailureHandler(e=>alert(e.message||'Soal gagal dimuat.')).getQuestion(id);
}
function duplicateQuestion(id){
  google.script.run.withSuccessHandler(r=>{alert('Soal berhasil diduplikasi. ID baru: '+r.idSoal);loadBank();}).withFailureHandler(e=>alert(e.message||'Gagal menggandakan soal.')).duplicateQuestion(id,APP.user?.idUser||'');
}

function loadBank(){const box=bankList;box.innerHTML='<div class="card">Memuat bank soal...</div>';google.script.run.withSuccessHandler(rows=>{APP.bank=rows||[];box.innerHTML=APP.bank.length?APP.bank.map((q,i)=>`<div class="question-item"><div class="question-meta"><span class="tag">${escapeHtml(getMapelName(q.idMapel))}</span><span class="tag">${escapeHtml(getCategoryName(q.idKategori))}</span><span class="tag">${escapeHtml(typeName(q.tipe))}</span><span class="tag">${escapeHtml(q.tingkat)}</span><span class="tag">Bobot ${Number(q.bobot||0)}</span></div><div><b>${i+1}.</b> ${renderQuestion(q.pertanyaan)}</div>${renderQuestionOptions(q)}<div class="actions"><button class="btn btn-primary" onclick="event.stopPropagation();editQuestion('${q.idSoal}')">Edit Soal</button><button class="btn btn-light" onclick="event.stopPropagation();duplicateQuestion('${q.idSoal}')">Duplikasi</button></div></div>`).join(''):'<div class="card empty-state"><h3>Belum ada soal</h3></div>';}).withFailureHandler(e=>box.innerHTML='<div class="card">'+escapeHtml(e.message||'Gagal memuat bank soal.')+'</div>').getQuestionBank({mapelId:filterMapel.value,kategoriId:filterKategori.value});}
function renderQuestionOptions(q){if(q.tipe==='PG')return `<div class="question-options">A. ${escapeHtml(q.opsiA)}<br>B. ${escapeHtml(q.opsiB)}<br>C. ${escapeHtml(q.opsiC)}<br>D. ${escapeHtml(q.opsiD)}</div>`;if(q.tipe==='PG_KOMPLEKS'){const o=readScoringConfig(q);return `<div class="question-options">A. ${escapeHtml(q.opsiA)} (${Number(o.percentages?.A||0)>0?'+':''}${Number(o.percentages?.A||0)}%)<br>B. ${escapeHtml(q.opsiB)} (${Number(o.percentages?.B||0)>0?'+':''}${Number(o.percentages?.B||0)}%)<br>C. ${escapeHtml(q.opsiC)} (${Number(o.percentages?.C||0)>0?'+':''}${Number(o.percentages?.C||0)}%)<br>D. ${escapeHtml(q.opsiD)} (${Number(o.percentages?.D||0)>0?'+':''}${Number(o.percentages?.D||0)}%)</div>`;}if(q.tipe==='TABEL'){const o=readScoringConfig(q);return `<table class="mini-table"><tr><th>Pernyataan</th><th>Kunci</th><th>%</th></tr>${['A','B','C','D'].map(x=>`<tr><td>${x}. ${escapeHtml(q['opsi'+x])}</td><td>${escapeHtml((o.labels||['Benar','Salah'])[Number(o.keys?.[x]||1)-1])}</td><td>${Number(o.percentages?.[x]||0)>0?'+':''}${Number(o.percentages?.[x]||0)}%</td></tr>`).join('')}</table>`;}return '';}
function typeName(t){return t==='PG_KOMPLEKS'?'PG Kompleks':t==='TABEL'?'Tabel Pernyataan':t;}
function getMapelName(id){const x=APP.mapel.find(m=>m.idMapel===id);return x?.namaMapel||id;}function getCategoryName(id){const x=APP.kategori.find(k=>k.idKategori===id);return x?.namaKategori||id;}
function normalizeImageUrl(url){const u=String(url||'').trim();if(!u)return '';const m=u.match(/[?&]id=([A-Za-z0-9_-]+)/)||u.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);if(!m)return u;const id=m[1];return 'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w1600';}
function parseQuestionContent(raw){const v=String(raw||'');if(v.startsWith('QUESTION::')){try{return JSON.parse(v.slice(10));}catch(e){}}if(v.startsWith('TEXT::'))return{text:v.slice(6),image:'',imagePosition:'after'};if(v.startsWith('MATH::'))return{text:'\\\\('+v.slice(6)+'\\\\)',image:'',imagePosition:'after'};return{text:v,image:'',imagePosition:'after'};}
function renderQuestion(l){const q=parseQuestionContent(l);if(!q.text&&!q.image)return '';const text=escapeHtml(q.text||'').replace(/\\n/g,'<br>');const img=q.image?'<div class="question-stimulus-image"><img src="'+escapeHtml(q.image)+'" alt="Gambar soal"></div>':'';return q.imagePosition==='before'?img+'<div class="question-rich-text">'+text+'</div>':'<div class="question-rich-text">'+text+'</div>'+img;}
function escapeHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function saveCategory(){const msg=catMessage;if(!catMapel.value||!catName.value.trim()){msg.textContent='Mapel dan nama kategori wajib diisi.';return;}msg.textContent='Menyimpan...';google.script.run.withSuccessHandler(()=>{msg.textContent='Kategori berhasil ditambahkan.';catName.value='';google.script.run.withSuccessHandler(d=>{APP.kategori=d.kategori||[];populateQuestionCategories();populateFilterCategories();renderCategoryList();}).getBootstrapData();}).withFailureHandler(e=>msg.textContent=e.message||'Gagal menambahkan kategori.').saveCategory({idMapel:catMapel.value,namaKategori:catName.value,idUser:APP.user.idUser});}
function renderCategoryList(){const box=categoryList;if(!box)return;box.innerHTML=APP.mapel.map(m=>{const cats=APP.kategori.filter(k=>k.idMapel===m.idMapel);return `<div class="category-group"><b>${escapeHtml(m.namaMapel)}</b><div class="category-chips">${cats.map(c=>`<span class="tag">${escapeHtml(c.namaKategori)}</span>`).join('')||'<span class="muted">Belum ada kategori.</span>'}</div></div>`;}).join('');}
function loadExams(){const box=document.getElementById('examList');if(!box)return;box.innerHTML='<div class="card">Memuat ujian...</div>';google.script.run.withSuccessHandler(rows=>{APP.exams=Array.isArray(rows)?rows:[];if(!APP.exams.length){box.innerHTML='<div class="card empty-state"><div class="empty-icon">📝</div><h3>Belum ada ujian</h3><p class="muted">Jika Anda baru saja membuat ujian, klik tombol Segarkan.</p><button class="btn btn-light" onclick="loadExams()">Segarkan</button></div>';return;}box.innerHTML=APP.exams.map(e=>`<div class="exam-card" onclick="openExam('${escapeHtml(e.idUjian)}')"><div><span class="tag">${escapeHtml(e.namaMapel)}</span><h3>${escapeHtml(e.namaUjian)}</h3><p class="muted">${e.jumlahSoal} soal · ${e.durasiMenit} menit · <b>${escapeHtml(e.status)}</b></p></div><span class="arrow">›</span></div>`).join('');}).withFailureHandler(e=>{box.innerHTML='<div class="card empty-state"><h3>Gagal memuat ujian</h3><p class="muted">'+escapeHtml(e.message||'Kesalahan server.')+'</p><button class="btn btn-light" onclick="loadExams()">Coba Lagi</button></div>';}).getExams();}

/* =========================================================
   PEMILIHAN SOAL UJIAN MULTI-KATEGORI
   TKA LEARNING SYSTEM
   ========================================================= */

/*
 * Dipanggil ketika mata pelajaran dipilih.
 * Pilihan soal diinisialisasi ulang ketika mapel berubah.
 */
function loadBuilderQuestions() {
  const mapelId = document.getElementById('examMapel').value;
  const box = document.getElementById('examQuestionList');

  if (!mapelId) {
    APP.examBuilder = null;
    box.innerHTML = '<p class="muted">Pilih mata pelajaran terlebih dahulu.</p>';
    return;
  }

  APP.examBuilder = {
    mapelId: mapelId,
    kategoriId: '',
    selected: {},
    cache: {},
    currentRows: [],
    requestId: 0
  };

  const categories = APP.kategori.filter(
    k => String(k.idMapel) === String(mapelId)
  );

  box.innerHTML = `
    <div class="exam-builder">
      <div class="exam-builder-toolbar">
        <div class="exam-builder-filter">
          <label for="examCategoryFilter">Filter kategori soal</label>
          <select id="examCategoryFilter"
                  onchange="loadBuilderCategory(this.value)">
            <option value="">Semua kategori</option>
            ${categories.map(k => `
              <option value="${escapeHtml(k.idKategori)}">
                ${escapeHtml(k.namaKategori)}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="exam-builder-hint">
          Pilih soal, lalu pindah kategori untuk menambahkan soal lainnya.
        </div>
      </div>

      <div id="examBuilderSummary" class="exam-builder-summary"></div>

      <div id="examBuilderQuestionItems"
           class="exam-builder-question-items">
        <div class="exam-builder-loading">Memuat bank soal...</div>
      </div>
    </div>
  `;

  loadBuilderCategory('');
}


/*
 * Memuat soal berdasarkan mata pelajaran dan kategori.
 * Kategori kosong berarti semua kategori pada mapel tersebut.
 */
function loadBuilderCategory(kategoriId) {
  const builder = APP.examBuilder;
  if (!builder) return;

  builder.kategoriId = kategoriId || '';
  const requestId = ++builder.requestId;
  const box = document.getElementById('examBuilderQuestionItems');

  if (!box) return;

  box.innerHTML = '<div class="exam-builder-loading">Memuat soal...</div>';

  google.script.run
    .withSuccessHandler(rows => {
      if (
        !APP.examBuilder ||
        APP.examBuilder.requestId !== requestId
      ) return;

      const data = Array.isArray(rows) ? rows : [];

      builder.currentRows = data;

      data.forEach(q => {
        builder.cache[String(q.idSoal)] = q;
      });

      renderBuilderQuestionItems(data);
      renderExamBuilderSummary();
      queueMathTypeset();
    })
    .withFailureHandler(e => {
      if (
        !APP.examBuilder ||
        APP.examBuilder.requestId !== requestId
      ) return;

      box.innerHTML = `
        <div class="exam-builder-empty">
          <b>Gagal memuat soal</b>
          <p>${escapeHtml(e.message || 'Terjadi kesalahan saat mengambil bank soal.')}</p>
          <button class="btn btn-light"
                  onclick="loadBuilderCategory(document.getElementById('examCategoryFilter').value)">
            Coba lagi
          </button>
        </div>
      `;
    })
    .getExamQuestionsForBuilder(builder.mapelId, builder.kategoriId);
}


/*
 * Menampilkan daftar soal dari kategori yang sedang aktif.
 * Checkbox tetap tercentang jika soal sebelumnya sudah dipilih.
 */
function renderBuilderQuestionItems(rows) {
  const box = document.getElementById('examBuilderQuestionItems');
  if (!box) return;

  if (!rows.length) {
    box.innerHTML = `
      <div class="exam-builder-empty">
        <div class="empty-icon">📚</div>
        <b>Belum ada soal pada kategori ini</b>
        <p class="muted">
          Coba pilih kategori lain atau tambahkan soal ke Bank Soal.
        </p>
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="exam-builder-list-heading">
      <b>Daftar soal tersedia</b>
      <span>${rows.length} soal</span>
    </div>

    ${rows.map((q, index) => {
      const id = String(q.idSoal);
      const checked = !!APP.examBuilder.selected[id];
      const category = APP.kategori.find(
        k => String(k.idKategori) === String(q.idKategori)
      );

      return `
        <label class="exam-question-option ${checked ? 'selected' : ''}">
          <input
            type="checkbox"
            class="exam-q"
            value="${escapeHtml(id)}"
            ${checked ? 'checked' : ''}
            onchange="toggleExamQuestion(this.value, this.checked)"
          >

          <span class="exam-question-content">
            <span class="exam-question-meta">
              <span class="tag">${escapeHtml(typeName(q.tipe))}</span>
              <span class="tag">${escapeHtml(q.tingkat || 'Sedang')}</span>
              <span class="tag">Bobot ${Number(q.bobot || 1)}</span>
              <span class="tag category-tag">
                ${escapeHtml(category?.namaKategori || 'Tanpa kategori')}
              </span>
            </span>

            <span class="exam-question-text">
              <b>Soal ${index + 1}</b>
              ${renderQuestion(q.pertanyaan)}
            </span>
          </span>
        </label>
      `;
    }).join('')}
  `;
}


/*
 * Menambah atau menghapus pilihan soal.
 * Data soal disimpan dalam state APP agar tidak hilang
 * saat guru berpindah kategori.
 */
function toggleExamQuestion(idSoal, checked) {
  if (!APP.examBuilder) return;

  const id = String(idSoal);

  if (checked) {
    const q = APP.examBuilder.cache[id];

    if (q) {
      APP.examBuilder.selected[id] = q;
    }
  } else {
    delete APP.examBuilder.selected[id];
  }

  renderExamBuilderSummary();

  const item = document.querySelector(
    `.exam-question-option input.exam-q[value="${CSS.escape(id)}"]`
  );

  if (item) {
    item.closest('.exam-question-option')
      ?.classList.toggle('selected', checked);
  }
}


/*
 * Menghapus soal dari ringkasan pilihan.
 * Bisa menghapus soal dari kategori mana pun.
 */
function removeExamQuestion(idSoal) {
  if (!APP.examBuilder) return;

  delete APP.examBuilder.selected[String(idSoal)];

  renderBuilderQuestionItems(APP.examBuilder.currentRows);
  renderExamBuilderSummary();
}


/*
 * Ringkasan seluruh soal terpilih dari berbagai kategori.
 */
function renderExamBuilderSummary() {
  const box = document.getElementById('examBuilderSummary');
  if (!box || !APP.examBuilder) return;

  const selected = Object.values(APP.examBuilder.selected);
  const total = selected.length;

  if (!total) {
    box.innerHTML = `
      <div class="exam-selection-empty">
        <span>☑</span>
        <div>
          <b>Belum ada soal dipilih</b>
          <small>Centang soal dari kategori yang ingin dimasukkan ke ujian.</small>
        </div>
      </div>
    `;
    return;
  }

  const grouped = {};

  selected.forEach(q => {
    const id = String(q.idKategori || 'tanpa-kategori');
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(q);
  });

  box.innerHTML = `
    <div class="exam-selection-header">
      <div>
        <b>Soal terpilih</b>
        <small>${Object.keys(grouped).length} kategori digunakan</small>
      </div>
      <div class="exam-selection-total">${total} <small>soal</small></div>
    </div>

    <div class="exam-selection-groups">
      ${Object.entries(grouped).map(([categoryId, questions]) => {
        const category = APP.kategori.find(
          k => String(k.idKategori) === categoryId
        );

        return `
          <div class="exam-selection-group">
            <div class="exam-selection-category">
              <b>${escapeHtml(category?.namaKategori || 'Tanpa kategori')}</b>
              <span>${questions.length} soal</span>
            </div>

            ${questions.map(q => `
              <div class="exam-selected-item">
                <span>${escapeHtml(typeName(q.tipe))} · Bobot ${Number(q.bobot || 1)}</span>
                <button type="button"
                        title="Hapus soal dari ujian"
                        onclick="removeExamQuestion('${escapeHtml(q.idSoal)}')">
                  ×
                </button>
              </div>
            `).join('')}
          </div>
        `;
      }).join('')}
    </div>
  `;
}


/*
 * Membuat ujian menggunakan seluruh soal terpilih,
 * bukan hanya checkbox yang terlihat pada kategori aktif.
 */
function createExam() {
  const builder = APP.examBuilder;
  const ids = builder
    ? Object.keys(builder.selected)
    : [];

  const msg = document.getElementById('examMessage');
  const nama = document.getElementById('examName').value.trim();
  const mapelId = document.getElementById('examMapel').value;

  if (!nama || !mapelId || !ids.length) {
    msg.textContent = 'Nama ujian, mata pelajaran, dan minimal satu soal wajib dipilih.';
    return;
  }

  if (builder && String(builder.mapelId) !== String(mapelId)) {
    msg.textContent = 'Mata pelajaran berubah. Silakan pilih kembali soal ujian.';
    return;
  }

  msg.textContent = 'Membuat ujian...';

  const payload = {
    namaUjian: nama,
    idMapel: mapelId,
    idGuru: APP.user?.idUser || '',
    durasiMenit: document.getElementById('examDuration').value,
    acakSoal: document.getElementById('examShuffle').checked,
    acakOpsi: document.getElementById('examShuffleOption').checked,
    soalIds: ids
  };

  google.script.run
    .withSuccessHandler(r => {
      msg.textContent = 'Ujian berhasil dibuat sebagai DRAFT: ' + r.idUjian;
      document.getElementById('examName').value = '';
      openExam(r.idUjian);
    })
    .withFailureHandler(e => {
      msg.textContent = e.message || 'Gagal membuat ujian.';
    })
    .createExam(payload);
}

function openExam(id){examListView.classList.add('hidden');examDetailView.classList.remove('hidden');examDetail.innerHTML='<div class="card">Memuat...</div>';google.script.run.withSuccessHandler(d=>examDetail.innerHTML=renderExamDetail(d)).withFailureHandler(e=>examDetail.innerHTML='<div class="card">'+escapeHtml(e.message)+'</div>').getExamDetail(id);}
function backToExams(){examDetailView.classList.add('hidden');examListView.classList.remove('hidden');loadExams();}
function setExamStatus(id,status){const detail=document.getElementById('examDetail');if(detail)detail.insertAdjacentHTML('afterbegin','<div class="message">Mengubah status ujian menjadi '+escapeHtml(status)+'...</div>');google.script.run.withSuccessHandler(()=>{loadExams();openExam(id);}).withFailureHandler(e=>alert(e.message||'Gagal mengubah status ujian.')).setExamStatus(id,status,APP.user.idUser);}
function previewExam(id){google.script.run.withSuccessHandler(d=>{const box=document.getElementById('examPreview');if(!box)return;box.classList.remove('hidden');box.innerHTML=`<div class="preview-header"><div><b>Preview Ujian</b><span class="muted">${escapeHtml(d.exam.namaUjian)} · ${d.questions.length} soal · ${d.exam.durasiMenit} menit</span></div><button class="btn btn-light" onclick="document.getElementById('examPreview').classList.add('hidden')">Tutup Preview</button></div>${d.questions.map(q=>renderPreviewQuestion(q)).join('')}`;}).withFailureHandler(e=>alert(e.message)).getExamDetail(id);}
function renderPreviewQuestion(q){let body='';if(q.tipe==='PG'||q.tipe==='PG_KOMPLEKS')body=`<div class="preview-options"><div>A. ${escapeHtml(q.opsiA)}</div><div>B. ${escapeHtml(q.opsiB)}</div><div>C. ${escapeHtml(q.opsiC)}</div><div>D. ${escapeHtml(q.opsiD)}</div></div>`;else if(q.tipe==='TABEL'){const o=readScoringConfig(q);body=`<table class="mini-table"><tr><th>Pernyataan</th><th>${escapeHtml(o.labels?.[0]||'Label 1')}</th><th>${escapeHtml(o.labels?.[1]||'Label 2')}</th></tr>${['A','B','C','D'].map(x=>`<tr><td>${x}. ${escapeHtml(q['opsi'+x])}</td><td>○</td><td>○</td></tr>`).join('')}</table>`;}return `<div class="preview-question"><div class="question-meta"><span class="tag">Soal ${q.nomor}</span><span class="tag">${escapeHtml(typeName(q.tipe))}</span><span class="tag">Bobot ${Number(q.bobot||0)}</span></div><div class="preview-question-text">${renderQuestion(q.pertanyaan)}</div>${body}</div>`;}
function renderExamDetail(d){const e=d.exam,r=d.results||[],a=d.analysis||[];const action=e.status==='DRAFT'?`<button class="btn btn-primary" onclick="setExamStatus('${e.idUjian}','AKTIF')">Buka untuk Siswa</button>`:e.status==='AKTIF'?`<button class="btn btn-light" onclick="setExamStatus('${e.idUjian}','SELESAI')">Tutup Ujian</button>`:'';return `<div class="page-heading"><div><h2>${escapeHtml(e.namaUjian)}</h2><p class="muted">${e.durasiMenit} menit · ${a.length} soal · Status: <b>${escapeHtml(e.status)}</b></p></div><div class="actions-inline"><button class="btn btn-light" onclick="previewExam('${e.idUjian}')">Preview Ujian</button>${action}<button class="btn btn-light" onclick="backToExams()">← Kembali</button></div></div><div id="examPreview" class="card hidden"></div><div class="card"><div class="card-title">Hasil Siswa</div><div class="table-wrap"><table class="result-table"><thead><tr><th>No</th><th>Nama</th><th>Kelas</th><th>Status</th><th>Nilai</th></tr></thead><tbody>${r.length?r.map((x,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(x.nama)}</td><td>${escapeHtml(x.kelas)}</td><td>${escapeHtml(x.status||'-')}</td><td><b>${Number(x.nilai||0).toFixed(2)}</b></td></tr>`).join(''):'<tr><td colspan="5" class="muted">Belum ada siswa yang mengerjakan.</td></tr>'}</tbody></table></div></div><div class="card"><div class="card-title">Analisis Per Soal</div><p class="muted">Benar berarti seluruh kunci sesuai. Untuk PG Kompleks/Tabel, skor parsial tetap dihitung sesuai persentase.</p><div class="table-wrap"><table class="result-table"><thead><tr><th>No</th><th>Soal</th><th>Menjawab</th><th>Benar Penuh</th><th>Salah/Parsial</th><th>% Benar</th></tr></thead><tbody>${a.map(x=>`<tr><td>${x.nomor}</td><td>${renderQuestion(x.pertanyaan)}</td><td>${x.jumlahMenjawab}</td><td>${x.jumlahBenar}</td><td>${x.jumlahSalah}</td><td><b>${Number(x.persentaseBenar||0).toFixed(1)}%</b></td></tr>`).join('')}</tbody></table></div></div>`;}
function loadStudentExams(){if(!APP.user?.idSiswa)return;google.script.run.withSuccessHandler(rows=>{APP.studentExams=rows||[];renderStudentExamLists();}).withFailureHandler(e=>alert(e.message)).getStudentExams(APP.user.idSiswa);}
function renderStudentExamLists(){const html=APP.studentExams.length?APP.studentExams.map(e=>{const a=e.attempt;let button=a?.status==='SELESAI'?`<button class="btn btn-light" onclick="viewStudentResult('${a.idAttempt}')">Lihat Nilai</button>`:a?.status==='MENGERJAKAN'?`<button class="btn btn-primary" onclick="startExam('${e.idUjian}')">Lanjutkan</button>`:`<button class="btn btn-primary" onclick="startExam('${e.idUjian}')">Mulai Ujian</button>`;return `<div class="student-exam-card"><div><span class="tag">${escapeHtml(e.namaMapel)}</span><h3>${escapeHtml(e.namaUjian)}</h3><p class="muted">${e.jumlahSoal} soal · ${e.durasiMenit} menit</p>${a?.status==='SELESAI'?`<b>Nilai: ${Number(a.nilai||0).toFixed(2)}</b>`:''}</div>${button}</div>`;}).join(''):'<div class="card empty-state"><div class="empty-icon">📚</div><h3>Belum ada ujian</h3><p class="muted">Ujian yang dibuka guru akan muncul di sini.</p></div>';studentExamList.innerHTML=html;studentHomeExams.innerHTML=html;}
function startExam(id){if(!APP.user?.idSiswa){alert('Akun siswa belum terhubung ke ID siswa. Periksa kolom idSiswa pada USERS.');return;}google.script.run.withSuccessHandler(data=>{APP.attempt=data;APP.currentIndex=0;APP.answers={};(data.answers||[]).forEach(a=>APP.answers[a.idSoal]=parseStoredAnswer(a.jawaban));showView('studentWork');renderStudentWork();startTimer(data.remainingSeconds);}).withFailureHandler(e=>alert(e.message||'Ujian tidak dapat dibuka.')).startStudentAttempt(id,APP.user.idSiswa);}
function parseStoredAnswer(v){try{return JSON.parse(v);}catch(e){return v||'';}}
function startTimer(sec){if(APP.timer)clearInterval(APP.timer);let left=Number(sec||0);const tick=()=>{const el=document.getElementById('timer');if(el)el.textContent=formatTime(left);if(left<=0){clearInterval(APP.timer);submitStudent(true);}left--;};tick();APP.timer=setInterval(tick,1000);}
function formatTime(s){s=Math.max(0,Math.floor(s));return String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor((s%3600)/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function renderStudentWork(){const d=APP.attempt,q=d.questions[APP.currentIndex],ans=APP.answers[q.idSoal];studentWork.innerHTML=`<div class="exam-top"><div><span class="tag">${escapeHtml(d.exam.namaUjian)}</span><h2>Soal ${APP.currentIndex+1} dari ${d.questions.length}</h2></div><div class="timer-box">Sisa waktu <b id="timer">--:--:--</b></div></div><div class="card student-question-card"><div class="question-type-label">${escapeHtml(typeName(q.tipe))}</div><div class="student-question">${renderQuestion(q.pertanyaan)}</div>${renderStudentInput(q,ans)}<div class="actions"><button class="btn btn-light" ${APP.currentIndex===0?'disabled':''} onclick="studentPrev()">← Sebelumnya</button><button class="btn btn-primary" ${APP.currentIndex===d.questions.length-1?'disabled':''} onclick="studentNext()">Berikutnya →</button></div></div><div class="card"><div class="card-title">Navigasi Soal</div><div class="number-grid">${d.questions.map((x,i)=>`<button class="number-btn ${i===APP.currentIndex?'current':''} ${hasAnswer(x.idSoal)?'answered':''}" onclick="goStudentQuestion(${i})">${i+1}</button>`).join('')}</div><div class="actions"><button class="btn btn-danger" onclick="submitStudent(false)">Kumpulkan Ujian</button></div></div>`;queueMathTypeset();}
function renderStudentInput(q,ans){if(q.tipe==='PG')return `<div class="student-options">${q.options.map(o=>`<label class="answer-option"><input type="radio" name="studentAnswer" value="${o.key}" ${String(ans)===o.key?'checked':''} onchange="captureAnswer()"><span><b>${o.key}.</b> ${renderOptionContent(o)}</span></label>`).join('')}</div>`;if(q.tipe==='PG_KOMPLEKS'){const a=Array.isArray(ans)?ans:[];return `<div class="student-options">${q.options.map(o=>`<label class="answer-option"><input type="checkbox" name="studentAnswer" value="${o.key}" ${a.includes(o.key)?'checked':''} onchange="captureAnswer()"><span><b>${o.key}.</b> ${renderOptionContent(o)}</span></label>`).join('')}</div>`;}if(q.tipe==='TABEL'){const a=ans||{};return `<div class="table-wrap"><table class="result-table student-table"><thead><tr><th>Pernyataan</th><th>${escapeHtml(q.labels[0])}</th><th>${escapeHtml(q.labels[1])}</th></tr></thead><tbody>${q.statements.map((s,i)=>{const k='ABCD'[i],o=typeof s==='object'?s:parseOptionContent(s);return `<tr><td><b>${k}.</b> ${renderOptionContent(o)}</td><td><input type="radio" name="tbl_${k}" value="1" ${String(a[k])==='1'?'checked':''} onchange="captureAnswer()"></td><td><input type="radio" name="tbl_${k}" value="2" ${String(a[k])==='2'?'checked':''} onchange="captureAnswer()"></td></tr>`;}).join('')}</tbody></table></div>`;}return '';}
function captureAnswer(){const q=APP.attempt.questions[APP.currentIndex];let a;if(q.tipe==='PG')a=document.querySelector('input[name="studentAnswer"]:checked')?.value||'';else if(q.tipe==='PG_KOMPLEKS')a=[...document.querySelectorAll('input[name="studentAnswer"]:checked')].map(x=>x.value);else{a={};['A','B','C','D'].forEach(k=>{a[k]=document.querySelector(`input[name="tbl_${k}"]:checked`)?.value||'';});}APP.answers[q.idSoal]=a;google.script.run.saveStudentAnswer({idAttempt:APP.attempt.attempt.idAttempt,idSiswa:APP.user.idSiswa,idSoal:q.idSoal,jawaban:a});}
function hasAnswer(id){const a=APP.answers[id];return Array.isArray(a)?a.length>0:typeof a==='object'?(a&&Object.values(a).some(Boolean)):Boolean(a);}
function goStudentQuestion(i){captureAnswer();APP.currentIndex=i;renderStudentWork();startTimer(APP.attempt.remainingSeconds-(Math.floor((Date.now()-new Date(APP.attempt.attempt.mulai).getTime())/1000)));}
function studentNext(){captureAnswer();if(APP.currentIndex<APP.attempt.questions.length-1){APP.currentIndex++;renderStudentWork();}}
function studentPrev(){captureAnswer();if(APP.currentIndex>0){APP.currentIndex--;renderStudentWork();}}
function submitStudent(auto){captureAnswer();if(!auto&&!confirm('Yakin ingin mengumpulkan ujian? Setelah dikumpulkan jawaban tidak dapat diubah.'))return;google.script.run.withSuccessHandler(r=>{if(APP.timer)clearInterval(APP.timer);showStudentResult(r);}).withFailureHandler(e=>alert(e.message)).submitStudentAttempt(APP.attempt.attempt.idAttempt,APP.user.idSiswa);}
function showStudentResult(r){showView('studentResult');studentResult.innerHTML=`<div class="result-hero"><div class="result-icon">✓</div><p class="muted">Ujian selesai</p><h2>${escapeHtml(r.namaUjian)}</h2><div class="big-score">${Number(r.nilai||0).toFixed(2)}</div><p>Nilai akhir</p></div><div class="card"><div class="card-title">Hasil Pengerjaan</div><div class="table-wrap"><table class="result-table"><thead><tr><th>No</th><th>Soal</th><th>Hasil</th><th>Skor</th></tr></thead><tbody>${r.items.map(x=>`<tr><td>${x.nomor}</td><td>${renderQuestion(x.pertanyaan)}</td><td>${x.benar?'Benar':'Salah'}</td><td>${x.skor}</td></tr>`).join('')}</tbody></table></div></div><button class="btn btn-primary" onclick="showView('studentExams')">Kembali ke Ujian Saya</button>`;loadStudentExams();}
function viewStudentResult(id){google.script.run.withSuccessHandler(showStudentResult).getStudentResult(id,APP.user.idSiswa);}

/* ===== Rich answer options: text + visual math + image ===== */
(function(){
  APP.richSelections=APP.richSelections||{};
  APP.optionImages=APP.optionImages||{};
  const optionIds=['optA','optB','optC','optD','cA','cB','cC','cD','tA','tB','tC','tD'];
  const suffixes=['A','B','C','D'];
  function ensureOptionState(id){if(!APP.optionImages[id])APP.optionImages[id]={url:'',pending:'',remove:false,position:'after'};return APP.optionImages[id];}
  window.rememberRichSelection=function(id){const ed=document.getElementById(id),sel=window.getSelection();if(!ed||!sel||!sel.rangeCount)return;const r=sel.getRangeAt(0);if(ed.contains(r.commonAncestorContainer)||r.commonAncestorContainer===ed)APP.richSelections[id]=r.cloneRange();APP.richTarget=id;};
  window.restoreRichSelection=function(id){const ed=document.getElementById(id),sel=window.getSelection();if(!ed||!sel)return;sel.removeAllRanges();const saved=APP.richSelections[id];if(saved){try{sel.addRange(saved);return;}catch(e){}}const r=document.createRange();r.selectNodeContents(ed);r.collapse(false);sel.addRange(r);};
  window.openOptionMath=function(ev,id){if(ev){ev.preventDefault();ev.stopPropagation();}APP.richTarget=id;rememberRichSelection(id);const p=document.getElementById('mathPalette');if(p)p.classList.remove('hidden');};
  window.insertMathLatex=function(latex){insertMathIntoEditor(latex,getMathTargetId());};

  window.openMatrixPicker=function(){if(getMathTargetId()==='questionEditor')rememberQuestionSelection();else rememberRichSelection(getMathTargetId());document.getElementById('matrixPicker')?.classList.toggle('hidden');};
  window.insertMatrix=function(rows,cols){const cells=[];for(let r=0;r<rows;r++){const row=[];for(let c=0;c<cols;c++)row.push('#?');cells.push(row.join('&'));}document.getElementById('matrixPicker')?.classList.add('hidden');insertMathLatex('\\begin{pmatrix}'+cells.join('\\\\')+'\\end{pmatrix}');};
  window.execRichFormat=function(id,cmd){const ed=document.getElementById(id);if(!ed)return;ed.focus();try{document.execCommand(cmd,false,null);}catch(e){}syncRichHidden(id);};
  window.syncRichHidden=function(id){const ed=document.getElementById(id);if(!ed)return;APP.richSelections=APP.richSelections||{};const sel=window.getSelection();if(sel&&sel.rangeCount){const r=sel.getRangeAt(0);if(ed.contains(r.commonAncestorContainer))APP.richSelections[id]=r.cloneRange();}queueMathTypeset();};
  window.bindRichEditorExit=function(id){const ed=document.getElementById(id);if(!ed||ed.dataset.exitBound==='1')return;ed.dataset.exitBound='1';ed.addEventListener('mousedown',e=>{if(!e.target.closest('math-field')&&APP.activeMathField&&APP.activeMathField.closest('#'+id)){APP.activeMathField.blur();clearActiveMathField(APP.activeMathField);}});};
  window.serializeRichNode=function(node){if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||'';if(node.nodeType!==Node.ELEMENT_NODE)return '';if(node.tagName==='BR')return '\n';if(node.tagName.toLowerCase()==='math-field')return '\\('+cleanMathLatex(node.value||'')+'\\)';let out='';node.childNodes.forEach(n=>out+=serializeRichNode(n));if(['DIV','P'].includes(node.tagName))out+='\n';return out;};
  window.serializeRichEditor=function(id){const ed=document.getElementById(id);if(!ed)return '';let out='';ed.childNodes.forEach(n=>out+=serializeRichNode(n));return out.replace(/\n{3,}/g,'\n\n').trim();};
  window.parseOptionContent=function(raw){if(raw&&typeof raw==='object')return {text:String(raw.text||''),image:String(raw.image||''),imagePosition:raw.imagePosition==='before'?'before':'after'};const s=String(raw||'');if(s.startsWith('OPTION::')){try{const o=JSON.parse(s.slice(8));return {text:String(o.text||''),image:String(o.image||''),imagePosition:o.imagePosition==='before'?'before':'after'};}catch(e){}}return {text:s.replace(/^TEXT::/,''),image:'',imagePosition:'after'};};
  window.packOptionContent=function(id){const st=ensureOptionState(id),text=serializeRichEditor(id);if(!text.trim()&&!st.url&&!st.pending)return '';return 'OPTION::'+JSON.stringify({text:text,image:st.remove?'':(st.url||''),imagePosition:document.getElementById(id+'ImagePosition')?.value||st.position||'after'});};
  window.renderRichEditorContent=function(id,raw){const ed=document.getElementById(id);if(!ed)return;ed.innerHTML='';const text=String(raw||'').replace(/^TEXT::/,'');const re=/\\\(([\s\S]*?)\\\)/g;let last=0,m;while((m=re.exec(text))){if(m.index>last)ed.appendChild(document.createTextNode(text.slice(last,m.index)));const mf=document.createElement('math-field');mf.className='inline-math-field';mf.setAttribute('virtual-keyboard-mode','manual');mf.setAttribute('menu-items','none');mf.setAttribute('smart-mode','false');try{mf.defaultMode='inline-math';}catch(e){}mf.style.fontSize='1em';mf.value=m[1];ed.appendChild(mf);ed.appendChild(document.createTextNode(' '));last=re.lastIndex;}if(last<text.length)ed.appendChild(document.createTextNode(text.slice(last)));bindRichEditorExit(id);ed.addEventListener('input',()=>syncRichHidden(id));['keyup','mouseup','focus'].forEach(ev=>ed.addEventListener(ev,()=>rememberRichSelection(id)));};
  window.previewOptionImage=function(ev,id){const file=ev.target.files?.[0],box=document.getElementById(id+'ImagePreview');if(!file)return;compressImageFile(file).then(data=>{const st=ensureOptionState(id);st.pending=data;st.remove=false;box.classList.remove('hidden');box.innerHTML='<img src="'+data+'" alt="Pratinjau gambar pilihan"><span>Gambar akan disimpan bersama pilihan jawaban.</span>';}).catch(e=>{ev.target.value='';alert(e.message);});};
  window.setExistingOption=function(id,raw){const o=parseOptionContent(raw),st=ensureOptionState(id);st.url=o.image||'';st.pending='';st.remove=false;st.position=o.imagePosition||'after';renderRichEditorContent(id,o.text);const pos=document.getElementById(id+'ImagePosition');if(pos)pos.value=st.position;const box=document.getElementById(id+'ImagePreview');if(box){if(o.image){box.classList.remove('hidden');box.innerHTML='<img src="'+escapeHtml(o.image)+'" alt="Gambar tersimpan"><span>Gambar tersimpan. Pilih gambar baru untuk menggantinya.</span>';}else{box.classList.add('hidden');box.innerHTML='';}}};
  window.clearOptionEditor=function(id){const ed=document.getElementById(id);if(ed)ed.innerHTML='';const st=ensureOptionState(id);st.url='';st.pending='';st.remove=false;st.position='after';const pos=document.getElementById(id+'ImagePosition');if(pos)pos.value='after';const file=document.getElementById(id+'Image');if(file)file.value='';const box=document.getElementById(id+'ImagePreview');if(box){box.classList.add('hidden');box.innerHTML='';}APP.richSelections[id]=null;};
  window.uploadRichImage=function(dataUrl,fileName){return new Promise((resolve,reject)=>{google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(new Error(e.message||'Gagal mengunggah gambar.'))).uploadQuestionImage(dataUrl,fileName,APP.user?.idUser||'');});};
  window.collectRichOptionPayload=async function(id){const st=ensureOptionState(id);if(st.pending){const input=document.getElementById(id+'Image');const r=await uploadRichImage(st.pending,input?.files?.[0]?.name||('opsi-'+id+'-gambar.jpg'));st.url=r.url;st.pending='';}return packOptionContent(id);};
  window.initRichOptionEditors=function(){optionIds.forEach(id=>{const ed=document.getElementById(id);if(ed&&!ed.dataset.richInit){renderRichEditorContent(id,'');ed.dataset.richInit='1';bindRichEditorExit(id);}});};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initRichOptionEditors,200));

  window.collectQuestionData= function(){const t=qType.value,d={idSoal:APP.editingQuestion?.idSoal||'',mapelId:qMapel.value,kategoriId:qKategori.value,guruId:APP.user?.idUser||'',tipe:t,pertanyaan:getQuestionText(),bobot:Number(qWeight.value||1),tingkat:qLevel.value,imageUrl:APP.editingQuestion?.imageUrl||'',imagePosition:document.getElementById('questionImagePosition')?.value||'after',removeImage:!!APP.removeQuestionImage};return d;};

  async function buildRichQuestionPayload(){
    const d=collectQuestionData();
    const ids=t=>t==='PG'?['optA','optB','optC','optD']:t==='PG_KOMPLEKS'?['cA','cB','cC','cD']:['tA','tB','tC','tD'];
    const oi=ids(d.tipe);const vals={};for(const id of oi)vals[id]=await collectRichOptionPayload(id);
    if(d.tipe==='PG'){d.opsiA=vals.optA;d.opsiB=vals.optB;d.opsiC=vals.optC;d.opsiD=vals.optD;d.jawaban=qAnswer.value;}
    if(d.tipe==='PG_KOMPLEKS'){d.opsiA=vals.cA;d.opsiB=vals.cB;d.opsiC=vals.cC;d.opsiD=vals.cD;d.jawaban=[...document.querySelectorAll('.complex-answer:checked')].map(x=>x.value);d.percentages={A:Number(cPctA.value),B:Number(cPctB.value),C:Number(cPctC.value),D:Number(cPctD.value)};}
    if(d.tipe==='TABEL'){d.opsiA=vals.tA;d.opsiB=vals.tB;d.opsiC=vals.tC;d.opsiD=vals.tD;d.jawabanObj={labels:[tfLabel1.value,tfLabel2.value],keys:{A:tAKey.value,B:tBKey.value,C:tCKey.value,D:tDKey.value},percentages:{A:Number(tAPct.value),B:Number(tBPct.value),C:Number(tCPct.value),D:Number(tDPct.value)}};}
    return d;
  }
  window.saveQuestion=async function(){const msg=saveMessage,editingId=APP.editingQuestion?.idSoal||'';try{const d=await buildRichQuestionPayload();if(!d.mapelId||!d.kategoriId||!d.pertanyaan.replace(/^TEXT::/,'').trim()){msg.textContent='Mapel, kategori, dan pertanyaan wajib diisi.';return;}msg.textContent=editingId?'Menyimpan perubahan soal...':'Menyimpan soal...';const file=document.getElementById('questionImage')?.files?.[0];if(file){msg.textContent='Mengunggah gambar soal...';const data=await compressImageFile(file),r=await uploadRichImage(data,file.name);d.imageUrl=r.url;}const call=google.script.run.withSuccessHandler(r=>{msg.textContent=editingId?'Perubahan soal berhasil disimpan.':'Soal berhasil disimpan: '+r.idSoal;APP.editingQuestion=null;clearQuestionForm(false);loadBank();}).withFailureHandler(e=>msg.textContent=e.message||'Gagal menyimpan soal.');if(editingId)call.updateQuestion({...d,idSoal:editingId});else call.saveQuestion(d);}catch(e){msg.textContent=e.message||'Gagal menyimpan soal.';}};

  window.clearQuestionForm=function(clear=true){APP.editingQuestion=null;APP.pendingImageData='';APP.removeQuestionImage=false;['optA','optB','optC','optD','cA','cB','cC','cD','tA','tB','tC','tD'].forEach(clearOptionEditor);const ed=document.getElementById('questionEditor');if(ed)ed.innerHTML='';if(document.getElementById('textQuestion'))textQuestion.value='';APP.questionSelection=null;const img=document.getElementById('questionImage');if(img)img.value='';const pos=document.getElementById('questionImagePosition');if(pos)pos.value='after';const box=document.getElementById('questionImagePreview');if(box){box.classList.add('hidden');box.innerHTML='';}document.getElementById('removeQuestionImageBtn')?.classList.add('hidden');qWeight.value=1;document.querySelectorAll('.complex-answer').forEach(x=>x.checked=false);['cPctA','cPctB','cPctC','cPctD','tAPct','tBPct','tCPct','tDPct'].forEach((id,i)=>{const e=document.getElementById(id);if(e)e.value=[50,50,-25,-25][i];});qAnswer.value='A';qLevel.value='Sedang';qType.value='PG';qMapel.value='';populateQuestionCategories();renderQuestionTypeFields();const btn=document.getElementById('questionSaveBtn');if(btn)btn.textContent='Simpan ke Bank Soal';const heading=document.querySelector('#buatSoalView .page-heading h2');if(heading)heading.textContent='Buat Soal';const sub=document.querySelector('#buatSoalView .page-heading .muted');if(sub)sub.textContent='Buat soal langsung dan simpan ke bank soal.';if(clear)saveMessage.textContent='';};

  window.editQuestion=function(id){google.script.run.withSuccessHandler(q=>{APP.editingQuestion=q;showView('buatSoal');qMapel.value=q.idMapel||'';populateQuestionCategories();qKategori.value=q.idKategori||'';qType.value=q.tipe||'PG';qLevel.value=q.tingkat||'Sedang';qWeight.value=Number(q.bobot||1);['optA','optB','optC','optD','cA','cB','cC','cD','tA','tB','tC','tD'].forEach(clearOptionEditor);['optA','optB','optC','optD'].forEach(id2=>setExistingOption(id2,q['opsi'+id2.slice(-1)]||''));['cA','cB','cC','cD'].forEach(id2=>setExistingOption(id2,q['opsi'+id2.slice(-1)]||''));['tA','tB','tC','tD'].forEach(id2=>setExistingOption(id2,q['opsi'+id2.slice(-1)]||''));document.querySelectorAll('.complex-answer').forEach(x=>x.checked=false);let cfg=readScoringConfig(q);if(q.tipe==='PG')qAnswer.value=q.jawaban||'A';if(q.tipe==='PG_KOMPLEKS'){document.querySelectorAll('.complex-answer').forEach(x=>x.checked=(cfg.correct||[]).map(String).includes(String(x.value)));['A','B','C','D'].forEach(k=>{const e=document.getElementById('cPct'+k);if(e)e.value=String(cfg.percentages?.[k]??0);});}if(q.tipe==='TABEL'){tfLabel1.value=cfg.labels?.[0]||'Benar';tfLabel2.value=cfg.labels?.[1]||'Salah';['A','B','C','D'].forEach(k=>{const e=document.getElementById('t'+k+'Key'),p=document.getElementById('t'+k+'Pct');if(e)e.value=String(cfg.keys?.[k]||'1');if(p)p.value=String(cfg.percentages?.[k]??0);});}const raw=String(q.pertanyaan||'');let qc=null;if(raw.startsWith('QUESTION::')){try{qc=JSON.parse(raw.slice(10));}catch(e){}}renderQuestionEditorContent(qc?.text??raw.replace(/^TEXT::/,'').replace(/^MATH::/,'\\('+raw.slice(6)+'\\)'));setExistingQuestionImage(qc?.image||q.imageUrl||'',qc?.imagePosition||q.imagePosition||'after');renderQuestionTypeFields();const btn=document.getElementById('questionSaveBtn');if(btn)btn.textContent='Simpan Perubahan';const heading=document.querySelector('#buatSoalView .page-heading h2');if(heading)heading.textContent='Edit Soal';const sub=document.querySelector('#buatSoalView .page-heading .muted');if(sub)sub.textContent='Perubahan akan memperbarui soal yang sama di Bank Soal.';saveMessage.textContent='Mode edit aktif — ID Soal: '+q.idSoal;initRichOptionEditors();}).withFailureHandler(e=>alert(e.message||'Soal gagal dimuat.')).getQuestion(id);};

  function cleanMathLatex(raw){let s=String(raw||'');for(let i=0;i<5;i++){const n=s.replace(/\\placeholder\{([^{}]*)\}/g,'$1');if(n===s)break;s=n;}return s;}
  function renderRichMathText(raw){let text=escapeHtml(String(raw||''));text=text.replace(/\\n/g,'<br>');text=text.replace(/\\\(([\s\S]*?)\\\)/g,(m,latex)=>'\\('+cleanMathLatex(latex)+'\\)');return text;}
  window.renderQuestion=function(raw){const q=parseQuestionContent(raw);if(!q.text&&!q.image)return '';const text=renderRichMathText(q.text||'');const img=q.image?'<div class="question-stimulus-image"><img src="'+escapeHtml(normalizeImageUrl(q.image))+'" alt="Gambar soal"></div>':'';const out=q.imagePosition==='before'?img+'<div class="question-rich-text">'+text+'</div>':'<div class="question-rich-text">'+text+'</div>'+img;setTimeout(queueMathTypeset,0);return out;};
  window.renderOptionContent=function(raw){const o=parseOptionContent(raw);const text=renderRichMathText(o.text||'');const img=o.image?'<div class="option-stimulus-image"><img src="'+escapeHtml(normalizeImageUrl(o.image))+'" alt="Gambar pilihan jawaban"></div>':'';const out=o.imagePosition==='before'?img+'<div class="option-rich-text">'+text+'</div>':'<div class="option-rich-text">'+text+'</div>'+img;setTimeout(queueMathTypeset,0);return out;};
  window.renderQuestionOptions=function(q){if(q.tipe==='PG')return `<div class="question-options">A. ${renderOptionContent(q.opsiA)}<br>B. ${renderOptionContent(q.opsiB)}<br>C. ${renderOptionContent(q.opsiC)}<br>D. ${renderOptionContent(q.opsiD)}</div>`;if(q.tipe==='PG_KOMPLEKS'){const o=readScoringConfig(q);return `<div class="question-options">A. ${renderOptionContent(q.opsiA)} (${Number(o.percentages?.A||0)>0?'+':''}${Number(o.percentages?.A||0)}%)<br>B. ${renderOptionContent(q.opsiB)} (${Number(o.percentages?.B||0)>0?'+':''}${Number(o.percentages?.B||0)}%)<br>C. ${renderOptionContent(q.opsiC)} (${Number(o.percentages?.C||0)>0?'+':''}${Number(o.percentages?.C||0)}%)<br>D. ${renderOptionContent(q.opsiD)} (${Number(o.percentages?.D||0)>0?'+':''}${Number(o.percentages?.D||0)}%)</div>`;}if(q.tipe==='TABEL'){const o=readScoringConfig(q);return `<table class="mini-table"><tr><th>Pernyataan</th><th>Kunci</th><th>%</th></tr>${['A','B','C','D'].map(x=>`<tr><td>${x}. ${renderOptionContent(q['opsi'+x])}</td><td>${escapeHtml((o.labels||['Benar','Salah'])[Number(o.keys?.[x]||1)-1])}</td><td>${Number(o.percentages?.[x]||0)>0?'+':''}${Number(o.percentages?.[x]||0)}%</td></tr>`).join('')}</table>`;}return '';};
  window.renderPreviewQuestion=function(q){let body='';if(q.tipe==='PG'||q.tipe==='PG_KOMPLEKS')body=`<div class="preview-options"><div>A. ${renderOptionContent(q.opsiA)}</div><div>B. ${renderOptionContent(q.opsiB)}</div><div>C. ${renderOptionContent(q.opsiC)}</div><div>D. ${renderOptionContent(q.opsiD)}</div></div>`;else if(q.tipe==='TABEL'){const o=readScoringConfig(q);body=`<table class="mini-table"><tr><th>Pernyataan</th><th>${escapeHtml(o.labels?.[0]||'Label 1')}</th><th>${escapeHtml(o.labels?.[1]||'Label 2')}</th></tr>${['A','B','C','D'].map(x=>`<tr><td>${x}. ${renderOptionContent(q['opsi'+x])}</td><td>○</td><td>○</td></tr>`).join('')}</table>`;}return `<div class="preview-question"><div class="question-meta"><span class="tag">Soal ${q.nomor}</span><span class="tag">${escapeHtml(typeName(q.tipe))}</span><span class="tag">Bobot ${Number(q.bobot||0)}</span></div><div class="preview-question-text">${renderQuestion(q.pertanyaan)}</div>${body}</div>`;};
})();

/* ==========================================================
   WAYGROUND-INSPIRED EQUATION EDITOR
   Terhubung ke editor pertanyaan dan seluruh editor opsi.
   Format simpan tetap \(...\), kompatibel dengan sistem lama.
========================================================== */
(function(){
  const state={targetId:'questionEditor',editingField:null,mode:'visual',originalLatex:''};
  const modal=()=>document.getElementById('equationEditorModal');
  const field=()=>document.getElementById('eqModalField');
  const latexInput=()=>document.getElementById('eqLatexInput');
  function clean(v){return String(v||'').replace(/\\placeholder\{([^{}]*)\}/g,'#?').trim();}
  window.openEquationEditor=function(ev,targetId='questionEditor',editingField=null){
    if(ev){ev.preventDefault?.();ev.stopPropagation?.();}
    state.targetId=targetId||'questionEditor';
    const activeField=APP.activeMathField;
    state.editingField=editingField||(activeField&&activeField.isConnected&&activeField.closest('#'+state.targetId)?activeField:null);
    APP.richTarget=state.targetId;
    if(!state.editingField){
      if(state.targetId==='questionEditor')rememberQuestionSelection();
      else if(typeof rememberRichSelection==='function')rememberRichSelection(state.targetId);
    }
    const initial=state.editingField?clean(state.editingField.value):'';
    state.originalLatex=initial;
    const mf=field();if(!mf)return;
    mf.value=initial; if(latexInput())latexInput().value=initial;
    setEquationMode('visual');modal()?.classList.remove('hidden');
    document.body.style.overflow='hidden';
    setTimeout(()=>{try{mf.focus();}catch(e){}},80);
  };
  window.closeEquationEditor=function(){modal()?.classList.add('hidden');document.body.style.overflow='';state.editingField=null;};
  window.setEquationMode=function(mode){
    state.mode=mode==='latex'?'latex':'visual';
    document.querySelectorAll('[data-eq-mode]').forEach(b=>b.classList.toggle('active',b.dataset.eqMode===state.mode));
    document.getElementById('eqVisualPanel')?.classList.toggle('hidden',state.mode!=='visual');
    document.getElementById('eqLatexPanel')?.classList.toggle('hidden',state.mode!=='latex');
    const note=document.getElementById('eqModeNote');if(note)note.textContent=state.mode==='visual'?'Pilih simbol untuk menyusun persamaan':'Edit kode LaTeX secara langsung';
    if(state.mode==='latex'&&latexInput()){latexInput().value=clean(field()?.value);latexInput().focus();}
    if(state.mode==='visual'){try{field()?.focus();}catch(e){}}
  };
  window.syncEquationFromLatex=function(){const mf=field(),ta=latexInput();if(!mf||!ta)return;try{mf.value=ta.value;}catch(e){}};
  window.insertEquationSymbol=function(expr){const mf=field();if(!mf)return;try{mf.focus();mf.insert(expr,{selectionMode:'placeholder',focus:true});if(latexInput())latexInput().value=mf.value;}catch(e){console.warn('Gagal memasukkan simbol:',e);}};
  window.applyEquationEditor=function(){
    const mf=field();if(!mf)return;const latex=clean(state.mode==='latex'?(latexInput()?.value??mf.value):mf.value);
    if(!latex){alert('Silakan isi rumus terlebih dahulu.');return;}
    if(state.editingField&&state.editingField.isConnected){
      state.editingField.value=latex;
      try{state.editingField.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}
      if(state.targetId==='questionEditor')syncHiddenQuestion();else if(typeof syncRichHidden==='function')syncRichHidden(state.targetId);
    }else{
      // Sisipkan sebagai satu inline math-field pada posisi caret yang tersimpan.
      if(state.targetId==='questionEditor'){
        if(typeof restoreQuestionSelection==='function')restoreQuestionSelection();
      }else if(typeof restoreRichSelection==='function')restoreRichSelection(state.targetId);
      insertMathIntoEditor(latex,state.targetId);
    }
    queueMathTypeset();window.closeEquationEditor();
  };
  // Capture double-click before MathLive's own handler so existing formulas can be edited.
  document.addEventListener('dblclick',e=>{const mf=e.target?.closest?.('math-field');if(!mf)return;const editor=mf.closest('.question-visual-editor,.rich-option-editor');if(!editor)return;e.preventDefault();e.stopPropagation();window.openEquationEditor(e,editor.id,mf);},true);
  // Backdrop click and Escape close the dialog; clicks inside do not.
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal()?.classList.contains('hidden'))window.closeEquationEditor();});
  // Compatibility aliases: old calls now open the full editor instead of the compact palette.
  window.toggleMathPalette=function(ev){window.openEquationEditor(ev,'questionEditor');};
  window.openOptionMath=function(ev,id){window.openEquationEditor(ev,id);};
})();


/* ==========================================================
   ANALISIS TES
   Daftar ujian, matriks jawaban, rekap, dan grafik
========================================================== */

function loadAnalysisExams() {
  const box = document.getElementById('analysisExamList');
  if (!box) return;

  box.innerHTML = `
    <div class="analysis-loading">
      Memuat daftar ujian yang sudah selesai...
    </div>
  `;

  google.script.run
    .withSuccessHandler(rows => {
      renderAnalysisExamList(Array.isArray(rows) ? rows : []);
    })
    .withFailureHandler(e => {
      box.innerHTML = `
        <div class="analysis-empty">
          <b>Gagal memuat daftar ujian</b>
          <p>${escapeHtml(e.message || 'Terjadi kesalahan.')}</p>
          <button class="btn btn-light" onclick="loadAnalysisExams()">
            Coba Lagi
          </button>
        </div>
      `;
    })
    .getCompletedExamsForAnalysis(APP.user?.idUser || '');
}


function renderAnalysisExamList(rows) {
  const box = document.getElementById('analysisExamList');
  if (!box) return;

  if (!rows.length) {
    box.innerHTML = `
      <div class="analysis-empty">
        <div class="empty-icon">📊</div>
        <b>Belum ada hasil ujian</b>
        <p class="muted">
          Ujian yang sudah dikerjakan dan dikumpulkan siswa
          akan muncul di halaman ini.
        </p>
      </div>
    `;
    return;
  }

  box.innerHTML = rows.map(e => `
    <div class="analysis-exam-card">
      <div class="analysis-exam-info">
        <span class="tag">${escapeHtml(e.namaMapel || 'Mata Pelajaran')}</span>
        <h3>${escapeHtml(e.namaUjian || 'Ujian')}</h3>
        <div class="analysis-exam-meta">
          <span>👥 ${Number(e.jumlahPeserta || 0)} peserta</span>
          <span>📈 Rata-rata ${Number(e.rataRataNilai || 0).toFixed(2)}</span>
          <span>📝 ${escapeHtml(e.status || 'Selesai')}</span>
        </div>
      </div>

      <button
        type="button"
        class="btn btn-primary"
        onclick="openAnalysisExam('${escapeHtml(e.idUjian)}')">
        Lihat Analisis →
      </button>
    </div>
  `).join('');
}


/* Membuka matriks jawaban dari ujian yang dipilih */
function openAnalysisExam(idUjian) {
  const listView = document.getElementById('analysisExamListView');
  const detailView = document.getElementById('analysisDetailView');
  const detail = document.getElementById('analysisDetail');

  if (!listView || !detailView || !detail) return;

  listView.classList.add('hidden');
  detailView.classList.remove('hidden');

  detail.innerHTML = `
    <div class="card analysis-loading">
      <div class="empty-icon">📊</div>
      Memuat matriks jawaban siswa...
    </div>
  `;

  google.script.run
    .withSuccessHandler(data => {
      renderAnalysisMatrix(data);
    })
    .withFailureHandler(e => {
      detail.innerHTML = `
        <div class="card analysis-empty">
          <b>Gagal memuat analisis ujian</b>
          <p>${escapeHtml(e.message || 'Terjadi kesalahan.')}</p>
          <button class="btn btn-light" onclick="backToAnalysisExams()">
            ← Kembali
          </button>
        </div>
      `;
    })
    .getExamAnswerMatrix(idUjian, APP.user?.idUser || '');
}


/* Kembali ke daftar ujian */
function backToAnalysisExams() {
  document.getElementById('analysisDetailView')?.classList.add('hidden');
  document.getElementById('analysisExamListView')?.classList.remove('hidden');
  loadAnalysisExams();
}


/* Normalisasi status jawaban */
function getAnalysisStatus(value) {
  const status = String(value?.status || 'KOSONG').toUpperCase();

  if (status === 'BENAR') return 'BENAR';
  if (status === 'SALAH') return 'SALAH';
  if (status === 'PARSIAL') return 'PARSIAL';

  return 'KOSONG';
}


function getAnalysisStatusLabel(status) {
  const labels = {
    BENAR: 'BENAR',
    SALAH: 'SALAH',
    PARSIAL: 'PARSIAL',
    KOSONG: 'KOSONG'
  };

  return labels[status] || 'KOSONG';
}


function getAnalysisPercentage(value, total) {
  if (!total) return 0;
  return (Number(value || 0) / total) * 100;
}


/* Mengolah rekap empat kategori untuk setiap soal */
function calculateAnalysisSummary(columns, rows) {
  return columns.map((column, index) => {
    const counts = {
      BENAR: 0,
      SALAH: 0,
      PARSIAL: 0,
      KOSONG: 0
    };

    rows.forEach(row => {
      let cell = {};

      if (Array.isArray(row.cells)) {
        cell =
          row.cells.find(x =>
            String(x.idSoal) === String(column.idSoal)
          ) || row.cells[index] || {};
      } else if (row.cells) {
        cell = row.cells[column.idSoal] || {};
      }

      counts[getAnalysisStatus(cell)]++;
    });

    const total = rows.length;

    return {
      idSoal: column.idSoal,
      nomor: column.nomor,
      total,
      benar: counts.BENAR,
      salah: counts.SALAH,
      parsial: counts.PARSIAL,
      kosong: counts.KOSONG,
      persenBenar: getAnalysisPercentage(counts.BENAR, total),
      persenSalah: getAnalysisPercentage(counts.SALAH, total),
      persenParsial: getAnalysisPercentage(counts.PARSIAL, total),
      persenKosong: getAnalysisPercentage(counts.KOSONG, total)
    };
  });
}


/* Menghasilkan satu sel matriks jawaban */
function renderAnalysisCell(cell) {
  const status = getAnalysisStatus(cell);
  const nomorTampil = Number(cell?.nomorTampil || 0);
  const skor = Number(cell?.skor || 0);
  const bobot = Number(cell?.bobot || 0);

  const nomorInfo = nomorTampil
    ? `<small class="analysis-cell-number">Tampil #${nomorTampil}</small>`
    : '';

  const skorInfo = status === 'PARSIAL'
    ? `<small class="analysis-cell-score">${skor} / ${bobot}</small>`
    : '';

  return `
    <td class="analysis-cell status-${status.toLowerCase()}"
        title="${getAnalysisStatusLabel(status)}${nomorTampil ? ' · Nomor tampil: ' + nomorTampil : ''}">
      <span>${getAnalysisStatusLabel(status)}</span>
      ${nomorInfo}
      ${skorInfo}
    </td>
  `;
}


/* Menampilkan matriks dan seluruh hasil analisis */
function renderAnalysisMatrix(data) {
  const detail = document.getElementById('analysisDetail');
  if (!detail) return;

  if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows)) {
    detail.innerHTML = `
      <div class="card analysis-empty">
        Data analisis tidak ditemukan atau format data tidak sesuai.
        <button class="btn btn-light" onclick="backToAnalysisExams()">
          ← Kembali
        </button>
      </div>
    `;
    return;
  }

  const exam = data.exam || {};
  const columns = data.columns;
  const rows = data.rows;
  const totalPeserta = rows.length;
  const totalSoal = columns.length;

  const summary = calculateAnalysisSummary(columns, rows);

  const rataRata = totalPeserta
    ? rows.reduce((sum, row) => sum + Number(row.nilai || 0), 0) / totalPeserta
    : 0;

  const summaryRows = [
    { key: 'benar', label: 'BENAR', className: 'summary-benar' },
    { key: 'salah', label: 'SALAH', className: 'summary-salah' },
    { key: 'parsial', label: 'PARSIAL', className: 'summary-parsial' },
    { key: 'kosong', label: 'KOSONG', className: 'summary-kosong' }
  ];

  const matrixHeader = `
    <thead>
      <tr>
        <th class="analysis-sticky-col analysis-student-heading">
          Peserta Didik
        </th>

        ${columns.map(col => `
          <th class="analysis-question-heading">
            <b>Soal ${Number(col.nomor || 0)}</b>
            <small>${escapeHtml(typeName(col.tipe || ''))}</small>
          </th>
        `).join('')}
      </tr>
    </thead>
  `;

  const matrixBody = `
    <tbody>
      ${rows.map((row, index) => `
        <tr>
          <td class="analysis-sticky-col analysis-student-cell">
            <b>${escapeHtml(row.nama || 'Tanpa Nama')}</b>
            <small>${escapeHtml(row.kelas || '-')}</small>
            <small>Nilai: ${Number(row.nilai || 0).toFixed(2)}</small>
          </td>

          ${columns.map((col, colIndex) => {
            let cell = {};

            if (Array.isArray(row.cells)) {
              cell =
                row.cells.find(x =>
                  String(x.idSoal) === String(col.idSoal)
                ) || row.cells[colIndex] || {};
            } else if (row.cells) {
              cell = row.cells[col.idSoal] || {};
            }

            return renderAnalysisCell(cell);
          }).join('')}
        </tr>
      `).join('')}

      ${summaryRows.map(item => `
        <tr class="analysis-summary-row ${item.className}">
          <td class="analysis-sticky-col analysis-summary-label">
            ${item.label}
          </td>

          ${summary.map(s => {
            const count = Number(s[item.key] || 0);
            const percentage = getAnalysisPercentage(count, totalPeserta);

            return `
              <td class="analysis-summary-cell">
                <b>${count}</b>
                <small>${percentage.toFixed(0)}%</small>
              </td>
            `;
          }).join('')}
        </tr>
      `).join('')}
    </tbody>
  `;

  detail.innerHTML = `
    <div class="page-heading analysis-page-heading">
      <div>
        <h2>${escapeHtml(exam.namaUjian || 'Analisis Hasil Ujian')}</h2>
        <p class="muted">
          ${escapeHtml(exam.namaMapel || '')}
          · Analisis jawaban peserta didik
        </p>
      </div>

      <button class="btn btn-light" onclick="backToAnalysisExams()">
        ← Kembali ke Daftar Ujian
      </button>
    </div>

    <div class="analysis-stat-grid">
      <div class="analysis-stat-card">
        <span>Jumlah Peserta</span>
        <b>${totalPeserta}</b>
      </div>

      <div class="analysis-stat-card">
        <span>Jumlah Soal</span>
        <b>${totalSoal}</b>
      </div>

      <div class="analysis-stat-card">
        <span>Rata-rata Nilai</span>
        <b>${rataRata.toFixed(2)}</b>
      </div>
    </div>

    <div class="card analysis-matrix-card">
      <div class="analysis-section-heading">
        <div>
          <h3>Matriks Jawaban Peserta</h3>
          <p class="muted">
            Geser tabel ke kanan untuk melihat seluruh nomor soal.
          </p>
        </div>
      </div>

      <div class="analysis-legend">
        <span><i class="legend-benar"></i> Benar</span>
        <span><i class="legend-salah"></i> Salah</span>
        <span><i class="legend-parsial"></i> Parsial</span>
        <span><i class="legend-kosong"></i> Kosong</span>
      </div>

      <div class="analysis-matrix-scroll">
        <table class="analysis-matrix">
          ${matrixHeader}
          ${matrixBody}
        </table>
      </div>

      <p class="analysis-matrix-note">
        Empat baris rekap di bagian bawah menunjukkan jumlah dan persentase
        setiap kategori jawaban. Persentase dihitung dari seluruh peserta
        yang telah menyelesaikan ujian (${totalPeserta} siswa).
      </p>

      <p class="analysis-matrix-note">
        Pada ujian dengan pengacakan soal, keterangan "Tampil #"
        menunjukkan nomor soal yang dilihat masing-masing siswa.
      </p>
    </div>

    <div class="card analysis-chart-card">
      <div class="analysis-section-heading">
        <div>
          <h3>Grafik Nilai Peserta Didik</h3>
          <p class="muted">Perbandingan nilai seluruh peserta ujian.</p>
        </div>
      </div>

      ${renderAnalysisStudentChart(rows)}
    </div>

    <div class="card analysis-chart-card">
      <div class="analysis-section-heading">
        <div>
          <h3>Grafik Analisis Per Soal</h3>
          <p class="muted">
            Distribusi jawaban benar, salah, parsial, dan kosong.
          </p>
        </div>
      </div>

      ${renderAnalysisQuestionChart(summary)}
    </div>
  `;
}


/* Grafik perbandingan nilai siswa */
function renderAnalysisStudentChart(rows) {
  if (!rows.length) {
    return '<p class="muted">Belum ada data nilai.</p>';
  }

  const sorted = [...rows].sort(
    (a, b) => Number(b.nilai || 0) - Number(a.nilai || 0)
  );

  return `
    <div class="analysis-student-chart">
      ${sorted.map(row => {
        const nilai = Math.max(0, Math.min(100, Number(row.nilai || 0)));

        return `
          <div class="analysis-bar-row">
            <div class="analysis-bar-label">
              ${escapeHtml(row.nama || 'Tanpa Nama')}
            </div>

            <div class="analysis-bar-track">
              <div class="analysis-bar-fill student-score-fill"
                   style="width:${nilai}%"></div>
            </div>

            <b class="analysis-bar-value">${nilai.toFixed(2)}</b>
          </div>
        `;
      }).join('')}
    </div>
  `;
}


/* Grafik distribusi jawaban setiap soal */
function renderAnalysisQuestionChart(summary) {
  if (!summary.length) {
    return '<p class="muted">Belum ada data soal.</p>';
  }

  return `
    <div class="analysis-question-chart">
      ${summary.map(s => `
        <div class="analysis-question-chart-item">
          <div class="analysis-question-chart-title">
            <b>Soal ${Number(s.nomor || 0)}</b>
            <small>${s.total} peserta</small>
          </div>

          <div class="analysis-stacked-bar">
            ${s.persenBenar > 0
              ? `<span class="stack-benar" style="width:${s.persenBenar}%"></span>`
              : ''}

            ${s.persenSalah > 0
              ? `<span class="stack-salah" style="width:${s.persenSalah}%"></span>`
              : ''}

            ${s.persenParsial > 0
              ? `<span class="stack-parsial" style="width:${s.persenParsial}%"></span>`
              : ''}

            ${s.persenKosong > 0
              ? `<span class="stack-kosong" style="width:${s.persenKosong}%"></span>`
              : ''}
          </div>

          <div class="analysis-question-chart-detail">
            <span>Benar ${s.persenBenar.toFixed(0)}%</span>
            <span>Salah ${s.persenSalah.toFixed(0)}%</span>
            <span>Parsial ${s.persenParsial.toFixed(0)}%</span>
            <span>Kosong ${s.persenKosong.toFixed(0)}%</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

