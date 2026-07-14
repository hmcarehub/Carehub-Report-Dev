// ============================================================
// pages/clients.js - 고객 관리 목록 페이지
// ============================================================

const ClientsPage = {
allClients: [],      // 원본 전체 데이터
filtered:   [],      // 필터·검색 후 데이터
currentTab: '입소중',
searchQuery:'',
sortCol:    'roomNum',
sortDir:    'asc',   // 'asc' | 'desc'
pageSize:   10,
currentPage:1,


// ── 전화번호 자동 포맷 ───────────────────────────────────
_autoFormatPhone: function(val) {
const digits = val.replace(/\D/g, '').substring(0, 11);
if (digits.length <= 3)  return digits;
if (digits.length <= 7)  return digits.replace(/(\d{3})(\d{1,4})/, '$1-$2');
return digits.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
},

_formatPhone: function(val) {
if (!val) return '-';
const digits = String(val).replace(/\D/g, '');
if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
if (digits.length === 10) return digits.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
return val;
},

canWrite: function() {
const r = Auth.getUser()?.role;
return r === 'ADMIN' || r === 'CARE_MANAGER';
},

// ── 렌더링 ──────────────────────────────────────────────
render: function() {
const container = document.getElementById('page-content');
container.innerHTML = `
     <div class="page-header">
       <h1 class="page-title">고객 관리</h1>
       <p class="page-subtitle">입소 고객 현황을 조회하고 관리합니다.</p>
     </div>

     <!-- 액션 바 -->
     <div class="action-bar">
       <div class="action-bar-left">
         <div class="status-tabs" id="status-tabs"></div>
       </div>
       <div class="action-bar-right">
         <div class="search-bar">
           <svg class="search-icon" width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
           </svg>
           <input type="text" id="client-search" placeholder="고객명, ID, 전화번호 검색">
         </div>
         ${this.canWrite() ? `
         <button class="btn btn-primary" id="client-add-btn">
           <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
           </svg>
           고객 등록
         </button>` : ''}
       </div>
     </div>

     <!-- 테이블 카드 -->
     <div class="card">
       <div class="card-body" style="padding:0;">
         <div id="clients-table-wrap" class="table-wrap">
           <div class="empty-state"><div class="spinner" style="margin:0 auto;"></div></div>
         </div>
       </div>
       <!-- 페이지네이션: 하단 중앙 -->
       <div style="padding:14px 20px;border-top:1px solid var(--color-gray-100);display:flex;flex-direction:column;align-items:center;gap:8px;">
         <div id="pagination-btns" style="display:flex;gap:4px;justify-content:center;"></div>
          <div id="pagination-info" style="font-size:12px;color:var(--color-gray-400);"></div>
          <div id="pagination-info" style="font-size:13px;color:var(--color-gray-400);"></div>
       </div>
     </div>
   `;

this._bindEvents();
this.loadClients();
},

// ── 이벤트 바인딩 ────────────────────────────────────────
_bindEvents: function() {
// 검색
const searchEl = document.getElementById('client-search');
if (searchEl) {
let debounce;
searchEl.addEventListener('input', e => {
clearTimeout(debounce);
debounce = setTimeout(() => {
this.searchQuery = e.target.value.trim();
this.currentPage = 1;
this._applyFilter();
this._renderTable();
}, 200);
});
}

// 등록 버튼
const addBtn = document.getElementById('client-add-btn');
if (addBtn) addBtn.addEventListener('click', () => this._openCreateModal());
},

// ── 데이터 로드 ──────────────────────────────────────────
loadClients: async function() {
const wrap = document.getElementById('clients-table-wrap');
if (!wrap) return;
try {
UI.showLoading();
// getInitialData 캐시 활용 (대시보드와 데이터 공유)
const init = await API.getInitialData();
const res = { status: init.status, message: init.message, data: { clients: init.data?.clients || [] } };
if (res.status === 'success') {
this.allClients = res.data.clients || [];
this._applyFilter();
this._renderStatusTabs();
this._renderTable();
} else {
wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${res.message}</div></div>`;
}
} catch {
wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔌</div><div class="empty-state-text">서버 연결 오류</div></div>`;
} finally {
UI.hideLoading();
}
},

// ── 필터·검색 ────────────────────────────────────────────
_applyFilter: function() {
let list = [...this.allClients];

// 탭 필터
if (this.currentTab !== '전체') {
list = list.filter(c => c.status === this.currentTab);
}

// 검색
if (this.searchQuery) {
const q = this.searchQuery.toLowerCase();
list = list.filter(c =>
c.name.toLowerCase().includes(q) ||
c.clientId.toLowerCase().includes(q) ||
c.phone.replace(/-/g, '').includes(q.replace(/-/g, ''))
);
}

// 정렬
if (this.sortCol) {
list.sort((a, b) => {
let va = a[this.sortCol] ?? '';
let vb = b[this.sortCol] ?? '';
if (typeof va === 'number') {
return this.sortDir === 'asc' ? va - vb : vb - va;
}
va = String(va); vb = String(vb);
const cmp = va.localeCompare(vb, 'ko');
return this.sortDir === 'asc' ? cmp : -cmp;
});
}

this.filtered = list;
},

// ── 상태 탭 렌더링 ───────────────────────────────────────
_renderStatusTabs: function() {
const tabs = ['입소중', '입소예정', '퇴소', '전체'];
const counts = {};
counts['전체']   = this.allClients.length;
counts['입소중']  = this.allClients.filter(c => c.status === '입소중').length;
counts['입소예정'] = this.allClients.filter(c => c.status === '입소예정').length;
counts['퇴소']   = this.allClients.filter(c => c.status === '퇴소').length;

const wrap = document.getElementById('status-tabs');
if (!wrap) return;
wrap.innerHTML = tabs.map(t => `
     <div class="status-tab${this.currentTab === t ? ' active' : ''}" data-tab="${t}">
       ${t}
       <span class="tab-count">${counts[t]}</span>
     </div>
   `).join('');

wrap.querySelectorAll('.status-tab').forEach(el => {
el.addEventListener('click', () => {
this.currentTab = el.dataset.tab;
this.currentPage = 1;
this._applyFilter();
this._renderStatusTabs();
this._renderTable();
});
});
},

// ── 테이블 렌더링 ────────────────────────────────────────
_renderTable: function() {
const wrap = document.getElementById('clients-table-wrap');
if (!wrap) return;

if (this.filtered.length === 0) {
wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">조건에 맞는 고객이 없습니다.</div></div>`;
this._renderPagination();
return;
}

// 페이지네이션 계산
const total   = this.filtered.length;
const start   = (this.currentPage - 1) * this.pageSize;
const pageData = this.filtered.slice(start, start + this.pageSize);

const sortIcon = (col) => {
if (this.sortCol !== col) return '<span class="sort-icon">↕</span>';
return `<span class="sort-icon">${this.sortDir === 'asc' ? '↑' : '↓'}</span>`;
};

const cols = [
{ key:'roomNum',     label:'입실호수' },
{ key:'name',        label:'고객명' },
{ key:'clientId',    label:'고객 ID' },
{ key:'birthDate',   label:'생년월일' },
{ key:'gender',      label:'성별' },
{ key:'admitDate',   label:'입소일' },
{ key:'endDate',     label:'퇴소예정일' },
{ key:'totalRounds', label:'총회차' },
{ key:'status',      label:'상태' },
{ key:'_progress',   label:'진행현황' }
];

const rows = pageData.map(c => {
const roundPct = c.totalRounds > 0 ? Math.round((c.doneRounds / c.totalRounds) * 100) : 0;
const admitProg = this._calcAdmitProgress(c);
return `
       <tr class="clickable" data-id="${c.clientId}">
         <td style="font-weight:600;color:var(--color-gray-600);">${c.roomNum||'-'}</td>
         <td style="font-weight:700;"><span class="client-name-link" data-id="${c.clientId}" style="cursor:pointer;color:var(--color-primary-dark);text-decoration:underline;text-underline-offset:2px;">${c.name}</span></td>
          <td style="font-size:13px;color:var(--color-gray-500);">${c.clientId}</td>
          <td style="font-size:14px;color:var(--color-gray-500);">${c.clientId}</td>
         <td>${c.birthDate || '-'}</td>
         <td>${c.gender || '-'}</td>
         <td>${c.admitDate || '-'}</td>
         <td>${c.endDate || '-'}</td>
         <td>
           <div class="round-progress">
             <div class="round-label">${c.doneRounds} / ${c.totalRounds}</div>
             <div class="progress-bar-outer">
               <div class="progress-bar-inner round" style="width:${roundPct}%"></div>
             </div>
           </div>
         </td>
         <td>${this._statusBadge(c.status)}</td>
         <td>
           <div class="progress-wrap">
             <div class="progress-label">
               <span>입소진행</span>
               <span class="progress-pct">${admitProg.pct}%</span>
             </div>
             <div class="progress-bar-outer">
               <div class="progress-bar-inner" style="width:${admitProg.pct}%"></div>
             </div>
             <div class="progress-sub">
               ${admitProg.pct < 100 ? `잔여 ${admitProg.remaining}일` : '입소 완료'}
             </div>
           </div>
         </td>
       </tr>`;
}).join('');

wrap.innerHTML = `
      <table class="table">
      <table class="table client-list-table">
       <thead>
         <tr>
           ${cols.map(col => col.key === '_progress'
             ? `<th>${col.label}</th>`
             : `<th class="sort-th${this.sortCol === col.key ? ' ' + this.sortDir : ''}" data-col="${col.key}">${col.label}${sortIcon(col.key)}</th>`
           ).join('')}
         </tr>
       </thead>
       <tbody>${rows}</tbody>
     </table>`;

// 고객명 클릭 → 상세
wrap.querySelectorAll('.client-name-link').forEach(el => {
el.addEventListener('click', e => {
e.stopPropagation();
Router.navigate('client-detail', el.dataset.id);
});
});
// 행 클릭 → 상세
wrap.querySelectorAll('tr.clickable').forEach(tr => {
tr.addEventListener('click', () => Router.navigate('client-detail', tr.dataset.id));
});

// 컬럼 정렬
wrap.querySelectorAll('.sort-th').forEach(th => {
th.addEventListener('click', () => {
const col = th.dataset.col;
if (this.sortCol === col) {
this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
} else {
this.sortCol = col; this.sortDir = 'asc';
}
this._applyFilter();
this._renderTable();
});
});

this._renderPagination(total);
},

// ── 페이지네이션 ─────────────────────────────────────────
_renderPagination: function(total = 0) {
const infoEl = document.getElementById('pagination-info');
const btnsEl = document.getElementById('pagination-btns');
if (!infoEl || !btnsEl) return;

const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
const end   = Math.min(this.currentPage * this.pageSize, total);

infoEl.textContent = total > 0 ? `총 ${total}명 중 ${start}-${end}` : '조회 결과 없음';

// 페이지 버튼 (최대 5개 표시)
let pages = [];
const delta = 2;
for (let p = Math.max(1, this.currentPage - delta); p <= Math.min(totalPages, this.currentPage + delta); p++) pages.push(p);
if (pages[0] > 1) pages = [1, '…', ...pages];
if (pages[pages.length - 1] < totalPages) pages = [...pages, '…', totalPages];

btnsEl.innerHTML = [
`<button class="btn btn-secondary btn-sm" ${this.currentPage === 1 ? 'disabled' : ''} data-p="${this.currentPage - 1}">‹</button>`,
...pages.map(p => p === '…'
? `<span style="padding:0 6px;color:var(--color-gray-400);">…</span>`
: `<button class="btn btn-sm ${p === this.currentPage ? 'btn-primary' : 'btn-secondary'}" data-p="${p}">${p}</button>`
),
`<button class="btn btn-secondary btn-sm" ${this.currentPage === totalPages ? 'disabled' : ''} data-p="${this.currentPage + 1}">›</button>`
].join('');

btnsEl.querySelectorAll('[data-p]').forEach(btn => {
btn.addEventListener('click', () => {
this.currentPage = Number(btn.dataset.p);
this._renderTable();
});
});
},

// ── 진행현황 계산 ────────────────────────────────────────
_calcAdmitProgress: function(c) {
if (!c.admitDate || !c.endDate) return { pct: 0, elapsed: 0, remaining: 0, total: 0 };
const today   = new Date(); today.setHours(0,0,0,0);
const admit   = new Date(c.admitDate);
const end     = new Date(c.endDate);
const totalMs = end - admit;
const elapsedMs = today - admit;
if (totalMs <= 0) return { pct: 100, elapsed: 0, remaining: 0, total: 0 };
const pct       = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));
const totalDays = Math.round(totalMs / 86400000) + 1;
const elapsed   = Math.max(0, Math.round(elapsedMs / 86400000));
const remaining = Math.max(0, totalDays - elapsed);
return { pct, elapsed, remaining, total: totalDays };
},

