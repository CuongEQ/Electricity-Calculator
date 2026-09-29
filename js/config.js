/**
 * Cấu hình ứng dụng & Firebase Firestore
 * 
 * Khi deploy lên Vercel:
 * Bạn chỉ cần tạo một Firebase Project miễn phí tại https://console.firebase.google.com
 * Sau đó điền các thông số vào object firebaseConfig bên dưới.
 * Nếu để trống, hệ thống sẽ tự động chuyển sang chế độ Local Demo (LocalStorage)
 * giúp bạn có thể trải nghiệm đầy đủ tính năng ngay lập tức!
 */

export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey.trim() !== ""
  );
}
