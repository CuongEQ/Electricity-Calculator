import { 
  getMonthUsages, 
  getUserDaySlots, 
  saveDaySlots, 
  getRoomById 
} from './storage-service.js';
import { getCurrentUser } from './auth.js';
import { getCurrentRoom, fetchCurrentRoom } from './room.js';
import { 
  formatVND, 
  formatHours, 
  calculateSlotHours, 
  validateTimeSlot, 
  showToast 
} from './ui.js';

let viewingYear = new Date().getFullYear();
let viewingMonth = new Date().getMonth(); // 0-indexed (0 = Jan, 8 = Sep)
let selectedDateStr = null; // "YYYY-MM-DD"
let currentDaySlots = [];
let currentMonthUsages = {};

export function initCalendar() {
  const today = new Date();
  viewingYear = today.getFullYear();
  viewingMonth = today.getMonth();
  selectedDateStr = formatDateKey(today);
}

function formatDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getViewingMonthKey() {
  const m = String(viewingMonth + 1).padStart(2, '0');
  return `${viewingYear}-${m}`;
}

export async function renderCalendarView() {
  const container = document.getElementById('calendar-view-content');
  if (!container) return;

  const user = getCurrentUser();
  const room = await fetchCurrentRoom();

  if (!room) {
    container.innerHTML = `
      <div class="card text-center" style="padding: 48px 24px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 16px;">🏠</div>
        <h3 style="font-size: 1.35rem; margin-bottom: 8px;">Bạn chưa tham gia phòng nào</h3>
        <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 24px auto;">
          Vui lòng tạo phòng mới hoặc tham gia phòng bằng mã phòng để bắt đầu khai báo lịch sử dụng điện và tính tiền.
        </p>
        <button class="btn btn-primary" id="btn-goto-room-tab">
          👉 Đến trang Quản lý Phòng
        </button>
      </div>
    `;
    document.getElementById('btn-goto-room-tab')?.addEventListener('click', () => {
      document.querySelector('[data-view="room"]')?.click();
    });
    return;
  }

  const monthKey = getViewingMonthKey();
  currentMonthUsages = await getMonthUsages(room.id, monthKey);

  // Tính toán tổng số giờ cá nhân và cả phòng trong tháng
  let myTotalMonthHours = 0;
  let roomTotalMonthHours = 0;

  // Format of usages: { [userId]: { [dateStr]: [ { start, end, hours } ] } }
  Object.keys(currentMonthUsages).forEach(uId => {
    const userDays = currentMonthUsages[uId] || {};
    let uTotal = 0;
    Object.keys(userDays).forEach(dKey => {
      const slots = userDays[dKey] || [];
      slots.forEach(s => {
        uTotal += (s.hours || 0);
      });
    });

    roomTotalMonthHours += uTotal;
    if (uId === user.id) {
      myTotalMonthHours = uTotal;
    }
  });

  // Tính số tiền cần trả nếu Quản lý đã nhập tiền điện tháng này
  const monthlyBill = (room.monthlyBills && room.monthlyBills[monthKey]) ? room.monthlyBills[monthKey] : null;
  let estimatedMyBill = null;
  if (monthlyBill !== null && roomTotalMonthHours > 0) {
    estimatedMyBill = (monthlyBill / roomTotalMonthHours) * myTotalMonthHours;
  }

  // Tên tháng tiếng Việt
  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];
  const monthLabel = `${monthNames[viewingMonth]}, ${viewingYear}`;

  container.innerHTML = `
    <div class="calendar-container animate-fade">
      <!-- Thống kê tổng quan tháng ở góc trên -->
      <div class="metrics-row">
        <div class="metric-card">
          <div class="metric-icon-box metric-icon-primary">⏱️</div>
          <div class="metric-info">
            <span class="metric-label">Giờ bạn sử dụng (${monthNames[viewingMonth]})</span>
            <span class="metric-value mono">${formatHours(myTotalMonthHours)}</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box metric-icon-success">⚡</div>
          <div class="metric-info">
            <span class="metric-label">Tổng giờ cả phòng</span>
            <span class="metric-value mono">${formatHours(roomTotalMonthHours)}</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box metric-icon-warning">💰</div>
          <div class="metric-info">
            <span class="metric-label">Tiền bạn cần trả</span>
            <span class="metric-value mono" style="color: var(--accent-warning);">
              ${estimatedMyBill !== null ? formatVND(estimatedMyBill) : (monthlyBill ? '0 ₫' : 'Chưa có hóa đơn')}
            </span>
          </div>
        </div>
      </div>

      <!-- Lưới lịch biểu & Bảng khai báo giờ -->
      <div class="calendar-layout">
        <!-- Calendar Main Grid -->
        <div class="calendar-card">
          <div class="calendar-nav">
            <h3 class="calendar-month-title">${monthLabel}</h3>
            <div class="calendar-nav-controls">
              <button class="btn btn-secondary btn-icon" id="cal-prev-month" title="Tháng trước">◀</button>
              <button class="btn btn-secondary btn-sm" id="cal-today-btn">Hôm nay</button>
              <button class="btn btn-secondary btn-icon" id="cal-next-month" title="Tháng sau">▶</button>
            </div>
          </div>

          <div class="calendar-grid-header">
            <div>CN</div><div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div>
          </div>

          <div class="calendar-grid-body" id="calendar-days-grid">
            <!-- Render các ngày bằng JavaScript -->
          </div>
        </div>

        <!-- Chi tiết ngày được chọn & Form khai báo -->
        <div class="day-panel" id="day-detail-panel">
          <!-- Render thông tin chi tiết ngày -->
        </div>
      </div>
    </div>
  `;

  // Render các ô ngày trong tháng
  renderCalendarDaysGrid(user.id);

  // Render chi tiết ngày đang chọn
  await renderDayDetail(user.id, room.id);

  // Gắn sự kiện chuyển tháng
  document.getElementById('cal-prev-month')?.addEventListener('click', () => {
    viewingMonth--;
    if (viewingMonth < 0) {
      viewingMonth = 11;
      viewingYear--;
    }
    renderCalendarView();
  });

  document.getElementById('cal-next-month')?.addEventListener('click', () => {
    viewingMonth++;
    if (viewingMonth > 11) {
      viewingMonth = 0;
      viewingYear++;
    }
    renderCalendarView();
  });

  document.getElementById('cal-today-btn')?.addEventListener('click', () => {
    const today = new Date();
    viewingYear = today.getFullYear();
    viewingMonth = today.getMonth();
    selectedDateStr = formatDateKey(today);
    renderCalendarView();
  });
}

