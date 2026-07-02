// ============================================================
// pages/reports.js - v11
// ============================================================

const ReportsPage = {
  allMasterData: [],
  allClients:    {},
  filtered:      [],
  searchQuery:   '',
  filterRound:   '',
  sortKey:       'reportCreatedAt',
  sortDir:       'desc',

  render: async function() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header" style="margin-bottom:20px;">
        <h1 class="page-title">리포트 관리</h1>
        <p class="page-subtitle">생성된 통합 리포트를 조회하고 출력합니다.</p>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-body" style="padding:14px 18px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <div class="search-bar" style="flex:1;max-width:280px;">
              <svg class="search-icon" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" id="rpt-search" placeholder="고객명, 고객ID 검색">
            </div>
            <select id="rpt-filter-round" class="form-control" style="width:130px;height:42px;">
              <option value="">전체 주차</option>
              ${Array.from({length:7},(_,i)=>i+1).map(n=>`<option value="${n}">${n===1?'초기':`${(n-1)*4}주차`}</option>`).join('')}
            </select>
            <div style="display:flex;gap:5px;margin-left:auto;flex-wrap:wrap;">
              ${[{k:'roomNum',l:'입실호수'},{k:'name',l:'고객명'},{k:'assessDate',l:'평가일시'},{k:'reportCreatedAt',l:'생성일시'}]
                .map(s=>`<button class="assess-sort-btn${this.sortKey===s.k?' active':''}" data-sort="${s.k}">${s.l}${this.sortKey===s.k?(this.sortDir==='asc'?' ↑':' ↓'):''}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title"><span class="card-title-dot"></span>리포트 목록 <span id="rpt-count" style="font-size:13px;font-weight:400;color:var(--color-gray-500);"></span></h2>
        </div>
        <div class="card-body" style="padding:0;">
          <div id="rpt-table-wrap" class="table-wrap">
            <div class="empty-state"><div class="spinner" style="margin:0 auto;"></div></div>
          </div>
        </div>
      </div>
      <div id="rpt-modal-wrap"></div>
    `;

    this._bindEvents();
    await this._loadData();
  },

  _bindEvents: function() {
    document.getElementById('rpt-search')?.addEventListener('input', e => {
      this.searchQuery = e.target.value.trim(); this._applyFilter(); this._renderTable();
    });
    document.getElementById('rpt-filter-round')?.addEventListener('change', e => {
      this.filterRound = e.target.value; this._applyFilter(); this._renderTable();
    });
    document.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.sort;
        if (this.sortKey===k) this.sortDir=this.sortDir==='asc'?'desc':'asc';
        else { this.sortKey=k; this.sortDir='desc'; }
        this._applyFilter(); this._renderTable();
      });
    });
  },

  _loadData: async function() {
    try {
      UI.showLoading();
      // getInitialData 한 번에 clients + overview 모두 가져옴 (캐시 공유)
      const r = await API.getInitialData();
      const clientRes = { status: r.status, data: { clients: r.data?.clients || [] } };
      const ovRes     = { status: r.status, data: { overview: r.data?.overview || {} } };
      if (clientRes.status==='success') {
        this.allClients = {};
        (clientRes.data.clients||[]).forEach(c => { this.allClients[c.clientId]=c; });
      }
      this.allMasterData = [];
      if (ovRes.status==='success') {
        const ov = ovRes.data.overview || {};
        Object.entries(ov).forEach(([clientId, data]) => {
          Object.values(data.rounds||{}).forEach(r => {
            if (r.reportGenerated) {
              this.allMasterData.push({
                clientId,
                round:           r.round,
                doneCats:        r.doneCats,
                assessDate:      r.assessDate      || '-',
                reportCreatedAt: r.reportCreatedAt || '-',
                client:          this.allClients[clientId] || { name:'알 수 없음', clientId, roomNum:'' }
              });
            }
          });
        });
      }
    } catch { UI.toast('데이터 로드 실패','error'); }
    finally { UI.hideLoading(); }
    this._applyFilter();
    this._renderTable();
  },

  _applyFilter: function() {
    let list = [...this.allMasterData];
    const q  = this.searchQuery.toLowerCase();
    if (q) list = list.filter(r => r.client.name.toLowerCase().includes(q) || r.clientId.toLowerCase().includes(q));
    if (this.filterRound) list = list.filter(r => String(r.round)===String(this.filterRound));

    list.sort((a,b) => {
      let va, vb;
      if (this.sortKey==='roomNum')          { va=parseInt(a.client.roomNum||'9999'); vb=parseInt(b.client.roomNum||'9999'); }
      else if (this.sortKey==='name')        { va=a.client.name;      vb=b.client.name; }
      else if (this.sortKey==='assessDate')  { va=a.assessDate;       vb=b.assessDate; }
      else                                   { va=a.reportCreatedAt;  vb=b.reportCreatedAt; }
      const cmp = typeof va==='number' ? va-vb : String(va).localeCompare(String(vb),'ko');
      return this.sortDir==='asc' ? cmp : -cmp;
    });
    this.filtered = list;
  },

  // 날짜 문자열 → YYYY-MM-DD 변환 (Thu Jun 12 형식도 처리)
  _fmtDate: function(str) {
    if (!str || str === '-') return '-';
    const m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const p = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    }
    return str.substring(0,10);
  },

  _renderTable: function() {
    const wrap  = document.getElementById('rpt-table-wrap');
    const count = document.getElementById('rpt-count');
    if (!wrap) return;
    if (count) count.textContent = `(총 ${this.filtered.length}건)`;

    if (!this.filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:40px;"><div class="empty-state-icon">📄</div><div class="empty-state-text">생성된 통합 리포트가 없습니다.</div></div>`;
      return;
    }
    const sc={'입소중':'admitted','입소예정':'scheduled','퇴소':'discharged'};
    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>입실호수</th>
            <th>고객명</th>
            <th>주차</th>
            <th>리포트 제목</th>
            <th>평가일시</th>
            <th>생성일시</th>
            <th style="text-align:center;">작업</th>
          </tr>
        </thead>
        <tbody>
          ${this.filtered.map(r=>`
            <tr>
              <td style="font-weight:700;color:var(--color-primary-dark);">${r.client.roomNum||'-'}</td>
              <td><span class="client-name-link" data-cid="${r.client.clientId}">${r.client.name}</span></td>
              <td><span class="badge badge-role">${r.round===1?"초기":`${(r.round-1)*4}주차`}</span></td>
              <td style="font-weight:600;color:var(--color-gray-700);">${r.round===1?"초기 통합리포트":`${(r.round-1)*4}주차 통합리포트`}</td>
              <td style="font-size:13px;color:var(--color-gray-600);">${this._fmtDate(r.assessDate)}</td>
              <td style="font-size:13px;color:var(--color-gray-600);">${this._fmtDate(r.reportCreatedAt)}</td>
              <td>
                <div style="display:flex;gap:6px;justify-content:center;">
                  <button class="btn btn-outline btn-sm rpt-view-btn" data-cid="${r.clientId}" data-round="${r.round}">👁 보기</button>
                  <button class="btn btn-secondary btn-sm rpt-print-btn" data-cid="${r.clientId}" data-round="${r.round}">🖨️ 출력</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    wrap.querySelectorAll('.client-name-link').forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); Router.navigate('client-detail', el.dataset.cid); });
    });
    wrap.querySelectorAll('.rpt-view-btn').forEach(btn => {
      btn.addEventListener('click', () => this._viewReport(btn.dataset.cid, Number(btn.dataset.round)));
    });
    wrap.querySelectorAll('.rpt-print-btn').forEach(btn => {
      btn.addEventListener('click', () => this._printReport(btn.dataset.cid, Number(btn.dataset.round)));
    });
  },

  // ── 공통 출력 유틸 ──────────────────────────────────────────
  _doPrint: function(client, master, masterList) {
    const weekTitle = master.round===1 ? '초기 통합리포트' : `${(master.round-1)*4}주차 통합리포트`;
    const reportHtml = ClientDetailPage._buildReportHTML.call({client}, master, masterList);
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) { UI.toast('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.', 'warning'); return; }
    win.document.open();
    win.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
      <title>${weekTitle} - ${client.name}</title>
      <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'Noto Sans KR','Malgun Gothic',sans-serif; background:white; color:#2C2C2C; }
        @page { margin:6mm; size:A4 portrait; }
        @media print {
          body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
          #report-print-area > div { page-break-after:always !important; page-break-inside:avoid; height:100vh !important; overflow:hidden !important; }
          #report-print-area > div:last-child { page-break-after:avoid !important; }
        }
      </style>
    </head><body><div id="report-print-area">${reportHtml}</div>
    <script>
      window.onload = function() { setTimeout(function(){ window.print(); }, 800); };
    <\/script></body></html>`);
    win.document.close();
  },

  _viewReport: async function(clientId, round) {
    try {
      UI.showLoading();
      const [clientRes, roundRes, masterRes] = await Promise.all([
        API.getClientDetail(clientId),
        API.getRoundData(clientId, round),
        API.getClientMasterList(clientId)
      ]);
      UI.hideLoading();
      if (clientRes.status!=='success'||roundRes.status!=='success') { UI.toast('데이터 로드 실패','error'); return; }
      const client     = clientRes.data.client;
      const data       = roundRes.data;
      const masterList = masterRes.status==='success' ? (masterRes.data.masterList||[]) : [];
      const weekTitle  = round===1 ? '초기 통합리포트' : `${(round-1)*4}주차 통합리포트`;
      const reportHtml = ClientDetailPage._buildReportHTML.call({client}, data.master, masterList);
      const modalWrap  = document.getElementById('rpt-modal-wrap');
      modalWrap.innerHTML = `
        <div class="modal-backdrop" id="rpt-view-modal">
          <div class="modal" style="max-width:860px;max-height:92vh;display:flex;flex-direction:column;">
            <div class="modal-header">
              <h3 class="modal-title">📄 ${weekTitle} — ${client.name}</h3>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-primary btn-sm" id="rpt-print-from-modal">🖨️ PDF 출력</button>
                <button class="modal-close" id="rpt-modal-close">✕</button>
              </div>
            </div>
            <div class="modal-body" style="overflow-y:auto;flex:1;background:#f5f5f5;padding:16px;">
              <div id="rpt-print-area" style="background:white;border-radius:8px;">${reportHtml}</div>
            </div>
          </div>
        </div>`;
      document.getElementById('rpt-modal-close').onclick = () => modalWrap.innerHTML='';
      document.getElementById('rpt-view-modal').onclick  = e => { if(e.target.id==='rpt-view-modal') modalWrap.innerHTML=''; };
      document.getElementById('rpt-print-from-modal').onclick = () => {
        this._doPrint(client, data.master, masterList);
      };
    } catch(e) { UI.hideLoading(); UI.toast('서버 오류','error'); }
  },

  _printReport: async function(clientId, round) {
    try {
      UI.showLoading();
      const [clientRes, roundRes, masterRes] = await Promise.all([
        API.getClientDetail(clientId),
        API.getRoundData(clientId, round),
        API.getClientMasterList(clientId)
      ]);
      UI.hideLoading();
      if (clientRes.status!=='success'||roundRes.status!=='success') { UI.toast('데이터 로드 실패','error'); return; }
      const client     = clientRes.data.client;
      const data       = roundRes.data;
      const masterList = masterRes.status==='success' ? (masterRes.data.masterList||[]) : [];
      this._doPrint(client, data.master, masterList);
    } catch(e) { UI.hideLoading(); UI.toast('서버 오류','error'); }
  }
};
