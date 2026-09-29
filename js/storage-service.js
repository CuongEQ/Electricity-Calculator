import { firebaseConfig, isFirebaseConfigured } from './config.js';

/**
 * SHA-256 Hash helper using Web Crypto API
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Global state in storage service
let db = null;
let useFirebase = false;

// Initialize Firebase if configured
if (isFirebaseConfigured()) {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    useFirebase = true;
    console.log('⚡ Firebase Firestore đã được kết nối thành công!');
  } catch (err) {
    console.warn('⚠️ Không thể khởi tạo Firebase, chuyển sang LocalStorage fallback:', err);
    useFirebase = false;
  }
} else {
  console.log('ℹ️ Ứng dụng đang hoạt động ở chế độ LocalStorage (Để đồng bộ đa thiết bị, hãy điền Firebase Config trong js/config.js)');
}

export function isUsingFirebase() {
  return useFirebase;
}

/* ==========================================================================
   LocalStorage Fallback Driver
   ========================================================================== */
const STORAGE_PREFIX = 'elec_calc_';

function getLocal(key, defaultVal = null) {
  try {
    const data = localStorage.getItem(STORAGE_PREFIX + key);
    return data ? JSON.parse(data) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

function setLocal(key, value) {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
}

// Seed default state in LocalStorage if not exists
if (!getLocal('users')) setLocal('users', {});
if (!getLocal('rooms')) setLocal('rooms', {});
if (!getLocal('usages')) setLocal('usages', {});

/* ==========================================================================
   USER OPERATIONS
   ========================================================================== */

export async function createUser({ username, displayName, password }) {
  const normUser = username.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  const newUser = {
    id: userId,
    username: normUser,
    displayName: displayName.trim(),
    passwordHash,
    roomId: null,
    createdAt: new Date().toISOString()
  };

  if (useFirebase && db) {
    const { doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    
    // Check username exists in users collection
    const userRef = doc(db, 'users', userId);
    // Also save by username lookup
    const unameRef = doc(db, 'usernames', normUser);
    const unameSnap = await getDoc(unameRef);
    if (unameSnap.exists()) {
      throw new Error('Tên đăng nhập đã được sử dụng!');
    }

    await setDoc(unameRef, { userId });
    await setDoc(userRef, newUser);
    return newUser;
  } else {
    const users = getLocal('users', {});
    const existing = Object.values(users).find(u => u.username === normUser);
    if (existing) {
      throw new Error('Tên đăng nhập đã được sử dụng!');
    }
    users[userId] = newUser;
    setLocal('users', users);
    return newUser;
  }
}

export async function authenticateUser(username, password) {
  const normUser = username.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  if (useFirebase && db) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const unameRef = doc(db, 'usernames', normUser);
    const unameSnap = await getDoc(unameRef);
    if (!unameSnap.exists()) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng!');
    }
    const userId = unameSnap.data().userId;
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) {
      throw new Error('Tài khoản không tồn tại!');
    }
    const user = userSnap.data();
    if (user.passwordHash !== passwordHash) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng!');
    }
    return user;
  } else {
    const users = getLocal('users', {});
    const user = Object.values(users).find(u => u.username === normUser);
    if (!user || user.passwordHash !== passwordHash) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng!');
    }
    return user;
  }
}

export async function getUserById(userId) {
  if (!userId) return null;
  if (useFirebase && db) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? snap.data() : null;
  } else {
    const users = getLocal('users', {});
    return users[userId] || null;
  }
}

export async function updateUser(userId, data) {
  if (useFirebase && db) {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await updateDoc(doc(db, 'users', userId), data);
  } else {
    const users = getLocal('users', {});
    if (users[userId]) {
      users[userId] = { ...users[userId], ...data };
      setLocal('users', users);
    }
  }
}

/* ==========================================================================
   ROOM OPERATIONS
   ========================================================================== */

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createRoom({ name, maxMembers, adminUser }) {
  const roomId = 'room_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const code = generateRoomCode();

  const newRoom = {
    id: roomId,
    name: name.trim(),
    code: code,
    adminId: adminUser.id,
    maxMembers: parseInt(maxMembers, 10) || 6,
    members: [adminUser.id],
    pendingRequests: [],
    monthlyBills: {},
    createdAt: new Date().toISOString()
  };

  if (useFirebase && db) {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await setDoc(doc(db, 'rooms', roomId), newRoom);
    await setDoc(doc(db, 'roomCodes', code), { roomId });
    await updateUser(adminUser.id, { roomId });
  } else {
    const rooms = getLocal('rooms', {});
    rooms[roomId] = newRoom;
    setLocal('rooms', rooms);
    await updateUser(adminUser.id, { roomId });
  }

  return newRoom;
}

export async function getRoomById(roomId) {
  if (!roomId) return null;
  if (useFirebase && db) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDoc(doc(db, 'rooms', roomId));
    return snap.exists() ? snap.data() : null;
  } else {
    const rooms = getLocal('rooms', {});
    return rooms[roomId] || null;
  }
}