// ── 상태 뱃지 ────────────────────────────────────────────
_statusBadge: function(status) {
const map = { '입소중':'admitted', '입소예정':'scheduled', '퇴소':'discharged' };
const cls = map[status] || 'discharged';
return `<span class="badge badge-${cls}">${status}</span>`;
},

// ── 신규 등록 모달 ───────────────────────────────────────
_openCreateModal: function() {
const backdrop = document.createElement('div');
backdrop.className = 'modal-backdrop';
backdrop.id = 'client-modal';
backdrop.innerHTML = `
     <div class="modal" style="max-width:600px;">
       <div class="modal-header">
         <h3 class="modal-title">신규 고객 등록</h3>
         <button class="modal-close" id="cm-close">✕</button>
       </div>
       <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
         <div class="modal-form-grid">
           <div class="form-group">
             <label class="form-label">고객 ID <span class="required">*</span></label>
             <input type="text" id="cm-id" class="form-control" placeholder="예) C001">
           </div>
           <div class="form-group">
             <label class="form-label">고객명 <span class="required">*</span></label>
             <input type="text" id="cm-name" class="form-control" placeholder="실명 입력">
           </div>
           <div class="form-group">
             <label class="form-label">입실호수</label>
             <input type="text" id="cm-roomnum" class="form-control" placeholder="예) 101">
           </div>
           <div class="form-group">
             <label class="form-label">생년월일 <span class="required">*</span></label>
             <input type="date" id="cm-birth" class="form-control">
           </div>
           <div class="form-group">
             <label class="form-label">성별 <span class="required">*</span></label>
             <select id="cm-gender" class="form-control">
               <option value="">선택</option>
               <option value="남자">남자</option>
               <option value="여자">여자</option>
             </select>
           </div>
           <div class="form-group">
             <label class="form-label">휴대전화번호 <span class="required">*</span></label>
             <input type="tel" id="cm-phone" class="form-control" placeholder="010-0000-0000">
           </div>
           <div class="form-group">
             <label class="form-label">입소 등록일 <span class="required">*</span></label>
             <input type="date" id="cm-firstvisit" class="form-control">
           </div>
           <div class="form-group">
             <label class="form-label">입소일자 <span class="required">*</span></label>
             <input type="date" id="cm-admitdate" class="form-control">
           </div>
           <div class="form-group">
             <label class="form-label">입소기간 <span class="required">*</span></label>
             <select id="cm-period" class="form-control">
               <option value="">선택</option>
               <option value="2주">2주</option>
               <option value="1개월">1개월</option>
               <option value="2개월">2개월</option>
               <option value="3개월">3개월</option>
               <option value="4개월">4개월</option>
               <option value="5개월">5개월</option>
               <option value="6개월">6개월</option>
             </select>
           </div>
         </div>
         <!-- 자동 계산 미리보기 -->
         <div id="cm-preview" style="margin-top:16px;padding:14px;background:var(--color-primary-pale);border-radius:8px;display:none;">
           <div style="font-size:12px;font-weight:700;color:var(--color-primary-dark);margin-bottom:8px;">📋 자동 계산 결과</div>
           <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px;">
             <span>종료예정일: <strong id="preview-end">-</strong></span>
             <span>총 회차수: <strong id="preview-rounds">-</strong></span>
             <span>상태: <strong id="preview-status">-</strong></span>
           </div>
         </div>
         <div class="form-group" style="margin-top:14px;">
           <label class="form-label">비고</label>
           <input type="text" id="cm-note" class="form-control" placeholder="특이사항 등">
         </div>
       </div>
       <div class="modal-footer">
         <button class="btn btn-secondary" id="cm-cancel">취소</button>
         <button class="btn btn-primary" id="cm-submit">등록</button>
       </div>
     </div>`;

document.body.appendChild(backdrop);

const close = () => backdrop.remove();
backdrop.querySelector('#cm-close').onclick = close;
backdrop.querySelector('#cm-cancel').onclick = close;
backdrop.onclick = e => { if (e.target === backdrop) close(); };

const parseLocalDate = (s) => {
if (!s) return null;
const [y, m, d] = String(s).substring(0,10).split('-').map(Number);
return new Date(y, m - 1, d);
};
// 자동 계산 미리보기
const updatePreview = () => {
const admitDate = document.getElementById('cm-admitdate').value;
const period    = document.getElementById('cm-period').value;
if (!admitDate || !period) { document.getElementById('cm-preview').style.display='none'; return; }

const days    = AppConfig.PERIOD_DAYS[period] || 0;
const admit   = parseLocalDate(admitDate);          // ✅ 로컬 자정으로 파싱
const endD    = new Date(admit);
endD.setDate(endD.getDate() + days - 1);
const pad     = n => String(n).padStart(2,'0');
const endStr  = `${endD.getFullYear()}-${pad(endD.getMonth()+1)}-${pad(endD.getDate())}`;
const rounds  = AppConfig.PERIOD_ROUNDS[period] ?? 0;

const today   = new Date(); today.setHours(0,0,0,0);
const admitD  = parseLocalDate(admitDate);          // ✅ 로컬 자정으로 파싱 (today와 동일 기준)

let status;
if (today < admitD) status = '입소예정';
else if (today > endD) status = '퇴소';
else status = '입소중';

document.getElementById('preview-end').textContent    = endStr;
document.getElementById('preview-rounds').textContent = rounds + '회차';
document.getElementById('preview-status').textContent = status;
document.getElementById('cm-preview').style.display   = 'block';
};

// 전화번호 자동 포맷
const phoneInput = document.getElementById('cm-phone');
phoneInput.addEventListener('input', () => {
phoneInput.value = ClientsPage._autoFormatPhone(phoneInput.value);
});

document.getElementById('cm-admitdate').addEventListener('change', updatePreview);
document.getElementById('cm-period').addEventListener('change', updatePreview);

document.getElementById('cm-submit').addEventListener('click', () => this._submitCreate(close));
},

