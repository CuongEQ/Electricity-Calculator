/**
 * Chuồng boà — Trang đặc quyền dành riêng cho tài khoản "bezit" (🐮 & 🪿)
 * Bao gồm:
 * 1. Toàn bộ thông tin & quyền hạn quản lý phòng (Duyệt/từ chối, đuổi thành viên, cài đặt hóa đơn, đổi cách tính)
 * 2. Soi chi tiết toàn bộ khung giờ đã khai báo từng ngày của mỗi thành viên trên lịch biểu trực quan
 */

import {
  getRoomById,
  getUserById,
  getMonthUsages,
  extractDayUsage,
  approveJoinRequest,
  rejectJoinRequest,
  removeMemberFromRoom,
  leaveRoom,
  updateMonthlyBill,
  updateMonthlyCalcMode
} from './storage-service.js';
import { getCurrentUser, refreshCurrentUser } from './auth.js';
import { fetchCurrentRoom, getCurrentRoom } from './room.js';
import {
  formatVND,
  formatHours,
  showToast,
  openModal,
  closeModal,
  formatNumberWithSeparators,
  parseFormattedNumber,
  copyToClipboard
} from './ui.js';
import { isBezit, showBezitEasterEgg } from './easter-egg.js';
import { navigateTo } from './app.js';

// State nội bộ của trang Chuồng boà
let corralYear = new Date().getFullYear();
let corralMonth = new Date().getMonth(); // 0-indexed (0 = Jan)
let selectedMemberId = 'all'; // 'all' hoặc userId cụ thể
let selectedDateStr = formatDateKey(new Date()); // 'YYYY-MM-DD'
let activeCorralTab = 'schedule'; // 'schedule' (Soi lịch) | 'manage' (Quản trị phòng)

function formatDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCorralMonthKey() {
  const m = String(corralMonth + 1).padStart(2, '0');
  return `${corralYear}-${m}`;
}

const PALETTE = [
  '#ec4899', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#6366f1', '#14b8a6', '#f97316'
];

/**
 * Hàm khởi chạy render chính của trang Chuồng boà
 */
