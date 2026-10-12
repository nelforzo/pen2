/**
 * Tiny wrapper around the Web Speech API for reading characters aloud.
 *
 * iOS Safari only allows speech that is initiated from a user gesture, so we
 * "unlock" speech on the first interaction and queue any request that arrives
 * before that.
 *
 * Chrome populates `speechSynthesis.getVoices()` asynchronously (it can be
 * empty at startup and fill in later). If we speak before that, no explicit
 * voice is set and the browser's default is used — which is why the first deck
 * (ひらがな, loaded on startup) could sound different from a deck opened later.
 * So we wait for the voice list before the first utterance, and remember the
 * voice chosen for each language so every deck keeps using the same one.
 */

let unlocked = false;
let pending = null; // { text, options }
let voices = [];
const voiceWaiters = [];

function supported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refreshVoices() {
  if (!supported()) return;
  voices = window.speechSynthesis.getVoices() || [];
  if (voices.length) {
    while (voiceWaiters.length) voiceWaiters.shift()();
  }
}

if (supported()) {
  refreshVoices();
  // Voices are often loaded asynchronously.
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

// Stable id for a voice, remembered per language so all decks share one voice.
function voiceKey(v) {
  return v.voiceURI || v.name || '';
}

const chosenVoiceKeys = new Map();

function pickVoice(lang) {
  const want = (lang || '').toLowerCase();
  const wantPrefix = want.slice(0, 2);
  return (
    voices.find((v) => (v.lang || '').toLowerCase() === want) ||
    voices.find((v) => (v.lang || '').toLowerCase().startsWith(wantPrefix)) ||
    null
  );
}

function voiceFor(lang) {
  const langKey = (lang || '').toLowerCase();
  const saved = chosenVoiceKeys.get(langKey);
  if (saved) {
    const found = voices.find((v) => voiceKey(v) === saved);
    if (found) return found;
  }
  const voice = pickVoice(lang);
  if (voice) chosenVoiceKeys.set(langKey, voiceKey(voice));
  return voice;
}

function speakNow(text, options) {
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = options.lang || 'ja-JP';
    utterance.lang = lang;
    utterance.rate = options.rate ?? 0.85;
    utterance.pitch = 1;
    const voice = voiceFor(lang);
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  } catch {
    /* Speech is a nice-to-have; never let it break practice. */
  }
}

/** Call from a user-gesture handler (e.g. pointerdown) to allow speech on iOS. */
export function unlockSpeech() {
  if (unlocked || !supported()) return;
  unlocked = true;

  // A silent utterance satisfies iOS's requirement that the first speak()
  // happens inside a gesture.
  try {
    const warmup = new SpeechSynthesisUtterance(' ');
    warmup.volume = 0;
    window.speechSynthesis.speak(warmup);
  } catch {
    /* ignore */
  }

  if (pending) {
    const { text, options } = pending;
    pending = null;
    setTimeout(() => speak(text, options), 0);
  }
}

/** Speak the given text using the given language's voice. */
export function speak(text, options = {}) {
  if (!supported() || !text) return;

  // No gesture yet (e.g. deep link straight into practice): wait for one.
  if (!unlocked) {
    pending = { text, options };
    return;
  }

  // Wait for the voice list on first use so the explicit voice is applied
  // consistently; fall back after a short delay if it never arrives.
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    speakNow(text, options);
  };
  if (voices.length) run();
  else {
    voiceWaiters.push(run);
    setTimeout(run, 700);
  }
}

export function stopSpeaking() {
  if (!supported()) return;
  pending = null;
  window.speechSynthesis.cancel();
}
