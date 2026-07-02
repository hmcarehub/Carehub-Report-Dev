// ============================================================
// modules/auth.js - 인증 상태 관리 모듈
// ============================================================

const Auth = {
  /**
   * 로그인 상태 확인
   */
  isLoggedIn: function() {
    return localStorage.getItem(AppConfig.STORAGE_KEY) !== null;
  },

  /**
   * 현재 로그인 사용자 정보 반환
   * @returns {Object|null}
   */
  getUser: function() {
    const data = localStorage.getItem(AppConfig.STORAGE_KEY);
    if (!data) return null;
    try { return JSON.parse(data); } catch { return null; }
  },

  /**
   * 로그인 - 사용자 정보 저장
   * @param {Object} userData
   */
  login: function(userData) {
    localStorage.setItem(AppConfig.STORAGE_KEY, JSON.stringify(userData));
  },

  /**
   * 로그아웃 - 로컬 스토리지 제거
   */
  logout: function() {
    // localStorage.removeItem(AppConfig.STORAGE_KEY);
    supabaseClient.auth.signOut(); // ✅ Supabase Auth 로그아웃
    localStorage.removeItem(AppConfig.STORAGE_KEY);
  },

  /**
   * 권한 확인
   * @param {string} role
   */
  hasRole: function(role) {
    const user = this.getUser();
    return user && user.role === role;
  },

  /**
   * ADMIN 여부
   */
  isAdmin: function() {
    return this.hasRole('ADMIN');
  },

  /**
   * 로그인 사용자 정보 업데이트 (부분 업데이트)
   * @param {Object} fields
   */
  updateUserData: function(fields) {
    const user = this.getUser();
    if (!user) return;
    const updated = { ...user, ...fields };
    localStorage.setItem(AppConfig.STORAGE_KEY, JSON.stringify(updated));
  }
};
