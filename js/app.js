import { Dashboard } from './components/dashboard.js';
import { StudyView } from './components/study-view.js';
import { SettingsView } from './components/settings-view.js';

const main = document.getElementById('main-content');
let hiraganaData = null;
let currentView = null;

async function loadData() {
  const res = await fetch('js/data/hiragana.json');
  if (!res.ok) throw new Error('Failed to load stroke data');
  return res.json();
}

function setActiveNav(id) {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.id === id);
  });
}

function cleanupView() {
  if (currentView && typeof currentView.destroy === 'function') {
    currentView.destroy();
  }
  currentView = null;
}

async function showDashboard() {
  cleanupView();
  setActiveNav('nav-dashboard');
  currentView = new Dashboard(main, hiraganaData, (char) => {
    location.hash = char ? `practice/${encodeURIComponent(char)}` : 'practice';
  });
  await currentView.init();
}

async function showPractice(startChar) {
  cleanupView();
  setActiveNav('nav-practice');
  currentView = new StudyView(main, hiraganaData, {
    startChar: startChar || null,
    onExit: () => { location.hash = 'dashboard'; },
  });
  await currentView.init();
}

async function showSettings() {
  cleanupView();
  setActiveNav('nav-settings');
  currentView = new SettingsView(main);
  await currentView.init();
}

function route() {
  const hash = location.hash.replace(/^#/, '') || 'dashboard';
  if (hash.startsWith('practice')) {
    const rest = hash.slice('practice'.length);
    const char = rest.startsWith('/') ? decodeURIComponent(rest.slice(1)) : null;
    showPractice(char);
    return;
  }
  switch (hash) {
    case 'settings': showSettings(); break;
    default: showDashboard(); break;
  }
}

async function main_init() {
  try {
    hiraganaData = await loadData();
  } catch (e) {
    main.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`;
    return;
  }

  document.getElementById('nav-dashboard').addEventListener('click', () => { location.hash = 'dashboard'; });
  document.getElementById('nav-practice').addEventListener('click', () => { location.hash = 'practice'; });
  document.getElementById('nav-settings').addEventListener('click', () => { location.hash = 'settings'; });

  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* offline support is optional; ignore failures (e.g. file://) */
      });
    });
  }
}

main_init();
