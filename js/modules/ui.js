// ============================================================
// modules/ui.js - UI 공통 유틸리티 모듈
// ============================================================

const UI = {
  /**
   * 토스트 알림
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   */
  toast: function(message, type = 'success') {
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const container = document.getElementById('toast-container');

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;

    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  },

  /**
   * 로딩 오버레이 표시
   */
  showLoading: function() {
    let el = document.getElementById('loading-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay';
      el.className = 'loading-overlay';
      el.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
  },

  /**
   * 로딩 오버레이 숨김
   */
  hideLoading: function() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
  },

  /**
   * 확인 모달
   * @param {Object} options { title, message, confirmText, cancelText, type }
   * @returns {Promise<boolean>}
   */
  confirm: function(options = {}) {
    return new Promise(resolve => {
      const {
        title = '확인',
        message = '계속하시겠습니까?',
        confirmText = '확인',
        cancelText = '취소',
        type = 'danger'
      } = options;

      const icons = { danger: '🗑️', warning: '⚠️', info: 'ℹ️' };

      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal confirm-modal">
          <div class="modal-body" style="padding-top:28px;padding-bottom:8px;">
            <div class="confirm-icon confirm-icon-${type}">${icons[type] || '❓'}</div>
            <p class="confirm-text">${title}</p>
            <p class="confirm-sub">${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="confirm-cancel">${cancelText}</button>
            <button class="btn btn-${type}" id="confirm-ok">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);

      const cleanup = (result) => {
        backdrop.remove();
        resolve(result);
      };

      backdrop.querySelector('#confirm-ok').onclick = () => cleanup(true);
      backdrop.querySelector('#confirm-cancel').onclick = () => cleanup(false);
      backdrop.onclick = (e) => { if (e.target === backdrop) cleanup(false); };
    });
  },

  /**
   * 권한 코드 → 표시명
   */
  roleLabel: function(role) {
    return AppConfig.ROLES[role] || role;
  },

  /**
   * 상태 코드 → 표시명
   */
  statusLabel: function(status) {
    return AppConfig.STATUS[status] || status;
  },

  /**
   * 권한 뱃지 HTML
   */
  roleBadge: function(role) {
    const cls = role === 'ADMIN' ? 'badge-admin' : 'badge-role';
    return `<span class="badge ${cls}">${this.roleLabel(role)}</span>`;
  },

  /**
   * 상태 뱃지 HTML
   */
  statusBadge: function(status) {
    const cls = status === 'ACTIVE' ? 'badge-active' : 'badge-inactive';
    return `<span class="badge ${cls}">${this.statusLabel(status)}</span>`;
  },

  /**
   * 날짜 포맷 (빈값 처리)
   */
  formatDate: function(val) {
    if (!val) return '-';
    return String(val);
  },

  /**
   * 이름 이니셜 (아바타용)
   */
  initials: function(name) {
    if (!name) return '?';
    return name.charAt(0);
  }
};
