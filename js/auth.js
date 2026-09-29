import { createUser, authenticateUser, getUserById } from './storage-service.js';
import { showToast } from './ui.js';

const SESSION_KEY = 'elec_calc_session_user_id';

let currentUser = null;
let authStateChangeListeners = [];

export function onAuthStateChanged(listener) {
  authStateChangeListeners.push(listener);
}

function notifyAuthState(user) {
  currentUser = user;
  authStateChangeListeners.forEach(fn => fn(user));
}

export function getCurrentUser() {
  return currentUser;
}

export async function initAuth() {
  // Check session
  const storedUserId = sessionStorage.getItem(SESSION_KEY);
  if (storedUserId) {
    try {
      const user = await getUserById(storedUserId);
      if (user) {
        notifyAuthState(user);
        return user;
      }
    } catch (e) {
      console.warn('Lỗi phục hồi phiên:', e);
    }
  }
  sessionStorage.removeItem(SESSION_KEY);
  notifyAuthState(null);
  return null;
}

export async function login(username, password) {
  if (!username || !password) {
    showToast('Vui lòng điền đầy đủ tên đăng nhập và mật khẩu!', 'error');
    return null;
  }

  try {
    const user = await authenticateUser(username, password);
    sessionStorage.setItem(SESSION_KEY, user.id);
    notifyAuthState(user);
    showToast(`Chào mừng ${user.displayName} trở lại!`, 'success');
    return user;
  } catch (err) {
    showToast(err.message || 'Đăng nhập không thành công!', 'error');
    return null;
  }
}

export async function register(username, displayName, password, confirmPassword) {
  if (!username || !displayName || !password) {
    showToast('Vui lòng điền đầy đủ tất cả các trường!', 'error');
    return null;
  }

  if (username.length < 3) {
    showToast('Tên đăng nhập phải có ít nhất 3 ký tự!', 'error');
    return null;
  }

  if (password.length < 6) {
    showToast('Mật khẩu phải có ít nhất 6 ký tự!', 'error');
    return null;
  }

  if (password !== confirmPassword) {
    showToast('Mật khẩu xác nhận không khớp!', 'error');
    return null;
  }

  try {
    const user = await createUser({ username, displayName, password });
    sessionStorage.setItem(SESSION_KEY, user.id);
    notifyAuthState(user);
    showToast('Tạo tài khoản thành công! Bạn đã được đăng nhập.', 'success');
    return user;
  } catch (err) {
    showToast(err.message || 'Không thể đăng ký tài khoản!', 'error');
    return null;
  }
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  notifyAuthState(null);
  showToast('Đã đăng xuất thành công!', 'info');
}

export async function refreshCurrentUser() {
  if (!currentUser) return null;
  const user = await getUserById(currentUser.id);
  if (user) {
    notifyAuthState(user);
  }
  return user;
}
