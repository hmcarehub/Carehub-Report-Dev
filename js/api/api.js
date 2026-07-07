// ============================================================
// api/api.js - Supabase REST API 버전 (Supabase Auth 연동)
// ============================================================

const API = {

  // ── 인메모리 캐시 ──────────────────────────────────────────
  _cache: {},
  _pending: {},
  _CACHE_TTL: {
    getInitialData:      60000,
    getClients:          60000,
    getClientDetail:     20000,
    getClientMasterList: 20000,
    getAssessOverview:   60000,
    getStandards:       300000
  },
  _getCached: function(action, params) {
    const key = action + '_' + (params?.clientId||'') + '_' + (params?.round||'');
    const ttl = this._CACHE_TTL[action];
    if (!ttl || !this._cache[key]) return null;
    const { result, ts } = this._cache[key];
    if (Date.now() - ts >= ttl) return null;
    return result;
  },
  _setCache: function(action, params, result) {
    const key = action + '_' + (params?.clientId||'') + '_' + (params?.round||'');
    this._cache[key] = { result, ts: Date.now() };
  },
  _bust: function(...actions) {
    actions.forEach(a => {
      Object.keys(this._cache).forEach(k => {
        if (k.startsWith(a)) delete this._cache[k];
      });
    });
  },

  // ── Supabase REST 헬퍼 ─────────────────────────────────────
  _url: function(table, query) {
    const base = `${AppConfig.SUPABASE_URL}/rest/v1/${table}`;
    return query ? `${base}?${query}` : base;
  },

  // ✅ async로 변경 — Supabase Auth session token 사용
  _headers: async function() {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token || AppConfig.SUPABASE_ANON;
    return {
      'Content-Type':  'application/json',
      'apikey':        AppConfig.SUPABASE_ANON,
      'Authorization': `Bearer ${token}`,
      'Prefer':        'return=representation'
    };
  },

  _eq: function(col, val) {
    return `${col}=eq.${encodeURIComponent(val)}`;
  },

  // ✅ await this._headers() 로 변경
  _get: async function(table, query) {
    const url = this._url(table, query);
    const r = await fetch(url, {
      method: 'GET',
      headers: await this._headers()
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error((err.message || err.hint || `HTTP ${r.status} - ${r.statusText}`) + ` [table: ${table}]`);
    }
    return r.json();
  },

  _post: async function(table, body) {
    const r = await fetch(this._url(table), {
      method: 'POST',
      headers: await this._headers(),
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || err.hint || `HTTP ${r.status}`);
    }
    const text = await r.text();
    return text ? JSON.parse(text) : [];
  },

  _patch: async function(table, query, body) {
    const r = await fetch(this._url(table, query), {
      method: 'PATCH',
      headers: await this._headers(),
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || err.hint || `HTTP ${r.status}`);
    }
    const text = await r.text();
    return text ? JSON.parse(text) : [];
  },

  _delete: async function(table, query) {
    const headers = await this._headers();
    const r = await fetch(this._url(table, query), {
      method: 'DELETE',
      headers: { ...headers, Prefer: 'return=minimal' }
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || err.hint || `HTTP ${r.status}`);
    }
  },

  // ── 날짜/유틸 ─────────────────────────────────────────────
  _now: () => new Date().toISOString(),
  _safeNum: (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v); return isNaN(n) ? null : n;
  },
  _safeStr: (v) => (v === null || v === undefined) ? '' : String(v),
  _safeDateStr: function(v) {
    if (!v) return '';
    if (typeof v === 'string') return v.substring(0, 10);
    if (v instanceof Date) {
      const p = n => String(n).padStart(2,'0');
      return `${v.getFullYear()}-${p(v.getMonth()+1)}-${p(v.getDate())}`;
    }
    return String(v).substring(0, 10);
  },
  _calcEndDate: function(admitDateStr, period) {
    const days = AppConfig.PERIOD_DAYS[period] || 0;
    if (!admitDateStr || !days) return '';
    const d = new Date(admitDateStr);
    d.setDate(d.getDate() + days - 1);
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  },
  // _calcClientStatus: function(admitDateStr, endDateStr) {
  //   const today = new Date(); today.setHours(0,0,0,0);
  //   const admit = admitDateStr ? new Date(admitDateStr) : null;
  //   const end   = endDateStr   ? new Date(endDateStr)   : null;
  //   if (!admit || today < admit) return '입소예정';
  //   if (!end   || today > end)   return '퇴소';
  //   return '입소중';
  // },
  _calcClientStatus: function(admitDateStr, endDateStr) {
    const today = new Date(); today.setHours(0,0,0,0);
    const admit = admitDateStr ? parseLocalDate(admitDateStr) : null;   // ✅
    const end   = endDateStr   ? parseLocalDate(endDateStr)   : null;   // ✅
    if (!admit || today < admit) return '입소예정';
    if (!end   || today > end)   return '퇴소';
    return '입소중';
  },
  _calcCardioIndex: function(score, gender, birthDate) {
    if (score === null || score === undefined || isNaN(score) || !gender || !birthDate) return '';
    const age = new Date().getFullYear() - new Date(birthDate).getFullYear();
    const group = age <= 65 ? '60-65' : '66+';
    const tables = gender === '남자' ? AppConfig.VO2PEAK_MALE : AppConfig.VO2PEAK_FEMALE;
    const table = tables[group] || [];
    const found = table.find(g => score >= g.min && score <= g.max);
    return found ? found.label.replace(/ \(.*\)/, '') : '';
  },
  _generateId: () => 'ID' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,5).toUpperCase(),

  // ── 행 → JS 객체 변환 ─────────────────────────────────────
  _rowToClient: function(row) {
    const c = AppConfig.CLIENT_COLS;
    const admitDate = this._safeDateStr(row[c.ADMIT_DATE]);
    const endDate   = this._safeDateStr(row[c.END_DATE]);
    return {
      clientId:    this._safeStr(row[c.CLIENT_ID]),
      name:        this._safeStr(row[c.NAME]),
      birthDate:   this._safeDateStr(row[c.BIRTH_DATE]),
      gender:      this._safeStr(row[c.GENDER]),
      phone:       this._safeStr(row[c.PHONE]),
      firstVisit:  this._safeDateStr(row[c.FIRST_VISIT]),
      admitDate,
      admitPeriod: this._safeStr(row[c.ADMIT_PERIOD]),
      endDate,
      totalRounds: Number(row[c.TOTAL_ROUNDS] || 0),
      doneRounds:  Number(row[c.DONE_ROUNDS]  || 0),
      status:      this._calcClientStatus(admitDate, endDate),
      roomNum:     this._safeStr(row[c.ROOM_NUM]),
      note:        this._safeStr(row[c.NOTE])
    };
  },

  _rowToMaster: function(row) {
    const c = AppConfig.MASTER_COLS;
    return {
      reportId:          this._safeStr(row[c.REPORT_ID]),
      clientId:          this._safeStr(row[c.CLIENT_ID]),
      round:             Number(row[c.ROUND] || 0),
      cogScore:          this._safeNum(row[c.COG_SCORE]),
      agePercentile:     this._safeNum(row[c.AGE_PERCENTILE]),
      depression:        this._safeNum(row[c.DEPRESSION]),
      dementiaRisk:      this._safeNum(row[c.DEMENTIA_RISK]),
      cardioScore:       this._safeNum(row[c.CARDIO_SCORE]),
      cardioIndex:       this._safeStr(row[c.CARDIO_INDEX]),
      bodyMovementIndex: this._safeNum(row[c.BODY_MOVEMENT_INDEX]),
      nervousScore:      this._safeNum(row[c.NERVOUS_SCORE]),
      balanceScore:      this._safeNum(row[c.BALANCE_SCORE]),
      sensoryScore:      this._safeNum(row[c.SENSORY_SCORE]),
      bodyCompScore:     this._safeNum(row[c.BODY_COMP_SCORE]),
      stressScore:       this._safeNum(row[c.STRESS_SCORE]),
      cogComment:        this._safeStr(row[c.COG_COMMENT]),
      exComment:         this._safeStr(row[c.EX_COMMENT]),
      cmComment:         this._safeStr(row[c.CM_COMMENT]),
      cognitiveDone:     !!row[c.COGNITIVE_DONE],
      movementDone:      !!row[c.MOVEMENT_DONE],
      metabolismDone:    !!row[c.METABOLISM_DONE],
      commentDone:       !!row[c.COMMENT_DONE],
      createdAt:         this._safeStr(row[c.CREATED_AT]),
      assessDate:        this._safeDateStr(row[c.ASSESS_DATE]),
      reportCreatedAt:   this._safeStr(row[c.REPORT_CREATED_AT]),
      reportGenerated:   !!row[c.REPORT_GENERATED]
    };
  },

  _rowToCognitive: function(row) {
    const c = AppConfig.COG_COLS;
    return {
      assessId:      this._safeStr(row[c.ASSESS_ID]),
      clientId:      this._safeStr(row[c.CLIENT_ID]),
      measureDate:   this._safeDateStr(row[c.MEASURE_DATE]),
      round:         Number(row[c.ROUND] || 0),
      cogScore:      this._safeNum(row[c.COG_SCORE]),
      spatial:       this._safeNum(row[c.SPATIAL]),
      memory:        this._safeNum(row[c.MEMORY]),
      agePercentile: this._safeNum(row[c.AGE_PERCENTILE]),
      depression:    this._safeNum(row[c.DEPRESSION]),
      dementiaRisk:  this._safeNum(row[c.DEMENTIA_RISK]),
      createdAt:     this._safeStr(row[c.CREATED_AT])
    };
  },
  _rowToErgo: function(row) {
    const c = AppConfig.ERGO_COLS;
    return {
      assessId:    this._safeStr(row[c.ASSESS_ID]),
      clientId:    this._safeStr(row[c.CLIENT_ID]),
      measureDate: this._safeDateStr(row[c.MEASURE_DATE]),
      round:       Number(row[c.ROUND] || 0),
      cardioScore: this._safeNum(row[c.CARDIO_SCORE]),
      cardioIndex: this._safeStr(row[c.CARDIO_INDEX]),
      createdAt:   this._safeStr(row[c.CREATED_AT])
    };
  },
  _rowToEverex: function(row) {
    const c = AppConfig.EVEREX_COLS;
    return {
      assessId:          this._safeStr(row[c.ASSESS_ID]),
      clientId:          this._safeStr(row[c.CLIENT_ID]),
      measureDate:       this._safeDateStr(row[c.MEASURE_DATE]),
      round:             Number(row[c.ROUND] || 0),
      bodyMovementIndex: this._safeNum(row[c.BODY_MOVEMENT_INDEX]),
      createdAt:         this._safeStr(row[c.CREATED_AT])
    };
  },
  _rowToFra: function(row) {
    const c = AppConfig.FRA_COLS;
    return {
      assessId:     this._safeStr(row[c.ASSESS_ID]),
      clientId:     this._safeStr(row[c.CLIENT_ID]),
      measureDate:  this._safeDateStr(row[c.MEASURE_DATE]),
      round:        Number(row[c.ROUND] || 0),
      nervousScore: this._safeNum(row[c.NERVOUS_SCORE]),
      balanceScore: this._safeNum(row[c.BALANCE_SCORE]),
      sensoryScore: this._safeNum(row[c.SENSORY_SCORE]),
      createdAt:    this._safeStr(row[c.CREATED_AT])
    };
  },
  _rowToInbody: function(row) {
    const c = AppConfig.INBODY_COLS;
    return {
      assessId:      this._safeStr(row[c.ASSESS_ID]),
      clientId:      this._safeStr(row[c.CLIENT_ID]),
      measureDate:   this._safeDateStr(row[c.MEASURE_DATE]),
      round:         Number(row[c.ROUND] || 0),
      bodyCompScore: this._safeNum(row[c.BODY_COMP_SCORE]),
      createdAt:     this._safeStr(row[c.CREATED_AT])
    };
  },
  _rowToStress: function(row) {
    const c = AppConfig.STRESS_COLS;
    return {
      assessId:    this._safeStr(row[c.ASSESS_ID]),
      clientId:    this._safeStr(row[c.CLIENT_ID]),
      measureDate: this._safeDateStr(row[c.MEASURE_DATE]),
      round:       Number(row[c.ROUND] || 0),
      stressScore: this._safeNum(row[c.STRESS_SCORE]),
      createdAt:   this._safeStr(row[c.CREATED_AT])
    };
  },
  _rowToComment: function(row) {
    const c = AppConfig.COMMENT_COLS;
    return {
      commentId:  this._safeStr(row[c.COMMENT_ID]),
      clientId:   this._safeStr(row[c.CLIENT_ID]),
      round:      Number(row[c.ROUND] || 0),
      cogComment: this._safeStr(row[c.COG_COMMENT]),
      cogUpdated: this._safeStr(row[c.COG_UPDATED]),
      exComment:  this._safeStr(row[c.EX_COMMENT]),
      exUpdated:  this._safeStr(row[c.EX_UPDATED]),
      cmComment:  this._safeStr(row[c.CM_COMMENT]),
      cmUpdated:  this._safeStr(row[c.CM_UPDATED]),
      updatedAt:  this._safeStr(row[c.UPDATED_AT])
    };
  },

  // ============================================================
  // ── 사용자 API ─────────────────────────────────────────────
  // ============================================================

  // ✅ 로그인은 반드시 Supabase Auth 만 사용 (users.password 완전히 제거)
  //    로그인 성공 후 auth.uid() 기준으로 users 테이블을 조회하여
  //    권한(role)/상태(status)를 가져온다.
