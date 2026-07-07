// ============================================================
// pages/clientDetail.js - 고객 상세 페이지
// ============================================================

const ClientDetailPage = {
client: null,
activeRound: 1,
activeDetailTab: 'rounds',
activeReportRound: null,

// ── 회차 → 주차 변환 ────────────────────────────────────
// 1회차=초기, 2회차=4주차, 3회차=8주차, 4회차=12주차 ...
// 짧은 형식: 탭/리스트용
_weekLabelShort: function(round) {
return round === 1 ? '초기' : `${(round-1)*4}주`;
},
// 평가 타이틀용: "초기 평가" / "4주차 평가"
_weekEvalLabel: function(round) {
return round === 1 ? '초기 평가' : `${(round-1)*4}주차 평가`;
},
// 리포트 타이틀용: "4주차 통합리포트"
_weekReportLabel: function(round) {
return round === 1 ? '초기 통합리포트' : `${(round-1)*4}주차 통합리포트`;
},

canWrite: function() {
const r = Auth.getUser()?.role;
return r === 'ADMIN' || r === 'CARE_MANAGER';
},

// ── 전화번호 포맷 ────────────────────────────────────────
_formatPhone: function(val) {
if (!val) return '-';
const digits = String(val).replace(/\D/g, '');
if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
if (digits.length === 10) return digits.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
return val;
},

// ── 상태 배지 ────────────────────────────────────────────
_statusBadge: function(status) {
const map = { '입소중':'admitted', '입소예정':'scheduled', '퇴소':'discharged' };
const cls = map[status] || 'discharged';
return `<span class="badge badge-${cls}">${status||'-'}</span>`;
},

// ── 입소 진행률 계산 ─────────────────────────────────────
_calcProgress: function(c) {
if (!c.admitDate || !c.endDate) return {pct:0, total:0, elapsed:0, remaining:0};
const start = new Date(c.admitDate).getTime();
const end   = new Date(c.endDate).getTime();
const now   = Date.now();
const totalDays = Math.max(1, Math.round((end-start)/(1000*60*60*24)));
const elapsedDays = Math.max(0, Math.round((now-start)/(1000*60*60*24)));
const pct = Math.min(100, Math.max(0, Math.round(elapsedDays/totalDays*100)));
return {pct, total:totalDays, elapsed:Math.min(elapsedDays,totalDays), remaining:Math.max(0,totalDays-elapsedDays)};
},

// ── 렌더링 ──────────────────────────────────────────────
render: async function(clientId) {
// 새 고객 진입 시 상태 초기화 (이전 고객 탭 상태 잔류 방지)
this.client           = null;
this._masterListCache = null;
this._roundDataCache  = {};   // 회차별 데이터 캐시 초기화
this._roundSelected   = false;
this.activeRound      = 1;
this.activeDetailTab  = 'rounds';

const container = document.getElementById('page-content');
container.innerHTML = `
     <div class="back-btn" id="back-btn">
       <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
       </svg>고객 목록으로
     </div>
     <div class="empty-state"><div class="spinner" style="margin:0 auto;"></div></div>`;
document.getElementById('back-btn').addEventListener('click', () => Router.navigate('clients'));

try {
// getClientDetail + getClientMasterList 병렬 요청 → 진행현황 즉시 표시
const [res, masterRes] = await Promise.all([
API.getClientDetail(clientId),
API.getClientMasterList(clientId).catch(() => null)
]);
if (res.status !== 'success') {
container.querySelector('.empty-state').innerHTML = `<div class="empty-state-icon">⚠️</div><div class="empty-state-text">${res.message}</div>`;
return;
}
this.client = res.data.client;
// masterList 캐시 미리 설정 → _loadRoundProgress에서 재요청 없음
if (masterRes?.status === 'success') {
this._masterListCache = masterRes.data.masterList || [];
}
this._renderDetail(container);
} catch(e) {
container.querySelector('.empty-state').innerHTML = `<div class="empty-state-icon">🔌</div><div class="empty-state-text">서버 연결 오류: ${e?.message||e}</div>`;
}
},

_renderDetail: function(container) {
const c = this.client;
// 최초 진입 시 가장 최근 회차를 기본 선택
if (!this._roundSelected) {
this.activeRound = Math.max(1, Math.min(c.doneRounds || 1, c.totalRounds || 1));
this.activeDetailTab = 'rounds';
this._roundSelected = true;
}
const admitProg = this._calcProgress(c);
const roundPct  = c.totalRounds > 0 ? Math.round(c.doneRounds / c.totalRounds * 100) : 0;

container.innerHTML = `
     <!-- 뒤로가기 -->
     <div class="back-btn" id="back-btn">
       <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
       </svg>고객 목록으로
     </div>

     <!-- ① 상단: 프로필 + 버튼 -->
     <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
       <div style="display:flex;align-items:center;gap:12px;">
         <div class="client-avatar">${c.name.charAt(0)}</div>
         <div>
           <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
             <span style="font-size:20px;font-weight:800;color:var(--color-gray-900);">${c.name}</span>
             ${this._statusBadge(c.status)}
             <span id="report-status-badge"></span>
           </div>
           <div style="font-size:18px;color:var(--color-gray-500);">
             고객 ID: <span style="font-family:monospace;font-weight:600;color:var(--color-gray-700);">${c.clientId}</span>
             &nbsp;·&nbsp; ${c.gender || '-'} &nbsp;·&nbsp; ${c.admitPeriod || '-'} 입소
           </div>
         </div>
       </div>
       <div style="display:flex;gap:10px;flex-shrink:0;flex-wrap:wrap;">
         <div class="assess-goto-btn" id="goto-assess-btn">
           <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
           평가 입력
         </div>
         ${this.canWrite() ? `
         <button class="btn btn-outline" id="edit-client-btn">
           <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
           정보 수정
         </button>
         <button class="btn btn-danger" id="delete-client-btn">
           <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
           삭제
         </button>` : ''}
       </div>
     </div>

     <!-- ② 정보 + 진행현황 1행: 높이 통일 (flex stretch) -->
     <div class="top-info-row" style="display:flex;gap:12px;margin-bottom:12px;align-items:stretch;flex-wrap:wrap;">

       <!-- 기본 정보 카드 (비고 제외 2행) -->
       <div class="card top-info-card" style="flex:3 1 360px;min-width:0;display:flex;flex-direction:column;min-height:220px;">
         <div class="card-header" style="padding:8px 14px;flex-shrink:0;">
           <h2 class="card-title" style="font-size:20px;"><span class="card-title-dot"></span>기본 정보</h2>
         </div>
         <div class="card-body" style="padding:0;flex:1;display:flex;flex-direction:column;align-items:stretch;height:100%;">
           <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;width:100%;flex-shrink:0;">
             ${[
               {l:'생년월일',  v:c.birthDate||'-'},
               {l:'성별',      v:c.gender||'-'},
               {l:'입실호수',  v:c.roomNum||'-', s:'font-weight:700;'},
               {l:'휴대전화',  v:this._formatPhone(c.phone), s:'font-weight:700;'},
               {l:'입소 등록일',v:c.firstVisit||'-'},
               {l:'입소일자',  v:c.admitDate||'-', s:'font-weight:700;'},
               {l:'종료 예정일',v:c.endDate||'-', s:'font-weight:700;'},
               {l:'입소기간',  v:c.admitPeriod||'-'},
             ].map(f=>`<div class="detail-info-item" style="padding:6px 10px;">
               <div class="detail-info-label" style="font-size:18px;margin-bottom:1px;">${f.l}</div>
               <div class="detail-info-value" style="font-size:18px;${f.s||''}">${f.v}</div>
             </div>`).join('')}
           </div>
           <div class="detail-info-item" style="padding:5px 10px;border-top:1px solid var(--color-gray-100);flex:1;display:flex;flex-direction:column;">
             <div class="detail-info-label" style="font-size:18px;margin-bottom:1px;">비고</div>
             <div class="detail-info-value" style="font-size:18px;color:var(--color-gray-600);white-space:pre-wrap;flex:1;">${c.note || '-'}</div>
           </div>
         </div>
       </div>

       <!-- 입소 진행현황 -->
       <div class="card top-info-card" style="flex:1 1 220px;min-width:0;display:flex;flex-direction:column;min-height:220px;">
         <div class="card-header" style="padding:8px 14px;flex-shrink:0;">
           <h2 class="card-title" style="font-size:20px;"><span class="card-title-dot"></span>입소 진행현황</h2>
         </div>
         <div class="card-body" style="padding:12px 14px;flex:1;display:flex;flex-direction:column;justify-content:center;">
           <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;">
             <div>
               <div style="font-size:36px;font-weight:800;color:var(--color-primary);line-height:1;">${admitProg.pct}<span style="font-size:18px;color:var(--color-gray-400);">%</span></div>
               <div style="font-size:18px;color:var(--color-gray-500);margin-top:3px;">전체 ${admitProg.total}일 과정</div>
             </div>
             <div style="text-align:right;">
               <div style="font-size:18px;color:var(--color-gray-500);">경과 <span style="font-size:16px;font-weight:700;color:var(--color-gray-700);">${admitProg.elapsed}</span>일</div>
               <div style="font-size:18px;color:var(--color-gray-500);">잔여 <span style="font-size:16px;font-weight:700;color:var(--color-primary-dark);">${admitProg.remaining}</span>일</div>
             </div>
           </div>
           <div class="progress-bar-outer" style="height:8px;border-radius:5px;">
             <div class="progress-bar-inner" style="width:${admitProg.pct}%;height:100%;border-radius:5px;"></div>
           </div>
         </div>
       </div>

       <!-- 회차 진행현황 (리포트 생성 기준) -->
       <div class="card top-info-card" id="round-progress-card" style="flex:1 1 220px;min-width:0;display:flex;flex-direction:column;min-height:220px;">
         <div class="card-header" style="padding:8px 14px;flex-shrink:0;">
           <h2 class="card-title" style="font-size:20px;"><span class="card-title-dot"></span>진행현황 <span style="font-size:18px;font-weight:400;color:var(--color-gray-400);">(리포트 기준)</span></h2>
         </div>
         <div class="card-body" style="padding:12px 14px;flex:1;display:flex;flex-direction:column;justify-content:center;" id="round-progress-body">
           <div style="font-size:18px;color:var(--color-gray-400);">불러오는 중...</div>
         </div>
       </div>

     </div>

     <!-- ③ 하단: 회차탭(1~max) + 통합리포트 탭 -->
     <div class="card" style="overflow:visible;">
       <div class="card-header" style="padding:10px 16px;border-bottom:2px solid var(--color-gray-200);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;">
         <div style="display:flex;gap:0;align-items:stretch;flex-wrap:wrap;">
           ${Array.from({length:Math.min(c.totalRounds||0,7)},(_,i)=>i+1).map(n=>`
             <button class="round-tab${(this.activeDetailTab==='rounds'||this.activeDetailTab==='trend')&&this.activeRound===n?' active':''}" data-main-tab="round" data-round="${n}" style="font-size:18px;padding:8px 14px;">${this._weekLabelShort(n)}</button>
           `).join('')}
           <button class="round-tab${this.activeDetailTab==='report'?' active':''}" data-main-tab="report" style="font-size:18px;padding:8px 14px;border-left:2px solid var(--color-gray-200);">📊 통합 리포트</button>
         </div>
         <!-- 우측 상태값: 리포트 상태 배지 (report 탭이 아닐 때 현재 선택 회차 상태 표시) -->
         <div style="flex-shrink:0;display:flex;align-items:center;gap:8px;margin-left:8px;" id="tab-status-area">
           ${this.activeDetailTab!=='report'&&this.activeDetailTab!=='trend'?`<span id="round-report-status-badge"></span>`:``}
         </div>
       </div>
       <div id="detail-tab-content" style="overflow:visible;padding-top:10px;padding-bottom:10px;box-sizing:border-box;"></div>
     </div>`;

document.getElementById('back-btn').addEventListener('click', () => Router.navigate('clients'));

// 평가 입력 버튼: 현재 진행 회차로 평가관리 이동
document.getElementById('goto-assess-btn')?.addEventListener('click', () => {
const c = this.client;
const currentRound = Math.min(c.doneRounds + 1, c.totalRounds) || 1;
AssessmentsPage._pendingClientId = c.clientId;
AssessmentsPage._pendingRound    = currentRound;
Router.navigate('assessments');
});

if (this.canWrite()) {
document.getElementById('edit-client-btn')?.addEventListener('click', () => {
ClientsPage._openEditModal(this.client, () => this.render(this.client.clientId));
});
document.getElementById('delete-client-btn')?.addEventListener('click', () => {
ClientsPage._handleDelete(this.client.clientId, this.client.name, () => Router.navigate('clients'));
});
}

container.querySelectorAll('[data-main-tab]').forEach(btn => {
btn.addEventListener('click', () => {
if (btn.dataset.mainTab === 'report') {
this.activeDetailTab = 'report';
} else {
this.activeRound = Number(btn.dataset.round);
if (this.activeDetailTab === 'report') this.activeDetailTab = 'rounds';
this._roundSelected = true;
}
container.querySelectorAll('[data-main-tab]').forEach(b => b.classList.remove('active'));
btn.classList.add('active');
this._renderDetailTab();
// 상태 배지 갱신 (변화추이 탭에서는 표시 안 함)
const sa = document.getElementById('tab-status-area');
if (sa) {
if (this.activeDetailTab === 'report' || this.activeDetailTab === 'trend') {
sa.innerHTML = '';
} else {
sa.innerHTML = '<span id="round-report-status-badge"></span>';
this._updateRoundStatusBadge();
}
}
});
});

// 회차 진행현황: 리포트 생성 기준으로 비동기 로드
this._loadRoundProgress();
// 최초 진입 시 가장 최근 평가 회차 자동 선택
if (!this._roundSelected) {
this.activeRound = Math.min(this.client.doneRounds || 1, this.client.totalRounds || 1);
this._roundSelected = true;
this.activeDetailTab = 'rounds';
}
this._renderDetailTab();
},

// 현재 선택 회차의 리포트 상태 배지 갱신
_updateRoundStatusBadge: function() {
const badge = document.getElementById('round-report-status-badge');
if (!badge) return;
const masterList = this._masterListCache || [];
const m = masterList.find(x => x.round === this.activeRound);
if (m && m.reportGenerated) {
badge.innerHTML = `<span class="badge badge-active">📄 리포트 완료</span>`;
} else if (m) {
badge.innerHTML = `<span class="badge badge-inactive">진행중</span>`;
} else {
badge.innerHTML = '';
}
},

_loadRoundProgress: async function() {
const body = document.getElementById('round-progress-body');
const statusBadge = document.getElementById('report-status-badge');
if (!body && !statusBadge) return;
try {
const c = this.client;
// render()에서 병렬 로드된 캐시 사용 → 추가 왕복 없음
if (!this._masterListCache) {
const res = await API.getClientMasterList(c.clientId);
this._masterListCache = (res.status==='success' ? res.data.masterList : []) || [];
}
const masterList = this._masterListCache;
this._updateRoundStatusBadge();
const reportedRounds = masterList.filter(m=>m.reportGenerated).length;
const totalRounds = c.totalRounds || 0;
const pct = totalRounds > 0 ? Math.round(reportedRounds/totalRounds*100) : 0;

// 이름 옆 리포트 상태 배지
if (statusBadge) {
let label, cls;
if (totalRounds === 0) { label = '회차 없음'; cls = 'badge-inactive'; }
else if (reportedRounds === 0) { label = '리포트 미생성'; cls = 'badge-inactive'; }
else if (reportedRounds < totalRounds) { label = `리포트 ${reportedRounds}/${totalRounds}`; cls = 'badge-active'; }
else { label = '리포트 전체 완료'; cls = 'badge-active'; }
statusBadge.innerHTML = `<span class="badge ${cls}">${label}</span>`;
}

if (body) body.innerHTML = `
       <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;">
         <div>
           <div style="font-size:36px;font-weight:800;color:#4CAF50;line-height:1;">${reportedRounds}<span style="font-size:18px;color:var(--color-gray-400);"> / ${totalRounds}</span></div>
           <div style="font-size:18px;color:var(--color-gray-500);margin-top:3px;">리포트 생성 완료</div>
         </div>
         <div style="text-align:right;">
           <div style="font-size:18px;color:var(--color-gray-500);">달성률 <span style="font-size:20px;font-weight:700;color:#2E7D32;">${pct}</span>%</div>
         </div>
       </div>
       <div class="progress-bar-outer" style="height:8px;border-radius:5px;">
         <div class="progress-bar-inner round" style="width:${pct}%;height:100%;border-radius:5px;"></div>
       </div>`;
} catch(e) {
const body2 = document.getElementById('round-progress-body');
if (body2) body2.innerHTML = '<div style="font-size:18px;color:var(--color-gray-400);">불러오기 실패</div>';
}
},

_renderDetailTab: function() {
const content = document.getElementById('detail-tab-content');
if (!content) return;
if (this.activeDetailTab === 'report') { this._renderReportTab(content); return; }
if (!this.client.totalRounds) {
content.innerHTML = `<div class="empty-state" style="padding:48px;"><div class="empty-state-icon">📋</div><div class="empty-state-text">평가 일정 정보 없음</div></div>`;
return;
}

// 서브탭(평가점수/변화추이)
const activeSubTab = this.activeDetailTab === 'trend' ? 'trend' : 'scores';
content.innerHTML = `
     <div style="display:flex;gap:0;padding:0 16px;border-bottom:1px solid var(--color-gray-100);background:var(--color-gray-50);">
       <button data-sub-tab="scores" style="padding:8px 16px;font-size:18px;font-weight:600;background:none;border:none;border-bottom:2px solid ${activeSubTab==='scores'?'var(--color-primary)':'transparent'};color:${activeSubTab==='scores'?'var(--color-primary)':'var(--color-gray-500)'};cursor:pointer;">📊 평가 점수</button>
       <button data-sub-tab="trend"  style="padding:8px 16px;font-size:18px;font-weight:600;background:none;border:none;border-bottom:2px solid ${activeSubTab==='trend' ?'var(--color-primary)':'transparent'};color:${activeSubTab==='trend' ?'var(--color-primary)':'var(--color-gray-500)'};cursor:pointer;">📈 변화 추이</button>
     </div>
     <div id="round-content"></div>`;

content.querySelectorAll('[data-sub-tab]').forEach(btn=>{
btn.addEventListener('click',()=>{
this.activeDetailTab = btn.dataset.subTab==='trend' ? 'trend' : 'rounds';
this._renderDetailTab();
});
});
this._loadRoundOrTrend();
},

_loadRoundOrTrend: function() {
if (this.activeDetailTab === 'trend') {
const el = document.getElementById('round-content');
if (el) this._renderTrendInEl(el);
} else {
this._loadRoundData();
}
},

_loadRoundData: async function() {
const el = document.getElementById('round-content');
if (!el) return;

// 주차 탭을 선택하지 않은 초기 상태
if (!this._roundSelected) {
el.innerHTML = `
       <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 24px;gap:14px;color:var(--color-gray-400);">
         <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" opacity="0.35">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
             d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
         </svg>
         <div style="font-size:14px;font-weight:600;color:var(--color-gray-500);">주차를 선택하시면 평가 내역을 확인할 수 있습니다</div>
         <div style="font-size:18px;color:var(--color-gray-400);">위의 초기·4주차·8주차 등 탭을 클릭해 주세요</div>
       </div>`;
return;
}

// ── 회차별 데이터 캐시: 이미 조회한 회차는 즉시 렌더 ──
if (!this._roundDataCache) this._roundDataCache = {};
const cached = this._roundDataCache[this.activeRound];
if (cached) {
this._renderRoundContent(el, cached);
return;
}

el.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto;"></div></div>';
try {
const res = await API.getRoundData(this.client.clientId, this.activeRound);
if (res.status === 'success') {
// 캐시 저장 후 렌더
this._roundDataCache[this.activeRound] = res.data;
this._renderRoundContent(el, res.data);
} else {
el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${res.message}</div></div>`;
}
} catch {
el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔌</div><div class="empty-state-text">연결 오류</div></div>';
}
},

_renderRoundContent: function(el, data) {
const round = this.activeRound;
const master = data?.master;
const done = master?.reportGenerated;
const cog  = data?.cognitive;
const ergo = data?.ergo;
const evx  = data?.everex;
const fra  = data?.fra;
const inb  = data?.inbody;
const str  = data?.stress;
const cmt  = data?.comment;

const hasAny = !!(cog||ergo||evx||fra||inb||str||cmt);
if (!hasAny) {
el.innerHTML = `<div class="empty-state" style="padding:36px;"><div class="empty-state-icon">📝</div><div class="empty-state-text">${this._weekEvalLabel(round)} 데이터가 없습니다.</div></div>`;
return;
}

// ── 미니 도넛 (시각화 내부에 점수 포함 — 별도 텍스트 점수 표시 안함) ──
const miniDonut = (score, max, color, label='') => {
if (score == null) return `
       <div style="width:100px;height:100px;border-radius:50%;background:conic-gradient(#E8E8E8 0% 100%);display:flex;align-items:center;justify-content:center;">
         <div style="width:72px;height:72px;border-radius:50%;background:white;display:flex;align-items:center;justify-content:center;">
           <span style="font-size:18px;font-weight:800;color:#ccc;">-</span>
         </div>
       </div>`;
const pct = Math.min(100, Math.max(0, (Number(score) / max) * 100));
const deg = pct * 3.6;
const txt = score + '점';
const fs  = txt.length >= 5 ? 14 : 17;
return `
       <div style="width:100px;height:100px;border-radius:50%;
         background:conic-gradient(${color} 0deg ${deg.toFixed(2)}deg,#E8E8E8 ${deg.toFixed(2)}deg 360deg);
         display:flex;align-items:center;justify-content:center;">
         <div style="width:72px;height:72px;border-radius:50%;background:white;
           display:flex;align-items:center;justify-content:center;">
           <span style="font-size:${fs}px;font-weight:800;color:${color};">${txt}</span>
         </div>
       </div>`;
};

// ── 동연령대 상위 분포도: 표준정규분포 히스토그램 ──
const distBar = (pct) => {
if (pct==null) return '';
const p = Math.min(100,Math.max(0,Number(pct)));
const heights = [22,34,46,56,64,56,46,34,22];
const barW = 12, gap = 5, n = heights.length;
const totalW = n*barW + (n-1)*gap;
const idx = Math.min(n-1, Math.max(0, Math.round((100-p)/100*(n-1))));
const markerX = idx*(barW+gap) + barW/2;
const maxH = Math.max(...heights);
let bars = '';
heights.forEach((h,i)=>{
bars += `<rect x="${i*(barW+gap)}" y="${maxH-h}" width="${barW}" height="${h}" rx="2" fill="${i===idx?'#1565C0':'#D6E4F0'}"/>`;
});
return `<div style="width:100%;text-align:center;">
       <div style="font-size:20px;font-weight:700;color:var(--color-gray-600);margin-bottom:4px;">상위 ${p}%예요</div>
       <svg width="${totalW}" height="${maxH+16}" viewBox="0 0 ${totalW} ${maxH+16}" style="overflow:visible;">
         <polygon points="${markerX-6},${maxH-heights[idx]-12} ${markerX+6},${maxH-heights[idx]-12} ${markerX},${maxH-heights[idx]-2}" fill="#1565C0"/>
         ${bars}
       </svg>
       <div style="display:flex;justify-content:space-between;font-size:18px;color:var(--color-gray-400);margin-top:3px;width:${totalW}px;margin:4px auto 0;">
         <span>100%</span><span>1%</span>
       </div>
     </div>`;
};

// ── 심폐기능지수 ──
const scoreGauge = (score, unit, color) => {
if (score==null) return '';
return `<div style="text-align:center;">
       <div style="font-size:32px;font-weight:800;color:${color};line-height:1;">${score}</div>
       <div style="font-size:20px;color:var(--color-gray-400);margin-top:2px;">${unit}</div>
     </div>`;
};

// ── 신체움직임/체성분 점수바 ──
const scoreBar100 = (score, color) => {
if (score==null) return '';
const p = Math.min(100,Math.max(0,Number(score)));
return `<div style="width:100%;">
       <div style="text-align:center;font-size:28px;font-weight:800;color:${color};margin-bottom:8px;">${score}<span style="font-size:20px;font-weight:400;color:var(--color-gray-400);">/100</span></div>
       <div style="height:10px;border-radius:5px;background:#E8E8E8;overflow:hidden;">
         <div style="height:100%;width:${p}%;background:${color};border-radius:5px;"></div>
       </div>
     </div>`;
};

// ── 스트레스 점수 그라데이션 바 (이미지2 참고: 정상→초기→진행→만성, 마커) ──
const stressBar = (score) => {
if (score==null) return '';
const s = Number(score);
const stressGradesList = [
{l:'정상',color:'#2E7D32',bg:'#E8F5E9'},
{l:'초기',color:'#F57F17',bg:'#FFF8E1'},
{l:'진행',color:'#E65100',bg:'#FBE9E7'},
{l:'만성',color:'#C62828',bg:'#FFEBEE'}
];
const g = s<35?stressGradesList[0]:s<45?stressGradesList[1]:s<60?stressGradesList[2]:stressGradesList[3];
const pct = s<=35?(s/35)*37 : s<=45?37+(s-35)/10*18 : s<=60?55+(s-45)/15*23 : Math.min(100,78+(s-60)/40*22);
return `<div style="margin-top:4px;width:100%;">
       <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
         <span style="font-size:28px;font-weight:900;color:${g.color};">${s}</span>
         <span style="background:${g.bg};color:${g.color};padding:3px 10px;border-radius:8px;font-size:20px;font-weight:700;">${g.l}</span>
       </div>
       <div style="position:relative;margin-bottom:2px;height:12px;">
         <div style="position:absolute;left:calc(${pct}% - 6px);top:0;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid ${g.color};"></div>
       </div>
       <div style="height:18px;border-radius:6px;overflow:hidden;background:linear-gradient(90deg,#4CAF50 0%,#C0CA33 37%,#FFA000 55%,#F44336 78%,#B71C1C 100%);"></div>
       <div style="display:flex;justify-content:space-between;margin-top:3px;">
         ${stressGradesList.map(g2=>`<div style="font-size:8.5px;font-weight:700;color:${g2.l===g.l?g2.color:'#aaa'};text-align:center;flex:1;">${g2.l}</div>`).join('')}
       </div>
     </div>`;
};

// ── 코멘트 카드 (우측 25%) ──
const commentCard = (icon, title, text) => `
     <div style="height:100%;min-height:140px;display:flex;flex-direction:column;padding:16px;border-radius:8px;background:#ffffff;border:1px solid #e5e7eb;box-sizing:border-box;">
       <div style="font-size:18px;font-weight:700;color:var(--color-gray-600);margin-bottom:8px;flex-shrink:0;">${icon} ${title}</div>
       <div style="font-size:18px;line-height:1.6;color:${text?'var(--color-gray-700)':'var(--color-gray-400)'};white-space:pre-wrap;flex:1;overflow:visible;">${text || '등록된 코멘트가 없습니다.'}</div>
     </div>`;

// ── 평가항목 카드 ──
const itemCard = (label, vizHtml, gradeBadge) => `
     <div style="flex:1 1 180px;min-width:160px;display:flex;flex-direction:column;align-items:center;padding:18px 14px;border-radius:10px;background:#ffffff;border:1px solid #e5e7eb;box-sizing:border-box;">
       <div style="font-size:20px;font-weight:700;color:var(--color-gray-600);margin-bottom:14px;align-self:flex-start;">${label}</div>
       <div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;">${vizHtml || '<span style="font-size:20px;color:var(--color-gray-300);">데이터 없음</span>'}</div>
       ${gradeBadge ? `<div style="margin-top:12px;">${gradeBadge}</div>` : ''}
     </div>`;

// ── 등급 배지 ──
// ── 섹션 카드 (좌:Grid 평가결과 / 우:코멘트) ──
const secCardSplit = (icon, title, color, gridItemsHtml, commentIcon, commentTitle, commentText) => `
     <div style="border:1.5px solid ${color}33;border-radius:12px;overflow:hidden;margin-bottom:16px;">
       <div style="background:${color};padding:10px 18px;">
         <span style="font-size:20px;font-weight:800;color:white;">${icon} ${title}</span>
       </div>
       <div class="eval-comment-split" style="display:flex;background:var(--color-gray-50);gap:16px;padding:18px 20px;box-sizing:border-box;">
         <div class="eval-result-col" style="flex:3 1 0;min-width:0;">
           <div class="eval-grid" style="display:flex;flex-wrap:wrap;gap:14px;align-items:stretch;">
             ${gridItemsHtml}
           </div>
         </div>
         <div class="eval-comment-col" style="flex:1 1 260px;min-width:220px;">
           ${commentCard(commentIcon, commentTitle, commentText)}
         </div>
       </div>
     </div>`;

// 등급 헬퍼
const cogGrade2  = cog?.cogScore!=null  ? (Number(cog.cogScore)>=90?'최적':Number(cog.cogScore)>=80?'양호':Number(cog.cogScore)>=65?'개선':'주의') : '';
const cogColor2  = cog?.cogScore!=null  ? (Number(cog.cogScore)>=90?'#1B5E20':Number(cog.cogScore)>=80?'#2E7D32':Number(cog.cogScore)>=65?'#F57F17':'#C62828') : '#1565C0';
const subGrd     = (s)=>s==null?null:Number(s)>=67?{l:'우수',c:'#2E7D32'}:Number(s)>=34?{l:'양호',c:'#F57F17'}:{l:'위험',c:'#C62828'};
const depGrd     = (s)=>s==null?null:Number(s)<=20?{l:'경도',c:'#2E7D32'}:Number(s)<=24?{l:'중등도',c:'#F57F17'}:{l:'높은수준',c:'#C62828'};
const demGrd     = (s)=>s==null?null:Number(s)>=60?{l:'높음',c:'#C62828'}:Number(s)>=30?{l:'주의',c:'#F57F17'}:{l:'낮음',c:'#2E7D32'};
const cardioGrd  = (s,g)=>{if(s==null)return'';const n=Number(s);const tbl=g==='남자'?[[40,'최우수'],[36,'우수'],[32,'평균이상'],[29,'평균'],[25,'평균이하'],[0,'최하위']]:[[33,'최우수'],[29,'우수'],[25,'평균이상'],[22,'평균'],[19,'평균이하'],[0,'최하위']];return tbl.find(t=>n>=t[0])?.[1]||'최하위';};
const cardioColor= (s,g)=>{const lv=cardioGrd(s,g);return {'최우수':'#1B5E20','우수':'#2E7D32','평균이상':'#388E3C','평균':'#F57F17','평균이하':'#E65100','최하위':'#C62828'}[lv]||'#888';};
const stressGrd  = (s)=>s==null?null:Number(s)<35?{l:'정상',c:'#2E7D32'}:Number(s)<45?{l:'초기',c:'#F57F17'}:Number(s)<60?{l:'진행',c:'#E65100'}:{l:'만성',c:'#C62828'};

// 평가일 표시 헬퍼
const dateTag = (d) => d ? `<span style="font-size:18px;font-weight:400;color:var(--color-gray-400);margin-left:6px;">[평가일: ${d}]</span>` : '';
// 등급 배지
const gb = (g) => g ? `<span style="background:${g.c}22;color:${g.c};padding:4px 14px;border-radius:10px;font-size:20px;font-weight:700;">${g.l}</span>` : '';
// 최신 날짜
const cogDate  = cog?.measureDate||'';
const moveDate = [ergo?.measureDate,evx?.measureDate,fra?.measureDate].filter(Boolean).sort().pop()||'';
const metaDate = [inb?.measureDate,str?.measureDate].filter(Boolean).sort().pop()||'';

// ── 인지평가 Grid (2x3): 인지점수/동연령대/시공간능력/기억력/우울점수/치매위험요인 ──
const cogGridHtml = !cog ? '' : [
itemCard('인지점수', miniDonut(cog.cogScore,100,cogColor2), gb({l:cogGrade2,c:cogColor2})),
itemCard('동연령대 상위 분포도', distBar(cog.agePercentile), null),
itemCard('시공간능력', miniDonut(cog.spatial,100,(subGrd(cog.spatial)||{c:'#888'}).c), gb(subGrd(cog.spatial))),
itemCard('기억력', miniDonut(cog.memory,100,(subGrd(cog.memory)||{c:'#888'}).c), gb(subGrd(cog.memory))),
itemCard('우울점수', miniDonut(cog.depression,60,(depGrd(cog.depression)||{c:'#888'}).c), gb(depGrd(cog.depression))),
itemCard('치매위험요인', cog.dementiaRisk!=null?scoreGauge(cog.dementiaRisk,'%',(demGrd(cog.dementiaRisk)||{c:'#888'}).c):'', gb(demGrd(cog.dementiaRisk))),
].join('');

// ── 움직임평가 Grid: 심폐기능지수/신체움직임점수/신경계/통합균형능력/감각계 ──
const moveGridHtml = !(ergo||evx||fra) ? '' : [
itemCard('심폐기능지수', ergo?.cardioScore!=null?scoreGauge(ergo.cardioScore,'ml/kg/min',cardioColor(ergo.cardioScore,this.client?.gender)):'', ergo?.cardioScore!=null?gb({l:cardioGrd(ergo.cardioScore,this.client?.gender),c:cardioColor(ergo.cardioScore,this.client?.gender)}):null),
itemCard('신체움직임점수', scoreBar100(evx?.bodyMovementIndex,'#0288D1'), null),
itemCard('신경계', miniDonut(fra?.nervousScore,100,'#6A1B9A'), null),
itemCard('통합균형능력', miniDonut(fra?.balanceScore,100,'#00695C'), null),
itemCard('감각계', miniDonut(fra?.sensoryScore,100,'#E65100'), null),
].join('');

// ── 대사평가 Grid: 체성분점수/스트레스점수 ──
const metaGridHtml = !(inb||str) ? '' : [
itemCard('체성분점수', scoreBar100(inb?.bodyCompScore,'#388E3C'), null),
itemCard('스트레스점수', stressBar(str?.stressScore), gb(stressGrd(str?.stressScore))),
].join('');

el.innerHTML = `
     <div style="padding:14px 18px;">
       <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
         <span style="font-size:20px;font-weight:700;">${this._weekEvalLabel(round)}</span>

         <span style="font-size:18px;color:var(--color-gray-400);margin-left:auto;">수정은 평가관리에서</span>
       </div>

       <!-- 🧠 인지 평가 (좌 75%: Grid 평가결과 / 우 25%: 인지 전문가 코멘트) -->
       ${cog ? secCardSplit('🧠',`인지 평가${dateTag(cogDate)}`,'#1565C0', cogGridHtml, '🧠', '인지 전문가 코멘트', cmt?.cogComment) : ''}

       <!-- 🏃 움직임 평가 (좌 75%: Grid 평가결과 / 우 25%: 운동 전문가 코멘트) -->
       ${(ergo||evx||fra) ? secCardSplit('🏃',`움직임 평가${dateTag(moveDate)}`,'#2E7D32', moveGridHtml, '🏃', '운동 전문가 코멘트', cmt?.exComment) : ''}

       <!-- 💊 대사 평가 (좌 75%: Grid 평가결과 / 우 25%: 케어 매니저 코멘트) -->
       ${(inb||str) ? secCardSplit('💊',`대사(생활) 평가${dateTag(metaDate)}`,'#E65100', metaGridHtml, '💼', '케어 매니저 코멘트', cmt?.cmComment) : ''}
     </div>`;

this._bindRoundButtons(el);
},

_renderTrendInEl: async function(el) {
el.innerHTML = '<div style="padding:20px;text-align:center;"><div class="spinner" style="margin:0 auto;"></div></div>';
try {
UI.showLoading();
// 캐시에서 우선 로드
const masterList = this._masterListCache || (await API.getClientMasterList(this.client.clientId).then(r=>r.data?.masterList||[]));
const trendMasters = masterList.filter(m=>m.reportGenerated).sort((a,b)=>a.round-b.round);
if (!trendMasters.length) {
el.innerHTML = `<div class="empty-state" style="padding:36px;"><div class="empty-state-icon">📈</div><div class="empty-state-text">리포트가 생성된 평가가 없습니다</div></div>`;
return;
}

const BR='rgba(155,115,75,0.8)',LC='#9B734B',AC='rgba(155,115,75,0.13)';
const yDef={cogScore:{max:100},depression:{max:60},cardioScore:{max:44},bodyMovementIndex:{max:100},balanceScore:{max:100},bodyCompScore:{max:100},stressScore:{max:100}};

const mkC=(field,label,unit='')=>{
const pts=trendMasters.map(m=>{const v=Number(m[field]);return isNaN(v)?null:{round:m.round,v};}).filter(Boolean);
if(!pts.length) return '';
const axMax=(yDef[field]||{max:100}).max,isSingle=pts.length===1;
const W=200,H=120,padL=4,padR=4,padT=26,padB=16;
const xPos=i=>isSingle?padL+(W-padL-padR)/2:padL+i*(W-padL-padR)/(pts.length-1);
const yPos=v=>padT+(1-Math.min(1,Math.max(0,v/axMax)))*(H-padT-padB);
const latest=pts[pts.length-1]?.v,first=pts[0]?.v;
const diff=pts.length>1?Math.round((latest-first)*10)/10:null;
const db=diff==null?'':diff>0?`<span style="font-size:18px;font-weight:800;color:#1D6FF2;margin-left:3px;">▲${diff}${unit}</span>`:diff<0?`<span style="font-size:18px;font-weight:800;color:#E53935;margin-left:3px;">▼${Math.abs(diff)}${unit}</span>`:'';
let pathD='',areaD='',svgG='',htmlL='';
pts.forEach((p,i)=>{const x=xPos(i),y=yPos(p.v);pathD+=(i===0?`M${x},${y}`:`L${x},${y}`);});
if(!isSingle){areaD=pathD+` L${xPos(pts.length-1)},${H-padB} L${xPos(0)},${H-padB} Z`;svgG+=`<path d="${areaD}" fill="${AC}" stroke="none"/><path d="${pathD}" fill="none" stroke="${LC}" stroke-width="2" stroke-linejoin="round"/>`;}
pts.forEach((p,i)=>{
const x=xPos(i),y=yPos(p.v),iL=i===pts.length-1;
if(iL){const sp=Array.from({length:5},(_,si)=>{const a=(si*72-90)*Math.PI/180,a2=((si*72+36)-90)*Math.PI/180;return`${x+5*Math.cos(a)},${y+5*Math.sin(a)} ${x+2*Math.cos(a2)},${y+2*Math.sin(a2)}`;}).join(' ');svgG+=`<polygon points="${sp}" fill="#F59E0B" stroke="#D97706" stroke-width="0.5"/>`;htmlL+=`<span style="position:absolute;right:${(100-x/W*100).toFixed(1)}%;bottom:${(100-y/H*100).toFixed(1)}%;transform:translateY(-14px);font-size:18px;font-weight:700;color:${LC};white-space:nowrap;">${p.v}${unit}</span>`;}
else{svgG+=`<circle cx="${x}" cy="${y}" r="2.5" fill="${LC}" stroke="white" stroke-width="1"/>`;htmlL+=`<span style="position:absolute;left:${(x/W*100).toFixed(1)}%;bottom:${(100-y/H*100).toFixed(1)}%;transform:translateY(-10px);font-size:18px;font-weight:500;color:#999;white-space:nowrap;">${p.v}${unit}</span>`;}
svgG+=`<text x="${x}" y="${H-2}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#bbb">${p.round===1?"초기":(p.round-1)*4+"주"}</text>`;
});
svgG+=`<line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="rgba(155,115,75,0.25)" stroke-width="0.8"/>`;
return `<div style="display:flex;flex-direction:column;flex:1;min-width:0;padding:8px 8px 6px;border:1px solid ${BR};border-radius:8px;background:rgba(155,115,75,0.03);">
         <div style="font-size:18px;font-weight:700;color:#3A2A1A;margin-bottom:3px;display:flex;align-items:center;white-space:nowrap;">${label}${db}</div>
         <div style="flex:1;min-height:90px;position:relative;">
           <svg width="100%" height="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;">${svgG}</svg>${htmlL}
         </div>
       </div>`;
};
const row=(items,gap=8)=>`<div style="display:flex;gap:${gap}px;">${items.map(it=>mkC(it.f,it.l,it.u||'')).filter(Boolean).join('')}</div>`;
const secT=(icon,title,color,rowHtml)=>`<div style="margin-bottom:10px;">
       <div style="font-size:18px;font-weight:800;color:${color};padding-bottom:3px;border-bottom:1px solid rgba(155,115,75,0.2);margin-bottom:6px;">${icon} ${title}</div>
       ${rowHtml}
     </div>`;

el.innerHTML=`<div style="padding:14px 16px;">
       <!-- 1행: 인지 + 대사 -->
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
         <div>${secT('🧠','인지','#1565C0',row([{f:'cogScore',l:'인지점수',u:'점'},{f:'depression',l:'우울점수',u:'점'}]))}</div>
         <div>${secT('💊','대사','#E65100',row([{f:'bodyCompScore',l:'체성분점수',u:'점'},{f:'stressScore',l:'스트레스점수',u:'점'}]))}</div>
       </div>
       <!-- 2행: 움직임 -->
       ${secT('🏃','움직임','#2E7D32',row([{f:'cardioScore',l:'심폐기능지수'},{f:'bodyMovementIndex',l:'신체움직임',u:'점'},{f:'balanceScore',l:'통합균형능력',u:'점'}]))}
     </div>`;
} catch(e) {
el.innerHTML=`<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${e.message||'오류'}</div></div>`;
} finally { UI.hideLoading(); }
},

_renderReportTab: async function(content) {
content.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto;"></div></div>';
try {
UI.showLoading();
// 캐시에서 우선 로드
const masterList = this._masterListCache || (await API.getClientMasterList(this.client.clientId).then(r=>r.data?.masterList||[]));
const completed  = masterList.filter(m => m.reportGenerated).sort((a,b)=>b.round-a.round);

if (!completed.length) {
content.innerHTML = `<div class="empty-state" style="padding:48px;"><div class="empty-state-icon">📊</div><div class="empty-state-text">생성된 통합 리포트가 없습니다</div><div class="empty-state-sub" style="margin-top:8px;">평가관리 메뉴에서 생성하세요.</div></div>`;
return;
}

const c = this.client;
// 리스트 렌더링
const listHtml = completed.map(m => `
       <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid var(--color-gray-200);border-radius:10px;background:white;margin-bottom:8px;">
         <div style="flex:1;">
           <div style="font-size:18px;font-weight:700;color:var(--color-gray-900);">${this._weekReportLabel(m.round)}</div>

         </div>
         <button class="btn btn-outline btn-sm report-preview-btn" data-round="${m.round}" style="white-space:nowrap;">👁 미리보기</button>
         <button class="btn btn-primary btn-sm report-print-btn" data-round="${m.round}" style="white-space:nowrap;">🖨️ 출력</button>
       </div>`).join('');

content.innerHTML = `<div style="padding:16px;">${listHtml}</div>`;

// 미리보기 버튼
content.querySelectorAll('.report-preview-btn').forEach(btn=>{
btn.addEventListener('click', async ()=>{
const round = Number(btn.dataset.round);
const m = completed.find(x=>x.round===round);
if (!m) return;
const masterListFull = this._masterListCache || (await API.getClientMasterList(c.clientId).catch(()=>null))?.data?.masterList || [m];
const html = this._buildReportHTML(m, masterListFull);
const wrap = document.createElement('div');
wrap.className='modal-backdrop';
wrap.innerHTML=`<div class="modal" style="max-width:820px;max-height:92vh;display:flex;flex-direction:column;">
           <div class="modal-header">
             <h3 class="modal-title">📄 ${this._weekReportLabel(round)} — ${c.name}</h3>
             <div style="display:flex;gap:8px;">
               <button class="btn btn-primary btn-sm" id="rpt-print-now">🖨️ PDF 출력</button>
               <button class="modal-close" id="rpt-close">✕</button>
             </div>
           </div>
           <div class="modal-body" style="overflow-y:auto;flex:1;background:#f5f5f5;padding:16px;">
             <div id="rpt-preview-area" style="background:white;border-radius:8px;">${html}</div>
           </div>
         </div>`;
document.body.appendChild(wrap);
wrap.querySelector('#rpt-close').onclick=()=>wrap.remove();
wrap.onclick=e=>{if(e.target===wrap)wrap.remove();};
wrap.querySelector('#rpt-print-now').onclick=()=>this._printReport(m, wrap.querySelector('#rpt-preview-area'));
});
});

// 출력 버튼
content.querySelectorAll('.report-print-btn').forEach(btn=>{
btn.addEventListener('click', async ()=>{
const round = Number(btn.dataset.round);
const m = completed.find(x=>x.round===round);
if (!m) return;
const masterListFull = this._masterListCache || (await API.getClientMasterList(c.clientId).catch(()=>null))?.data?.masterList || [m];
const tempDiv=document.createElement('div');
tempDiv.innerHTML=this._buildReportHTML(m, masterListFull);
this._printReport(m, tempDiv);
});
});

return; // 아래 나머지 코드 실행 방지
// ── 구 코드 (하위 호환 placeholder) ──
if (!this.activeReportRound) this.activeReportRound = completed[0].round;
const active = completed.find(m => m.round === this.activeReportRound) || completed[0];

content.innerHTML = `
       <div style="padding:8px 0;">
         <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
           ${roundBtns}
           <button class="btn btn-outline btn-sm" id="print-report-btn" style="margin-left:auto;">
             🖨️ PDF 출력
           </button>
         </div>
         <div id="report-view-area" style="border:1px solid var(--color-gray-200);border-radius:10px;overflow:hidden;">
           ${this._buildReportHTML(active, completed)}
         </div>
       </div>`;

content.querySelectorAll('[data-rround]').forEach(btn => {
btn.addEventListener('click', () => {
this.activeReportRound = Number(btn.dataset.rround);
this._renderReportTab(content);
});
});

document.getElementById('print-report-btn')?.addEventListener('click', () => this._printReport(active));

} catch(e) {
content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${e.message}</div></div>`;
} finally { UI.hideLoading(); }
},

_bindRoundButtons: function(el) {
const self = this;
// 평가관리로 이동
el.querySelectorAll('.goto-assess-round-btn').forEach(btn => {
btn.addEventListener('click', () => {
const round = Number(btn.dataset.round);
AssessmentsPage._pendingClientId = self.client.clientId;
AssessmentsPage._pendingRound    = round;
Router.navigate('assessments');
});
});
// 회차 리포트 생성
el.querySelectorAll('.gen-round-report-btn').forEach(btn => {
btn.addEventListener('click', async () => {
const round = Number(btn.dataset.round);
const master = self.roundData?.master;
const alreadyExists = master?.reportGenerated;
let ok = true;
if (alreadyExists) {
ok = await UI.confirm({
title:'이미 생성된 리포트가 있습니다.',
message:'기존 리포트를 삭제하고 다시 생성하시겠습니까?',
confirmText:'재생성', cancelText:'취소', type:'warning'
});
}
if (!ok) return;
try {
UI.showLoading();
const res = await API.generateReport(self.client.clientId, round, alreadyExists);
if (res.status === 'success') {
UI.toast(res.data.message, 'success');
// 즉시 보기
if (res.data.masterData) {
self._showInstantReport(res.data.masterData);
}
await self.render(self.client.clientId);
} else {
UI.toast(res.message || '생성 실패', 'error');
}
} catch { UI.toast('서버 오류', 'error'); }
finally { UI.hideLoading(); }
});
});
},

_showInstantReport: async function(masterData) {
const c = this.client;
// 추이 그래프를 위해 전체 masterList 조회
let masterList = [masterData];
try {
const res = await API.getClientMasterList(c.clientId);
if (res.status === 'success') masterList = res.data.masterList || [masterData];
} catch(e) {}
const reportHtml = this._buildReportHTML(masterData, masterList);
const wrap = document.createElement('div');
wrap.className = 'modal-backdrop';
wrap.innerHTML = `
     <div class="modal" style="max-width:800px;max-height:92vh;display:flex;flex-direction:column;">
       <div class="modal-header">
         <h3 class="modal-title">📄 리포트 생성 완료 — ${c.name} ${this._weekReportLabel(masterData.round)}</h3>
         <div style="display:flex;gap:8px;">
           <button class="btn btn-secondary btn-sm" id="instant-print">🖨️ PDF 출력</button>
           <button class="modal-close" id="instant-close">✕</button>
         </div>
       </div>
       <div class="modal-body" style="overflow-y:auto;flex:1;">
         <div id="instant-report-area">${reportHtml}</div>
       </div>
     </div>`;
document.body.appendChild(wrap);
wrap.querySelector('#instant-close').onclick = () => wrap.remove();
wrap.onclick = e => { if(e.target===wrap) wrap.remove(); };
wrap.querySelector('#instant-print').onclick = () => {
this._printReport(masterData, wrap.querySelector('#instant-report-area'));
};
},

_buildReportHTML: function(master, allMasterList) {
const c   = this.client;
const logoSrc = document.getElementById('logo-data')?.value || '';

// 나이 계산
const age = c.birthDate ? (new Date().getFullYear() - new Date(c.birthDate).getFullYear()) : '-';

// 인지지수 등급
const cogGrade = (() => {
if (master.cogScore == null) return '-';
const n = Number(master.cogScore);
if (n>=90) return '최적'; if (n>=80) return '양호'; if (n>=65) return '개선'; return '주의';
})();

// 스트레스 지수
const stressGrade = (() => {
if (master.stressScore == null) return '-';
const n = Number(master.stressScore);
if (n<35) return '정상'; if (n<45) return '초기'; if (n<60) return '진행'; return '만성';
})();

// 회차 → 주차 변환 (평가 페이지 타이틀용: 초기/N주차)
const weekEvalLabel = (n) => n===1 ? '초기' : `${(n-1)*4}주차`;

// ── 시각화 헬퍼 (평가화면과 동일) ──────────────────────

// 반원 게이지 (인지점수)
const gaugeHalf = (score, color='#1565C0') => {
const pct = Math.min(100, Math.max(0, Number(score)||0));
const angle = (pct/100)*180;
const r=52, cx=70, cy=66;
const rad = angle*Math.PI/180;
const ex = cx + r*Math.cos(Math.PI-rad);
const ey = cy - r*Math.sin(rad);
return `<svg width="140" height="80" viewBox="0 0 140 80">
       <path d="M 18 66 A 52 52 0 0 1 122 66" fill="none" stroke="#E8E8E8" stroke-width="12" stroke-linecap="round"/>
       ${pct>0?`<path d="M 18 66 A 52 52 0 ${angle>180?1:0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>`:''}
       <text x="70" y="62" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="800" fill="${color}">${score!=null?score:'-'}</text>
       <text x="70" y="76" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#aaa">0 ─── 100</text>
     </svg>`;
};

// 원형 도넛 게이지
const donutChart = (score, color='#B8934A', size=80) => {
const pct = Math.min(100, Math.max(0, Number(score)||0));
const r=size*0.38, circ=2*Math.PI*r, dash=(pct/100)*circ;
const sw=size*0.12, half=size/2;
return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
       <circle cx="${half}" cy="${half}" r="${r}" fill="none" stroke="#E8E8E8" stroke-width="${sw}"/>
       ${pct>0?`<circle cx="${half}" cy="${half}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
         stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
         stroke-dashoffset="${(circ/4).toFixed(1)}" stroke-linecap="round"/>`:''}
       <text x="${half}" y="${half+5}" text-anchor="middle" font-family="sans-serif" font-size="${size*0.2}" font-weight="800" fill="${color}">${score!=null?score:'-'}</text>
     </svg>`;
};

// 퍼센타일 바
const pctBar = (pct) => {
const p = Math.min(100, Math.max(0, Number(pct)||0));
return `<div style="margin:4px 0;">
       <div style="height:14px;background:#E8E8E8;border-radius:7px;overflow:hidden;position:relative;">
         <div style="height:100%;width:${p}%;background:linear-gradient(90deg,#FF7043,#FFA726,#66BB6A);border-radius:7px;"></div>
       </div>
       <div style="display:flex;justify-content:space-between;font-size:18px;color:#aaa;margin-top:2px;"><span>하위</span><span style="font-weight:700;color:#1565C0;">상위 ${p}%</span><span>상위</span></div>
     </div>`;
};

// 구간형 게이지 (스트레스/에르고)
const segGauge = (score, segments, labelFn) => {
const matched = labelFn ? labelFn(score) : null;
return `<div>
       <div style="display:flex;height:20px;border-radius:4px;overflow:hidden;gap:1px;">
         ${segments.map(sg=>`<div style="flex:1;background:${sg.color};opacity:${matched&&matched===sg.l?1:0.2};display:flex;align-items:center;justify-content:center;font-size:18px;color:white;font-weight:700;">${sg.l}</div>`).join('')}
       </div>
       ${matched?`<div style="text-align:center;margin-top:4px;font-weight:700;font-size:20px;color:${segments.find(s=>s.l===matched)?.color||'#888'};">${matched}</div>`:''}
     </div>`;
};

// 점수 바 (스코어바 호환)
const scoreBar = (score, color='#B8934A', max=100) => {
const pct = Math.min(100, Math.max(0, (Number(score)||0)/max*100));
return `<div style="height:10px;background:#E8E8E8;border-radius:5px;overflow:hidden;margin-top:4px;">
       <div style="height:100%;width:${pct.toFixed(1)}%;background:${color};border-radius:5px;"></div>
     </div>`;
};

// 인지 서브 등급 (시공간/기억력)
const cogSubGrade = (score) => {
if (score==null) return null;
const n=Number(score);
if (n>=67) return {l:'우수',c:'#2E7D32',b:'#E8F5E9'};
if (n>=34) return {l:'양호',c:'#F57F17',b:'#FFF8E1'};
return {l:'위험',c:'#C62828',b:'#FFEBEE'};
};
const cogSubColor = (score) => {
if (score==null) return '#888';
const n=Number(score);
return n>=67?'#2E7D32':n>=34?'#F57F17':'#C62828';
};

// 심폐기능 등급 계산
const getCardioGrade = (score, gender, birthDate) => {
if (score==null) return null;
const age2 = birthDate ? new Date().getFullYear()-new Date(birthDate).getFullYear() : 0;
const isMale = gender==='남자'; const n=Number(score);
const tbl = isMale
? [{l:'최우수',min:40},{l:'우수',min:36},{l:'평균이상',min:32},{l:'평균',min:29},{l:'평균이하',min:25},{l:'최하위',min:0}]
: [{l:'최우수',min:33},{l:'우수',min:29},{l:'평균이상',min:25},{l:'평균',min:22},{l:'평균이하',min:19},{l:'최하위',min:0}];
return (tbl.find(g=>n>=g.min)||tbl[tbl.length-1]).l;
};

// 심폐기능 등급표 (고객 기준)
const cardioTable = (gender, birthDate) => {
const isMale = gender==='남자';
const rows = isMale
? [['최우수','40.0↑','37.0↑'],['우수','36.0~39.9','33.0~37.0'],['평균이상','32.0~35.9','29.0~32.9'],['평균','29.0~31.9','26.0~28.9'],['평균이하','25.0~28.9','22.0~25.9'],['최하위','25.0↓','22.0↓']]
: [['최우수','33.0↑','32.0↑'],['우수','29.0~32.9','28.0~32.0'],['평균이상','25.0~28.9','25.0~27.9'],['평균','22.0~24.9','22.0~24.9'],['평균이하','19.0~21.9','19.0~21.9'],['최하위','19.0↓','19.0↓']];
const grade = getCardioGrade(master.cardioScore, gender, birthDate);
return `<table style="font-size:18px;border-collapse:collapse;width:100%;">
       <thead><tr style="background:#f5f5f5;"><th style="padding:3px 6px;border:1px solid #ddd;">등급</th><th style="padding:3px 6px;border:1px solid #ddd;">60~65세</th><th style="padding:3px 6px;border:1px solid #ddd;">66세↑</th></tr></thead>
       <tbody>${rows.map(r=>`<tr style="background:${grade===r[0]?'#E3F2FD':''};"><td style="padding:3px 6px;border:1px solid #ddd;font-weight:${grade===r[0]?'800':'400'};">${r[0]}</td><td style="padding:3px 6px;border:1px solid #ddd;text-align:center;">${r[1]}</td><td style="padding:3px 6px;border:1px solid #ddd;text-align:center;">${r[2]}</td></tr>`).join('')}</tbody>
     </table>`;
};

const stressGrades = [
{l:'정상',color:'#2E7D32'},{l:'초기',color:'#F57F17'},
{l:'진행',color:'#E65100'},{l:'만성',color:'#C62828'}
];
const getStressGrade = (score) => {
if (score==null) return null;
const n=Number(score);
if (n<35) return '정상'; if (n<45) return '초기'; if (n<60) return '진행'; return '만성';
};
const getDepressionGrade = (score) => {
if (score==null) return null;
const n=Number(score);
if (n<=20) return {l:'경도 수준', c:'#2E7D32', b:'#E8F5E9'};
if (n<=24) return {l:'중등도 수준', c:'#F57F17', b:'#FFF8E1'};
return {l:'높은 수준', c:'#C62828', b:'#FFEBEE'};
};
// 그라데이션 마커 바 (범용)
const gradientMarkerBar = (pct, gradientCss, labels, ranges) => {
const p = Math.min(100, Math.max(0, pct||0));
const gradeColors = ['#2E7D32','#F57F17','#E65100','#C62828'];
return `<div style="position:relative;margin-bottom:2px;height:12px;">
       <div style="position:absolute;left:calc(${p}% - 5px);top:0;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:9px solid #333;"></div>
     </div>
     <div style="height:16px;border-radius:5px;overflow:hidden;background:${gradientCss};"></div>
     <div style="display:flex;justify-content:space-between;margin-top:2px;">
       ${labels.map((l,i)=>`<div style="font-size:8px;color:#888;text-align:center;flex:1;">${l}</div>`).join('')}
     </div>`;
};

// 추이 그래프 (SVG 선 그래프)
const trendChart = (masterList, fields) => {
if (!masterList || masterList.length < 1) return '<div style="color:#aaa;font-size:18px;text-align:center;padding:16px;">이전 회차 데이터 없음</div>';
const sorted = [...masterList].sort((a,b)=>a.round-b.round);
const W=460, H=140, pad=36;
const colors=['#B8934A','#1565C0','#2E7D32','#7B1FA2','#E65100','#C62828','#00695C'];
const xStep = sorted.length > 1 ? (W-pad*2)/(sorted.length-1) : 0;
const yMax=100, yMin=0;

const xPos = i => pad + i*xStep;
const yPos = v => H - pad - ((v-yMin)/(yMax-yMin))*(H-pad*2);

let svgLines = '';
let svgDots  = '';
let legend   = '';

fields.forEach((f, fi) => {
const pts = sorted.map((m,i) => {
const v = Number(m[f.key]);
return isNaN(v) ? null : { x:xPos(i), y:yPos(v), v };
});
const validPts = pts.filter(Boolean);
if (!validPts.length) return;

const pathD = validPts.map((p,i)=>(i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`)).join(' ');
svgLines += `<path d="${pathD}" fill="none" stroke="${colors[fi%colors.length]}" stroke-width="2" stroke-linejoin="round"/>`;
validPts.forEach(p => {
svgDots += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${colors[fi%colors.length]}" stroke="white" stroke-width="1.5"/>`;
svgDots += `<text x="${p.x}" y="${p.y-8}" text-anchor="middle" font-size="9" fill="${colors[fi%colors.length]}">${p.v}</text>`;
});
legend += `<span style="display:inline-flex;align-items:center;gap:4px;font-size:18px;margin-right:10px;"><span style="display:inline-block;width:14px;height:3px;background:${colors[fi%colors.length]};border-radius:2px;"></span>${f.label}</span>`;
});

// X축 레이블
let xLabels='';
sorted.forEach((m,i)=>{
xLabels+=`<text x="${xPos(i)}" y="${H-4}" text-anchor="middle" font-size="10" fill="#888">${m.round}회차</text>`;
});
// Y축
const yLabels = [0,25,50,75,100].map(v=>`<text x="${pad-4}" y="${yPos(v)+3}" text-anchor="end" font-size="9" fill="#aaa">${v}</text><line x1="${pad}" y1="${yPos(v)}" x2="${W-pad}" y2="${yPos(v)}" stroke="#eee" stroke-width="1"/>`).join('');

return `
       <div style="margin-bottom:6px;">${legend}</div>
       <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;">
         ${yLabels}${svgLines}${svgDots}${xLabels}
       </svg>`;
};

const today = new Date();
const pad2  = n => String(n).padStart(2,'0');
const todayStr = `${today.getFullYear()}.${pad2(today.getMonth()+1)}.${pad2(today.getDate())}`;

// ── 모든 이전 회차 포함 추이용 데이터 ──
const trendMasters = allMasterList || [master];

// FRA 기준값 항목명 (StandardsCache 사용)
const nervItems = (typeof StandardsCache!=='undefined'&&StandardsCache.get('inbodyFra_nervous'))||
[{label:'신경계 평가'},{label:'반응시간 평가'},{label:'자세유지시간 평가'}];
const balItems  = (typeof StandardsCache!=='undefined'&&StandardsCache.get('inbodyFra_balance'))||
[{label:'통합 균형 능력 평가'},{label:'빠르게 무게중심 옮기기'},{label:'과녁 따라 무게중심'}];
const sensItems = (typeof StandardsCache!=='undefined'&&StandardsCache.get('inbodyFra_sensory'))||
[{label:'감각계 평가'},{label:'체성감각 평가'},{label:'시각 평가'},{label:'전정감각 평가'}];

return `
<!-- ===================== PAGE 1: 표지 ===================== -->
<div style="width:100%;min-height:1050px;display:flex;flex-direction:column;justify-content:space-between;padding:60px 56px;box-sizing:border-box;page-break-after:always;background:white;">
 <!-- 상단: 로고 -->
 <div style="text-align:center;">
   ${logoSrc?`<img src="${logoSrc}" alt="Care Hub" style="max-width:180px;height:auto;object-fit:contain;">`:'<div style="font-size:18px;font-weight:800;letter-spacing:0.15em;color:#B8934A;">CARE HUB IN HANAM</div>'}
 </div>

 <!-- 중앙: 제목 -->
 <div style="text-align:center;padding:30px 0;">
   <div style="font-size:18px;letter-spacing:0.3em;color:#B8934A;font-weight:700;margin-bottom:20px;text-transform:uppercase;">Integrated Health Report</div>
   <div style="font-size:52px;font-weight:900;color:#1A1A1A;letter-spacing:-0.02em;line-height:1.1;margin-bottom:16px;">통합 리포트</div>
   <div style="width:60px;height:3px;background:#B8934A;margin:20px auto 28px;border-radius:2px;"></div>
   <div style="font-size:28px;font-weight:700;color:#2C2C2C;">${c.name} 님</div>
 </div>

 <!-- 하단: 고객 정보 -->
 <div style="border-top:1px solid #E0D5C5;padding-top:28px;">
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 40px;max-width:400px;">
     <div><div style="font-size:18px;color:#B8934A;font-weight:700;letter-spacing:0.08em;margin-bottom:4px;">나이</div><div style="font-size:18px;font-weight:600;">${age}세</div></div>
     <div><div style="font-size:18px;color:#B8934A;font-weight:700;letter-spacing:0.08em;margin-bottom:4px;">성별</div><div style="font-size:18px;font-weight:600;">${c.gender||'-'}</div></div>
     <div><div style="font-size:18px;color:#B8934A;font-weight:700;letter-spacing:0.08em;margin-bottom:4px;">입소 등록일</div><div style="font-size:18px;font-weight:600;">${c.firstVisit||'-'}</div></div>
     <div><div style="font-size:18px;color:#B8934A;font-weight:700;letter-spacing:0.08em;margin-bottom:4px;">리포트 생성일</div><div style="font-size:18px;font-weight:600;">${todayStr}</div></div>
   </div>
   <div style="margin-top:24px;font-size:18px;color:#aaa;letter-spacing:0.05em;">CARE HUB IN HANAM · 케어허브 하남</div>
 </div>
</div>

<!-- ===================== PAGE 2: 평가 결과 ===================== -->
<div style="width:100%;min-height:100vh;padding:14px 28px;box-sizing:border-box;page-break-after:always;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;">
 <!-- 헤더 -->
 <div style="border-bottom:2px solid #B8934A;padding-bottom:5px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
   <div style="font-size:20px;font-weight:800;color:#1A1A1A;">${weekEvalLabel(master.round)} 평가 결과</div>
   <div style="font-size:18px;color:#aaa;">${c.name} · ${todayStr}</div>
 </div>

 <!-- 세 영역: 인지(3):움직임(2):대사(1) -->
 <div style="display:flex;flex-direction:column;flex:1;gap:8px;min-height:0;">

   <!-- ▣ 인지 관리 (flex:3) -->
   <div style="border:1.5px solid #BBDEFB;border-radius:8px;overflow:hidden;flex:2;display:flex;flex-direction:column;min-height:0;">
     <div style="background:#1565C0;padding:6px 12px;flex-shrink:0;">
        <span style="font-size:20px;font-weight:900;color:white;">🧠 인지 관리 리포트</span>
        <span style="font-size:16px;font-weight:900;color:white;">🧠 인지 관리 리포트</span>
     </div>
     <div style="padding:8px 12px;background:white;flex:1;overflow:hidden;display:flex;flex-direction:column;">
       <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;flex:1;min-height:0;">

         <!-- 좌: 인지점수+동연령대 (flex column, 1:1 비율, 타이틀 좌측상단 고정) -->
         <div style="padding:7px;background:#F8FBFF;border-radius:7px;border:1px solid #E3F2FD;display:flex;flex-direction:column;gap:0;">

            <!-- 인지점수 영역 (flex:1) -->
           <!-- 인지점수 영역 (flex:1) -->
           <div style="flex:1;display:flex;flex-direction:column;">
              <div style="font-size:20px;font-weight:900;color:#1A1A1A;margin-bottom:6px;text-align:left;">인지점수</div>
              <div style="font-size:15px;font-weight:900;color:#1A1A1A;margin-bottom:6px;text-align:left;">인지점수</div>
             <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
               <div style="display:flex;justify-content:center;">
                 ${(()=>{
                   const score=master.cogScore;
                   const gc=cogGrade!=='-'?(cogGrade==='최적'?'#1B5E20':cogGrade==='양호'?'#2E7D32':cogGrade==='개선'?'#F57F17':'#C62828'):'#1565C0';
                   const pct=Math.min(100,Math.max(0,Number(score)||0));
                    const angle=(pct/100)*180,r=34,cx=44,cy=42;
                    const rad=angle*Math.PI/180,ex=cx+r*Math.cos(Math.PI-rad),ey=cy-r*Math.sin(rad);
                    return `<svg width="88" height="56" viewBox="0 0 88 56">
                      <path d="M 10 42 A 34 34 0 0 1 78 42" fill="none" stroke="#E8E8E8" stroke-width="8" stroke-linecap="round"/>
                      ${pct>0?`<path d="M 10 42 A 34 34 0 ${angle>180?1:0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${gc}" stroke-width="8" stroke-linecap="round"/>`:''}
                      <text x="44" y="38" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="800" fill="${gc}">${score!=null?score+'점':'-'}</text>
                      <text x="44" y="53" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#bbb">0 ──── 100</text>
                    </svg>`;
            
                    // 그래프 크기 확대
                    const angle=(pct/100)*180;
                    const r=40;
                    const cx=50;
                    const cy=48;
            
                    const rad=angle*Math.PI/180;
                    const ex=cx+r*Math.cos(Math.PI-rad);
                    const ey=cy-r*Math.sin(rad);
            
                    return `
                      <svg width="100" height="66" viewBox="0 0 100 66">
                        <!-- 배경 -->
                        <path
                          d="M 10 48 A 40 40 0 0 1 90 48"
                          fill="none"
                          stroke="#E8E8E8"
                          stroke-width="9"
                          stroke-linecap="round"
                        />
            
                        <!-- 진행 -->
                        ${
                          pct>0
                          ? `<path
                                d="M 10 48 A 40 40 0 ${angle>180?1:0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}"
                                fill="none"
                                stroke="${gc}"
                                stroke-width="9"
                                stroke-linecap="round"
                             />`
                          : ''
                        }
            
                        <!-- 점수 -->
                        <text
                          x="50"
                          y="42"
                          text-anchor="middle"
                          font-family="sans-serif"
                          font-size="16"
                          font-weight="800"
                          fill="${gc}">
                          ${score!=null?score+'점':'-'}
                        </text>
            
                        <!-- 범위 -->
                        <text
                          x="50"
                          y="60"
                          text-anchor="middle"
                          font-family="sans-serif"
                          font-size="9"
                          fill="#bbb">
                          0 ───── 100
                        </text>
                      </svg>
                    `;
                 })()}
               </div>
            
               <!-- 상태값 배지 -->
                ${cogGrade!=='-'?`<div style="text-align:center;margin-top:4px;"><span style="background:${cogGrade==='최적'?'#E8F5E9':cogGrade==='양호'?'#C8E6C9':cogGrade==='개선'?'#FFF8E1':'#FFEBEE'};color:${cogGrade==='최적'?'#1B5E20':cogGrade==='양호'?'#2E7D32':cogGrade==='개선'?'#F57F17':'#C62828'};padding:2px 8px;border-radius:6px;font-size:18px;font-weight:700;">${cogGrade}</span></div>`:''}
                <!-- 범례 아래 1행 -->
                <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:5px;">
                  ${[{l:'최적',c:'#1B5E20',t:'90↑'},{l:'양호',c:'#2E7D32',t:'80~89'},{l:'개선',c:'#F57F17',t:'65~79'},{l:'주의',c:'#C62828',t:'~64'}]
                    .map(g=>`<div style="display:flex;align-items:center;gap:2px;"><span style="width:6px;height:6px;border-radius:50%;background:${g.c};flex-shrink:0;"></span><span style="font-size:8px;color:${g.c};font-weight:700;">${g.l} ${g.t}</span></div>`).join('')}
                ${
                  cogGrade!=='-'
                  ? `<div style="text-align:center;margin-top:6px;">
                      <span style="
                        background:${cogGrade==='최적'?'#E8F5E9':cogGrade==='양호'?'#C8E6C9':cogGrade==='개선'?'#FFF8E1':'#FFEBEE'};
                        color:${cogGrade==='최적'?'#1B5E20':cogGrade==='양호'?'#2E7D32':cogGrade==='개선'?'#F57F17':'#C62828'};
                        padding:2px 8px;
                        border-radius:6px;
                        font-size:18px;
                        font-weight:700;">
                        ${cogGrade}
                      </span>
                    </div>`
                  : ''
                }
            
                <!-- 범례 -->
                <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:6px;">
                  ${
                    [
                      {l:'최적',c:'#1B5E20',t:'90↑'},
                      {l:'양호',c:'#2E7D32',t:'80~89'},
                      {l:'개선',c:'#F57F17',t:'65~79'},
                      {l:'주의',c:'#C62828',t:'~64'}
                    ].map(g=>`
                      <div style="display:flex;align-items:center;gap:2px;">
                        <span style="width:6px;height:6px;border-radius:50%;background:${g.c};flex-shrink:0;"></span>
                        <span style="font-size:8px;color:${g.c};font-weight:700;">
                          ${g.l} ${g.t}
                        </span>
                      </div>
                    `).join('')
                  }
               </div>
             </div>
           </div>

           <div style="border-top:1px solid #E3F2FD;margin:4px 0;"></div>

           <!-- 동연령대 영역 (flex:1, 타이틀 좌측상단 고정) -->
           <div style="flex:1;display:flex;flex-direction:column;">
              <div style="font-size:20px;font-weight:900;color:#1A1A1A;margin-bottom:6px;text-align:left;">동연령대 상위 분포도</div>
              <div style="font-size:16px;font-weight:900;color:#1A1A1A;margin-bottom:6px;text-align:left;">동연령대 상위 분포도</div>
             <div style="flex:1;display:flex;align-items:center;justify-content:center;">
               ${(()=>{
                 if (master.agePercentile==null) return '<div style="font-size:18px;color:#aaa;">-</div>';
                 const p = master.agePercentile;
                 const heights=[16,24,32,40,46,40,32,24,16];
                 const barW=7, gap=3, n=heights.length;
                 const totalW=n*barW+(n-1)*gap;
                 const idx=Math.min(n-1,Math.max(0,Math.round((100-p)/100*(n-1))));
                 const markerX=idx*(barW+gap)+barW/2;
                 const maxH=Math.max(...heights);
                 let bars='';
                 heights.forEach((h,i)=>{
                   const x=i*(barW+gap), y=maxH-h, active=i===idx;
                   bars+=`<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="1.5" fill="${active?'#1565C0':'#D6E4F0'}"/>`;
                 });
                 return `<div style="text-align:center;">
                   <div style="font-size:18px;color:#666;margin-bottom:2px;">상위 ${p}%예요</div>
                   <svg width="${totalW}" height="${maxH+10}" viewBox="0 0 ${totalW} ${maxH+10}" style="overflow:visible;">
                     <polygon points="${markerX-4},${maxH-heights[idx]-8} ${markerX+4},${maxH-heights[idx]-8} ${markerX},${maxH-heights[idx]-2}" fill="#1565C0"/>
                     ${bars}
                   </svg>
                   <div style="display:flex;justify-content:space-between;font-size:7px;color:#aaa;margin-top:2px;width:${totalW}px;"><span>100%</span><span>1%</span></div>
                 </div>`;
               })()}
             </div>
           </div>
         </div>

         <!-- 우: 2×2 그리드 (시공간/기억력/우울/치매) -->
         <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:7px;">

           ${[
             {key:'spatial', label:'시공간능력', gradeColor:cogSubColor, gradeFn:cogSubGrade, grades:[{l:'위험',c:'#C62828',t:'0~33'},{l:'양호',c:'#F57F17',t:'34~66'},{l:'우수',c:'#2E7D32',t:'67~100'}]},
             {key:'memory',  label:'기억력',     gradeColor:cogSubColor, gradeFn:cogSubGrade, grades:[{l:'위험',c:'#C62828',t:'0~33'},{l:'양호',c:'#F57F17',t:'34~66'},{l:'우수',c:'#2E7D32',t:'67~100'}]}
           ].map(item=>{
             const score=master[item.key], clr=item.gradeColor(score);
             const pct=Math.min(100,Math.max(0,Number(score)||0));
             const r=36,circ=2*Math.PI*r,dash=(pct/100)*circ;
             return `<div style="padding:7px 12px;background:#F8FBFF;border-radius:7px;border:1px solid #E3F2FD;display:flex;flex-direction:column;align-items:center;">
                <div style="font-size:20px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">${item.label}</div>
                <div style="font-size:16px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">${item.label}</div>
               <div style="display:flex;align-items:center;gap:8px;">
                 <svg width="88" height="88" viewBox="0 0 88 88" style="flex-shrink:0;">
                   <circle cx="44" cy="44" r="${r}" fill="none" stroke="#E8E8E8" stroke-width="10"/>
                   ${pct>0?`<circle cx="44" cy="44" r="${r}" fill="none" stroke="${clr}" stroke-width="10" stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(circ/4).toFixed(1)}" stroke-linecap="round"/>`:''}
                   <text x="44" y="48" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="800" fill="${clr}">${score!=null?score+'점':'-'}</text>
                 </svg>
                 ${item.gradeFn(score)?`<span style="background:${item.gradeFn(score).b};color:${item.gradeFn(score).c};padding:3px 8px;border-radius:6px;font-size:18px;font-weight:700;">${item.gradeFn(score).l}</span>`:''}
               </div>
               <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;justify-content:center;">
                 ${item.grades.map(g=>`<div style="display:flex;align-items:center;gap:3px;"><span style="width:6px;height:6px;border-radius:50%;background:${g.c};flex-shrink:0;"></span><span style="font-size:8px;color:${g.c};font-weight:600;">${g.l} ${g.t}</span></div>`).join('')}
               </div>
             </div>`;
           }).join('')}

           <!-- 우울점수 -->
           ${(()=>{
             const score=master.depression, dg=getDepressionGrade(score);
             const pct=score!=null?Math.min(100,(Number(score)/60)*100):0;
             const r=36,circ=2*Math.PI*r,dash=(pct/100)*circ, clr=dg?.c||'#7B1FA2';
             return `<div style="padding:7px 12px;background:#F8FBFF;border-radius:7px;border:1px solid #E3F2FD;display:flex;flex-direction:column;align-items:center;">
                <div style="font-size:20px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">우울점수</div>
                <div style="font-size:16px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">우울점수</div>
               <div style="display:flex;align-items:center;gap:8px;">
                 <svg width="88" height="88" viewBox="0 0 88 88" style="flex-shrink:0;">
                   <circle cx="44" cy="44" r="${r}" fill="none" stroke="#E8E8E8" stroke-width="10"/>
                   ${pct>0?`<circle cx="44" cy="44" r="${r}" fill="none" stroke="${clr}" stroke-width="10" stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(circ/4).toFixed(1)}" stroke-linecap="round"/>`:''}
                   <text x="44" y="48" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="800" fill="${clr}">${score!=null?score+'점':'-'}</text>
                 </svg>
                 ${dg?`<span style="background:${dg.b};color:${dg.c};padding:3px 8px;border-radius:6px;font-size:18px;font-weight:700;">${dg.l}</span>`:''}
               </div>
               <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;justify-content:center;">
                 ${[{l:'경도',c:'#2E7D32',t:'0~20'},{l:'중등도',c:'#F57F17',t:'21~24'},{l:'높은수준',c:'#C62828',t:'25~60'}].map(g=>`<div style="display:flex;align-items:center;gap:3px;"><span style="width:6px;height:6px;border-radius:50%;background:${g.c};flex-shrink:0;"></span><span style="font-size:8px;color:${g.c};font-weight:600;">${g.l} ${g.t}</span></div>`).join('')}
               </div>
             </div>`;
           })()}

           <!-- 치매위험요인: 숫자만 표기 -->
           ${(()=>{
             const p=master.dementiaRisk!=null?Math.min(100,master.dementiaRisk):null;
             const clr=p==null?'#888':p>=60?'#C62828':p>=30?'#F57F17':'#2E7D32';
             const lvl=p==null?'-':p>=60?'높음':p>=30?'주의':'낮음';
             return `<div style="padding:7px 12px;background:#F8FBFF;border-radius:7px;border:1px solid #E3F2FD;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="font-size:20px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">치매위험요인</div>
                <div style="font-size:16px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">치매위험요인</div>
               <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                 ${p!=null?`
                 <div style="font-size:30px;font-weight:900;color:${clr};line-height:1;">${p}<span style="font-size:14px;font-weight:600;">%</span></div>
                 <div style="margin-top:6px;"><span style="background:${clr}22;color:${clr};padding:2px 9px;border-radius:6px;font-size:18px;font-weight:700;">${lvl}</span></div>`:'<div style="font-size:20px;color:#aaa;">-</div>'}
               </div>
             </div>`;
           })()}

         </div>
       </div>
     </div>
   </div>

   <!-- ▣ 움직임 관리 (flex:2) -->
   <div style="border:1.5px solid #C8E6C9;border-radius:8px;overflow:hidden;flex:2;display:flex;flex-direction:column;min-height:0;">
     <div style="background:#2E7D32;padding:6px 12px;flex-shrink:0;">
        <span style="font-size:20px;font-weight:900;color:white;">🏃 움직임 관리 리포트</span>
        <span style="font-size:16px;font-weight:900;color:white;">🏃 움직임 관리 리포트</span>
     </div>
     <div style="padding:8px 12px;background:white;flex:1;overflow:hidden;display:flex;flex-direction:column;gap:7px;">

       <!-- 1행: 심폐기능(2fr) / 신체움직임(1fr) -->
       <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;">
         <!-- 심폐기능 -->
         <div style="padding:7px;background:#F5FBF5;border-radius:6px;border:1px solid #C8E6C9;">
           <div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-bottom:4px;">심폐기능지수 (VO2peak)</div>
           ${master.cardioScore!=null?`
           ${(()=>{
             const isMale=c.gender==='남자';
             const gradeOrder=[{l:'최하위',c:'#C62828',min:0},{l:'평균이하',c:'#E65100',min:isMale?25:19},{l:'평균',c:'#F57F17',min:isMale?29:22},{l:'평균이상',c:'#388E3C',min:isMale?32:25},{l:'우수',c:'#2E7D32',min:isMale?36:29},{l:'최우수',c:'#1B5E20',min:isMale?40:33}];
             const maxV=isMale?44:37;
             const pct=Math.min(100,Math.max(0,(Number(master.cardioScore))/(maxV)*100));
             const matched=getCardioGrade(master.cardioScore,c.gender,c.birthDate);
             const matchedG=gradeOrder.find(g=>g.l===matched);
             return `<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;">
               <span style="font-size:18px;font-weight:800;color:${matchedG?.c||'#2E7D32'};">${master.cardioScore}<span style="font-size:18px;color:#aaa;font-weight:400;"> ml/kg/min</span></span>
               <span style="background:${matchedG?.c||'#888'}22;color:${matchedG?.c||'#888'};padding:2px 6px;border-radius:5px;font-size:18px;font-weight:700;">${matched||''}</span>
             </div>
             <div style="padding:0 20px;">
               <div style="position:relative;height:10px;margin-bottom:1px;">
                 <div style="position:absolute;left:calc(${pct}% - 5px);top:0;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid ${matchedG?.c||'#555'};"></div>
               </div>
               <div style="height:12px;border-radius:4px;overflow:hidden;background:linear-gradient(90deg,#C62828 0%,#E65100 20%,#F57F17 40%,#388E3C 60%,#2E7D32 80%,#1B5E20 100%);"></div>
               <div style="display:flex;justify-content:space-between;margin-top:2px;">
                 ${gradeOrder.map(g=>`<div style="font-size:7px;font-weight:700;color:${g.l===matched?g.c:'#ccc'};text-align:center;flex:1;">${g.l}</div>`).join('')}
               </div>
             </div>
             <div style="margin-top:5px;border-top:1px solid #E8F5E9;padding-top:4px;">
               <div style="font-size:8px;font-weight:700;color:#555;margin-bottom:2px;">${c.birthDate?(new Date().getFullYear()-new Date(c.birthDate).getFullYear()<=65?'60~65세':'66세↑'):''}(${c.gender||''}) 기준</div>
               <div style="display:flex;gap:5px;flex-wrap:wrap;">
                 ${(isMale?[{l:'최우수',c:'#1B5E20',t:'40↑'},{l:'우수',c:'#2E7D32',t:'36~39'},{l:'평균이상',c:'#388E3C',t:'32~35'},{l:'평균',c:'#F57F17',t:'29~31'},{l:'평균이하',c:'#E65100',t:'25~28'},{l:'최하위',c:'#C62828',t:'25↓'}]:[{l:'최우수',c:'#1B5E20',t:'33↑'},{l:'우수',c:'#2E7D32',t:'29~32'},{l:'평균이상',c:'#388E3C',t:'25~28'},{l:'평균',c:'#F57F17',t:'22~24'},{l:'평균이하',c:'#E65100',t:'19~21'},{l:'최하위',c:'#C62828',t:'19↓'}])
                   .map(g=>`<div style="display:flex;align-items:center;gap:2px;"><span style="width:5px;height:5px;border-radius:50%;background:${g.c};"></span><span style="font-size:7px;color:${g.c};font-weight:600;white-space:nowrap;">${g.l} ${g.t}</span></div>`).join('')}
               </div>
             </div>`;
           })()}`:`<div style="font-size:14px;font-weight:800;color:#2E7D32;">${master.cardioScore??'-'}</div>`}
         </div>
         <!-- 신체움직임 -->
         <div style="padding:7px 7px 20px;background:#F5FBF5;border-radius:6px;border:1px solid #C8E6C9;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;">
           <div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-bottom:4px;">신체 움직임 점수</div>
           <div style="display:flex;align-items:baseline;gap:3px;"><span style="font-size:26px;font-weight:900;color:#0288D1;">${master.bodyMovementIndex??'-'}</span><span style="font-size:18px;color:#aaa;">/ 100점</span></div>
           ${master.bodyMovementIndex!=null?`<div style="width:100%;margin-top:5px;">${scoreBar(master.bodyMovementIndex,'#0288D1')}</div>`:''}
         </div>
       </div>

       <!-- 2행: 신경계/균형/감각 -->
       <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;flex:1;align-items:stretch;">
         ${[
           {key:'nervousScore',label:'신경계 점수',color:'#6A1B9A',items:nervItems},
           {key:'balanceScore',label:'통합 균형능력 점수',color:'#00695C',items:balItems},
           {key:'sensoryScore',label:'감각계 점수',color:'#E65100',items:sensItems}
         ].map(item=>{
           const score=master[item.key];
           const pct=Math.min(100,Math.max(0,Number(score)||0));
           const r=36,circ=2*Math.PI*r,dash=(pct/100)*circ;
           return `<div style="padding:7px 8px;background:#F5FBF5;border-radius:6px;border:1px solid #C8E6C9;display:flex;flex-direction:column;align-items:center;overflow:visible;">
              <div style="font-size:20px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">${item.label}</div>
              <div style="font-size:16px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">${item.label}</div>
             <svg width="88" height="88" viewBox="0 0 88 88" style="overflow:visible;margin-bottom:8px;">
               <circle cx="44" cy="44" r="${r}" fill="none" stroke="#E8E8E8" stroke-width="10"/>
               ${pct>0?`<circle cx="44" cy="44" r="${r}" fill="none" stroke="${item.color}" stroke-width="10" stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(circ/4).toFixed(1)}" stroke-linecap="round"/>`:''}
               <text x="44" y="48" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="800" fill="${item.color}">${score!=null?score+'점':'-'}</text>
             </svg>
             <div style="display:flex;justify-content:center;">
                <div style="font-size:18px;color:#444;line-height:1.8;text-align:left;">
                <div style="font-size:12px;color:#444;line-height:1.8;text-align:left;">
                 ${item.items.map(it=>`<div>• ${it.label}</div>`).join('')}
               </div>
             </div>
           </div>`;
         }).join('')}
       </div>
     </div>
   </div>

   <!-- ▣ 대사(생활) 관리 (flex:1) -->
   <div style="border:1.5px solid #FFE0B2;border-radius:8px;overflow:hidden;flex:1;display:flex;flex-direction:column;min-height:0;">
     <div style="background:#E65100;padding:6px 12px;flex-shrink:0;">
        <span style="font-size:20px;font-weight:900;color:white;">💊 대사(생활) 관리 리포트</span>
        <span style="font-size:16px;font-weight:900;color:white;">💊 대사(생활) 관리 리포트</span>
     </div>
     <div style="padding:8px 12px;background:white;flex:1;overflow:hidden;">
       <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;height:100%;">
         <!-- 체성분 -->
         <div style="padding:7px;background:#FFF8F0;border-radius:6px;border:1px solid #FFE0B2;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;">
            <div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-bottom:4px;">체성분 종합 점수</div>
            <div style="font-size:16px;font-weight:900;color:#1A1A1A;margin-bottom:4px;">체성분 종합 점수</div>
           <div style="display:flex;align-items:baseline;gap:3px;"><span style="font-size:26px;font-weight:900;color:#2E7D32;">${master.bodyCompScore??'-'}</span><span style="font-size:18px;color:#aaa;">/ 100점</span></div>
           ${master.bodyCompScore!=null?`<div style="width:100%;margin-top:5px;">${scoreBar(master.bodyCompScore,'#2E7D32')}</div>`:''}
           <div style="font-size:8px;color:#aaa;margin-top:3px;text-align:center;">※ 근육이 매우 많을 경우 100점을 넘을 수 있습니다.</div>
         </div>
         <!-- 스트레스 (이미지2 참고: 부드러운 그라데이션 + 마커) -->
         <div style="padding:7px;background:#FFF8F0;border-radius:6px;border:1px solid #FFE0B2;display:flex;flex-direction:column;">
            <div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-bottom:10px;">스트레스 점수</div>
            <div style="font-size:16px;font-weight:900;color:#1A1A1A;margin-bottom:10px;">스트레스 점수</div>
           ${master.stressScore!=null?`
           ${(()=>{
             const s = master.stressScore;
             const sg = getStressGrade(s);
             const rptStressGrades = [
               {l:'정상',color:'#2E7D32',bg:'#E8F5E9'},
               {l:'초기',color:'#F57F17',bg:'#FFF8E1'},
               {l:'진행',color:'#E65100',bg:'#FBE9E7'},
               {l:'만성',color:'#C62828',bg:'#FFEBEE'}
             ];
             const rptG = s<35?rptStressGrades[0]:s<45?rptStressGrades[1]:s<60?rptStressGrades[2]:rptStressGrades[3];
             const pct = s<=35?(s/35)*37 : s<=45?37+(s-35)/10*18 : s<=60?55+(s-45)/15*23 : Math.min(100,78+(s-60)/40*22);
             return `<div style="display:flex;flex-direction:column;flex:1;">
               <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                 <span style="font-size:28px;font-weight:900;color:${rptG.color};">${s}점</span>
                 <span style="background:${rptG.bg};color:${rptG.color};padding:3px 10px;border-radius:8px;font-size:20px;font-weight:700;">${sg||''}</span>
               </div>
               <div style="padding:0 20px;">
                 <div style="position:relative;margin-bottom:2px;height:12px;">
                   <div style="position:absolute;left:calc(${pct}% - 6px);top:0;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid ${rptG.color};"></div>
                 </div>
                 <div style="height:22px;border-radius:6px;overflow:hidden;background:linear-gradient(90deg,#4CAF50 0%,#C0CA33 37%,#FFA000 55%,#F44336 78%,#B71C1C 100%);"></div>
                 <div style="display:flex;justify-content:space-between;margin-top:3px;">
                   ${rptStressGrades.map(g2=>`<div style="font-size:8.5px;font-weight:700;color:${g2.l===rptG.l?g2.color:'#aaa'};text-align:center;flex:1;">${g2.l}</div>`).join('')}
                 </div>
               </div>
             </div>`;
           })()}`:`<div style="font-size:20px;color:#aaa;">-</div>`}
         </div>
       </div>
     </div>
   </div>

 </div>
</div>

<!-- ===================== PAGE 3: 추이 ===================== -->
<div style="width:100%;min-height:100vh;height:100vh;padding:16px 28px;box-sizing:border-box;page-break-after:always;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;gap:0;">

 <!-- 헤더 -->
 <div style="border-bottom:2px solid rgba(155,115,75,0.8);padding-bottom:6px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
   <div style="font-size:20px;font-weight:800;color:#1A1A1A;">기간별 지표 변화</div>
    <div style="font-size:18px;color:#aaa;">${c.name} · ${todayStr}</div>
    <div style="font-size:16px;color:#aaa;">${c.name} · ${todayStr}</div>
 </div>

 <!-- 추이 그래프 영역 -->
 <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
 ${(()=>{
   const BR = 'rgba(155,115,75,0.8)';
   const LC = '#9B734B';
   const AC = 'rgba(155,115,75,0.13)';

   const currentRound = master.round;
   const sorted = [...trendMasters].filter(m=>m.round<=currentRound).sort((a,b)=>a.round-b.round);
   if (!sorted.length) return '<div style="color:#aaa;font-size:18px;text-align:center;padding:20px;">데이터 없음</div>';

   const yDef = {
     cogScore:{max:100}, depression:{max:60}, cardioScore:{max:44},
     bodyMovementIndex:{max:100}, balanceScore:{max:100},
     bodyCompScore:{max:100}, stressScore:{max:100}
   };

   const makeChart = (field, label, unit='') => {
     const pts = sorted.map(m=>{const v=Number(m[field]);return isNaN(v)?null:{round:m.round,v};}).filter(Boolean);
     if (!pts.length) return '';

     const isSingle = pts.length===1;
     const axMax = (yDef[field]||{max:100}).max;
     // 상단 여백을 넉넉히 줘서 별/라벨이 카드 밖으로 안 잘리게
     const W=200, H=100, padL=12, padR=12, padT=16, padB=18;
     const innerW = W-padL-padR, innerH = H-padT-padB;
     const xPos = i => isSingle ? padL+innerW/2 : padL + i*(innerW/(pts.length-1));
     const yPos = v => padT + (1-Math.min(1,Math.max(0,v/axMax)))*innerH;

     const latest = pts[pts.length-1]?.v;
     const first  = pts[0]?.v;
     const diff   = pts.length>1 ? Math.round((latest-first)*10)/10 : null;

     // ── 변화 배지: 방향 + 수치 + 상승/하락 문구, 알약 형태로 강조 ──
     const trendColor = diff==null?'#999':diff>0?'#1D6FF2':diff<0?'#E53935':'#888';
     const trendBg    = diff==null?'#F1F1F1':diff>0?'#E8F0FE':diff<0?'#FDECEA':'#F1F1F1';
     const trendIcon  = diff==null?'':diff>0?'▲':diff<0?'▼':'－';
     const trendWord  = diff==null?'':diff>0?'상승':diff<0?'하락':'변화없음';
     const diffBadge  = diff==null?'':
       `<span style="display:inline-block;background:${trendBg};color:${trendColor};font-size:15px;font-weight:800;padding:3px 12px;border-radius:20px;">${trendIcon} ${Math.abs(diff)}${unit} ${trendWord}</span>`;

     // ── SVG: 선/영역만 그림 (텍스트·마커는 비율왜곡 방지 위해 HTML로 분리) ──
     let pathD='', areaD='', svgGraph='';
     pts.forEach((p,i)=>{
       const x=xPos(i), y=yPos(p.v);
       pathD += (i===0?`M${x},${y}`:`L${x},${y}`);
     });
     if (!isSingle) {
       areaD = pathD + ` L${xPos(pts.length-1)},${H-padB} L${xPos(0)},${H-padB} Z`;
       svgGraph += `<path d="${areaD}" fill="${AC}" stroke="none"/>`;
       svgGraph += `<path d="${pathD}" fill="none" stroke="${LC}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
     }
     svgGraph += `<line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="rgba(155,115,75,0.25)" stroke-width="0.8"/>`;

     // ── HTML 오버레이: 점/별 마커 + 값/주차 라벨 → 컨테이너 비율과 무관하게 항상 고정 크기 ──
     let htmlOverlay = '';
     pts.forEach((p,i)=>{
       const xPct = (xPos(i)/W*100).toFixed(2);
       const yPct = (yPos(p.v)/H*100).toFixed(2);
       const isLatest = i===pts.length-1;

       if (isLatest) {
         htmlOverlay += `<div style="position:absolute;left:${xPct}%;top:${yPct}%;transform:translate(-50%,-50%);font-size:18px;line-height:1;color:#F59E0B;text-shadow:0 0 2px rgba(217,119,6,0.6);">★</div>`;
         htmlOverlay += `<span style="position:absolute;left:${xPct}%;top:${yPct}%;transform:translate(-50%,calc(-100% - 12px));font-size:18px;font-weight:800;color:${LC};white-space:nowrap;">${p.v}${unit}</span>`;
       } else {
         htmlOverlay += `<div style="position:absolute;left:${xPct}%;top:${yPct}%;width:7px;height:7px;border-radius:50%;background:${LC};border:1.5px solid white;transform:translate(-50%,-50%);"></div>`;
         htmlOverlay += `<span style="position:absolute;left:${xPct}%;top:${yPct}%;transform:translate(-50%,calc(-100% - 8px));font-size:17px;font-weight:500;color:#999;white-space:nowrap;">${p.v}${unit}</span>`;
       }
       const wLbl = p.round===1 ? '초기' : `${(p.round-1)*4}주`;
       htmlOverlay += `<span style="position:absolute;left:${xPct}%;bottom:2px;transform:translateX(-50%);font-size:12px;color:#bbb;">${wLbl}</span>`;
     });

     return `<div style="display:flex;flex-direction:column;flex:1;min-width:0;padding:10px 20px 8px;border:1px solid ${BR};border-radius:8px;box-sizing:border-box;background:rgba(155,115,75,0.03);">
       <div style="font-size:19px;font-weight:700;color:#3A2A1A;white-space:nowrap;">${label}</div>
       <div style="margin-top:4px;margin-bottom:4px;">${diffBadge}</div>
       <div style="flex:1;min-height:0;position:relative;">
         <svg width="100%" height="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;">${svgGraph}</svg>
         ${htmlOverlay}
       </div>
     </div>`;
   };

   const row = (items) => `
     <div style="display:flex;gap:12px;flex:1;min-height:0;">
       ${items.map(it=>makeChart(it.field,it.label,it.unit||'')).filter(Boolean).join('')}
     </div>`;

   const sec = (label,color,items) => `
     <div style="display:flex;flex-direction:column;flex:1;min-height:0;">
       <div style="font-size:18px;font-weight:800;color:${color};letter-spacing:0.04em;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(155,115,75,0.2);flex-shrink:0;">${label}</div>
       ${row(items)}
     </div>`;

   return `
     <div style="height:100%;display:flex;flex-direction:column;gap:18px;padding:10px 0 6px;">
       ${sec('🧠 인지','#6B4E35',[{field:'cogScore',label:'인지점수',unit:'점'},{field:'depression',label:'우울점수',unit:'점'}])}
       ${sec('🏃 움직임','#6B4E35',[{field:'cardioScore',label:'심폐기능지수',unit:''},{field:'bodyMovementIndex',label:'신체움직임',unit:'점'},{field:'balanceScore',label:'통합균형능력',unit:'점'}])}
       ${sec('💊 대사','#6B4E35',[{field:'bodyCompScore',label:'체성분점수',unit:'점'},{field:'stressScore',label:'스트레스점수',unit:'점'}])}
     </div>`;
 })()}
 </div>