_submitCreate: async function(close) {
const get = id => document.getElementById(id)?.value?.trim();
const data = {
clientId:    get('cm-id'),
name:        get('cm-name'),
birthDate:   get('cm-birth'),
gender:      get('cm-gender'),
phone:       get('cm-phone'),
firstVisit:  get('cm-firstvisit'),
admitDate:   get('cm-admitdate'),
admitPeriod: get('cm-period'),
roomNum:     get('cm-roomnum') || null,
note:        get('cm-note')
};

if (!data.clientId || !data.name || !data.birthDate || !data.gender ||
!data.phone || !data.firstVisit || !data.admitDate || !data.admitPeriod) {
UI.toast('필수 항목을 모두 입력해주세요.', 'error'); return;
}

// 입실호수 중복 확인 (입소중 고객 대상)
if (data.roomNum) {
const dup = this.allClients.find(c =>
c.roomNum === data.roomNum && c.status === '입소중'
);
if (dup) {
UI.toast(`입실호수 ${data.roomNum}호는 입소중인 "${dup.name}" 님이 사용 중입니다.`, 'error');
return;
}
}

const btn = document.getElementById('cm-submit');
btn.disabled = true;
try {
UI.showLoading();
const res = await API.createClient(data);
if (res.status === 'success') {
UI.toast(`${data.name} 님이 등록되었습니다.`, 'success');
close();
await this.loadClients();
} else {
UI.toast(res.message || '등록 실패', 'error');
}
} catch { UI.toast('서버 오류가 발생했습니다.', 'error'); }
finally { UI.hideLoading(); btn.disabled = false; }
},