login: async function(id, pw) {
  try {
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: id, // ✅ login_id 자체가 이메일이므로 그대로 사용 (기존의 @ 파싱 로직 제거)
      password: pw
    });
    if (authError) return { status:'error', message:'아이디 또는 비밀번호가 일치하지 않습니다.' };

    const c = AppConfig.USER_COLS;
    // ✅ auth.uid() 즉 방금 로그인한 Auth User 의 id 로 프로필 조회
    const rows = await this._get(AppConfig.TABLES.USERS,
      `${c.AUTH_ID}=eq.${encodeURIComponent(authData.user.id)}&limit=1`);
    if (!rows.length) {
      await supabaseClient.auth.signOut(); // 프로필 없는 계정은 로그인 유지시키지 않음
      return { status:'error', message:'사용자 정보를 찾을 수 없습니다.' };
    }
    const row = rows[0];
    if (row[c.STATUS] !== 'ACTIVE') {
      await supabaseClient.auth.signOut();
      return { status:'error', message:'비활성화된 계정입니다. 관리자에게 문의해주세요.' };
    }

    const now = this._now();
    // ✅ user_id 대신 auth_id 기준으로 최근 로그인 시각 갱신
    this._patch(AppConfig.TABLES.USERS,
      `${c.AUTH_ID}=eq.${encodeURIComponent(authData.user.id)}`,
      { [c.LAST_LOGIN]: now }).catch(() => {});

    return {
      status: 'success', data: {
        authId:  authData.user.id, // ✅ userId → authId (UUID)
        loginId: row[c.LOGIN_ID],
        name:    row[c.NAME],
        role:    row[c.ROLE],
        status:  row[c.STATUS],
        lastLogin: now
      }
    };
  } catch(e) { return { status:'error', message:'로그인 오류: ' + e.message }; }
},

  getUsers: async function() {
    try {
      const c = AppConfig.USER_COLS;
      const rows = await this._get(AppConfig.TABLES.USERS, `select=*&order=${c.CREATED_AT}.asc`);
      return {
        status:'success', data: { users: rows.map(r => ({
          // ✅ userId(자체 발급 ID) → authId(auth.users.id, UUID) 로 교체
          authId: r[c.AUTH_ID], loginId: r[c.LOGIN_ID], name: r[c.NAME],
          role: r[c.ROLE], status: r[c.STATUS],
          createdAt: r[c.CREATED_AT], lastLogin: r[c.LAST_LOGIN]
        })) }
      };
    } catch(e) { return { status:'error', message:'사용자 목록 조회 오류: ' + e.message }; }
  },

  // ✅ Supabase 헤더 생성 로직과 별개로, Edge Function 호출 전용 헤더.
  //    service_role 키는 여기 어디에도 없고, 사용자 자신의 access_token 만 실어 보낸다.
  //    Edge Function 쪽(verifyAdmin.ts)에서 이 토큰으로 호출자가 ADMIN 인지 다시 검증한다.
  _functionHeaders: async function() {
    const { data } = await supabaseClient.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'apikey': AppConfig.SUPABASE_ANON,
      'Authorization': `Bearer ${data?.session?.access_token || ''}`
    };
  },

  // ✅ 사용자 생성: auth.admin.createUser() 는 service_role 권한이 필요해
  //    클라이언트에서 직접 호출할 수 없으므로 admin-create-user Edge Function 에 위임한다.
  //    Edge Function 내부에서 "① Auth 계정 생성 → ② users 저장"을 트랜잭션처럼 처리하고,
  //    ②가 실패하면 ①을 롤백하므로 여기서는 결과만 그대로 전달하면 된다.
  createUser: async function(d) {
    try {
      const res = await fetch(`${AppConfig.FUNCTIONS_URL}/admin-create-user`, {
        method: 'POST',
        headers: await this._functionHeaders(),
        body: JSON.stringify({
          email: d.loginId,          // ✅ login_id = 이메일
          password: d.password || AppConfig.DEFAULT_PASSWORD,
          name: d.name, role: d.role, status: d.status
        })
      });
      const result = await res.json();
      if (!res.ok || result.status !== 'success') {
        return { status:'error', message: result.message || '사용자 등록에 실패했습니다.' };
      }
      return result;
    } catch(e) { return { status:'error', message:'사용자 등록 오류: ' + e.message }; }
  },

  // ✅ userId(자체 발급 ID) 대신 authId(auth.users.id) 로 프로필을 수정.
  //    role/status 는 users 테이블에만 있는 정보이므로 RLS(admin 정책)를 통해 PostgREST 로 직접 수정.
  updateUser: async function(authId, fields) {
    try {
      const c = AppConfig.USER_COLS;
      const update = {};
      if (fields.role   !== undefined) update[c.ROLE]   = fields.role;
      if (fields.status !== undefined) update[c.STATUS] = fields.status;
      await this._patch(AppConfig.TABLES.USERS, `${c.AUTH_ID}=eq.${encodeURIComponent(authId)}`, update);
      return { status:'success', data: { message:'사용자 정보가 수정되었습니다.' } };
    } catch(e) { return { status:'error', message:'사용자 수정 오류: ' + e.message }; }
  },

  // ✅ 사용자 삭제도 Auth 계정을 지워야 하므로(그래야 로그인이 실제로 막힘) service_role 이 필요.
  //    admin-delete-user Edge Function 이 auth.admin.deleteUser() 를 호출하면
  //    users.auth_id 의 on delete cascade 로 프로필 행도 함께 삭제된다.
  deleteUser: async function(authId) {
    try {
      const res = await fetch(`${AppConfig.FUNCTIONS_URL}/admin-delete-user`, {
        method: 'POST',
        headers: await this._functionHeaders(),
        body: JSON.stringify({ authId })
      });
      const result = await res.json();
      if (!res.ok || result.status !== 'success') {
        return { status:'error', message: result.message || '사용자 삭제에 실패했습니다.' };
      }
      return result;
    } catch(e) { return { status:'error', message:'사용자 삭제 오류: ' + e.message }; }
  },

  // ✅ users.password 를 더 이상 사용하지 않으므로, 현재 비밀번호 확인은
  //    supabase.auth.signInWithPassword() 로 재인증하는 방식으로 대체하고,
  //    실제 변경은 supabase.auth.updateUser() 로 Auth 비밀번호 자체를 바꾼다.
  changePassword: async function(cur, nw) {
    try {
      if (nw.length < 6) return { status:'error', message:'비밀번호는 6자 이상이어야 합니다.' };
      if (cur === nw)    return { status:'error', message:'새 비밀번호는 현재 비밀번호와 달라야 합니다.' };

      const user = Auth.getUser();
      if (!user || !user.loginId) return { status:'error', message:'로그인 정보가 없습니다.' };

      // 현재 비밀번호 검증 (Supabase Auth 에는 별도 "현재 비밀번호 확인 API"가 없어 재로그인으로 검증)
      const { error: verifyErr } = await supabaseClient.auth.signInWithPassword({
        email: user.loginId, password: cur
      });
      if (verifyErr) return { status:'error', message:'현재 비밀번호가 일치하지 않습니다.' };

      // ✅ 실제 Supabase Auth 비밀번호 변경
      const { error: updateErr } = await supabaseClient.auth.updateUser({ password: nw });
      if (updateErr) return { status:'error', message: updateErr.message || '비밀번호 변경에 실패했습니다.' };

      return { status:'success', data: { message:'비밀번호가 변경되었습니다.' } };
    } catch(e) { return { status:'error', message:'비밀번호 변경 오류: ' + e.message }; }
  },

  // ✅ 관리자의 "비밀번호 초기화"도 실제 Auth 비밀번호를 바꿔야 하므로
  //    service_role 권한이 있는 admin-reset-password Edge Function 에 위임한다.
  resetPassword: async function(authId) {
    try {
      const res = await fetch(`${AppConfig.FUNCTIONS_URL}/admin-reset-password`, {
        method: 'POST',
        headers: await this._functionHeaders(),
        body: JSON.stringify({ authId })
      });
      const result = await res.json();
      if (!res.ok || result.status !== 'success') {
        return { status:'error', message: result.message || '비밀번호 초기화에 실패했습니다.' };
      }
      return { status:'success', data: { message: result.message } };
    } catch(e) { return { status:'error', message:'비밀번호 초기화 오류: ' + e.message }; }
  },

  // ============================================================
  // ── 고객 API ───────────────────────────────────────────────
  // ============================================================

  getClients: async function() {
    const cached = this._getCached('getClients', {});
    if (cached) return cached;
    try {
      const cc = AppConfig.CLIENT_COLS;
      const mc = AppConfig.MASTER_COLS;
      const [clientRows, masterRows] = await Promise.all([
        this._get(AppConfig.TABLES.CLIENTS,       `select=*&order=${cc.CLIENT_ID}.asc`),
        this._get(AppConfig.TABLES.ASSESS_MASTER, `select=${mc.CLIENT_ID},${mc.ROUND},${mc.REPORT_GENERATED}`)
      ]);
      const doneMap = {};
      masterRows.forEach(r => {
        if (!r[mc.REPORT_GENERATED]) return;
        const cid = r[mc.CLIENT_ID], rnd = Number(r[mc.ROUND] || 0);
        if (!doneMap[cid] || rnd > doneMap[cid]) doneMap[cid] = rnd;
      });
      const clients = clientRows.map(r => {
        const c = this._rowToClient(r);
        c.doneRounds = doneMap[c.clientId] || 0;
        return c;
      });
      const result = { status:'success', data: { clients } };
      this._setCache('getClients', {}, result);
      return result;
    } catch(e) { return { status:'error', message:'고객 목록 조회 오류: ' + e.message }; }
  },

  getClientDetail: async function(cid) {
    try {
      const cc = AppConfig.CLIENT_COLS;
      const mc = AppConfig.MASTER_COLS;
      const [rows, masterRows] = await Promise.all([
        this._get(AppConfig.TABLES.CLIENTS,       `${cc.CLIENT_ID}=eq.${encodeURIComponent(cid)}&limit=1`),
        this._get(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${encodeURIComponent(cid)}&select=${mc.ROUND},${mc.REPORT_GENERATED}`)
      ]);
      if (!rows.length) return { status:'error', message:'고객을 찾을 수 없습니다.' };
      const client = this._rowToClient(rows[0]);
      let maxDone = 0;
      masterRows.forEach(r => { if (r[mc.REPORT_GENERATED]) { const rnd = Number(r[mc.ROUND]||0); if (rnd > maxDone) maxDone = rnd; } });
      client.doneRounds = maxDone;
      return { status:'success', data: { client } };
    } catch(e) { return { status:'error', message:'고객 상세 조회 오류: ' + e.message }; }
  },

  createClient: async function(d) {
    try {
      const c = AppConfig.CLIENT_COLS;
      const T = AppConfig.TABLES.CLIENTS;
      const exists = await this._get(T, `${c.CLIENT_ID}=eq.${encodeURIComponent(d.clientId)}&limit=1`);
      if (exists.length) return { status:'error', message:'이미 사용 중인 고객 ID입니다.' };
      const endDate     = this._calcEndDate(d.admitDate, d.admitPeriod);
      const totalRounds = AppConfig.PERIOD_ROUNDS[d.admitPeriod] || 0;
      const status      = this._calcClientStatus(d.admitDate, endDate);
      await this._post(T, {
        [c.CLIENT_ID]:    d.clientId,    [c.NAME]:         d.name,
        [c.BIRTH_DATE]:   d.birthDate,   [c.GENDER]:       d.gender,
        [c.PHONE]:        d.phone,       [c.FIRST_VISIT]:  d.firstVisit,
        [c.ADMIT_DATE]:   d.admitDate,   [c.ADMIT_PERIOD]: d.admitPeriod,
        [c.END_DATE]:     endDate,       [c.TOTAL_ROUNDS]: totalRounds,
        [c.DONE_ROUNDS]:  0,             [c.STATUS]:       status,
        [c.ROOM_NUM]:     d.roomNum||'', [c.NOTE]:         d.note||''
      });
      this._bust('getClients','getClientDetail','getInitialData');
      return { status:'success', data: { clientId: d.clientId, name: d.name, status, endDate, totalRounds, doneRounds: 0 } };
    } catch(e) { return { status:'error', message:'고객 등록 오류: ' + e.message }; }
  },

  updateClient: async function(d) {
    try {
      const c = AppConfig.CLIENT_COLS;
      const T = AppConfig.TABLES.CLIENTS;
      const endDate     = this._calcEndDate(d.admitDate, d.admitPeriod);
      const totalRounds = AppConfig.PERIOD_ROUNDS[d.admitPeriod] || 0;
      const status      = this._calcClientStatus(d.admitDate, endDate);
      const rows = await this._get(T, `${c.CLIENT_ID}=eq.${encodeURIComponent(d.clientId)}&select=${c.DONE_ROUNDS}&limit=1`);
      const existDone = rows.length ? Number(rows[0][c.DONE_ROUNDS] || 0) : 0;
      const doneRounds = Math.min(existDone, totalRounds);
      const update = {
        [c.NAME]: d.name,           [c.BIRTH_DATE]:   d.birthDate,
        [c.GENDER]: d.gender,       [c.PHONE]:        d.phone,
        [c.FIRST_VISIT]: d.firstVisit, [c.ADMIT_DATE]: d.admitDate,
        [c.ADMIT_PERIOD]: d.admitPeriod, [c.END_DATE]:  endDate,
        [c.TOTAL_ROUNDS]: totalRounds,   [c.DONE_ROUNDS]: doneRounds,
        [c.STATUS]: status, [c.ROOM_NUM]: d.roomNum||'', [c.NOTE]: d.note||''
      };
      if (d.newClientId && d.newClientId !== d.clientId) {
        const dup = await this._get(T, `${c.CLIENT_ID}=eq.${encodeURIComponent(d.newClientId)}&limit=1`);
        if (dup.length) return { status:'error', message:'이미 사용 중인 고객 ID입니다.' };
        update[c.CLIENT_ID] = d.newClientId;
      }
      await this._patch(T, `${c.CLIENT_ID}=eq.${encodeURIComponent(d.clientId)}`, update);
      this._bust('getClients','getClientDetail','getInitialData');
      return { status:'success', data: { message:'고객 정보가 수정되었습니다.', status, endDate, totalRounds } };
    } catch(e) { return { status:'error', message:'고객 수정 오류: ' + e.message }; }
  },

  deleteClient: async function(cid) {
    try {
      const c = AppConfig.CLIENT_COLS;
      await this._delete(AppConfig.TABLES.CLIENTS, `${c.CLIENT_ID}=eq.${encodeURIComponent(cid)}`);
      this._bust('getClients','getClientDetail','getClientMasterList','getInitialData');
      return { status:'success', data: { message:'고객이 삭제되었습니다.' } };
    } catch(e) { return { status:'error', message:'고객 삭제 오류: ' + e.message }; }
  },

  updateClientStatus: async function() {
    try {
      const c = AppConfig.CLIENT_COLS;
      const rows = await this._get(AppConfig.TABLES.CLIENTS, `select=${c.CLIENT_ID},${c.ADMIT_DATE},${c.END_DATE}`);
      await Promise.all(rows.map(row =>
        this._patch(AppConfig.TABLES.CLIENTS,
          `${c.CLIENT_ID}=eq.${encodeURIComponent(row[c.CLIENT_ID])}`,
          { [c.STATUS]: this._calcClientStatus(this._safeDateStr(row[c.ADMIT_DATE]), this._safeDateStr(row[c.END_DATE])) })
      ));
      this._bust('getClients','getInitialData');
      return { status:'success', data: { message:`${rows.length}명 상태 업데이트 완료` } };
    } catch(e) { return { status:'error', message:'상태 업데이트 오류: ' + e.message }; }
  },

  // ============================================================
  // ── 평가 조회 API ──────────────────────────────────────────
  // ============================================================

  getInitialData: async function() {
    const cached = this._getCached('getInitialData', {});
    if (cached) return cached;
    try {
      const cc = AppConfig.CLIENT_COLS;
      const mc = AppConfig.MASTER_COLS;
      const [clientRows, masterRows] = await Promise.all([
        this._get(AppConfig.TABLES.CLIENTS,       `select=*&order=${cc.CLIENT_ID}.asc`),
        this._get(AppConfig.TABLES.ASSESS_MASTER, `select=*`)
      ]);
      const overview = {}, doneByClient = {};
      masterRows.forEach(row => {
        const cid   = this._safeStr(row[mc.CLIENT_ID]);
        const round = Number(row[mc.ROUND] || 0);
        if (!cid) return;
        if (!overview[cid]) overview[cid] = { rounds: {} };
        const reported = !!row[mc.REPORT_GENERATED];
        if (reported && (!doneByClient[cid] || round > doneByClient[cid])) doneByClient[cid] = round;
        overview[cid].rounds[round] = {
          round,
          doneCats: [!!row[mc.COGNITIVE_DONE],!!row[mc.MOVEMENT_DONE],!!row[mc.METABOLISM_DONE],!!row[mc.COMMENT_DONE]].filter(Boolean).length,
          reportGenerated: reported,
          cognitiveDone:   !!row[mc.COGNITIVE_DONE],
          movementDone:    !!row[mc.MOVEMENT_DONE],
          metabolismDone:  !!row[mc.METABOLISM_DONE],
          commentDone:     !!row[mc.COMMENT_DONE],
          createdAt:       this._safeStr(row[mc.CREATED_AT]),
          assessDate:      this._safeDateStr(row[mc.ASSESS_DATE]),
          reportCreatedAt: this._safeStr(row[mc.REPORT_CREATED_AT])
        };
      });
      const clients = clientRows.map(row => {
        const c = this._rowToClient(row);
        c.doneRounds = doneByClient[c.clientId] || 0;
        return c;
      });
      const result = { status:'success', data: { clients, overview } };
      this._setCache('getInitialData',    {}, result);
      this._setCache('getClients',        {}, { status:'success', data: { clients } });
      this._setCache('getAssessOverview', {}, { status:'success', data: { overview } });
      return result;
    } catch(e) { return { status:'error', message:'초기 데이터 조회 오류: ' + e.message }; }
  },

  getAssessOverview: async function() {
    const cached = this._getCached('getAssessOverview', {});
    if (cached) return cached;
    try {
      const mc = AppConfig.MASTER_COLS;
      const rows = await this._get(AppConfig.TABLES.ASSESS_MASTER, `select=*`);
      const overview = {};
      rows.forEach(row => {
        const cid = this._safeStr(row[mc.CLIENT_ID]), round = Number(row[mc.ROUND] || 0);
        if (!cid) return;
        if (!overview[cid]) overview[cid] = { rounds: {} };
        overview[cid].rounds[round] = {
          round,
          doneCats: [!!row[mc.COGNITIVE_DONE],!!row[mc.MOVEMENT_DONE],!!row[mc.METABOLISM_DONE],!!row[mc.COMMENT_DONE]].filter(Boolean).length,
          reportGenerated: !!row[mc.REPORT_GENERATED],
          cognitiveDone:   !!row[mc.COGNITIVE_DONE],
          movementDone:    !!row[mc.MOVEMENT_DONE],
          metabolismDone:  !!row[mc.METABOLISM_DONE],
          commentDone:     !!row[mc.COMMENT_DONE],
          createdAt:       this._safeStr(row[mc.CREATED_AT]),
          assessDate:      this._safeDateStr(row[mc.ASSESS_DATE]),
          reportCreatedAt: this._safeStr(row[mc.REPORT_CREATED_AT])
        };
      });
      const result = { status:'success', data: { overview } };
      this._setCache('getAssessOverview', {}, result);
      return result;
    } catch(e) { return { status:'error', message:'평가 현황 조회 오류: ' + e.message }; }
  },

  getClientMasterList: async function(cid) {
    try {
      const mc = AppConfig.MASTER_COLS;
      const cc = AppConfig.COG_COLS;
      const [masterRows, cogRows] = await Promise.all([
        this._get(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${encodeURIComponent(cid)}&select=*&order=${mc.ROUND}.asc`),
        this._get(AppConfig.TABLES.COGNITIVE,     `${cc.CLIENT_ID}=eq.${encodeURIComponent(cid)}&select=${cc.ROUND},${cc.SPATIAL},${cc.MEMORY}`)
      ]);
      const cogByRound = {};
      cogRows.forEach(r => { cogByRound[Number(r[cc.ROUND])] = r; });
      const masterList = masterRows.map(row => {
        const m = this._rowToMaster(row);
        const cogRow = cogByRound[m.round];
        if (cogRow) { m.spatial = this._safeNum(cogRow[cc.SPATIAL]); m.memory = this._safeNum(cogRow[cc.MEMORY]); }
        return m;
      });
      return { status:'success', data: { masterList } };
    } catch(e) { return { status:'error', message:'Master 목록 조회 오류: ' + e.message }; }
  },

  getRoundData: async function(cid, round) {
    try {
      const enc = encodeURIComponent;
      const mc = AppConfig.MASTER_COLS; const cc = AppConfig.COG_COLS;
      const ec = AppConfig.ERGO_COLS;   const xc = AppConfig.EVEREX_COLS;
      const fc = AppConfig.FRA_COLS;    const ic = AppConfig.INBODY_COLS;
      const sc = AppConfig.STRESS_COLS; const cmc = AppConfig.COMMENT_COLS;

      const [masterRows,cogRows,ergoRows,everexRows,fraRows,inbodyRows,stressRows,commentRows] = await Promise.all([
        this._get(AppConfig.TABLES.ASSESS_MASTER,       `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}&limit=1`),
        this._get(AppConfig.TABLES.COGNITIVE,           `${cc.CLIENT_ID}=eq.${enc(cid)}&${cc.ROUND}=eq.${round}&limit=1`),
        this._get(AppConfig.TABLES.MOVEMENT_ERGO,       `${ec.CLIENT_ID}=eq.${enc(cid)}&${ec.ROUND}=eq.${round}&limit=1`),
        this._get(AppConfig.TABLES.MOVEMENT_EVEREX,     `${xc.CLIENT_ID}=eq.${enc(cid)}&${xc.ROUND}=eq.${round}&limit=1`),
        this._get(AppConfig.TABLES.MOVEMENT_INBODY_FRA, `${fc.CLIENT_ID}=eq.${enc(cid)}&${fc.ROUND}=eq.${round}&limit=1`),
        this._get(AppConfig.TABLES.METABOLISM_INBODY,   `${ic.CLIENT_ID}=eq.${enc(cid)}&${ic.ROUND}=eq.${round}&limit=1`),
        this._get(AppConfig.TABLES.METABOLISM_STRESS,   `${sc.CLIENT_ID}=eq.${enc(cid)}&${sc.ROUND}=eq.${round}&limit=1`),
        this._get(AppConfig.TABLES.COMMENT,             `${cmc.CLIENT_ID}=eq.${enc(cid)}&${cmc.ROUND}=eq.${round}&limit=1`)
      ]);

      const masterData = masterRows.length ? this._rowToMaster(masterRows[0]) : null;
      if (masterData && cogRows.length) {
        masterData.spatial = this._safeNum(cogRows[0][cc.SPATIAL]);
        masterData.memory  = this._safeNum(cogRows[0][cc.MEMORY]);
      }
      return { status:'success', data: {
        master:    masterData,
        cognitive: cogRows.length    ? this._rowToCognitive(cogRows[0])    : null,
        ergo:      ergoRows.length   ? this._rowToErgo(ergoRows[0])        : null,
        everex:    everexRows.length ? this._rowToEverex(everexRows[0])    : null,
        fra:       fraRows.length    ? this._rowToFra(fraRows[0])          : null,
        inbody:    inbodyRows.length ? this._rowToInbody(inbodyRows[0])    : null,
        stress:    stressRows.length ? this._rowToStress(stressRows[0])    : null,
        comment:   commentRows.length? this._rowToComment(commentRows[0])  : null
      }};
    } catch(e) { return { status:'error', message:'회차 데이터 조회 오류: ' + e.message }; }
  },

  _refreshMasterFlags: async function(cid, round) {
    const enc = encodeURIComponent;
    const mc  = AppConfig.MASTER_COLS;
    const cc  = AppConfig.COG_COLS;  const ec  = AppConfig.ERGO_COLS;
    const xc  = AppConfig.EVEREX_COLS; const fc = AppConfig.FRA_COLS;
    const ic  = AppConfig.INBODY_COLS; const sc = AppConfig.STRESS_COLS;
    const cmc = AppConfig.COMMENT_COLS;

    const [cogR,ergoR,evxR,fraR,inbR,strR,cmtR] = await Promise.all([
      this._get(AppConfig.TABLES.COGNITIVE,           `${cc.CLIENT_ID}=eq.${enc(cid)}&${cc.ROUND}=eq.${round}&limit=1`),
      this._get(AppConfig.TABLES.MOVEMENT_ERGO,       `${ec.CLIENT_ID}=eq.${enc(cid)}&${ec.ROUND}=eq.${round}&limit=1`),
      this._get(AppConfig.TABLES.MOVEMENT_EVEREX,     `${xc.CLIENT_ID}=eq.${enc(cid)}&${xc.ROUND}=eq.${round}&limit=1`),
      this._get(AppConfig.TABLES.MOVEMENT_INBODY_FRA, `${fc.CLIENT_ID}=eq.${enc(cid)}&${fc.ROUND}=eq.${round}&limit=1`),
      this._get(AppConfig.TABLES.METABOLISM_INBODY,   `${ic.CLIENT_ID}=eq.${enc(cid)}&${ic.ROUND}=eq.${round}&limit=1`),
      this._get(AppConfig.TABLES.METABOLISM_STRESS,   `${sc.CLIENT_ID}=eq.${enc(cid)}&${sc.ROUND}=eq.${round}&limit=1`),
      this._get(AppConfig.TABLES.COMMENT,             `${cmc.CLIENT_ID}=eq.${enc(cid)}&${cmc.ROUND}=eq.${round}&limit=1`)
    ]);
    const cmRow = cmtR[0];
    const flags = {
      [mc.COGNITIVE_DONE]:  cogR.length > 0,
      [mc.MOVEMENT_DONE]:   ergoR.length > 0 && evxR.length > 0 && fraR.length > 0,
      [mc.METABOLISM_DONE]: inbR.length > 0 && strR.length > 0,
      [mc.COMMENT_DONE]:    cmRow ? !!(cmRow[cmc.COG_COMMENT] || cmRow[cmc.EX_COMMENT] || cmRow[cmc.CM_COMMENT]) : false
    };
    const existing = await this._get(AppConfig.TABLES.ASSESS_MASTER,
      `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}&limit=1`);
    if (existing.length) {
      await this._patch(AppConfig.TABLES.ASSESS_MASTER,
        `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`, flags);
    } else {
      await this._post(AppConfig.TABLES.ASSESS_MASTER, {
        [mc.REPORT_ID]:  this._generateId(),
        [mc.CLIENT_ID]:  String(cid), [mc.ROUND]: Number(round),
        [mc.CREATED_AT]: this._now(), ...flags
      });
    }
    return flags;
  },

  // ============================================================
  // ── 평가 저장 API ──────────────────────────────────────────
  // ============================================================

  saveCognitive: async function(cid, round, d) {
    try {
      const c = AppConfig.COG_COLS; const mc = AppConfig.MASTER_COLS;
      const enc = encodeURIComponent; const now = this._now();
      const n = v => (v !== null && v !== undefined && v !== '') ? Number(v) : null;
      const row = {
        [c.CLIENT_ID]: String(cid), [c.MEASURE_DATE]: String(d.measureDate||''),
        [c.ROUND]: Number(round),
        [c.COG_SCORE]: n(d.cogScore), [c.SPATIAL]: n(d.spatial), [c.MEMORY]: n(d.memory),
        [c.AGE_PERCENTILE]: n(d.agePercentile), [c.DEPRESSION]: n(d.depression),
        [c.DEMENTIA_RISK]: n(d.dementiaRisk), [c.CREATED_AT]: now
      };
      const existing = await this._get(AppConfig.TABLES.COGNITIVE, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}&limit=1`);
      if (existing.length) {
        await this._patch(AppConfig.TABLES.COGNITIVE, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}`, row);
      } else {
        await this._post(AppConfig.TABLES.COGNITIVE, { [c.ASSESS_ID]: this._generateId(), ...row });
      }
      const flags = await this._refreshMasterFlags(cid, round);
      await this._patch(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`, {
        [mc.COG_SCORE]: n(d.cogScore), [mc.AGE_PERCENTILE]: n(d.agePercentile),
        [mc.DEPRESSION]: n(d.depression), [mc.DEMENTIA_RISK]: n(d.dementiaRisk), ...flags
      });
      this._bust('getRoundData','getClientMasterList','getAssessOverview','getInitialData');
      return { status:'success', data: { message:'인지평가가 저장되었습니다.' } };
    } catch(e) { return { status:'error', message:'인지평가 저장 오류: ' + e.message }; }
  },

  saveErgo: async function(cid, round, d) {
    try {
      const c = AppConfig.ERGO_COLS; const mc = AppConfig.MASTER_COLS;
      const enc = encodeURIComponent; const now = this._now();
      const cardioIndex = this._calcCardioIndex(Number(d.cardioScore), d.gender, d.birthDate);
      const row = {
        [c.CLIENT_ID]: String(cid), [c.MEASURE_DATE]: String(d.measureDate||''),
        [c.ROUND]: Number(round), [c.CARDIO_SCORE]: Number(d.cardioScore),
        [c.CARDIO_INDEX]: cardioIndex, [c.CREATED_AT]: now
      };
      const existing = await this._get(AppConfig.TABLES.MOVEMENT_ERGO, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}&limit=1`);
      if (existing.length) {
        await this._patch(AppConfig.TABLES.MOVEMENT_ERGO, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}`, row);
      } else {
        await this._post(AppConfig.TABLES.MOVEMENT_ERGO, { [c.ASSESS_ID]: this._generateId(), ...row });
      }
      const flags = await this._refreshMasterFlags(cid, round);
      await this._patch(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`,
        { [mc.CARDIO_SCORE]: Number(d.cardioScore), [mc.CARDIO_INDEX]: cardioIndex, ...flags });
      this._bust('getRoundData','getClientMasterList','getAssessOverview','getInitialData');
      return { status:'success', data: { message:'에르고미터 평가가 저장되었습니다.' } };
    } catch(e) { return { status:'error', message:'에르고미터 저장 오류: ' + e.message }; }
  },

  saveEverex: async function(cid, round, d) {
    try {
      const c = AppConfig.EVEREX_COLS; const mc = AppConfig.MASTER_COLS;
      const enc = encodeURIComponent; const now = this._now();
      const row = {
        [c.CLIENT_ID]: String(cid), [c.MEASURE_DATE]: String(d.measureDate||''),
        [c.ROUND]: Number(round), [c.BODY_MOVEMENT_INDEX]: Number(d.bodyMovementIndex), [c.CREATED_AT]: now
      };
      const existing = await this._get(AppConfig.TABLES.MOVEMENT_EVEREX, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}&limit=1`);
      if (existing.length) {
        await this._patch(AppConfig.TABLES.MOVEMENT_EVEREX, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}`, row);
      } else {
        await this._post(AppConfig.TABLES.MOVEMENT_EVEREX, { [c.ASSESS_ID]: this._generateId(), ...row });
      }
      const flags = await this._refreshMasterFlags(cid, round);
      await this._patch(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`,
        { [mc.BODY_MOVEMENT_INDEX]: Number(d.bodyMovementIndex), ...flags });
      this._bust('getRoundData','getClientMasterList','getAssessOverview','getInitialData');
      return { status:'success', data: { message:'에버엑스 평가가 저장되었습니다.' } };
    } catch(e) { return { status:'error', message:'에버엑스 저장 오류: ' + e.message }; }
  },

  saveFra: async function(cid, round, d) {
    try {
      const c = AppConfig.FRA_COLS; const mc = AppConfig.MASTER_COLS;
      const enc = encodeURIComponent; const now = this._now();
      const n = v => (v !== null && v !== undefined && v !== '') ? Number(v) : null;
      const row = {
        [c.CLIENT_ID]: String(cid), [c.MEASURE_DATE]: String(d.measureDate||''),
        [c.ROUND]: Number(round), [c.NERVOUS_SCORE]: n(d.nervousScore),
        [c.BALANCE_SCORE]: n(d.balanceScore), [c.SENSORY_SCORE]: n(d.sensoryScore), [c.CREATED_AT]: now
      };
      const existing = await this._get(AppConfig.TABLES.MOVEMENT_INBODY_FRA, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}&limit=1`);
      if (existing.length) {
        await this._patch(AppConfig.TABLES.MOVEMENT_INBODY_FRA, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}`, row);
      } else {
        await this._post(AppConfig.TABLES.MOVEMENT_INBODY_FRA, { [c.ASSESS_ID]: this._generateId(), ...row });
      }
      const flags = await this._refreshMasterFlags(cid, round);
      await this._patch(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`,
        { [mc.NERVOUS_SCORE]: n(d.nervousScore), [mc.BALANCE_SCORE]: n(d.balanceScore), [mc.SENSORY_SCORE]: n(d.sensoryScore), ...flags });
      this._bust('getRoundData','getClientMasterList','getAssessOverview','getInitialData');
      return { status:'success', data: { message:'인바디FRA 평가가 저장되었습니다.' } };
    } catch(e) { return { status:'error', message:'인바디FRA 저장 오류: ' + e.message }; }
  },

  saveInbody: async function(cid, round, d) {
    try {
      const c = AppConfig.INBODY_COLS; const mc = AppConfig.MASTER_COLS;
      const enc = encodeURIComponent; const now = this._now();
      const row = {
        [c.CLIENT_ID]: String(cid), [c.MEASURE_DATE]: String(d.measureDate||''),
        [c.ROUND]: Number(round), [c.BODY_COMP_SCORE]: Number(d.bodyCompScore), [c.CREATED_AT]: now
      };
      const existing = await this._get(AppConfig.TABLES.METABOLISM_INBODY, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}&limit=1`);
      if (existing.length) {
        await this._patch(AppConfig.TABLES.METABOLISM_INBODY, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}`, row);
      } else {
        await this._post(AppConfig.TABLES.METABOLISM_INBODY, { [c.ASSESS_ID]: this._generateId(), ...row });
      }
      const flags = await this._refreshMasterFlags(cid, round);
      await this._patch(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`,
        { [mc.BODY_COMP_SCORE]: Number(d.bodyCompScore), ...flags });
      this._bust('getRoundData','getClientMasterList','getAssessOverview','getInitialData');
      return { status:'success', data: { message:'인바디(체성분) 평가가 저장되었습니다.' } };
    } catch(e) { return { status:'error', message:'인바디 저장 오류: ' + e.message }; }
  },

  saveStress: async function(cid, round, d) {
    try {
      const c = AppConfig.STRESS_COLS; const mc = AppConfig.MASTER_COLS;
      const enc = encodeURIComponent; const now = this._now();
      const row = {
        [c.CLIENT_ID]: String(cid), [c.MEASURE_DATE]: String(d.measureDate||''),
        [c.ROUND]: Number(round), [c.STRESS_SCORE]: Number(d.stressScore), [c.CREATED_AT]: now
      };
      const existing = await this._get(AppConfig.TABLES.METABOLISM_STRESS, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}&limit=1`);
      if (existing.length) {
        await this._patch(AppConfig.TABLES.METABOLISM_STRESS, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}`, row);
      } else {
        await this._post(AppConfig.TABLES.METABOLISM_STRESS, { [c.ASSESS_ID]: this._generateId(), ...row });
      }
      const flags = await this._refreshMasterFlags(cid, round);
      await this._patch(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`,
        { [mc.STRESS_SCORE]: Number(d.stressScore), ...flags });
      this._bust('getRoundData','getClientMasterList','getAssessOverview','getInitialData');
      return { status:'success', data: { message:'스트레스 평가가 저장되었습니다.' } };
    } catch(e) { return { status:'error', message:'스트레스 저장 오류: ' + e.message }; }
  },

  saveComment: async function(cid, round, d) {
    try {
      const c = AppConfig.COMMENT_COLS; const mc = AppConfig.MASTER_COLS;
      const enc = encodeURIComponent; const now = this._now();
      const role = Auth.getUser()?.role;
      const canCog = ['ADMIN','CARE_MANAGER','COGNITIVE_SPECIALIST'].includes(role);
      const canEx  = ['ADMIN','CARE_MANAGER','EXERCISE_SPECIALIST'].includes(role);
      const canCm  = ['ADMIN','CARE_MANAGER'].includes(role);
      const existing = await this._get(AppConfig.TABLES.COMMENT, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}&limit=1`);
      const update = { [c.UPDATED_AT]: now };
      if (canCog && d.cogComment !== undefined) { update[c.COG_COMMENT] = String(d.cogComment||''); update[c.COG_UPDATED] = now; }
      if (canEx  && d.exComment  !== undefined) { update[c.EX_COMMENT]  = String(d.exComment ||''); update[c.EX_UPDATED]  = now; }
      if (canCm  && d.cmComment  !== undefined) { update[c.CM_COMMENT]  = String(d.cmComment ||''); update[c.CM_UPDATED]  = now; }
      if (existing.length) {
        await this._patch(AppConfig.TABLES.COMMENT, `${c.CLIENT_ID}=eq.${enc(cid)}&${c.ROUND}=eq.${round}`, update);
      } else {
        await this._post(AppConfig.TABLES.COMMENT, {
          [c.COMMENT_ID]:  this._generateId(), [c.CLIENT_ID]: String(cid), [c.ROUND]: Number(round),
          [c.COG_COMMENT]: canCog ? String(d.cogComment||'') : '', [c.COG_UPDATED]: now,
          [c.EX_COMMENT]:  canEx  ? String(d.exComment ||'') : '', [c.EX_UPDATED]:  now,
          [c.CM_COMMENT]:  canCm  ? String(d.cmComment ||'') : '', [c.CM_UPDATED]:  now,
          [c.UPDATED_AT]:  now
        });
      }
      const masterPatch = {};
      if (canCog && d.cogComment !== undefined) masterPatch[mc.COG_COMMENT] = String(d.cogComment||'');
      if (canEx  && d.exComment  !== undefined) masterPatch[mc.EX_COMMENT]  = String(d.exComment ||'');
      if (canCm  && d.cmComment  !== undefined) masterPatch[mc.CM_COMMENT]  = String(d.cmComment ||'');
      const flags = await this._refreshMasterFlags(cid, round);
      await this._patch(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`,
        { ...masterPatch, ...flags });
      this._bust('getRoundData','getClientMasterList','getAssessOverview','getInitialData');
      return { status:'success', data: { message:'코멘트가 저장되었습니다.' } };
    } catch(e) { return { status:'error', message:'코멘트 저장 오류: ' + e.message }; }
  },

  deleteSheetRow: async function(cid, round, type) {
    try {
      const enc = encodeURIComponent;
      const mc = AppConfig.MASTER_COLS;
      const tableMap = {
        cognitive: [AppConfig.TABLES.COGNITIVE,           AppConfig.COG_COLS],
        ergo:      [AppConfig.TABLES.MOVEMENT_ERGO,       AppConfig.ERGO_COLS],
        everex:    [AppConfig.TABLES.MOVEMENT_EVEREX,     AppConfig.EVEREX_COLS],
        fra:       [AppConfig.TABLES.MOVEMENT_INBODY_FRA, AppConfig.FRA_COLS],
        inbody:    [AppConfig.TABLES.METABOLISM_INBODY,   AppConfig.INBODY_COLS],
        stress:    [AppConfig.TABLES.METABOLISM_STRESS,   AppConfig.STRESS_COLS],
        comment:   [AppConfig.TABLES.COMMENT,             AppConfig.COMMENT_COLS]
      };
      const [table, cols] = tableMap[type] || [];
      if (!table) return { status:'error', message:'잘못된 타입입니다.' };
      await this._delete(table, `${cols.CLIENT_ID}=eq.${enc(cid)}&${cols.ROUND}=eq.${round}`);
      const flags = await this._refreshMasterFlags(cid, round);
      await this._patch(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`, flags);
      this._bust('getRoundData','getClientMasterList','getClients','getAssessOverview','getInitialData');
      return { status:'success', data: { message:'데이터가 삭제되었습니다.' } };
    } catch(e) { return { status:'error', message:'삭제 오류: ' + e.message }; }
  },

  generateReport: async function(cid, round, force) {
    try {
      const mc = AppConfig.MASTER_COLS; const enc = encodeURIComponent;
      const masterRows = await this._get(AppConfig.TABLES.ASSESS_MASTER,
        `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}&limit=1`);
      if (!masterRows.length) return { status:'error', message:'평가 데이터가 없습니다.' };
      const m = this._rowToMaster(masterRows[0]);
      if (m.reportGenerated && !force)
        return { status:'success', data: { alreadyExists: true, message:'이미 생성된 통합 리포트가 있습니다.' } };
      if (!m.cognitiveDone || !m.movementDone || !m.metabolismDone)
        return { status:'error', message:'인지평가, 움직임평가, 대사평가를 완료한 후 통합 리포트를 생성할 수 있습니다.' };

      const cc=AppConfig.COG_COLS; const ec=AppConfig.ERGO_COLS; const xc=AppConfig.EVEREX_COLS;
      const fc=AppConfig.FRA_COLS; const ic=AppConfig.INBODY_COLS; const sc=AppConfig.STRESS_COLS;
      const [cR,eR,xR,fR,iR,sR] = await Promise.all([
        this._get(AppConfig.TABLES.COGNITIVE,           `${cc.CLIENT_ID}=eq.${enc(cid)}&${cc.ROUND}=eq.${round}&select=${cc.MEASURE_DATE}&limit=1`),
        this._get(AppConfig.TABLES.MOVEMENT_ERGO,       `${ec.CLIENT_ID}=eq.${enc(cid)}&${ec.ROUND}=eq.${round}&select=${ec.MEASURE_DATE}&limit=1`),
        this._get(AppConfig.TABLES.MOVEMENT_EVEREX,     `${xc.CLIENT_ID}=eq.${enc(cid)}&${xc.ROUND}=eq.${round}&select=${xc.MEASURE_DATE}&limit=1`),
        this._get(AppConfig.TABLES.MOVEMENT_INBODY_FRA, `${fc.CLIENT_ID}=eq.${enc(cid)}&${fc.ROUND}=eq.${round}&select=${fc.MEASURE_DATE}&limit=1`),
        this._get(AppConfig.TABLES.METABOLISM_INBODY,   `${ic.CLIENT_ID}=eq.${enc(cid)}&${ic.ROUND}=eq.${round}&select=${ic.MEASURE_DATE}&limit=1`),
        this._get(AppConfig.TABLES.METABOLISM_STRESS,   `${sc.CLIENT_ID}=eq.${enc(cid)}&${sc.ROUND}=eq.${round}&select=${sc.MEASURE_DATE}&limit=1`)
      ]);
      const allDates = [cR[0]?.[cc.MEASURE_DATE],eR[0]?.[ec.MEASURE_DATE],xR[0]?.[xc.MEASURE_DATE],
        fR[0]?.[fc.MEASURE_DATE],iR[0]?.[ic.MEASURE_DATE],sR[0]?.[sc.MEASURE_DATE]]
        .filter(Boolean).map(d => this._safeDateStr(d));
      const assessDate      = allDates.length ? allDates.sort().reverse()[0] : '';
      const reportCreatedAt = this._now();

      await this._patch(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`,
        { [mc.REPORT_GENERATED]: true, [mc.ASSESS_DATE]: assessDate, [mc.REPORT_CREATED_AT]: reportCreatedAt });

      const cc2 = AppConfig.CLIENT_COLS;
      const clientRows = await this._get(AppConfig.TABLES.CLIENTS,
        `${cc2.CLIENT_ID}=eq.${enc(cid)}&select=${cc2.DONE_ROUNDS},${cc2.TOTAL_ROUNDS}&limit=1`);
      if (clientRows.length) {
        const cur = Number(clientRows[0][cc2.DONE_ROUNDS] || 0);
        const tot = Number(clientRows[0][cc2.TOTAL_ROUNDS] || 0);
        await this._patch(AppConfig.TABLES.CLIENTS, `${cc2.CLIENT_ID}=eq.${enc(cid)}`,
          { [cc2.DONE_ROUNDS]: Math.min(cur + 1, tot) });
      }
      this._bust('getClientMasterList','getClients','getClientDetail','getInitialData');
      const updated = await this._get(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}&limit=1`);
      const masterData = updated.length ? this._rowToMaster(updated[0]) : null;
      return { status:'success', data: { message:`${round}회차 통합 리포트가 생성되었습니다.`, reportGenerated: true, masterData } };
    } catch(e) { return { status:'error', message:'리포트 생성 오류: ' + e.message }; }
  },

  invalidateReport: async function(cid, round) {
    try {
      const mc = AppConfig.MASTER_COLS; const cc = AppConfig.CLIENT_COLS;
      const enc = encodeURIComponent;
      await this._patch(AppConfig.TABLES.ASSESS_MASTER, `${mc.CLIENT_ID}=eq.${enc(cid)}&${mc.ROUND}=eq.${round}`,
        { [mc.REPORT_GENERATED]: false });
      const clientRows = await this._get(AppConfig.TABLES.CLIENTS, `${cc.CLIENT_ID}=eq.${enc(cid)}&select=${cc.DONE_ROUNDS}&limit=1`);
      if (clientRows.length) {
        const cur = Number(clientRows[0][cc.DONE_ROUNDS] || 0);
        await this._patch(AppConfig.TABLES.CLIENTS, `${cc.CLIENT_ID}=eq.${enc(cid)}`,
          { [cc.DONE_ROUNDS]: Math.max(cur - 1, 0) });
      }
      this._bust('getClientMasterList','getClients','getInitialData');
      return { status:'success', data: { message:'리포트가 무효화되었습니다.' } };
    } catch(e) { return { status:'error', message:'리포트 무효화 오류: ' + e.message }; }
  },

  // ============================================================
  // ── 기준값 API ─────────────────────────────────────────────
  // ============================================================

  getStandards: async function() {
    const cached = this._getCached('getStandards', {});
    if (cached) return cached;
    try {
      const sc = AppConfig.STANDARDS_COLS;
      const rows = await this._get(AppConfig.TABLES.STANDARDS, `select=*&order=${sc.CATEGORY}.asc,${sc.ORDER}.asc`);
      if (!rows.length) {
        return { status:'success', data: { standards: {
          inbodyFra: {
            sensory:  [{key:'sensory_1',label:'감각계 평가',order:1},{key:'sensory_2',label:'체성감각 평가',order:2},{key:'sensory_3',label:'시각 평가',order:3},{key:'sensory_4',label:'전정감각 평가',order:4}],
            balance:  [{key:'balance_1',label:'통합 균형 능력 평가',order:1},{key:'balance_2',label:'빠르게 무게중심 옮기기 평가',order:2},{key:'balance_3',label:'과녁 따라 무게중심 옮기기 평가',order:3}],
            nervous:  [{key:'nervous_1',label:'신경계 평가',order:1},{key:'nervous_2',label:'반응시간 평가',order:2},{key:'nervous_3',label:'자세유지시간 평가',order:3}]
          }
        }, isDefault: true }};
      }
      const standards = {};
      rows.forEach(r => {
        const cat = r[sc.CATEGORY]; if (!cat) return;
        if (!standards[cat]) standards[cat] = [];
        standards[cat].push({ key: r[sc.KEY], label: r[sc.LABEL], order: Number(r[sc.ORDER]||0) });
      });
      const result = { status:'success', data: { standards } };
      this._setCache('getStandards', {}, result);
      return result;
    } catch(e) { return { status:'error', message:'기준값 조회 오류: ' + e.message }; }
  },

  saveStandards: async function(cat, items) {
    try {
      const sc = AppConfig.STANDARDS_COLS; const now = this._now();
      await this._delete(AppConfig.TABLES.STANDARDS, `${sc.CATEGORY}=eq.${encodeURIComponent(cat)}`);
      if (items.length) {
        await Promise.all(items.map((item, idx) =>
          this._post(AppConfig.TABLES.STANDARDS, {
            [sc.CATEGORY]: cat, [sc.KEY]: String(item.key||`${cat}_${idx+1}`),
            [sc.LABEL]: String(item.label||''), [sc.ORDER]: idx+1, [sc.UPDATED_AT]: now
          })
        ));
      }
      this._bust('getStandards');
      return { status:'success', data: { message:'기준값이 저장되었습니다.' } };
    } catch(e) { return { status:'error', message:'기준값 저장 오류: ' + e.message }; }
  }
};