export async function getRoomByCode(code) {
  const normCode = code.trim().toUpperCase();
  if (useFirebase && db) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const codeSnap = await getDoc(doc(db, 'roomCodes', normCode));
    if (!codeSnap.exists()) return null;
    const roomId = codeSnap.data().roomId;
    return await getRoomById(roomId);
  } else {
    const rooms = getLocal('rooms', {});
    return Object.values(rooms).find(r => r.code === normCode) || null;
  }
}

export async function requestJoinRoom(roomCode, user) {
  const room = await getRoomByCode(roomCode);
  if (!room) {
    throw new Error('Mã phòng không tồn tại!');
  }

  if (room.members.includes(user.id)) {
    throw new Error('Bạn đã là thành viên của phòng này rồi!');
  }

  if (room.members.length >= room.maxMembers) {
    throw new Error('Phòng đã đủ số lượng thành viên tối đa!');
  }

  const alreadyPending = room.pendingRequests.some(r => r.userId === user.id);
  if (alreadyPending) {
    throw new Error('Bạn đã gửi yêu cầu tham gia phòng này rồi. Hãy đợi quản trị viên xét duyệt!');
  }

  room.pendingRequests.push({
    userId: user.id,
    displayName: user.displayName,
    username: user.username,
    requestedAt: new Date().toISOString()
  });

  if (useFirebase && db) {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await updateDoc(doc(db, 'rooms', room.id), {
      pendingRequests: room.pendingRequests
    });
  } else {
    const rooms = getLocal('rooms', {});
    rooms[room.id] = room;
    setLocal('rooms', rooms);
  }

  return room;
}

export async function approveJoinRequest(roomId, targetUserId) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error('Không tìm thấy phòng!');

  if (room.members.length >= room.maxMembers) {
    throw new Error('Phòng đã đầy thành viên!');
  }

  room.pendingRequests = room.pendingRequests.filter(r => r.userId !== targetUserId);
  if (!room.members.includes(targetUserId)) {
    room.members.push(targetUserId);
  }

  if (useFirebase && db) {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await updateDoc(doc(db, 'rooms', roomId), {
      members: room.members,
      pendingRequests: room.pendingRequests
    });
    await updateUser(targetUserId, { roomId });
  } else {
    const rooms = getLocal('rooms', {});
    rooms[roomId] = room;
    setLocal('rooms', rooms);
    await updateUser(targetUserId, { roomId });
  }

  return room;
}

export async function rejectJoinRequest(roomId, targetUserId) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error('Không tìm thấy phòng!');

  room.pendingRequests = room.pendingRequests.filter(r => r.userId !== targetUserId);

  if (useFirebase && db) {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await updateDoc(doc(db, 'rooms', roomId), {
      pendingRequests: room.pendingRequests
    });
  } else {
    const rooms = getLocal('rooms', {});
    rooms[roomId] = room;
    setLocal('rooms', rooms);
  }

  return room;
}

export async function removeMemberFromRoom(roomId, targetUserId) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error('Không tìm thấy phòng!');
  if (room.adminId === targetUserId) {
    throw new Error('Không thể xóa người quản trị khỏi phòng!');
  }

  room.members = room.members.filter(id => id !== targetUserId);

  if (useFirebase && db) {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await updateDoc(doc(db, 'rooms', roomId), {
      members: room.members
    });
    await updateUser(targetUserId, { roomId: null });
  } else {
    const rooms = getLocal('rooms', {});
    rooms[roomId] = room;
    setLocal('rooms', rooms);
    await updateUser(targetUserId, { roomId: null });
  }

  return room;
}

export async function updateMonthlyBill(roomId, monthKey, amount) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error('Không tìm thấy phòng!');

  if (!room.monthlyBills) room.monthlyBills = {};
  room.monthlyBills[monthKey] = Number(amount) || 0;

  if (useFirebase && db) {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await updateDoc(doc(db, 'rooms', roomId), {
      [`monthlyBills.${monthKey}`]: Number(amount) || 0
    });
  } else {
    const rooms = getLocal('rooms', {});
    rooms[roomId] = room;
    setLocal('rooms', rooms);
  }

  return room;
}

