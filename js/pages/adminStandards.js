// ============================================================
// pages/adminStandards.js — 기준값 관리 (추가/수정/삭제)
// ============================================================

const AdminStandardsPage = {
  standards: null,
  activeTab: 'clientPeriod',

  // 탭 구조
  _tabs: {
    // ✅ 고객관리 기준: 입소기간 / 입소일수 / 평가회차 (신규, 첫번째 탭)
    clientPeriod: {
      label: '고객관리 기준',
      type: 'periods',
      sections: [
        { key:'period', title:'입소기간 설정', hint:'입소기간별 입소일수와 평가회차(마지막 회차)를 관리합니다.',
          defaults: [
            {period:'2박 3일', days:3,   roundLabel:'초기'},
            {period:'2주',     days:14,  roundLabel:'초기'},
            {period:'1개월',   days:28,  roundLabel:'4주차'},
            {period:'2개월',   days:56,  roundLabel:'8주차'},
            {period:'3개월',   days:84,  roundLabel:'12주차'},
            {period:'4개월',   days:112, roundLabel:'16주차'},
            {period:'5개월',   days:140, roundLabel:'20주차'},
            {period:'6개월',   days:168, roundLabel:'24주차'}
          ]
        }
      ]
    },
    inbodyFra: {
      label: '인바디 FRA',
      sections: [
        { key:'nervous', title:'신경계 점수',        hint:'신경계 관련 평가 항목' },
        { key:'balance', title:'통합 균형능력 점수', hint:'균형능력 관련 평가 항목' },
        { key:'sensory', title:'감각계 점수',        hint:'감각계 관련 평가 항목' }
      ]
    },
    // ✅ 기간별 지표 변화: 표시할 평가 항목 선택 (신규, 3번째 탭)
    trendMetrics: {
      label: '기간별 지표 변화',
      type: 'trendMetrics'
    },
    cogMsg: {
      label: '등급 기준값',
      type: 'grades',
      sections: [
        { key:'cogScore',      title:'인지점수',         max:100,
          defaults:[{range:'90~100',label:'최적',color:'#1B5E20'},{range:'80~89',label:'양호',color:'#2E7D32'},{range:'65~79',label:'개선',color:'#F57F17'},{range:'0~64',label:'주의',color:'#C62828'}]},
        { key:'spatial',       title:'시공간능력',       max:100,
          defaults:[{range:'67~100',label:'양호',color:'#2E7D32'},{range:'34~66',label:'관심',color:'#F57F17'},{range:'0~33',label:'주의',color:'#C62828'}]},
        { key:'memory',        title:'기억력',           max:100,
          defaults:[{range:'67~100',label:'양호',color:'#2E7D32'},{range:'34~66',label:'관심',color:'#F57F17'},{range:'0~33',label:'주의',color:'#C62828'}]},
        { key:'agePercentile', title:'동연령대 상위 분포도', max:100,
          defaults:[{range:'0~33',label:'상위권',color:'#2E7D32'},{range:'34~66',label:'중위권',color:'#F57F17'},{range:'67~100',label:'하위권',color:'#C62828'}]},
        { key:'depression',    title:'우울점수',          max:60,
          defaults:[{range:'0~20',label:'경도',color:'#2E7D32'},{range:'21~24',label:'중등도',color:'#F57F17'},{range:'25~60',label:'높은수준',color:'#C62828'}]},
        { key:'dementiaRisk',  title:'치매위험요인',      max:100,
          defaults:[{range:'0~29',label:'낮음',color:'#2E7D32'},{range:'30~59',label:'주의',color:'#F57F17'},{range:'60~100',label:'높음',color:'#C62828'}]},
        { key:'stressScore',   title:'스트레스 점수',     max:100,
          defaults:[{range:'0~34',label:'정상',color:'#43A047'},{range:'35~44',label:'초기',color:'#FDD835'},{range:'45~59',label:'진행',color:'#FB8C00'},{range:'60~100',label:'만성',color:'#E53935'}]}
      ]
    }
  },

  render: async function() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header" style="margin-bottom:16px;">
        <h1 class="page-title">기준값 관리</h1>
        <p class="page-subtitle">평가 항목의 기준값(범례)를 추가, 수정, 삭제합니다.</p>
      </div>
      <div id="std-body"><div class="empty-state"><div class="spinner" style="margin:0 auto;"></div></div></div>`;
    await this._load();
  },

  _load: async function() {
    try {
      UI.showLoading();
      const res = await API.getStandards();
      this.standards = res.status==='success' ? (res.data.standards||{}) : {};
    } catch { this.standards = {}; }
    finally { UI.hideLoading(); }
    this._renderBody();
  },

  _renderBody: function() {
    const tabs = Object.entries(this._tabs);
    const body = document.getElementById('std-body');
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--color-gray-200);">
        ${tabs.map(([k,v])=>`
          <button class="round-tab${this.activeTab===k?' active':''}" data-stdtab="${k}"
            style="font-size:14px;padding:10px 24px;">${v.label}</button>`).join('')}
      </div>
      <div id="std-tab-content"></div>`;
    body.querySelectorAll('[data-stdtab]').forEach(el => {
      el.addEventListener('click', () => {
        this.activeTab = el.dataset.stdtab;
        body.querySelectorAll('[data-stdtab]').forEach(t=>t.classList.toggle('active', t===el));
        this._renderTabContent();
      });
    });
    this._renderTabContent();
  },

  _renderTabContent: function() {
    const content = document.getElementById('std-tab-content');
    if (!content) return;
    const tab = this._tabs[this.activeTab];
    if (!tab) return;
    if (tab.type === 'periods')      { this._renderPeriodsTab(content, tab); return; }
    if (tab.type === 'grades')       { this._renderGradesTab(content, tab); return; }
    if (tab.type === 'trendMetrics') { this._renderTrendMetricsTab(content); return; }
    this._renderItemsTab(content, tab);
  },

  // ══════════════════════════════════════════════════════════
  // ✅ 기간별 지표 변화: 표시할 평가 항목 선택 (인지/운동/대사 카테고리별 체크리스트)
  //    설정값: 평가 카테고리 / 평가항목 / 사용여부 / 낮을수록 좋음
  //    DB: category='trendMetrics_items', label에 JSON 저장 (입소기간 설정과 동일 방식)
  // ══════════════════════════════════════════════════════════
  _renderTrendMetricsTab: async function(content) {
    content.innerHTML = `<div class="empty-state"><div class="spinner" style="margin:0 auto;"></div></div>`;
    const catalog = await API.getTrendMetricsCatalog();
    // this.activeTab이 그 사이 바뀌었으면(다른 탭 클릭) 렌더링 중단
    if (this.activeTab !== 'trendMetrics') return;

    const catOrder = ['인지','운동','대사'];
    const groups = catOrder.map(cat => ({ cat, items: catalog.filter(it=>it.category===cat) }))
      .filter(g => g.items.length);

    const catColor = { '인지':'#8E7CC3', '운동':'#4A90D2', '대사':'#43A047' };

    const rowHtml = (it, idx) => `
      <div data-trow="${idx}" data-key="${it.key}" style="display:grid;grid-template-columns:1fr 90px 130px;gap:10px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--color-gray-100);">
        <div style="font-size:13px;color:var(--color-gray-800);">${it.label}</div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--color-gray-600);cursor:pointer;">
          <input type="checkbox" class="tm-enabled" ${it.enabled?'checked':''}> 사용
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--color-gray-600);cursor:pointer;">
          <input type="checkbox" class="tm-inverse" ${it.inverse?'checked':''}> 낮을수록 좋음
        </label>
      </div>`;

    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title"><span class="card-title-dot"></span>표시할 평가 항목 선택</h2>
          <button class="btn btn-primary btn-sm" id="tm-save-btn">저장</button>
        </div>
        <div class="card-body">
          <p style="font-size:12px;color:var(--color-gray-400);margin-bottom:14px;">
            체크한 항목만 [평가관리 · 고객상세 · 리포트]의 "기간별 지표 변화"에 표시됩니다. "낮을수록 좋음"을 체크하면 변화(초기 대비) 아래에 "↓ 낮을수록 좋음"이 함께 표기됩니다.
          </p>
          ${groups.map(g => `
            <div style="margin-bottom:18px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="width:8px;height:8px;border-radius:50%;background:${catColor[g.cat]||'#888'};"></span>
                <span style="font-size:13px;font-weight:700;color:var(--color-gray-700);">${g.cat}</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 90px 130px;gap:10px;padding:0 10px 6px;font-size:11px;font-weight:700;color:var(--color-gray-400);">
                <div>평가 항목</div><div>사용여부</div><div>낮을수록 좋음</div>
              </div>
              <div data-tmgroup="${g.cat}">
                ${g.items.map((it,idx)=>rowHtml(it, catalog.indexOf(it))).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>`;

    content.querySelector('#tm-save-btn')?.addEventListener('click', () => this._saveTrendMetrics(content, catalog));
  },

  _saveTrendMetrics: async function(content, catalog) {
    const rows = content.querySelectorAll('[data-trow]');
    const items = Array.from(rows).map((row, idx) => {
      const key = row.dataset.key;
      const base = catalog.find(it => it.key === key) || {};
      return {
        key,
        category: base.category || '',
        label: base.label || key,
        enabled: !!row.querySelector('.tm-enabled')?.checked,
        inverse: !!row.querySelector('.tm-inverse')?.checked
      };
    });
    const dbItems = items.map((it, idx) => ({
      key: it.key,
      label: JSON.stringify(it),
      order: idx
    }));
    try {
      UI.showLoading();
      const res = await API.saveStandards('trendMetrics_items', dbItems);
      if (res.status === 'success') {
        if (!this.standards) this.standards = {};
        this.standards['trendMetrics_items'] = dbItems;
        StandardsCache.set('trendMetrics_items', dbItems);
        UI.toast('기간별 지표 변화 설정이 저장되었습니다.', 'success');
      } else UI.toast(res.message || '저장 실패', 'error');
    } catch { UI.toast('서버 오류', 'error'); }
    finally { UI.hideLoading(); }
  },

  // ══════════════════════════════════════════════════════════
  // ✅ 고객관리 기준: 입소기간 / 입소일수 / 평가회차 (추가/수정/삭제)
  //    DB 테이블(기준값_관리)에 days/roundLabel 전용 컬럼이 없어,
  //    label 컬럼에 JSON 문자열로 { period, days, roundLabel } 을 저장합니다.
  //    category = 'clientPeriod_period', key = 항목 고유ID, order = 정렬순서
  // ══════════════════════════════════════════════════════════
  _parsePeriodLabel: function(raw) {
    try {
      const obj = JSON.parse(raw);
      return { period: obj.period||'', days: obj.days!=null?Number(obj.days):null, roundLabel: obj.roundLabel||'' };
    } catch {
      // 예전 데이터(순수 텍스트)와의 호환을 위한 폴백
      return { period: raw||'', days: null, roundLabel: '' };
    }
  },

  _renderPeriodsTab: function(content, tab) {
    const sec    = tab.sections[0];
    const catKey = `${this.activeTab}_${sec.key}`;
    const raw    = this.standards?.[catKey];
    const items  = (raw && raw.length ? raw : sec.defaults.map((d,i)=>({
      key: `period_default_${i}`, label: JSON.stringify(d), order: i
    }))).map(it => ({ key: it.key, order: it.order, ...this._parsePeriodLabel(it.label) }));

    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title"><span class="card-title-dot"></span>${sec.title}</h2>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-outline btn-sm" data-addperiod="${catKey}">+ 입소기간 추가</button>
            <button class="btn btn-primary btn-sm" data-saveperiod="${catKey}">저장</button>
          </div>
        </div>
        <div class="card-body">
          <p style="font-size:12px;color:var(--color-gray-400);margin-bottom:14px;">${sec.hint} 저장 후 고객 등록/수정 화면의 입소기간 자동계산에 사용됩니다.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 70px;gap:8px;padding:0 10px 8px;font-size:12px;font-weight:700;color:var(--color-gray-500);">
            <div>입소기간</div><div>입소일수</div><div>평가회차</div><div></div>
          </div>
          <div id="periods-wrap-${catKey}">
            ${items.map((item,idx)=>this._periodRow(catKey, item, idx)).join('')}
          </div>
        </div>
      </div>`;

    const wrap = document.getElementById(`periods-wrap-${catKey}`);
    this._bindPeriodDeleteBtns(wrap, catKey);

    content.querySelector(`[data-addperiod="${catKey}"]`)?.addEventListener('click', () => {
      const idx = wrap.querySelectorAll('[data-prow]').length;
      const div = document.createElement('div');
      div.innerHTML = this._periodRow(catKey, {key:`period_new_${Date.now()}`, period:'', days:'', roundLabel:''}, idx);
      wrap.appendChild(div.firstElementChild);
      this._bindPeriodDeleteBtns(wrap, catKey);
    });

    content.querySelector(`[data-saveperiod="${catKey}"]`)?.addEventListener('click', () => this._savePeriods(catKey));
  },

  _periodRow: function(catKey, item, idx) {
    return `
      <div data-prow="${idx}" style="display:grid;grid-template-columns:1fr 1fr 1fr 70px;gap:8px;align-items:center;margin-bottom:8px;padding:6px 10px;background:var(--color-gray-50);border-radius:8px;">
        <input type="text" class="form-control period-name" data-catkey="${catKey}"
          value="${item.period||''}" placeholder="예: 2박 3일" style="font-size:13px;">
        <input type="number" class="form-control period-days" data-catkey="${catKey}" min="1" step="1"
          value="${item.days??''}" placeholder="예: 3" style="font-size:13px;">
        <input type="text" class="form-control period-roundlabel" data-catkey="${catKey}"
          value="${item.roundLabel||''}" placeholder="예: 초기 / 4주차" style="font-size:13px;">
        <input type="hidden" class="period-itemkey" value="${item.key||''}">
        <button class="btn btn-sm period-del-btn" data-catkey="${catKey}"
          style="color:#C62828;border:1px solid #C62828;border-radius:6px;padding:4px 8px;background:transparent;flex-shrink:0;">삭제</button>
      </div>`;
  },

  _bindPeriodDeleteBtns: function(wrap, catKey) {
    if (!wrap) return;
    wrap.querySelectorAll(`.period-del-btn[data-catkey="${catKey}"]`).forEach(btn => {
      btn.onclick = () => {
        const row   = btn.closest('[data-prow]');
        const total = wrap.querySelectorAll('[data-prow]').length;
        if (total <= 1) { UI.toast('최소 1개 입소기간이 필요합니다.', 'warning'); return; }
        row.remove();
        wrap.querySelectorAll('[data-prow]').forEach((r,i)=>r.setAttribute('data-prow', i));
      };
    });
  },

  _savePeriods: async function(catKey) {
    const wrap = document.getElementById(`periods-wrap-${catKey}`);
    if (!wrap) return;
    const rows  = wrap.querySelectorAll('[data-prow]');
    const items = Array.from(rows).map((row, idx) => {
      const period     = row.querySelector('.period-name')?.value?.trim() || '';
      const daysRaw     = row.querySelector('.period-days')?.value?.trim() || '';
      const roundLabel = row.querySelector('.period-roundlabel')?.value?.trim() || '';
      const key         = row.querySelector('.period-itemkey')?.value || `period_${idx}`;
      return { key, order: idx, period, days: daysRaw===''?null:Number(daysRaw), roundLabel };
    });

    if (items.some(it => !it.period || !it.roundLabel || it.days==null || isNaN(it.days) || it.days<1)) {
      UI.toast('입소기간·입소일수·평가회차를 모두 올바르게 입력해주세요.', 'error'); return;
    }
    const names = items.map(it=>it.period);
    if (new Set(names).size !== names.length) {
      UI.toast('입소기간명이 중복되었습니다.', 'error'); return;
    }

    const dbItems = items.map(it => ({
      key:   it.key,
      label: JSON.stringify({ period: it.period, days: it.days, roundLabel: it.roundLabel }),
      order: it.order
    }));

    try {
      UI.showLoading();
      const res = await API.saveStandards(catKey, dbItems);
      if (res.status==='success') {
        if (!this.standards) this.standards = {};
        this.standards[catKey] = dbItems;
        StandardsCache.set(catKey, dbItems);
        UI.toast('고객관리 기준이 저장되었습니다.', 'success');
        this._renderTabContent();
      } else UI.toast(res.message||'저장 실패','error');
    } catch { UI.toast('서버 오류','error'); }
    finally { UI.hideLoading(); }
  },

  // ── 인바디 FRA 항목 관리 (추가/수정/삭제) ──────────────────
  _renderItemsTab: function(content, tab) {
    content.innerHTML = tab.sections.map(sec => {
      const catKey = `${this.activeTab}_${sec.key}`;
      const items  = this.standards?.[catKey] ||
        [{key:`${sec.key}_1`,label:'',order:1}];
      return `
        <div class="card" style="margin-bottom:18px;">
          <div class="card-header">
            <h2 class="card-title"><span class="card-title-dot"></span>${sec.title}</h2>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-outline btn-sm" data-additem="${catKey}">+ 항목 추가</button>
              <button class="btn btn-primary btn-sm" data-saveitem="${catKey}">저장</button>
            </div>
          </div>
          <div class="card-body">
            <p style="font-size:12px;color:var(--color-gray-400);margin-bottom:14px;">${sec.hint||'항목명을 입력하세요.'} 저장 후 리포트에 자동 반영됩니다.</p>
            <div id="items-wrap-${catKey}">
              ${items.map((item,idx) => this._itemRow(catKey, item, idx)).join('')}
            </div>
          </div>
        </div>`;
    }).join('');

    content.querySelectorAll('[data-additem]').forEach(btn => {
      btn.addEventListener('click', () => {
        const catKey = btn.dataset.additem;
        const wrap   = document.getElementById(`items-wrap-${catKey}`);
        const idx    = wrap.querySelectorAll('[data-row]').length;
        const div    = document.createElement('div');
        div.innerHTML = this._itemRow(catKey, {key:`${catKey}_new_${Date.now()}`,label:'',order:idx+1}, idx);
        wrap.appendChild(div.firstElementChild);
        this._bindDeleteBtns(wrap, catKey);
      });
    });

    content.querySelectorAll('[data-saveitem]').forEach(btn => {
      btn.addEventListener('click', () => this._saveItems(btn.dataset.saveitem));
    });

    // 초기 삭제 버튼 바인딩
    tab.sections.forEach(sec => {
      const catKey = `${this.activeTab}_${sec.key}`;
      const wrap   = document.getElementById(`items-wrap-${catKey}`);
      if (wrap) this._bindDeleteBtns(wrap, catKey);
    });
  },

  _itemRow: function(catKey, item, idx) {
    return `
      <div data-row="${idx}" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:26px;height:26px;border-radius:50%;background:var(--color-primary-pale);color:var(--color-primary-dark);
          display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${idx+1}</div>
        <input type="text" class="form-control item-input" data-catkey="${catKey}" data-itemkey="${item.key}"
          value="${item.label||''}" placeholder="항목명 입력" style="flex:1;">
        <button class="btn btn-sm item-del-btn" data-catkey="${catKey}"
          style="color:#C62828;border:1px solid #C62828;border-radius:6px;padding:4px 10px;flex-shrink:0;background:transparent;">삭제</button>
      </div>`;
  },

  _bindDeleteBtns: function(wrap, catKey) {
    wrap.querySelectorAll(`.item-del-btn[data-catkey="${catKey}"]`).forEach(btn => {
      btn.onclick = async () => {
        const row   = btn.closest('[data-row]');
        const total = wrap.querySelectorAll('[data-row]').length;
        if (total <= 1) { UI.toast('최소 1개 항목이 필요합니다.', 'warning'); return; }
        row.remove();
        // 번호 재정렬
        wrap.querySelectorAll('[data-row]').forEach((r,i) => {
          r.setAttribute('data-row', i);
          const circle = r.querySelector('div');
          if (circle) circle.textContent = i+1;
        });
      };
    });
  },

  _saveItems: async function(catKey) {
    const inputs = document.querySelectorAll(`.item-input[data-catkey="${catKey}"]`);
    const items  = Array.from(inputs).map((inp,idx) => ({
      key:   inp.dataset.itemkey || `${catKey}_${idx+1}`,
      label: inp.value.trim(),
      order: idx+1
    }));
    if (items.some(it=>!it.label)) { UI.toast('항목명을 모두 입력해주세요.', 'error'); return; }
    try {
      UI.showLoading();
      const res = await API.saveStandards(catKey, items);
      if (res.status==='success') {
        if (!this.standards) this.standards={};
        this.standards[catKey]=items;
        StandardsCache.set(catKey, items);
        UI.toast('저장되었습니다.', 'success');
        this._renderTabContent();
      } else UI.toast(res.message||'저장 실패','error');
    } catch { UI.toast('서버 오류','error'); }
    finally { UI.hideLoading(); }
  },

  // ── 등급 기준값 관리 (추가/수정/삭제) ─────────────────────
  _renderGradesTab: function(content, tab) {
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:16px;">
        ${tab.sections.map(sec => {
          const catKey = `grades_${sec.key}`;
          const items  = this.standards?.[catKey] ||
            sec.defaults.map((d,i)=>({...d, key:`${sec.key}_${i}`, order:i}));
          return `
            <div class="card">
              <div class="card-header" style="padding:12px 16px;">
                <h2 class="card-title" style="font-size:14px;">
                  <span class="card-title-dot"></span>${sec.title}
                  ${sec.max!==100?`<span style="font-size:11px;color:var(--color-gray-400);margin-left:6px;">(만점 ${sec.max}점)</span>`:''}
                </h2>
                <div style="display:flex;gap:6px;">
                  <button class="btn btn-outline btn-sm" data-addgrade="${catKey}" data-seckey="${sec.key}">+ 추가</button>
                  <button class="btn btn-primary btn-sm" data-savegrade="${catKey}">저장</button>
                </div>
              </div>
              <div class="card-body" style="padding:12px 16px;">
                <div id="grades-wrap-${catKey}">
                  ${items.map((item,idx)=>this._gradeRow(catKey, item, idx)).join('')}
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;

    // 추가 버튼
    content.querySelectorAll('[data-addgrade]').forEach(btn => {
      btn.addEventListener('click', () => {
        const catKey = btn.dataset.addgrade;
        const wrap   = document.getElementById(`grades-wrap-${catKey}`);
        const idx    = wrap.querySelectorAll('[data-grow]').length;
        const div    = document.createElement('div');
        div.innerHTML= this._gradeRow(catKey, {key:`${btn.dataset.seckey}_new_${Date.now()}`,range:'',label:'',color:'#888'}, idx);
        wrap.appendChild(div.firstElementChild);
        this._bindGradeDeleteBtns(wrap, catKey);
      });
    });

    // 저장 버튼
    content.querySelectorAll('[data-savegrade]').forEach(btn => {
      btn.addEventListener('click', () => this._saveGrades(btn.dataset.savegrade));
    });

    // 초기 삭제 버튼 바인딩
    tab.sections.forEach(sec => {
      const catKey = `grades_${sec.key}`;
      const wrap   = document.getElementById(`grades-wrap-${catKey}`);
      if (wrap) this._bindGradeDeleteBtns(wrap, catKey);
    });
  },

  _gradeRow: function(catKey, item, idx) {
    return `
      <div data-grow="${idx}" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 10px;
        background:${item.color||'#888'}11;border-radius:8px;border-left:3px solid ${item.color||'#888'};">
        <input type="text" class="form-control grade-range" data-catkey="${catKey}"
          value="${item.range||''}" placeholder="예: 0~33" style="flex:1;min-width:80px;font-size:13px;">
        <input type="text" class="form-control grade-label" data-catkey="${catKey}"
          value="${item.label||''}" placeholder="등급명 예: 양호" style="flex:1;min-width:70px;font-size:13px;font-weight:700;color:${item.color||'#888'};">
        <input type="color" class="grade-color" data-catkey="${catKey}"
          value="${item.color||'#888888'}"
          style="width:36px;height:36px;border:none;border-radius:6px;cursor:pointer;padding:2px;flex-shrink:0;"
          title="색상 선택">
        <input type="hidden" class="grade-itemkey" value="${item.key||''}">
        <button class="btn btn-sm grade-del-btn" data-catkey="${catKey}"
          style="color:#C62828;border:1px solid #C62828;border-radius:6px;padding:4px 10px;background:transparent;flex-shrink:0;">삭제</button>
      </div>`;
  },

  _bindGradeDeleteBtns: function(wrap, catKey) {
    wrap.querySelectorAll(`.grade-del-btn[data-catkey="${catKey}"]`).forEach(btn => {
      btn.onclick = () => {
        const row   = btn.closest('[data-grow]');
        const total = wrap.querySelectorAll('[data-grow]').length;
        if (total <= 1) { UI.toast('최소 1개 등급이 필요합니다.', 'warning'); return; }
        row.remove();
        wrap.querySelectorAll('[data-grow]').forEach((r,i)=>r.setAttribute('data-grow',i));
      };
    });
    // 색상 변경 시 배경 즉시 업데이트
    wrap.querySelectorAll(`.grade-color[data-catkey="${catKey}"]`).forEach(inp => {
      inp.oninput = () => {
        const row = inp.closest('[data-grow]');
        if (!row) return;
        const c = inp.value;
        row.style.background = c+'11';
        row.style.borderLeftColor = c;
        const lbl = row.querySelector('.grade-label');
        if (lbl) lbl.style.color = c;
      };
    });
  },

  _saveGrades: async function(catKey) {
    const wrap   = document.getElementById(`grades-wrap-${catKey}`);
    const rows   = wrap.querySelectorAll('[data-grow]');
    const items  = Array.from(rows).map((row,idx) => ({
      key:   row.querySelector('.grade-itemkey')?.value || `${catKey}_${idx}`,
      range: row.querySelector('.grade-range')?.value?.trim()  || '',
      label: row.querySelector('.grade-label')?.value?.trim()  || '',
      color: row.querySelector('.grade-color')?.value          || '#888888',
      order: idx
    }));
    if (items.some(it=>!it.label||!it.range)) {
      UI.toast('범위와 등급명을 모두 입력해주세요.', 'error'); return;
    }
    try {
      UI.showLoading();
      const res = await API.saveStandards(catKey, items);
      if (res.status==='success') {
        if (!this.standards) this.standards={};
        this.standards[catKey]=items;
        StandardsCache.set(catKey, items);
        UI.toast('기준값이 저장되었습니다.', 'success');
        this._renderTabContent(); // 색상 반영해서 재렌더
      } else UI.toast(res.message||'저장 실패','error');
    } catch { UI.toast('서버 오류','error'); }
    finally { UI.hideLoading(); }
  }
};

// ── 전역 기준값 캐시 ─────────────────────────────────────────
const StandardsCache = {
  _data: null,
  load: async function() {
    if (this._data) return this._data;
    try {
      const res = await API.getStandards();
      this._data = res.status==='success' ? (res.data.standards||{}) : {};
    } catch { this._data = {}; }
    return this._data;
  },
  get: function(catKey) { return this._data?.[catKey] || null; },
  set: function(catKey, items) {
    if (!this._data) this._data = {};
    this._data[catKey] = items;
  }
};
