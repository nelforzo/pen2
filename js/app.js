import { Dashboard } from './components/dashboard.js';
import { StudyView } from './components/study-view.js';
import { SECTIONS, DEFAULT_SECTION, getSection } from './lib/sections.js';
import { unlockSpeech } from './lib/speech.js';

const main = document.getElementById('main-content');
const menuToggle = document.getElementById('menu-toggle');
const menuList = document.getElementById('menu-list');

let currentView = null;
const dataCache = {};

async function loadSectionData(section) {
  if (dataCache[section.id]) return dataCache[section.id];
  const res = await fetch(section.dataFile);
  if (!res.ok) throw new Error(`Failed to load ${section.dataFile}`);
  const data = await res.json();
  dataCache[section.id] = data;
  return data;
}

function cleanupView() {
  if (currentView && typeof currentView.destroy === 'function') {
    currentView.destroy();
  }
  currentView = null;
}

function closeMenu() {
  menuList.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  const willOpen = menuList.hidden;
  menuList.hidden = !willOpen;
  menuToggle.setAttribute('aria-expanded', String(willOpen));
}

function setActiveMenu(sectionId) {
  menuList.querySelectorAll('.menu-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.section === sectionId);
  });
}

async function showDashboard(sectionId) {
  cleanupView();
  const section = getSection(sectionId);
  setActiveMenu(section.id);
  const data = await loadSectionData(section);
  currentView = new Dashboard(main, section, data, (char) => {
    location.hash = char
      ? `${section.id}/practice/${encodeURIComponent(char)}`
      : `${section.id}/practice`;
  });
  await currentView.init();
}

async function showPractice(sectionId, startChar) {
  cleanupView();
  const section = getSection(sectionId);
  setActiveMenu(section.id);
  const data = await loadSectionData(section);
  currentView = new StudyView(main, section, data, {
    startChar: startChar || null,
    onExit: () => { location.hash = section.id; },
  });
  await currentView.init();
}

function route() {
  const hash = location.hash.replace(/^#/, '') || DEFAULT_SECTION;
  const parts = hash.split('/');
  const sectionId = SECTIONS[parts[0]] ? parts[0] : DEFAULT_SECTION;

  if (parts[1] === 'practice') {
    const char = parts[2] ? decodeURIComponent(parts[2]) : null;
    showPractice(sectionId, char);
    return;
  }
  showDashboard(sectionId);
}

async function main_init() {
  // Allow Web Speech on iOS: the first speak() must happen inside a gesture.
  document.addEventListener('pointerdown', unlockSpeech, { once: true });

  // iOS Safari ignores user-scalable=no, so block pinch-zoom gestures directly.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
    document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
  });
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );

  // Hamburger menu.
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });
  menuList.querySelectorAll('.menu-item').forEach((el) => {
    el.addEventListener('click', () => {
      closeMenu();
      location.hash = el.dataset.section;
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu')) closeMenu();
  });

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
