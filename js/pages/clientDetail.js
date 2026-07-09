// ============================================================
// pages/clientDetail.js - 고객 상세 페이지
// ============================================================

const ClientDetailPage = {
  client: null,
  activeRound: 1,
  activeDetailTab: 'rounds',
  activeReportRound: null,

  // ── 회차별 최신 리포트 1건만 남기기 (재생성 시 중복 레코드 방지) ──
  // 동일 round에 여러 건이 존재하면 reportCreatedAt이 가장 최신인 것만 사용
  _dedupeMasterList: function(masterList) {
    if (!Array.isArray(masterList)) return [];
    const byRound = {};
    masterList.forEach(m => {
      const existing = byRound[m.round];
      if (!existing) { byRound[m.round] = m; return; }
      const t  = new Date(m.reportCreatedAt || 0).getTime();
      const te = new Date(existing.reportCreatedAt || 0).getTime();
      if (t >= te) byRound[m.round] = m;
    });
    return Object.values(byRound);
  },

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

  // ══════════════════════════════════════════════════════════
  // 회차별 평가 결과 탭 — Assessment(AssessVisuals) 컴포넌트를
  // 그대로 재사용하는 "읽기 전용" 렌더러
  // ══════════════════════════════════════════════════════════
  _renderRoundContent: function(el, data) {
    const round = this.activeRound;
    const master = data?.master;
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

    // ── 코멘트 카드 (우측 25%) ──
    const commentCard = (icon, title, text) => `
      <div style="height:100%;min-height:140px;display:flex;flex-direction:column;padding:16px;border-radius:8px;background:#ffffff;border:1px solid #e5e7eb;box-sizing:border-box;">
        <div style="font-size:18px;font-weight:700;color:var(--color-gray-600);margin-bottom:8px;flex-shrink:0;">${icon} ${title}</div>
        <div style="font-size:18px;line-height:1.6;color:${text?'var(--color-gray-700)':'var(--color-gray-400)'};white-space:pre-wrap;flex:1;overflow:visible;">${text || '등록된 코멘트가 없습니다.'}</div>
      </div>`;

    // ── 평가항목 카드 (label / 시각화 / 등급배지 / 범례) ──
    // vizHtml, gradeBadge, legendHtml 은 모두 AssessVisuals가 생성한 조각을 그대로 삽입한다.
    const itemCard = (label, vizHtml, gradeBadge, legendHtml) => `
      <div style="flex:1 1 180px;min-width:160px;display:flex;flex-direction:column;align-items:center;padding:18px 14px;border-radius:10px;background:#ffffff;border:1px solid #e5e7eb;box-sizing:border-box;">
        <div style="font-size:20px;font-weight:700;color:var(--color-gray-600);margin-bottom:14px;align-self:flex-start;">${label}</div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;">${vizHtml || '<span style="font-size:20px;color:var(--color-gray-300);">데이터 없음</span>'}</div>
        ${gradeBadge ? `<div style="margin-top:12px;">${gradeBadge}</div>` : ''}
        ${legendHtml ? `<div style="width:100%;">${legendHtml}</div>` : ''}
      </div>`;

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

    // 평가일 표시 헬퍼 / 등급→배지 변환은 AssessVisuals가 제공하는 것을 그대로 사용
    const dateTag = (d) => d ? `<span style="font-size:18px;font-weight:400;color:var(--color-gray-400);margin-left:6px;">[평가일: ${d}]</span>` : '';
    const cogDate  = cog?.measureDate||'';
    const moveDate = [ergo?.measureDate,evx?.measureDate,fra?.measureDate].filter(Boolean).sort().pop()||'';
    const metaDate = [inb?.measureDate,str?.measureDate].filter(Boolean).sort().pop()||'';

    // FRA 기준 항목명 (StandardsCache — 없으면 기본값)
    const nervItems = (typeof StandardsCache!=='undefined'&&StandardsCache.get('inbodyFra_nervous'))||
      [{label:'신경계 평가'},{label:'반응시간 평가'},{label:'자세유지시간 평가'}];
    const balItems  = (typeof StandardsCache!=='undefined'&&StandardsCache.get('inbodyFra_balance'))||
      [{label:'통합 균형 능력 평가'},{label:'빠르게 무게중심 옮기기'},{label:'과녁 따라 무게중심'}];
    const sensItems = (typeof StandardsCache!=='undefined'&&StandardsCache.get('inbodyFra_sensory'))||
      [{label:'감각계 평가'},{label:'체성감각 평가'},{label:'시각 평가'},{label:'전정감각 평가'}];

    // ── 인지평가 Grid: AssessVisuals 컴포넌트 그대로 사용 (Assessment와 픽셀 단위 동일) ──
    const spatialGrade = AssessVisuals.calcCogSubGrade(cog?.spatial);
    const memoryGrade  = AssessVisuals.calcCogSubGrade(cog?.memory);
    const depGrade     = AssessVisuals.calcDepressionGrade(cog?.depression);

    const cogGridHtml = !cog ? '' : [
      itemCard('인지점수', AssessVisuals.cogScoreBlock(cog.cogScore), null, null),
      itemCard('동연령대 상위 분포도', AssessVisuals.percentileDistribution(cog.agePercentile), null, null),
      itemCard('시공간능력',
        AssessVisuals.conicDonut(cog.spatial, AssessVisuals.subGradeColor(cog.spatial), 100, 100, 14),
        AssessVisuals.gradeBadge(spatialGrade), AssessVisuals.subGradeLegendRow()),
      itemCard('기억력',
        AssessVisuals.conicDonut(cog.memory, AssessVisuals.subGradeColor(cog.memory), 100, 100, 14),
        AssessVisuals.gradeBadge(memoryGrade), AssessVisuals.subGradeLegendRow()),
      itemCard('우울점수',
        AssessVisuals.conicDonut(cog.depression, depGrade?.color||'#7B1FA2', 60, 90, 12),
        AssessVisuals.gradeBadge(depGrade), AssessVisuals.depressionLegendRow()),
      itemCard('치매위험요인', AssessVisuals.dementiaDisplay(cog.dementiaRisk), null, null),
    ].join('');

    // ── 움직임평가 Grid: AssessVisuals 컴포넌트 그대로 사용 ──
    const moveGridHtml = !(ergo||evx||fra) ? '' : [
      itemCard('심폐기능지수',
        ergo?.cardioScore!=null ? AssessVisuals.cardioSegGauge(ergo.cardioScore, this.client?.gender, this.client?.birthDate) : '',
        null,
        ergo?.cardioScore!=null ? AssessVisuals.cardioGradeTable(ergo.cardioScore, this.client?.gender, this.client?.birthDate) : null),
      itemCard('신체움직임점수', AssessVisuals.plainScoreOutOf100(evx?.bodyMovementIndex,'#0288D1'), null, null),
      itemCard('신경계',       AssessVisuals.fraItemBlock(fra?.nervousScore,'#6A1B9A',nervItems), null, null),
      itemCard('통합균형능력', AssessVisuals.fraItemBlock(fra?.balanceScore,'#00695C',balItems), null, null),
      itemCard('감각계',       AssessVisuals.fraItemBlock(fra?.sensoryScore,'#E65100',sensItems), null, null),
    ].join('');

    // ── 대사평가 Grid: AssessVisuals 컴포넌트 그대로 사용 ──
    const metaGridHtml = !(inb||str) ? '' : [
      itemCard('체성분점수', AssessVisuals.plainScoreOutOf100(inb?.bodyCompScore,'#2E7D32'), null,
        inb?.bodyCompScore!=null ? '<div style="font-size:10px;color:var(--color-gray-400);margin-top:8px;text-align:center;">※ 근육이 매우 많을 경우 100점이 넘을 수 있습니다.</div>' : null),
      itemCard('스트레스점수', AssessVisuals.stressSegGauge(str?.stressScore), null, null),
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
    // ══════════════════════════════════════════════════════════
    // 통합 리포트(PDF) — 병원/건강검진센터 스타일 디자인 시스템
    // 데이터/계산식/등급/상태값은 기존 로직(AssessVisuals, 로컬 임계값)을
    // 그대로 사용하며, 레이아웃·타이포그래피·시각화 스타일만 새로 설계함.
    // ══════════════════════════════════════════════════════════
    const c   = this.client;
    const logoSrc = document.getElementById('logo-data')?.value || '';
    const age = c.birthDate ? (new Date().getFullYear() - new Date(c.birthDate).getFullYear()) : '-';
    const weekEvalLabel = (n) => n===1 ? '초기' : `${(n-1)*4}주차`;
    const today = new Date();
    const pad2  = n => String(n).padStart(2,'0');
    const todayStr = `${today.getFullYear()}.${pad2(today.getMonth()+1)}.${pad2(today.getDate())}`;
    const trendMasters = allMasterList || [master];

    const nervItems = (typeof StandardsCache!=='undefined'&&StandardsCache.get('inbodyFra_nervous'))||
      [{label:'신경계 평가'},{label:'반응시간 평가'},{label:'자세유지시간 평가'}];
    const balItems  = (typeof StandardsCache!=='undefined'&&StandardsCache.get('inbodyFra_balance'))||
      [{label:'통합 균형 능력 평가'},{label:'빠르게 무게중심 옮기기'},{label:'과녁 따라 무게중심'}];
    const sensItems = (typeof StandardsCache!=='undefined'&&StandardsCache.get('inbodyFra_sensory'))||
      [{label:'감각계 평가'},{label:'체성감각 평가'},{label:'시각 평가'},{label:'전정감각 평가'}];

    // ── 디자인 토큰: 브랜드 브라운 + 뉴트럴 (등급색은 상태 표시에만 한정 사용) ──
    const BR      = '#9B734B';
    const BR_DARK = '#6B4E35';
    const INK     = '#221D17';
    const G500    = '#8B8377';
    const G300    = '#CDC5B8';
    const CREAM   = '#FBF9F5';
    const CREAM2  = '#F2ECE2';
    const LINE    = '#E6DCCB';

    const reportNo = `${c.clientId||'-'}-R${String(master.round).padStart(2,'0')}-${today.getFullYear()}${pad2(today.getMonth()+1)}${pad2(today.getDate())}`;
    const cardioMax = c.gender==='남자' ? 44 : 37;

    // ── 등급 구간(기존 계산식과 동일한 임계값을 시각 구간으로 매핑, 색상만 저채도로 재구성) ──
    const zonesCog      = [{to:64,color:'#C0392B'},{to:79,color:'#C99A2E'},{to:89,color:'#4C8C4A'},{to:100,color:'#2E6B2E'}];
    const zonesSub      = [{to:33,color:'#C0392B'},{to:66,color:'#C99A2E'},{to:100,color:'#4C8C4A'}];
    const zonesDep      = [{to:20,color:'#4C8C4A'},{to:24,color:'#C99A2E'},{to:60,color:'#C0392B'}];
    const zonesDementia = [{to:29,color:'#4C8C4A'},{to:59,color:'#C99A2E'},{to:100,color:'#C0392B'}];
    const zonesStress   = AssessVisuals._stressGrades().map(z=>({to:Math.min(z.max,100), color:z.color}));
    const zonesCardio   = (()=>{
      const gs = AssessVisuals._cardioGrades(c.gender); // 최하위→최우수
      return gs.map((g,i)=>({ to: i<gs.length-1 ? gs[i+1].min : cardioMax, color:g.color }));
    })();

    // ── 공통 컴포넌트 ──────────────────────────────────────────
    const statusPill = (grade) => {
      if (!grade) return '';
      const label = grade.label || grade.l;
      const color = grade.color || grade.c;
      const bg    = grade.bg || grade.b || (color+'1A');
      return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;">${label}</span>`;
    };

    // 구간형 레인지 바(검진 리포트의 "기준범위" 막대 스타일) — 값의 위치를 점으로 표시
    const rangeBar = (score, max, zones) => {
      const pct = score!=null ? Math.min(100, Math.max(0,(Number(score)/max)*100)) : null;
      let segs = '', prev = 0;
      zones.forEach(z=>{
        const zPct = Math.min(100,(z.to/max)*100);
        segs += `<div style="position:absolute;left:${prev}%;width:${Math.max(0,zPct-prev)}%;top:0;bottom:0;background:${z.color};opacity:0.5;"></div>`;
        prev = zPct;
      });
      return `<div style="position:relative;padding-top:11px;">
        ${pct!=null?`<div style="position:absolute;left:calc(${pct}% - 5px);top:0;width:10px;height:10px;border-radius:50%;background:${INK};border:2px solid #fff;box-shadow:0 0 0 1px ${G300};"></div>`:''}
        <div style="position:relative;height:7px;border-radius:4px;overflow:hidden;background:${CREAM2};">${segs}</div>
      </div>`;
    };
    // 등급 개념이 없는 지표(신체움직임/체성분/신경계/균형/감각)용 단색 진행 막대
    const plainBar = (score, max, color) => {
      max = max||100; color = color||BR;
      const pct = score!=null ? Math.min(100,Math.max(0,(Number(score)/max)*100)) : 0;
      return `<div style="height:7px;border-radius:4px;overflow:hidden;background:${CREAM2};margin-top:2px;">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;"></div>
      </div>`;
    };

    // 지표 타일(Hero Metric Tile) — 상태 → 값 → 등급 → 시각화 → 설명 순으로 시선 유도
    const tile = (opts) => {
      const { label, value, unit, grade, visual, caption } = opts;
      return `<div style="background:#fff;border:1px solid ${LINE};border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:7px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
          <span style="font-size:10px;font-weight:700;letter-spacing:0.04em;color:${G500};text-transform:uppercase;">${label}</span>
          ${statusPill(grade)}
        </div>
        <div style="display:flex;align-items:baseline;gap:4px;">
          <span style="font-size:26px;font-weight:800;color:${INK};line-height:1;">${value}</span>
          ${unit?`<span style="font-size:10.5px;color:${G500};">${unit}</span>`:''}
        </div>
        ${visual?`<div>${visual}</div>`:''}
        ${caption?`<div style="font-size:8.5px;color:${G500};border-top:1px solid ${CREAM2};padding-top:6px;line-height:1.4;">${caption}</div>`:''}
      </div>`;
    };

    const sectionHead = (icon, title) => `
      <div style="display:flex;align-items:center;gap:8px;margin:16px 0 8px;">
        <div style="width:22px;height:22px;border-radius:6px;background:${CREAM2};display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">${icon}</div>
        <div style="font-size:13.5px;font-weight:800;color:${INK};">${title}</div>
        <div style="flex:1;height:1px;background:${LINE};"></div>
      </div>`;

    const pageHeader = (titleMain, pageIdx) => `
      <div style="display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:10px;margin-bottom:2px;border-bottom:2px solid ${BR};">
        <div>
          <div style="font-size:9px;font-weight:700;letter-spacing:0.15em;color:${BR};text-transform:uppercase;margin-bottom:3px;">CARE HUB · INTEGRATED HEALTH REPORT</div>
          <div style="font-size:19px;font-weight:800;color:${INK};">${titleMain}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;font-weight:700;color:${INK};">${c.name} <span style="font-weight:400;color:${G500};font-size:10.5px;">${age}세 · ${c.gender||'-'}</span></div>
          <div style="font-size:9.5px;color:${G500};margin-top:2px;">${todayStr} 발행 · PAGE ${pageIdx}/4</div>
        </div>
      </div>`;

    const pageFooter = () => `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:8px;border-top:1px solid ${LINE};">
        <div style="font-size:8.5px;color:${G500};letter-spacing:0.03em;">CARE HUB IN HANAM · 케어허브 하남</div>
        <div style="font-size:8.5px;color:${G300};">REPORT NO. ${reportNo}</div>
      </div>`;

    // 동연령대 상위 분포도(리포트 전용 슬림 히스토그램)
    const percentileMini = (p) => {
      if (p==null) return `<div style="font-size:10px;color:${G500};padding-top:4px;">데이터 없음</div>`;
      const heights=[9,14,20,26,20,14,9];
      const barW=8,gap=3,n=heights.length,totalW=n*barW+(n-1)*gap,maxH=Math.max(...heights);
      const idx=Math.min(n-1,Math.max(0,Math.round((100-p)/100*(n-1))));
      let bars='';
      heights.forEach((h,i)=>{ bars+=`<rect x="${i*(barW+gap)}" y="${maxH-h}" width="${barW}" height="${h}" rx="2" fill="${i===idx?BR:CREAM2}"/>`; });
      return `<svg width="${totalW}" height="${maxH}" viewBox="0 0 ${totalW} ${maxH}" style="margin-top:2px;">${bars}</svg>`;
    };
    const fraCaption = (items) => (items||[]).slice(0,2).map(it=>it.label).join(' · ') + (items&&items.length>2?' 등':'');

    // ── 기간별 지표 변화(대형 카드) — 최대 7회(초기~24주) 데이터를 겹침 없이 표시 ──
    const bigTrendChart = (field, label, unit, max) => {
      const currentRound = master.round;
      const sorted = [...trendMasters].filter(m=>m.round<=currentRound && m.reportGenerated).sort((a,b)=>a.round-b.round);
      const pts = sorted.map(m=>{ const v=Number(m[field]); return isNaN(v)?null:{round:m.round, v}; }).filter(Boolean);
      if (!pts.length) return `<div style="padding:26px 0;text-align:center;color:${G500};font-size:11px;">데이터 없음</div>`;

      const latest = pts[pts.length-1].v;
      const first  = pts[0].v;
      const diff   = pts.length>1 ? Math.round((latest-first)*10)/10 : null;
      const isSingle = pts.length===1;

      const changeBadge = diff==null
        ? `<span style="font-size:9.5px;color:${G500};">변화없음</span>`
        : diff>0
          ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#EAF1FB;color:#1D5FC4;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;white-space:nowrap;">▲ ${Math.abs(diff)}${unit} 상승</span>`
          : diff<0
            ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#FBEAEA;color:#C0392B;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;white-space:nowrap;">▼ ${Math.abs(diff)}${unit} 하락</span>`
            : `<span style="font-size:9.5px;color:${G500};">변화없음</span>`;

      const W=300, H=112, padL=26, padR=10, padT=14, padB=20;
      const innerW=W-padL-padR, innerH=H-padT-padB;
      const xPos = i => isSingle ? padL+innerW/2 : padL + i*(innerW/(pts.length-1));
      const yPos = v => padT + (1-Math.min(1,Math.max(0,v/max)))*innerH;

      let gridLines='';
      [0,0.5,1].forEach(f=>{
        const y = padT + (1-f)*innerH;
        gridLines += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${LINE}" stroke-width="1"/>
          <text x="${padL-4}" y="${y+3}" text-anchor="end" font-size="7.5" fill="${G500}">${Math.round(max*f)}</text>`;
      });

      let pathD='', areaD='';
      pts.forEach((p,i)=>{ const x=xPos(i), y=yPos(p.v); pathD += (i===0?`M${x},${y}`:`L${x},${y}`); });
      if (!isSingle) areaD = pathD + ` L${xPos(pts.length-1)},${H-padB} L${xPos(0)},${H-padB} Z`;

      let overlay='';
      pts.forEach((p,i)=>{
        const xPct=(xPos(i)/W*100).toFixed(2), yPct=(yPos(p.v)/H*100).toFixed(2);
        const isLatest = i===pts.length-1;
        if (isLatest) {
          overlay += `<div style="position:absolute;left:${xPct}%;top:${yPct}%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:${BR};border:2.5px solid #fff;box-shadow:0 0 0 1px ${BR};"></div>`;
          overlay += `<span style="position:absolute;left:${xPct}%;top:${yPct}%;transform:translate(-50%,calc(-100% - 9px));font-size:11px;font-weight:800;color:${BR_DARK};white-space:nowrap;">${p.v}${unit}</span>`;
        } else {
          overlay += `<div style="position:absolute;left:${xPct}%;top:${yPct}%;width:6px;height:6px;border-radius:50%;background:${G300};border:1.5px solid #fff;transform:translate(-50%,-50%);"></div>`;
        }
        const wLbl = p.round===1?'초기':`${(p.round-1)*4}주`;
        overlay += `<span style="position:absolute;left:${xPct}%;bottom:1px;transform:translateX(-50%);font-size:8px;color:${G500};">${wLbl}</span>`;
      });

      return `
        <div style="display:flex;align-items:flex-end;justify-content:space-between;">
          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:0.04em;color:${G500};text-transform:uppercase;margin-bottom:3px;">${label}</div>
            <div style="display:flex;align-items:baseline;gap:4px;">
              <span style="font-size:26px;font-weight:800;color:${INK};line-height:1;">${latest}</span>
              <span style="font-size:10.5px;color:${G500};">${unit}</span>
            </div>
          </div>
          ${changeBadge}
        </div>
        <div style="position:relative;margin-top:8px;">
          <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;">
            ${gridLines}
            ${!isSingle?`<path d="${areaD}" fill="${BR}14" stroke="none"/>`:''}
            ${!isSingle?`<path d="${pathD}" fill="none" stroke="${BR}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`:''}
          </svg>
          ${overlay}
        </div>
        <div style="font-size:8.5px;color:${G500};border-top:1px solid ${CREAM2};padding-top:5px;margin-top:6px;">초기~${weekEvalLabel(master.round)} · 총 ${pts.length}회 측정</div>`;
    };
    const trendCard = (field,label,unit,max) => `<div style="background:#fff;border:1px solid ${LINE};border-radius:10px;padding:13px 15px;">${bigTrendChart(field,label,unit,max)}</div>`;

    return `
<!-- ===================== PAGE 1: 표지 ===================== -->
<div style="width:100%;min-height:1050px;position:relative;display:flex;flex-direction:column;justify-content:space-between;padding:68px 60px;box-sizing:border-box;page-break-after:always;background:#fff;">

  <div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:34px;">
      <span style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${G500};border:1px solid ${LINE};padding:4px 10px;border-radius:20px;">CONFIDENTIAL · 개인 건강정보</span>
    </div>
    <div style="text-align:center;">
      ${logoSrc?`<img src="${logoSrc}" alt="Care Hub" style="max-width:170px;height:auto;object-fit:contain;">`:`<div style="font-size:17px;font-weight:800;letter-spacing:0.15em;color:${BR};">CARE HUB IN HANAM</div>`}
    </div>
  </div>

  <div style="text-align:center;">
    <div style="font-size:11px;letter-spacing:0.3em;color:${BR};font-weight:700;margin-bottom:18px;text-transform:uppercase;">Integrated Health Report</div>
    <div style="position:relative;display:inline-block;padding:12px 36px;">
      <span style="position:absolute;top:0;left:0;width:14px;height:14px;border-top:2px solid ${BR};border-left:2px solid ${BR};"></span>
      <span style="position:absolute;top:0;right:0;width:14px;height:14px;border-top:2px solid ${BR};border-right:2px solid ${BR};"></span>
      <span style="position:absolute;bottom:0;left:0;width:14px;height:14px;border-bottom:2px solid ${BR};border-left:2px solid ${BR};"></span>
      <span style="position:absolute;bottom:0;right:0;width:14px;height:14px;border-bottom:2px solid ${BR};border-right:2px solid ${BR};"></span>
      <div style="font-size:42px;font-weight:800;color:${INK};letter-spacing:-0.01em;">통합 건강 리포트</div>
    </div>
    <div style="width:44px;height:2px;background:${BR};margin:24px auto 20px;"></div>
    <div style="font-size:23px;font-weight:700;color:${INK};">${c.name} 님</div>
    <div style="font-size:12px;color:${G500};margin-top:8px;">귀하의 건강 상태를 종합적으로 안내해 드립니다.</div>
  </div>

  <div>
    <div style="border:1px solid ${LINE};border-radius:12px;padding:20px 24px;background:${CREAM};">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);">
        ${[
          {l:'나이',v:`${age}세`},
          {l:'성별',v:c.gender||'-'},
          {l:'입소 등록일',v:c.firstVisit||'-'},
          {l:'리포트 생성일',v:todayStr},
        ].map((f,i)=>`<div style="padding:0 12px;${i>0?`border-left:1px solid ${LINE};`:''}">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.06em;color:${BR};text-transform:uppercase;margin-bottom:5px;">${f.l}</div>
          <div style="font-size:14px;font-weight:700;color:${INK};">${f.v}</div>
        </div>`).join('')}
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;">
      <div style="font-size:10px;color:${G500};letter-spacing:0.03em;">CARE HUB IN HANAM · 케어허브 하남</div>
      <div style="font-size:10px;color:${G300};">REPORT NO. ${reportNo}</div>
    </div>
    <div style="font-size:8.5px;color:${G300};margin-top:6px;text-align:center;">본 리포트는 CareHub 통합 건강관리 시스템을 통해 자동 생성되었습니다.</div>
  </div>
</div>

<!-- ===================== PAGE 2: 평가 결과 ===================== -->
<div style="width:100%;min-height:100vh;height:100vh;padding:32px 38px 22px;box-sizing:border-box;page-break-after:always;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;background:#fff;">
  ${pageHeader(`${weekEvalLabel(master.round)} 평가 결과`, 2)}

  ${(() => {
    const cogGrade     = AssessVisuals.calcCogIndex(master.cogScore);
    const spatialGrade = AssessVisuals.calcCogSubGrade(master.spatial);
    const memoryGrade  = AssessVisuals.calcCogSubGrade(master.memory);
    const depGrade     = AssessVisuals.calcDepressionGrade(master.depression);
    const demP = master.dementiaRisk!=null ? Math.min(100, Number(master.dementiaRisk)) : null;
    const demGrade = demP==null ? null : (demP>=60?{label:'높음',color:'#C0392B',bg:'#FBEAEA'}:demP>=30?{label:'주의',color:'#C99A2E',bg:'#FBF3DF'}:{label:'낮음',color:'#4C8C4A',bg:'#EAF4EA'});

    return `
    ${sectionHead('🧠','인지 기능 평가')}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;">
      ${tile({ label:'인지 점수', value: master.cogScore!=null?master.cogScore:'-', unit:'점', grade:cogGrade,
        visual: rangeBar(master.cogScore,100,zonesCog), caption:'0~64 주의 · 65~79 개선 · 80~89 양호 · 90~100 최적' })}
      ${tile({ label:'시공간능력', value: master.spatial!=null?master.spatial:'-', unit:'점', grade:spatialGrade,
        visual: rangeBar(master.spatial,100,zonesSub), caption:'0~33 주의 · 34~66 관심 · 67~100 양호' })}
      ${tile({ label:'기억력', value: master.memory!=null?master.memory:'-', unit:'점', grade:memoryGrade,
        visual: rangeBar(master.memory,100,zonesSub), caption:'0~33 주의 · 34~66 관심 · 67~100 양호' })}
      ${tile({ label:'우울 점수', value: master.depression!=null?master.depression:'-', unit:'점', grade:depGrade,
        visual: rangeBar(master.depression,60,zonesDep), caption:'0~20 경도 · 21~24 중등도 · 25~60 높은 수준' })}
      ${tile({ label:'치매 위험요인', value: demP!=null?demP.toFixed(1):'-', unit:'%', grade:demGrade,
        visual: demP!=null?rangeBar(demP,100,zonesDementia):'', caption:'0~29 낮음 · 30~59 주의 · 60~100 높음' })}
      ${tile({ label:'동연령대 상위 분포', value: master.agePercentile!=null?master.agePercentile:'-', unit: master.agePercentile!=null?'%':'', grade:null,
        visual: percentileMini(master.agePercentile), caption:'동일 연령대 대비 상대적 위치' })}
    </div>`;
  })()}

  ${(() => {
    const cardioIdx = AssessVisuals.calcCardioIndex(master.cardioScore, c.gender, c.birthDate);
    const cardioGrade = (() => {
      if (!cardioIdx) return null;
      const m = AssessVisuals._cardioGrades(c.gender).find(g=>cardioIdx.includes(g.l));
      return m ? {label:cardioIdx, color:m.color, bg:m.color+'1A'} : null;
    })();
    return `
    ${sectionHead('🏃','움직임 기능 평가')}
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:9px;margin-bottom:9px;">
      ${tile({ label:'심폐기능지수 (VO2peak)', value: master.cardioScore!=null?master.cardioScore:'-', unit:'ml/kg/min', grade:cardioGrade,
        visual: master.cardioScore!=null?rangeBar(master.cardioScore,cardioMax,zonesCardio):'',
        caption: c.birthDate?`${c.gender||'-'} · ${age>=66?'66세 이상':'60~65세'} 기준값 적용`:'기준값 정보 없음' })}
      ${tile({ label:'신체 움직임 점수', value: master.bodyMovementIndex!=null?master.bodyMovementIndex:'-', unit:'/100', grade:null,
        visual: plainBar(master.bodyMovementIndex,100,BR), caption:'움직임 종합 활동량 지표' })}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;">
      ${[
        {key:'nervousScore', label:'신경계 점수', items:nervItems},
        {key:'balanceScore', label:'통합 균형능력', items:balItems},
        {key:'sensoryScore', label:'감각계 점수', items:sensItems}
      ].map(it => tile({ label:it.label, value: master[it.key]!=null?master[it.key]:'-', unit:'/100', grade:null,
        visual: plainBar(master[it.key],100,BR), caption: fraCaption(it.items) })).join('')}
    </div>`;
  })()}

  ${sectionHead('💊','대사 · 생활 평가')}
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px;">
    ${tile({ label:'체성분 종합 점수', value: master.bodyCompScore!=null?master.bodyCompScore:'-', unit:'/100', grade:null,
      visual: plainBar(master.bodyCompScore,100,BR), caption:'근육량이 많을 경우 100점을 초과할 수 있습니다.' })}
    ${(() => {
      const sGrade = AssessVisuals.calcStressIndex(master.stressScore);
      return tile({ label:'스트레스 점수', value: master.stressScore!=null?master.stressScore:'-', unit:'점', grade:sGrade,
        visual: master.stressScore!=null?rangeBar(master.stressScore,100,zonesStress):'', caption:'정상 · 초기 · 진행 · 만성 4단계 평가' });
    })()}
  </div>

  ${pageFooter()}
</div>

<!-- ===================== PAGE 3: 기간별 지표 변화 ===================== -->
<div style="width:100%;min-height:100vh;height:100vh;padding:32px 38px 22px;box-sizing:border-box;page-break-after:always;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;background:#fff;">
  ${pageHeader('기간별 지표 변화', 3)}

  ${sectionHead('🧠','인지')}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">
    ${trendCard('cogScore','인지점수','점',100)}
    ${trendCard('depression','우울점수','점',60)}
  </div>

  ${sectionHead('🏃','움직임')}
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:11px;margin-bottom:9px;">
    ${trendCard('cardioScore','심폐기능지수','',cardioMax)}
    ${trendCard('bodyMovementIndex','신체움직임','점',100)}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">
    ${trendCard('balanceScore','통합균형능력','점',100)}
    ${trendCard('sensoryScore','감각계점수','점',100)}
  </div>

  ${sectionHead('💊','대사')}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">
    ${trendCard('bodyCompScore','체성분점수','점',100)}
    ${trendCard('stressScore','스트레스점수','점',100)}
  </div>

  ${pageFooter()}
</div>

<!-- ===================== PAGE 4: 전문가 코멘트 ===================== -->
<div style="width:100%;min-height:100vh;height:100vh;padding:32px 38px 22px;box-sizing:border-box;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;background:#fff;">
  ${pageHeader('전문가 소견', 4)}

  <div style="display:flex;flex-direction:column;gap:14px;flex:1;margin-top:10px;">
    ${[
      {n:'01', icon:'🧠', role:'인지 전문가 소견', text:master.cogComment},
      {n:'02', icon:'🏃', role:'운동 전문가 소견', text:master.exComment},
      {n:'03', icon:'💼', role:'케어 매니저 소견', text:master.cmComment}
    ].map(item => `
      <div style="position:relative;border:1px solid ${LINE};border-radius:10px;padding:18px 22px 18px 60px;background:${CREAM};flex:1;display:flex;flex-direction:column;overflow:hidden;">
        <div style="position:absolute;left:14px;top:14px;font-size:30px;font-weight:800;color:${LINE};line-height:1;">${item.n}</div>
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:9px;">
          <span style="font-size:14px;">${item.icon}</span>
          <span style="font-size:12.5px;font-weight:800;color:${BR_DARK};">${item.role}</span>
        </div>
        <div style="font-size:12.5px;line-height:1.85;color:${item.text?INK:G500};${item.text?'':'font-style:italic;'}white-space:pre-wrap;">${item.text || '작성된 소견이 없습니다.'}</div>
      </div>`).join('')}
  </div>

  ${pageFooter()}
</div>
  `;
  },

  _printReport: function(master, _unused) {
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
