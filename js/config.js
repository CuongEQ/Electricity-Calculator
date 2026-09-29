/**
 * Cấu hình ứng dụng & Tải biến môi trường Firebase
 * 
 * BẢO MẬT: File này hoàn toàn KHÔNG chứa khóa API hoặc thông tin nhạy cảm.
 * Toàn bộ khóa bí mật được cấu hình qua BIẾN MÔI TRƯỜNG trên Vercel:
 *   - FIREBASE_API_KEY
 *   - FIREBASE_AUTH_DOMAIN
 *   - FIREBASE_PROJECT_ID
 *   - FIREBASE_STORAGE_BUCKET
 *   - FIREBASE_MESSAGING_SENDER_ID
 *   - FIREBASE_APP_ID
 * 
 * Khi deploy lên Vercel, hàm /api/config sẽ tự động đọc các biến trên.
 * Nếu chạy ở máy cá nhân (Local) và chưa cấu hình biến môi trường,
 * ứng dụng sẽ tự động chạy ở chế độ LocalStorage để bạn dùng thử thoải mái!
 */

let cachedConfig = null;

export async function loadFirebaseConfig() {
  if (cachedConfig) return cachedConfig;

  // 1. Kiểm tra cấu hình toàn cục từ window nếu có
  if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) {
    cachedConfig = window.__FIREBASE_CONFIG__;
    return cachedConfig;
  }

  // 2. Thử tải từ file local gitignored (cho môi trường dev cá nhân)
  try {
    const localModule = await import('./config.local.js ');
    if (localModule && localModule.firebaseConfig) {
      cachedConfig = localModule.firebaseConfig;
      console.log('🔑 Đã nạp cấu hình Firebase từ config.local.js');
      return cachedConfig;
    }
  } catch (err) {
    // config.local.js không tồn tại (bình thường, do được gitignore)
  }

  // 3. Thử tải từ endpoint Serverless /api/config (môi trường Vercel)
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      if (data && data.apiKey && data.apiKey.trim() !== '') {
        cachedConfig = data;
        console.log('⚡ Đã nạp cấu hình Firebase từ biến môi trường Vercel (/api/config)');
        return cachedConfig;
      }
    }
  } catch (err) {
    // Đang chạy dev server đơn giản (python, serve...) chưa có endpoint /api/config
  }

  // Mặc định rỗng (chuyển sang LocalStorage fallback)
  cachedConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  };
  return cachedConfig;
}

export function isFirebaseConfigured(config) {
  if (!config) return false;
  return Boolean(
    config.apiKey &&
    config.projectId &&
    config.apiKey.trim() !== "" &&
    !config.apiKey.includes('YourApiKeyHere')
  );
}