export async function renderBezitCorralView() {
  const container = document.getElementById('bezit-corral-content');
  if (!container) return;

  const currentUser = getCurrentUser();

  // Kiểm tra bảo mật: Chỉ cho phép tài khoản bezit
  if (!currentUser || !isBezit(currentUser)) {
    container.innerHTML = `
      <div class="card text-center" style="padding: 48px 24px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 16px;">🚫</div>
        <h3 style="font-size: 1.35rem; margin-bottom: 8px;">Khu vực đặc quyền hạn chế</h3>
        <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 20px auto;">
          Trang "Chuồng boà" chỉ dành riêng cho tài khoản <strong>bezit</strong>.
        </p>
        <button class="btn btn-primary" id="btn-corral-go-home">
          Quay lại Lịch biểu
        </button>
      </div>
    `;
    document.getElementById('btn-corral-go-home')?.addEventListener('click', () => {
      navigateTo('calendar');
    });
    return;
  }

  // Cập nhật Topbar
  const topbarTitle = document.querySelector('.topbar-title');
  if (topbarTitle) {
    topbarTitle.textContent = '🐮 Chuồng boà';
  }

  const room = await fetchCurrentRoom();

  // Nếu Bezit chưa vào phòng nào
  if (!room) {
    container.innerHTML = `
      <div class="bezit-corral-container">
        <!-- Banner Header -->
        <div class="corral-header-banner">
          <div class="corral-header-left">
            <div class="corral-logo-badge">🐮</div>
            <div class="corral-title-group">
              <h2>Chuồng boà — Khu vực đặc quyền cho bé Zịt bự</h2>
              <div class="corral-subtitle">Nơi Boà 🐮 và Zịt 🪿 quản trị tối cao & soi từng khung giờ</div>
            </div>
          </div>
        </div>

        <div class="card text-center" style="padding: 48px 24px; text-align: center;">
          <div style="font-size: 3.5rem; margin-bottom: 16px;">🏡</div>
          <h3 style="font-size: 1.35rem; margin-bottom: 8px;">Bạn chưa tham gia phòng nào!</h3>
          <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 24px auto;">
            Hãy tạo phòng mới hoặc tham gia phòng để "Chuồng boà" kích hoạt toàn bộ quyền hạn quản lý và theo dõi khung giờ của các thành viên nhé!
          </p>
          <button class="btn btn-primary" id="btn-corral-to-room">
            👉 Đến Quản lý phòng ngay
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-corral-egg')?.addEventListener('click', showBezitEasterEgg);
    document.getElementById('btn-corral-to-room')?.addEventListener('click', () => {
      navigateTo('room');
    });
    return;
  }

  // Lấy chi tiết thông tin các thành viên
  const memberDetails = await Promise.all(
    room.members.map(async (mId) => {
      const u = await getUserById(mId);
      return u || { id: mId, displayName: 'Thành viên', username: 'user' };
    })
  );

  const monthKey = getCorralMonthKey();
  const monthUsages = await getMonthUsages(room.id, monthKey);

  // Chế độ tính toán của tháng: 'hours' hoặc 'days'
  const calcMode = (room.monthlyCalcModes && room.monthlyCalcModes[monthKey]) || 'hours';
  const isDayMode = calcMode === 'days';
  const currentBill = (room.monthlyBills && room.monthlyBills[monthKey]) || 0;

  // Tính toán số liệu từng thành viên trong tháng
  let roomTotalUsage = 0;
  const memberMetrics = {};

  memberDetails.forEach(m => {
    const userDays = monthUsages[m.id] || {};
    let mTotal = 0;
    let daysWithUsage = 0;

    Object.keys(userDays).forEach(dKey => {
      const usage = extractDayUsage(userDays[dKey]);
      if (isDayMode) {
        if (usage.used || (usage.slots && usage.slots.length > 0)) {
          mTotal += 1;
          daysWithUsage += 1;
        }
      } else {
        if (usage.slots && usage.slots.length > 0) {
          daysWithUsage += 1;
          usage.slots.forEach(s => {
            mTotal += (s.hours || 0);
          });
        }
      }
    });

    memberMetrics[m.id] = {
      total: mTotal,
      daysCount: daysWithUsage
    };

    roomTotalUsage += mTotal;
  });

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];
  const monthTitle = `${monthNames[corralMonth]}, ${corralYear}`;

  // Lấy admin info
  const adminMember = memberDetails.find(m => m.id === room.adminId);
  const adminUsername = adminMember ? adminMember.username : 'admin';
  const isUserAdmin = room.adminId === currentUser.id;

  // Render Template chính của trang
  container.innerHTML = `
    <div class="bezit-corral-container">
      <!-- 1. Header Banner -->
      <div class="corral-header-banner">
        <div class="corral-header-left">
          <div class="corral-logo-badge">🐮</div>
          <div class="corral-title-group">
            <h2>Chuồng boà — Khu vực đặc quyền cho bé Zịt bự</h2>
            <div class="corral-subtitle">Ngồi lên đầu boà bự để quản lí phòng và cùng boà con ngóng lịch của toàn bộ thành viên</div>
          </div>
        </div>
      </div>

      <!-- 2. Navigation Tabs giữa Soi Lịch & Quản Trị -->
      <div class="corral-nav-tabs">
        <button class="corral-tab-btn ${activeCorralTab === 'schedule' ? 'active' : ''}" id="tab-corral-schedule">
          <span>📅</span> Soi lịch biểu & Khung giờ thành viên
        </button>
        <button class="corral-tab-btn ${activeCorralTab === 'manage' ? 'active' : ''}" id="tab-corral-manage">
          <span>⚙️</span> Quản lý phòng & Hóa đơn
          ${(room.pendingRequests && room.pendingRequests.length > 0) ? `
            <span class="badge badge-warning" style="font-size: 0.7rem; padding: 2px 6px;">${room.pendingRequests.length}</span>
          ` : ''}
        </button>
      </div>

      <!-- 3. Tab 1 Content: Soi Lịch Biểu & Khung Giờ Chi Tiết -->
      <div id="corral-schedule-section" class="${activeCorralTab === 'schedule' ? '' : 'hidden'}">
        <!-- Bộ chọn thành viên (Member Selector Pills) -->
        <div class="corral-members-selector-box">
          <div class="corral-selector-header">
            <span class="corral-selector-title">
              <span>🔍</span> Chọn thành viên cần boà con đi ngóng:
            </span>
          </div>

          <div class="corral-members-pill-list" id="corral-member-pills">
            <!-- Pill: Tất cả thành viên -->
            <div class="corral-member-pill ${selectedMemberId === 'all' ? 'active' : ''}" data-member-id="all">
              <div class="pill-avatar" style="background: linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%);">🌟</div>
              <span class="pill-name">Tất cả thành viên</span>
              <span class="pill-usage-badge">${isDayMode ? `${roomTotalUsage}d` : formatHours(roomTotalUsage)}</span>
            </div>

            <!-- Từng thành viên -->
            ${memberDetails.map(m => {
    const uMetric = memberMetrics[m.id] || { total: 0, daysCount: 0 };
    const isSelected = selectedMemberId === m.id;
    const isBezitSelf = m.username.toLowerCase() === 'bezit';

    return `
                <div class="corral-member-pill ${isSelected ? 'active' : ''}" data-member-id="${m.id}">
                  <div class="pill-avatar">${isBezitSelf ? '🐮' : (m.displayName ? m.displayName.charAt(0).toUpperCase() : '?')}</div>
                  <span class="pill-name">${m.displayName} ${isBezitSelf ? '(Bezit)' : ''}</span>
                  <span class="pill-usage-badge">${isDayMode ? `${uMetric.total}d` : formatHours(uMetric.total)}</span>
                </div>
              `;
  }).join('')}
          </div>
        </div>

        <!-- Metric banner cho đối tượng đang xem -->
        <div class="corral-metric-bar" style="margin-top: 16px;" id="corral-active-stats-bar">
          <!-- Sẽ được điền dữ liệu -->
        </div>

        <!-- Lưới Lịch & Bảng soi khung giờ -->
        <div class="corral-calendar-layout" style="margin-top: 16px;">
          <!-- Cột Trái: Calendar Grid -->
          <div class="corral-calendar-card">
            <div class="calendar-nav">
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 class="calendar-month-title">${monthTitle}</h3>
                <span class="badge ${isDayMode ? 'badge-primary' : 'badge-success'}" style="font-size: 0.725rem;">
                  ${isDayMode ? '📅 Tính theo Ngày' : '⏱️ Tính theo Giờ'}
                </span>
              </div>
              <div class="calendar-nav-controls">
                <button class="btn btn-secondary btn-icon" id="corral-cal-prev" title="Tháng trước">◀</button>
                <button class="btn btn-secondary btn-sm" id="corral-cal-today">Hôm nay</button>
                <button class="btn btn-secondary btn-icon" id="corral-cal-next" title="Tháng sau">▶</button>
              </div>
            </div>

            <div class="corral-calendar-grid-header">
              <div>CN</div><div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div>
            </div>

            <div class="corral-calendar-grid-body" id="corral-calendar-days-grid">
              <!-- Render ô ngày -->
            </div>
          </div>

          <!-- Cột Phải: Bảng soi chi tiết khung giờ ngày đã chọn -->
          <div class="corral-inspector-panel" id="corral-day-inspector-panel">
            <!-- Render chi tiết khung giờ ngày đã chọn -->
          </div>
        </div>

        <!-- Bảng Ma Trận & Thống Kê Tổng Hợp Cả Tháng Của Từng Thành Viên -->
        <div class="corral-summary-table-card" style="margin-top: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <h3 style="font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <span>📊</span> Bảng tổng hợp chi tiết tháng (${monthTitle})
            </h3>
            <span style="font-size: 0.85rem; color: var(--text-muted);">
              Nhấp vào một dòng để chuyển lịch sang thành viên đó
            </span>
          </div>

          <div class="corral-table-wrapper">
            <table class="corral-summary-table">
              <thead>
                <tr>
                  <th>Thành viên</th>
                  <th>${isDayMode ? 'Số ngày sử dụng' : 'Tổng số giờ'}</th>
                  <th>Số ngày có dùng</th>
                  <th>Tỷ lệ (%)</th>
                  <th style="text-align: right;">Tiền điện tạm tính</th>
                  <th style="text-align: center;">Hành động</th>
                </tr>
              </thead>
              <tbody>
                ${memberDetails.map((m, idx) => {
    const uMetric = memberMetrics[m.id] || { total: 0, daysCount: 0 };
    const pct = roomTotalUsage > 0 ? (uMetric.total / roomTotalUsage) * 100 : 0;
    const estimatedBill = (roomTotalUsage > 0 && currentBill > 0) ? (currentBill / roomTotalUsage) * uMetric.total : 0;
    const isRowActive = selectedMemberId === m.id;
    const isBezit = m.username.toLowerCase() === 'bezit';

    return `
                    <tr class="corral-member-row ${isRowActive ? 'active' : ''}" data-member-id="${m.id}" style="cursor: pointer;">
                      <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <div class="avatar" style="width: 32px; height: 32px; font-size: 0.85rem; background: ${PALETTE[idx % PALETTE.length]}; color: white;">
                            ${isBezit ? '🐮' : (m.displayName ? m.displayName.charAt(0).toUpperCase() : '?')}
                          </div>
                          <div>
                            <div style="font-weight: 600;">${m.displayName} ${isBezit ? '🐮' : ''}</div>
                            <div style="font-size: 0.775rem; color: var(--text-muted);">@${m.username}</div>
                          </div>
                        </div>
                      </td>
                      <td class="mono font-semibold" style="color: var(--accent-primary);">
                        ${isDayMode ? `${uMetric.total} ngày` : formatHours(uMetric.total)}
                      </td>
                      <td class="mono">${uMetric.daysCount} ngày</td>
                      <td>
                        <span class="badge" style="background: rgba(236, 72, 153, 0.15); color: #ec4899; font-weight: 700;">
                          ${pct.toFixed(1)}%
                        </span>
                      </td>
                      <td style="text-align: right;" class="mono amount-highlight">
                        ${formatVND(estimatedBill)}
                      </td>
                      <td style="text-align: center;">
                        <button class="btn btn-xs btn-secondary btn-inspect-member" data-member-id="${m.id}">
                          🔍 Soi lịch
                        </button>
                      </td>
                    </tr>
                  `;
  }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 5. Tab 2 Content: Quản trị phòng & Hóa đơn (Role Quản Lý) -->
      <div id="corral-manage-section" class="${activeCorralTab === 'manage' ? '' : 'hidden'}">
        <!-- Lưới quản trị -->
        <div class="corral-controls-grid">
          <!-- Cài đặt hóa đơn tiền điện -->
          <div class="card">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
              <span>💰</span> Hóa đơn tiền điện (${monthTitle})
            </h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">
              Nhập số tiền điện tổng của cả phòng trong tháng này để tự động tính toán tiền điện chi tiết cho từng người.
            </p>

            <form id="corral-form-bill" style="display: flex; flex-direction: column; gap: 12px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="corral-bill-input">Số tiền (VNĐ)</label>
                <div style="position: relative; display: flex; align-items: center;">
                  <input 
                    type="text" 
                    id="corral-bill-input" 
                    class="form-input mono" 
                    placeholder="VD: 850.000" 
                    value="${currentBill > 0 ? formatNumberWithSeparators(currentBill) : ''}" 
                    style="padding-right: 36px; font-size: 1.1rem; font-weight: 700;"
                    required 
                  />
                  <span style="position: absolute; right: 12px; font-weight: 700; color: var(--text-muted);">₫</span>
                </div>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">
                💾 Lưu hóa đơn tiền điện tháng
              </button>
            </form>
          </div>

          <!-- Chuyển đổi phương thức tính tiền -->
          <div class="card">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
              <span>⚙️</span> Phương thức tính tiền điện
            </h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">
              Chọn cách phân bổ tiền điện của phòng theo thời gian sử dụng thực tế trong tháng ${monthTitle}.
            </p>

            <div style="display: flex; gap: 10px; margin-bottom: 16px;">
              <button 
                type="button" 
                id="btn-corral-mode-hours" 
                class="btn ${!isDayMode ? 'btn-primary' : 'btn-secondary'}" 
                style="flex: 1;"
              >
                ⏱️ Tính theo Giờ
              </button>
              <button 
                type="button" 
                id="btn-corral-mode-days" 
                class="btn ${isDayMode ? 'btn-primary' : 'btn-secondary'}" 
                style="flex: 1;"
              >
                📅 Tính theo Ngày
              </button>
            </div>
          </div>
        </div>

        <!-- Danh sách yêu cầu chờ duyệt (Pending Requests) -->
        <div class="card requests-card" style="margin-top: 20px;">
          <div class="section-title-row">
            <h3 style="font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
              <span>🔔</span> Yêu cầu tham gia chờ duyệt (${(room.pendingRequests || []).length})
            </h3>
          </div>

          ${(!room.pendingRequests || room.pendingRequests.length === 0) ? `
            <p style="color: var(--text-muted); font-size: 0.9rem;">Hiện không có yêu cầu tham gia nào đang chờ duyệt.</p>
          ` : `
            <div class="requests-list">
              ${room.pendingRequests.map(req => `
                <div class="request-item">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="avatar" style="width: 36px; height: 36px; font-size: 0.9rem;">
                      ${req.displayName ? req.displayName.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <div style="font-weight: 600; font-size: 0.95rem;">${req.displayName}</div>
                      <div style="font-size: 0.775rem; color: var(--text-muted);">
                        @${req.username} • ${new Date(req.requestedAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>
                  <div class="request-actions">
                    <button class="btn btn-sm btn-primary btn-corral-approve" data-id="${req.userId}">Duyệt</button>
                    <button class="btn btn-sm btn-ghost btn-corral-reject" data-id="${req.userId}">Từ chối</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Danh sách thành viên & Quyền quản trị -->
        <div class="card" style="margin-top: 20px;">
          <div class="section-title-row">
            <h3 style="font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
              <span>👥</span> Quản lý thành viên (${room.members.length} / ${room.maxMembers})
            </h3>
          </div>

          <div class="members-list">
            ${memberDetails.map(m => {
    const isMemberAdmin = m.id === room.adminId;
    const isSelf = m.id === currentUser.id;
    const isBezit = m.username.toLowerCase() === 'bezit';

    return `
                <div class="member-card">
                  <div class="member-info">
                    <div class="avatar">${isBezit ? '🐮' : (m.displayName ? m.displayName.charAt(0).toUpperCase() : '?')}</div>
                    <div class="member-names">
                      <div class="member-display">
                        ${m.displayName}
                        ${isBezit ? '<span class="badge" style="background: linear-gradient(135deg, #ff758c, #ff7eb3); color: white; font-size: 0.7rem; margin-left: 4px;">🪿 Bé zịt bự</span>' : ''}
                        ${isSelf && !isBezit ? '<span class="badge badge-primary" style="font-size: 0.7rem; margin-left: 4px;">Bạn</span>' : ''}
                      </div>
                      <div class="member-user">@${m.username}</div>
                    </div>
                  </div>

                  <div class="member-actions">
                    ${isMemberAdmin ? `
                      <span class="badge badge-warning">👑 Quản lý</span>
                    ` : `
                      <span class="badge badge-success">Thành viên</span>
                    `}

                    ${!isMemberAdmin ? `
                      <button class="btn btn-sm btn-danger btn-corral-kick" data-id="${m.id}" data-name="${m.displayName}">
                        Đuổi
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
  }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Render Metric Bar cho Tab Schedule
  renderActiveStatsBar(room, memberDetails, memberMetrics, roomTotalUsage, currentBill, isDayMode, monthTitle);

  // Render Calendar Grid
  renderCorralCalendarGrid(room, memberDetails, monthUsages, isDayMode);

  // Render Day Inspector
  renderDaySlotsInspector(room, memberDetails, monthUsages, isDayMode);

  // Bind Events
  bindCorralEvents(room, memberDetails, monthTitle, isDayMode);
}

/**
 * Hiển thị thanh tóm tắt chỉ số đối tượng đang được soi
 */
function renderActiveStatsBar(room, memberDetails, memberMetrics, roomTotalUsage, currentBill, isDayMode, monthTitle) {
  const bar = document.getElementById('corral-active-stats-bar');
  if (!bar) return;

  if (selectedMemberId === 'all') {
    bar.innerHTML = `
      <div class="metric-card">
        <div class="metric-icon-box metric-icon-primary">🌟</div>
        <div class="metric-info">
          <span class="metric-label">Boà con đang soi</span>
          <span class="metric-value" style="font-size: 1.15rem;">Toàn bộ phòng (${room.members.length} người)</span>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box metric-icon-success">${isDayMode ? '📅' : '⚡'}</div>
        <div class="metric-info">
          <span class="metric-label">Tổng sử dụng cả phòng</span>
          <span class="metric-value mono">${isDayMode ? `${roomTotalUsage} ngày` : formatHours(roomTotalUsage)}</span>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box metric-icon-warning">💰</div>
        <div class="metric-info">
          <span class="metric-label">Hóa đơn điện tháng</span>
          <span class="metric-value mono" style="color: var(--accent-warning);">${currentBill > 0 ? formatVND(currentBill) : 'Chưa nhập'}</span>
        </div>
      </div>
    `;
  } else {
    const target = memberDetails.find(m => m.id === selectedMemberId);
    const uMetric = memberMetrics[selectedMemberId] || { total: 0, daysCount: 0 };
    const pct = roomTotalUsage > 0 ? (uMetric.total / roomTotalUsage) * 100 : 0;
    const est = (roomTotalUsage > 0 && currentBill > 0) ? (currentBill / roomTotalUsage) * uMetric.total : 0;

    bar.innerHTML = `
      <div class="metric-card">
        <div class="metric-icon-box metric-icon-primary">${target?.username.toLowerCase() === 'bezit' ? '🐮' : '👤'}</div>
        <div class="metric-info">
          <span class="metric-label">Đang soi khung giờ của</span>
          <span class="metric-value" style="font-size: 1.15rem;">${target ? target.displayName : 'Thành viên'} (@${target ? target.username : ''})</span>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box metric-icon-success">${isDayMode ? '📅' : '⏱️'}</div>
        <div class="metric-info">
          <span class="metric-label">Sử dụng trong ${monthTitle}</span>
          <span class="metric-value mono">${isDayMode ? `${uMetric.total} ngày` : formatHours(uMetric.total)} (${pct.toFixed(1)}%)</span>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon-box metric-icon-warning">💰</div>
        <div class="metric-info">
          <span class="metric-label">Tiền điện thành viên này</span>
          <span class="metric-value mono" style="color: var(--accent-warning);">${currentBill > 0 ? formatVND(est) : 'Chưa có hóa đơn'}</span>
        </div>
      </div>
    `;
  }
}

/**
 * Render Lưới Lịch (Calendar Grid)
 */
function renderCorralCalendarGrid(room, memberDetails, monthUsages, isDayMode) {
  const grid = document.getElementById('corral-calendar-days-grid');
  if (!grid) return;

  const firstDayOfWeek = new Date(corralYear, corralMonth, 1).getDay();
  const totalDaysInMonth = new Date(corralYear, corralMonth + 1, 0).getDate();
  const todayStr = formatDateKey(new Date());

  let html = '';

  // Ô trống đầu tháng
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += `<div class="corral-day-cell day-empty"></div>`;
  }

  // Các ngày trong tháng
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const mStr = String(corralMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateKey = `${corralYear}-${mStr}-${dStr}`;

    const isToday = dateKey === todayStr;
    const isSelected = dateKey === selectedDateStr;
    const isFuture = dateKey > todayStr;

    let dayContentHtml = '';

    if (selectedMemberId === 'all') {
      // Tổng hợp của tất cả thành viên trong ngày này
      let activeCount = 0;
      let dayRoomHours = 0;

      memberDetails.forEach(m => {
        const uMonth = monthUsages[m.id] || {};
        const usage = extractDayUsage(uMonth[dateKey]);
        if (isDayMode) {
          if (usage.used || (usage.slots && usage.slots.length > 0)) {
            activeCount++;
          }
        } else {
          if (usage.slots && usage.slots.length > 0) {
            activeCount++;
            usage.slots.forEach(s => dayRoomHours += (s.hours || 0));
          }
        }
      });

      if (isDayMode) {
        if (activeCount > 0) {
          dayContentHtml = `
            <div class="corral-day-badges">
              <span class="corral-day-badge-success">${activeCount}/${room.members.length} người</span>
            </div>
          `;
        }
      } else {
        if (dayRoomHours > 0) {
          dayContentHtml = `
            <div class="corral-day-badges">
              <span class="corral-day-badge-primary">∑ ${formatHours(dayRoomHours)}</span>
              <span class="corral-day-badge-count">${activeCount}/${room.members.length} ng</span>
            </div>
          `;
        }
      }
    } else {
      // Đối với 1 thành viên cụ thể
      const uMonth = monthUsages[selectedMemberId] || {};
      const usage = extractDayUsage(uMonth[dateKey]);

      if (isDayMode) {
        const isUsed = usage.used || (usage.slots && usage.slots.length > 0);
        if (isUsed) {
          dayContentHtml = `
            <div class="corral-day-badges">
              <span class="corral-day-badge-success">✓ Đã dùng</span>
            </div>
          `;
        }
      } else {
        let mDayHours = 0;
        (usage.slots || []).forEach(s => mDayHours += (s.hours || 0));
        if (mDayHours > 0) {
          dayContentHtml = `
            <div class="corral-day-badges">
              <span class="corral-day-badge-primary">${formatHours(mDayHours)}</span>
              <span class="corral-day-badge-count">${usage.slots.length} khung</span>
            </div>
          `;
        }
      }
    }

    const classes = ['corral-day-cell'];
    if (isToday) classes.push('day-today');
    if (isSelected) classes.push('day-selected');
    if (isFuture) classes.push('day-future');

    html += `
      <div class="${classes.join(' ')}" data-date="${dateKey}">
        <div class="corral-day-header">
          <span>${day}</span>
          ${isToday ? '<span style="color: var(--accent-secondary); font-size: 0.65rem;">HÔM NAY</span>' : ''}
        </div>
        ${dayContentHtml}
      </div>
    `;
  }

  grid.innerHTML = html;

  // Gắn sự kiện click chọn ngày
  grid.querySelectorAll('.corral-day-cell:not(.day-empty)').forEach(el => {
    el.addEventListener('click', () => {
      const clickedDate = el.getAttribute('data-date');
      selectedDateStr = clickedDate;

      grid.querySelectorAll('.corral-day-cell').forEach(c => c.classList.remove('day-selected'));
      el.classList.add('day-selected');

      renderDaySlotsInspector(room, memberDetails, monthUsages, isDayMode);
    });
  });
}

/**
 * Render Bảng Soi Chi Tiết Khung Giờ Của Ngày Đã Chọn
 */
function renderDaySlotsInspector(room, memberDetails, monthUsages, isDayMode) {
  const panel = document.getElementById('corral-day-inspector-panel');
  if (!panel || !selectedDateStr) return;

  const [y, m, d] = selectedDateStr.split('-');
  const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const formattedDateTitle = `${dayNames[dateObj.getDay()]}, ${d}/${m}/${y}`;

  // Trường hợp 1: Soi cho một thành viên cụ thể
  if (selectedMemberId !== 'all') {
    const targetUser = memberDetails.find(u => u.id === selectedMemberId);
    const uMonth = monthUsages[selectedMemberId] || {};
    const dayUsage = extractDayUsage(uMonth[selectedDateStr]);
    const slots = dayUsage.slots || [];
    let dayTotalHours = 0;
    slots.forEach(s => dayTotalHours += (s.hours || 0));
    const isUsed = dayUsage.used || slots.length > 0;
    const isBezit = targetUser?.username.toLowerCase() === 'bezit';

    panel.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-title-group">
          <h4>📅 ${formattedDateTitle}</h4>
          <div class="inspector-subtitle">
            Khung giờ của: <strong>${targetUser ? targetUser.displayName : 'Thành viên'}</strong> (@${targetUser ? targetUser.username : ''})
          </div>
        </div>
        <div class="day-total-tag mono" style="color: #ec4899; background: rgba(236, 72, 153, 0.15);">
          ${isDayMode ? (isUsed ? '✓ Đã xác nhận' : '— Chưa xác nhận') : `Tổng: ${formatHours(dayTotalHours)}`}
        </div>
      </div>

      <div class="member-inspect-card">
        <div class="member-inspect-header">
          <div class="member-inspect-user">
            <div class="member-inspect-avatar" style="background: linear-gradient(135deg, #ec4899, #8b5cf6);">
              ${isBezit ? '🐮' : (targetUser?.displayName ? targetUser.displayName.charAt(0).toUpperCase() : '?')}
            </div>
            <div>
              <div class="member-inspect-name">${targetUser ? targetUser.displayName : ''} ${isBezit ? '🐮' : ''}</div>
              <div class="member-inspect-username">@${targetUser ? targetUser.username : ''}</div>
            </div>
          </div>
          <span class="badge ${isUsed ? 'badge-success' : 'badge-secondary'}" style="font-size: 0.725rem;">
            ${isUsed ? (isDayMode ? 'Có dùng điện' : `${slots.length} khung giờ`) : 'Không dùng'}
          </span>
        </div>

        ${isDayMode ? `
          <div style="padding: 16px; text-align: center; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border: 1px dashed var(--border-subtle);">
            <div style="font-size: 2rem; margin-bottom: 8px;">${isUsed ? '⚡' : '💤'}</div>
            <div style="font-weight: 600;">${isUsed ? 'Thành viên này đã xác nhận có sử dụng điện' : 'Thành viên này chưa xác nhận sử dụng điện'}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
              Chế độ tính theo ngày không yêu cầu khai báo chi tiết từng khoảng giờ.
            </div>
          </div>
        ` : `
          <!-- Danh sách khung giờ -->
          <div class="corral-slots-container">
            ${slots.length === 0 ? `
              <div class="corral-empty-notice">
                💤 Thành viên này chưa khai báo khung giờ nào trong ngày ${d}/${m}/${y}.
              </div>
            ` : slots.map((slot, sIdx) => `
              <div class="corral-slot-chip">
                <div class="corral-slot-times">
                  <span>🕒</span>
                  <span class="mono">${slot.start} — ${slot.end}</span>
                </div>
                <div class="corral-slot-duration mono">
                  ${formatHours(slot.hours)} (${slot.hours.toFixed(1)}h)
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    document.getElementById('btn-corral-inspect-all')?.addEventListener('click', () => {
      selectedMemberId = 'all';
      renderBezitCorralView();
    });

    return;
  }

  // Trường hợp 2: Soi TẤT CẢ THÀNH VIÊN trong ngày được chọn
  let roomDayTotalHours = 0;
  let activeUsersCount = 0;

  const membersDayList = memberDetails.map(m => {
    const uMonth = monthUsages[m.id] || {};
    const dayUsage = extractDayUsage(uMonth[selectedDateStr]);
    const slots = dayUsage.slots || [];
    let userHours = 0;
    slots.forEach(s => userHours += (s.hours || 0));
    const isUsed = dayUsage.used || slots.length > 0;

    if (isUsed) activeUsersCount++;
    roomDayTotalHours += userHours;

    return {
      member: m,
      isUsed,
      userHours,
      slots
    };
  });

  panel.innerHTML = `
    <div class="inspector-header">
      <div class="inspector-title-group">
        <h4>📅 ${formattedDateTitle}</h4>
        <div class="inspector-subtitle">
          Tổng quan khung giờ của <strong>toàn bộ thành viên</strong>
        </div>
      </div>
      <div class="day-total-tag mono" style="color: #ec4899; background: rgba(236, 72, 153, 0.15);">
        ${isDayMode ? `${activeUsersCount} người dùng` : `∑ ${formatHours(roomDayTotalHours)}`}
      </div>
    </div>

    <!-- Danh sách thẻ của từng thành viên trong ngày này -->
    <div style="display: flex; flex-direction: column; gap: 12px; max-height: 480px; overflow-y: auto; padding-right: 4px;">
      ${membersDayList.map(item => {
    const m = item.member;
    const isBezit = m.username.toLowerCase() === 'bezit';

    return `
          <div class="member-inspect-card">
            <div class="member-inspect-header">
              <div class="member-inspect-user">
                <div class="member-inspect-avatar" style="background: linear-gradient(135deg, #ec4899, #8b5cf6);">
                  ${isBezit ? '🐮' : (m.displayName ? m.displayName.charAt(0).toUpperCase() : '?')}
                </div>
                <div>
                  <div class="member-inspect-name">
                    ${m.displayName} ${isBezit ? '🐮' : ''}
                  </div>
                  <div class="member-inspect-username">@${m.username}</div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge ${item.isUsed ? 'badge-success' : 'badge-secondary'}" style="font-size: 0.725rem;">
                  ${item.isUsed ? (isDayMode ? '✓ Đã dùng' : formatHours(item.userHours)) : 'Không dùng'}
                </span>
                <button class="btn btn-xs btn-ghost btn-filter-single-member" data-member-id="${m.id}" title="Lọc riêng thành viên này">
                  🔍
                </button>
              </div>
            </div>

            ${isDayMode ? `
              <div style="font-size: 0.85rem; color: ${item.isUsed ? 'var(--accent-success)' : 'var(--text-muted)'}; padding: 4px 0;">
                ${item.isUsed ? '⚡ Đã xác nhận sử dụng điện trong ngày này.' : '💤 Không xác nhận dùng điện.'}
              </div>
            ` : `
              <div class="corral-slots-container">
                ${item.slots.length === 0 ? `
                  <div style="font-size: 0.825rem; color: var(--text-muted); font-style: italic; padding: 2px 0;">
                    Chưa khai báo khung giờ nào.
                  </div>
                ` : item.slots.map(s => `
                  <div class="corral-slot-chip">
                    <div class="corral-slot-times">
                      <span>🕒</span>
                      <span class="mono">${s.start} — ${s.end}</span>
                    </div>
                    <div class="corral-slot-duration mono">
                      ${formatHours(s.hours)}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        `;
  }).join('')}
    </div>
  `;

  // Gắn sự kiện nút lọc nhanh sang 1 thành viên
  panel.querySelectorAll('.btn-filter-single-member').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-member-id');
      selectedMemberId = targetId;
      renderBezitCorralView();
    });
  });
}

/**
 * Gắn các sự kiện tương tác của trang Chuồng boà
 */
function bindCorralEvents(room, memberDetails, monthTitle, isDayMode) {
  const container = document.getElementById('bezit-corral-content');
  if (!container) return;

  const monthKey = getCorralMonthKey();

  // Easter Egg button
  document.getElementById('btn-corral-egg')?.addEventListener('click', showBezitEasterEgg);

  // Copy mã phòng
  document.getElementById('btn-corral-copy-code')?.addEventListener('click', () => {
    copyToClipboard(room.code, `Đã sao chép mã phòng: ${room.code}`);
  });

  // Rời phòng
  document.getElementById('btn-corral-leave-room')?.addEventListener('click', async () => {
    const user = getCurrentUser();
    if (!confirm('Bạn có chắc chắn muốn rời khỏi phòng này không?')) return;
    try {
      await leaveRoom(room.id, user.id);
      await refreshCurrentUser();
      await fetchCurrentRoom();
      showToast('Đã rời phòng thành công!', 'info');
      await renderBezitCorralView();
    } catch (err) {
      showToast(err.message || 'Lỗi khi rời phòng!', 'error');
    }
  });

  // Switch Sub-tabs (Soi lịch / Quản trị)
  document.getElementById('tab-corral-schedule')?.addEventListener('click', () => {
    activeCorralTab = 'schedule';
    renderBezitCorralView();
  });

  document.getElementById('tab-corral-manage')?.addEventListener('click', () => {
    activeCorralTab = 'manage';
    renderBezitCorralView();
  });

  // Chọn Member Pill
  container.querySelectorAll('.corral-member-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const mId = pill.getAttribute('data-member-id');
      selectedMemberId = mId;
      renderBezitCorralView();
    });
  });

  // Chọn dòng trong Bảng ma trận
  container.querySelectorAll('.corral-member-row, .btn-inspect-member').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const mId = el.getAttribute('data-member-id');
      if (mId) {
        selectedMemberId = mId;
        renderBezitCorralView();
      }
    });
  });

  // Chuyển tháng Lịch
  document.getElementById('corral-cal-prev')?.addEventListener('click', () => {
    corralMonth--;
    if (corralMonth < 0) {
      corralMonth = 11;
      corralYear--;
    }
    renderBezitCorralView();
  });

  document.getElementById('corral-cal-next')?.addEventListener('click', () => {
    corralMonth++;
    if (corralMonth > 11) {
      corralMonth = 0;
      corralYear++;
    }
    renderBezitCorralView();
  });

  document.getElementById('corral-cal-today')?.addEventListener('click', () => {
    const now = new Date();
    corralYear = now.getFullYear();
    corralMonth = now.getMonth();
    selectedDateStr = formatDateKey(now);
    renderBezitCorralView();
  });

  // Nhập hóa đơn tiền điện
  const billInput = document.getElementById('corral-bill-input');
  billInput?.addEventListener('input', (e) => {
    e.target.value = formatNumberWithSeparators(e.target.value);
  });

  document.getElementById('corral-form-bill')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawVal = document.getElementById('corral-bill-input').value;
    const amount = parseFormattedNumber(rawVal);
    if (isNaN(amount) || amount < 0) {
      showToast('Vui lòng nhập số tiền hợp lệ!', 'error');
      return;
    }

    try {
      await updateMonthlyBill(room.id, monthKey, amount);
      showToast(`Đã lưu hóa đơn tháng ${monthTitle}: ${formatVND(amount)}`, 'success');
      await renderBezitCorralView();
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật tiền điện!', 'error');
    }
  });

  // Chuyển đổi phương thức tính (Giờ / Ngày) bằng Modal Confirm
  const triggerModeModal = (targetMode, modeText, fromText) => {
    const closeBtn = document.getElementById('btn-close-switch-modal');
    const cancelBtn = document.getElementById('btn-cancel-switch-mode');
    const confirmBtn = document.getElementById('btn-confirm-switch-mode');
    const descEl = document.getElementById('switch-modal-desc');

    if (descEl) {
      descEl.innerHTML = `Bạn đang yêu cầu chuyển đổi phương thức tính tiền của <strong>${monthTitle}</strong> từ <strong>${fromText}</strong> sang <strong>${modeText}</strong>.`;
    }

    openModal('modal-confirm-switch-mode');

    const handleClose = () => closeModal('modal-confirm-switch-mode');
    if (closeBtn) closeBtn.onclick = handleClose;
    if (cancelBtn) cancelBtn.onclick = handleClose;

    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        closeModal('modal-confirm-switch-mode');
        try {
          await updateMonthlyCalcMode(room.id, monthKey, targetMode, true);
          showToast(`Đã chuyển sang ${modeText} và làm mới dữ liệu tháng ${monthTitle}!`, 'success');
          await renderBezitCorralView();
        } catch (err) {
          showToast(err.message || 'Lỗi khi chuyển đổi cách tính!', 'error');
        }
      };
    }
  };

  document.getElementById('btn-corral-mode-hours')?.addEventListener('click', () => {
    if (!isDayMode) return;
    triggerModeModal('hours', 'Tính theo Giờ', 'Tính theo Ngày');
  });

  document.getElementById('btn-corral-mode-days')?.addEventListener('click', () => {
    if (isDayMode) return;
    triggerModeModal('days', 'Tính theo Ngày', 'Tính theo Giờ');
  });

  // Duyệt / Từ chối yêu cầu tham gia (Pending requests)
  container.querySelectorAll('.btn-corral-approve').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uId = btn.getAttribute('data-id');
      try {
        await approveJoinRequest(room.id, uId);
        showToast('Đã duyệt thành viên vào phòng thành công!', 'success');
        await renderBezitCorralView();
      } catch (err) {
        showToast(err.message || 'Lỗi khi duyệt thành viên!', 'error');
      }
    });
  });

  container.querySelectorAll('.btn-corral-reject').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uId = btn.getAttribute('data-id');
      try {
        await rejectJoinRequest(room.id, uId);
        showToast('Đã từ chối yêu cầu tham gia!', 'info');
        await renderBezitCorralView();
      } catch (err) {
        showToast(err.message || 'Lỗi khi từ chối yêu cầu!', 'error');
      }
    });
  });

  // Đuổi thành viên
  container.querySelectorAll('.btn-corral-kick').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uId = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      if (confirm(`Bạn có chắc chắn muốn xóa thành viên "${name}" khỏi phòng không?`)) {
        try {
          await removeMemberFromRoom(room.id, uId);
          showToast(`Đã xóa thành viên "${name}" khỏi phòng!`, 'success');
          await renderBezitCorralView();
        } catch (err) {
          showToast(err.message || 'Lỗi khi xóa thành viên!', 'error');
        }
      }
    });
  });
}