function renderCalendarDaysGrid(userId) {
  const grid = document.getElementById('calendar-days-grid');
  if (!grid) return;

  const firstDayOfWeek = new Date(viewingYear, viewingMonth, 1).getDay(); // 0 = CN, 1 = T2,...
  const totalDaysInMonth = new Date(viewingYear, viewingMonth + 1, 0).getDate();

  const todayStr = formatDateKey(new Date());
  const userMonthData = currentMonthUsages[userId] || {};

  let html = '';

  // Ô trống đầu tháng
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += `<div class="calendar-day day-empty"></div>`;
  }

  // Các ngày trong tháng
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const mStr = String(viewingMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateKey = `${viewingYear}-${mStr}-${dStr}`;

    const isToday = dateKey === todayStr;
    const isSelected = dateKey === selectedDateStr;
    const isFuture = dateKey > todayStr;

    const daySlots = userMonthData[dateKey] || [];
    let dayHours = 0;
    daySlots.forEach(s => dayHours += (s.hours || 0));

    let classes = ['calendar-day'];
    if (isToday) classes.push('day-today');
    if (isSelected) classes.push('day-selected');
    if (isFuture) classes.push('day-future');

    html += `
      <div class="${classes.join(' ')}" data-date="${dateKey}">
        <div class="day-header">
          <span class="day-number">${day}</span>
          ${isToday ? '<span style="font-size: 0.65rem; color: var(--accent-secondary); font-weight: 700;">HÔM NAY</span>' : ''}
        </div>
        ${dayHours > 0 ? `
          <div class="day-badge mono">${formatHours(dayHours)}</div>
        ` : ''}
      </div>
    `;
  }

  grid.innerHTML = html;

  // Gắn sự kiện chọn ngày
  grid.querySelectorAll('.calendar-day:not(.day-empty):not(.day-future)').forEach(el => {
    el.addEventListener('click', async () => {
      const clickedDate = el.getAttribute('data-date');
      selectedDateStr = clickedDate;

      // Cập nhật class active
      grid.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('day-selected'));
      el.classList.add('day-selected');

      const user = getCurrentUser();
      const room = getCurrentRoom();
      if (user && room) {
        await renderDayDetail(user.id, room.id);
      }
    });
  });
}

