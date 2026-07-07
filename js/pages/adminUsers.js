// ============================================================
// pages/adminUsers.js - 관리자 > 사용자 관리 페이지
// ============================================================

const AdminUsersPage = {
  users: [],

  render: function() {
    if (!Auth.isAdmin()) {
      document.getElementById('page-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔒</div>
          <div class="empty-state-text">접근 권한이 없습니다.</div>
          <div class="empty-state-sub">전체 관리자만 접근 가능한 페이지입니다.</div>
        </div>`;
      return;
    }

    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">사용자 관리</h1>
        <p class="page-subtitle">담당자를 등록하고 권한과 상태를 관리합니다.</p>
      </div>

      <!-- 담당자 등록 카드 -->
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header">
          <h2 class="card-title">
            <span class="card-title-dot"></span>
            담당자 등록
          </h2>
          <button class="btn btn-secondary btn-sm" id="toggle-register-btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            신규 등록
          </button>
        </div>
        <div class="card-body" id="register-form-wrap" style="display:none;">
          <div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));">
            <div class="form-group">
              <!-- ✅ login_id = Supabase Auth 의 email 이므로 이메일 형식으로 입력받음 -->
              <label class="form-label">이메일(로그인 ID) <span class="required">*</span></label>
              <input type="email" id="reg-login-id" class="form-control" placeholder="example@domain.com">
            </div>
            <div class="form-group">
              <!-- ✅ 비워두면 기본 초기 비밀번호(AppConfig.DEFAULT_PASSWORD)로 Auth 계정이 생성됨 -->
              <label class="form-label">초기 비밀번호</label>
              <input type="password" id="reg-password" class="form-control" placeholder="비워두면 기본 비밀번호 사용">
            </div>
            <div class="form-group">
              <label class="form-label">이름 <span class="required">*</span></label>
              <input type="text" id="reg-name" class="form-control" placeholder="실명 입력">
            </div>
            <div class="form-group">
              <label class="form-label">권한 <span class="required">*</span></label>
              <select id="reg-role" class="form-control">
                <option value="">선택</option>
                <option value="ADMIN">전체 관리자</option>
                <option value="CARE_MANAGER">케어 매니저</option>
                <option value="COGNITIVE_SPECIALIST">인지 전문가</option>
                <option value="EXERCISE_SPECIALIST">운동 전문가</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">상태 <span class="required">*</span></label>
              <select id="reg-status" class="form-control">
                <option value="ACTIVE">사용</option>
                <option value="INACTIVE">미사용</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
            <button class="btn btn-secondary" id="reg-cancel-btn">취소</button>
            <button class="btn btn-primary" id="reg-submit-btn">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              등록
            </button>
          </div>
        </div>
      </div>

      <!-- 사용자 목록 카드 -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            <span class="card-title-dot"></span>
            사용자 목록
            <span id="user-count" style="font-size:12px;font-weight:400;color:#888;margin-left:4px;"></span>
          </h2>
          <button class="btn btn-outline btn-sm" id="refresh-btn">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            새로고침
          </button>
        </div>
        <div class="card-body" style="padding:0;">
          <div id="users-table-wrap" class="table-wrap">
            <div class="empty-state" id="users-loading">
              <div class="spinner" style="margin:0 auto;"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
    this.loadUsers();
  },

  _bindEvents: function() {
    // 등록 폼 토글
    document.getElementById('toggle-register-btn').addEventListener('click', () => {
      const wrap = document.getElementById('register-form-wrap');
      const isHidden = wrap.style.display === 'none';
      wrap.style.display = isHidden ? 'block' : 'none';
    });

    document.getElementById('reg-cancel-btn').addEventListener('click', () => {
      document.getElementById('register-form-wrap').style.display = 'none';
      this._clearRegisterForm();
    });

    document.getElementById('reg-submit-btn').addEventListener('click', () => this.handleCreate());
    document.getElementById('refresh-btn').addEventListener('click', () => this.loadUsers());
  },

  _clearRegisterForm: function() {
    ['reg-login-id','reg-password','reg-name','reg-role','reg-status'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.tagName === 'SELECT' ? el.selectedIndex = 0 : el.value = ''; }
    });
    document.getElementById('reg-status').value = 'ACTIVE';
  },

  loadUsers: async function() {
    const wrap = document.getElementById('users-table-wrap');
    if (!wrap) return;

    wrap.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto;"></div></div>';

    try {
      const result = await API.getUsers();
      if (result.status === 'success') {
        this.users = result.data.users || [];
        this.renderTable();
      } else {
        wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${result.message}</div></div>`;
      }
    } catch (err) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔌</div><div class="empty-state-text">서버 연결 오류</div><div class="empty-state-sub">잠시 후 다시 시도해주세요.</div></div>`;
    }
  },

  renderTable: function() {
    const wrap = document.getElementById('users-table-wrap');
    const countEl = document.getElementById('user-count');
    if (!wrap) return;

    if (countEl) countEl.textContent = `(총 ${this.users.length}명)`;

    if (this.users.length === 0) {
      wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">등록된 사용자가 없습니다.</div></div>';
      return;
    }

    const rows = this.users.map(u => `
      <tr>
        <td style="font-family:monospace;font-size:11px;color:#aaa;" title="${u.authId}">${(u.authId||'').slice(0,8)}…</td>
        <td style="font-weight:600;">${u.loginId}</td>
        <td>${u.name}</td>
        <td>${UI.roleBadge(u.role)}</td>
        <td>${UI.statusBadge(u.status)}</td>
        <td style="font-size:12px;color:#aaa;">${UI.formatDate(u.createdAt)}</td>
        <td style="font-size:12px;color:#aaa;">${UI.formatDate(u.lastLogin)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-warning btn-sm" data-action="reset-pw" data-uid="${u.authId}" data-name="${u.name}" title="비밀번호 초기화">
              🔑 초기화
            </button>
            <button class="btn btn-secondary btn-sm" data-action="edit" data-uid="${u.authId}" data-role="${u.role}" data-status="${u.status}" data-name="${u.name}" title="수정">
              ✏️ 수정
            </button>
            <button class="btn btn-danger btn-sm" data-action="delete" data-uid="${u.authId}" data-name="${u.name}" title="삭제">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <!-- ✅ 자체 발급 User ID 컬럼 삭제, Auth UUID(auth_id) 를 표시 -->
            <th>Auth ID</th>
            <th>이메일(로그인 ID)</th>
            <th>이름</th>
            <th>권한</th>
            <th>상태</th>
            <th>생성일자</th>
            <th>최근 로그인</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    // 이벤트 위임
    wrap.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { action, uid, name, role, status } = btn.dataset;
        if (action === 'reset-pw') this.handleResetPassword(uid, name);
        if (action === 'edit')     this.handleEdit(uid, role, status, name);
        if (action === 'delete')   this.handleDelete(uid, name);
      });
    });
  },

  handleCreate: async function() {
    const loginId = document.getElementById('reg-login-id').value.trim();
    const password = document.getElementById('reg-password').value; // ✅ 비워두면 기본 비밀번호 사용 (createUser 에서 처리)
    const name = document.getElementById('reg-name').value.trim();
    const role = document.getElementById('reg-role').value;
    const status = document.getElementById('reg-status').value;

    // ✅ 비밀번호는 더 이상 필수 입력이 아님(선택 입력, 미입력 시 기본 비밀번호로 Auth 계정 생성)
    if (!loginId || !name || !role || !status) {
      UI.toast('모든 항목을 입력해주세요.', 'error');
      return;
    }

    // ✅ login_id = Supabase Auth 의 email 이므로 이메일 형식 검증
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId)) {
      UI.toast('이메일 형식으로 입력해주세요.', 'error');
      return;
    }

    if (password && password.length < 6) {
      UI.toast('비밀번호는 6자 이상이어야 합니다.', 'error');
      return;
    }

    const btn = document.getElementById('reg-submit-btn');
    btn.disabled = true;

    try {
      UI.showLoading();
      const result = await API.createUser({ loginId, password, name, role, status });

      if (result.status === 'success') {
        UI.toast(`${name} 님이 등록되었습니다.`, 'success');
        this._clearRegisterForm();
        document.getElementById('register-form-wrap').style.display = 'none';
        await this.loadUsers();
      } else {
        UI.toast(result.message || '등록에 실패했습니다.', 'error');
      }
    } catch (err) {
      UI.toast('서버 오류가 발생했습니다.', 'error');
    } finally {
      UI.hideLoading();
      btn.disabled = false;
    }
  },

  handleResetPassword: async function(authId, name) {
    const ok = await UI.confirm({
      title: `${name} 님의 비밀번호를 초기화하시겠습니까?`,
      message: `초기 비밀번호(carehub1234!)로 재설정됩니다. (Supabase Auth 비밀번호가 직접 초기화됩니다)`,
      confirmText: '초기화',
      cancelText: '취소',
      type: 'warning'
    });

    if (!ok) return;

    try {
      UI.showLoading();
      // ✅ authId(auth.users.id) 로 admin-reset-password Edge Function 호출
      const result = await API.resetPassword(authId);
      if (result.status === 'success') {
        UI.toast(result.data.message || '비밀번호가 초기화되었습니다.', 'success');
      } else {
        UI.toast(result.message || '초기화에 실패했습니다.', 'error');
      }
    } catch (err) {
      UI.toast('서버 오류가 발생했습니다.', 'error');
    } finally {
      UI.hideLoading();
    }
  },

  handleEdit: function(authId, currentRole, currentStatus, name) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">사용자 정보 수정 — ${name}</h3>
          <button class="modal-close" id="edit-modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div class="form-group">
              <label class="form-label">권한</label>
              <select id="edit-role" class="form-control">
                <option value="ADMIN" ${currentRole==='ADMIN'?'selected':''}>전체 관리자</option>
                <option value="CARE_MANAGER" ${currentRole==='CARE_MANAGER'?'selected':''}>케어 매니저</option>
                <option value="COGNITIVE_SPECIALIST" ${currentRole==='COGNITIVE_SPECIALIST'?'selected':''}>인지 전문가</option>
                <option value="EXERCISE_SPECIALIST" ${currentRole==='EXERCISE_SPECIALIST'?'selected':''}>운동 전문가</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">상태</label>
              <select id="edit-status" class="form-control">
                <option value="ACTIVE" ${currentStatus==='ACTIVE'?'selected':''}>사용</option>
                <option value="INACTIVE" ${currentStatus==='INACTIVE'?'selected':''}>미사용</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="edit-cancel-btn">취소</button>
          <button class="btn btn-primary" id="edit-save-btn">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();

    backdrop.querySelector('#edit-modal-close').onclick = close;
    backdrop.querySelector('#edit-cancel-btn').onclick = close;
    backdrop.onclick = e => { if (e.target === backdrop) close(); };

    backdrop.querySelector('#edit-save-btn').onclick = async () => {
      const role = document.getElementById('edit-role').value;
      const status = document.getElementById('edit-status').value;
      const saveBtn = backdrop.querySelector('#edit-save-btn');
      saveBtn.disabled = true;

      try {
        UI.showLoading();
        // ✅ authId(auth.users.id) 기준으로 users 프로필(role/status) 수정
        const result = await API.updateUser(authId, { role, status });

        if (result.status === 'success') {
          UI.toast('정보가 수정되었습니다.', 'success');
          close();
          await this.loadUsers();
        } else {
          UI.toast(result.message || '수정에 실패했습니다.', 'error');
        }
      } catch (err) {
        UI.toast('서버 오류가 발생했습니다.', 'error');
      } finally {
        UI.hideLoading();
        saveBtn.disabled = false;
      }
    };
  },

  handleDelete: async function(authId, name) {
    const ok = await UI.confirm({
      title: '정말 삭제하시겠습니까?',
      message: `${name} 님의 Supabase Auth 계정과 프로필이 영구적으로 삭제됩니다.`,
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger'
    });

    if (!ok) return;

    try {
      UI.showLoading();
      // ✅ authId(auth.users.id) 로 admin-delete-user Edge Function 호출 (Auth 계정 삭제 → users 행 cascade 삭제)
      const result = await API.deleteUser(authId);

      if (result.status === 'success') {
        UI.toast(`${name} 님이 삭제되었습니다.`, 'success');
        await this.loadUsers();
      } else {
        UI.toast(result.message || '삭제에 실패했습니다.', 'error');
      }
    } catch (err) {
      UI.toast('서버 오류가 발생했습니다.', 'error');
    } finally {
      UI.hideLoading();
    }
  }
};