export async function clearMonthUsages(roomId, monthKey) {
  if (useFirebase && db) {
    const { collection, query, where, getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const q = query(
      collection(db, 'usages'),
      where('roomId', '==', roomId),
      where('month', '==', monthKey)
    );
    const snap = await getDocs(q);
    const deletePromises = [];
    snap.forEach(docSnap => {
      deletePromises.push(deleteDoc(doc(db, 'usages', docSnap.id)));
    });
    await Promise.all(deletePromises);
  } else {
    const usages = getLocal('usages', {});
    if (usages[roomId] && usages[roomId][monthKey]) {
      usages[roomId][monthKey] = {};
      setLocal('usages', usages);
    }
  }
}

export async function updateMonthlyCalcMode(roomId, monthKey, mode, resetData = true) {
  // mode: 'hours' | 'days'
  const validMode = mode === 'days' ? 'days' : 'hours';
  const room = await getRoomById(roomId);
  if (!room) throw new Error('Không tìm thấy phòng!');

  if (!room.monthlyCalcModes) room.monthlyCalcModes = {};
  room.monthlyCalcModes[monthKey] = validMode;

  if (useFirebase && db) {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await updateDoc(doc(db, 'rooms', roomId), {
      [`monthlyCalcModes.${monthKey}`]: validMode
    });
  } else {
    const rooms = getLocal('rooms', {});
    rooms[roomId] = room;
    setLocal('rooms', rooms);
  }

  // Xoá toàn bộ dữ liệu đã nhập trước đó trong tháng được chọn
  if (resetData) {
    await clearMonthUsages(roomId, monthKey);
  }

  return room;
}

/* ==========================================================================
   USAGE RECORDS OPERATIONS
   ========================================================================== */

export function extractDayUsage(dayData) {
  if (!dayData) return { used: false, slots: [] };
  if (Array.isArray(dayData)) {
    return { used: dayData.length > 0, slots: dayData };
  }
  return {
    used: Boolean(dayData.used),
    slots: Array.isArray(dayData.slots) ? dayData.slots : []
  };
}

export async function getMonthUsages(roomId, monthKey) {
  // monthKey format: "YYYY-MM" (e.g. "2026-09")
  if (useFirebase && db) {
    const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const q = query(
      collection(db, 'usages'),
      where('roomId', '==', roomId),
      where('month', '==', monthKey)
    );
    const snap = await getDocs(q);
    const records = {};
    snap.forEach(docSnap => {
      records[docSnap.id] = docSnap.data();
    });
    return records;
  } else {
    const usages = getLocal('usages', {});
    const roomUsages = usages[roomId] || {};
    return roomUsages[monthKey] || {};
  }
}

export async function getUserDaySlots(roomId, userId, dateStr) {
  const monthKey = dateStr.substring(0, 7); // "YYYY-MM"
  const monthData = await getMonthUsages(roomId, monthKey);
  const userMonth = monthData[userId] || {};
  const dayData = userMonth[dateStr];
  return extractDayUsage(dayData).slots;
}

export async function getUserDayUsage(roomId, userId, dateStr) {
  const monthKey = dateStr.substring(0, 7);
  const monthData = await getMonthUsages(roomId, monthKey);
  const userMonth = monthData[userId] || {};
  return extractDayUsage(userMonth[dateStr]);
}

export async function saveDaySlots(roomId, userId, dateStr, slots) {
  const monthKey = dateStr.substring(0, 7);
  const payload = {
    used: slots.length > 0,
    slots: slots
  };

  if (useFirebase && db) {
    const { doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const docId = `${roomId}_${monthKey}_${userId}`;
    const docRef = doc(db, 'usages', docId);
    const snap = await getDoc(docRef);
    let currentData = snap.exists() ? snap.data() : { roomId, month: monthKey, userId, days: {} };
    if (!currentData.days) currentData.days = {};
    currentData.days[dateStr] = payload;

    await setDoc(docRef, currentData);
  } else {
    const usages = getLocal('usages', {});
    if (!usages[roomId]) usages[roomId] = {};
    if (!usages[roomId][monthKey]) usages[roomId][monthKey] = {};
    if (!usages[roomId][monthKey][userId]) usages[roomId][monthKey][userId] = {};
    
    usages[roomId][monthKey][userId][dateStr] = payload;
    setLocal('usages', usages);
  }
}

export async function setDayUsageStatus(roomId, userId, dateStr, isUsed) {
  const monthKey = dateStr.substring(0, 7);

  if (useFirebase && db) {
    const { doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const docId = `${roomId}_${monthKey}_${userId}`;
    const docRef = doc(db, 'usages', docId);
    const snap = await getDoc(docRef);
    let currentData = snap.exists() ? snap.data() : { roomId, month: monthKey, userId, days: {} };
    if (!currentData.days) currentData.days = {};
    const existing = extractDayUsage(currentData.days[dateStr]);
    currentData.days[dateStr] = {
      used: isUsed,
      slots: existing.slots
    };

    await setDoc(docRef, currentData);
  } else {
    const usages = getLocal('usages', {});
    if (!usages[roomId]) usages[roomId] = {};
    if (!usages[roomId][monthKey]) usages[roomId][monthKey] = {};
    if (!usages[roomId][monthKey][userId]) usages[roomId][monthKey][userId] = {};
    
    const existing = extractDayUsage(usages[roomId][monthKey][userId][dateStr]);
    usages[roomId][monthKey][userId][dateStr] = {
      used: isUsed,
      slots: existing.slots
    };
    setLocal('usages', usages);
  }
}
