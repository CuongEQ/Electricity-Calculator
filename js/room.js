import { 
  createRoom as apiCreateRoom, 
  requestJoinRoom as apiRequestJoinRoom, 
  getRoomById, 
  getUserById,
  approveJoinRequest, 
  rejectJoinRequest, 
  removeMemberFromRoom,
  leaveRoom 
} from './storage-service.js';
import { getCurrentUser, refreshCurrentUser } from './auth.js';
import { showToast, copyToClipboard, openModal, closeModal } from './ui.js';

let currentRoomData = null;

export async function fetchCurrentRoom() {
  const user = getCurrentUser();
  if (!user || !user.roomId) {
    currentRoomData = null;
    return null;
  }
  currentRoomData = await getRoomById(user.roomId);
  return currentRoomData;
}

export function getCurrentRoom() {
  return currentRoomData;
}

export async function handleCreateRoom(name, maxMembers) {
  const user = getCurrentUser();
  if (!user) return null;

  if (!name || name.trim().length === 0) {
    showToast('Vui lòng nhập tên phòng!', 'error');
    return null;
  }

  const num = parseInt(maxMembers, 10);
  if (isNaN(num) || num < 2 || num > 20) {
    showToast('Số thành viên phải từ 2 đến 20 người!', 'error');
    return null;
  }

  try {
    const newRoom = await apiCreateRoom({ name, maxMembers: num, adminUser: user });
    await refreshCurrentUser();
    await fetchCurrentRoom();
    showToast(`Tạo phòng "${newRoom.name}" thành công! Mã phòng: ${newRoom.code}`, 'success');
    return newRoom;
  } catch (err) {
    showToast(err.message || 'Không thể tạo phòng!', 'error');
    return null;
  }
}

export async function handleJoinRoom(code) {
  const user = getCurrentUser();
  if (!user) return null;

  if (!code || code.trim().length !== 6) {
    showToast('Mã phòng phải gồm đúng 6 ký tự!', 'error');
    return null;
  }

  try {
    const room = await apiRequestJoinRoom(code, user);
    showToast(`Đã gửi yêu cầu tham gia phòng "${room.name}". Vui lòng chờ người quản lý duyệt!`, 'info');
    return room;
  } catch (err) {
    showToast(err.message || 'Không thể gửi yêu cầu tham gia phòng!', 'error');
    return null;
  }
}

export async function handleApprove(userId) {
  if (!currentRoomData) return;
  try {
    await approveJoinRequest(currentRoomData.id, userId);
    await fetchCurrentRoom();
    showToast('Đã duyệt thành viên vào phòng!', 'success');
  } catch (err) {
    showToast(err.message || 'Lỗi khi duyệt thành viên!', 'error');
  }
}

export async function handleReject(userId) {
  if (!currentRoomData) return;
  try {
    await rejectJoinRequest(currentRoomData.id, userId);
    await fetchCurrentRoom();
    showToast('Đã từ chối yêu cầu tham gia!', 'info');
  } catch (err) {
    showToast(err.message || 'Lỗi khi từ chối yêu cầu!', 'error');
  }
}

export async function handleRemoveMember(userId) {
  if (!currentRoomData) return;
  try {
    await removeMemberFromRoom(currentRoomData.id, userId);
    await fetchCurrentRoom();
    showToast('Đã xóa thành viên khỏi phòng!', 'success');
  } catch (err) {
    showToast(err.message || 'Lỗi khi xóa thành viên!', 'error');
  }
}

export async function handleLeaveRoom() {
  const user = getCurrentUser();
  const room = getCurrentRoom();
  if (!user || !room) return;

  const isAdmin = room.adminId === user.id;
  let confirmMsg = 'Bạn có chắc chắn muốn rời khỏi phòng này không?';

  if (isAdmin) {
    if (room.members.length > 1) {
      confirmMsg = 'Bạn đang là Quản lý phòng. Khi bạn rời phòng, quyền Quản lý sẽ tự động chuyển giao cho thành viên kế tiếp trong danh sách. Bạn có chắc chắn muốn rời phòng không?';
    } else {
      confirmMsg = 'Bạn là thành viên duy nhất trong phòng. Khi bạn rời phòng, phòng này sẽ tự động bị xóa hoàn toàn. Bạn có chắc chắn muốn rời phòng không?';
    }
  }

  if (!confirm(confirmMsg)) return;

  try {
    await leaveRoom(room.id, user.id);
    await refreshCurrentUser();
    await fetchCurrentRoom();
    showToast('Bạn đã rời phòng thành công!', 'info');

    // Cập nhật lại topbar và menu sidebar
    const roomTag = document.getElementById('topbar-room-name');
    if (roomTag) roomTag.textContent = 'Chưa vào phòng';

    const statsNavItem = document.querySelector('.nav-item[data-view="stats"]');
    if (statsNavItem) statsNavItem.classList.add('hidden');

    const roleEl = document.getElementById('sidebar-user-role');
    if (roleEl) roleEl.textContent = 'Chưa vào phòng';

    await renderRoomView();
  } catch (err) {
    showToast(err.message || 'Lỗi khi rời khỏi phòng!', 'error');
  }
}

