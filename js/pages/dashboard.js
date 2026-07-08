// ============================================================
// pages/dashboard.js - v16
// ============================================================

const DashboardPage = {

  _sort: {
    delayed:    { col:'delayDays', dir:'desc' },
    waiting:    { col:'deadline',  dir:'asc'  },
    inProgress: { col:'deadline',  dir:'asc'  },
    completed:  { col:'reportCreatedAt', dir:'desc' },
    assess:     { col:'deadline',  dir:'asc'  }
  },

  render: async function() {
    const pageEl = document.getElementById('page-content');

    // ── 캐시 히트 여부 즉시 확인 ──────────────────────────────
    const cached = API._getCached('getInitialData', {action:'getInitialData', requesterId: Auth.getUser()?.userId||''});
    if (cached) {
      // 캐시 있음 → 헤더만 먼저 표시 후 즉시 렌더
      pageEl.innerHTML = `
        <div class="page-header" style="margin-bottom:14px;">
          <h1 class="page-title">대시보드</h1>
          <p class="page-subtitle">케어허브 운영 현황을 한눈에 확인합니다.</p>
        </div>
        <div id="dash-body"></div>`;
      this._clients  = cached.data?.clients  || [];
      this._overview = cached.data?.overview || {};
      this._renderAll();
      // 백그라운드에서 최신 데이터 갱신 (60초 TTL 만료 전이라도 1분 이상 됐으면)
      if (Date.now() - cached.ts > 30000) {
        API.getInitialData().then(r => {
          if (r.status==='success') {
            this._clients  = r.data.clients  || [];
            this._overview = r.data.overview || {};
            this._renderAll();
          }
        }).catch(()=>{});
      }
      return;
    }

    // ── 캐시 없음 → 스켈레톤 표시 후 로딩 ──────────────────────
    pageEl.innerHTML = `
      <div class="page-header" style="margin-bottom:14px;">
        <h1 class="page-title">대시보드</h1>
        <p class="page-subtitle">케어허브 운영 현황을 한눈에 확인합니다.</p>
      </div>
      <div id="dash-body">
        <style>@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
          ${[1,2,3,4].map(()=>`<div style="height:80px;border-radius:12px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.2s infinite;"></div>`).join('')}
        </div>
        <div style="height:200px;border-radius:12px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.2s infinite;"></div>
      </div>`;
    try {
      const r = await API.getInitialData();
      this._clients  = r.status==='success' ? (r.data.clients||[])  : [];
      this._overview = r.status==='success' ? (r.data.overview||{}) : {};
      this._renderAll();
    } catch(e) { UI.toast('로드 실패: '+e.message, 'error'); }
  },

  _renderAll: function() {
    const el = document.getElementById('dash-body');
    if (el) this._render(el, this._clients, this._overview);
  },

  _classify: function(clients, overview) {
    const delayed=[], waiting=[], inProgress=[], completed=[];
    const now = new Date();
    const thisYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    clients.filter(c=>c.status==='입소중').forEach(c => {
      // 이 고객에게 지연 또는 평가중 회차가 하나라도 있으면 → 평가대기 불가
      let clientHasActive = false;
      for (let r=1; r<=c.totalRounds; r++) {
        const ov   = overview[c.clientId]?.rounds[r];
        const prev = r>1 ? overview[c.clientId]?.rounds[r-1] : null;
        const st   = AssessUtils.calcRoundStatus(c.admitDate, r, ov, prev, c.firstVisit);
        if (['DELAYED','IN_PROGRESS','RE_EVAL'].includes(st.key)) { clientHasActive=true; break; }
      }

      for (let round=1; round<=c.totalRounds; round++) {
        const ov     = overview[c.clientId]?.rounds[round];
        const prevOv = round>1 ? overview[c.clientId]?.rounds[round-1] : null;
        const st     = AssessUtils.calcRoundStatus(c.admitDate, round, ov, prevOv, c.firstVisit);
        const period = AssessUtils.getRoundPeriod(c.admitDate, round, c.firstVisit);
        if (!period || st.key === 'NOT_STARTED') continue;

        const deadline   = period.endStr;
        const wk = round===1?'초기':`${(round-1)*4}주차`;
        const wkTotal = c.totalRounds===1?'초기':`${(c.totalRounds-1)*4}주차`;
        const roundLabel = `${wk} / ${wkTotal}`;
        const delayDays  = st.delayDays || 0;
        // 평가중인데 마감일 경과한 경우 → 실제 지연일수 계산
        const isLateProgress = st.key==='IN_PROGRESS' && AssessUtils.today() > period.end;
        const lateProgressDays = isLateProgress
          ? AssessUtils.daysDiff(period.end, AssessUtils.today())
          : 0;
        // 우선순위: 재평가100 > 지연+진행(일수)90+days > 평가중80 > 지연60+일수 > 대기20
        const priority = st.key==='RE_EVAL'?100 : isLateProgress?90+lateProgressDays : st.key==='IN_PROGRESS'?80 : st.key==='DELAYED'?60+delayDays : 20;

        const row = { c, round, roundLabel, st, deadline, delayDays, priority, isLateProgress, lateProgressDays,
          assessDate: ov?.assessDate||'', reportCreatedAt: ov?.reportCreatedAt||'' };

        if (st.key === 'RE_EVAL')      { inProgress.push({...row, isReEval:true, isDelayed:false}); }
        else if (st.key === 'IN_PROGRESS') { inProgress.push({...row, isReEval:false, isDelayed:isLateProgress}); }
        else if (st.key === 'DELAYED') { delayed.push({...row, delayLabel:st.label}); }
        else if (st.key === 'WAITING' && !clientHasActive) { waiting.push(row); }
        else if (st.key === 'COMPLETED' && AssessUtils.isWithin7Days(ov?.reportCreatedAt)) { completed.push(row); }
      }
    });
    return { delayed, waiting, inProgress, completed };
  },

  _applySort: function(arr, tableKey) {
    const s = this._sort[tableKey];
    return [...arr].sort((a,b) => {
      let va, vb;
      const c = s.col;
      if      (c==='room')           { va=parseInt(a.c.roomNum||'9999'); vb=parseInt(b.c.roomNum||'9999'); }
      else if (c==='name')           { va=a.c.name;           vb=b.c.name; }
      else if (c==='round')          { va=a.round;            vb=b.round; }
      else if (c==='delayDays')      { va=a.delayDays||0;     vb=b.delayDays||0; }
      else if (c==='deadline')       { va=a.deadline||'';     vb=b.deadline||''; }
      else if (c==='assessDate')     { va=a.assessDate||'';   vb=b.assessDate||''; }
      else if (c==='reportCreatedAt'){ va=a.reportCreatedAt||''; vb=b.reportCreatedAt||''; }
      else if (c==='priority')       { va=a.priority||0;      vb=b.priority||0; }
      else if (c==='status')         { va=a.priority||0;      vb=b.priority||0; }  // 상태 = 우선순위 기준
      else                           { va=a.deadline||'';     vb=b.deadline||''; }
      const cmp = typeof va==='number' ? va-vb : String(va).localeCompare(String(vb),'ko');
      return s.dir==='asc' ? cmp : -cmp;
    });
  },

  _render: function(el, clients, overview) {
    const fmtDate = str => AssessUtils.fmtDate(str);
    const now = new Date();
    const thisYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    const admitted      = clients.filter(c=>c.status==='입소중');
    const scheduledList = clients.filter(c=>c.status==='입소예정');
    const dischargedList= clients.filter(c=>c.status==='퇴소');
    const newMonthList  = clients.filter(c=>c.admitDate?.startsWith(thisYM));

    let totalRounds=0, reportDone=0;
    const completedReportList = [];
    Object.values(overview).forEach(ov => {
      Object.values(ov.rounds||{}).forEach(r => {
        totalRounds++;
        if (r.reportGenerated) {
          reportDone++;
          // 리포트 완료 리스트용
          const client = clients.find(c => {
            const clientOv = overview[c.clientId];
            return clientOv && Object.values(clientOv.rounds||{}).some(rr => rr === r);
          });
        }
      });
    });
    // 리포트 완료 고객 목록 (clientId별 중복 없이)
    const reportCompletedClients = clients.filter(c => {
      const ov = overview[c.clientId];
      return ov && Object.values(ov.rounds||{}).some(r=>r.reportGenerated);
    });

    const { delayed, waiting, inProgress, completed } = this._classify(clients, overview);

    // 평가 현황: 지연+평가중(입력된 것만)
    // 평가 현황: 평가중(입력이 시작된 것)만 표시 — 지연 단독(미입력) 제외
    const assessRows = this._applySort([...inProgress], 'assess');

    const circleHtml = done => `<span class="cat-circle ${done?'done':'empty'}">${done?'✓':''}</span>`;

    // 정렬 헤더
    const th = (tableKey, col, label, align='left') => {
      const s = this._sort[tableKey];
      const active = s.col===col;
      const arrow  = active ? (s.dir==='asc'?' ↑':' ↓') : ' ↕';
      return `<th class="dash-sort-th" data-table="${tableKey}" data-col="${col}"
        style="cursor:pointer;user-select:none;white-space:nowrap;text-align:${align};">${label}<span style="opacity:0.4;font-size:11px;">${arrow}</span></th>`;
    };

    // KPI 카드 (숫자+단위 인라인)
    const kpiCard = (label, val, color, unit, navKey) => `
      <div class="card kpi-card" style="flex:1;min-width:110px;cursor:pointer;"
        data-kpi="${navKey}">
        <div class="card-body" style="padding:14px 16px;">
          <div style="font-size:13px;color:var(--color-gray-500);margin-bottom:6px;">${label}</div>
          <div style="display:flex;align-items:baseline;gap:4px;">
            <span style="font-size:29px;font-weight:800;color:${color};line-height:1;">${val}</span>
            ${unit?`<span style="font-size:15px;font-weight:600;color:${color};opacity:0.75;">${unit}</span>`:''}
          </div>
          <div style="font-size:11px;color:var(--color-primary);margin-top:4px;opacity:0.6;">클릭하여 조회 →</div>
        </div>
      </div>`;

    // 상태 테이블 (헤더+행)
    const statusTable = (rows, headerHtml, emptyMsg) => {
      if (!rows.length) return `<div style="padding:14px 18px;font-size:14px;color:var(--color-gray-400);text-align:center;">${emptyMsg}</div>`;
      return `<table class="table" style="font-size:15px;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rows.map(r=>r._row).join('')}</tbody>
      </table>`;
    };

    // 행 HTML 생성
    const makeRow = (r, cols) => `<tr class="dash-assess-row" data-cid="${r.c.clientId}" data-round="${r.round}">${cols}</tr>`;
    const tdRoom  = r => `<td style="font-weight:700;color:var(--color-primary-dark);">${r.c.roomNum||'-'}</td>`;
    const tdName  = r => `<td><span class="client-name-link" data-cid="${r.c.clientId}">${r.c.name}</span></td>`;
    const tdRound = r => `<td style="font-size:14px;">${r.roundLabel}</td>`;

    const delayedSorted    = this._applySort(delayed,    'delayed');
    const waitingSorted    = this._applySort(waiting,    'waiting');
    const inProgressSorted = this._applySort(inProgress, 'inProgress');
    const completedSorted  = this._applySort(completed,  'completed');

    const delayedRows    = delayedSorted.map(r => ({...r, _row: makeRow(r,
      tdRoom(r)+tdName(r)+tdRound(r)+
      `<td><span style="color:#E53935;font-weight:700;">${r.delayLabel||r.st.label}</span></td>`
    )}));
    const waitingRows    = waitingSorted.map(r => ({...r, _row: makeRow(r,
      tdRoom(r)+tdName(r)+tdRound(r)+
      `<td style="font-size:14px;color:var(--color-gray-600);">${r.deadline}</td>`
    )}));
    const inProgressRows = inProgressSorted.map(r => ({...r, _row: makeRow(r,
      tdRoom(r)+tdName(r)+tdRound(r)+
      `<td style="font-size:14px;font-weight:600;color:${r.isDelayed?'#E53935':'var(--color-gray-600)'};">${r.deadline}</td>`+
      `<td>${r.isReEval
        ? '<span style="background:#FFF8E1;color:#F9A825;padding:2px 8px;border-radius:8px;font-size:13px;font-weight:700;">재평가</span>'
        : r.isDelayed
          ? `<span style="background:#FFEBEE;color:#E53935;padding:2px 8px;border-radius:8px;font-size:13px;font-weight:700;">지연(${r.lateProgressDays}일)</span>`
          : '<span style="background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:8px;font-size:13px;font-weight:700;">평가중</span>'
        }</td>`
    )}));
    const completedRows  = completedSorted.map(r => ({...r, _row: makeRow(r,
      tdRoom(r)+tdName(r)+tdRound(r)+
      `<td style="font-size:14px;color:var(--color-gray-600);">${fmtDate(r.assessDate)||'-'}</td>`+
      `<td style="font-size:14px;color:var(--color-gray-600);">${fmtDate(r.reportCreatedAt)||'-'}</td>`
    )}));
    const assessRowsHtml = assessRows.map(r => `
      <tr class="dash-assess-row" data-cid="${r.c.clientId}" data-round="${r.round}">
        <td style="font-weight:700;color:var(--color-primary-dark);">${r.c.roomNum||'-'}</td>
        <td><span class="client-name-link" data-cid="${r.c.clientId}" style="font-weight:700;">${r.c.name}</span></td>
        <td><span class="badge badge-role" style="font-size:13px;">${r.roundLabel}</span></td>
        <td style="text-align:center;">${circleHtml(overview[r.c.clientId]?.rounds[r.round]?.cognitiveDone)}</td>
        <td style="text-align:center;">${circleHtml(overview[r.c.clientId]?.rounds[r.round]?.movementDone)}</td>
        <td style="text-align:center;">${circleHtml(overview[r.c.clientId]?.rounds[r.round]?.metabolismDone)}</td>
        <td style="text-align:center;">${circleHtml(overview[r.c.clientId]?.rounds[r.round]?.commentDone)}</td>
        <td style="font-size:14px;font-weight:600;color:${r.isDelayed?'#E53935':'var(--color-gray-600)'};">${r.deadline||'-'}</td>
        <td>
          <span style="background:${r.isReEval?'#FFF8E1':r.isDelayed?'#FFEBEE':'#E8F5E9'};
            color:${r.isReEval?'#F9A825':r.isDelayed?'#E53935':'#2E7D32'};
            padding:3px 10px;border-radius:10px;font-size:13.5px;font-weight:700;white-space:nowrap;">
            ${r.isReEval?'재평가':r.isDelayed?'지연('+r.lateProgressDays+'일)':'평가중'}
          </span>
        </td>
      </tr>`).join('');

    el.innerHTML = `
      <!-- KPI -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
        ${kpiCard('전체 고객',   clients.length,       'var(--color-gray-800)', '명', 'popup-clients-전체')}
        ${kpiCard('입소중',      admitted.length,       '#1565C0',              '명', 'popup-clients-입소중')}
        ${kpiCard('입소예정',    scheduledList.length,  '#F57F17',              '명', 'popup-clients-입소예정')}
        ${kpiCard('퇴소',        dischargedList.length, '#888',                 '명', 'popup-clients-퇴소')}
        ${kpiCard('당월 신규',   newMonthList.length,   '#2E7D32',              '명', 'popup-newmonth')}
        ${kpiCard('리포트 완료', reportDone,            'var(--color-primary)', '',   'popup-reports')}
      </div>

      <!-- 4개 상태 카드 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">

        <div class="card" style="border-top:3px solid #E53935;">
          <div class="card-header" style="padding:12px 16px;">
            <h2 class="card-title" style="font-size:16px;">
              <span style="color:#E53935;">⚠</span> 지연
              ${delayed.length?`<span style="background:#E53935;color:white;font-size:12px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:6px;">${delayed.length}</span>`:''}
            </h2>
          </div>
          <div style="max-height:220px;overflow-y:auto;">
            ${statusTable(delayedRows,
              th('delayed','room','입실호수')+th('delayed','name','고객명')+th('delayed','round','주차')+th('delayed','delayDays','지연'),
              '지연 건 없음 ✓')}
          </div>
        </div>

        <div class="card" style="border-top:3px solid #888;">
          <div class="card-header" style="padding:12px 16px;">
            <h2 class="card-title" style="font-size:16px;">
              ⏳ 평가 대기
              ${waiting.length?`<span style="background:#888;color:white;font-size:12px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:6px;">${waiting.length}</span>`:''}
            </h2>
          </div>
          <div style="max-height:220px;overflow-y:auto;">
            ${statusTable(waitingRows,
              th('waiting','room','입실호수')+th('waiting','name','고객명')+th('waiting','round','주차')+th('waiting','deadline','마감일'),
              '평가 대기 없음')}
          </div>
        </div>

        <div class="card" style="border-top:3px solid #4CAF50;">
          <div class="card-header" style="padding:12px 16px;">
            <h2 class="card-title" style="font-size:16px;">
              ✏️ 평가중
              ${inProgress.filter(r=>!r.isReEval&&!r.isDelayed).length?`<span style="background:#4CAF50;color:white;font-size:12px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:6px;">${inProgress.filter(r=>!r.isReEval&&!r.isDelayed).length}</span>`:''}
              ${inProgress.filter(r=>r.isDelayed).length?`<span style="background:#E53935;color:white;font-size:12px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:4px;">지연 중 진행 ${inProgress.filter(r=>r.isDelayed).length}</span>`:''}
              ${inProgress.filter(r=>r.isReEval).length?`<span style="background:#F9A825;color:white;font-size:12px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:4px;">재평가 ${inProgress.filter(r=>r.isReEval).length}</span>`:''}
            </h2>
          </div>
          <div style="max-height:220px;overflow-y:auto;">
            ${statusTable(inProgressRows,
              th('inProgress','room','입실호수')+th('inProgress','name','고객명')+th('inProgress','round','주차')+th('inProgress','deadline','마감일')+th('inProgress','status','상태'),
              '평가중 없음')}
          </div>
        </div>

        <div class="card" style="border-top:3px solid #1565C0;">
          <div class="card-header" style="padding:12px 16px;">
            <h2 class="card-title" style="font-size:16px;">
              ✅ 평가완료 <span style="font-size:13px;font-weight:400;color:var(--color-gray-400);">(최근 7일)</span>
              ${completed.length?`<span style="background:#1565C0;color:white;font-size:12px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:6px;">${completed.length}</span>`:''}
            </h2>
          </div>
          <div style="max-height:220px;overflow-y:auto;">
            ${statusTable(completedRows,
              th('completed','room','입실호수')+th('completed','name','고객명')+th('completed','round','주차')+th('completed','assessDate','평가완료일')+th('completed','reportCreatedAt','생성일'),
              '최근 7일 완료 없음')}
          </div>
        </div>

      </div>

      <!-- 평가 현황: 지연+평가중만 -->
      <div class="card">
        <div class="card-header" style="padding:14px 20px;">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <h2 class="card-title" style="margin:0;"><span class="card-title-dot"></span>평가 현황</h2>
            <div style="display:flex;gap:8px;font-size:14px;flex-wrap:wrap;">
              ${inProgress.filter(r=>r.isDelayed).length?`<span style="background:#FFEBEE;color:#E53935;padding:3px 10px;border-radius:12px;font-weight:700;">⚠ 지연 중 진행 ${inProgress.filter(r=>r.isDelayed).length}건</span>`:''}
              <span style="background:#E8F5E9;color:#2E7D32;padding:3px 10px;border-radius:12px;font-weight:600;">평가중 ${inProgress.length}건</span>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" id="dash-goto-assess">전체 보기</button>
        </div>
        <div class="card-body" style="padding:0;">
          ${assessRows.length===0
            ? '<div class="empty-state" style="padding:28px;"><div class="empty-state-icon">✅</div><div class="empty-state-text" style="font-size:15px;">진행 중인 평가가 없습니다.</div></div>'
            : `<div style="max-height:320px;overflow-y:auto;">
                <table class="dash-assess-table">
                  <thead><tr>
                    ${th('assess','room','입실호수')}
                    ${th('assess','name','고객명')}
                    ${th('assess','round','주차')}
                    <th style="text-align:center;">인지</th>
                    <th style="text-align:center;">움직임</th>
                    <th style="text-align:center;">대사</th>
                    <th style="text-align:center;">코멘트</th>
                    ${th('assess','deadline','마감일')}
                    ${th('assess','status','상태')}
                  </tr></thead>
                  <tbody>${assessRowsHtml}</tbody>
                </table>
              </div>`}
        </div>
      </div>

      <div id="dash-modal-wrap"></div>
    `;

    // ── 이벤트 ──────────────────────────────────────────────
    // KPI 카드 클릭 → 팝업
    el.querySelectorAll('.kpi-card[data-kpi]').forEach(card => {
      card.addEventListener('click', () => {
        const kpi  = card.dataset.kpi;
        if (kpi.startsWith('popup-clients-')) {
          const tab = kpi.replace('popup-clients-','');
          let popupList;
          if (tab === '전체')     popupList = clients;
          else if (tab === '입소중')  popupList = admitted;
          else if (tab === '입소예정') popupList = scheduledList;
          else if (tab === '퇴소')   popupList = dischargedList;
          else popupList = clients;
          this._showClientsPopup(popupList, tab);
        } else if (kpi === 'popup-newmonth') {
          this._showClientsPopup(newMonthList, '당월 신규');
        } else if (kpi === 'popup-reports') {
          this._showReportsPopup(reportCompletedClients, overview);
        }
      });
    });

    // 정렬 클릭
    el.querySelectorAll('.dash-sort-th').forEach(th => {
      th.addEventListener('click', () => {
        const tk = th.dataset.table, col = th.dataset.col;
        const s  = this._sort[tk];
        if (s.col===col) s.dir = s.dir==='asc'?'desc':'asc';
        else { s.col=col; s.dir='asc'; }
        this._renderAll();
      });
    });

    el.querySelectorAll('.dash-assess-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.classList.contains('client-name-link')) return;
        AssessmentsPage._pendingClientId = row.dataset.cid;
        AssessmentsPage._pendingRound    = Number(row.dataset.round);
        Router.navigate('assessments');
      });
    });
    el.querySelectorAll('.client-name-link').forEach(lnk => {
      lnk.addEventListener('click', e => { e.stopPropagation(); Router.navigate('client-detail', lnk.dataset.cid); });
    });
    document.getElementById('dash-goto-assess')?.addEventListener('click', () => Router.navigate('assessments'));
  },

  // ── 팝업: 고객 목록 ─────────────────────────────────────
  _showClientsPopup: function(list, title) {
    const sc = {'입소중':'admitted','입소예정':'scheduled','퇴소':'discharged'};
    const sorted = [...list].sort((a,b)=>(parseInt(a.roomNum||'9999')-parseInt(b.roomNum||'9999'))||a.name.localeCompare(b.name,'ko'));
    this._popup(`${title} 고객 (${list.length}명)`, `
      ${!sorted.length
        ? '<div class="empty-state"><div class="empty-state-text">해당 고객이 없습니다.</div></div>'
        : `<table class="table">
            <thead><tr><th>입실호수</th><th>고객명</th><th>성별</th><th>입소일</th><th>상태</th></tr></thead>
            <tbody>${sorted.map(c=>`<tr>
              <td style="font-weight:700;color:var(--color-primary-dark);">${c.roomNum||'-'}</td>
              <td><span class="client-name-link" data-cid="${c.clientId}" style="cursor:pointer;">${c.name}</span></td>
              <td>${c.gender||'-'}</td>
              <td style="font-size:14px;">${c.admitDate||'-'}</td>
              <td><span class="badge badge-${sc[c.status]||'discharged'}">${c.status}</span></td>
            </tr>`).join('')}</tbody>
          </table>`}`);
  },

  // ── 팝업: 리포트 완료 목록 ──────────────────────────────
  _showReportsPopup: function(clients, overview) {
    const rows = [];
    clients.forEach(c => {
      const ov = overview[c.clientId];
      if (!ov) return;
      Object.values(ov.rounds||{}).forEach(r => {
        if (!r.reportGenerated) return;
        rows.push({ c, round:r.round, assessDate:r.assessDate||'-', reportCreatedAt:r.reportCreatedAt||'-' });
      });
    });
    rows.sort((a,b)=>(b.reportCreatedAt||'').localeCompare(a.reportCreatedAt||''));
    const fmtDate = str => AssessUtils.fmtDate(str);
    this._popup(`리포트 완료 (${rows.length}건)`, `
      ${!rows.length
        ? '<div class="empty-state"><div class="empty-state-text">완료된 리포트가 없습니다.</div></div>'
        : `<table class="table">
            <thead><tr><th>입실호수</th><th>고객명</th><th>주차</th><th>평가일시</th><th>생성일시</th></tr></thead>
            <tbody>${rows.map(r=>`<tr>
              <td style="font-weight:700;color:var(--color-primary-dark);">${r.c.roomNum||'-'}</td>
              <td><span class="client-name-link" data-cid="${r.c.clientId}" style="cursor:pointer;">${r.c.name}</span></td>
              <td><span class="badge badge-role">${r.round===1?"초기":`${(r.round-1)*4}주차`}</span></td>
              <td style="font-size:14px;">${fmtDate(r.assessDate)}</td>
              <td style="font-size:14px;">${fmtDate(r.reportCreatedAt)}</td>
            </tr>`).join('')}</tbody>
          </table>`}`);
  },

  // ── 공통 팝업 ────────────────────────────────────────────
  _popup: function(title, bodyHtml) {
    const wrap = document.getElementById('dash-modal-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="modal-backdrop" id="dash-popup">
        <div class="modal" style="max-width:680px;max-height:88vh;display:flex;flex-direction:column;">
          <div class="modal-header">
            <h3 class="modal-title">📋 ${title}</h3>
            <button class="modal-close" id="dash-popup-close">✕</button>
          </div>
          <div class="modal-body" style="overflow-y:auto;flex:1;">${bodyHtml}</div>
        </div>
      </div>`;
    document.getElementById('dash-popup-close').onclick = () => wrap.innerHTML='';
    document.getElementById('dash-popup').onclick = e => { if(e.target.id==='dash-popup') wrap.innerHTML=''; };
    wrap.querySelectorAll('.client-name-link').forEach(lnk => {
      lnk.addEventListener('click', e => {
        e.stopPropagation();
        wrap.innerHTML='';
        Router.navigate('client-detail', lnk.dataset.cid);
      });
    });
  }
};
