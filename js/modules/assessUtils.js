// ============================================================
// modules/assessUtils.js - v14
// 상태 우선순위: 재평가 > 평가중 > 지연 > 평가대기 > 평가완료
// ============================================================

const AssessUtils = {

  STATUS: {
    WAITING:     { key:'WAITING',     label:'평가대기', color:'#888',    bg:'#F5F5F5',  dotColor:'#CCCCCC' },
    IN_PROGRESS: { key:'IN_PROGRESS', label:'평가중',   color:'#2E7D32', bg:'#E8F5E9',  dotColor:'#4CAF50' },
    RE_EVAL:     { key:'RE_EVAL',     label:'재평가',   color:'#F9A825', bg:'#FFF8E1',  dotColor:'#F9A825' },
    DELAYED:     { key:'DELAYED',     label:'지연',     color:'#E53935', bg:'#FFEBEE',  dotColor:'#E53935' },
    COMPLETED:   { key:'COMPLETED',   label:'평가완료', color:'#1565C0', bg:'#E3F2FD',  dotColor:'#1565C0' }
  },

  // ── 날짜 유틸 ────────────────────────────────────────────
  _fmt: function(d) {
    if (!d) return null;
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  },
  _parse: function(str) {
    if (!str) return null;
    const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2]-1, +m[3]);
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  },
  fmtDate: function(str) {
    if (!str || str === '-') return '-';
    const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(str);
    if (!isNaN(d.getTime())) return this._fmt(d);
    return String(str).substring(0, 10);
  },
  today: function() {
    const t = new Date(); t.setHours(0,0,0,0); return t;
  },
  daysDiff: function(a, b) {
    return Math.floor((b - a) / 86400000);
  },
  isWithin7Days: function(str) {
    if (!str || str === '-') return false;
    const d = this._parse(this.fmtDate(str));
    if (!d) return false;
    const today = this.today();
    const ago7  = new Date(today); ago7.setDate(today.getDate() - 7);
    return d >= ago7 && d <= today;
  },

  // ── 회차 평가 기간 ───────────────────────────────────────
  // 1회차: 입소 등록일(firstVisitDate) ~ 입소일자(admitDate)
  //
  // N회차(N≥2): 28일 단위 사이클, 각 사이클의 21~27일차가 평가 가능 기간
  //   시작(평가 가능): 입소일 + (N-2)*28 + 21일
  //   마감(평가 종료): 입소일 + (N-2)*28 + 27일
  //
  // 검증 (입소일 2026-06-09):
  //   2회차: 2026-06-30(+21) ~ 2026-07-06(+27)
  //   3회차: 2026-07-28(+49) ~ 2026-08-03(+55)
  //   4회차: 2026-08-25(+77) ~ 2026-08-31(+83)
  //   5회차: 2026-09-22(+105) ~ 2026-09-28(+111)
  //   6회차: 2026-10-20(+133) ~ 2026-10-26(+139)
  //   7회차: 2026-11-17(+161) ~ 2026-11-23(+167)
  getRoundPeriod: function(admitDate, round, firstVisitDate) {
    if (!admitDate) return null;
    const admit = this._parse(admitDate);
    if (!admit) return null;
    let start, end;
    if (round === 1) {
      // 1회차: 입소 등록일 ~ 입소일 (등록일 없으면 입소일 당일)
      const fv = firstVisitDate ? this._parse(firstVisitDate) : null;
      start = (fv && fv <= admit) ? fv : new Date(admit);
      end   = new Date(admit);
    } else {
      // N회차: (N-2)*28 + 21일 ~ (N-2)*28 + 27일
      const base = (round - 2) * 28;
      start = new Date(admit); start.setDate(admit.getDate() + base + 21);
      end   = new Date(admit); end.setDate(admit.getDate() + base + 27);
    }
    return { start, end, startStr: this._fmt(start), endStr: this._fmt(end) };
  },

  getRoundDeadline: function(admitDate, round, firstVisitDate) {
    const p = this.getRoundPeriod(admitDate, round, firstVisitDate);
    return p ? p.endStr : null;
  },

  // ── 이전 회차 완료 여부 확인 ─────────────────────────────
  // 이전 회차가 "완료" 상태인지 판단
  // → reportGenerated=true 이면 완료
  _isPrevCompleted: function(clientId, round, overview) {
    if (round === 1) return true; // 1회차는 이전 회차 없음
    const prevOv = overview[clientId]?.rounds[round - 1];
    return !!(prevOv?.reportGenerated);
  },

  // ── 핵심: 회차 상태 계산 (우선순위 적용) ─────────────────
  // 우선순위: 재평가 > 평가중 > 지연 > 평가대기 > 평가완료
  calcRoundStatus: function(admitDate, round, ov, prevOv, firstVisitDate) {
    const today  = this.today();
    const period = this.getRoundPeriod(admitDate, round, firstVisitDate);
    if (!period) return this.STATUS.WAITING;

    const doneCats        = ov?.doneCats        || 0;
    const reportGenerated = ov?.reportGenerated  || false;

    // ── 1순위: 재평가 ──
    // 4개 완료 + 리포트 미생성 = 수정 후 재생성 필요
    if (doneCats === 4 && !reportGenerated) {
      return { ...this.STATUS.RE_EVAL };
    }

    // ── 2순위: 평가중 ──
    // 평가 데이터가 1개라도 있고 4개 미만인 경우
    // 지연 상태라도 입력 시작하면 평가중
    if (doneCats > 0 && doneCats < 4) {
      return { ...this.STATUS.IN_PROGRESS };
    }

    // ── 3순위: 지연 ──
    // 조건: 평가 기간 종료 + 미완료 + 이전 회차 완료
    if (today > period.end && doneCats === 0) {
      // 이전 회차 미완료면 지연 미표시
      const prevCompleted = round === 1 ? true : !!(prevOv?.reportGenerated);
      if (!prevCompleted) return { ...this.STATUS.WAITING }; // 표시 제외
      const delayDays = this.daysDiff(period.end, today);
      return { ...this.STATUS.DELAYED, label:`${delayDays}일 지연`, delayDays };
    }

    // ── 4순위: 평가대기 ──
    // 조건: 평가 기간 해당 + 이전 회차 완료 + 미입력
    if (doneCats === 0) {
      // 이전 회차 미완료면 대기 미표시 (NOT_STARTED로 처리)
      const prevCompleted = round === 1 ? true : !!(prevOv?.reportGenerated);
      if (!prevCompleted) return { key:'NOT_STARTED', label:'-', color:'#CCC', bg:'#F5F5F5', dotColor:'#CCCCCC' };
      // 평가 기간 이전이면 대기
      if (today < period.start) return { ...this.STATUS.WAITING, label:'평가 예정' };
      // 평가 기간 내
      return { ...this.STATUS.WAITING, label:'평가 가능', color:'#F57F17', bg:'#FFF8E1' };
    }

    // ── 5순위: 평가완료 ──
    if (reportGenerated) {
      return { ...this.STATUS.COMPLETED };
    }

    return { ...this.STATUS.WAITING };
  },

  // ── 회차 점 색상 ─────────────────────────────────────────
  calcRoundDotStatus: function(admitDate, round, ov, prevOv, totalRounds, firstVisitDate) {
    if (round > totalRounds) return 'NOT_TARGET';
    const st = this.calcRoundStatus(admitDate, round, ov, prevOv, firstVisitDate);
    if (st.key === 'NOT_STARTED') return 'NOT_TARGET';
    return st.key;
  },

  getDotColor: function(statusKey) {
    const map = {
      WAITING:     '#CCCCCC',
      IN_PROGRESS: '#4CAF50',
      RE_EVAL:     '#F9A825',
      DELAYED:     '#E53935',
      COMPLETED:   '#1565C0',
      NOT_TARGET:  '#CCCCCC',
      NOT_STARTED: '#CCCCCC'
    };
    return map[statusKey] || '#CCCCCC';
  },

  // ── 이번 주 범위 (월~일) ─────────────────────────────────
  getThisWeekRange: function() {
    const today = this.today();
    const day   = today.getDay();
    const mon   = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: mon, end: sun };
  }
};
