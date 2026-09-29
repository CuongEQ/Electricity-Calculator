import { 
  getMonthUsages, 
  updateMonthlyBill, 
  updateMonthlyCalcMode,
  extractDayUsage,
  getUserById 
} from './storage-service.js';
import { getCurrentUser } from './auth.js';
import { getCurrentRoom, fetchCurrentRoom } from './room.js';
import { formatVND, formatHours, showToast, openModal, closeModal } from './ui.js';

let statsYear = new Date().getFullYear();
let statsMonth = new Date().getMonth(); // 0-indexed

export function initStats() {
  const today = new Date();
  statsYear = today.getFullYear();
  statsMonth = today.getMonth();
}

function getStatsMonthKey() {
  const m = String(statsMonth + 1).padStart(2, '0');
  return `${statsYear}-${m}`;
}

const PALETTE = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b', 
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'
];

export async function renderStatsView() {
  const container = document.getElementById('stats-view-content');
  if (!container) return;

  const user = getCurrentUser();
  const room = await fetchCurrentRoom();

  if (!room) {
    container.innerHTML = `
      <div class="card text-center" style="padding: 48px 24px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 16px;">🏠</div>
        <h3 style="font-size: 1.35rem; margin-bottom: 8px;">Bạn chưa tham gia phòng nào</h3>
        <p style="color: var(--text-muted);">Vui lòng tạo hoặc tham gia phòng để xem thống kê.</p>
      </div>
    `;
    return;
  }

  // Kiểm tra quyền Quản lý
  const isAdmin = room.adminId === user.id;
  if (!isAdmin) {
    container.innerHTML = `
      <div class="card text-center" style="padding: 48px 24px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 16px;">🔒</div>
        <h3 style="font-size: 1.35rem; margin-bottom: 8px;">Khu vực dành cho Quản lý phòng</h3>
        <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto;">
          Chỉ người quản trị phòng (${room.name}) mới có quyền nhập hóa đơn tiền điện cả phòng, cấu hình cách tính (ngày/giờ) và xem phân bổ chi tiết của toàn bộ thành viên.
        </p>
      </div>
    `;
    return;
  }

  const monthKey = getStatsMonthKey();
  const usages = await getMonthUsages(room.id, monthKey);

  // Chế độ tính toán của tháng: 'hours' (mặc định) hoặc 'days'
  const calcMode = (room.monthlyCalcModes && room.monthlyCalcModes[monthKey]) || 'hours';
  const isDayMode = calcMode === 'days';

  // Lấy danh sách thành viên
  const memberList = await Promise.all(
    room.members.map(async (mId) => {
      const u = await getUserById(mId);
      return u || { id: mId, displayName: 'Thành viên', username: 'user' };
    })
  );

  let totalRoomUsage = 0; // Tổng giờ hoặc tổng ngày cả phòng
  const memberStats = memberList.map((m, idx) => {
    const userDays = usages[m.id] || {};
    let memberValue = 0;

    if (isDayMode) {
      // Đếm số ngày có sử dụng điện
      Object.keys(userDays).forEach(dKey => {
        const usage = extractDayUsage(userDays[dKey]);
        if (usage.used || (usage.slots && usage.slots.length > 0)) {
          memberValue += 1;
        }
      });
    } else {
      // Đếm tổng số giờ sử dụng
      Object.keys(userDays).forEach(dKey => {
        const usage = extractDayUsage(userDays[dKey]);
        usage.slots.forEach(s => {
          memberValue += (s.hours || 0);
        });
      });
    }

    totalRoomUsage += memberValue;
    return {
      user: m,
      value: memberValue,
      color: PALETTE[idx % PALETTE.length]
    };
  });

  // Tiền điện cả phòng của tháng này
  const currentBill = (room.monthlyBills && room.monthlyBills[monthKey]) ? room.monthlyBills[monthKey] : 0;

  // Tính tiền & phần trăm từng thành viên
  const calculatedStats = memberStats.map(item => {
    const percentage = totalRoomUsage > 0 ? (item.value / totalRoomUsage) * 100 : 0;
    // Công thức: Tiền mỗi người = (Tiền cả phòng / Tổng đơn vị cả phòng) * Đơn vị mỗi người
    const billToPay = totalRoomUsage > 0 ? (currentBill / totalRoomUsage) * item.value : 0;

    return {
      ...item,
      percentage,
      billToPay
    };
  });

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];
  const monthTitle = `${monthNames[statsMonth]}, ${statsYear}`;

  container.innerHTML = `
    <div class="stats-container animate-fade">
      <!-- Bộ chọn tháng thống kê -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <h2 style="font-size: 1.4rem; font-weight: 800;">
          📊 Thống Kê & Tính Tiền Điện Phòng: <span class="text-gradient">${room.name}</span>
        </h2>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="btn btn-secondary btn-icon" id="stats-prev-month">◀</button>
          <span style="font-weight: 700; font-size: 1.05rem; padding: 0 8px;">${monthTitle}</span>
          <button class="btn btn-secondary btn-icon" id="stats-next-month">▶</button>
        </div>
      </div>

      <!-- Cấu hình Chế độ tính tiền tháng (Theo Giờ hoặc Theo Ngày) -->
      <div class="card" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: 18px 24px; border-left: 4px solid var(--accent-primary);">
        <div>
          <div style="font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>⚙️</span> Phương thức tính tiền: <span class="text-gradient">${monthTitle}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 3px;">
            ${isDayMode 
              ? '📅 <strong>Tính theo Ngày:</strong> Mỗi ngày thành viên có sử dụng tính là 1 ngày.' 
              : '⏱️ <strong>Tính theo Giờ:</strong> Tính chi tiết theo khoảng thời gian thực tế khai báo.'}
          </div>
        </div>

        <div style="display: flex; background: var(--bg-input); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <button 
            type="button" 
            id="btn-mode-hours" 
            class="btn btn-sm ${!isDayMode ? 'btn-primary' : 'btn-ghost'}"
            style="border-radius: var(--radius-sm);"
          >
            ⏱️ Tính theo Giờ
          </button>
          <button 
            type="button" 
            id="btn-mode-days" 
            class="btn btn-sm ${isDayMode ? 'btn-primary' : 'btn-ghost'}"
            style="border-radius: var(--radius-sm);"
          >
            📅 Tính theo Ngày
          </button>
        </div>
      </div>

      <!-- Card Nhập hóa đơn cả phòng trong tháng -->
      <div class="bill-input-card">
        <div>
          <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">
            Hóa đơn tiền điện cả phòng (${monthTitle})
          </div>
          <div style="font-size: 1.75rem; font-weight: 800; color: var(--accent-warning); margin-top: 4px;" class="mono">
            ${currentBill > 0 ? formatVND(currentBill) : 'Chưa nhập hóa đơn'}
          </div>
        </div>

        <form id="form-update-bill" class="bill-input-group">
          <input 
            type="number" 
            id="input-monthly-bill" 
            class="form-input bill-amount-input" 
            placeholder="Số tiền VNĐ..." 
            value="${currentBill || ''}" 
            min="0" 
            step="1000"
            required 
          />
          <button type="submit" class="btn btn-primary">
            💾 Lưu hóa đơn tháng
          </button>
        </form>
      </div>

      <!-- Biểu đồ phân bổ tỷ lệ phần trăm sử dụng điện -->
      <div class="distribution-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.1rem; font-weight: 700;">
            Phân bố phần trăm sử dụng điện (${isDayMode ? 'Theo ngày' : 'Theo giờ'})
          </h3>
          <span class="mono" style="font-size: 0.9rem; color: var(--text-secondary);">
            Tổng cả phòng: <strong>${isDayMode ? `${totalRoomUsage} ngày` : `${formatHours(totalRoomUsage)} (${totalRoomUsage.toFixed(1)}h)`}</strong>
          </span>
        </div>

        ${totalRoomUsage === 0 ? `
          <div style="padding: 24px; text-align: center; color: var(--text-muted); background: var(--bg-input); border-radius: var(--radius-md);">
            Chưa có thành viên nào khai báo dữ liệu trong tháng này.
          </div>
        ` : `
          <!-- Thanh phân bổ tỷ lệ -->
          <div class="dist-bar-wrapper">
            ${calculatedStats.map(item => `
              <div 
                class="dist-segment" 
                style="width: ${item.percentage}%; background-color: ${item.color};"
                title="${item.user.displayName}: ${item.percentage.toFixed(1)}% (${isDayMode ? `${item.value} ngày` : formatHours(item.value)})"
              ></div>
            `).join('')}
          </div>

          <!-- Chú thích người dùng -->
          <div class="dist-legend">
            ${calculatedStats.map(item => `
              <div class="legend-item">
                <span class="legend-color-dot" style="background-color: ${item.color};"></span>
                <span>${item.user.displayName}: <strong>${item.percentage.toFixed(1)}%</strong> (${isDayMode ? `${item.value} ngày` : formatHours(item.value)})</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Bảng chi tiết từng thành viên -->
      <div class="stats-table-card">
        <table class="stats-table">
          <thead>
            <tr>
              <th>Thành viên</th>
              <th>${isDayMode ? 'Tổng ngày sử dụng' : 'Tổng giờ sử dụng'}</th>
              <th>Tỉ lệ %</th>
              <th style="text-align: right;">Tiền điện phải trả</th>
            </tr>
          </thead>
          <tbody>
            ${calculatedStats.map(item => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="avatar" style="width: 32px; height: 32px; font-size: 0.85rem; background: ${item.color};">
                      ${item.user.displayName ? item.user.displayName.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <div style="font-weight: 600;">${item.user.displayName}</div>
                      <div style="font-size: 0.775rem; color: var(--text-muted);">@${item.user.username}</div>
                    </div>
                  </div>
                </td>
                <td class="mono">
                  ${isDayMode ? `<strong>${item.value}</strong> ngày` : `${formatHours(item.value)} <span style="color: var(--text-muted); font-size: 0.85rem;">(${item.value.toFixed(1)}h)</span>`}
                </td>
                <td>
                  <span class="rate-badge">${item.percentage.toFixed(1)}%</span>
                </td>
                <td style="text-align: right;">
                  <span class="amount-highlight">${formatVND(item.billToPay)}</span>
                </td>
              </tr>
            `).join('')}

            <!-- Hàng tổng cộng -->
            <tr class="total-row">
              <td>TỔNG CỘNG CẢ PHÒNG</td>
              <td class="mono">
                ${isDayMode ? `<strong>${totalRoomUsage}</strong> ngày` : `${formatHours(totalRoomUsage)} (${totalRoomUsage.toFixed(1)}h)`}
              </td>
              <td>100.0%</td>
              <td style="text-align: right;" class="mono amount-highlight">
                ${formatVND(currentBill)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Công thức minh bạch -->
      <div style="padding: 16px 20px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-muted);">
        💡 <strong>Công thức tính tiền ${isDayMode ? '(theo ngày)' : '(theo giờ)'}:</strong> 
        <code>Tiền mỗi người = (Tiền điện cả phòng / Tổng ${isDayMode ? 'ngày' : 'giờ'} cả phòng) × Tổng ${isDayMode ? 'ngày' : 'giờ'} mỗi người</code>
      </div>
    </div>
  `;

  // Xử lý modal cảnh báo xác nhận chuyển đổi chế độ
  const closeBtn = document.getElementById('btn-close-switch-modal');
  const cancelBtn = document.getElementById('btn-cancel-switch-mode');
  const confirmBtn = document.getElementById('btn-confirm-switch-mode');
  const descEl = document.getElementById('switch-modal-desc');

  let targetMode = null;
  let targetText = '';

  const triggerModal = (mode, text, fromText) => {
    targetMode = mode;
    targetText = text;
    if (descEl) {
      descEl.innerHTML = `Bạn đang yêu cầu chuyển đổi phương thức tính tiền của <strong>${monthTitle}</strong> từ <strong>${fromText}</strong> sang <strong>${targetText}</strong>.`;
    }
    openModal('modal-confirm-switch-mode');
  };

  closeBtn.onclick = () => closeModal('modal-confirm-switch-mode');
  cancelBtn.onclick = () => closeModal('modal-confirm-switch-mode');

  confirmBtn.onclick = async () => {
    if (!targetMode) return;
    closeModal('modal-confirm-switch-mode');
    try {
      // updateMonthlyCalcMode với resetData = true để xóa toàn bộ dữ liệu đã nhập trước đó trong tháng
      await updateMonthlyCalcMode(room.id, monthKey, targetMode, true);
      showToast(`Đã chuyển sang ${targetText} và làm mới dữ liệu tháng ${monthTitle}!`, 'success');
      await renderStatsView();
    } catch (err) {
      showToast(err.message || 'Lỗi khi chuyển đổi cách tính!', 'error');
    }
  };

  // Gắn sự kiện mở modal chuyển chế độ
  document.getElementById('btn-mode-hours')?.addEventListener('click', () => {
    if (!isDayMode) return;
    triggerModal('hours', 'Tính theo Giờ', 'Tính theo Ngày');
  });

  document.getElementById('btn-mode-days')?.addEventListener('click', () => {
    if (isDayMode) return;
    triggerModal('days', 'Tính theo Ngày', 'Tính theo Giờ');
  });

  // Gắn sự kiện lưu hóa đơn
  document.getElementById('form-update-bill')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amountVal = document.getElementById('input-monthly-bill').value;
    const amount = parseFloat(amountVal);
    if (isNaN(amount) || amount < 0) {
      showToast('Vui lòng nhập số tiền hợp lệ!', 'error');
      return;
    }

    try {
      await updateMonthlyBill(room.id, monthKey, amount);
      showToast(`Đã lưu tiền điện tháng ${monthTitle}: ${formatVND(amount)}`, 'success');
      await renderStatsView();
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật tiền điện!', 'error');
    }
  });

  // Chuyển tháng
  document.getElementById('stats-prev-month')?.addEventListener('click', () => {
    statsMonth--;
    if (statsMonth < 0) {
      statsMonth = 11;
      statsYear--;
    }
    renderStatsView();
  });

  document.getElementById('stats-next-month')?.addEventListener('click', () => {
    statsMonth++;
    if (statsMonth > 11) {
      statsMonth = 0;
      statsYear++;
    }
    renderStatsView();
  });
}
