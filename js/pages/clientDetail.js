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
    // 통합 리포트(PDF) v5 — 카테고리 박스(흰배경+#F2ECE2 테두리),
    // 원형차트 내부 값 표기+하단 상태 배지, 심폐/스트레스 그라데이션 복원,
    // 범례 "라벨(색상) : 범위(#8B8377)", 기간별 지표 변화는 표+인라인 꺾은선.
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

    // ── 디자인 토큰 ──────────────────────────────────────────
    const BR      = '#9B734B';
    const BR_DARK = '#6B4E35';
    const INK     = '#221D17';
    const G500    = '#8B8377'; // 범례 값 범위 전용 색
    const G300    = '#CDC5B8';
    const CREAM   = '#FBF9F5';
    const CREAM2  = '#F2ECE2'; // 카테고리 박스 테두리 & 모노 차트 트랙
    const LINE    = '#E6DCCB';

    const reportNo  = `${c.clientId||'-'}-R${String(master.round).padStart(2,'0')}-${today.getFullYear()}${pad2(today.getMonth()+1)}${pad2(today.getDate())}`;
    const cardioMax = c.gender==='남자' ? 44 : 37;

    const valColor = (grade) => grade ? (grade.color||grade.c) : INK;

    // 상태 배지(동그란 박스 안에 상태값)
    const statusPill = (grade) => {
      if (!grade) return '';
      const label = grade.label || grade.l;
      const color = grade.color || grade.c;
      const bg    = grade.bg || grade.b || (color+'1A');
      return `<span style="display:inline-block;background:${bg};color:${color};font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap;">${label}</span>`;
    };
    // 원형/반원 차트 아래 상태 배지 배치
    const chartWithPill = (chartHtml, grade) => `<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
      ${chartHtml}
      ${grade?statusPill(grade):''}
    </div>`;

    const respSvg = (svg) => svg.replace(/<svg width="\d+" height="\d+"/, '<svg width="100%" height="auto"');

    // 인바디 스타일 가로 행(신경계·균형·감각 + 시공간·기억력 공용) — 값 색상은 등급색(없으면 검정)
    const ORANGE = '#D9822B'; // 인지기능평가: 개선/중등도/주의/관심 공통 색상
    const mapCogGrade = (grade) => {
      if (!grade) return grade;
      const hit = ['개선','중등도','주의','관심'].some(l => (grade.label||'').includes(l));
      return hit ? {...grade, color:ORANGE} : grade;
    };

    const inbodyRow = (label, score, max, grade, unit) => {
      max = max || 100;
      const pct = score!=null ? Math.min(100,Math.max(0,(Number(score)/max)*100)) : null;
      const fillColor = grade ? grade.color : BR;
      return `<div style="display:flex;align-items:center;gap:12px;padding:6px 0;">
        <div style="width:96px;flex-shrink:0;">
          <div style="font-size:12.5px;font-weight:700;color:${INK};text-transform:uppercase;">${label}</div>
        </div>
        <div style="flex:1;">
          <div style="position:relative;height:11px;background:${CREAM2};border-radius:5px;">
            <div style="position:absolute;left:0;top:0;bottom:0;width:${pct||0}%;background:${fillColor};border-radius:5px;"></div>
            ${pct!=null?`<div style="position:absolute;left:calc(${pct}% - 3px);top:-1px;width:7px;height:7px;border-radius:50%;background:${INK};border:1.5px solid #fff;"></div>`:''}
          </div>
        </div>
        <div style="flex-shrink:0;display:flex;align-items:center;gap:6px;">
          <span style="font-size:16.5px;font-weight:800;color:${valColor(grade)};">${score!=null?score:'-'}</span>${unit?`<span style="font-size:10.5px;color:${G500};">${unit}</span>`:''}
          ${grade?statusPill(grade):''}
        </div>
      </div>`;
    };
    const itemLine = (items) => `<div style="font-size:10px;color:${G500};margin:4px 0 0;">${(items||[]).map(x=>x.label).join(', ')}</div>`;
    // 항목 그룹 타이틀(시공간·기억력 / 인바디 FRA) — 다른 평가항목과 동일한 라벨 스타일
    const groupTitle = (label) => `<div style="font-size:14px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.03em;text-align:left;">${label}</div>`;

    const barFull = (score, max, thickness) => {
      const pct = score!=null ? Math.min(100,Math.max(0,(Number(score)/max)*100)) : 0;
      return `<div style="width:100%;height:${thickness||12}px;background:${CREAM2};border-radius:6px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${BR};border-radius:6px;"></div>
      </div>`;
    };

    // 인바디 FRA 세로형 블록 — 타이틀(상단) → 값 → 막대그래프 → 평가항목(캡션)
    const fraBlock = (label, score, max, items) => `<div style="display:flex;flex-direction:column;gap:5px;">
      <div style="font-size:14px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.03em;text-align:left;">${label}</div>
      <div style="white-space:nowrap;text-align:right;"><span style="font-size:18.5px;font-weight:800;color:${INK};">${score!=null?score:'-'}</span><span style="font-size:10.5px;color:${G500};">점</span></div>
      ${barFull(score,max,12)}
      ${itemLine(items)}
    </div>`;

    // ── 범례: ● 상태명(색상) : 범위(#8B8377) — 1열(세로) / 1행(가로) / 그리드(N열) ──
    const legendCol = (items) => `<div style="display:flex;flex-direction:column;gap:5px;">
      ${items.map(it=>`<div style="display:flex;align-items:center;gap:5px;white-space:nowrap;">
        <span style="width:7px;height:7px;border-radius:50%;background:${it.color};flex-shrink:0;"></span>
        <span style="font-size:10.5px;font-weight:${it.active?'800':'600'};color:${it.color};">${it.label}</span>
        <span style="font-size:10.5px;color:${G500};">: ${it.range}</span>
      </div>`).join('')}
    </div>`;
    const legendRow = (items) => `<div style="display:flex;gap:16px;flex-wrap:wrap;">
      ${items.map(it=>`<div style="display:flex;align-items:center;gap:5px;white-space:nowrap;">
        <span style="width:7px;height:7px;border-radius:50%;background:${it.color};flex-shrink:0;"></span>
        <span style="font-size:10.5px;font-weight:${it.active?'800':'600'};color:${it.color};">${it.label}</span>
        <span style="font-size:10.5px;color:${G500};">: ${it.range}</span>
      </div>`).join('')}
    </div>`;
    const legendGrid = (items, cols) => `<div style="display:grid;grid-template-columns:repeat(${cols||3},1fr);gap:5px 14px;">
      ${items.map(it=>`<div style="display:flex;align-items:center;gap:5px;white-space:nowrap;">
        <span style="width:7px;height:7px;border-radius:50%;background:${it.color};flex-shrink:0;"></span>
        <span style="font-size:10.5px;font-weight:${it.active?'800':'600'};color:${it.color};">${it.label}</span>
        <span style="font-size:10.5px;color:${G500};">: ${it.range}</span>
      </div>`).join('')}
    </div>`;

    // ── 등급별 범례 데이터(기존 계산식 임계값 그대로, 개선·중등도·주의·관심은 주황) ──
    const cogLegendItems = (grade) => [
      {label:'주의',range:'0~64',color:ORANGE},
      {label:'개선',range:'65~79',color:ORANGE},
      {label:'양호',range:'80~89',color:'#4C8C4A'},
      {label:'최적',range:'90~100',color:'#2E6B2E'}
    ].map(it=>({...it, active: grade && grade.label===it.label}));
    const subLegendItems = (grade) => [
      {label:'주의',range:'0~33',color:ORANGE},
      {label:'관심',range:'34~66',color:ORANGE},
      {label:'양호',range:'67~100',color:'#4C8C4A'}
    ].map(it=>({...it, active: grade && grade.label===it.label}));
    const depLegendItems = (grade) => [
      {label:'경도',range:'0~20',color:'#4C8C4A'},
      {label:'중등도',range:'21~24',color:ORANGE},
      {label:'높은수준',range:'25~60',color:'#C0392B'}
    ].map(it=>({...it, active: grade && (grade.label||'').startsWith(it.label)}));
    const demLegendItems = (grade) => [
      {label:'낮음',range:'0~29',color:'#4C8C4A'},
      {label:'주의',range:'30~59',color:ORANGE},
      {label:'높음',range:'60~100',color:'#C0392B'}
    ].map(it=>({...it, active: grade && grade.label===it.label}));

    const cardioLegendItems = (score, gender, birthDate) => {
      const isMale = gender==='남자';
      const age2 = birthDate ? new Date().getFullYear()-new Date(birthDate).getFullYear() : null;
      const isOld = age2!=null && age2>=66;
      const rowsMale = [['최우수','#1B5E20','40.0↑','37.0↑'],['우수','#2E7D32','36.0~39.9','33.0~37.0'],['평균이상','#388E3C','32.0~35.9','29.0~32.9'],['평균','#F57F17','29.0~31.9','26.0~28.9'],['평균이하','#E65100','25.0~28.9','22.0~25.9'],['최하위','#C62828','25.0↓','22.0↓']];
      const rowsFemale = [['최우수','#1B5E20','33.0↑','32.0↑'],['우수','#2E7D32','29.0~32.9','28.0~32.0'],['평균이상','#388E3C','25.0~28.9','25.0~27.9'],['평균','#F57F17','22.0~24.9','22.0~24.9'],['평균이하','#E65100','19.0~21.9','19.0~21.9'],['최하위','#C62828','19.0↓','19.0↓']];
      const rows = isMale?rowsMale:rowsFemale;
      const cardioIdx = AssessVisuals.calcCardioIndex(score, gender, birthDate);
      return rows.map(r=>({label:r[0],color:r[1],range: isOld?r[3]:r[2], active: cardioIdx===r[0]}));
    };
    const stressLegendCol = (score) => {
      const grades = AssessVisuals._stressGrades();

      const current = AssessVisuals.calcStressIndex(score);
      let prev = 0;
      const items = grades.map((g,i)=>{
        const range = i===grades.length-1 ? `${prev}↑` : `${prev}~${g.max}`;
        prev = g.max+1;
        return {label:g.l, range, color:g.color, active: current && current.label===g.l};
      });
      return legendCol(items);
    };

    // 지표 카드(가로 flex: 시각화(값 내장/등급 배지) 좌측 / 범례 우측 1열)
    const metricCell = (label, visualHtml, legendHtml) => `<div style="display:flex;flex-direction:column;gap:6px;min-width:0;">
      <div style="font-size:14px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.03em;text-align:left;">${label}</div>
      <div style="display:flex;align-items:center;justify-content:${legendHtml?'space-between':'flex-start'};gap:12px;${legendHtml?'padding:0 10px;':''}">
        <div style="${legendHtml?'flex-shrink:0;':'flex:1;min-width:0;'}">${visualHtml}</div>
        ${legendHtml?`<div style="flex:1;min-width:0;">${legendHtml}</div>`:''}
      </div>
    </div>`;

    // 섹션 제목(좌측 정렬 + 우측 구분선)
    const sectionHead = (icon, title) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <div style="font-size:17px;font-weight:800;color:${INK};letter-spacing:0.02em;white-space:nowrap;">${icon} ${title}</div>
        <div style="flex:1;height:1px;background:rgba(155,115,75,0.3);"></div>
      </div>`;

    // 카테고리 박스: 배경 흰색 + 테두리 #F2ECE2
    const categoryBox = (headHtml, bodyHtml, extraStyle) => `
      <div style="background:#fff;border:1px solid ${CREAM2};border-radius:10px;padding:16px 18px;margin-bottom:18px;${extraStyle||''}">
        ${headHtml}
        ${bodyHtml}
      </div>`;

    const pageHeader = (titleMain) => `
      <div style="display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:10px;margin-bottom:14px;border-bottom:2px solid ${BR};">
        <div>
          <div style="font-size:10.5px;font-weight:700;letter-spacing:0.15em;color:${BR};text-transform:uppercase;margin-bottom:3px;">CARE HUB · INTEGRATED HEALTH REPORT</div>
          <div style="font-size:21px;font-weight:800;color:${INK};">${titleMain}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:700;color:${INK};">${c.name} <span style="font-weight:400;color:${G500};font-size:12px;">${age}세 · ${c.gender||'-'}</span></div>
          <div style="font-size:11px;color:${G500};margin-top:2px;">${todayStr} 발행</div>
        </div>
      </div>`;

    // 페이지 번호는 하단 중앙에 표기 (req7)
    const pageFooter = (pageIdx, pageTotal) => `
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-top:auto;padding-top:8px;border-top:1px solid ${LINE};">
        <div style="font-size:10px;color:${G500};letter-spacing:0.03em;">CARE HUB IN HANAM · 케어허브 하남</div>
        <div style="text-align:center;font-size:10.5px;font-weight:700;color:${G500};">${pageIdx} / ${pageTotal}</div>
        <div style="text-align:right;font-size:10px;color:${G300};">REPORT NO. ${reportNo}</div>
      </div>`;

    // 동연령대 상위 분포도(모노크롬 히스토그램, 등급 없음 → 값은 검정) — 값/차트 가로 flex 좌우정렬
    const percentileMini = (p) => {
      if (p==null) return `<div style="font-size:11.5px;color:${G500};">데이터 없음</div>`;
      const heights=[14,21,29,38,29,21,14];
      const barW=11,gap=4,n=heights.length,totalW=n*barW+(n-1)*gap,maxH=Math.max(...heights);
      const idx=Math.min(n-1,Math.max(0,Math.round((100-p)/100*(n-1))));
      let bars='';
      heights.forEach((h,i)=>{ bars+=`<rect x="${i*(barW+gap)}" y="${maxH-h}" width="${barW}" height="${h}" rx="2" fill="${i===idx?BR:CREAM2}"/>`; });
      return `<div style="display:flex;align-items:center;justify-content:center;gap:16px;width:100%;">
        <div style="white-space:nowrap;"><span style="font-size:22px;font-weight:800;color:${INK};">상위 ${p}</span><span style="font-size:10.5px;color:${G500};">%</span></div>
        <svg width="${totalW}" height="${maxH}" viewBox="0 0 ${totalW} ${maxH}">${bars}</svg>
      </div>`;
    };

    // ── 기간별 지표 변화: 표 + 행별 인라인 꺾은선(스파크라인), 마지막 행=측정회차 ──
    const trendTableChart = () => {
      const currentRound = master.round;
      const sorted = [...trendMasters].filter(m=>m.round<=currentRound && m.reportGenerated).sort((a,b)=>a.round-b.round);
      const n = sorted.length;
      if (!n) return `<div style="text-align:center;color:${G500};font-size:14px;padding:20px 0;">측정 데이터가 없습니다.</div>`;

      const metrics = [
        {key:'cogScore',     label:'인지점수'},
        {key:'depression',   label:'우울점수'},
        {key:'cardioScore',  label:'심폐기능'},
        {key:'balanceScore', label:'통합균형능력'},
        {key:'bodyCompScore',label:'체성분'},
        {key:'stressScore',  label:'스트레스'}
      ];
      const colTemplate = `140px repeat(${n},1fr) 64px`;

      // 측정회차는 별도 행이 아니라 "평가 항목/변화"와 같은 헤더 행에 표기
      const weekHeadCells = sorted.map((m,i)=>`<div style="grid-column:${i+2};text-align:center;font-size:11px;font-weight:700;color:${G500};">${weekEvalLabel(m.round)}</div>`).join('');
      const headerRow = `<div style="display:grid;grid-template-columns:${colTemplate};align-items:end;padding-bottom:6px;border-bottom:2px solid ${BR};">
        <div style="grid-column:1;font-size:12px;font-weight:700;color:${G500};letter-spacing:0.04em;text-transform:uppercase;">평가 항목</div>
        ${weekHeadCells}
        <div style="grid-column:${n+2};font-size:12px;font-weight:700;color:${G500};letter-spacing:0.04em;text-transform:uppercase;text-align:center;">변화</div>
      </div>`;

      const metricRows = metrics.map(met=>{
        const pts = sorted.map((m,i)=>{ const v=Number(m[met.key]); return isNaN(v)?null:{i,v}; }).filter(Boolean);
        let chartHtml = `<div style="font-size:11.5px;color:${G500};text-align:center;">-</div>`;
        let changeHtml = `<span style="color:${G500};font-size:16px;">-</span>`;
        if (pts.length) {
          const vals = pts.map(p=>p.v);
          const vMin = Math.min(...vals), vMax = Math.max(...vals);
          const range = (vMax-vMin) || 1;
          const H=54, padT=20, padB=14;
          const yPos = v => padT + (1-((v-vMin)/range))*(H-padT-padB);
          const xPct = i => n===1 ? 50 : ((i+0.5)/n*100);
          let pathD='', areaD='';
          pts.forEach((p,idx)=>{ const x=xPct(p.i), y=yPos(p.v); pathD += (idx===0?`M${x},${y}`:`L${x},${y}`); });
          if (pts.length>1) areaD = pathD + ` L${xPct(pts[pts.length-1].i)},${H-padB} L${xPct(pts[0].i)},${H-padB} Z`;
          let overlay = `<svg width="100%" height="${H}" viewBox="0 0 100 ${H}" preserveAspectRatio="none" style="display:block;position:absolute;left:0;top:0;">
            <rect x="0" y="0" width="100" height="${H}" fill="${CREAM2}" opacity="0.4"/>
            <line x1="0" y1="${H-padB}" x2="100" y2="${H-padB}" stroke="${G300}" stroke-width="1" stroke-dasharray="2,2" vector-effect="non-scaling-stroke"/>
            ${pts.length>1?`<path d="${areaD}" fill="${BR}18" stroke="none"/>`:''}
            ${pts.length>1?`<path d="${pathD}" fill="none" stroke="${BR}" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`:''}
          </svg>`;
          pts.forEach((p,idx)=>{
            const xp = xPct(p.i).toFixed(2);
            const yp = yPos(p.v);
            const ypPct = (yp/H*100).toFixed(2);
            const isLatest = idx===pts.length-1;
            overlay += `<div style="position:absolute;left:${xp}%;top:${ypPct}%;width:${isLatest?7:5}px;height:${isLatest?7:5}px;border-radius:50%;background:${BR};border:1px solid #fff;transform:translate(-50%,-50%);"></div>`;
            // 가장 최근 값만 18px로 강조 표기 (req2)
            overlay += `<span style="position:absolute;left:${xp}%;top:${ypPct}%;transform:translate(-50%,calc(-100% - 3px));font-size:${isLatest?'18px':'11px'};font-weight:800;color:${isLatest?BR_DARK:INK};white-space:nowrap;">${p.v}</span>`;
          });
          chartHtml = `<div style="position:relative;height:${H}px;">${overlay}</div>`;

          const first = pts[0].v, last = pts[pts.length-1].v;
          const diff = pts.length>1 ? Math.round((last-first)*10)/10 : null;
          // 값 변화 배지는 16px로 표기 (req2)
          changeHtml = diff==null ? `<span style="color:${G500};font-size:16px;">-</span>`
            : diff>0 ? `<span style="color:#1D5FC4;font-weight:800;font-size:16px;white-space:nowrap;">▲ ${Math.abs(diff)}</span>`
            : diff<0 ? `<span style="color:#C0392B;font-weight:800;font-size:16px;white-space:nowrap;">▼ ${Math.abs(diff)}</span>`
            : `<span style="color:${G500};font-size:14px;">변화없음</span>`;
        }
        // 행 간격 15px (req3)
        return `<div style="display:grid;grid-template-columns:${colTemplate};align-items:center;padding:15px 0;border-bottom:1px solid ${CREAM2};">
          <div style="grid-column:1;font-size:14px;font-weight:700;color:${INK};">${met.label}</div>
          <div style="grid-column:2 / span ${n};">${chartHtml}</div>
          <div style="grid-column:${n+2};text-align:center;">${changeHtml}</div>
        </div>`;
      }).join('');

      return `${headerRow}${metricRows}`;
    };

    return `
