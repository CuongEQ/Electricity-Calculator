/**
 * Theme Management (Light / Dark Mode Switcher)
 */

const THEME_KEY = 'elec_calc_theme';

export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const preferredTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  
  applyTheme(preferredTheme);

  // Gắn sự kiện cho tất cả các nút toggle theme
  const toggleButtons = document.querySelectorAll('.theme-switch-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}
