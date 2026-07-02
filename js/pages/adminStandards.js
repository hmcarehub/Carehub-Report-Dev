// ============================================================
// pages/adminStandards.js — 기준값 관리 (추가/수정/삭제)
// ============================================================

const AdminStandardsPage = {
  standards: null,
  activeTab: 'inbodyFra',

  // 탭 구조
  _tabs: {
    inbodyFra: {
      label: '인바디 FRA',
      sections: [
        { key:'nervous', title:'신경계 점수',        hint:'신경계 관련 평가 항목' },
        { key:'balance', title:'통합 균형능력 점수', hint:'균형능력 관련 평가 항목' },
        { key:'sensory', title:'감각계 점수',        hint:'감각계 관련 평가 항목' }
      ]
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
    if (tab.type === 'grades') { this._renderGradesTab(content, tab); return; }
    this._renderItemsTab(content, tab);
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
