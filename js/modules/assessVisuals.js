// ============================================================
// shared/assessVisuals.js
// ------------------------------------------------------------
// Assessment(평가관리) 화면에서 사용 중인 "시각화(읽기 전용)" 로직만
// 그대로 옮겨온 공통 컴포넌트 모음입니다.
//
// ⚠️ 이 파일에는 다음이 절대 포함되지 않습니다:
//    input / textarea / select / button / addEventListener / API 호출
//    → 100% 순수 함수(문자열 SVG/HTML 리턴)로만 구성됩니다.
//
// 사용처:
//   - pages/assessments.js   → 입력 폼 위에 이 컴포넌트를 얹어서 사용
//   - pages/clientDetail.js  → 이 컴포넌트만 그대로 호출해 읽기전용 리포트 출력
//
// 로드 순서: config.js(AppConfig) → assessVisuals.js → assessments.js / clientDetail.js
//
// ✅ 2026-07 개편: 인지관리 평가영역 6개 지표로 전면 변경
//    (주의집중력/언어능력/시공간기능/기억력(언어)/기억력(시각)/집행기능, 전부 %)
//    → 하단 "5) 인지관리 6개 지표 시각화" 섹션 참고
// ============================================================

const AssessVisuals = {

  // ══════════════════════════════════════════════════════════
  // 1) 등급/색상 계산 (Assessment 원본 로직 그대로)
  // ══════════════════════════════════════════════════════════

  // 인지점수 등급 (반원게이지용) — 시공간능력/기억력과 동일한 3단계 기준
  calcCogIndex: function(score) {
    if (score===null||score===undefined||score===''||isNaN(score)) return null;
    const n = Number(score);
    if (n >= 67) return {label:'양호', color:'#2E7D32', bg:'#E8F5E9'};
    if (n >= 34) return {label:'관심', color:'#F57F17', bg:'#FFF8E1'};
    return {label:'주의', color:'#C62828', bg:'#FFEBEE'};
  },

  // 시공간능력·기억력 등급 (0~33:주의, 34~66:관심, 67~100:양호)
  calcCogSubGrade: function(score) {
    if (score===null||score===undefined||score===''||isNaN(score)) return null;
    const n = Number(score);
    if (n >= 67) return {label:'양호', color:'#2E7D32', bg:'#E8F5E9'};
    if (n >= 34) return {label:'관심', color:'#F57F17', bg:'#FFF8E1'};
    return {label:'주의', color:'#C62828', bg:'#FFEBEE'};
  },

  // 우울점수 등급
  calcDepressionGrade: function(score) {
    if (score==null||score===''||isNaN(score)) return null;
    const n=Number(score);
    if (n<=20) return {label:'경도 수준', color:'#2E7D32', bg:'#E8F5E9'};
    if (n<=24) return {label:'중등도 수준', color:'#F57F17', bg:'#FFF8E1'};
    return {label:'높은 수준', color:'#C62828', bg:'#FFEBEE'};
  },

  // 스트레스 등급
  calcStressIndex: function(score) {
    if (score===null||score===undefined||score===''||isNaN(score)) return null;
    const n = Number(score);
    if (n < 35)  return {label:'정상',color:'#2E7D32',bg:'#E8F5E9'};
    if (n < 45)  return {label:'초기',color:'#F57F17',bg:'#FFF8E1'};
    if (n < 60)  return {label:'진행',color:'#E65100',bg:'#FBE9E7'};
    return {label:'만성',color:'#C62828',bg:'#FFEBEE'};
  },

  // 심폐기능(VO2peak) 등급 — AppConfig.VO2PEAK_MALE/FEMALE 필요
  calcCardioIndex: function(score, gender, birthDate) {
    if (!score||!gender||!birthDate) return null;
    if (typeof AppConfig === 'undefined') return null;
    const age = new Date().getFullYear() - new Date(birthDate).getFullYear();
    const g = age<=65?'60-65':'66+';
    const tbl = gender==='남자' ? AppConfig.VO2PEAK_MALE[g] : AppConfig.VO2PEAK_FEMALE[g];
    if (!tbl) return null;
    const found = tbl.find(r => Number(score)>=r.min && Number(score)<=r.max);
    return found ? found.label : null;
  },

  // 시공간/기억력 원형게이지 색상
  subGradeColor: function(score) {
    if (score==null||score==='') return '#888';
    const n=Number(score);
    if (n>=67) return '#2E7D32';
    if (n>=34) return '#F57F17';
    return '#C62828';
  },

  // ══════════════════════════════════════════════════════════
  // 2) 기본 SVG/HTML 컴포넌트 (원본과 100% 동일한 마크업)
  // ══════════════════════════════════════════════════════════

  // 공통 conic-gradient 원형 게이지 (AssessmentsPage._conicDonut 원본)
  conicDonut: function(score, color, max, size, thickness) {
    size = size || 100; thickness = thickness || 14;
    var s = (score === null || score === undefined || score === '') ? null : Number(score);
    var inner = size - thickness * 2;
    if (s === null) {
      return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:conic-gradient(#E8E8E8 0% 100%);display:flex;align-items:center;justify-content:center;">' +
        '<div style="width:'+inner+'px;height:'+inner+'px;border-radius:50%;background:white;display:flex;align-items:center;justify-content:center;">' +
        '<span style="font-size:'+(size<90?13:15)+'px;font-weight:800;color:#ccc;">-</span></div></div>';
    }
    var pct = Math.min(100, Math.max(0, s / max * 100));
    var deg = pct * 3.6;
    var txt = s + '점';
    var fs  = txt.length >= 5 ? Math.round(size*0.13) : Math.round(size*0.17);
    return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:conic-gradient('+color+' 0deg '+deg.toFixed(2)+'deg,#E8E8E8 '+deg.toFixed(2)+'deg 360deg);display:flex;align-items:center;justify-content:center;">' +
      '<div style="width:'+inner+'px;height:'+inner+'px;border-radius:50%;background:white;display:flex;align-items:center;justify-content:center;">' +
      '<span style="font-size:'+fs+'px;font-weight:800;color:'+color+';">'+txt+'</span></div></div>';
  },

  // 반원 게이지 (인지점수) — _renderCognitive.gaugeHalf 원본
  semiGauge: function(score, color, max) {
    color = color || '#1565C0'; max = max || 100;
    const pct = Math.min(100, Math.max(0, (Number(score)||0) / max * 100));
    const angle = (pct / 100) * 180;
    const rad = angle * Math.PI / 180;
    const r = 70, cx = 90, cy = 90;
    const endX = cx + r * Math.cos(Math.PI - rad);
    const endY = cy - r * Math.sin(rad);
    const scoreText = score!=null ? score+'점' : '-';
    return `<svg width="180" height="110" viewBox="0 0 180 110">
      <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#E0E0E0" stroke-width="16" stroke-linecap="round"/>
      ${pct>0?`<path d="M 20 90 A 70 70 0 ${angle>180?1:0} 1 ${endX.toFixed(1)} ${endY.toFixed(1)}" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round"/>`:''}
      <text x="90" y="82" text-anchor="middle" font-size="24" font-weight="800" fill="${color}">${scoreText}</text>
      <text x="90" y="104" text-anchor="middle" font-size="10" fill="#bbb">0 ────── ${max}</text>
    </svg>`;
  },

  // 인지점수 블록 (반원게이지 + 등급배지 + 우측 범례) — cognitive 초기렌더 블록 원본
  cogScoreBlock: function(score) {
    const g = this.calcCogIndex(score);
    const color = g?.color || '#1565C0';
    const gauge = this.semiGauge(score, color, 100);
    const badge = g
      ? `<span style="background:${g.bg};color:${g.color};padding:3px 14px;border-radius:12px;font-size:13px;font-weight:700;display:inline-block;margin-top:4px;">${g.label}</span>`
      : `<span style="font-size:10px;color:var(--color-gray-400);">점수 입력 시 등급</span>`;
    const legend = [
      {l:'최적',c:'#1B5E20',t:'(90↑)'},{l:'양호',c:'#2E7D32',t:'(80~89)'},
      {l:'개선',c:'#F57F17',t:'(65~79)'},{l:'주의',c:'#C62828',t:'(~64)'}
    ].map(g2=>`<div style="display:flex;align-items:center;gap:5px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${g2.c};flex-shrink:0;"></span>
        <span style="font-size:10px;color:${g2.c};font-weight:700;">${g2.l} ${g2.t}</span>
      </div>`).join('');
    return `<div style="display:flex;align-items:center;gap:10px;justify-content:center;">
      <div style="text-align:center;">${gauge}${badge}</div>
      <div style="display:flex;flex-direction:column;gap:4px;">${legend}</div>
    </div>`;
  },

  // 동연령대 상위 분포도 히스토그램 — cognitive.percentileBar 원본
  percentileDistribution: function(pct) {
    if (pct==null) return '<div style="font-size:13px;color:var(--color-gray-300);padding:8px;">값 입력 시 표시</div>';

    const p = Math.min(100, Math.max(0, Number(pct)||0));

    const heights=[22,32,42,54,64,54,42,32,22];
    const barW=14, gap=6, n=heights.length;
    const totalW=n*barW+(n-1)*gap;
    const maxH=Math.max(...heights);

    const idx=Math.min(n-1,Math.max(0,Math.round((100-p)/100*(n-1))));
    const markerX=idx*(barW+gap)+barW/2;

    const markerColor = p<=33?'#2E7D32':p<=66?'#F57F17':'#C62828';
    const levelLabel  = p<=33?'상위권':p<=66?'중위권':'하위권';

    const topPad = 16;

    let bars='';
    heights.forEach((h,i)=>{
      const x=i*(barW+gap);
      const y=topPad+(maxH-h);
      const active=i===idx;
      bars += `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="2"
          fill="${active?'#1565C0':'#D0E4F7'}"
        />`;
    });

    return `
      <div>
        <div style="text-align:center;margin-bottom:6px;">
          <span style="font-size:32px;font-weight:900;color:${markerColor};">${p}</span>
          <span style="font-size:16px;font-weight:700;color:${markerColor};">%</span>
          <span style="display:inline-block;margin-left:8px;background:${markerColor}22;color:${markerColor};padding:2px 10px;border-radius:8px;font-size:12px;font-weight:700;">${levelLabel}</span>
        </div>
        <div style="text-align:center;margin-bottom:10px;font-size:12px;color:#666;">
          상위 ${p}%예요.
        </div>
        <div style="display:flex;justify-content:center;padding-top:8px;">
          <svg width="${totalW}" height="${maxH+topPad+14}" viewBox="0 0 ${totalW} ${maxH+topPad+14}">
            <polygon
              points="${markerX-6},${topPad+(maxH-heights[idx])-11}
                      ${markerX+6},${topPad+(maxH-heights[idx])-11}
                      ${markerX},${topPad+(maxH-heights[idx])-3}"
              fill="#1565C0"
            />
            ${bars}
            <text x="${totalW}" y="${maxH+topPad+12}" text-anchor="end" font-size="9" fill="#aaa">1%</text>
            <text x="0" y="${maxH+topPad+12}" text-anchor="start" font-size="9" fill="#aaa">100%</text>
          </svg>
        </div>
      </div>`;
  },

  // 시공간능력/기억력 하단 범례 (파이프 구분) — cognitive 초기렌더 원본
  subGradeLegendRow: function() {
    return `<div style="display:flex;gap:8px;margin-top:8px;font-size:10px;flex-wrap:wrap;justify-content:center;">
      <span style="color:#C62828;font-weight:600;">주의 0~33</span><span style="color:#ddd;">|</span>
      <span style="color:#F57F17;font-weight:600;">관심 34~66</span><span style="color:#ddd;">|</span>
      <span style="color:#2E7D32;font-weight:600;">양호 67~100</span>
    </div>`;
  },

  // 우울점수 하단 범례 — cognitive 초기렌더 원본
  depressionLegendRow: function() {
    return `<div style="display:flex;gap:8px;margin-top:8px;font-size:10px;flex-wrap:wrap;justify-content:center;">
      <span style="color:#2E7D32;font-weight:600;">경도 0~20</span><span style="color:#ddd;">|</span>
      <span style="color:#F57F17;font-weight:600;">중등도 21~24</span><span style="color:#ddd;">|</span>
      <span style="color:#C62828;font-weight:600;">높은 수준 25~60</span>
    </div>`;
  },

  // 치매위험요인 표기 (숫자 + 등급 배지만, 게이지 없음) — cognitive viz-dem 원본
  dementiaDisplay: function(score) {
    if (score == null || score === '') {
      return '<div style="font-size:13px;color:var(--color-gray-300);">값 입력 시 등급 표시</div>';
    }
    const p = Math.min(100, Math.max(0, Number(score)));
    const display = p.toFixed(1);
    const clr = p >= 60 ? '#C62828' : p >= 30 ? '#F57F17' : '#2E7D32';
    const lvl = p >= 60 ? '높음' : p >= 30 ? '주의' : '낮음';
    return `
      <div style="font-size:36px;font-weight:900;color:${clr};line-height:1;">
        ${display}<span style="font-size:18px;">%</span>
      </div>
      <div style="margin-top:8px;">
        <span style="background:${clr}22;color:${clr};padding:4px 14px;border-radius:10px;font-size:14px;font-weight:700;">
          ${lvl}
        </span>
      </div>`;
  },

  // 심폐기능 등급 테이블(공통, 내부용)
  _cardioGrades: function(gender) {
    const isMale = gender === '남자';
    const grades = isMale ?
      [{l:'최우수',min:40,color:'#1B5E20'},{l:'우수',min:36,color:'#2E7D32'},{l:'평균이상',min:32,color:'#388E3C'},
       {l:'평균',min:29,color:'#F57F17'},{l:'평균이하',min:25,color:'#E65100'},{l:'최하위',min:0,color:'#C62828'}] :
      [{l:'최우수',min:33,color:'#1B5E20'},{l:'우수',min:29,color:'#2E7D32'},{l:'평균이상',min:25,color:'#388E3C'},
       {l:'평균',min:22,color:'#F57F17'},{l:'평균이하',min:19,color:'#E65100'},{l:'최하위',min:0,color:'#C62828'}];
    return [...grades].reverse(); // 최하위→최우수 순
  },

  // 심폐기능 값 + 등급배지 (score/badge만, wrapper 없음 — 호출부에서 flex+gap으로 감싸서 사용)
  cardioScoreBadge: function(score, gender, birthDate) {
    const gradesOrdered = this._cardioGrades(gender);
    const cardioIdx = this.calcCardioIndex(score, gender, birthDate);
    const matchedGrade = cardioIdx ? gradesOrdered.find(g=>cardioIdx.includes(g.l)) : null;
    return `<span style="font-size:28px;font-weight:900;color:${matchedGrade?.color||'#888'};">${score!=null?score:'-'}</span>
      ${matchedGrade?`<span style="background:${matchedGrade.color}22;color:${matchedGrade.color};padding:3px 10px;border-radius:8px;font-size:13px;font-weight:700;">${matchedGrade.l}</span>`:''}`;
  },

  // 심폐기능 마커+그라데이션 막대만 (등급명 라벨 줄은 제외 — 범례로 분리해서 쓸 때 사용)
  cardioBar: function(score, gender, birthDate) {
    const isMale = gender === '남자';
    const gradesOrdered = this._cardioGrades(gender);
    const maxV = isMale ? 44 : 37, minV = 0;
    const cardioIdx = this.calcCardioIndex(score, gender, birthDate);
    const pct = score!=null ? Math.min(100,Math.max(0,(Number(score)-minV)/(maxV-minV)*100)) : null;
    const matchedGrade = cardioIdx ? gradesOrdered.find(g=>cardioIdx.includes(g.l)) : null;
    return `${pct!=null?`<div style="position:relative;margin-bottom:2px;height:12px;">
        <div style="position:absolute;left:calc(${pct}% - 6px);top:0;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid ${matchedGrade?.color||'#555'};"></div>
      </div>`:'<div style="height:12px;"></div>'}
      <div style="height:22px;border-radius:6px;overflow:hidden;background:linear-gradient(90deg,#C62828 0%,#E65100 20%,#F57F17 40%,#388E3C 60%,#2E7D32 80%,#1B5E20 100%);">
      </div>`;
  },

  // 심폐기능 막대 하단 등급명 라벨 줄 (기존 cardioSegGauge가 쓰던 것과 동일)
  cardioBarLabels: function(score, gender, birthDate) {
    const gradesOrdered = this._cardioGrades(gender);
    const cardioIdx = this.calcCardioIndex(score, gender, birthDate);
    const matchedGrade = cardioIdx ? gradesOrdered.find(g=>cardioIdx.includes(g.l)) : null;
    return `<div style="display:flex;justify-content:space-between;margin-top:3px;">
      ${gradesOrdered.map(g=>`<div style="font-size:8.5px;font-weight:700;color:${g.l===matchedGrade?.l?g.color:'#aaa'};text-align:center;flex:1;">${g.l}</div>`).join('')}
    </div>`;
  },

  // 심폐기능 등급 범례 — 해당 고객의 성별·연령대에 맞는 기준값만, 2열 그리드로 표시
  cardioGradeLegend: function(score, gender, birthDate) {
    const isMale = gender === '남자';
    const age = birthDate ? new Date().getFullYear()-new Date(birthDate).getFullYear() : null;
    const isOld = age!=null && age>=66;
    const rowsMale = [
      ['최우수','#1B5E20','40.0↑','37.0↑'],['우수','#2E7D32','36.0~39.9','33.0~37.0'],
      ['평균이상','#388E3C','32.0~35.9','29.0~32.9'],['평균','#F57F17','29.0~31.9','26.0~28.9'],
      ['평균이하','#E65100','25.0~28.9','22.0~25.9'],['최하위','#C62828','25.0↓','22.0↓']
    ];
    const rowsFemale = [
      ['최우수','#1B5E20','33.0↑','32.0↑'],['우수','#2E7D32','29.0~32.9','28.0~32.0'],
      ['평균이상','#388E3C','25.0~28.9','25.0~27.9'],['평균','#F57F17','22.0~24.9','22.0~24.9'],
      ['평균이하','#E65100','19.0~21.9','19.0~21.9'],['최하위','#C62828','19.0↓','19.0↓']
    ];
    const rows = isMale ? rowsMale : rowsFemale;
    const cardioIdx = this.calcCardioIndex(score, gender, birthDate);
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px 10px;width:100%;">
      ${rows.map(r=>{
        const label=r[0], color=r[1], range = isOld ? r[3] : r[2];
        const active = cardioIdx && cardioIdx.includes(label);
        return `<div style="display:flex;align-items:center;gap:5px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
          <span style="font-size:11px;font-weight:${active?'800':'600'};color:${color};white-space:nowrap;">${label} ${range}</span>
        </div>`;
      }).join('')}
    </div>`;
  },

  // 심폐기능(VO2peak) 구간형 게이지 — _renderErgo.segGauge 원본 (위 조각 함수들을 조합, 출력은 기존과 동일)
  cardioSegGauge: function(score, gender, birthDate) {
    return `<div style="margin-top:4px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        ${this.cardioScoreBadge(score, gender, birthDate)}
      </div>
      ${this.cardioBar(score, gender, birthDate)}
      ${this.cardioBarLabels(score, gender, birthDate)}
    </div>`;
  },

  // 심폐기능 연령대 기준 등급표 — _renderErgo 우측 테이블 원본
  cardioGradeTable: function(score, gender, birthDate) {
    const isMale = gender === '남자';
    const cardioIdx = this.calcCardioIndex(score, gender, birthDate);
    const age = birthDate ? new Date().getFullYear()-new Date(birthDate).getFullYear() : null;
    const ageGroup = age ? (age<=65?'60~65세':'66세 이상') : '-';
    const rows = isMale?
      [['최우수','40.0↑','37.0↑'],['우수','36.0~39.9','33.0~37.0'],['평균이상','32.0~35.9','29.0~32.9'],['평균','29.0~31.9','26.0~28.9'],['평균이하','25.0~28.9','22.0~25.9'],['최하위','25.0↓','22.0↓']]:
      [['최우수','33.0↑','32.0↑'],['우수','29.0~32.9','28.0~32.0'],['평균이상','25.0~28.9','25.0~27.9'],['평균','22.0~24.9','22.0~24.9'],['평균이하','19.0~21.9','19.0~21.9'],['최하위','19.0↓','19.0↓']];
    return `<div style="margin-top:10px;padding:10px;background:var(--color-gray-50);border-radius:8px;">
      <div style="font-size:11px;font-weight:700;color:var(--color-gray-500);margin-bottom:6px;">${ageGroup} 기준 등급표 (${gender||'?'})</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr style="background:var(--color-gray-100);">
          <th style="padding:3px 6px;text-align:left;font-weight:700;">등급</th>
          <th style="padding:3px 6px;text-align:center;">60~65세</th>
          <th style="padding:3px 6px;text-align:center;">66세 이상</th>
        </tr></thead>
        <tbody>
          ${rows.map((r,i)=>
            `<tr style="background:${cardioIdx&&cardioIdx.includes(r[0])?'#E3F2FD':''};">
              <td style="padding:3px 6px;font-weight:${cardioIdx&&cardioIdx.includes(r[0])?'700':'400'};color:${['#1B5E20','#2E7D32','#388E3C','#F57F17','#E65100','#C62828'][i]};">${r[0]}</td>
              <td style="padding:3px 6px;text-align:center;">${r[1]}</td>
              <td style="padding:3px 6px;text-align:center;">${r[2]}</td>
            </tr>`
          ).join('')}
        </tbody>
      </table>
    </div>`;
  },

  // 스트레스 등급 테이블(공통, 내부용)
  _stressGrades: function() {
    return [
      {l:'정상',max:34,color:'#2E7D32',bg:'#E8F5E9'},
      {l:'초기',max:44,color:'#F57F17',bg:'#FFF8E1'},
      {l:'진행',max:59,color:'#E65100',bg:'#FBE9E7'},
      {l:'만성',max:999,color:'#C62828',bg:'#FFEBEE'}
    ];
  },

  // 스트레스 값 + 등급배지 (score/badge만, wrapper 없음 — 호출부에서 flex+gap으로 감싸서 사용)
  stressScoreBadge: function(score) {
    const stressGrades = this._stressGrades();
    const getGrade = s => (s==null||isNaN(s)) ? null : (stressGrades.find(g=>Number(s)<=g.max)||stressGrades[3]);
    const g = getGrade(score);
    return `<span style="font-size:28px;font-weight:900;color:${g?.color||'#888'};">${score!=null?score:'-'}</span>
      ${g?`<span style="background:${g.bg};color:${g.color};padding:3px 10px;border-radius:8px;font-size:13px;font-weight:700;">${g.l}</span>`:''}`;
  },

  // 스트레스 마커+그라데이션 막대 + 하단 등급명 라벨 줄 (score/badge 제외)
  stressBar: function(score) {
    const stressGrades = this._stressGrades();
    const getGrade = s => (s==null||isNaN(s)) ? null : (stressGrades.find(g=>Number(s)<=g.max)||stressGrades[3]);
    const g = getGrade(score);
    const n = Number(score);
    const pct = score==null?null:
      n<=35?(n/35)*37:
      n<=45?37+(n-35)/10*18:
      n<=60?55+(n-45)/15*23:
      Math.min(100, 78+(n-60)/40*22);
    return `${pct!=null?`<div style="position:relative;margin-bottom:2px;height:12px;">
        <div style="position:absolute;left:calc(${pct}% - 6px);top:0;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid ${g?.color||'#555'};"></div>
      </div>`:'<div style="height:12px;"></div>'}
      <div style="height:22px;border-radius:6px;overflow:hidden;background:linear-gradient(90deg,#4CAF50 0%,#C0CA33 37%,#FFA000 55%,#F44336 78%,#B71C1C 100%);">
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;">
        ${stressGrades.map(g2=>`<div style="font-size:8.5px;font-weight:700;color:${g2.l===g?.l?g2.color:'#aaa'};text-align:center;flex:1;">${g2.l}</div>`).join('')}
      </div>`;
  },

  // 스트레스 구간형 게이지 — _renderStress.segStress 원본 (위 조각 함수들을 조합, 출력은 기존과 동일)
  stressSegGauge: function(score) {
    return `<div style="margin-top:4px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        ${this.stressScoreBadge(score)}
      </div>
      ${this.stressBar(score)}
    </div>`;
  },

  // 신체움직임/체성분 — 큰 숫자 "n / 100점" 표기 (Assessment는 게이지 없이 숫자만 사용)
  plainScoreOutOf100: function(score, color) {
    return `<div style="display:flex;align-items:baseline;gap:6px;justify-content:center;">
      <span style="font-size:52px;font-weight:900;color:${color};">${score!=null?score:'-'}</span>
      <span style="font-size:18px;color:var(--color-gray-400);font-weight:600;">/ 100점</span>
    </div>`;
  },

  // 인바디FRA 항목(신경계/균형/감각) 도넛 + 기준항목 리스트 — _renderFra.fraCol 원본
  fraItemBlock: function(score, color, items) {
    items = items || [];
    const donut = this.conicDonut(score, color, 100, 90, 12);
    return `<div style="text-align:center;">
      ${donut}
      <div style="font-size:11px;color:var(--color-gray-400);margin-top:4px;text-align:left;">
        ${items.map(it=>`<div style="padding:1px 0;">• ${it.label}</div>`).join('')}
      </div>
    </div>`;
  },

  // 일반 등급 배지 — {label,color,bg} 객체를 span으로
  gradeBadge: function(grade) {
    if (!grade) return '';
    return `<span style="background:${grade.bg||(grade.color+'22')};color:${grade.color};padding:3px 14px;border-radius:12px;font-size:13px;font-weight:700;">${grade.label}</span>`;
  },

  // ══════════════════════════════════════════════════════════
  // 3) 통합 리포트(PDF) UI 언어 — 고객상세/평가관리에서도 동일하게 사용
  //    (브랜드 색상, 상태 배지, 범례, 카드 스타일)
  // ══════════════════════════════════════════════════════════
  UI_BR:     '#9B734B',
  UI_BR_DARK:'#6B4E35',
  UI_INK:    '#221D17',
  UI_G500:   '#8B8377',
  UI_CREAM:  '#FBF9F5',
  UI_CREAM2: '#F2ECE2',
  UI_LINE:   '#E6DCCB',
  UI_ORANGE: '#D9822B', // 개선/중등도/관심/(치매·서브항목의)주의 공통색
  UI_RED:    '#C0392B', // 인지점수 전용 "주의"

  // 상태 배지(둥근 pill) — 리포트와 동일 스타일
  statusPill: function(grade) {
    if (!grade) return '';
    const label = grade.label || grade.l;
    const color = grade.color || grade.c;
    const bg = grade.bg || grade.b || (color + '1A');
    return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:700;padding:3px 11px;border-radius:20px;white-space:nowrap;">${label}</span>`;
  },

  // 범례 리스트(● 라벨 : 범위) — 세로 1열. range 텍스트는 항상 회색.
  legendListCol: function(items) {
    return `<div style="display:flex;flex-direction:column;gap:5px;">
      ${(items||[]).map(it=>`<div style="display:flex;align-items:center;gap:5px;white-space:nowrap;">
        <span style="width:7px;height:7px;border-radius:50%;background:${it.color};flex-shrink:0;"></span>
        <span style="font-size:11px;font-weight:${it.active?'800':'600'};color:${it.color};">${it.label}</span>
        <span style="font-size:11px;color:${this.UI_G500};">: ${it.range}</span>
      </div>`).join('')}
    </div>`;
  },
  // 범례 리스트 — 가로 1행(줄바꿈 허용)
  legendListRow: function(items) {
    return `<div style="display:flex;gap:14px;flex-wrap:wrap;">
      ${(items||[]).map(it=>`<div style="display:flex;align-items:center;gap:5px;white-space:nowrap;">
        <span style="width:7px;height:7px;border-radius:50%;background:${it.color};flex-shrink:0;"></span>
        <span style="font-size:11px;font-weight:${it.active?'800':'600'};color:${it.color};">${it.label}</span>
        <span style="font-size:11px;color:${this.UI_G500};">: ${it.range}</span>
      </div>`).join('')}
    </div>`;
  },

  // 등급별 범례 데이터 — 리포트와 동일 임계값/색상
  cogLegendItems: function(grade) {
    return [
      {label:'주의', range:'0~33',   color:this.UI_RED},
      {label:'관심', range:'34~66',  color:this.UI_ORANGE},
      {label:'양호', range:'67~100', color:'#4C8C4A'}
    ].map(it=>({...it, active: grade && grade.label===it.label}));
  },
  subLegendItems: function(grade) {
    return [
      {label:'주의', range:'0~33',   color:this.UI_ORANGE},
      {label:'관심', range:'34~66',  color:this.UI_ORANGE},
      {label:'양호', range:'67~100', color:'#4C8C4A'}
    ].map(it=>({...it, active: grade && grade.label===it.label}));
  },
  depLegendItems: function(grade) {
    return [
      {label:'경도',     range:'0~20',  color:'#4C8C4A'},
      {label:'중등도',   range:'21~24', color:this.UI_ORANGE},
      {label:'높은수준', range:'25~60', color:this.UI_RED}
    ].map(it=>({...it, active: grade && (grade.label||'').startsWith(it.label)}));
  },
  demLegendItems: function(grade) {
    return [
      {label:'낮음', range:'0~29',   color:'#4C8C4A'},
      {label:'주의', range:'30~59',  color:this.UI_ORANGE},
      {label:'높음', range:'60~100', color:this.UI_RED}
    ].map(it=>({...it, active: grade && grade.label===it.label}));
  },
  cardioLegendItems: function(score, gender, birthDate) {
    const isMale = gender==='남자';
    const age2 = birthDate ? new Date().getFullYear()-new Date(birthDate).getFullYear() : null;
    const isOld = age2!=null && age2>=66;
    const rowsMale = [['최우수','#1B5E20','40.0↑','37.0↑'],['우수','#2E7D32','36.0~39.9','33.0~37.0'],['평균이상','#388E3C','32.0~35.9','29.0~32.9'],['평균','#F57F17','29.0~31.9','26.0~28.9'],['평균이하','#E65100','25.0~28.9','22.0~25.9'],['최하위','#C62828','25.0↓','22.0↓']];
    const rowsFemale = [['최우수','#1B5E20','33.0↑','32.0↑'],['우수','#2E7D32','29.0~32.9','28.0~32.0'],['평균이상','#388E3C','25.0~28.9','25.0~27.9'],['평균','#F57F17','22.0~24.9','22.0~24.9'],['평균이하','#E65100','19.0~21.9','19.0~21.9'],['최하위','#C62828','19.0↓','19.0↓']];
    const rows = isMale?rowsMale:rowsFemale;
    const cardioIdx = this.calcCardioIndex(score, gender, birthDate);
    return rows.map(r=>({label:r[0],color:r[1],range: isOld?r[3]:r[2], active: cardioIdx===r[0]}));
  },
  stressLegendItems: function(score) {
    const grades = this._stressGrades();
    const current = this.calcStressIndex(score);
    let prev = 0;
    return grades.map((g,i)=>{
      const range = i===grades.length-1 ? `${prev}↑` : `${prev}~${g.max}`;
      prev = g.max+1;
      return {label:g.l, range, color:g.color, active: current && current.label===g.l};
    });
  },

  // 인지점수 전용 등급 색 오버라이드 — "주의"는 항상 빨강(다른 항목의 "주의"와 구분), "개선"은 주황
  mapCogScoreGrade: function(grade) {
    if (!grade) return grade;
    if (grade.label === '관심') return {...grade, color:this.UI_ORANGE};
    if (grade.label === '주의') return {...grade, color:this.UI_RED};
    return grade;
  },
  // 그 외 인지 하위 항목(시공간/기억력/치매/우울) — 개선·중등도·주의·관심 공통 주황
  mapSubGrade: function(grade) {
    if (!grade) return grade;
    const hit = ['개선','중등도','주의','관심'].some(l => (grade.label||'').includes(l));
    return hit ? {...grade, color:this.UI_ORANGE} : grade;
  },

  // 카드 래퍼(흰 배경 + 연한 브라운 테두리) — 리포트 categoryBox와 동일 언어
  uiCard: function(innerHtml, extraStyle) {
    return `<div style="background:#fff;border:1px solid ${this.UI_CREAM2};border-radius:10px;padding:14px 16px;box-sizing:border-box;${extraStyle||''}">${innerHtml}</div>`;
  },
  // 인바디 스타일 가로 행(라벨-막대-값+배지) — 시공간능력/기억력 등에서 사용
  inbodyRow: function(label, score, max, grade, unit) {
    max = max || 100;
    const pct = score!=null ? Math.min(100,Math.max(0,(Number(score)/max)*100)) : null;
    const fillColor = grade ? grade.color : this.UI_BR;
    return `<div style="display:flex;align-items:center;gap:12px;padding:6px 0;">
      <div style="width:90px;flex-shrink:0;">
        <div style="font-size:11px;font-weight:700;color:${this.UI_INK};text-transform:uppercase;">${label}</div>
      </div>
      <div style="flex:1;min-width:40px;">
        <div style="position:relative;height:10px;background:${this.UI_CREAM2};border-radius:5px;">
          <div style="position:absolute;left:0;top:0;bottom:0;width:${pct||0}%;background:${fillColor};border-radius:5px;"></div>
          ${pct!=null?`<div style="position:absolute;left:calc(${pct}% - 3px);top:-1px;width:7px;height:7px;border-radius:50%;background:${this.UI_INK};border:1.5px solid #fff;"></div>`:''}
        </div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:6px;">
        <span style="font-size:15px;font-weight:800;color:${grade?grade.color:this.UI_INK};">${score!=null?score:'-'}</span>${unit?`<span style="font-size:9.5px;color:${this.UI_G500};">${unit}</span>`:''}
        ${grade?this.statusPill(grade):''}
      </div>
    </div>`;
  },

  // 카드 안 섹션 타이틀(아이콘 + 텍스트 + 우측 얇은 선)
  uiSectionHead: function(icon, title) {
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="font-size:15px;font-weight:800;color:${this.UI_INK};letter-spacing:0.02em;white-space:nowrap;">${icon} ${title}</div>
      <div style="flex:1;height:1px;background:rgba(155,115,75,0.3);"></div>
    </div>`;
  },

  // ══════════════════════════════════════════════════════════
  // 4) 리포트와 100% 동일한 시각화 — 고객상세/평가관리에서도 그대로 사용
  //    (가로 막대, FRA 막대형, 동연령대 미니차트, 값+막대 조합)
  // ══════════════════════════════════════════════════════════

  // 가로 막대 그래프(리포트 barFull과 동일)
  uiBarFull: function(score, max, thickness, color) {
    max = max || 100; thickness = thickness || 10;
    const pct = score!=null ? Math.min(100,Math.max(0,(Number(score)/max)*100)) : 0;
    return `<div style="width:100%;height:${thickness}px;background:${this.UI_CREAM2};border-radius:${Math.round(thickness/2)}px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${color||this.UI_BR};border-radius:${Math.round(thickness/2)}px;"></div>
    </div>`;
  },

  // 큰 숫자 + 막대(리포트의 신체움직임/체성분 카드와 동일)
  uiScoreWithBar: function(score, max, color, note) {
    max = max || 100;
    return `<div style="width:100%;">
      <div style="text-align:center;white-space:nowrap;margin-bottom:8px;"><span style="font-size:24px;font-weight:800;color:${color||this.UI_INK};">${score!=null?score:'-'}</span><span style="font-size:11px;color:${this.UI_G500};">점 / ${max}점</span></div>
      ${this.uiBarFull(score, max, 10, color)}
      ${note?`<div style="font-size:10px;color:${this.UI_G500};margin-top:6px;text-align:center;">${note}</div>`:''}
    </div>`;
  },

  // 인바디FRA 항목(신경계/균형/감각) — 리포트 fraBlock과 동일: 타이틀+값(같은 행) → 막대 → 기준항목 캡션
  fraBarBlock: function(label, score, max, items) {
    items = items || [];
    max = max || 100;
    return `<div style="width:100%;display:flex;flex-direction:column;gap:5px;">
      <div style="display:flex;align-items:baseline;justify-content:space-between;white-space:nowrap;gap:8px;">
        <span style="font-size:11px;font-weight:700;color:${this.UI_G500};text-transform:uppercase;">${label}</span>
        <span><span style="font-size:16px;font-weight:800;color:${this.UI_INK};">${score!=null?score:'-'}</span><span style="font-size:9.5px;color:${this.UI_G500};">점</span></span>
      </div>
      ${this.uiBarFull(score, max, 9)}
      <div style="font-size:9.5px;color:${this.UI_G500};margin-top:2px;">${items.map(it=>it.label).join(', ')}</div>
    </div>`;
  },

  // 동연령대 상위 분포도 — 리포트 percentileMini와 동일 (값 + 미니 히스토그램, 가로 flex, 중앙 정렬)
  percentileMini: function(pct) {
    if (pct==null) return `<div style="font-size:11.5px;color:${this.UI_G500};">데이터 없음</div>`;
    const p = Math.min(100, Math.max(0, Number(pct)||0));
    const heights=[21,32,44,57,44,32,21];
    const barW=16, gap=6, n=heights.length, totalW=n*barW+(n-1)*gap, maxH=Math.max(...heights);
    const idx=Math.min(n-1,Math.max(0,Math.round((100-p)/100*(n-1))));
    let bars='';
    heights.forEach((h,i)=>{ bars+=`<rect x="${i*(barW+gap)}" y="${maxH-h}" width="${barW}" height="${h}" rx="3" fill="${i===idx?this.UI_BR:this.UI_CREAM2}"/>`; });
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;width:100%;padding-top:6px;">
      <div style="white-space:nowrap;"><span style="font-size:16px;font-weight:700;color:${this.UI_INK};">상위 ${p}%예요</span></div>
      <svg width="${totalW}" height="${maxH}" viewBox="0 0 ${totalW} ${maxH}">${bars}</svg>
    </div>`;
  },

  // ══════════════════════════════════════════════════════════
  // 5) 인지관리 6개 지표 시각화 (환산지표 %, 2026-07 개편)
  //    항목: 주의집중력 / 언어능력 / 시공간기능 / 기억력(언어) / 기억력(시각) / 집행기능
  //    data 파라미터 형태: { attention, language, spatial, memoryVerbal, memoryVisual, executive }
  //    (api.js의 _rowToCognitive / _rowToMaster 리턴 필드명과 동일하게 맞춰져 있어
  //     master 객체나 cognitive 객체를 그대로 넘기면 됩니다)
  // ══════════════════════════════════════════════════════════

  COG6_LABELS: ['주의집중력','언어능력','시공간기능','기억력(언어)','기억력(시각)','집행기능'],
  COG6_KEYS:   ['attention','language','spatial','memoryVerbal','memoryVisual','executive'],

  // 하단 공통 안내 문구
  cog6FootNote: function() {
    return `<div style="text-align:center;font-size:11px;color:var(--color-gray-400,#999);margin-top:10px;line-height:1.5;">
      * 환산지표(%)는 각 검사의 결과를 0~100%로 변환한 참고 지표이며,<br>또래 규준과 비교한 백분위 점수가 아닙니다.
    </div>`;
  },

  // (A) 가로 막대그래프 6개
  cog6BarChart: function(data) {
    const rows = this.COG6_LABELS.map((label, i) => {
      const key = this.COG6_KEYS[i];
      const v = data && data[key] != null ? Math.min(100, Math.max(0, Number(data[key]))) : null;
      const pct = v != null ? v : 0;
      return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="width:90px;flex-shrink:0;font-size:13px;color:${this.UI_INK};font-weight:600;">${label}</div>
        <div style="flex:1;height:14px;background:#EEE;border-radius:7px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:#4A90D9;border-radius:7px;"></div>
        </div>
        <div style="width:44px;text-align:right;font-size:13px;font-weight:700;color:${this.UI_INK};">${v != null ? v + '%' : '-'}</div>
      </div>`;
    }).join('');
    return `<div style="width:100%;max-width:420px;">${rows}</div>`;
  },

  // (B) 레이더 차트(6각형)
  cog6RadarChart: function(data) {
    const size = 260, cx = size/2, cy = size/2, r = 90;
    const n = this.COG6_LABELS.length;
    const angleFor = i => (Math.PI * 2 * i / n) - Math.PI/2;

    // 배경 격자 (20/40/60/80/100)
    let grid = '';
    [20,40,60,80,100].forEach(step => {
      const rr = r * step/100;
      const pts = this.COG6_LABELS.map((_, i) => {
        const a = angleFor(i);
        return `${cx + rr*Math.cos(a)},${cy + rr*Math.sin(a)}`;
      }).join(' ');
      grid += `<polygon points="${pts}" fill="none" stroke="#E5E5E5" stroke-width="1"/>`;
    });
    // 축선 + 라벨
    let axes = '', labels = '';
    this.COG6_LABELS.forEach((label, i) => {
      const a = angleFor(i);
      const x = cx + r*Math.cos(a), y = cy + r*Math.sin(a);
      axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#E5E5E5" stroke-width="1"/>`;
      const lx = cx + (r+22)*Math.cos(a), ly = cy + (r+22)*Math.sin(a);
      labels += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="${this.UI_INK||'#333'}">${label}</text>`;
    });
    // 데이터 폴리곤
    const pts = this.COG6_KEYS.map((key, i) => {
      const v = data && data[key] != null ? Math.min(100, Math.max(0, Number(data[key]))) : 0;
      const a = angleFor(i);
      const rr = r * v/100;
      return `${cx + rr*Math.cos(a)},${cy + rr*Math.sin(a)}`;
    }).join(' ');

    return `<svg width="${size}" height="${size+20}" viewBox="0 0 ${size} ${size+20}">
      ${grid}${axes}
      <polygon points="${pts}" fill="#4A90D9" fill-opacity="0.35" stroke="#4A90D9" stroke-width="2"/>
      ${labels}
    </svg>`;
  },

  // (C) 두 시각화 + 안내문구를 한번에 렌더링 (이미지처럼 좌우 배치)
  cog6FullBlock: function(data) {
    return `<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;justify-content:center;">
        <div>${this.cog6BarChart(data)}</div>
        <div>${this.cog6RadarChart(data)}</div>
      </div>
      ${this.cog6FootNote()}`;
  }
};

if (typeof window !== 'undefined') window.AssessVisuals = AssessVisuals;
if (typeof module !== 'undefined' && module.exports) module.exports = AssessVisuals;