<!-- ===================== PAGE 1: 표지 ===================== -->
<div style="width:100%;min-height:1050px;position:relative;display:flex;flex-direction:column;justify-content:space-between;padding:68px 60px;box-sizing:border-box;page-break-after:always;background:#fff;">

  <div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:34px;">
      <span style="font-size:10.5px;font-weight:700;letter-spacing:0.1em;color:${G500};border:1px solid ${LINE};padding:4px 10px;border-radius:20px;">CONFIDENTIAL · 개인 건강정보</span>
    </div>
    <div style="text-align:center;">
      ${logoSrc?`<img src="${logoSrc}" alt="Care Hub" style="max-width:170px;height:auto;object-fit:contain;">`:`<div style="font-size:18.5px;font-weight:800;letter-spacing:0.15em;color:${BR};">CARE HUB IN HANAM</div>`}
    </div>
  </div>

  <div style="text-align:center;">
    <div style="font-size:12.5px;letter-spacing:0.3em;color:${BR};font-weight:700;margin-bottom:18px;text-transform:uppercase;">Integrated Health Report</div>
    <div style="position:relative;display:inline-block;padding:12px 36px;">
      <span style="position:absolute;top:0;left:0;width:14px;height:14px;border-top:2px solid ${BR};border-left:2px solid ${BR};"></span>
      <span style="position:absolute;top:0;right:0;width:14px;height:14px;border-top:2px solid ${BR};border-right:2px solid ${BR};"></span>
      <span style="position:absolute;bottom:0;left:0;width:14px;height:14px;border-bottom:2px solid ${BR};border-left:2px solid ${BR};"></span>
      <span style="position:absolute;bottom:0;right:0;width:14px;height:14px;border-bottom:2px solid ${BR};border-right:2px solid ${BR};"></span>
      <div style="font-size:44px;font-weight:800;color:${INK};letter-spacing:-0.01em;">통합 건강 리포트</div>
    </div>
    <div style="width:44px;height:2px;background:${BR};margin:24px auto 20px;"></div>
    <div style="font-size:25px;font-weight:700;color:${INK};">${c.name} 님</div>
    <div style="font-size:14px;color:${G500};margin-top:8px;">귀하의 건강 상태를 종합적으로 안내해 드립니다.</div>
  </div>

  <div>
    <div style="display:flex;justify-content:center;">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);">
        ${[
          {l:'나이',v:`${age}세`},
          {l:'성별',v:c.gender||'-'},
          {l:'입소 등록일',v:c.firstVisit||'-'},
          {l:'리포트 생성일',v:todayStr},
        ].map((f,i)=>`<div style="padding:0 18px;text-align:center;${i>0?`border-left:1px solid ${LINE};`:''}">
          <div style="font-size:10.5px;font-weight:700;letter-spacing:0.06em;color:${BR};text-transform:uppercase;margin-bottom:5px;">${f.l}</div>
          <div style="font-size:15.5px;font-weight:700;color:${INK};">${f.v}</div>
        </div>`).join('')}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-top:24px;">
      <div style="font-size:11.5px;color:${G500};letter-spacing:0.03em;">CARE HUB IN HANAM · 케어허브 하남</div>
      <div style="text-align:center;font-size:10.5px;font-weight:700;color:${G500};">1 / 4</div>
      <div style="text-align:right;font-size:11.5px;color:${G300};">REPORT NO. ${reportNo}</div>
    </div>
    <div style="font-size:10px;color:${G300};margin-top:6px;text-align:center;">본 리포트는 CareHub 통합 건강관리 시스템을 통해 자동 생성되었습니다.</div>
  </div>
