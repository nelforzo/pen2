/**
 * Tiny wrapper around the Web Speech API for reading characters aloud.
 *
 * iOS Safari only allows speech that is initiated from a user gesture, so we
 * "unlock" speech on the first interaction and queue any request that arrives
 * before that.
 */

let unlocked = false;
let pending = null;
let voices = [];

function supported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refreshVoices() {
  if (!supported()) return;
  voices = window.speechSynthesis.getVoices() || [];
}

if (supported()) {
  refreshVoices();
  // Voices are often loaded asynchronously.
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

function voiceFor(lang) {
  if (!voices.length) refreshVoices();
  const want = (lang || '').toLowerCase();
  const wantPrefix = want.slice(0, 2);
  return (
    voices.find((v) => (v.lang || '').toLowerCase() === want) ||
    voices.find((v) => (v.lang || '').toLowerCase().startsWith(wantPrefix)) ||
    null
  );
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
    const text = pending;
    pending = null;
    setTimeout(() => speak(text), 0);
  }
}

/** Speak the given text in Japanese. */
export function speak(text, options = {}) {
  if (!supported() || !text) return;

  // No gesture yet (e.g. deep link straight into practice): wait for one.
  if (!unlocked) {
    pending = text;
    return;
  }

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

export function stopSpeaking() {
  if (!supported()) return;
  pending = null;
  window.speechSynthesis.cancel();
}
