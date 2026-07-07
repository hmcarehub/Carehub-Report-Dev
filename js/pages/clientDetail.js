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
@@ -1218,7 +1298,7 @@ const ClientDetailPage = {
             const pct=Math.min(100,Math.max(0,Number(score)||0));
             const r=36,circ=2*Math.PI*r,dash=(pct/100)*circ;
             return `<div style="padding:7px 12px;background:#F8FBFF;border-radius:7px;border:1px solid #E3F2FD;display:flex;flex-direction:column;align-items:center;">
                <div style="font-size:20px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">${item.label}</div>
                <div style="font-size:16px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">${item.label}</div>
               <div style="display:flex;align-items:center;gap:8px;">
                 <svg width="88" height="88" viewBox="0 0 88 88" style="flex-shrink:0;">
                   <circle cx="44" cy="44" r="${r}" fill="none" stroke="#E8E8E8" stroke-width="10"/>
@@ -1239,7 +1319,7 @@ const ClientDetailPage = {
             const pct=score!=null?Math.min(100,(Number(score)/60)*100):0;
             const r=36,circ=2*Math.PI*r,dash=(pct/100)*circ, clr=dg?.c||'#7B1FA2';
             return `<div style="padding:7px 12px;background:#F8FBFF;border-radius:7px;border:1px solid #E3F2FD;display:flex;flex-direction:column;align-items:center;">
                <div style="font-size:20px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">우울점수</div>
                <div style="font-size:16px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">우울점수</div>
               <div style="display:flex;align-items:center;gap:8px;">
                 <svg width="88" height="88" viewBox="0 0 88 88" style="flex-shrink:0;">
                   <circle cx="44" cy="44" r="${r}" fill="none" stroke="#E8E8E8" stroke-width="10"/>
@@ -1260,7 +1340,7 @@ const ClientDetailPage = {
             const clr=p==null?'#888':p>=60?'#C62828':p>=30?'#F57F17':'#2E7D32';
             const lvl=p==null?'-':p>=60?'높음':p>=30?'주의':'낮음';
             return `<div style="padding:7px 12px;background:#F8FBFF;border-radius:7px;border:1px solid #E3F2FD;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="font-size:20px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">치매위험요인</div>
                <div style="font-size:16px;font-weight:900;color:#1A1A1A;margin-bottom:10px;align-self:flex-start;">치매위험요인</div>
               <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                 ${p!=null?`
                 <div style="font-size:30px;font-weight:900;color:${clr};line-height:1;">${p}<span style="font-size:14px;font-weight:600;">%</span></div>
@@ -1277,7 +1357,7 @@ const ClientDetailPage = {
   <!-- ▣ 움직임 관리 (flex:2) -->
   <div style="border:1.5px solid #C8E6C9;border-radius:8px;overflow:hidden;flex:2;display:flex;flex-direction:column;min-height:0;">
     <div style="background:#2E7D32;padding:6px 12px;flex-shrink:0;">
        <span style="font-size:20px;font-weight:900;color:white;">🏃 움직임 관리 리포트</span>
        <span style="font-size:16px;font-weight:900;color:white;">🏃 움직임 관리 리포트</span>
     </div>
     <div style="padding:8px 12px;background:white;flex:1;overflow:hidden;display:flex;flex-direction:column;gap:7px;">

@@ -1335,14 +1415,14 @@ const ClientDetailPage = {
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
@@ -1355,20 +1435,20 @@ const ClientDetailPage = {
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
@@ -1411,7 +1491,7 @@ const ClientDetailPage = {
 <!-- 헤더 -->
 <div style="border-bottom:2px solid rgba(155,115,75,0.8);padding-bottom:6px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
   <div style="font-size:20px;font-weight:800;color:#1A1A1A;">기간별 지표 변화</div>
    <div style="font-size:18px;color:#aaa;">${c.name} · ${todayStr}</div>
    <div style="font-size:16px;color:#aaa;">${c.name} · ${todayStr}</div>
 </div>

 <!-- 추이 그래프 영역 -->
@@ -1530,28 +1610,28 @@ const ClientDetailPage = {
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
