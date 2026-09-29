/**
 * Easter Egg dành riêng cho tài khoản "bezit"
 * Đặc điểm:
 * - 2 icon 🐄 và 🪿 cạnh nhau
 * - Hoạt ảnh pháo bông (Fireworks Canvas) & Trái tim bay lượn xung quanh
 * - Dòng chữ ngẫu nhiên hiển thị phía trên mỗi khi tải:
 *   + Boà con và Zịt con xin chào ạ
 *   + Moooooo
 *   + Quạccccc
 *   + moo quạc mooo
 *   + quạc moo quạcc
 */

const BEZIT_QUOTES = [
  "Boà con và Zịt con xin chào ạ",
  "Moooooo",
  "Quạccccc",
  "moo quạc mooo",
  "quạc moo quạcc"
];

let fireworksActive = false;
let animationFrameId = null;
let heartsIntervalId = null;
let autoDismissTimeoutId = null;

/**
 * Kiểm tra xem tài khoản có phải là "bezit" không
 */
export function isBezit(user) {
  if (!user || !user.username) return false;
  return user.username.trim().toLowerCase() === 'bezit';
}

/**
 * Hiển thị Easter Egg Boà & Zịt cho tài khoản "bezit"
 */
export function showBezitEasterEgg() {
  let overlay = document.getElementById('bezit-easter-egg-overlay');

  if (!overlay) {
    overlay = createEasterEggDOM();
    document.body.appendChild(overlay);
  }

  // Chọn ngẫu nhiên 1 câu nói mỗi lần hiển thị / mỗi lần tải
  const randomQuote = BEZIT_QUOTES[Math.floor(Math.random() * BEZIT_QUOTES.length)];
  const quoteEl = document.getElementById('bezit-quote-text');
  if (quoteEl) {
    quoteEl.textContent = randomQuote;
  }

  // Hiển thị overlay
  overlay.classList.add('active');

  // Khởi động hoạt ảnh pháo bông & trái tim bay
  startFireworks();
  startFloatingHearts();

  // Tự động đóng sau 8 giây nếu người dùng không bấm tắt
  clearTimeout(autoDismissTimeoutId);
  autoDismissTimeoutId = setTimeout(() => {
    hideBezitEasterEgg();
  }, 8000);
}

/**
 * Ẩn Easter Egg và dọn dẹp tài nguyên
 */
export function hideBezitEasterEgg() {
  const overlay = document.getElementById('bezit-easter-egg-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }

  stopFireworks();
  stopFloatingHearts();
  clearTimeout(autoDismissTimeoutId);
}

/**
 * Tạo cây DOM cho Easter Egg
 */
function createEasterEggDOM() {
  const overlay = document.createElement('div');
  overlay.id = 'bezit-easter-egg-overlay';

  overlay.innerHTML = `
    <canvas id="bezit-fireworks-canvas"></canvas>
    <div class="bezit-floating-hearts-layer" id="bezit-hearts-layer"></div>

    <div class="bezit-card" id="bezit-card">
      <button type="button" class="bezit-close-btn" id="bezit-close-btn" title="Đóng">&times;</button>
      
      <!-- Dòng chữ ngẫu nhiên phía trên -->
      <div class="bezit-speech-bubble">
        <span>✨</span>
        <span id="bezit-quote-text">Boà con và Zịt con xin chào ạ</span>
        <span>✨</span>
      </div>

      <!-- 2 icon 🐄 và 🪿 cạnh nhau -->
      <div class="bezit-animals">
        <span class="bezit-animal-icon bezit-cow" id="bezit-icon-cow" title="Boà con nè! Moooo">🐄</span>
        <span class="bezit-center-heart">💖</span>
        <span class="bezit-animal-icon bezit-goose" id="bezit-icon-goose" title="Zịt con nè! Quạccc">🪿</span>
      </div>

      <div class="bezit-subtext">
        <span class="sparkle">⭐</span>
        <span>Chúc Bé zịt một ngày tràn ngập niềm vui!</span>
        <span class="sparkle">⭐</span>
      </div>
    </div>
  `;

  // Sự kiện nút đóng
  const closeBtn = overlay.querySelector('#bezit-close-btn');
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideBezitEasterEgg();
  });

  // Click vào vùng tối bên ngoài cũng đóng lại
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.id === 'bezit-fireworks-canvas') {
      hideBezitEasterEgg();
    }
  });

  // Tương tác vui vẻ khi click vào Boà hoặc Zịt
  const cow = overlay.querySelector('#bezit-icon-cow');
  const goose = overlay.querySelector('#bezit-icon-goose');

  cow?.addEventListener('click', () => {
    spawnBurstHeart(cow, '🐄 Moooooo! 💕');
  });

  goose?.addEventListener('click', () => {
    spawnBurstHeart(goose, '🪿 Quạccccc! 💕');
  });

  return overlay;
}

/**
 * Tạo hiệu ứng nổ tim nhỏ khi bấm vào icon
 */
