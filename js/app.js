import { initTheme } from './theme.js';
import { initAuth, getCurrentUser, onAuthStateChanged, login, register, logout } from './auth.js';
import { renderCalendarView, initCalendar } from './calendar.js';
import { renderRoomView, fetchCurrentRoom, getCurrentRoom } from './room.js';
import { renderStatsView, initStats } from './stats.js';
import { isBezit, showBezitEasterEgg } from './easter-egg.js';

let activeView = 'calendar';
let bezitWelcomeShown = false;

export async function navigateTo(viewName) {
  activeView = viewName;

  // Cập nhật trạng thái sidebar nav
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Ẩn tất cả view-section
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  // Hiển thị view được chọn và kích hoạt render
  const targetSection = document.getElementById(`view-${viewName}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Gọi render tương ứng
  if (viewName === 'calendar') {
    await renderCalendarView();
  } else if (viewName === 'room') {
    await renderRoomView();
  } else if (viewName === 'stats') {
    await renderStatsView();
  }
}

async function handleAuthStateUpdate(user) {
  const authSection = document.getElementById('auth-view');
  const appLayout = document.getElementById('app-layout');

  if (!user) {
    bezitWelcomeShown = false;
    document.getElementById('btn-replay-bezit')?.remove();
    authSection?.classList.remove('hidden');
    appLayout?.classList.add('hidden');
    return;
  }

  // Đã đăng nhập
  authSection?.classList.add('hidden');
  appLayout?.classList.remove('hidden');

  // Cập nhật thông tin người dùng lên sidebar
  const userNameEl = document.getElementById('sidebar-user-name');
  const userAvatarEl = document.getElementById('sidebar-user-avatar');
  const userRoleEl = document.getElementById('sidebar-user-role');

  if (userNameEl) userNameEl.textContent = user.displayName;
  if (userAvatarEl) userAvatarEl.textContent = user.displayName ? user.displayName.charAt(0).toUpperCase() : '?';

  // Lấy dữ liệu phòng
  const room = await fetchCurrentRoom();
  const isAdmin = room && room.adminId === user.id;

  // Cập nhật tên phòng trên Topbar
  const roomTag = document.getElementById('topbar-room-name');
  if (roomTag) {
    roomTag.textContent = room ? `🏠 ${room.name}` : 'Chưa vào phòng';
  }

  if (userRoleEl) {
    userRoleEl.textContent = room ? (isAdmin ? 'Quản lý phòng' : 'Thành viên') : 'Chưa vào phòng';
  }

  // Ẩn/Hiện tab Thống kê dành riêng cho Quản lý
  const statsNavItem = document.querySelector('.nav-item[data-view="stats"]');
  if (statsNavItem) {
    if (isAdmin) {
      statsNavItem.classList.remove('hidden');
    } else {
      statsNavItem.classList.add('hidden');
      if (activeView === 'stats') {
        activeView = 'calendar';
      }
    }
  }

  // Cập nhật badge yêu cầu chờ duyệt nếu có
  const pendingBadge = document.getElementById('pending-req-badge');
  if (pendingBadge) {
    const pendingCount = (room && isAdmin && room.pendingRequests) ? room.pendingRequests.length : 0;
    if (pendingCount > 0) {
      pendingBadge.textContent = pendingCount;
      pendingBadge.classList.remove('hidden');
    } else {
      pendingBadge.classList.add('hidden');
    }
  }

  await navigateTo(activeView);

  // Hoạt ảnh chào mừng đặc biệt chỉ dành riêng cho tài khoản "bezit"
  if (isBezit(user)) {
    // Thêm nút xem lại ở góc người dùng trong sidebar
    let bezitBadge = document.getElementById('btn-replay-bezit');
    if (!bezitBadge) {
      const userInfo = document.querySelector('.user-snippet-info');
      if (userInfo) {
        bezitBadge = document.createElement('span');
        bezitBadge.id = 'btn-replay-bezit';
        bezitBadge.className = 'bezit-sidebar-badge';
        bezitBadge.title = 'Bấm để xem lại hoạt ảnh Boà & Zịt nè!';
        bezitBadge.innerHTML = '🐄🪿 Boà & Zịt';
        bezitBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          showBezitEasterEgg();
        });
        userInfo.appendChild(bezitBadge);
      }
    }

    // Tự động kích hoạt khi đăng nhập hoặc mỗi lần tải trang
    if (!bezitWelcomeShown) {
      bezitWelcomeShown = true;
      setTimeout(() => {
        showBezitEasterEgg();
      }, 400);
    }
  }
}

// Khởi chạy khi tài liệu sẵn sàng (Do dùng type="module" và top-level await, DOM đã sẵn sàng)
(async () => {
  // 1. Khởi tạo theme
  initTheme();

  // 2. Khởi tạo Calendar & Stats
  initCalendar();
  initStats();

  // 3. Đăng ký auth listener
  onAuthStateChanged(handleAuthStateUpdate);

  // 4. Khởi tạo trạng thái phiên đăng nhập
  await initAuth();

  // Gắn sự kiện chuyển tab Auth (Đăng nhập / Đăng ký)
  const tabLogin = document.getElementById('tab-btn-login');
  const tabRegister = document.getElementById('tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister?.classList.remove('active');
    formLogin?.classList.remove('hidden');
    formRegister?.classList.add('hidden');
  });

  tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin?.classList.remove('active');
    formRegister?.classList.remove('hidden');
    formLogin?.classList.add('hidden');
  });

  // Submit Login
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;
    await login(u, p);
  });

  // Submit Register
  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('reg-username').value;
    const d = document.getElementById('reg-display-name').value;
    const p = document.getElementById('reg-password').value;
    const cp = document.getElementById('reg-confirm-password').value;
    await register(u, d, p, cp);
  });

  // Navigation sidebar items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      if (view) navigateTo(view);
    });
  });

  // Logout button
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
      logout();
    }
  });
})();