// ── 고객정보 수정 모달 ───────────────────────────────────
_openEditModal: function(client, onSaved) {
const c = client;
const backdrop = document.createElement('div');
backdrop.className = 'modal-backdrop';
backdrop.id = 'client-edit-modal';
backdrop.innerHTML = `
     <div class="modal" style="max-width:600px;">
       <div class="modal-header">
         <h3 class="modal-title">고객정보 수정 — ${c.name}</h3>
         <button class="modal-close" id="em-close">✕</button>
       </div>
       <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
         <div class="modal-form-grid">
           <div class="form-group">
             <label class="form-label">고객 ID</label>
             <input type="text" id="em-id" class="form-control" value="${c.clientId}" disabled style="background:var(--color-gray-100);">
           </div>
           <div class="form-group">
             <label class="form-label">고객명 <span class="required">*</span></label>
             <input type="text" id="em-name" class="form-control" value="${c.name||''}">
           </div>
           <div class="form-group">
             <label class="form-label">입실호수</label>
             <input type="text" id="em-roomnum" class="form-control" value="${c.roomNum||''}">
           </div>
           <div class="form-group">
             <label class="form-label">생년월일 <span class="required">*</span></label>
             <input type="date" id="em-birth" class="form-control" value="${c.birthDate||''}">
           </div>
           <div class="form-group">
             <label class="form-label">성별 <span class="required">*</span></label>
             <select id="em-gender" class="form-control">
               <option value="">선택</option>
               <option value="남자" ${c.gender==='남자'?'selected':''}>남자</option>
               <option value="여자" ${c.gender==='여자'?'selected':''}>여자</option>
             </select>
           </div>
           <div class="form-group">
             <label class="form-label">휴대전화번호 <span class="required">*</span></label>
             <input type="tel" id="em-phone" class="form-control" value="${c.phone||''}">
           </div>
           <div class="form-group">
             <label class="form-label">입소 등록일 <span class="required">*</span></label>
             <input type="date" id="em-firstvisit" class="form-control" value="${c.firstVisit||''}">
           </div>
           <div class="form-group">
             <label class="form-label">입소일자 <span class="required">*</span></label>
             <input type="date" id="em-admitdate" class="form-control" value="${c.admitDate||''}">
           </div>
           <div class="form-group">
             <label class="form-label">입소기간 <span class="required">*</span></label>
             <select id="em-period" class="form-control">
               <option value="">선택</option>
               ${['2주','1개월','2개월','3개월','4개월','5개월','6개월'].map(p=>`<option value="${p}" ${c.admitPeriod===p?'selected':''}>${p}</option>`).join('')}
             </select>
           </div>
         </div>
         <div id="em-preview" style="margin-top:16px;padding:14px;background:var(--color-primary-pale);border-radius:8px;">
           <div style="font-size:12px;font-weight:700;color:var(--color-primary-dark);margin-bottom:8px;">📋 자동 계산 결과</div>
           <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px;">
             <span>종료예정일: <strong id="em-preview-end">${c.endDate||'-'}</strong></span>
             <span>총 회차수: <strong id="em-preview-rounds">${c.totalRounds??'-'}회차</strong></span>
             <span>상태: <strong id="em-preview-status">${c.status||'-'}</strong></span>
           </div>
         </div>
         <div class="form-group" style="margin-top:14px;">
           <label class="form-label">비고</label>
           <input type="text" id="em-note" class="form-control" value="${(c.note||'').replace(/"/g,'&quot;')}">
         </div>
       </div>
       <div class="modal-footer">
         <button class="btn btn-secondary" id="em-cancel">취소</button>
         <button class="btn btn-primary" id="em-submit">저장</button>
       </div>
     </div>`;

document.body.appendChild(backdrop);

const close = () => backdrop.remove();
backdrop.querySelector('#em-close').onclick = close;
backdrop.querySelector('#em-cancel').onclick = close;
backdrop.onclick = e => { if (e.target === backdrop) close(); };

const updatePreview = () => {
const admitDate = document.getElementById('em-admitdate').value;
const period    = document.getElementById('em-period').value;
if (!admitDate || !period) return;
const days   = AppConfig.PERIOD_DAYS[period] || 0;
const admit  = new Date(admitDate);
const endD   = new Date(admit);
endD.setDate(endD.getDate() + days - 1);
const pad    = n => String(n).padStart(2,'0');
const endStr = `${endD.getFullYear()}-${pad(endD.getMonth()+1)}-${pad(endD.getDate())}`;
const rounds = AppConfig.PERIOD_ROUNDS[period] ?? 0;
const today  = new Date(); today.setHours(0,0,0,0);
const admitD = new Date(admitDate);
let status;
if (today < admitD) status = '입소예정';
else if (today > endD) status = '퇴소';
else status = '입소중';

document.getElementById('em-preview-end').textContent    = endStr;
document.getElementById('em-preview-rounds').textContent = rounds + '회차';
document.getElementById('em-preview-status').textContent = status;
};

const phoneInput = document.getElementById('em-phone');
phoneInput.addEventListener('input', () => {
phoneInput.value = this._autoFormatPhone(phoneInput.value);
});
document.getElementById('em-admitdate').addEventListener('change', updatePreview);
document.getElementById('em-period').addEventListener('change', updatePreview);

document.getElementById('em-submit').addEventListener('click', () => this._submitEdit(c.clientId, close, onSaved));
},