async function renderDayDetail(userId, roomId) {
  const panel = document.getElementById('day-detail-panel');
  if (!panel || !selectedDateStr) return;

  const [y, m, d] = selectedDateStr.split('-');
  const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const formattedDateTitle = `${dayNames[dateObj.getDay()]}, ${d}/${m}/${y}`;

  // Lấy danh sách khung giờ của ngày này
  currentDaySlots = await getUserDaySlots(roomId, userId, selectedDateStr);
  
  let dayTotalHours = 0;
  currentDaySlots.forEach(s => dayTotalHours += (s.hours || 0));

  panel.innerHTML = `
    <div class="day-panel-header">
      <div>
        <h4 class="day-panel-title">${formattedDateTitle}</h4>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Khai báo khung giờ dùng điện</div>
      </div>
      <div class="day-total-tag mono">Tổng: ${formatHours(dayTotalHours)}</div>
    </div>

    <!-- Danh sách khung giờ đã thêm -->
    <div class="slots-list" id="slots-list-box">
      ${currentDaySlots.length === 0 ? `
        <div class="no-slots-notice">
          Chưa có khung giờ nào được ghi nhận cho ngày này. Hãy thêm giờ ở bên dưới!
        </div>
      ` : currentDaySlots.map((slot, idx) => `
        <div class="slot-item">
          <div class="slot-times">
            <span>🕒</span>
            <span class="mono">${slot.start} — ${slot.end}</span>
            <span class="slot-duration mono">(${formatHours(slot.hours)})</span>
          </div>
          <button class="btn btn-ghost btn-sm slot-delete-btn" data-index="${idx}" title="Xóa khung giờ này">
            🗑️
          </button>
        </div>
      `).join('')}
    </div>

    <!-- Form khai báo khung giờ mới -->
    <div class="slot-form-box">
      <div class="slot-form-title">➕ Thêm khoảng thời gian sử dụng</div>
      
      <div class="slot-inputs-row">
        <input type="time" id="slot-start-time" class="form-input mono" required />
        <span class="slot-separator">—</span>
        <input type="time" id="slot-end-time" class="form-input mono" required />
      </div>

      <div id="slot-error-msg" class="slot-validation-msg"></div>

      <button type="button" id="btn-add-slot" class="btn btn-primary btn-sm" style="width: 100%;">
        Lưu khung giờ
      </button>
    </div>
  `;

  // Xử lý thêm khung giờ
  document.getElementById('btn-add-slot')?.addEventListener('click', async () => {
    const startVal = document.getElementById('slot-start-time').value;
    const endVal = document.getElementById('slot-end-time').value;
    const errorEl = document.getElementById('slot-error-msg');

    // Kiểm tra tính hợp lệ và các ngoại lệ
    const check = validateTimeSlot(startVal, endVal, currentDaySlots, selectedDateStr);
    if (!check.valid) {
      errorEl.textContent = check.message;
      errorEl.classList.add('visible');
      return;
    }

    errorEl.classList.remove('visible');
    const slotHours = calculateSlotHours(startVal, endVal);

    currentDaySlots.push({
      start: startVal,
      end: endVal,
      hours: slotHours
    });

    // Sắp xếp các khung giờ theo thứ tự tăng dần
    currentDaySlots.sort((a, b) => a.start.localeCompare(b.start));

    await saveDaySlots(roomId, userId, selectedDateStr, currentDaySlots);
    showToast(`Đã ghi nhận: ${startVal} - ${endVal} (${formatHours(slotHours)})`, 'success');

    // Render lại toàn bộ lịch để cập nhật các chỉ số tổng
    await renderCalendarView();
  });

  // Xử lý xóa khung giờ
  panel.querySelectorAll('.slot-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      currentDaySlots.splice(idx, 1);
      await saveDaySlots(roomId, userId, selectedDateStr, currentDaySlots);
      showToast('Đã xóa khung giờ!', 'info');
      await renderCalendarView();
    });
  });
}
