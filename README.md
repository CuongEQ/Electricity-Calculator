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
   - Hiển thị tên đăng nhập `@username` của quản lý phòng thay vì chữ chung chung.
   - Thành viên khác tham gia thông qua mã phòng.
   - Quản lý phòng có quyền: **Duyệt / Từ chối yêu cầu tham gia**, **Xóa thành viên khỏi phòng**.
   - **Tự rời phòng:** Thành viên có thể chủ động rời phòng. Nếu là Quản lý rời phòng, quyền quản lý sẽ tự động chuyển giao cho người kế tiếp; nếu phòng hết thành viên, phòng sẽ tự động được xóa.

3. **Lịch biểu & Khai báo giờ / ngày linh hoạt:**
   - Trực quan hóa toàn bộ ngày trong tháng với lưới lịch hiện đại.
   - **Hỗ trợ 2 chế độ tính toán theo cấu hình tháng:**
     - **Theo Giờ:** Khai báo khoảng thời gian `HH:MM - HH:MM` kèm bộ lọc chống trùng lặp, chặn ngày tương lai.
     - **Theo Ngày:** Xác nhận chỉ với 1 click "Có sử dụng điện" mà không cần nhập giờ chi tiết.
   - Thống kê tổng số giờ/ngày cá nhân, cả phòng và **số tiền dự kiến phải trả** trực tiếp trên màn hình lịch.

4. **Thống kê & Tính tiền điện (Quản lý phòng):**
   - Quản lý phòng có thể cấu hình tháng tính theo **Ngày** hoặc theo **Giờ**.
   - **Popup cảnh báo an toàn:** Khi chuyển đổi phương thức tính, hiển thị popup xác nhận và tự động xóa dữ liệu cũ trong tháng để tránh sai lệch.
   - Nhập tổng hóa đơn tiền điện cả phòng: **Tự động ngăn cách 3 chữ số khi nhập** (VD: `850.000 ₫`) và hiển thị trực quan.
   - Biểu đồ phân bổ tỷ lệ phần trăm (%) trực quan sinh động giữa các thành viên.
   - Bảng kê chi tiết từng người theo công thức chuẩn xác (tính theo giờ hoặc ngày tương ứng).

5. **Giao diện hiện đại & Đa chế độ (Light/Dark Mode):**
   - Hỗ trợ cả 2 chế độ: **Giao diện Tối (Dark Mode)** và **Giao diện Sáng (Light Mode)** với nút gạt chuyển đổi mượt mà.
   - Định dạng tiền tệ VNĐ chuẩn xác, ngăn cách 3 chữ số dễ nhìn ở mọi vị trí hiển thị.
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

### 2. Cấu hình Biến Môi Trường (Bảo Mật — Tránh Lộ Khóa Trên GitHub)
Mã nguồn dự án hoàn toàn **không chứa khóa API** trong git repository. Khi deploy lên Vercel:
1. Tạo Firebase Project miễn phí tại [Firebase Console](https://console.firebase.google.com/).
2. Vào **Project Settings** -> Thêm ứng dụng Web (Web App) để lấy các thông số.
3. Khi import dự án vào [Vercel](https://vercel.com) (hoặc trong mục **Project Settings > Environment Variables** trên Vercel Dashboard), thêm 6 biến môi trường tương ứng:
   ```env
   FIREBASE_API_KEY=AIzaSy...
   FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   FIREBASE_PROJECT_ID=your-project
   FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=123456789
   FIREBASE_APP_ID=1:123456789:web:abcdef
   ```
   *(Tham khảo file [.env.example](file:///home/cuongeq/Project/Web/ElectricityCalculator/.env.example))*
4. Vercel Serverless Function `/api/config` sẽ tự động đọc các biến này và nạp an toàn vào ứng dụng mà không để lộ khóa bí mật trong mã nguồn GitHub.

*(Dành cho dev offline cá nhân: Bạn có thể tạo file `js/config.local.js` — file này đã được thêm vào `.gitignore` nên sẽ không bao giờ bị commit lên GitHub).*

### 3. Deploy lên Vercel
Dự án đã có sẵn file `vercel.json` định tuyến cho Single Page Application và Serverless Function:
- **Cách 1 (Khuyên dùng):** Đẩy mã nguồn lên GitHub rồi import vào Vercel (điền các Environment Variables ở Bước 2).
- **Cách 2:** Sử dụng Vercel CLI trong terminal:
  ```bash
  npx -y vercel
  ```
Vercel sẽ tự động build và cung cấp cho bạn một domain HTTPS miễn phí để chia sẻ cho mọi người trong phòng!
