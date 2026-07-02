// ============================================================
// pages/login.js - 로그인 페이지
// ============================================================

const LoginPage = {
  /**
   * 로그인 페이지 초기화
   */
  init: function() {
    const form = document.getElementById('login-form');
    const btn = document.getElementById('login-btn');
    form.addEventListener('submit', e => {
      e.preventDefault();
      this.handleLogin();
    });
    btn.addEventListener('click', () => this.handleLogin());
  
    // 비밀번호 입력창에서 엔터키
    document.getElementById('login-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.handleLogin();
    });
  },

  /**
   * 로그인 처리
   */
  handleLogin: async function() {
    const loginId = document.getElementById('login-id').value.trim();
    const password = document.getElementById('login-password').value;

    if (!loginId || !password) {
      this.showError('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = '로그인 중...';

    try {
      const result = await API.login(loginId, password);
      if (result.status === 'success') {
        Auth.login(result.data);
        // showApp() 이전에 요청 시작 → _pending에 등록 → dashboard가 같은 Promise 재사용
        API.getInitialData().catch(() => {});
        // 다음 tick에 화면 전환 (요청이 먼저 등록된 후 렌더 시작)
        setTimeout(() => App.showApp(), 0);
      } else {
        this.showError(result.message || '로그인 정보를 다시 확인해주세요.');
      }
    } catch (err) {
      this.showError('서버 연결에 실패했습니다: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '로그인하기';
    }
  },

  /**
   * 오류 모달 표시
   */
  showError: function(message) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" style="max-width:360px;">
        <div class="modal-body" style="padding:28px 24px 16px;text-align:center;">
          <div style="font-size:36px;margin-bottom:12px;">⚠️</div>
          <p style="font-size:15px;font-weight:600;color:#2C2C2C;margin-bottom:8px;">로그인 실패</p>
          <p style="font-size:13px;color:#888;">${message}</p>
        </div>
        <div class="modal-footer" style="justify-content:center;">
          <button class="btn btn-primary" id="error-close-btn" style="min-width:100px;">확인</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const close = () => {
      backdrop.remove();
      document.getElementById('login-id').focus();
    };

    backdrop.querySelector('#error-close-btn').onclick = close;
    backdrop.onclick = e => { if (e.target === backdrop) close(); };
  }
};
