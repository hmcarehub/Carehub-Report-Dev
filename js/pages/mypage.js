// ============================================================
// pages/mypage.js - 마이페이지
// ============================================================

const MypagePage = {
  render: function() {
    const user = Auth.getUser();
    const container = document.getElementById('page-content');

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">마이페이지</h1>
        <p class="page-subtitle">내 계정 정보를 확인하고 비밀번호를 변경할 수 있습니다.</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">

        <!-- 내 정보 카드 -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-title-dot"></span>
              내 정보
            </h2>
          </div>
          <div class="card-body">
            <div style="text-align:center;padding:8px 0 20px;">
              <div style="
                width:72px;height:72px;border-radius:50%;
                background:linear-gradient(135deg,#D4AF72,#B8934A);
                display:flex;align-items:center;justify-content:center;
                margin:0 auto 12px;color:white;font-size:28px;font-weight:700;
              ">${UI.initials(user.name)}</div>
              <div style="font-size:18px;font-weight:700;color:#2C2C2C;">${user.name}</div>
              <div style="margin-top:6px;">${UI.roleBadge(user.role)}</div>
            </div>
            <hr class="divider">
            <div class="info-list">
              <div class="info-row">
                <span class="info-key">아이디</span>
                <span class="info-value">${user.loginId}</span>
              </div>
              <div class="info-row">
                <span class="info-key">권한</span>
                <span class="info-value">${UI.roleLabel(user.role)}</span>
              </div>
              <div class="info-row">
                <span class="info-key">상태</span>
                <span class="info-value">${UI.statusBadge(user.status)}</span>
              </div>
              <div class="info-row">
                <span class="info-key">최근 로그인</span>
                <span class="info-value" style="font-size:12.5px;color:#888;">${UI.formatDate(user.lastLogin)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 비밀번호 변경 카드 -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-title-dot"></span>
              비밀번호 변경
            </h2>
          </div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:16px;">
              <div class="form-group">
                <label class="form-label">현재 비밀번호 <span class="required">*</span></label>
                <input type="password" id="pw-current" class="form-control" placeholder="현재 비밀번호 입력">
              </div>
              <div class="form-group">
                <label class="form-label">새 비밀번호 <span class="required">*</span></label>
                <input type="password" id="pw-new" class="form-control" placeholder="6자 이상 입력">
              </div>
              <div class="form-group">
                <label class="form-label">새 비밀번호 확인 <span class="required">*</span></label>
                <input type="password" id="pw-confirm" class="form-control" placeholder="새 비밀번호 재입력">
                <span class="form-hint" id="pw-match-hint"></span>
              </div>
              <button class="btn btn-primary btn-lg" id="pw-change-btn" style="margin-top:4px;">
                비밀번호 변경
              </button>
            </div>
          </div>
        </div>

      </div>
    `;

    this._bindEvents();
  },

  _bindEvents: function() {
    const pwNew = document.getElementById('pw-new');
    const pwConfirm = document.getElementById('pw-confirm');
    const hint = document.getElementById('pw-match-hint');

    // 실시간 비밀번호 일치 확인
    const checkMatch = () => {
      if (!pwConfirm.value) { hint.textContent = ''; return; }
      if (pwNew.value === pwConfirm.value) {
        hint.textContent = '✓ 비밀번호가 일치합니다.';
        hint.style.color = '#2E7D32';
      } else {
        hint.textContent = '✗ 비밀번호가 일치하지 않습니다.';
        hint.style.color = '#E53935';
      }
    };

    pwNew.addEventListener('input', checkMatch);
    pwConfirm.addEventListener('input', checkMatch);

    document.getElementById('pw-change-btn').addEventListener('click', () => this.handleChangePassword());
  },

  handleChangePassword: async function() {
    const current = document.getElementById('pw-current').value;
    const newPw = document.getElementById('pw-new').value;
    const confirm = document.getElementById('pw-confirm').value;

    if (!current || !newPw || !confirm) {
      UI.toast('모든 항목을 입력해주세요.', 'error');
      return;
    }

    if (newPw.length < 6) {
      UI.toast('새 비밀번호는 6자 이상이어야 합니다.', 'error');
      return;
    }

    if (newPw !== confirm) {
      UI.toast('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    const btn = document.getElementById('pw-change-btn');
    btn.disabled = true;

    try {
      UI.showLoading();
      const result = await API.changePassword(current, newPw);

      if (result.status === 'success') {
        UI.toast('비밀번호가 변경되었습니다.', 'success');
        document.getElementById('pw-current').value = '';
        document.getElementById('pw-new').value = '';
        document.getElementById('pw-confirm').value = '';
        document.getElementById('pw-match-hint').textContent = '';
      } else {
        UI.toast(result.message || '비밀번호 변경에 실패했습니다.', 'error');
      }
    } catch (err) {
      UI.toast('서버 오류가 발생했습니다.', 'error');
    } finally {
      UI.hideLoading();
      btn.disabled = false;
    }
  }
};
