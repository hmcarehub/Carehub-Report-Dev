// ============================================================
// app.js - v9
// ============================================================

const Pages = {
  mypage:       MypagePage,
  adminUsers:   AdminUsersPage,
  clients:      ClientsPage,
  clientDetail: ClientDetailPage,
  assessments:    AssessmentsPage,
  adminStandards: AdminStandardsPage,
  reports:      ReportsPage,
  dashboard:    DashboardPage
};

const App = {
  init: function() {
    Router.init();
    // 로그인 상태면 앱으로, 아니면 로그인 페이지로
    if (Auth.isLoggedIn()) {
      this.showApp();
    } else {
      history.replaceState(null, '', '/login');
      this.showLogin();
    }
    // 준비 완료 후 보이게
    document.getElementById('login-page').style.visibility = 'visible';
    document.getElementById('app-layout').style.visibility = 'visible';
  },

  showLogin: function() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('app-layout').classList.add('hidden');
    if (location.pathname !== '/login') {
      history.replaceState(null, '', '/login');
    }
    LoginPage.init();
  },

  showApp: function() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('app-layout').classList.remove('hidden');
    this._renderSidebar();
    this._bindGlobalEvents();
    // URL 직접 접근 시 해당 페이지 복원, 아니면 dashboard
    if (!Router.restoreFromUrl()) {
      Router.navigate('dashboard');
    }
  },

  _renderSidebar: function() {
    const user = Auth.getUser();
    const logoDataUrl = document.getElementById('logo-data').value;
    document.getElementById('sidebar-logo-img').src = logoDataUrl;
    document.getElementById('sidebar-user-avatar').textContent = UI.initials(user.name);
    document.getElementById('sidebar-user-name').textContent   = user.name;
    document.getElementById('sidebar-user-role').textContent   = UI.roleLabel(user.role);

    const nav     = document.getElementById('sidebar-nav');
    const allowed = AppConfig.MENUS.filter(m => m.roles.includes(user.role));
    let html = '';
    let openGroup = null;

    allowed.forEach((menu, idx) => {
      if (menu.type === 'group') {
        openGroup = menu.id;
        html += `
          <div class="nav-group-header open" data-group="${menu.id}">
            ${menu.icon}
            <span>${menu.label}</span>
          </div>
          <div class="nav-group-children open" data-group-children="${menu.id}">`;
      } else if (menu.parent) {
        html += `
            <div class="nav-item nav-sub-item${menu.comingSoon?' coming-soon':''}" data-page="${menu.id}">
              <span class="nav-sub-dot"></span>
              ${menu.icon}
              <span>${menu.label}</span>
              ${menu.comingSoon?'<span class="nav-badge">준비중</span>':''}
            </div>`;
        const nextMenu = allowed[idx + 1];
        if (!nextMenu || nextMenu.parent !== menu.parent) {
          html += '</div>';
          openGroup = null;
        }
      } else {
        html += `
          <div class="nav-item${menu.comingSoon?' coming-soon':''}" data-page="${menu.id}">
            ${menu.icon}
            <span>${menu.label}</span>
            ${menu.comingSoon?'<span class="nav-badge">준비중</span>':''}
          </div>`;
      }
    });

    // 마이페이지는 sidebar-footer 위에 별도 배치
    nav.innerHTML = html;

    // 마이페이지 링크 (footer 위)
    const mypageItem = document.getElementById('sidebar-mypage-link');
    if (mypageItem) {
      mypageItem.onclick = () => {
        Router.navigate('mypage');
        document.querySelector('.sidebar').classList.remove('open');
        document.querySelector('.sidebar-overlay').classList.remove('show');
      };
    }

    // 일반 메뉴 클릭
    nav.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => {
        Router.navigate(el.dataset.page);
        document.querySelector('.sidebar').classList.remove('open');
        document.querySelector('.sidebar-overlay').classList.remove('show');
      });
    });
  },

  _bindGlobalEvents: function() {
    document.getElementById('logout-btn').addEventListener('click', async () => {
      const ok = await UI.confirm({
        title:'로그아웃하시겠습니까?', message:'로그인 화면으로 이동합니다.',
        confirmText:'로그아웃', cancelText:'취소', type:'warning'
      });
      if (ok) { Auth.logout(); location.reload(); }
    });
    document.getElementById('menu-toggle-btn').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('open');
      document.querySelector('.sidebar-overlay').classList.toggle('show');
    });
    document.querySelector('.sidebar-overlay').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.remove('open');
      document.querySelector('.sidebar-overlay').classList.remove('show');
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