</div>

<!-- ===================== PAGE 4: 전문가 코멘트 ===================== -->
<div style="width:100%;min-height:100vh;height:100vh;padding:16px 28px;box-sizing:border-box;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;">

 <!-- 헤더 -->
 <div style="border-bottom:2px solid rgba(155,115,75,0.8);padding-bottom:6px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;">
   <div style="font-size:20px;font-weight:800;color:#1A1A1A;">전문가 코멘트</div>
   <div style="font-size:18px;color:#aaa;">${c.name} · ${todayStr}</div>
 </div>

 <div style="display:flex;flex-direction:column;gap:14px;flex:1;">

   <div style="border:1px solid rgba(155,115,75,0.8);border-radius:8px;overflow:hidden;flex:1;background:rgba(155,115,75,0.04);">
      <div style="background:rgba(155,115,75,0.12);padding:8px 14px;font-size:20px;font-weight:700;">
      <div style="background:rgba(155,115,75,0.12);padding:8px 14px;font-size:16px;font-weight:700;">
       🧠 인지 전문가 코멘트
     </div>
      <div style="padding:16px;font-size:20px;line-height:1.8;color:#333;">
      <div style="padding:16px;font-size:14px;line-height:1.8;color:#333;">
       ${master.cogComment || '(코멘트 없음)'}
     </div>
   </div>

   <div style="border:1px solid rgba(155,115,75,0.8);border-radius:8px;overflow:hidden;flex:1;background:rgba(155,115,75,0.04);">
      <div style="background:rgba(155,115,75,0.12);padding:8px 14px;font-size:20px;font-weight:700;">
      <div style="background:rgba(155,115,75,0.12);padding:8px 14px;font-size:16px;font-weight:700;">
       🏃 운동 전문가 코멘트
     </div>
      <div style="padding:16px;font-size:20px;line-height:1.8;color:#333;">
      <div style="padding:16px;font-size:14px;line-height:1.8;color:#333;">
       ${master.exComment || '(코멘트 없음)'}
     </div>
   </div>

   <div style="border:1px solid rgba(155,115,75,0.8);border-radius:8px;overflow:hidden;flex:1;background:rgba(155,115,75,0.04);">
      <div style="background:rgba(155,115,75,0.12);padding:8px 14px;font-size:20px;font-weight:700;">
      <div style="background:rgba(155,115,75,0.12);padding:8px 14px;font-size:16px;font-weight:700;">
       💼 케어 매니저 코멘트
     </div>
      <div style="padding:16px;font-size:20px;line-height:1.8;color:#333;">
      <div style="padding:16px;font-size:14px;line-height:1.8;color:#333;">
       ${master.cmComment || '(코멘트 없음)'}
     </div>
   </div>

 </div>

 <div style="text-align:center;margin-top:10px;font-size:18px;color:#aaa;">
   CARE HUB IN HANAM · 케어허브 하남
 </div>

