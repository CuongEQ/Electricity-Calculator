/**
 * UI Utilities & Notifications
 */

export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';
  if (type === 'warning') icon = '🔔';

  toast.innerHTML = `
    <span>${icon}</span>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

export function formatVND(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Math.round(amount));
}

export function formatHours(hours) {
  if (!hours || isNaN(hours)) return '0h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}p`;
  return `${h}h ${m}p`;
}

export function timeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const parts = hhmm.split(':');
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return h * 60 + m;
}

export function isValidHHMM(str) {
  if (!str || typeof str !== 'string') return false;
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(str);
}

export function calculateSlotHours(startHHMM, endHHMM) {
  const startMins = timeToMinutes(startHHMM);
  const endMins = timeToMinutes(endHHMM);
  if (endMins <= startMins) return 0;
  return (endMins - startMins) / 60;
}

/**
 * Kiểm soát các trường hợp nhập sai hoặc ngoại lệ:
 * 1. Định dạng HH:MM
 * 2. start < end (không hỗ trợ xuyên đêm sang ngày khác)
 * 3. Trùng lặp (overlap) với các khung giờ đã có trong ngày
 * 4. Không được khai báo ngày tương lai
 */
export function validateTimeSlot(start, end, existingSlots = [], selectedDateStr = '') {
  if (!start || !end) {
    return { valid: false, message: 'Vui lòng nhập đầy đủ giờ bắt đầu và kết thúc!' };
  }

  if (!isValidHHMM(start) || !isValidHHMM(end)) {
    return { valid: false, message: 'Định dạng giờ không hợp lệ (chuẩn HH:MM, từ 00:00 đến 23:59)!' };
  }

  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);

  if (startMins >= endMins) {
    return { valid: false, message: 'Giờ bắt đầu phải sớm hơn giờ kết thúc (VD: 08:00 - 11:30)!' };
  }

  if (endMins - startMins < 5) {
    return { valid: false, message: 'Khoảng thời gian sử dụng tối thiểu là 5 phút!' };
  }

  // Kiểm tra không khai báo ngày tương lai
  if (selectedDateStr) {
    const selected = new Date(selectedDateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected.getTime() > today.getTime()) {
      return { valid: false, message: 'Không thể khai báo cho ngày trong tương lai!' };
    }
  }

  // Kiểm tra trùng lặp thời gian với các khung giờ đã có
  for (const slot of existingSlots) {
    const sMins = timeToMinutes(slot.start);
    const eMins = timeToMinutes(slot.end);

    // Overlap condition: max(start, sMins) < min(end, eMins)
    if (Math.max(startMins, sMins) < Math.min(endMins, eMins)) {
      return { 
        valid: false, 
        message: `Khung giờ ${start} - ${end} bị trùng lặp với khoảng đã có (${slot.start} - ${slot.end})!` 
      };
    }
  }

  return { valid: true };
}

export async function copyToClipboard(text, successMsg = 'Đã sao chép vào bộ nhớ tạm!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg, 'success');
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast(successMsg, 'success');
  }
}