</div>

<!-- ===================== PAGE 2: 평가 결과 ===================== -->
<div style="width:100%;min-height:100vh;padding:30px 36px 20px;box-sizing:border-box;page-break-after:always;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;background:#fff;">
  ${pageHeader(`${weekEvalLabel(master.round)} 평가 결과`)}

  ${(() => {
    const cogGrade     = mapCogGrade(AssessVisuals.calcCogIndex(master.cogScore));
    const spatialGrade = mapCogGrade(AssessVisuals.calcCogSubGrade(master.spatial));
    const memoryGrade  = mapCogGrade(AssessVisuals.calcCogSubGrade(master.memory));
    const depGrade     = mapCogGrade(AssessVisuals.calcDepressionGrade(master.depression));
    const demP = master.dementiaRisk!=null ? Math.min(100, Number(master.dementiaRisk)) : null;
    const demGrade = mapCogGrade(demP==null ? null : (demP>=60?{label:'높음',color:'#C0392B'}:demP>=30?{label:'주의',color:'#C99A2E'}:{label:'낮음',color:'#4C8C4A'}));

    const cogChart = `<div style="max-width:118px;">${respSvg(AssessVisuals.semiGauge(master.cogScore, cogGrade?.color||'#1565C0', 100))}</div>`;
    const depChart = AssessVisuals.conicDonut(master.depression, depGrade?.color||'#7B1FA2', 60, 68, 9);

    const pairBlock = `<div style="display:flex;flex-direction:column;gap:8px;">
      ${groupTitle('시공간능력·기억력')}
      <div style="display:flex;gap:22px;">
        <div style="flex:1;min-width:0;">${inbodyRow('시공간능력', master.spatial, 100, spatialGrade)}</div>
      </div>
      <div style="display:flex;gap:22px;">
        <div style="flex:1;min-width:0;">${inbodyRow('기억력', master.memory, 100, memoryGrade)}</div>
      </div>
      <div style="margin-top:2px;">${legendRow(subLegendItems(spatialGrade||memoryGrade))}</div>
    </div>`;

    return categoryBox(sectionHead('🧠','인지 기능 평가'), `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;column-gap:50px;row-gap:48px;">
        ${metricCell('인지 점수', chartWithPill(cogChart, cogGrade), legendCol(cogLegendItems(cogGrade)))}
        ${metricCell('우울 점수', chartWithPill(depChart, depGrade), legendCol(depLegendItems(depGrade)))}
        ${metricCell('치매 위험요인',
          `<div style="text-align:center;"><div><span style="font-size:26px;font-weight:800;color:${valColor(demGrade)};">${demP!=null?demP.toFixed(1):'-'}</span><span style="font-size:11.5px;color:${G500};">%</span></div>${demGrade?`<div style="margin-top:5px;">${statusPill(demGrade)}</div>`:''}</div>`,
          legendCol(demLegendItems(demGrade)))}
        ${metricCell('동연령대 상위 분포도', percentileMini(master.agePercentile), null)}
        <div style="grid-column:span 2;">${pairBlock}</div>
      </div>`);
  })()}

  ${(() => {
    const cardioIdxLabel = AssessVisuals.calcCardioIndex(master.cardioScore, c.gender, c.birthDate);
    const cardioGrade = cardioIdxLabel
      ? (() => { const m=AssessVisuals._cardioGrades(c.gender).find(g=>cardioIdxLabel.includes(g.l)); return m?{label:cardioIdxLabel,color:m.color}:null; })()
      : null;

    const cardioCell = `<div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:14px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.03em;text-align:left;">심폐기능지수 (VO2peak)</div>
      <div style="margin-bottom:5px;white-space:nowrap;display:flex;align-items:center;justify-content:flex-end;gap:7px;"><span style="font-size:21px;font-weight:800;color:${valColor(cardioGrade)};">${master.cardioScore??'-'}</span><span style="font-size:10.5px;color:${G500};">ml/kg/min</span>${statusPill(cardioGrade)}</div>
      ${AssessVisuals.cardioBar(master.cardioScore, c.gender, c.birthDate)}
      ${AssessVisuals.cardioBarLabels(master.cardioScore, c.gender, c.birthDate)}
      <div style="margin-top:8px;">${legendGrid(cardioLegendItems(master.cardioScore, c.gender, c.birthDate), 3)}</div>
    </div>`;

    const bodyMoveCell = `<div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:14px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.03em;text-align:left;">신체 움직임 점수</div>
      <div style="white-space:nowrap;text-align:right;"><span style="font-size:21px;font-weight:800;color:${INK};">${master.bodyMovementIndex??'-'}</span><span style="font-size:10.5px;color:${G500};">점 / 100점</span></div>
      ${barFull(master.bodyMovementIndex,100,12)}
    </div>`;

    const fraCol = `<div style="display:flex;flex-direction:column;gap:16px;">
      ${groupTitle('인바디 FRA')}
      ${fraBlock('신경계 점수', master.nervousScore, 100, nervItems)}
      ${fraBlock('통합 균형능력', master.balanceScore, 100, balItems)}
      ${fraBlock('감각계 점수', master.sensoryScore, 100, sensItems)}
    </div>`;

    return categoryBox(sectionHead('🏃','움직임 기능 평가'), `
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;column-gap:50px;row-gap:46px;">
        <div style="grid-column:1;grid-row:1;">${cardioCell}</div>
        <div style="grid-column:1;grid-row:2;">${bodyMoveCell}</div>
        <div style="grid-column:2;grid-row:1 / span 2;">${fraCol}</div>
      </div>`);
  })()}

  ${(() => {
    const stressGrade = AssessVisuals.calcStressIndex(master.stressScore);
    const bodyCompCell = `<div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:14px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.03em;text-align:left;">체성분 종합 점수</div>
      <div style="white-space:nowrap;text-align:right;"><span style="font-size:21px;font-weight:800;color:${INK};">${master.bodyCompScore??'-'}</span><span style="font-size:10.5px;color:${G500};">점 / 100점</span></div>
      ${barFull(master.bodyCompScore,100,12)}
      <div style="font-size:10px;color:${G500};">근육량이 많을 경우 100점을 초과할 수 있습니다.</div>
    </div>`;
    const stressCell = `<div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:14px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.03em;text-align:left;">스트레스 점수</div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:0 10px;">
        <div style="flex:1;min-width:0;">
          <div style="margin-bottom:5px;white-space:nowrap;display:flex;align-items:center;gap:7px;"><span style="font-size:21px;font-weight:800;color:${valColor(stressGrade)};">${master.stressScore??'-'}</span><span style="font-size:10.5px;color:${G500};">점</span>${statusPill(stressGrade)}</div>
          ${AssessVisuals.stressBar(master.stressScore)}
        </div>
        <div style="width:112px;flex-shrink:0;">${stressLegendCol(master.stressScore)}</div>
      </div>
    </div>`;
    return categoryBox(sectionHead('💊','대사 · 생활 평가'), `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:52px;">
        ${bodyCompCell}
        ${stressCell}
      </div>`);
  })()}

  ${pageFooter(2, 4)}