</div>
 `;
},

_printReport: function(master, _unused) {
// 새 창에서 HTML을 직접 생성해 출력 — 현재 화면에 미리보기 없이 바로 프린트 창만 표시
const c = this.client || {};
const weekTitle = master
? (master.round === 1 ? '초기 통합리포트' : `${(master.round-1)*4}주차 통합리포트`)
: '통합 리포트';
const masterList = this._masterListCache || [master];
const reportHtml = this._buildReportHTML(master, masterList);

const win = window.open('', '_blank', 'width=900,height=1200');
if (!win) {
UI.toast('팝업이 차단되었습니다. 주소창 우측 팝업 허용 후 다시 시도해주세요.', 'warning');
return;
}
win.document.open();
win.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
     <title>${weekTitle} - ${c.name||''}</title>
     <style>
       * { box-sizing:border-box; margin:0; padding:0; }
       html, body { width:100%; background:white; color:#2C2C2C; }
       body { font-family:'Noto Sans KR','Malgun Gothic',sans-serif; }
       @page { margin:6mm; size:A4 portrait; }
       @media print {
         body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
         #report-print-area > div {
           page-break-before:always; page-break-after:always;
           page-break-inside:avoid; width:100%; height:100vh; overflow:hidden; display:block;
         }
         #report-print-area > div:first-child { page-break-before:avoid; }
         #report-print-area > div:last-child  { page-break-after:avoid; }
         svg text { font-family:'Noto Sans KR','Malgun Gothic',sans-serif; }
       }
       svg text { font-family:'Noto Sans KR','Malgun Gothic',sans-serif; }
     </style>
   </head><body><div id="report-print-area">${reportHtml}</div>
   <script>window.onload=function(){setTimeout(function(){window.print();window.close();},600);};<\/script>
   </body></html>`);
win.document.close();
},


};