function spawnBurstHeart(targetEl, text) {
  const rect = targetEl.getBoundingClientRect();
  const tip = document.createElement('div');
  tip.style.position = 'fixed';
  tip.style.left = `${rect.left + rect.width / 2}px`;
  tip.style.top = `${rect.top - 10}px`;
  tip.style.transform = 'translate(-50%, -50%)';
  tip.style.background = 'linear-gradient(135deg, #ff477e, #ff758c)';
  tip.style.color = '#fff';
  tip.style.padding = '6px 14px';
  tip.style.borderRadius = '16px';
  tip.style.fontWeight = 'bold';
  tip.style.fontSize = '0.9rem';
  tip.style.zIndex = '9999999';
  tip.style.boxShadow = '0 6px 16px rgba(255, 71, 126, 0.5)';
  tip.style.pointerEvents = 'none';
  tip.style.animation = 'bezitBubbleFloat 1.2s ease-out forwards';
  tip.textContent = text;

  document.body.appendChild(tip);

  // Tạo thêm pháo hoa nhỏ quanh con vật
  createExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2, 25);

  setTimeout(() => {
    tip.remove();
  }, 1200);
}

/* ==========================================================================
   Pháo bông (Fireworks HTML5 Canvas Engine)
   ========================================================================== */
let particles = [];
let rockets = [];
let canvas = null;
let ctx = null;

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

const FIREWORK_COLORS = [
  '#ff477e', '#ff758c', '#ffbe0b', '#fb5607',
  '#ff006e', '#8338ec', '#3a86ff', '#06d6a0', '#ff99c8'
];

function createExplosion(x, y, count = 50) {
  const baseColor = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      decay: Math.random() * 0.02 + 0.012,
      color: Math.random() > 0.3 ? baseColor : FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
      size: Math.random() * 3 + 1.8,
      gravity: 0.08
    });
  }
}

function launchRocket() {
  if (!canvas) return;
  const startX = Math.random() * (canvas.width * 0.8) + (canvas.width * 0.1);
  const targetY = Math.random() * (canvas.height * 0.45) + (canvas.height * 0.1);
  const speed = Math.random() * 3 + 11;

  rockets.push({
    x: startX,
    y: canvas.height,
    targetY: targetY,
    vy: -speed,
    color: '#fff',
    size: 2.5
  });
}

function updateFireworks() {
  if (!fireworksActive || !ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Cập nhật tên lửa bay lên
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.y += r.vy;

    ctx.save();
    ctx.fillStyle = r.color;
    ctx.shadowColor = '#ffeaa7';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (r.y <= r.targetY) {
      createExplosion(r.x, r.y, 45);
      rockets.splice(i, 1);
    }
  }

  // Cập nhật hạt pháo bông rơi và phát sáng
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.alpha -= p.decay;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Bắn ngẫu nhiên các quả pháo hoa mới
  if (Math.random() < 0.08 && rockets.length < 5) {
    launchRocket();
  }

  animationFrameId = requestAnimationFrame(updateFireworks);
}

function startFireworks() {
  canvas = document.getElementById('bezit-fireworks-canvas');
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  fireworksActive = true;
  particles = [];
  rockets = [];

  // Bắn ngay 3 chùm pháo mở màn rực rỡ
  launchRocket();
  setTimeout(launchRocket, 150);
  setTimeout(launchRocket, 300);

  updateFireworks();
}

function stopFireworks() {
  fireworksActive = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  window.removeEventListener('resize', resizeCanvas);
}

/* ==========================================================================
   Trái tim bay xung quanh (Floating Hearts)
   ========================================================================== */
const HEART_ICONS = ['💖', '💕', '❤️', '💓', '💘', '🌻'];

function spawnHeart() {
  const container = document.getElementById('bezit-hearts-layer');
  if (!container) return;

  const heart = document.createElement('div');
  heart.className = 'bezit-floating-heart';

  // Icon ngẫu nhiên (chủ yếu là trái tim, thi thoảng kèm Boà & Zịt)
  const icon = HEART_ICONS[Math.floor(Math.random() * HEART_ICONS.length)];
  heart.textContent = icon;

  // Vị trí ngang ngẫu nhiên
  const left = Math.random() * 90 + 5; // 5% đến 95%
  heart.style.left = `${left}%`;
  heart.style.bottom = `${Math.random() * 20 + 5}%`;

  // Kích thước và tốc độ bay ngẫu nhiên
  const size = Math.random() * 1.5 + 1.2;
  const duration = Math.random() * 2 + 2.5;
  heart.style.fontSize = `${size}rem`;
  heart.style.animationDuration = `${duration}s`;

  container.appendChild(heart);

  // Xóa tim sau khi bay xong
  setTimeout(() => {
    heart.remove();
  }, duration * 1000);
}

function startFloatingHearts() {
  stopFloatingHearts();
  // Tạo vài trái tim ngay lập tức
  for (let i = 0; i < 6; i++) {
    setTimeout(spawnHeart, i * 200);
  }
  heartsIntervalId = setInterval(spawnHeart, 380);
}

function stopFloatingHearts() {
  if (heartsIntervalId) {
    clearInterval(heartsIntervalId);
    heartsIntervalId = null;
  }
  const container = document.getElementById('bezit-hearts-layer');
  if (container) {
    container.innerHTML = '';
  }
}
