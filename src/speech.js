/**
 * Voice in and voice out, using the browser's own engines.
 *
 * Voice OUTPUT is the part that matters most and the part we would never cut.
 * The people who lose the most money to middlemen are frequently the people
 * least able to read a dense screen of Kannada text about stamp duty. Every
 * finding on the results page can be read aloud.
 *
 * Voice INPUT is a convenience with an honest fallback: not every browser
 * exposes recognition, and the ones that do are unreliable on code-mixed
 * speech. So the typed path is never hidden behind the microphone, and the
 * transcript is always shown and editable before it is used.
 *
 * Nothing here sends audio anywhere. Recognition and synthesis both run in the
 * browser.
 */

export const recognitionSupported = () => typeof window !== 'undefined'
  && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

export const synthesisSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * One-shot dictation.
 * @returns {{ start: function, stop: function }}
 */
export function createRecognizer({ locale = 'en-IN', onResult, onError, onEnd }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = locale;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 3;

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) final += result[0].transcript;
      else interim += result[0].transcript;
    }
    onResult?.({ interim, final, isFinal: Boolean(final) });
  };
  recognition.onerror = (event) => onError?.(event.error);
  recognition.onend = () => onEnd?.();

  return {
    start: () => { try { recognition.start(); } catch { /* already running */ } },
    stop: () => { try { recognition.stop(); } catch { /* not running */ } }
  };
}

let activeUtterance = null;

/** Picks the best available voice for a locale, falling back to any Indian English voice. */
function pickVoice(locale) {
  const voices = window.speechSynthesis.getVoices() || [];
  return voices.find((voice) => voice.lang === locale)
    || voices.find((voice) => voice.lang?.startsWith(locale.split('-')[0]))
    || voices.find((voice) => voice.lang === 'en-IN')
    || voices.find((voice) => voice.lang?.startsWith('en'))
    || null;
}

export function speak(text, { locale = 'en-IN', onEnd } = {}) {
  if (!synthesisSupported() || !text) return false;
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
  utterance.lang = locale;
  utterance.rate = 0.94;          // a shade slower than default; this is a form, not a podcast
  utterance.pitch = 1;
  const voice = pickVoice(locale);
  if (voice) utterance.voice = voice;
  utterance.onend = () => { activeUtterance = null; onEnd?.(); };
  utterance.onerror = () => { activeUtterance = null; onEnd?.(); };
  activeUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (!synthesisSupported()) return;
  window.speechSynthesis.cancel();
  activeUtterance = null;
}

export const isSpeaking = () => Boolean(activeUtterance);

/**
 * Voices load asynchronously in most browsers. Resolve once they are there so
 * the first tap on "read aloud" is not silent.
 */
export function warmVoices() {
  if (!synthesisSupported()) return Promise.resolve([]);
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) return resolve(existing);
    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}
