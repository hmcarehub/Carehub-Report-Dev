
     const isSingle = pts.length===1;
     const axMax = (yDef[field]||{max:100}).max;
      const W=200, H=100, padL=10, padR=10, padT=22, padB=14;
      // 상단 여백을 넉넉히 줘서 별/라벨이 카드 밖으로 안 잘리게
      const W=200, H=100, padL=12, padR=12, padT=16, padB=18;
     const innerW = W-padL-padR, innerH = H-padT-padB;
     const xPos = i => isSingle ? padL+innerW/2 : padL + i*(innerW/(pts.length-1));
     const yPos = v => padT + (1-Math.min(1,Math.max(0,v/axMax)))*innerH;

     const latest = pts[pts.length-1]?.v;
     const first  = pts[0]?.v;
     const diff   = pts.length>1 ? Math.round((latest-first)*10)/10 : null;
      const diffBadge = diff==null?'':
        diff>0?`<span style="font-size:18px;font-weight:800;color:#1D6FF2;margin-left:4px;">▲${diff}${unit}</span>`:
        diff<0?`<span style="font-size:18px;font-weight:800;color:#E53935;margin-left:4px;">▼${Math.abs(diff)}${unit}</span>`:'';

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
@@ -1457,61 +1464,51 @@ const ClientDetailPage = {
     if (!isSingle) {
       areaD = pathD + ` L${xPos(pts.length-1)},${H-padB} L${xPos(0)},${H-padB} Z`;
       svgGraph += `<path d="${areaD}" fill="${AC}" stroke="none"/>`;
        svgGraph += `<path d="${pathD}" fill="none" stroke="${LC}" stroke-width="1.8" stroke-linejoin="round"/>`;
        svgGraph += `<path d="${pathD}" fill="none" stroke="${LC}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
     }

      pts.forEach((p,i)=>{
        const x=xPos(i), y=yPos(p.v);
        const isLatest = i===pts.length-1;
        if (isLatest) {
          const sp = Array.from({length:5},(_,si)=>{
            const a=(si*72-90)*Math.PI/180, a2=((si*72+36)-90)*Math.PI/180;
            return `${x+5*Math.cos(a)},${y+5*Math.sin(a)} ${x+2*Math.cos(a2)},${y+2*Math.sin(a2)}`;
          }).join(' ');
          svgGraph += `<polygon points="${sp}" fill="#F59E0B" stroke="#D97706" stroke-width="0.5"/>`;
        } else {
          svgGraph += `<circle cx="${x}" cy="${y}" r="2.5" fill="${LC}" stroke="white" stroke-width="1"/>`;
        }
        const wLbl = p.round===1 ? '초기' : `${(p.round-1)*4}주`;
        svgGraph += `<text x="${x}" y="${H-2}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#bbb">${wLbl}</text>`;
      });
     svgGraph += `<line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="rgba(155,115,75,0.25)" stroke-width="0.8"/>`;

      let htmlLabels = '';
      // ── HTML 오버레이: 점/별 마커 + 값/주차 라벨 → 컨테이너 비율과 무관하게 항상 고정 크기 ──
      let htmlOverlay = '';
     pts.forEach((p,i)=>{
        const x=xPos(i), y=yPos(p.v);
        const xPct = (xPos(i)/W*100).toFixed(2);
        const yPct = (yPos(p.v)/H*100).toFixed(2);
       const isLatest = i===pts.length-1;
        const pctX = (x/W*100).toFixed(1);
        const pctY = (y/H*100).toFixed(1);

       if (isLatest) {
          htmlLabels += `<span style="position:absolute;right:${(100-x/W*100).toFixed(1)}%;bottom:${(100-(y/H*100)).toFixed(1)}%;transform:translateY(-14px);font-size:18px;font-weight:700;color:${LC};white-space:nowrap;line-height:1;">${p.v}${unit==='점'?'점':unit}</span>`;
          htmlOverlay += `<div style="position:absolute;left:${xPct}%;top:${yPct}%;transform:translate(-50%,-50%);font-size:18px;line-height:1;color:#F59E0B;text-shadow:0 0 2px rgba(217,119,6,0.6);">★</div>`;
          htmlOverlay += `<span style="position:absolute;left:${xPct}%;top:${yPct}%;transform:translate(-50%,calc(-100% - 12px));font-size:18px;font-weight:800;color:${LC};white-space:nowrap;">${p.v}${unit}</span>`;
       } else {
          htmlLabels += `<span style="position:absolute;left:${pctX}%;bottom:${(100-(y/H*100)).toFixed(1)}%;transform:translateY(-10px);font-size:18px;font-weight:500;color:#999;white-space:nowrap;line-height:1;">${p.v}${unit==='점'?'점':unit}</span>`;
          htmlOverlay += `<div style="position:absolute;left:${xPct}%;top:${yPct}%;width:7px;height:7px;border-radius:50%;background:${LC};border:1.5px solid white;transform:translate(-50%,-50%);"></div>`;
          htmlOverlay += `<span style="position:absolute;left:${xPct}%;top:${yPct}%;transform:translate(-50%,calc(-100% - 8px));font-size:17px;font-weight:500;color:#999;white-space:nowrap;">${p.v}${unit}</span>`;
       }
        const wLbl = p.round===1 ? '초기' : `${(p.round-1)*4}주`;
        htmlOverlay += `<span style="position:absolute;left:${xPct}%;bottom:2px;transform:translateX(-50%);font-size:12px;color:#bbb;">${wLbl}</span>`;
     });

      return `<div style="display:flex;flex-direction:column;flex:1;min-width:0;padding:8px 21px 6px 21px;border:1px solid ${BR};border-radius:7px;box-sizing:border-box;background:rgba(155,115,75,0.03);">
        <div style="font-size:18px;font-weight:700;color:#3A2A1A;margin-bottom:3px;display:flex;align-items:center;flex-wrap:wrap;white-space:nowrap;padding:0 2px;">${label}${diffBadge}</div>
      return `<div style="display:flex;flex-direction:column;flex:1;min-width:0;padding:10px 20px 8px;border:1px solid ${BR};border-radius:8px;box-sizing:border-box;background:rgba(155,115,75,0.03);">
        <div style="font-size:19px;font-weight:700;color:#3A2A1A;white-space:nowrap;">${label}</div>
        <div style="margin-top:4px;margin-bottom:4px;">${diffBadge}</div>
       <div style="flex:1;min-height:0;position:relative;">
         <svg width="100%" height="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;">${svgGraph}</svg>
          ${htmlLabels}
          ${htmlOverlay}
       </div>
     </div>`;
   };

   const row = (items) => `
      <div style="display:flex;gap:10px;flex:1;min-height:0;">
      <div style="display:flex;gap:12px;flex:1;min-height:0;">
       ${items.map(it=>makeChart(it.field,it.label,it.unit||'')).filter(Boolean).join('')}
     </div>`;

   const sec = (label,color,items) => `
      <div style="display:flex;flex-direction:column;flex:1;min-height:0;margin-bottom:6px;">
        <div style="font-size:18px;font-weight:800;color:${color};letter-spacing:0.04em;margin-bottom:3px;padding-bottom:2px;border-bottom:1px solid rgba(155,115,75,0.2);flex-shrink:0;">${label}</div>
      <div style="display:flex;flex-direction:column;flex:1;min-height:0;">
        <div style="font-size:18px;font-weight:800;color:${color};letter-spacing:0.04em;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(155,115,75,0.2);flex-shrink:0;">${label}</div>
       ${row(items)}
     </div>`;

   return `
      <div style="height:100%;display:flex;flex-direction:column;">
      <div style="height:100%;display:flex;flex-direction:column;gap:18px;padding:10px 0 6px;">
       ${sec('🧠 인지','#6B4E35',[{field:'cogScore',label:'인지점수',unit:'점'},{field:'depression',label:'우울점수',unit:'점'}])}
       ${sec('🏃 움직임','#6B4E35',[{field:'cardioScore',label:'심폐기능지수',unit:''},{field:'bodyMovementIndex',label:'신체움직임',unit:'점'},{field:'balanceScore',label:'통합균형능력',unit:'점'}])}
       ${sec('💊 대사','#6B4E35',[{field:'bodyCompScore',label:'체성분점수',unit:'점'},{field:'stressScore',label:'스트레스점수',unit:'점'}])}
