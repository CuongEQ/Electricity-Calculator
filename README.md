# ⚡ Electricity Calculator — Hệ Thống Tính Tiền Điện Phòng Trọ

Ứng dụng web Single Page Application (SPA) hiện đại, hỗ trợ các phòng trọ/căn hộ tính toán và phân bổ tiền điện hàng tháng minh bạch, công bằng dựa trên thời gian sử dụng thực tế của từng thành viên.

---

## 🌟 Tính Năng Nổi Bật

1. **Xác thực người dùng:**
   - Đăng ký, đăng nhập tài khoản cá nhân độc lập.
   - Mã hóa mật khẩu một chiều an toàn với chuẩn SHA-256 (Web Crypto API).
   - Duy trì phiên làm việc mượt mà.

2. **Quản lý phòng thông minh:**
   - Tạo phòng mới kèm mã mời độc nhất 6 ký tự.
   - Người tạo phòng tự động là **Quản lý phòng (Admin)**.
   - Thành viên khác tham gia thông qua mã phòng.
   - Quản lý phòng có quyền: **Duyệt / Từ chối yêu cầu tham gia**, **Xóa thành viên khỏi phòng**, nhập hóa đơn tiền điện tháng.

3. **Lịch biểu & Khai báo giờ dùng điện:**
   - Trực quan hóa toàn bộ ngày trong tháng với lưới lịch hiện đại.
   - Khai báo các khoảng thời gian theo định dạng `HH:MM - HH:MM`.
   - **Hệ thống lọc và kiểm soát ngoại lệ chặt chẽ:**
     - Kiểm tra định dạng `HH:MM` (00:00 - 23:59).
     - Bắt buộc `Giờ bắt đầu < Giờ kết thúc`.
     - Ngăn chặn hoàn toàn việc khai báo trùng lặp (overlap) giữa các khoảng giờ trong cùng ngày.
     - Chặn khai báo cho các ngày trong tương lai.
   - Thống kê tổng số giờ cá nhân, tổng số giờ cả phòng và **số tiền dự kiến phải trả** trực tiếp trên màn hình lịch.

4. **Thống kê & Tính tiền điện (Quản lý phòng):**
   - Quản lý phòng nhập tổng hóa đơn tiền điện cả phòng trong tháng.
   - Biểu đồ phân bổ tỷ lệ phần trăm (%) trực quan sinh động giữa các thành viên.
   - Bảng kê chi tiết từng người với công thức chuẩn xác:
     $$\text{Tiền thành viên} = \frac{\text{Tiền cả phòng}}{\text{Tổng giờ cả phòng}} \times \text{Tổng giờ thành viên}$$

5. **Giao diện hiện đại & Đa chế độ (Light/Dark Mode):**
   - Hỗ trợ cả 2 chế độ: **Giao diện Tối (Dark Mode)** và **Giao diện Sáng (Light Mode)** với nút gạt chuyển đổi mượt mà.
   - Thiết kế Glassmorphism, animations tinh tế, tối ưu trải nghiệm trên cả điện thoại và máy tính.

---

## 🚀 Hướng Dẫn Sử Dụng & Deploy Lên Vercel

### 1. Trải nghiệm thử ngay trên máy (Local)
Dự án được thiết kế với cơ chế **Zero-Config Fallback**:
- Nếu chưa kết nối Firebase, ứng dụng sẽ tự động lưu dữ liệu vào `LocalStorage` trên trình duyệt để bạn trải nghiệm đầy đủ 100% tính năng ngay lập tức.
- Bạn có thể mở trực tiếp file `index.html` hoặc chạy dev server:
  ```bash
  npx -y serve .
  ```

### 2. Cấu hình Firebase Firestore (Đồng bộ đa thiết bị)
Để tất cả các thành viên trong phòng cùng truy cập từ điện thoại/máy tính cá nhân của họ và đồng bộ dữ liệu thời gian thực:
1. Truy cập [Firebase Console](https://console.firebase.google.com/) và tạo một Project miễn phí.
2. Vào mục **Firestore Database** -> Chọn **Create database** (chọn chế độ *Test mode* hoặc thêm security rules đọc/ghi).
3. Vào **Project Settings** -> Thêm ứng dụng Web (Web App) để lấy thông tin cấu hình (`apiKey`, `projectId`,...).
4. Mở file [js/config.js](file:///home/cuongeq/Project/Web/ElectricityCalculator/js/config.js) và dán các thông số vào:
   ```javascript
   export const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

### 3. Deploy lên Vercel
Dự án đã có sẵn file `vercel.json` định tuyến cho Single Page Application:
- Cách 1: Đẩy mã nguồn lên GitHub/GitLab rồi import vào tài khoản [Vercel](https://vercel.com).
- Cách 2: Sử dụng Vercel CLI trong terminal:
  ```bash
  npx -y vercel
  ```
Vercel sẽ tự động build và cung cấp cho bạn một domain HTTPS miễn phí để chia sẻ cho mọi người trong phòng!