/**
 * Render Room View
 */
export async function renderRoomView() {
  const container = document.getElementById('room-view-content');
  if (!container) return;

  const user = getCurrentUser();
  const room = await fetchCurrentRoom();

  // Cập nhật thông tin phòng trên topbar
  const roomTag = document.getElementById('topbar-room-name');
  if (roomTag) {
    roomTag.textContent = room ? `🏠 ${room.name}` : 'Chưa vào phòng';
  }

  // Cập nhật vai trò trên sidebar
  const roleEl = document.getElementById('sidebar-user-role');
  if (roleEl) {
    roleEl.textContent = room ? (room.adminId === user.id ? 'Quản lý phòng' : 'Thành viên') : 'Chưa vào phòng';
  }

  // Ẩn/Hiện tab Thống kê cho Admin
  const statsNavItem = document.querySelector('.nav-item[data-view="stats"]');
  if (statsNavItem) {
    if (room && room.adminId === user.id) {
      statsNavItem.classList.remove('hidden');
    } else {
      statsNavItem.classList.add('hidden');
    }
  }

  // Trường hợp 1: Người dùng chưa có phòng
  if (!room) {
    container.innerHTML = `
      <div class="room-setup-grid animate-fade">
        <!-- Tạo phòng mới -->
        <div class="card setup-card">
          <div class="setup-card-icon">➕</div>
          <h3 class="setup-card-title">Tạo phòng mới</h3>
          <p class="setup-card-desc">Bạn sẽ là Quản lý phòng và có quyền duyệt thành viên, nhập hóa đơn tiền điện.</p>
          
          <form id="create-room-form">
            <div class="form-group">
              <label class="form-label" for="room-name-input">Tên phòng</label>
              <input type="text" id="room-name-input" class="form-input" placeholder="VD: Phòng 402 - Ký túc xá" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="room-max-input">Số thành viên tối đa</label>
              <input type="number" id="room-max-input" class="form-input" value="4" min="2" max="20" required />
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 8px;">
              🚀 Khởi tạo phòng
            </button>
          </form>
        </div>

        <!-- Tham gia phòng đã có -->
        <div class="card setup-card">
          <div class="setup-card-icon">🔑</div>
          <h3 class="setup-card-title">Tham gia phòng có sẵn</h3>
          <p class="setup-card-desc">Nhập mã phòng gồm 6 ký tự được người quản lý phòng cung cấp.</p>
          
          <form id="join-room-form">
            <div class="form-group">
              <label class="form-label" for="room-code-input">Mã phòng (6 ký tự)</label>
              <input type="text" id="room-code-input" class="form-input mono" placeholder="VD: P402AB" maxlength="6" style="text-transform: uppercase; font-size: 1.15rem; letter-spacing: 2px;" required />
            </div>
            <button type="submit" class="btn btn-secondary" style="width: 100%; margin-top: 8px;">
              📩 Gửi yêu cầu tham gia
            </button>
          </form>
        </div>
      </div>
    `;

    // Bind form events
    document.getElementById('create-room-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('room-name-input').value;
      const max = document.getElementById('room-max-input').value;
      const res = await handleCreateRoom(name, max);
      if (res) renderRoomView();
    });

    document.getElementById('join-room-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('room-code-input').value;
      await handleJoinRoom(code);
    });

    return;
  }

  // Trường hợp 2: Người dùng đã thuộc phòng
  const isAdmin = room.adminId === user.id;

  // Lấy chi tiết thông tin các thành viên
  const memberDetails = await Promise.all(
    room.members.map(async (mId) => {
      const u = await getUserById(mId);
      return u || { id: mId, displayName: 'Thành viên', username: 'user' };
    })
  );

  let pendingSectionHtml = '';
  if (isAdmin) {
    const pendingList = room.pendingRequests || [];
    pendingSectionHtml = `
      <div class="card requests-card animate-fade">
        <div class="section-title-row">
          <h3 style="font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            <span>🔔</span> Yêu cầu chờ duyệt (${pendingList.length})
          </h3>
        </div>
        ${pendingList.length === 0 ? `
          <p style="color: var(--text-muted); font-size: 0.9rem;">Hiện không có yêu cầu tham gia nào đang chờ duyệt.</p>
        ` : `
          <div class="requests-list">
            ${pendingList.map(req => `
              <div class="request-item">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div class="avatar" style="width: 34px; height: 34px; font-size: 0.85rem;">
                    ${req.displayName ? req.displayName.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <div style="font-weight: 600; font-size: 0.95rem;">${req.displayName}</div>
                    <div style="font-size: 0.775rem; color: var(--text-muted);">@${req.username} • ${new Date(req.requestedAt).toLocaleDateString('vi-VN')}</div>
                  </div>
                </div>
                <div class="request-actions">
                  <button class="btn btn-sm btn-primary btn-approve" data-id="${req.userId}">Duyệt</button>
                  <button class="btn btn-sm btn-ghost btn-reject" data-id="${req.userId}">Từ chối</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // Lấy thông tin tài khoản Quản lý phòng
  const adminMember = memberDetails.find(m => m.id === room.adminId);
  const adminUsername = adminMember ? adminMember.username : (isAdmin ? user.username : 'admin');

  container.innerHTML = `
    <div class="room-container animate-fade">
      <!-- Header thông tin phòng -->
      <div class="room-header-card">
        <div class="room-details">
          <div class="room-title-row">
            <h2 class="room-name">${room.name}</h2>
            <div class="room-code-badge" id="btn-copy-room-code" title="Nhấp để sao chép mã phòng">
              <span>Mã: ${room.code}</span>
              <span style="font-size: 0.85rem;">📋</span>
            </div>
          </div>
          <div class="room-meta">
            <span>👥 Thành viên: <strong>${room.members.length} / ${room.maxMembers}</strong></span>
            <span>👑 Quản lý: <strong>@${adminUsername}${isAdmin ? ' (Bạn)' : ''}</strong></span>
          </div>
        </div>

        <div>
          <button id="btn-leave-room" class="btn btn-secondary btn-sm" style="color: var(--accent-danger); border-color: rgba(239, 68, 68, 0.35);" title="Rời khỏi phòng này">
            🚪 Rời phòng
          </button>
        </div>
      </div>

      <!-- Danh sách yêu cầu chờ duyệt (Admin only) -->
      ${pendingSectionHtml}

      <!-- Danh sách thành viên -->
      <div class="card">
        <div class="section-title-row">
          <h3 style="font-size: 1.15rem;">Danh sách thành viên (${room.members.length})</h3>
        </div>

        <div class="members-list">
          ${memberDetails.map(member => {
            const isMemberAdmin = member.id === room.adminId;
            const isSelf = member.id === user.id;

            return `
              <div class="member-card">
                <div class="member-info">
                  <div class="avatar">${member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}</div>
                  <div class="member-names">
                    <div class="member-display">
                      ${member.displayName} ${isSelf ? '<span class="badge badge-primary" style="font-size: 0.7rem; margin-left: 4px;">Bạn</span>' : ''}
                    </div>
                    <div class="member-user">@${member.username}</div>
                  </div>
                </div>

                <div class="member-actions">
                  ${isMemberAdmin ? `
                    <span class="badge badge-warning">👑 Quản lý</span>
                  ` : `
                    <span class="badge badge-success">Thành viên</span>
                  `}

                  ${isAdmin && !isMemberAdmin ? `
                    <button class="btn btn-sm btn-danger btn-kick-member" data-id="${member.id}" data-name="${member.displayName}">
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
  `;

  // Gắn sự kiện copy mã phòng
  document.getElementById('btn-copy-room-code')?.addEventListener('click', () => {
    copyToClipboard(room.code, `Đã sao chép mã phòng: ${room.code}`);
  });

  // Gắn sự kiện rời phòng
  document.getElementById('btn-leave-room')?.addEventListener('click', handleLeaveRoom);

  // Gắn sự kiện duyệt/từ chối
  container.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uId = btn.getAttribute('data-id');
      await handleApprove(uId);
      renderRoomView();
    });
  });

  container.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uId = btn.getAttribute('data-id');
      await handleReject(uId);
      renderRoomView();
    });
  });

  // Gắn sự kiện đuổi thành viên
  container.querySelectorAll('.btn-kick-member').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uId = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      if (confirm(`Bạn có chắc chắn muốn xóa thành viên "${name}" khỏi phòng không?`)) {
        await handleRemoveMember(uId);
        renderRoomView();
      }
    });
  });
}