_submitEdit: async function(clientId, close, onSaved) {
const get = id => document.getElementById(id)?.value?.trim();
const data = {
clientId,
name:        get('em-name'),
birthDate:   get('em-birth'),
gender:      get('em-gender'),
phone:       get('em-phone'),
firstVisit:  get('em-firstvisit'),
admitDate:   get('em-admitdate'),
admitPeriod: get('em-period'),
roomNum:     get('em-roomnum') || null,   
note:        get('em-note')
};

if (!data.name || !data.birthDate || !data.gender ||
!data.phone || !data.firstVisit || !data.admitDate || !data.admitPeriod) {
UI.toast('필수 항목을 모두 입력해주세요.', 'error'); return;
}

const btn = document.getElementById('em-submit');
btn.disabled = true;
try {
UI.showLoading();
const res = await API.updateClient(data);
if (res.status === 'success') {
UI.toast('고객정보가 수정되었습니다.', 'success');
close();
if (typeof onSaved === 'function') onSaved();
if (typeof this.loadClients === 'function' && this.allClients) await this.loadClients();
} else {
UI.toast(res.message || '수정 실패', 'error');
}
} catch { UI.toast('서버 오류가 발생했습니다.', 'error'); }
finally { UI.hideLoading(); btn.disabled = false; }
},

// ── 고객 삭제 ────────────────────────────────────────────
_handleDelete: async function(clientId, clientName, onDeleted) {
const ok = await UI.confirm({
title: '고객을 삭제하시겠습니까?',
message: `${clientName} 님의 모든 데이터(평가, 리포트 포함)가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`,
confirmText: '삭제', cancelText: '취소', type: 'danger'
});
if (!ok) return;
try {
UI.showLoading();
const res = await API.deleteClient(clientId);
if (res.status === 'success') {
UI.toast('삭제되었습니다.', 'success');
if (typeof onDeleted === 'function') onDeleted();
} else {
UI.toast(res.message || '삭제 실패', 'error');
}
} catch { UI.toast('서버 오류가 발생했습니다.', 'error'); }
finally { UI.hideLoading(); }
}
};
