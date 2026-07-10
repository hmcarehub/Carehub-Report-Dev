// ============================================================
// pages/assessments.js - v6
// ============================================================

const AssessmentsPage = {
  allClients:     [],
  _pendingClientId: null,
  _pendingRound:    null,
  overview:       {},
  selectedClient: null,
  activeRound:    1,
  activeCategory: null,
  activeMoveSub:  'ergo',
  activeMetaSub:  'inbody',
  roundData:      null,
  clientSearch:   '',
  clientSortMode: 'room',  // 'room' | 'name'


  _role: function() {
    const user = (typeof Auth !== 'undefined') ? Auth.getUser() : null;
    return user ? user.role : '';
  },

  // 탭 조회 권한: 인지/운동 전문가도 전체 조회 가능
  _canSeeTab: function(cat) {
    return true; // 전체 역할 조회 허용
  },

  // 쓰기(저장/수정/삭제) 권한
  _canWrite: function(cat) {
    const role = this._role();
    const writeRoles = AppConfig.ASSESS_WRITE_ROLES[cat] || [];
    return writeRoles.includes(role);
  },

  _visibleTabs: function() { return ['cognitive','movement','metabolism','comment'].filter(c => this._canSeeTab(c)); },

  _isRoundActive: function(client, round) {
    // ✅ 1회차(초기 평가): 입소일 30일 전부터 활성화 (입소 후에도 계속 가능)
    const today = new Date(); today.setHours(0,0,0,0);
    if (round === 1) {
      if (!client.admitDate) return false;
      const admit  = new Date(client.admitDate);
      const from30 = new Date(admit); from30.setDate(admit.getDate() - 30);
      return today >= from30;
    }
    // N회차: 이전 회차 리포트 완료 여부
    const prevOv = this.overview[client.clientId]?.rounds[round - 1];
    return !!(prevOv?.reportGenerated);
  },

  // 등급 계산은 AssessVisuals(공통 컴포넌트)에 위임 — ClientDetail과 100% 동일 로직 보장
  _calcCogIndex:      function(score) { return AssessVisuals.calcCogIndex(score); },
  _calcCogSubGrade:   function(score) { return AssessVisuals.calcCogSubGrade(score); },
  _calcStressIndex:   function(score) { return AssessVisuals.calcStressIndex(score); },
  _calcCardioIndex:   function(score, gender, birthDate) { return AssessVisuals.calcCardioIndex(score, gender, birthDate); },

  _getClientProgress: function(clientId) {
    const ov = this.overview[clientId];
    if (!ov) return { current:0, doneCats:0, hasReport:false };
    const rounds = Object.values(ov.rounds||{});
    const maxRound = rounds.length > 0 ? Math.max(...rounds.map(r=>r.round)) : 0;
    const latest = ov.rounds[maxRound] || {};
    return { current:maxRound, doneCats:latest.doneCats||0, hasReport:!!latest.reportGenerated };
  },

  render: function() {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header" style="margin-bottom:16px;">
        <h1 class="page-title">평가 관리</h1>
        <p class="page-subtitle">고객을 선택하고 회차별 평가를 입력합니다.</p>
      </div>
      <div class="assess-layout">
        <div class="assess-sidebar">
          <div class="assess-sidebar-header">
            <div class="search-bar" style="max-width:100%;margin-bottom:8px;">
              <svg class="search-icon" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" id="assess-client-search" placeholder="고객명·ID 검색">
            </div>
            <div style="display:flex;gap:4px;">
              <button class="assess-sort-btn active" data-assess-sort="room" style="flex:1;">입실호수순</button>
              <button class="assess-sort-btn" data-assess-sort="name" style="flex:1;">고객명순</button>
            </div>
          </div>
          <div class="assess-client-list" id="assess-client-list">
            <div class="empty-state"><div class="spinner" style="margin:0 auto;width:24px;height:24px;border-width:2px;"></div></div>
          </div>
        </div>
        <div class="assess-main" id="assess-main">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;color:var(--color-gray-400);">
            <span style="font-size:40px;">👈</span>
            <span style="font-size:15px;font-weight:600;">좌측에서 고객을 선택하세요</span>
          </div>
        </div>
      </div>`;

    document.getElementById('assess-client-search').addEventListener('input', e => {
      this.clientSearch = e.target.value.trim(); this._renderClientList();
    });
    document.querySelectorAll('[data-assess-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.clientSortMode = btn.dataset.assessSort;
        document.querySelectorAll('[data-assess-sort]').forEach(b => b.classList.toggle('active', b===btn));
        this._renderClientList();
      });
    });

    this._loadData();
  },

  _loadData: async function() {
    try {
      UI.showLoading();
      const r = await API.getInitialData();
      if (r.status==='success') {
        // ✅ 초기 평가(1회차)는 입소 30일 전부터 가능하므로, 아직 입소 전인 '입소예정' 고객도 목록에 포함
        this.allClients = (r.data.clients || []).filter(c => c.status === '입소중' || c.status === '입소예정');
        this.overview   = r.data.overview || {};
      }
    } catch { UI.toast('데이터 로드 실패','error'); }
    finally { UI.hideLoading(); }
    this._renderClientList();

    // 대시보드에서 고객 사전 선택
    if (this._pendingClientId) {
      const client = this.allClients.find(c => c.clientId === this._pendingClientId);
      if (client) {
        await this._selectClient(client);
        if (this._pendingRound) {
          this.activeRound = this._pendingRound;
          this._renderAssessMain();
          await this._loadRoundData();
        }
      }
      this._pendingClientId = null;
      this._pendingRound    = null;
    }
  },

  _renderClientList: function() {
    const wrap = document.getElementById('assess-client-list');
    if (!wrap) return;
    const q = this.clientSearch.toLowerCase();
    let list = q ? this.allClients.filter(c=>c.name.toLowerCase().includes(q)||c.clientId.toLowerCase().includes(q)) : [...this.allClients];
    if (this.clientSortMode === 'room') {
      list.sort((a,b) => {
        const ra = parseInt(a.roomNum||'9999'), rb = parseInt(b.roomNum||'9999');
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name,'ko');
      });
    } else {
      list.sort((a,b) => a.name.localeCompare(b.name,'ko'));
    }
    if (!list.length) { wrap.innerHTML='<div style="padding:20px;text-align:center;color:var(--color-gray-400);font-size:13px;">검색 결과 없음</div>'; return; }
    const sc={'입소중':'admitted','입소예정':'scheduled','퇴소':'discharged'};
    wrap.innerHTML = list.map(c => {
      const p=this._getClientProgress(c.clientId);
      const pct=p.doneCats>0?Math.round(p.doneCats/4*100):0;
      // 회차별 점 상태 계산
      const roundDots = Array.from({length: c.totalRounds}, (_, i) => {
        const round = i + 1;
        const ov    = this.overview[c.clientId]?.rounds[round];
        const prevOv2 = round > 1 ? (this.overview[c.clientId]?.rounds[round-1]) : null;
        const status = AssessUtils.calcRoundDotStatus(c.admitDate, round, ov, prevOv2, c.totalRounds, c.firstVisit);
        const COLOR  = AssessUtils.getDotColor(status);
        const LABEL  = AssessUtils.STATUS[status]?.label || status;
        return `<span title="${round===1?'초기':`${(round-1)*4}주차`}: ${LABEL}"
          style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${COLOR};margin:1px;cursor:default;"
        ></span>`;
      }).join('');

      return `
        <div class="assess-client-item${this.selectedClient?.clientId===c.clientId?' selected':''}" data-id="${c.clientId}">
          <div class="assess-client-info" style="width:100%;">
            <div style="font-size:15px;font-weight:700;color:var(--color-gray-900);margin-bottom:2px;">
              ${c.roomNum?`<span style="color:var(--color-primary-dark);">${c.roomNum}호</span> `:''}${c.name}
            </div>
            <div style="font-size:12px;color:var(--color-gray-500);margin-bottom:6px;">${c.clientId} · ${c.gender||''}</div>
            <div style="display:flex;align-items:center;gap:2px;flex-wrap:wrap;">
              ${roundDots}
            </div>

          </div>
        </div>`;
    }).join('');
    // 범례 상단에 한 번만 표시
    const legendHtml = `<div style="padding:8px 12px 6px;border-bottom:1px solid var(--color-gray-100);font-size:10px;color:var(--color-gray-400);display:flex;gap:10px;flex-wrap:wrap;background:var(--color-gray-50);">
      <span style="font-weight:700;color:var(--color-gray-500);">범례</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#CCC;margin-right:3px;"></span>예정</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4CAF50;margin-right:3px;"></span>작성중</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1565C0;margin-right:3px;"></span>완료</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#E53935;margin-right:3px;"></span>지연</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F9A825;margin-right:3px;"></span>재생성</span>
    </div>`;
    wrap.insertAdjacentHTML('afterbegin', legendHtml);

    wrap.querySelectorAll('.assess-client-item').forEach(el=>{
      el.addEventListener('click',()=>{ const c=this.allClients.find(c=>c.clientId===el.dataset.id); if(c) this._selectClient(c); });
    });
  },

  _selectClient: async function(client) {
    this.selectedClient=client;
    // 마지막 활성 회차로 이동 (1부터 탐색해 이전 회차 리포트 완료된 가장 큰 회차)
    const maxRound = client.totalRounds || 1;
    let lastActive = 1;
    for (let i=1; i<=maxRound; i++) {
      if (i===1) { lastActive=1; continue; }
      // 이전 회차 리포트가 완료된 경우에만 활성
      if ((client.doneRounds||0) >= i-1) lastActive = i;
      else break;
    }
    this.activeRound = lastActive;
    this.activeCategory=this._visibleTabs()[0]||'cognitive';
    this.activeMoveSub='ergo'; this.activeMetaSub='inbody'; this.roundData=null;
    this._renderClientList();
    const main=document.getElementById('assess-main');
    if (!main) return;
    if (client.totalRounds===0) {
      main.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:10px;color:var(--color-gray-400);"><span style="font-size:36px;">📋</span><span style="font-size:15px;font-weight:600;">회차 평가 대상이 아닙니다</span></div>';
      return;
    }
    this._renderAssessMain();
    await this._loadRoundData();
  },

  _renderAssessMain: function() {
    const c=this.selectedClient, main=document.getElementById('assess-main');
    if (!main||!c) return;
    const roundTabs=Array.from({length:c.totalRounds},(_,i)=>i+1).map(n=>{
      const active=this._isRoundActive(c,n);
      const ov=this.overview[c.clientId]?.rounds[n]||{};
      const doneCats=ov.doneCats||0, hasRep=ov.reportGenerated;
      return `<div class="assess-round-tab${this.activeRound===n?' active':''}${!active?' disabled':''}" data-round="${n}">
        <div>${n===1?"초기":`${(n-1)*4}주차`}</div>
        <div style="display:flex;gap:3px;margin-top:3px;justify-content:center;">${Array.from({length:4},(_,i)=>`<span style="width:6px;height:6px;border-radius:50%;background:${i<doneCats?'#4CAF50':'var(--color-gray-300)'}"></span>`).join('')}</div>
        ${hasRep?'<div style="font-size:9px;color:#4CAF50;margin-top:1px;">📄</div>':''}
      </div>`;
    }).join('');
    // 상위 탭: 인지/움직임/대사/코멘트
    const rd = this.roundData;
    const catDoneBadge = {
      cognitive:  rd?.cognitive ? '✓' : '',
      movement:   (rd?.ergo&&rd?.everex&&rd?.fra) ? '✓' : '',
      metabolism: (rd?.inbody&&rd?.stress) ? '✓' : '',
      comment:    (rd?.comment&&(rd.comment.cogComment||rd.comment.exComment||rd.comment.cmComment)) ? '✓' : ''
    };
    const catTabs=[
      {id:'cognitive', l:'🧠 인지관리'},
      {id:'movement',  l:'🏃 움직임관리'},
      {id:'metabolism',l:'💊 대사관리'},
      {id:'comment',   l:'💬 코멘트'}
    ].map(cat=>`<div class="assess-cat-tab${this.activeCategory===cat.id?' active':''}" data-cat="${cat.id}">
      ${cat.l}${catDoneBadge[cat.id]?`<span style="color:#4CAF50;margin-left:4px;">${catDoneBadge[cat.id]}</span>`:''}
    </div>`).join('');
    main.innerHTML=`
      <div class="assess-client-header">
        <div style="display:flex;align-items:center;gap:14px;">
          <div class="client-avatar" style="width:48px;height:48px;font-size:18px;">${c.name.charAt(0)}</div>
          <div>
            <div style="font-size:19px;font-weight:800;color:var(--color-gray-900);">${c.name}</div>
            <div style="font-size:13px;color:var(--color-gray-500);">${c.clientId} · ${c.gender||''} · 입소 ${c.admitDate||'-'} · ${c.admitPeriod||''}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="btn btn-outline btn-sm" id="goto-client-detail-btn">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            고객 정보
          </button>
          <div id="assess-header-progress"></div>
        </div>
      </div>
      <div class="assess-round-tabs">${roundTabs}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 20px 0;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--color-gray-100);">
        <div class="assess-cat-tabs" id="assess-cat-tabs">${catTabs}</div>
        <div id="assess-prog-wrap" style="padding-bottom:8px;"></div>
      </div>
      <div id="assess-form-area" style="flex:1;overflow-y:auto;padding:16px 20px;"></div>`;
    // 고객 정보 버튼
    main.querySelector('#goto-client-detail-btn')?.addEventListener('click', () => {
      Router.navigate('client-detail', this.selectedClient.clientId);
    });

    main.querySelectorAll('.assess-round-tab').forEach(el=>{
      el.addEventListener('click',()=>{
        if (el.classList.contains('disabled')) { UI.toast('아직 평가 가능한 회차가 아닙니다.','warning'); return; }
        this.activeRound=Number(el.dataset.round); this.roundData=null;
        main.querySelectorAll('.assess-round-tab').forEach(t=>t.classList.remove('active'));
        el.classList.add('active');
        this._loadRoundData();
      });
    });
    // 상위 탭 이벤트
    main.querySelectorAll('.assess-cat-tab[data-cat]').forEach(el=>{
      el.addEventListener('click',()=>{
        this.activeCategory=el.dataset.cat;
        main.querySelectorAll('.assess-cat-tab').forEach(t=>t.classList.remove('active'));
        el.classList.add('active');
        this._renderForm();
      });
    });
    this._updateHeaderProgress();
  },

  _updateHeaderProgress: function() {
    const wrap=document.getElementById('assess-header-progress');
    if (!wrap||!this.selectedClient) return;
    const c=this.selectedClient;
    const rounds=Object.values(this.overview[c.clientId]?.rounds||{});
    const completedRounds=rounds.filter(r=>r.reportGenerated).length;
    wrap.innerHTML=`<div style="text-align:right;"><div style="font-size:13px;color:var(--color-gray-500);">리포트 완료</div><div style="font-size:22px;font-weight:800;color:var(--color-primary);">${completedRounds}<span style="font-size:14px;color:var(--color-gray-400);"> / ${c.totalRounds}회차</span></div></div>`;
  },

  _loadRoundData: async function() {
    const area=document.getElementById('assess-form-area');
    // ✅ 캐시 확인 — 있으면 API 호출 스킵
    const cacheParams = { action:'getRoundData', clientId:this.selectedClient.clientId, round:this.activeRound };
    const cached = API._getCached('getRoundData', cacheParams);
    if (cached) {
      this.roundData = cached.data;
    } else {
      if (area) area.innerHTML='<div class="empty-state"><div class="spinner" style="margin:0 auto;"></div></div>';
      try {
        UI.showLoading();
        const res=await API.getRoundData(this.selectedClient.clientId, this.activeRound);
        this.roundData = res.status==='success' ? res.data : null;
      } catch { this.roundData=null; }
      finally { UI.hideLoading(); }
    }
    // ✅ 스피너 즉시 제거 → 빈 컨테이너 먼저 노출
    if (area) area.innerHTML='<div id="assess-form-inner"></div>';
    this._updateProgress();
    this._refreshCatTabs();
    // ✅ 폼 렌더링은 다음 프레임에 실행 (스피너 제거 후 브라우저가 먼저 그리게)
    requestAnimationFrame(() => this._renderForm());
  },

  _refreshCatTabs: function() {
    const rd = this.roundData;
    const badges = {
      cognitive:  rd?.cognitive ? '✓' : '',
      movement:   (rd?.ergo&&rd?.everex&&rd?.fra) ? '✓' : '',
      metabolism: (rd?.inbody&&rd?.stress) ? '✓' : '',
      comment:    (rd?.comment&&(rd.comment.cogComment||rd.comment.exComment||rd.comment.cmComment)) ? '✓' : ''
    };
    document.querySelectorAll('.assess-cat-tab[data-cat]').forEach(tab => {
      const cat = tab.dataset.cat;
      const badge = tab.querySelector('.cat-done-badge');
      if (badge) badge.textContent = badges[cat] || '';
      else if (badges[cat]) tab.innerHTML += `<span class="cat-done-badge" style="color:#4CAF50;margin-left:4px;">${badges[cat]}</span>`;
    });
  },

  _updateProgress: function() {
    const wrap=document.getElementById('assess-prog-wrap');
    if (!wrap) return;
    const m=this.roundData;
    const states=[!!m?.cognitive, !!(m?.ergo&&m?.everex&&m?.fra), !!(m?.inbody&&m?.stress), !!(m?.comment&&(m.comment.cogComment||m.comment.exComment||m.comment.cmComment))];
    const done=states.filter(Boolean).length, pct=Math.round(done/4*100), allDone=(states[0]&&states[1]&&states[2]);
    const alreadyReported = m?.master?.reportGenerated;
    const canReport = ['ADMIN','CARE_MANAGER'].includes(this._role());
    // 재생성 필요: 리포트 생성 후 평가 데이터가 수정된 경우 (doneCats=4 & reportGenerated=true → 이 상태는 RE_EVAL)
    // 여기서는 assessDate < 최신 평가 측정일이면 재생성 필요로 판단
    const needsRegen = alreadyReported && (m?.master?.assessDate === '' || !m?.master?.assessDate);

    wrap.innerHTML=`<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:4px 0;">
      <!-- 진행 상태 아이콘 -->
      <div style="display:flex;gap:4px;align-items:center;">
        ${['인지','움직임','대사','코멘트'].map((l,i)=>`
          <div style="text-align:center;">
            <div style="width:30px;height:30px;border-radius:50%;background:${states[i]?'#4CAF50':'var(--color-gray-200)'};display:flex;align-items:center;justify-content:center;font-size:13px;color:white;margin-bottom:2px;">${states[i]?'✓':''}</div>
            <div style="font-size:9px;color:var(--color-gray-400);">${l}</div>
          </div>`).join('<div style="width:10px;height:2px;background:var(--color-gray-200);margin-bottom:16px;flex-shrink:0;"></div>')}
      </div>
      <!-- 진행률 -->
      <div>
        <div style="font-size:11px;color:var(--color-gray-500);margin-bottom:3px;">${this.activeRound}회차 진행률</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:80px;"><div class="progress-bar-outer" style="height:8px;"><div class="progress-bar-inner" style="width:${pct}%;"></div></div></div>
          <span style="font-size:13px;font-weight:700;color:${allDone?'#2E7D32':'var(--color-primary-dark)'};">${done}/4</span>
        </div>
      </div>
      <!-- 리포트 버튼 영역 -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <!-- 미리보기: 데이터가 1개 이상 있으면 항상 표시 (생성 전후 모두) -->
        ${done > 0 ? `
          <button id="preview-report-btn"
            style="background:transparent;color:#1565C0;border:1.5px solid #1565C0;border-radius:10px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;">
            👁 미리보기
          </button>` : ''}

        <!-- 리포트 생성/상태 버튼 -->
        ${canReport ? `
          ${!alreadyReported && allDone ? `
            <button id="gen-report-btn"
              style="background:#1565C0;color:white;border:none;border-radius:10px;padding:10px 22px;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 3px 10px rgba(21,101,192,0.35);letter-spacing:0.02em;">
              📄 리포트 생성
            </button>` : ''}
          ${alreadyReported && !needsRegen ? `
            <span style="background:#E8F5E9;color:#2E7D32;padding:6px 14px;border-radius:10px;font-size:13px;font-weight:700;">📄 리포트 완료</span>
          ` : ''}

          ${!allDone && !alreadyReported ? `
            <span style="font-size:11px;color:var(--color-gray-400);">모든 평가 완료 후 생성 가능</span>` : ''}
        ` : `
          ${alreadyReported ? '<span style="background:#E8F5E9;color:#2E7D32;padding:6px 14px;border-radius:10px;font-size:13px;font-weight:700;">📄 리포트 완료</span>' : ''}
          ${allDone && !alreadyReported ? '<span style="font-size:12px;color:#F57F17;font-weight:600;">평가 완료 — 리포트 생성 권한 없음</span>' : ''}
          ${!allDone && done === 0 ? '<span style="font-size:11px;color:var(--color-gray-400);">평가 입력 후 미리보기 가능</span>' : ''}
        `}
      </div>
    </div>`;
    document.getElementById('gen-report-btn')?.addEventListener('click',()=>this._handleGenerateReport());
    document.getElementById('preview-report-btn')?.addEventListener('click',()=>this._showReportPreview());
  },

  _showReportPreview: async function() {
    const c     = this.selectedClient;
    const m     = this.roundData?.master;
    if (!m) { UI.toast('리포트 데이터를 불러올 수 없습니다.', 'error'); return; }

    try {
      UI.showLoading();
      // 추이용 전체 master 목록 조회
      const masterRes = await API.getClientMasterList(c.clientId);
      const masterList = masterRes.status==='success' ? ClientDetailPage._dedupeMasterList(masterRes.data.masterList||[]) : [m];
      UI.hideLoading();

      const isReported = m?.reportGenerated === true;
      // _buildReportHTML은 ClientDetailPage 프로토타입 메서드 필요 → Object.create로 컨텍스트 생성
      const ctx = Object.create(ClientDetailPage);
      ctx.client = c;
      ctx._masterListCache = masterList;
      const reportHtml = ctx._buildReportHTML(m, masterList);

      const weekLabel = this.activeRound===1 ? '초기' : `${(this.activeRound-1)*4}주차`;
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.id = 'assess-preview-modal';
      wrap.innerHTML = `
        <div class="modal" style="max-width:820px;max-height:94vh;display:flex;flex-direction:column;">
          <div class="modal-header">
            <h3 class="modal-title">📄 리포트 미리보기 — ${c.name} ${weekLabel}</h3>
            <div style="display:flex;gap:8px;">
              ${isReported ? '<button class="btn btn-primary btn-sm" id="preview-print-btn">🖨️ PDF 출력</button>' : ''}
              <button class="modal-close" id="preview-close-btn">✕</button>
            </div>
          </div>
          <div class="modal-body" style="overflow-y:auto;flex:1;background:#f5f5f5;padding:20px;">
            <div id="preview-report-inner" style="background:white;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;">
              ${reportHtml}
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrap);

      document.getElementById('preview-close-btn').onclick = () => wrap.remove();
      wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };
      if (isReported) {
        document.getElementById('preview-print-btn').onclick = () => ctx._printReport(m);
      }
    } catch(e) {
      UI.hideLoading();
      UI.toast('미리보기 로드 실패: ' + e.message, 'error');
    }
  },

  _renderForm: function() {
    const area=document.getElementById('assess-form-area');
    if (!area) return;
    // 상위 탭 구조 유지: 인지관리 / 움직임관리 / 대사관리 / 코멘트관리
    if (!this.activeCategory) this.activeCategory = 'cognitive';
    const cat = this.activeCategory;
    if      (cat==='cognitive')  this._renderCognitive(area);
    else if (cat==='movement')   this._renderMovement(area);
    else if (cat==='metabolism') this._renderMetabolism(area);
    else if (cat==='comment')    this._renderComment(area);
  },

  _renderCognitive: function(area) {
    if (!area) return;
    const canWrite = this._canWrite('cognitive');
    const d = this.roundData?.cognitive || null;
    const v = d || {};
    const ro = canWrite ? '' : 'readonly';
    const today = AssessUtils._fmt(new Date());
    const hasData = !!d; // ✅ 데이터 유무 플래그

   // 차트 SVG 생성 함수들 — 데이터 없으면 빈 placeholder 반환
    const emptyViz = (msg='점수 입력 시 표시') =>
      `<div style="height:90px;display:flex;align-items:center;justify-content:center;color:var(--color-gray-300);font-size:12px;">${msg}</div>`;

    // ⬇ 모두 AssessVisuals(공통 컴포넌트)로 위임 — ClientDetail과 동일 함수 사용
    const gaugeHalf     = (score, color='#1565C0', max=100) =>
      (!hasData && score==null) ? emptyViz() : AssessVisuals.semiGauge(score, color, max);
    const conicDonut    = (score, color, max, size, thickness) =>
      (!hasData && score==null) ? emptyViz() : AssessVisuals.conicDonut(score, color, max, size, thickness);
    const gaugeCircle   = (score, color, max) =>
      (!hasData && score==null) ? emptyViz() : AssessVisuals.conicDonut(score, color||'#2E7D32', max||100, 100, 14);
    const percentileBar = (pct) => AssessVisuals.percentileMini(pct);
    const subGradeColor = (score) => {
      const g = AssessVisuals.mapSubGrade(AssessVisuals.calcCogSubGrade(score));
      return g ? g.color : '#888';
    };

    area.innerHTML = `
      <div style="padding-bottom:80px;">
        <!-- 측정일 -->
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px;padding:12px 16px;background:var(--color-gray-50);border-radius:10px;">
          <label class="assess-field-label" style="white-space:nowrap;margin:0;">측정일 <span class="required">*</span></label>
          <input type="date" id="f-cog-date" class="form-control" value="${v.measureDate||today}" ${ro} style="max-width:200px;">
          
        </div>

        <!-- 이미지와 동일한 2열 레이아웃 -->
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:14px;">

          <!-- ── 좌측: 인지점수 + 동연령대 통합 카드 ── -->
          <div>
            <div class="assess-sub-card" style="height:100%;">
              <div class="assess-sub-card-header">인지점수 <span class="required">*</span></div>
              <div style="padding:14px 16px;">

                <!-- 인지점수 입력 -->
                <input type="number" id="f-cog-score" class="form-control" value="${v.cogScore??''}"
                  placeholder="0~100" min="0" max="100" step="1" ${ro}
                  style="font-size:22px;height:52px;font-weight:700;text-align:center;margin-bottom:10px;">

                <!-- 반원게이지 + 우측 범례 -->
                <div id="viz-cog-score" style="display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:14px;">
                  <div style="text-align:center;">
                    ${gaugeHalf(v.cogScore, this._calcCogIndex(v.cogScore)?.color||'#1565C0')}
                    ${v.cogScore!=null?`<span style="background:${this._calcCogIndex(v.cogScore)?.bg};color:${this._calcCogIndex(v.cogScore)?.color};padding:3px 14px;border-radius:12px;font-size:13px;font-weight:700;display:inline-block;margin-top:4px;">${this._calcCogIndex(v.cogScore)?.label}</span>`:'<span style="font-size:10px;color:var(--color-gray-400);">점수 입력 시 등급</span>'}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:4px;">
                    ${AssessVisuals.legendListCol(AssessVisuals.cogLegendItems(this._calcCogIndex(v.cogScore) ? AssessVisuals.mapCogScoreGrade(this._calcCogIndex(v.cogScore)) : null))}
                  </div>
                </div>

                <!-- 구분선 -->
                <div style="border-top:1px solid var(--color-gray-100);margin-bottom:12px;"></div>

                <!-- 동연령대 상위 분포도 입력 -->
                <div style="font-size:12px;font-weight:700;color:var(--color-gray-600);margin-bottom:6px;">동연령대 상위 분포도 (%)</div>
                <input type="number" id="f-cog-pct" class="form-control" value="${v.agePercentile??''}"
                  placeholder="예) 25" min="0" max="100" step="1" ${ro}
                  style="height:44px;font-size:18px;font-weight:700;text-align:center;margin-bottom:10px;">
                <div id="viz-pct" style="margin-top:20px;">${percentileBar(v.agePercentile)}</div>

              </div>
            </div>
          </div>

          <!-- ── 우측: 2×2 그리드 (시공간/기억력/우울/치매) ── -->
          <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;gap:12px;">

            <!-- 시공간능력 -->
            <div class="assess-sub-card">
              <div class="assess-sub-card-header">시공간능력 (0~100)</div>
              <div style="padding:14px 16px;">
                <input type="number" id="f-cog-spatial" class="form-control" value="${v.spatial??''}"
                  placeholder="0~100" min="0" max="100" step="1" ${ro}
                  style="font-size:20px;height:48px;font-weight:700;text-align:center;margin-bottom:10px;">
                <div id="viz-spatial" style="display:flex;flex-direction:column;align-items:center;">
                  ${gaugeCircle(v.spatial, subGradeColor(v.spatial))}
                  ${v.spatial!=null
                    ? `<span style="background:${subGradeColor(v.spatial)}22;color:${subGradeColor(v.spatial)};padding:3px 14px;border-radius:12px;font-size:13px;font-weight:700;margin-top:6px;">${this._calcCogSubGrade(v.spatial)?.label||''}</span>`
                    : '<span style="font-size:11px;color:var(--color-gray-400);margin-top:6px;">점수 입력 시 등급</span>'}
                  <div style="margin-top:8px;">${AssessVisuals.legendListRow(AssessVisuals.subLegendItems(AssessVisuals.mapSubGrade(this._calcCogSubGrade(v.spatial))))}</div>
                </div>
              </div>
            </div>

            <!-- 기억력 -->
            <div class="assess-sub-card">
              <div class="assess-sub-card-header">기억력 (0~100)</div>
              <div style="padding:14px 16px;">
                <input type="number" id="f-cog-memory" class="form-control" value="${v.memory??''}"
                  placeholder="0~100" min="0" max="100" step="1" ${ro}
                  style="font-size:20px;height:48px;font-weight:700;text-align:center;margin-bottom:10px;">
                <div id="viz-memory" style="display:flex;flex-direction:column;align-items:center;">
                  ${gaugeCircle(v.memory, subGradeColor(v.memory))}
                  ${v.memory!=null
                    ? `<span style="background:${subGradeColor(v.memory)}22;color:${subGradeColor(v.memory)};padding:3px 14px;border-radius:12px;font-size:13px;font-weight:700;margin-top:6px;">${this._calcCogSubGrade(v.memory)?.label||''}</span>`
                    : '<span style="font-size:11px;color:var(--color-gray-400);margin-top:6px;">점수 입력 시 등급</span>'}
                  <div style="margin-top:8px;">${AssessVisuals.legendListRow(AssessVisuals.subLegendItems(AssessVisuals.mapSubGrade(this._calcCogSubGrade(v.memory))))}</div>
                </div>
              </div>
            </div>

            <!-- 우울점수 -->
            <div class="assess-sub-card">
              <div class="assess-sub-card-header">우울점수 (0~60점)</div>
              <div style="padding:14px 16px;">
                <input type="number" id="f-cog-dep" class="form-control" value="${v.depression??''}" max="60"
                  placeholder="0~60 입력" min="0" max="60" step="1" ${ro}
                  style="height:48px;font-size:20px;font-weight:700;text-align:center;margin-bottom:10px;">
                <div id="viz-dep" style="display:flex;flex-direction:column;align-items:center;">
                  ${(()=>{
                    const score=v.depression;
                    const g=this._calcDepressionGrade(score);
                    const c=g?.color||'#7B1FA2';
                    return this._conicDonut(score,c,60,90,12);
                  })()}
                  ${(()=>{
                    const g = AssessVisuals.mapSubGrade(this._calcDepressionGrade(v.depression));
                    return g ? AssessVisuals.statusPill(g) : '<span style="font-size:11px;color:var(--color-gray-400);margin-top:6px;">점수 입력 시 등급</span>';
                  })()}
                  <div style="margin-top:8px;">${AssessVisuals.legendListRow(AssessVisuals.depLegendItems(AssessVisuals.mapSubGrade(this._calcDepressionGrade(v.depression))))}</div>
                </div>
              </div>
            </div>

            <!-- 치매위험요인: 숫자+등급만 표기 (시각화 없음) -->
            <div class="assess-sub-card">
              <div class="assess-sub-card-header">치매위험요인 (%)</div>
              <div style="padding:14px 16px;">
                <input type="number" id="f-cog-dem" class="form-control"
                  value="${v.dementiaRisk??''}"
                  placeholder="예) 12.5"
                  min="0"
                  max="100"
                  step="0.1"
                  ${ro}
                  style="height:48px;font-size:20px;font-weight:700;text-align:center;margin-bottom:10px;">
            
                <div id="viz-dem" style="text-align:center;padding:8px 0;margin-top:20px;">
                  ${(() => {
                    if (v.dementiaRisk == null || v.dementiaRisk === '') {
                      return '<div style="font-size:13px;color:var(--color-gray-300);">값 입력 시 등급 표시</div>';
                    }
            
                    const p = Math.min(100, Math.max(0, Number(v.dementiaRisk)));
                    const display = p.toFixed(1);
                    const grade = AssessVisuals.mapSubGrade(p>=60?{label:'높음',color:'#C0392B'}:p>=30?{label:'주의',color:'#C99A2E'}:{label:'낮음',color:'#4C8C4A'});
                    const clr = grade.color;

                    return `
                      <div style="font-size:36px;font-weight:900;color:${clr};line-height:1;">
                        ${display}<span style="font-size:18px;">%</span>
                      </div>
                      <div style="margin-top:8px;">${AssessVisuals.statusPill(grade)}</div>
                      <div style="margin-top:8px;">${AssessVisuals.legendListRow(AssessVisuals.demLegendItems(grade))}</div>
                    `;
                  })()}
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- 항목 입력 현황 -->
        <div style="background:var(--color-gray-50);border-radius:10px;padding:10px 16px;margin-top:14px;">
          <div style="font-size:12px;font-weight:700;color:var(--color-gray-500);margin-bottom:6px;">항목 입력 현황</div>
          <div id="viz-progress" style="display:flex;gap:14px;flex-wrap:wrap;">
            ${['인지점수','시공간능력','기억력','동연령대','우울점수','치매위험요인'].map((label,i)=>{
              const vals=[v.cogScore,v.spatial,v.memory,v.agePercentile,v.depression,v.dementiaRisk];
              const filled=vals[i]!=null&&vals[i]!=='';
              return `<div style="display:flex;align-items:center;gap:4px;">
                <span style="width:18px;height:18px;border-radius:50%;background:${filled?'#4CAF50':'#E0E0E0'};display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:700;">${filled?'✓':''}</span>
                <span style="font-size:12px;color:${filled?'#2E7D32':'var(--color-gray-400)'};">${label}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- 임시 저장/수정 + 리포트 생성 시 삭제 -->
        ${canWrite?`<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
          ${this.roundData?.master?.reportGenerated&&!!d?`
          <button id="cog-all-del-btn"
            style="background:transparent;color:#E53935;border:1px solid #E53935;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;">
            삭제
          </button>`:''}
          <button id="cog-all-save-btn"
            style="background:transparent;color:var(--color-primary-dark);border:1.5px solid var(--color-primary-dark);border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer;">
            전체 임시저장
          </button>
        </div>`:''}
      </div>`;


    if (canWrite) {
      const upd = () => this._updateCogProgress(area, {
        cogScore:this._gn('f-cog-score'), spatial:this._gn('f-cog-spatial'),
        memory:this._gn('f-cog-memory'), agePercentile:this._gn('f-cog-pct'),
        depression:this._gn('f-cog-dep'), dementiaRisk:this._gn('f-cog-dem')
      });

      // 인지점수 → 반원게이지 + 범례
      area?.querySelector('#f-cog-score')?.addEventListener('input', e => {
        const val=parseFloat(e.target.value), g=isNaN(val)?null:this._calcCogIndex(val), clr=g?.color||'#1565C0';
        const viz=area.querySelector('#viz-cog-score');
        const legend=AssessVisuals.legendListCol(AssessVisuals.cogLegendItems(g ? AssessVisuals.mapCogScoreGrade(g) : null));
        if (viz) viz.innerHTML=`<div style="text-align:center;">${gaugeHalf(isNaN(val)?null:val,clr)}${g?`<span style="background:${g.bg};color:${g.color};padding:3px 14px;border-radius:12px;font-size:13px;font-weight:700;display:inline-block;margin-top:4px;">${g.label}</span>`:'<span style="font-size:11px;color:var(--color-gray-400);">점수 입력 시 등급</span>'}</div><div style="display:flex;flex-direction:column;gap:4px;">${legend}</div>`;
        upd();
      });

      // 시공간능력
      area?.querySelector('#f-cog-spatial')?.addEventListener('input', e => {
        if (parseFloat(e.target.value) > 100) { e.target.value = 100; UI.toast('시공간능력은 100점 만점입니다.', 'warning'); }
        const val=parseFloat(e.target.value), c=isNaN(val)?'#888':subGradeColor(val), g=isNaN(val)?null:this._calcCogSubGrade(val);
        const viz=area.querySelector('#viz-spatial');
        if (viz) viz.innerHTML=`${gaugeCircle(isNaN(val)?null:val,c)}${g?`<span style="background:${c}22;color:${c};padding:3px 14px;border-radius:12px;font-size:13px;font-weight:700;margin-top:6px;">${g.label}</span>`:'<span style="font-size:11px;color:var(--color-gray-400);margin-top:6px;">점수 입력 시 등급</span>'}<div style="margin-top:8px;">${AssessVisuals.legendListRow(AssessVisuals.subLegendItems(g?AssessVisuals.mapSubGrade(g):null))}</div>`;
        upd();
      });

      // 기억력
      area?.querySelector('#f-cog-memory')?.addEventListener('input', e => {
        if (parseFloat(e.target.value) > 100) { e.target.value = 100; UI.toast('기억력은 100점 만점입니다.', 'warning'); }
        const val=parseFloat(e.target.value), c=isNaN(val)?'#888':subGradeColor(val), g=isNaN(val)?null:this._calcCogSubGrade(val);
        const viz=area.querySelector('#viz-memory');
        if (viz) viz.innerHTML=`${gaugeCircle(isNaN(val)?null:val,c)}${g?`<span style="background:${c}22;color:${c};padding:3px 14px;border-radius:12px;font-size:13px;font-weight:700;margin-top:6px;">${g.label}</span>`:'<span style="font-size:11px;color:var(--color-gray-400);margin-top:6px;">점수 입력 시 등급</span>'}<div style="margin-top:8px;">${AssessVisuals.legendListRow(AssessVisuals.subLegendItems(g?AssessVisuals.mapSubGrade(g):null))}</div>`;
        upd();
      });

      // 동연령대
      area?.querySelector('#f-cog-pct')?.addEventListener('input', e => {
        const val=parseFloat(e.target.value), viz=area.querySelector('#viz-pct');
        if (viz) viz.innerHTML=percentileBar(isNaN(val)?null:val);
      });

      // 우울점수 (60점 만점 - 60 초과 입력 방지)
      area?.querySelector('#f-cog-dep')?.addEventListener('input', e => {
        if (parseFloat(e.target.value) > 60) { e.target.value = 60; UI.toast('우울점수는 60점 만점입니다.', 'warning'); }
        const val=parseFloat(e.target.value), viz=area.querySelector('#viz-dep');
        if (!viz) return;
        const gRaw=isNaN(val)?null:this._calcDepressionGrade(val), pct=isNaN(val)?0:Math.min(100,(val/60)*100);
        const g=AssessVisuals.mapSubGrade(gRaw);
        const clr=g?.color||'#7B1FA2';
        viz.innerHTML=this._conicDonut(isNaN(val)?null:val,clr,60,90,12)+`
          ${g?AssessVisuals.statusPill(g):'<span style="font-size:11px;color:var(--color-gray-400);margin-top:6px;">점수 입력 시 등급</span>'}
          <div style="margin-top:8px;">${AssessVisuals.legendListRow(AssessVisuals.depLegendItems(g))}</div>`;
        upd();
      });

      // 치매위험요인: 숫자+등급만 표시
      area?.querySelector('#f-cog-dem')?.addEventListener('input', e => {
        const val=parseFloat(e.target.value), viz=area.querySelector('#viz-dem');
        if (!viz) return;
        if (isNaN(val)) { viz.innerHTML='<div style="font-size:13px;color:var(--color-gray-300);">값 입력 시 등급 표시</div>'; return; }
        const pct=Math.min(100,Math.max(0,val));
        const grade=AssessVisuals.mapSubGrade(pct>=60?{label:'높음',color:'#C0392B'}:pct>=30?{label:'주의',color:'#C99A2E'}:{label:'낮음',color:'#4C8C4A'});
        viz.innerHTML=`<div style="font-size:36px;font-weight:900;color:${grade.color};line-height:1;">${pct.toFixed(1)}<span style="font-size:18px;">%</span></div>
          <div style="margin-top:8px;">${AssessVisuals.statusPill(grade)}</div>
          <div style="margin-top:8px;">${AssessVisuals.legendListRow(AssessVisuals.demLegendItems(grade))}</div>`;
        upd();
      });

      area?.querySelectorAll('.sec-save-btn[data-sec="cognitive"]').forEach(b=>b.addEventListener('click',()=>this._saveCognitive()));
      area?.querySelectorAll('.sec-del-btn[data-sec="cognitive"]').forEach(b=>b.addEventListener('click',()=>this._deleteSheet('cognitive')));
      area?.querySelector('#cog-all-save-btn')?.addEventListener('click',()=>this._saveCognitive());
      area?.querySelector('#cog-all-del-btn')?.addEventListener('click',()=>this._deleteSheet('cognitive'));
    }
  },

  _calcDepressionGrade: function(score) { return AssessVisuals.calcDepressionGrade(score); },

  _gn: function(id) {
    const v = document.getElementById(id)?.value?.trim();
    return (v===''||v==null) ? null : Number(v);
  },

  _updateCogProgress: function(area, vals) {
    const viz = area?.querySelector('#viz-progress');
    if (!viz) return;
    const labels = ['인지점수','시공간능력','기억력','동연령대','우울점수','치매위험요인'];
    const values = [vals.cogScore, vals.spatial, vals.memory, vals.agePercentile, vals.depression, vals.dementiaRisk];
    viz.innerHTML = labels.map((label, i) => {
      const filled = values[i] != null && !isNaN(values[i]);
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:12px;color:var(--color-gray-600);width:90px;">${label}</span>
        <div style="flex:1;height:8px;background:#E0E0E0;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${filled?'100%':'0%'};background:${filled?'#4CAF50':'#E0E0E0'};border-radius:4px;"></div>
        </div>
        <span style="font-size:12px;font-weight:700;color:${filled?'#2E7D32':'#CCC'};">${filled?'✓':'○'}</span>
      </div>`;
    }).join('');
  },
  _saveCognitive: async function() {
    const gn = id => this._gn(id);
    const date  = document.getElementById('f-cog-date')?.value?.trim();
    const score = gn('f-cog-score');
    if (!date)        { UI.toast('측정일을 입력해주세요.','error'); return; }
    if (score===null) { UI.toast('인지점수를 입력해주세요.','error'); return; }
    await this._callSave(() => API.saveCognitive(
      this.selectedClient.clientId, this.activeRound, {
        measureDate:   date,
        cogScore:      score,
        spatial:       gn('f-cog-spatial'),
        memory:        gn('f-cog-memory'),
        agePercentile: gn('f-cog-pct'),
        depression:    gn('f-cog-dep'),
        dementiaRisk:  gn('f-cog-dem')
      }
    ));
  },

  _renderMovement: function(area) {
    // ✅ 컨테이너 먼저 노출 후 각 섹션을 순차적으로 렌더링
    area.innerHTML = '<div id="move-ergo-area"></div><div id="move-everex-area" style="margin-top:20px;"></div><div id="move-fra-area" style="margin-top:20px;"></div>';
    const canWrite = this._canWrite('movement');

    // ✅ 데이터 없으면 에르고만 즉시 렌더, 나머지는 다음 프레임에
    this._renderErgo(area.querySelector('#move-ergo-area'));
    requestAnimationFrame(() => {
      this._renderEverex(area.querySelector('#move-everex-area'));
      this._renderFra(area.querySelector('#move-fra-area'));
      if (canWrite) {
        const allSaveDiv = document.createElement('div');
        allSaveDiv.style.cssText = 'display:flex;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:2px solid var(--color-gray-200);';
        allSaveDiv.innerHTML = `<button class="btn btn-primary" id="move-all-save-btn" style="min-width:160px;">전체 임시저장</button>`;
        area.appendChild(allSaveDiv);
        allSaveDiv.querySelector('#move-all-save-btn').addEventListener('click', () => this._saveMovementAll());
      }
    });
  },

  _saveMovementAll: async function() {
    const gn = id => { const v=document.getElementById(id)?.value?.trim(); return (v===''||v==null)?null:Number(v); };
    const gv = id => document.getElementById(id)?.value?.trim()||'';
    const c = this.selectedClient;
    let saved = 0, errors = [];
    try {
      UI.showLoading();
      const ergDate=gv('f-erg-date'), ergScore=gv('f-erg-score');
      const evxDate=gv('f-evx-date'), evxIdx=gv('f-evx-idx');
      const fraDate=gv('f-fra-date');
      if (ergDate || ergScore) {
        if (!ergDate) { errors.push('에르고미터: 측정일 필요'); }
        else if (!ergScore) { errors.push('에르고미터: 점수 필요'); }
        else {
          const res = await API.saveErgo(c.clientId, this.activeRound, {measureDate:ergDate, cardioScore:Number(ergScore), gender:c.gender, birthDate:c.birthDate});
          if (res.status==='success') saved++; else errors.push('에르고미터: '+res.message);
        }
      }
      if (evxDate || evxIdx) {
        if (!evxDate) { errors.push('에버엑스: 측정일 필요'); }
        else if (!evxIdx) { errors.push('에버엑스: 지수 필요'); }
        else {
          const res = await API.saveEverex(c.clientId, this.activeRound, {measureDate:evxDate, bodyMovementIndex:Number(evxIdx)});
          if (res.status==='success') saved++; else errors.push('에버엑스: '+res.message);
        }
      }
      if (fraDate || gn('f-fra-nerv')!=null || gn('f-fra-bal')!=null || gn('f-fra-sens')!=null) {
        if (!fraDate) { errors.push('인바디FRA: 측정일 필요'); }
        else {
          const res = await API.saveFra(c.clientId, this.activeRound, {measureDate:fraDate, nervousScore:gn('f-fra-nerv'), balanceScore:gn('f-fra-bal'), sensoryScore:gn('f-fra-sens')});
          if (res.status==='success') saved++; else errors.push('인바디FRA: '+res.message);
        }
      }
    } finally { UI.hideLoading(); }
    if (saved > 0) {
      UI.toast(`움직임 평가 ${saved}개 임시저장 완료`, 'success');
      await this._loadRoundData();
    }
    if (errors.length) UI.toast(errors.join(', '), 'error');
    else if (saved === 0) UI.toast('입력된 데이터가 없습니다.', 'warning');
  },

  _renderErgo: function(area) {
    if (!area) return;
    const canWrite=this._canWrite('movement'),d=this.roundData?.ergo||null,v=d||{},ro=canWrite?'':'readonly';
    const c=this.selectedClient;
    const cardioIdx=this._calcCardioIndex(v.cardioScore,c?.gender,c?.birthDate);
    const age=c?.birthDate?new Date().getFullYear()-new Date(c.birthDate).getFullYear():null;
    const ageGroup=age?(age<=65?'60~65세':'66세 이상'):'-';
    const isMale=c?.gender==='남자';
    // 구간형 게이지는 AssessVisuals로 위임 — ClientDetail과 동일 마크업 보장
    const segGauge = (score) => AssessVisuals.cardioSegGauge(score, c?.gender, c?.birthDate);
    
    area.innerHTML=`<div class="assess-sub-card">
      <div class="assess-sub-card-header">에르고미터 (심폐기능) ${d?``:'<span class="assess-empty-badge">미입력</span>'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
        <!-- 좌: 입력 -->
        <div class="assess-sub-section" style="border-right:1px solid var(--color-gray-100);">
          <div class="assess-field-group" style="margin-bottom:12px;">
            <label class="assess-field-label">측정일 <span class="required">*</span></label>
            <input type="date" id="f-erg-date" class="form-control" value="${v.measureDate||AssessUtils._fmt(new Date())}" ${ro}>
          </div>
          <div class="assess-field-group" style="margin-bottom:12px;">
            <label class="assess-field-label">심폐기능지수 (VO2peak) <span class="required">*</span> <span style="font-size:11px;color:#888;">(ml/kg/min)</span></label>
            <input type="number" id="f-erg-score" class="form-control" value="${v.cardioScore??''}" placeholder="ml/kg/min" min="0" step="1" ${ro}
              style="font-size:20px;height:52px;font-weight:700;text-align:center;">
            <div style="font-size:11px;color:var(--color-gray-400);margin-top:4px;">성별: ${c?.gender||'?'} / 연령대: ${ageGroup}</div>
          </div>
          <div class="assess-field-group">
            <label class="assess-field-label">VO2peak 등급 (자동계산)</label>
            <div id="cardio-idx-disp" style="font-size:16px;font-weight:700;color:var(--color-primary-dark);padding:8px 0;">
              ${cardioIdx||'<span style="color:var(--color-gray-400);font-size:13px;">입력 후 자동계산</span>'}
            </div>
          </div>
          ${this._saveBtns(canWrite,!!d,'ergo')}
        </div>
        <!-- 우: 시각화 -->
        <div class="assess-sub-section">
          <div style="font-size:12px;font-weight:700;color:var(--color-gray-500);margin-bottom:8px;">VO2peak 등급 구간</div>
          <div id="viz-ergo">${segGauge(v.cardioScore)}</div>
          <div style="margin-top:10px;padding:10px;background:var(--color-gray-50);border-radius:8px;">
            <div style="font-size:11px;font-weight:700;color:var(--color-gray-500);margin-bottom:6px;">${ageGroup} 기준 등급표 (${c?.gender||'?'})</div>
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead><tr style="background:var(--color-gray-100);">
                <th style="padding:3px 6px;text-align:left;font-weight:700;">등급</th>
                <th style="padding:3px 6px;text-align:center;">60~65세</th>
                <th style="padding:3px 6px;text-align:center;">66세 이상</th>
              </tr></thead>
              <tbody>
                ${(isMale?
                  [['최우수','40.0↑','37.0↑'],['우수','36.0~39.9','33.0~37.0'],['평균이상','32.0~35.9','29.0~32.9'],['평균','29.0~31.9','26.0~28.9'],['평균이하','25.0~28.9','22.0~25.9'],['최하위','25.0↓','22.0↓']]:
                  [['최우수','33.0↑','32.0↑'],['우수','29.0~32.9','28.0~32.0'],['평균이상','25.0~28.9','25.0~27.9'],['평균','22.0~24.9','22.0~24.9'],['평균이하','19.0~21.9','19.0~21.9'],['최하위','19.0↓','19.0↓']]
                ).map((r,i)=>
                  `<tr style="background:${cardioIdx&&cardioIdx.includes(r[0])?'#E3F2FD':''};">
                    <td style="padding:3px 6px;font-weight:${cardioIdx&&cardioIdx.includes(r[0])?'700':'400'};color:${['#1B5E20','#2E7D32','#388E3C','#F57F17','#E65100','#C62828'][i]};">${r[0]}</td>
                    <td style="padding:3px 6px;text-align:center;">${r[1]}</td>
                    <td style="padding:3px 6px;text-align:center;">${r[2]}</td>
                  </tr>`
                ).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div></div>`;
    if (canWrite) {
      area?.querySelector('#f-erg-score')?.addEventListener('input',e=>{
        const score=parseFloat(e.target.value);
        const idx=this._calcCardioIndex(score,c?.gender,c?.birthDate);
        const disp=area.querySelector('#cardio-idx-disp');
        if (disp) disp.innerHTML=idx?`<span style="font-size:16px;font-weight:700;color:var(--color-primary-dark);">${idx}</span>`:'<span style="color:var(--color-gray-400);font-size:13px;">입력 후 자동계산</span>';
        const viz=area.querySelector('#viz-ergo');
        if (viz) viz.innerHTML=segGauge(score);
      });
      area?.querySelectorAll('.sec-save-btn').forEach(b=>b.addEventListener('click',()=>this._saveErgo()));
      area?.querySelectorAll('.sec-del-btn[data-sec="ergo"]').forEach(b=>b.addEventListener('click',()=>this._deleteSheet('ergo')));
    }
  },
  _saveErgo: async function() {
    const c=this.selectedClient;
    const date=document.getElementById('f-erg-date')?.value?.trim();
    const score=document.getElementById('f-erg-score')?.value?.trim();
    if (!date){UI.toast('측정일을 입력해주세요.','error');return;}
    if (!score){UI.toast('심폐기능 점수를 입력해주세요.','error');return;}
    await this._callSave(()=>API.saveErgo(c.clientId,this.activeRound,{measureDate:date,cardioScore:Number(score),gender:c.gender,birthDate:c.birthDate}));
  },

  _renderEverex: function(area) {
    if (!area) return;
    const canWrite=this._canWrite('movement'),d=this.roundData?.everex||null,v=d||{},ro=canWrite?'':'readonly';
    const score = v.bodyMovementIndex;
    area.innerHTML=`<div class="assess-sub-card">
      <div class="assess-sub-card-header">에버엑스 (신체 움직임) ${d?``:'<span class="assess-empty-badge">미입력</span>'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
        <div class="assess-sub-section" style="border-right:1px solid var(--color-gray-100);">
          <div class="assess-field-group" style="margin-bottom:12px;">
            <label class="assess-field-label">측정일 <span class="required">*</span></label>
            <input type="date" id="f-evx-date" class="form-control" value="${v.measureDate||AssessUtils._fmt(new Date())}" ${ro}>
          </div>
          <div class="assess-field-group">
            <label class="assess-field-label">신체 움직임 점수 <span class="required">*</span> <span style="font-size:11px;color:#888;">(점)</span></label>
            <input type="number" id="f-evx-idx" class="form-control" value="${score??''}" placeholder="0~100" min="0" max="100" step="1" ${ro}
              style="font-size:20px;height:52px;font-weight:700;text-align:center;">
          </div>
          ${this._saveBtns(canWrite,!!d,'everex')}
        </div>
        <div class="assess-sub-section" style="display:flex;align-items:center;justify-content:center;">
          <div id="viz-evx" style="text-align:center;width:100%;max-width:260px;">
            <div style="display:flex;align-items:baseline;gap:6px;justify-content:center;margin-bottom:10px;">
              <span style="font-size:52px;font-weight:900;color:var(--color-primary-dark);">${score!=null?score:'-'}</span>
              <span style="font-size:18px;color:var(--color-gray-400);font-weight:600;">/ 100점</span>
            </div>
            ${AssessVisuals.uiBarFull(score, 100, 10, 'var(--color-primary-dark)')}
          </div>
        </div>
      </div></div>`;
    if (canWrite) {
      area?.querySelector('#f-evx-idx')?.addEventListener('input',e=>{
        const viz=area.querySelector('#viz-evx');
        const val=e.target.value.trim();
        const num = val===''?null:Number(val);
        if (viz) viz.innerHTML=`<div style="display:flex;align-items:baseline;gap:6px;justify-content:center;margin-bottom:10px;"><span style="font-size:52px;font-weight:900;color:var(--color-primary-dark);">${val||'-'}</span><span style="font-size:18px;color:var(--color-gray-400);font-weight:600;">/ 100점</span></div>${AssessVisuals.uiBarFull(num, 100, 10, 'var(--color-primary-dark)')}`;
      });
      area?.querySelectorAll('.sec-save-btn').forEach(b=>b.addEventListener('click',()=>this._saveEverex()));
      area?.querySelectorAll('.sec-del-btn[data-sec="everex"]').forEach(b=>b.addEventListener('click',()=>this._deleteSheet('everex')));
    }
  },
  _saveEverex: async function() {
    const date=document.getElementById('f-evx-date')?.value?.trim();
    const idx=document.getElementById('f-evx-idx')?.value?.trim();
    if (!date){UI.toast('측정일을 입력해주세요.','error');return;}
    if (!idx){UI.toast('신체 움직임 지수를 입력해주세요.','error');return;}
    await this._callSave(()=>API.saveEverex(this.selectedClient.clientId,this.activeRound,{measureDate:date,bodyMovementIndex:Number(idx)}));
  },

  _renderFra: function(area) {
    if (!area) return;
    const canWrite=this._canWrite('movement'),d=this.roundData?.fra||null,v=d||{},ro=canWrite?'':'readonly';

    // 기준값에서 항목명 가져오기
    const nervItems = StandardsCache.get('inbodyFra_nervous') || [{label:'신경계 평가'},{label:'반응시간 평가'},{label:'자세유지시간 평가'}];
    const balItems  = StandardsCache.get('inbodyFra_balance') || [{label:'통합 균형 능력 평가'},{label:'빠르게 무게중심 옮기기 평가'},{label:'과녁 따라 무게중심 옮기기 평가'}];
    const sensItems = StandardsCache.get('inbodyFra_sensory') || [{label:'감각계 평가'},{label:'체성감각 평가'},{label:'시각 평가'},{label:'전정감각 평가'}];

    const fraViz = (score, label, items) => AssessVisuals.fraBarBlock(label, score, 100, items);
    const fraCol = (id, label, score, items) => `
      <div style="padding:12px 14px;border-right:1px solid var(--color-gray-100);display:flex;flex-direction:column;align-items:center;">
        <div style="font-size:12px;font-weight:700;color:var(--color-gray-600);margin-bottom:6px;text-align:center;">${label}</div>
        <input type="number" id="${id}" class="form-control" value="${score??''}" placeholder="0~100" min="0" max="100" step="1" ${ro}
          style="height:44px;font-size:18px;font-weight:700;text-align:center;margin-bottom:12px;width:100%;">
        <div class="viz-fra-item" data-id="${id}" style="width:100%;">
          ${fraViz(score, label, items)}
        </div>
      </div>`;

    area.innerHTML=`<div class="assess-sub-card">
      <div class="assess-sub-card-header">인바디 FRA (신경계·균형·감각) ${d?``:'<span class="assess-empty-badge">미입력</span>'}</div>
      <!-- 측정일 -->
      <div style="padding:10px 14px;border-bottom:1px solid var(--color-gray-100);">
        <label class="assess-field-label">측정일 <span class="required">*</span></label>
        <input type="date" id="f-fra-date" class="form-control" value="${v.measureDate||AssessUtils._fmt(new Date())}" ${ro} style="max-width:200px;margin-top:4px;">
      </div>
      <!-- 3열: 각 항목 입력+막대 -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;">
        ${fraCol('f-fra-nerv','신경계 점수',v.nervousScore,nervItems)}
        ${fraCol('f-fra-bal','통합 균형능력 점수',v.balanceScore,balItems)}
        <div style="padding:12px 14px;display:flex;flex-direction:column;align-items:center;">
          <div style="font-size:12px;font-weight:700;color:var(--color-gray-600);margin-bottom:6px;text-align:center;">감각계 점수</div>
          <input type="number" id="f-fra-sens" class="form-control" value="${v.sensoryScore??''}" placeholder="0~100" min="0" max="100" step="1" ${ro}
            style="height:44px;font-size:18px;font-weight:700;text-align:center;margin-bottom:12px;width:100%;">
          <div class="viz-fra-item" data-id="f-fra-sens" style="width:100%;">
            ${fraViz(v.sensoryScore, '감각계 점수', sensItems)}
          </div>
        </div>
      </div>
      <div style="padding:12px 14px;border-top:1px solid var(--color-gray-100);">
        ${this._saveBtns(canWrite,!!d,'fra')}
      </div>
    </div>`;

    if (canWrite) {
      const fraItems=[
        {id:'#f-fra-nerv',label:'신경계 점수',items:nervItems},
        {id:'#f-fra-bal',label:'통합 균형능력 점수',items:balItems},
        {id:'#f-fra-sens',label:'감각계 점수',items:sensItems}
      ];
      fraItems.forEach(({id,label,items})=>{
        area?.querySelector(id)?.addEventListener('input', e => {
          const val=parseFloat(e.target.value);
          const vizEl=area.querySelector(`.viz-fra-item[data-id="${id.replace('#','')}"]`);
          if (vizEl) vizEl.innerHTML=fraViz(isNaN(val)?null:val, label, items);
        });
      });
      area?.querySelectorAll('.sec-save-btn').forEach(b=>b.addEventListener('click',()=>this._saveFra()));
      area?.querySelectorAll('.sec-del-btn[data-sec="fra"]').forEach(b=>b.addEventListener('click',()=>this._deleteSheet('fra')));
    }
  },
  _saveFra: async function() {
    const gn=id=>{const v=document.getElementById(id)?.value?.trim();return(v===''||v==null)?null:Number(v);};
    const date=document.getElementById('f-fra-date')?.value?.trim();
    if (!date){UI.toast('측정일을 입력해주세요.','error');return;}
    await this._callSave(()=>API.saveFra(this.selectedClient.clientId,this.activeRound,{measureDate:date,nervousScore:gn('f-fra-nerv'),balanceScore:gn('f-fra-bal'),sensoryScore:gn('f-fra-sens')}));
  },

  _renderMetabolism: function(area) {
    // ✅ 컨테이너 먼저 노출 후 순차 렌더링
    area.innerHTML = '<div id="meta-inbody-area"></div><div id="meta-stress-area" style="margin-top:20px;"></div>';
    const canWrite = this._canWrite('metabolism');

    // ✅ 인바디 먼저 렌더, 스트레스는 다음 프레임에
    this._renderInbody(area.querySelector('#meta-inbody-area'));
    requestAnimationFrame(() => {
      this._renderStress(area.querySelector('#meta-stress-area'));
      if (canWrite) {
        const allSaveDiv = document.createElement('div');
        allSaveDiv.style.cssText = 'display:flex;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:2px solid var(--color-gray-200);';
        allSaveDiv.innerHTML = `<button class="btn btn-primary" id="meta-all-save-btn" style="min-width:160px;">전체 임시저장</button>`;
        area.appendChild(allSaveDiv);
        allSaveDiv.querySelector('#meta-all-save-btn').addEventListener('click', () => this._saveMetabolismAll());
      }
    });
  },

  _saveMetabolismAll: async function() {
    const gn = id => { const v=document.getElementById(id)?.value?.trim(); return (v===''||v==null)?null:Number(v); };
    const gv = id => document.getElementById(id)?.value?.trim()||'';
    const c = this.selectedClient;
    let saved = 0, errors = [];
    try {
      UI.showLoading();
      const inbDate=gv('f-inb-date'), inbScore=gv('f-inb-score');
      const strDate=gv('f-str-date'), strScore=gv('f-str-score');
      if (inbDate || inbScore) {
        if (!inbDate) { errors.push('인바디: 측정일 필요'); }
        else if (!inbScore) { errors.push('인바디: 체성분 점수 필요'); }
        else {
          const res = await API.saveInbody(c.clientId, this.activeRound, {measureDate:inbDate, bodyCompScore:Number(inbScore)});
          if (res.status==='success') saved++; else errors.push('인바디: '+res.message);
        }
      }
      if (strDate || strScore) {
        if (!strDate) { errors.push('스트레스: 측정일 필요'); }
        else if (!strScore) { errors.push('스트레스: 점수 필요'); }
        else {
          const res = await API.saveStress(c.clientId, this.activeRound, {measureDate:strDate, stressScore:Number(strScore)});
          if (res.status==='success') saved++; else errors.push('스트레스: '+res.message);
        }
      }
    } finally { UI.hideLoading(); }
    if (saved > 0) {
      UI.toast(`대사 평가 ${saved}개 임시저장 완료`, 'success');
      await this._loadRoundData();
    }
    if (errors.length) UI.toast(errors.join(', '), 'error');
    else if (saved === 0) UI.toast('입력된 데이터가 없습니다.', 'warning');
  },

  _renderInbody: function(area) {
    if (!area) return;
    const canWrite=this._canWrite('metabolism'),d=this.roundData?.inbody||null,v=d||{},ro=canWrite?'':'readonly';
    const score = v.bodyCompScore;
    area.innerHTML=`<div class="assess-sub-card">
      <div class="assess-sub-card-header">인바디 (체성분) ${d?``:'<span class="assess-empty-badge">미입력</span>'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
        <div class="assess-sub-section" style="border-right:1px solid var(--color-gray-100);">
          <div class="assess-field-group" style="margin-bottom:12px;">
            <label class="assess-field-label">측정일 <span class="required">*</span></label>
            <input type="date" id="f-inb-date" class="form-control" value="${v.measureDate||AssessUtils._fmt(new Date())}" ${ro}>
          </div>
          <div class="assess-field-group">
            <label class="assess-field-label">체성분 종합 점수 <span class="required">*</span> <span style="font-size:11px;color:#888;">(점)</span></label>
            <input type="number" id="f-inb-score" class="form-control" value="${score??''}" placeholder="점수 입력" min="0" step="1" ${ro}
              style="font-size:20px;height:52px;font-weight:700;text-align:center;">
          </div>
          ${this._saveBtns(canWrite,!!d,'inbody')}
        </div>
        <div class="assess-sub-section" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div id="viz-inb" style="text-align:center;width:100%;max-width:260px;">
            <div style="display:flex;align-items:baseline;gap:6px;justify-content:center;margin-bottom:10px;">
              <span style="font-size:52px;font-weight:900;color:#2E7D32;">${score!=null?score:'-'}</span>
              <span style="font-size:18px;color:var(--color-gray-400);font-weight:600;">/ 100점</span>
            </div>
            ${AssessVisuals.uiBarFull(score, 100, 10, '#2E7D32')}
          </div>
          <div style="font-size:11px;color:var(--color-gray-400);margin-top:12px;text-align:center;max-width:160px;">
            ※ 근육이 매우 많을 경우 100점이 넘을 수 있습니다.
          </div>
        </div>
      </div></div>`;
    if (canWrite) {
      area?.querySelector('#f-inb-score')?.addEventListener('input',e=>{
        const viz=area.querySelector('#viz-inb');
        const val=e.target.value.trim();
        const num = val===''?null:Number(val);
        if (viz) viz.innerHTML=`<div style="display:flex;align-items:baseline;gap:6px;justify-content:center;margin-bottom:10px;"><span style="font-size:52px;font-weight:900;color:#2E7D32;">${val||'-'}</span><span style="font-size:18px;color:var(--color-gray-400);font-weight:600;">/ 100점</span></div>${AssessVisuals.uiBarFull(num, 100, 10, '#2E7D32')}`;
      });
      area?.querySelectorAll('.sec-save-btn[data-sec="inbody"]').forEach(b=>b.addEventListener('click',()=>this._saveInbody()));
      area?.querySelectorAll('.sec-del-btn[data-sec="inbody"]').forEach(b=>b.addEventListener('click',()=>this._deleteSheet('inbody')));
    }
  },
  _saveInbody: async function() {
    const date=document.getElementById('f-inb-date')?.value?.trim();
    const score=document.getElementById('f-inb-score')?.value?.trim();
    if (!date){UI.toast('측정일을 입력해주세요.','error');return;}
    if (!score){UI.toast('체성분 종합 점수를 입력해주세요.','error');return;}
    await this._callSave(()=>API.saveInbody(this.selectedClient.clientId,this.activeRound,{measureDate:date,bodyCompScore:Number(score)}));
  },

  _renderStress: function(area) {
    if (!area) return;
    const canWrite=this._canWrite('metabolism'),d=this.roundData?.stress||null,v=d||{},ro=canWrite?'':'readonly';
    const stressGrades=[
      {l:'정상',max:34,color:'#2E7D32',bg:'#E8F5E9'},
      {l:'초기',max:44,color:'#F57F17',bg:'#FFF8E1'},
      {l:'진행',max:59,color:'#E65100',bg:'#FBE9E7'},
      {l:'만성',max:999,color:'#C62828',bg:'#FFEBEE'}
    ];
    const getGrade=score=>{
      if (score==null||isNaN(score)) return null;
      return stressGrades.find(g=>Number(score)<=g.max)||stressGrades[3];
    };
    // ── 스트레스 시각화는 AssessVisuals로 위임 ──
    const segStress=(score)=> AssessVisuals.stressSegGauge(score);
    
    const si=this._calcStressIndex(v.stressScore);
    area.innerHTML=`<div class="assess-sub-card">
      <div class="assess-sub-card-header">스트레스 ${d?``:'<span class="assess-empty-badge">미입력</span>'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
        <div class="assess-sub-section" style="border-right:1px solid var(--color-gray-100);">
          <div class="assess-field-group" style="margin-bottom:12px;">
            <label class="assess-field-label">측정일 <span class="required">*</span></label>
            <input type="date" id="f-str-date" class="form-control" value="${v.measureDate||AssessUtils._fmt(new Date())}" ${ro}>
          </div>
          <div class="assess-field-group" style="margin-bottom:12px;">
            <label class="assess-field-label">스트레스 점수 <span class="required">*</span> <span style="font-size:11px;color:#888;">(점)</span></label>
            <input type="number" id="f-str-score" class="form-control" value="${v.stressScore??''}" placeholder="점수 입력" min="0" step="1" ${ro}
              style="font-size:20px;height:52px;font-weight:700;text-align:center;">
          </div>
          <div class="assess-field-group">
            <label class="assess-field-label">스트레스 등급 (자동계산)</label>
            <div id="stress-grade-disp" style="font-size:20px;font-weight:800;padding:8px 0;color:${si?si.color:'#888'};">
              ${si?`<span style="background:${si.bg};color:${si.color};padding:6px 16px;border-radius:10px;">${si.label}</span>`:'<span style="color:var(--color-gray-400);font-size:13px;">입력 후 자동계산</span>'}
            </div>
          </div>
          ${this._saveBtns(canWrite,!!d,'stress')}
        </div>
        <div class="assess-sub-section" id="viz-stress-area">
          ${segStress(v.stressScore)}
        </div>
      </div></div>`;
    if (canWrite) {
      area?.querySelector('#f-str-score')?.addEventListener('input',e=>{
        const score=parseFloat(e.target.value);
        const si=this._calcStressIndex(score);
        const disp=area.querySelector('#stress-grade-disp');
        if (disp) disp.innerHTML=si?`<span style="background:${si.bg};color:${si.color};padding:6px 16px;border-radius:10px;">${si.label}</span>`:'<span style="color:var(--color-gray-400);font-size:13px;">입력 후 자동계산</span>';
        const viz=area.querySelector('#viz-stress-area');
        if (viz) viz.innerHTML=`${segStress(isNaN(score)?null:score)}`;
      });
      area?.querySelectorAll('.sec-save-btn[data-sec="stress"]').forEach(b=>b.addEventListener('click',()=>this._saveStress()));
      area?.querySelectorAll('.sec-del-btn[data-sec="stress"]').forEach(b=>b.addEventListener('click',()=>this._deleteSheet('stress')));
    }
  },
  _saveStress: async function() {
    const date=document.getElementById('f-str-date')?.value?.trim();
    const score=document.getElementById('f-str-score')?.value?.trim();
    if (!date){UI.toast('측정일을 입력해주세요.','error');return;}
    if (!score){UI.toast('스트레스 점수를 입력해주세요.','error');return;}
    await this._callSave(()=>API.saveStress(this.selectedClient.clientId,this.activeRound,{measureDate:date,stressScore:Number(score)}));
  },

  // ── 코멘트 (항목별 독립 저장) ────────────────────────────
  _renderComment: function(area) {
    if (!area) return;
  
    const role = this._role(), canWrite = this._canWrite('comment');
    const d = this.roundData?.comment || null, v = d || {};
  
    // 코멘트 쓰기
    const canCog = ['ADMIN','CARE_MANAGER','COGNITIVE_SPECIALIST'].includes(role);
    const canEx  = ['ADMIN','CARE_MANAGER','EXERCISE_SPECIALIST'].includes(role);
    const canCm  = ['ADMIN','CARE_MANAGER'].includes(role);
  
    // 코멘트 조회
    const canSeeCog = true;
    const canSeeEx  = true;
    const canSeeCm  = true;
  
    const COMMENT_MAX = 500;
  
    // 공백(띄어쓰기, 줄바꿈, 탭) 제외 글자수 계산
    const getCommentLength = text => (text || '').replace(/\s/g, '').length;
  
    const block = (id, label, val, editable, updated, saveable) => `
      <div class="assess-sub-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div class="assess-sub-title" style="margin-bottom:0;">${label}</div>
        </div>
  
        <textarea
          id="${id}"
          class="form-control"
          rows="10"
          style="resize:vertical;min-height:200px;"
          placeholder="${editable ? label + ' 입력...' : '조회 전용'}"
          ${!editable ? 'readonly' : ''}
        >${val || ''}</textarea>
  
        <div id="${id}-count"
             style="text-align:right;font-size:12px;color:var(--color-gray-400);margin-top:4px;">
          ${getCommentLength(val)} / ${COMMENT_MAX}자 (공백 제외)
        </div>
  
        ${
          saveable && editable
          ? `
          <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;">
            ${
              val
              ? `<button class="btn btn-sm cmt-del-btn"
                    data-field="${id}"
                    style="background:transparent;color:#E53935;border:1px solid #E53935;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;">
                  삭제
                </button>`
              : ''
            }
  
            <button class="btn btn-sm cmt-save-btn"
                    data-field="${id}"
                    style="background:transparent;color:var(--color-primary-dark);border:1.5px solid var(--color-primary-dark);border-radius:8px;padding:5px 14px;font-size:12px;cursor:pointer;">
              임시저장
            </button>
          </div>
          `
          : ''
        }
      </div>
    `;
  
    area.innerHTML = `
      <div class="assess-form-card">
  
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="font-size:17px;font-weight:800;">💬 코멘트</div>
        </div>
  
        ${canSeeCog ? block('f-cmt-cog','🧠 인지 전문가 코멘트',v.cogComment,canCog,v.cogUpdated,canCog) : ''}
        ${canSeeEx  ? block('f-cmt-ex','🏃 운동 전문가 코멘트',v.exComment,canEx,v.exUpdated,canEx) : ''}
        ${canSeeCm  ? block('f-cmt-cm','💼 케어 매니저 코멘트',v.cmComment,canCm,v.cmUpdated,canCm) : ''}
  
        ${
          canWrite
          ? `
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--color-gray-100);">
            <button
              id="assess-save-btn"
              style="background:transparent;color:var(--color-primary-dark);border:1.5px solid var(--color-primary-dark);border-radius:8px;padding:8px 22px;font-size:13px;font-weight:700;cursor:pointer;">
              전체 임시저장
            </button>
          </div>
          `
          : ''
        }
  
      </div>
    `;
  
    if (canWrite) {
  
      area.querySelectorAll('.assess-sub-section textarea[id^="f-cmt-"]').forEach(ta => {
  
        const counter = document.getElementById(`${ta.id}-count`);
        if (!counter) return;
  
        ta.addEventListener('input', () => {
  
          let value = ta.value;
          let count = getCommentLength(value);
  
          // 공백 제외 500자 제한
          while (count > COMMENT_MAX) {
            value = value.slice(0, -1);
            count = getCommentLength(value);
          }
  
          if (value !== ta.value) {
            ta.value = value;
          }
  
          counter.textContent = `${count} / ${COMMENT_MAX}자 (공백 제외)`;
          counter.style.color =
            count >= COMMENT_MAX
              ? '#E53935'
              : 'var(--color-gray-400)';
        });
  
      });
  
      area.querySelectorAll('.cmt-save-btn').forEach(btn => {
        btn.addEventListener('click', () => {
  
          const field = btn.dataset.field;
          const val = document.getElementById(field)?.value?.trim() || '';
  
          const data = {};
  
          if (field === 'f-cmt-cog') data.cogComment = val;
          if (field === 'f-cmt-ex')  data.exComment  = val;
          if (field === 'f-cmt-cm')  data.cmComment  = val;
  
          this._callSave(() =>
            API.saveComment(this.selectedClient.clientId, this.activeRound, data)
          );
  
        });
      });
  
      area.querySelectorAll('.cmt-del-btn').forEach(btn => {
  
        btn.addEventListener('click', async () => {
  
          const field = btn.dataset.field;
  
          const ok = await UI.confirm({
            title:'코멘트를 삭제하시겠습니까?',
            message:'해당 코멘트가 삭제됩니다.',
            confirmText:'삭제',
            cancelText:'취소',
            type:'danger'
          });
  
          if (!ok) return;
  
          const data = {};
  
          if (field === 'f-cmt-cog') data.cogComment = '';
          if (field === 'f-cmt-ex')  data.exComment  = '';
          if (field === 'f-cmt-cm')  data.cmComment  = '';
  
          this._callSave(() =>
            API.saveComment(this.selectedClient.clientId, this.activeRound, data)
          );
  
        });
  
      });
  
      document.getElementById('assess-save-btn')
        ?.addEventListener('click', () => this._saveComment());
    }
  },
  
  _saveComment: async function() {
  
    const role = this._role();
    const data = {};
  
    if (['ADMIN','CARE_MANAGER','COGNITIVE_SPECIALIST'].includes(role))
      data.cogComment = document.getElementById('f-cmt-cog')?.value?.trim() || '';
  
    if (['ADMIN','CARE_MANAGER','EXERCISE_SPECIALIST'].includes(role))
      data.exComment = document.getElementById('f-cmt-ex')?.value?.trim() || '';
  
    if (['ADMIN','CARE_MANAGER'].includes(role))
      data.cmComment = document.getElementById('f-cmt-cm')?.value?.trim() || '';
  
    await this._callSave(() =>
      API.saveComment(this.selectedClient.clientId, this.activeRound, data)
    );
  },

  // ── 공통 버튼 ────────────────────────────────────────────
  _saveBtns: function(canWrite, hasData, secId) {
    if (!canWrite) return `<div style="margin-top:12px;padding:10px 14px;background:var(--color-gray-100);border-radius:8px;font-size:13px;color:var(--color-gray-500);">⚠️ 조회 전용 — 입력 권한이 없습니다.</div>`;
    return `<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--color-gray-100);">
      ${hasData?`<button class="sec-del-btn" data-sec="${secId}"
        style="background:transparent;color:#E53935;border:1px solid #E53935;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;">삭제</button>`:''}
      <button class="sec-save-btn" data-sec="${secId}"
        style="background:transparent;color:var(--color-primary-dark);border:1.5px solid var(--color-primary-dark);border-radius:8px;padding:7px 20px;font-size:13px;font-weight:700;cursor:pointer;">
        ${hasData?'임시수정':'임시저장'}
      </button>
    </div>`;
  },

  // 리포트 생성된 회차 수정 전 경고
  _confirmIfReported: async function() {
    const isReported = this.roundData?.master?.reportGenerated;
    if (!isReported) return true;
    return await UI.confirm({
      title:'평가 수정 시 기존 통합 리포트가 삭제됩니다.',
      message:'평가 수정 시 기존 통합 리포트가 삭제되며, 수정 후 다시 생성해야 합니다. 계속 진행하시겠습니까?',
      confirmText:'수정', cancelText:'취소', type:'warning'
    });
  },

  _callSave: async function(apiFn) {
    // 리포트가 있으면 사전 확인
    const ok = await this._confirmIfReported();
    if (!ok) return;

    const btn=document.getElementById('assess-save-btn');
    if (btn) btn.disabled=true;
    const wasReported = this.roundData?.master?.reportGenerated;
    try {
      UI.showLoading();
      const res=await apiFn();
      if (res.status==='success') {
        // 리포트가 있었으면 무효화
        if (wasReported) {
          await API.invalidateReport(this.selectedClient.clientId, this.activeRound);
          UI.toast('평가가 수정되었습니다. 통합 리포트를 다시 생성해주세요.', 'warning');
        } else {
          UI.toast(res.data?.message||'저장되었습니다.','success');
        }
        // ✅ getInitialData 제거 — roundData만 갱신
        await this._loadRoundData();
      } else UI.toast(res.message||'저장 실패','error');
    } catch { UI.toast('서버 오류가 발생했습니다.','error'); }
    finally { UI.hideLoading(); if(btn) btn.disabled=false; }
  },

  _deleteSheet: async function(sheetType) {
    const labels={cognitive:'인지평가',ergo:'에르고미터',everex:'에버엑스',fra:'인바디FRA',inbody:'인바디',stress:'스트레스',comment:'코멘트'};
    const ok=await UI.confirm({title:'정말 삭제하시겠습니까?',message:`${this.activeRound===1?"초기":((this.activeRound-1)*4)+"주차"} ${labels[sheetType]||sheetType} 데이터가 삭제됩니다.`,confirmText:'삭제',cancelText:'취소',type:'danger'});
    if (!ok) return;
    try {
      UI.showLoading();
      const res=await API.deleteSheetRow(this.selectedClient.clientId,this.activeRound,sheetType);
      if (res.status==='success') {
        UI.toast(res.data.message,'success');
        // ✅ getInitialData 제거 — roundData만 갱신
        await this._loadRoundData();
      } else UI.toast(res.message||'삭제 실패','error');
    } catch { UI.toast('서버 오류가 발생했습니다.','error'); }
    finally { UI.hideLoading(); }
  },

  _handleGenerateReport: async function() {
    const alreadyExists=this.roundData?.master?.reportGenerated;
    let confirmed=false;
    if (alreadyExists) {
      confirmed=await UI.confirm({title:'이미 생성된 통합 리포트가 있습니다.',message:'기존 리포트를 삭제하고 다시 생성하시겠습니까?',confirmText:'재생성',cancelText:'취소',type:'warning'});
    } else {
      confirmed=await UI.confirm({title:`${this.activeRound===1?"초기":((this.activeRound-1)*4)+"주차"} 통합 리포트를 생성하시겠습니까?`,message:'4개 평가가 모두 완료된 경우에만 생성됩니다.',confirmText:'생성',cancelText:'취소',type:'warning'});
    }
    if (!confirmed) return;
    try {
      UI.showLoading();
      const res=await API.generateReport(this.selectedClient.clientId,this.activeRound,alreadyExists);
      if (res.status==='success') {
        UI.toast(res.data.message,'success');
        const ir=await API.getInitialData();
        if (ir.status==='success') {
          // ✅ 위와 동일하게 '입소예정' 고객도 포함 (초기 평가는 입소 전부터 가능)
          this.allClients=(ir.data.clients||[]).filter(c=>c.status==='입소중'||c.status==='입소예정');
          this.overview=ir.data.overview||{};
          const updated=this.allClients.find(c=>c.clientId===this.selectedClient.clientId);
          if (updated) this.selectedClient=updated;
        }
        this._renderClientList();
        this._renderAssessMain();
        await this._loadRoundData();
        // 리포트 즉시 보기 팝업
        if (res.data.masterData) this._showReportModal(res.data.masterData);
      } else UI.toast(res.message||'생성 실패','error');
    } catch { UI.toast('서버 오류가 발생했습니다.','error'); }
    finally { UI.hideLoading(); }
  },

  _showReportModal: async function(masterData) {
    const c = this.selectedClient;
    // 추이 그래프를 위해 전체 masterList 조회
    let masterList = [masterData];
    try {
      const res = await API.getClientMasterList(c.clientId);
      if (res.status === 'success') masterList = ClientDetailPage._dedupeMasterList(res.data.masterList || [masterData]);
    } catch(e) {}

    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.id = 'report-instant-modal';
    const reportHtml = ClientDetailPage._buildReportHTML.call({client:c}, masterData, masterList);
    wrap.innerHTML = `
      <div class="modal" style="max-width:820px;max-height:92vh;display:flex;flex-direction:column;">
        <div class="modal-header">
          <h3 class="modal-title">📄 통합 리포트 생성 완료 — ${c.name} ${this.activeRound}회차</h3>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm" id="rpt-instant-print">🖨️ PDF 출력</button>
            <button class="modal-close" id="rpt-instant-close">✕</button>
          </div>
        </div>
        <div class="modal-body" style="overflow-y:auto;flex:1;background:#f5f5f5;padding:16px;">
          <div id="rpt-instant-area" style="background:white;border-radius:8px;overflow:hidden;">${reportHtml}</div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById('rpt-instant-close').onclick = () => wrap.remove();
    wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };
    document.getElementById('rpt-instant-print').onclick = () => {
      const ctx = Object.create(ClientDetailPage);
      ctx.client = c;
      ctx._masterListCache = masterList;
      ctx._printReport(masterData);
    };
  },

  // ── 공통 conic-gradient 도넛 차트 ─────────────────────────
  _conicDonut: function(score, color, max, size, thickness) {
    return AssessVisuals.conicDonut(score, color, max, size, thickness);
  }
};