</div>

<!-- ===================== PAGE 3: 기간별 지표 변화 ===================== -->
<div style="width:100%;min-height:100vh;padding:30px 36px 20px;box-sizing:border-box;page-break-after:always;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;background:#fff;">
  ${pageHeader('기간별 지표 변화')}

  <div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly;min-height:0;">${trendTableChart()}</div>
  <div style="font-size:10px;color:${G500};font-style:italic;text-align:left;margin:8px 0 0;">※ 변화는 초기 평가를 기준으로 산출됩니다.</div>

  ${pageFooter(3, 4)}
</div>

<!-- ===================== PAGE 4: 전문가 소견 ===================== -->
<div style="width:100%;min-height:100vh;padding:30px 36px 20px;box-sizing:border-box;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;background:#fff;">
  ${pageHeader('전문가 소견')}

  ${categoryBox(sectionHead('🗒️','전문가 소견'), `
    <div style="display:flex;flex-direction:column;flex:1;">
      ${[
        {icon:'🧠', role:'인지 전문가 소견', text:master.cogComment},
        {icon:'🏃', role:'운동 전문가 소견', text:master.exComment},
        {icon:'💼', role:'케어 매니저 소견', text:master.cmComment}
      ].map((item,i,arr) => `
        <div style="flex:1;display:flex;flex-direction:column;padding:6px 2px;${i<arr.length-1?`border-bottom:1px solid rgba(155,115,75,0.18);`:''}">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:14px;">${item.icon}</span>
            <span style="font-size:14px;font-weight:800;color:${BR_DARK};letter-spacing:0.02em;">${item.role}</span>
          </div>
          <div style="flex:1;font-size:14px;line-height:1.7;color:${item.text?INK:G500};${item.text?'':'font-style:italic;'}white-space:pre-wrap;text-align:left;overflow:hidden;">${item.text || '작성된 소견이 없습니다.'}</div>
        </div>`).join('')}
    </div>`, 'flex:1;display:flex;flex-direction:column;')}

  ${pageFooter(4, 4)}
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
            page-break-inside:avoid;
            break-inside:avoid;
            width:100%;
          }
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
