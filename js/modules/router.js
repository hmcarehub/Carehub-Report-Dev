// ============================================================
// modules/router.js — History API 기반 SPA 라우터
// URL 구조:
//   /            → dashboard (로그인 후)
//   /login       → 로그인
//   /dashboard   → 대시보드
//   /clients     → 고객 목록
//   /clients/:id → 고객 상세
//   /assessments → 평가 관리
//   /reports     → 리포트 관리
//   /mypage      → 마이페이지
//   /admin-users → 사용자 관리
//   /admin-standards → 기준값 관리
// ============================================================

const Router = {
  currentPage: null,

  // pageId → URL 경로 매핑
  _pathMap: {
    'dashboard':       '/dashboard',
    'clients':         '/clients',
    'client-detail':   '/clients',      // /clients/:id
    'assessments':     '/assessments',
    'reports':         '/reports',
    'mypage':          '/mypage',
    'admin-users':     '/admin/users',
    'admin-standards': '/admin/standards'
  },

  // URL 경로 → pageId + param 역매핑
  _matchPath: function(pathname) {
    // /clients/C001 형태
    const clientDetail = pathname.match(/^\/clients\/([^/]+)$/);
    if (clientDetail) return { pageId: 'client-detail', param: clientDetail[1] };

    const map = {
      '/':                  { pageId: 'dashboard' },
      '/dashboard':         { pageId: 'dashboard' },
      '/clients':           { pageId: 'clients' },
      '/assessments':       { pageId: 'assessments' },
      '/reports':           { pageId: 'reports' },
      '/mypage':            { pageId: 'mypage' },
      '/admin/users':       { pageId: 'admin-users' },
      '/admin/standards':   { pageId: 'admin-standards' },
      '/login':             { pageId: '__login__' }
    };
    return map[pathname] || { pageId: 'dashboard' };
  },

  pages: {
    'mypage':            () => Pages.mypage.render(),
    'admin-users':       () => Pages.adminUsers.render(),
    'clients':           () => Pages.clients.render(),
    'client-detail':     (id) => Pages.clientDetail.render(id),
    'assessments':       () => Pages.assessments.render(),
    'admin-standards':   () => Pages.adminStandards.render(),
    'reports':           () => Pages.reports.render(),
    'dashboard':         () => Pages.dashboard.render()
  },

  // ── 초기화: popstate 리스너 등록 ─────────────────────────
  init: function() {
    window.addEventListener('popstate', (e) => {
      // 뒤로/앞으로가기 → 현재 URL에서 페이지 복원
      if (!Auth.isLoggedIn()) { App.showLogin(); return; }
      const { pageId, param } = this._matchPath(location.pathname);
      if (pageId === '__login__') { App.showLogin(); return; }
      this._renderPage(pageId, param);
      this._updateNav(pageId);
      this.currentPage = pageId;
    });
  },

  // ── 페이지 이동 (URL 변경 포함) ──────────────────────────
  navigate: function(pageId, param) {
    const menu = AppConfig.MENUS.find(m => m.id === pageId);
    if (menu && menu.comingSoon) { UI.toast('준비 중인 기능입니다.', 'info'); return; }
    if (menu && menu.roles && !menu.roles.includes(Auth.getUser()?.role)) {
      UI.toast('접근 권한이 없습니다.', 'error'); return;
    }

    // URL 생성
    const basePath = this._pathMap[pageId] || '/' + pageId;
    const url = (pageId === 'client-detail' && param)
      ? `/clients/${param}`
      : basePath;

    // 같은 URL이면 pushState 스킵 (중복 방지)
    if (location.pathname !== url) {
      history.pushState({ pageId, param: param || null }, '', url);
    }

    this.currentPage = pageId;
    this._renderPage(pageId, param);
    this._updateNav(pageId);
  },

  // ── URL에서 직접 접근 시 복원 (App.showApp에서 호출) ─────
  restoreFromUrl: function() {
    const { pageId, param } = this._matchPath(location.pathname);
    if (pageId === '__login__') return false;
  
    history.replaceState({ pageId, param: param || null }, '', location.pathname);
    this.currentPage = pageId;
  
    // client-detail은 param(고객ID) 필수 확인
    if (pageId === 'client-detail' && !param) {
      this._renderPage('clients');
      this._updateNav('clients');
      this.currentPage = 'clients';
      return true;
    }
  
    this._renderPage(pageId, param);
    this._updateNav(pageId);
    return true;
  },

  _renderPage: function(pageId, param) {
    const container = document.getElementById('page-content');
    const renderer  = this.pages[pageId];
    if (!renderer) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚧</div><div class="empty-state-text">준비 중인 페이지입니다</div></div>`;
      return;
    }
    renderer(param);
  },

  _updateNav: function(pageId) {
    const activeId = pageId === 'client-detail' ? 'clients' : pageId;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === activeId);
    });
    const menu    = AppConfig.MENUS.find(m => m.id === activeId);
    const titleEl = document.getElementById('header-title');
    if (titleEl) {
      if (pageId === 'client-detail') titleEl.textContent = '고객 상세';
      else if (menu) titleEl.textContent = menu.label;
    }
  }
};
