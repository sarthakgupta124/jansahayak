import { Fragment, useEffect, useRef, useState } from 'react';
import { speak, stopSpeaking, synthesisSupported } from './speech.js';
import { motionWelcome, useLang } from './ui.jsx';

/* ==================================================================
 * THE SHOWCASE
 *
 * Fifteen seconds of the product working, so a visitor who will never click
 * "Open a case" still sees what it does: someone speaks in Kannada, the intake
 * resolves, the documents are cross-checked against each other, and a verdict
 * comes back naming the rule that failed.
 *
 * Three commitments carried over from the rest of the build:
 *
 *   1. It tells the truth about the deployment it is running on. The extraction
 *      caption reads the live mode rather than asserting "AI" — if no vision
 *      model is configured, it says so on screen.
 *   2. The intake step is labelled as deterministic cue matching, because that
 *      is what it is. Calling it AI would be a nicer sentence and a false one.
 *   3. Motion is an enhancement. With reduced motion, no JS, or a hidden tab,
 *      the whole thing renders as a static four-panel storyboard instead of a
 *      blank stage waiting for a timer that will never fire.
 *
 * AUDIO. The Kannada line is a pre-rendered file, not a live API call — which
 * is the same argument this product makes everywhere else: generate once per
 * (phrase x language), serve it flat, and the cost stops scaling with users.
 * `npm run voice` renders it from ElevenLabs. Without that file we fall back to
 * the browser's own Kannada synthesis (on a click), and failing that, to captions.
 * Scrolling into the section tries to start the pre-rendered clip; if the browser
 * blocks autoplay with sound, the visuals still run and the play button remains.
 * When voice plays, the speak scene holds until the clip ends, then intake →
 * documents → verdict advance in sequence.
 * ================================================================== */

const AUDIO_SRC = '/audio/lakshmi-intake-kn.mp3';

/* Lakshmi's line as she would actually say it — Kannada with the English words
   that any Bengaluru speaker uses inside a Kannada sentence. */
const SPOKEN_KN = 'ಸರ್, ನಾನು ಅಪ್ಪನ ಮನೆಯ ಖಾತಾ ಟ್ರಾನ್ಸ್‌ಫರ್ ಮಾಡ್ಬೇಕು. ಅಪ್ಪ ಕಳೆದ ನವೆಂಬರ್‌ನಲ್ಲಿ ತೀರಿಕೊಂಡ್ರು. ಮನೆ ಬ್ರೂಕ್‌ಫೀಲ್ಡ್‌ನಲ್ಲಿ ಇದೆ, ಅದನ್ನ ಮಾರ್ಬೇಕು. ಪೇಪರ್ಸ್ ಎಲ್ಲಾ ಇದೆ.';

const SCENES = ['speak', 'intake', 'documents', 'verdict'];

/** Silent autoplay / replay without voice — fixed beats from t=0. */
const SILENT_MARKS = [0, 5600, 9200, 13800];
const SILENT_RUNTIME = 19000;

/**
 * After the Kannada line finishes, advance the remaining product beats.
 * Speak stays on screen for the whole clip (~11s for the shipped MP3).
 */
const AFTER_VOICE = {
  intake: 450,
  documents: 4000,
  verdict: 8600,
  ring: 8850,
  done: 13800
};

/* ------------------------------------------------------------------ *
 * Scene 1 — she speaks
 * ------------------------------------------------------------------ */

function SceneSpeak({ t, listening }) {
  const words = SPOKEN_KN.split(' ');
  return (
    <div className="sc sc-speak">
      <div className="sc-mic" aria-hidden="true">
        <span className="mic-halo" />
        <span className="mic-halo two" />
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
        </svg>
      </div>

      <div className="wave" aria-hidden="true">
        {Array.from({ length: 32 }, (_, i) => (
          <span key={i} style={{ '--i': i, '--h': 18 + ((i * 37) % 62) }} />
        ))}
      </div>

      {/* The space MUST sit outside the span. These are inline-block, and
          trailing whitespace inside an inline-block box is trimmed — which ran
          every word of the sentence together. */}
      <p className="sc-caption" lang="kn">
        {words.map((word, i) => (
          <Fragment key={`${word}-${i}`}>
            <span style={{ '--w': Math.min(i, 24) }}>{word}</span>
            {i < words.length - 1 ? ' ' : ''}
          </Fragment>
        ))}
      </p>
      <p className="sc-gloss">{t('show.speakGloss')}</p>
      <span className="sc-tag">{listening ? t('show.listening') : t('show.speakTag')}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Scene 2 — the intake resolves
 * ------------------------------------------------------------------ */

function SceneIntake({ t }) {
  const fields = [
    ['show.fService', 'show.vService'],
    ['show.fKind', 'show.vKind'],
    ['show.fArea', 'show.vArea'],
    ['show.fUrgency', 'show.vUrgency']
  ];
  return (
    <div className="sc sc-intake">
      <span className="sc-step">{t('show.intakeStep')}</span>
      <h3>{t('show.intakeTitle')}</h3>
      <div className="chips">
        {fields.map(([label, value], i) => (
          <div className="chip" key={label} style={{ '--c': i }}>
            <span className="chip-k">{t(label)}</span>
            <span className="chip-v">{t(value)}</span>
          </div>
        ))}
      </div>
      {/* Named accurately. This step is cue matching, not a model. */}
      <p className="sc-note">{t('show.intakeNote')}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Scene 3 — the documents are read and cross-checked
 * ------------------------------------------------------------------ */

function SceneDocuments({ t, extractionLabel }) {
  const docs = ['show.dDeed', 'show.dKhata', 'show.dTax', 'show.dDeath', 'show.dAadhaar'];
  return (
    <div className="sc sc-docs">
      <span className="sc-step">{t('show.docsStep')}</span>
      <h3>{t('show.docsTitle')}</h3>

      <div className="doc-strip">
        {docs.map((key, i) => (
          <div className="doc-mini" key={key} style={{ '--d': i }}>
            <span className="doc-scan" aria-hidden="true" />
            <i /><i /><i />
            <span className="doc-mini-name">{t(key)}</span>
          </div>
        ))}
      </div>

      {/* The consistency graph, made visible: two documents spell one name two
          ways, and the engine decides they are the same person. */}
      <div className="match">
        <span className="match-side">Ramesh&nbsp;Murthy</span>
        <svg className="match-link" viewBox="0 0 120 24" aria-hidden="true">
          <path d="M4 12h112" pathLength="1" />
        </svg>
        <span className="match-side">M.&nbsp;Ramesh</span>
        <span className="match-verdict">{t('show.sameName')}</span>
      </div>

      <p className="sc-note">{extractionLabel}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Scene 4 — the verdict
 * ------------------------------------------------------------------ */

function SceneVerdict({ t, pct }) {
  return (
    <div className="sc sc-verdict">
      <div className="sc-ring" style={{ '--pct': pct }}>
        <div className="sc-ring-in">
          <strong>2</strong>
          <span>{t('show.blocking')}</span>
        </div>
      </div>
      <div className="sc-verdict-copy">
        <span className="sc-step">{t('show.verdictStep')}</span>
        <h3>{t('show.verdictTitle')}</h3>
        <ul className="sc-findings">
          <li style={{ '--f': 0 }}><code>FMT-07</code>{t('show.find1')}</li>
          <li style={{ '--f': 1 }}><code>TAX-01</code>{t('show.find2')}</li>
        </ul>
        <p className="sc-punch">{t('show.punch')}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The stage
 * ------------------------------------------------------------------ */

export default function Showcase({ meta }) {
  const { t } = useLang();
  const [scene, setScene] = useState(0);
  const [running, setRunning] = useState(false);
  const [voice, setVoice] = useState('idle');   // idle | file | browser | none
  const [storyboard, setStoryboard] = useState(false);
  const [ringPct, setRingPct] = useState(0);
  const [hasClip, setHasClip] = useState(false);
  const [clipProbed, setClipProbed] = useState(false);

  const stageRef = useRef(null);
  const audioRef = useRef(null);
  const timers = useRef([]);
  const runId = useRef(0);
  const afterVoiceStarted = useRef(false);
  const autoStarted = useRef(false);
  const gestureReady = useRef(false);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const stopAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    try { el.pause(); el.currentTime = 0; } catch { /* ignore */ }
  };

  const scheduleSilent = () => {
    SILENT_MARKS.forEach((at, index) => {
      timers.current.push(setTimeout(() => setScene(index), at));
    });
    timers.current.push(setTimeout(() => setRingPct(51), SILENT_MARKS[3] + 250));
    timers.current.push(setTimeout(() => setRunning(false), SILENT_RUNTIME));
  };

  /** Intake → documents → verdict after the spoken line ends. */
  const scheduleAfterVoice = (token) => {
    if (runId.current !== token || afterVoiceStarted.current) return;
    afterVoiceStarted.current = true;
    setVoice('idle');
    timers.current.push(setTimeout(() => {
      if (runId.current !== token) return;
      setScene(1);
    }, AFTER_VOICE.intake));
    timers.current.push(setTimeout(() => {
      if (runId.current !== token) return;
      setScene(2);
    }, AFTER_VOICE.documents));
    timers.current.push(setTimeout(() => {
      if (runId.current !== token) return;
      setScene(3);
    }, AFTER_VOICE.verdict));
    timers.current.push(setTimeout(() => {
      if (runId.current !== token) return;
      setRingPct(51);
    }, AFTER_VOICE.ring));
    timers.current.push(setTimeout(() => {
      if (runId.current !== token) return;
      setRunning(false);
    }, AFTER_VOICE.done));
  };

  const startVoice = async (token, { allowBrowserFallback = true } = {}) => {
    const el = audioRef.current;
    // Only reach for the file if we know it is there. HTMLMediaElement.play()
    // does NOT reliably reject for a missing source — it can resolve and then
    // fire `error` on the element a tick later — so trusting the promise left
    // the UI claiming a pre-rendered clip was playing when nothing was.
    if (hasClip && el) {
      try {
        el.currentTime = 0;
        const onEnded = () => {
          el.removeEventListener('ended', onEnded);
          scheduleAfterVoice(token);
        };
        el.addEventListener('ended', onEnded);
        await el.play();
        if (runId.current !== token) return 'cancelled';
        setVoice('file');
        // If ended never fires (corrupt clip), unlock the rest of the demo.
        const fallbackMs = Number.isFinite(el.duration) && el.duration > 0
          ? Math.ceil(el.duration * 1000) + 800
          : 14000;
        timers.current.push(setTimeout(() => {
          el.removeEventListener('ended', onEnded);
          scheduleAfterVoice(token);
        }, fallbackMs));
        return 'file';
      } catch {
        // Autoplay with sound is often blocked until a user gesture.
        if (!allowBrowserFallback) return 'blocked';
      }
    }
    if (allowBrowserFallback && synthesisSupported()) {
      speak(SPOKEN_KN, {
        locale: 'kn-IN',
        onEnd: () => scheduleAfterVoice(token)
      });
      if (runId.current !== token) return 'cancelled';
      setVoice('browser');
      return 'browser';
    }
    setVoice('none');
    return 'none';
  };

  const play = async (withVoice = false, { fromScroll = false } = {}) => {
    clearTimers();
    stopSpeaking();
    stopAudio();
    const token = ++runId.current;
    afterVoiceStarted.current = false;
    setScene(0);
    setRingPct(0);
    setRunning(true);
    setVoice('idle');

    if (!withVoice) {
      scheduleSilent();
      return;
    }

    const mode = await startVoice(token, { allowBrowserFallback: !fromScroll });
    if (runId.current !== token) return;
    // No usable voice (or autoplay blocked) — still run the product beats.
    if (mode === 'none' || mode === 'blocked') scheduleSilent();
  };

  /* Probe the clip, then try to start with sound the first time the stage is
     scrolled into view. If motion is unwelcome we show the storyboard instead.
     Autoplay with audio is best-effort: browsers may refuse until a click. */
  useEffect(() => {
    let cancelled = false;
    const isAudio = (response) => {
      const type = response.headers.get('content-type') || '';
      return response.ok && type.startsWith('audio/');
    };
    fetch(AUDIO_SRC, { method: 'HEAD' })
      .then(async (r) => {
        if (isAudio(r)) {
          if (!cancelled) { setHasClip(true); setClipProbed(true); }
          return;
        }
        const probe = await fetch(AUDIO_SRC, { headers: { Range: 'bytes=0-1' } });
        if (!cancelled) {
          setHasClip(isAudio(probe));
          setClipProbed(true);
        }
      })
      .catch(() => {
        if (!cancelled) { setHasClip(false); setClipProbed(true); }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!clipProbed) return undefined;
    const node = stageRef.current;
    if (!node) return undefined;
    if (!motionWelcome() || typeof IntersectionObserver === 'undefined') {
      setStoryboard(true);
      return undefined;
    }

    const tryStart = () => {
      if (autoStarted.current) return;
      autoStarted.current = true;
      play(true, { fromScroll: true });
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      tryStart();
    }, { threshold: 0.35 });
    observer.observe(node);

    // Browsers often refuse sound until any prior gesture on the page. If the
    // first scroll-in was silent, the next click/tap retries with voice once.
    const onGesture = () => {
      gestureReady.current = true;
      if (voiceRef.current === 'file' || voiceRef.current === 'browser') {
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
        return;
      }
      if (!hasClip || !audioRef.current) return;
      const rect = node.getBoundingClientRect();
      const visible = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
      if (!visible) return;
      play(true, { fromScroll: false });
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture);

    return () => {
      observer.disconnect();
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      clearTimers();
      stopSpeaking();
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipProbed, hasClip]);

  useEffect(() => () => { clearTimers(); stopSpeaking(); stopAudio(); }, []);

  /* Says what actually ran on this deployment rather than claiming "AI". */
  const extractionLabel = meta?.extraction?.visionFallback
    ? t('show.docsNoteVision').replace('{model}', meta?.extraction?.model || 'a vision model')
    : t('show.docsNoteManual');

  const current = SCENES[scene];

  return (
    <section className="showcase" id="demo" ref={stageRef}>
      <div className="section-head light">
        <span className="kicker">{t('show.kicker')}</span>
        <h2>{t('show.title')}</h2>
        <p>{t('show.sub')}</p>
      </div>

      <div className={`stage ${storyboard ? 'storyboard' : ''}`}>
        <ol className="stage-rail" aria-hidden="true">
          {SCENES.map((id, i) => (
            <li key={id} className={i === scene && !storyboard ? 'on' : i < scene || storyboard ? 'done' : ''} />
          ))}
        </ol>

        <div className="stage-screen">
          {storyboard ? (
            <>
              <SceneSpeak t={t} listening={false} />
              <SceneIntake t={t} />
              <SceneDocuments t={t} extractionLabel={extractionLabel} />
              <SceneVerdict t={t} pct={51} />
            </>
          ) : (
            <div className="scene-slot" key={current}>
              {current === 'speak' && <SceneSpeak t={t} listening={running} />}
              {current === 'intake' && <SceneIntake t={t} />}
              {current === 'documents' && <SceneDocuments t={t} extractionLabel={extractionLabel} />}
              {current === 'verdict' && <SceneVerdict t={t} pct={ringPct} />}
            </div>
          )}
        </div>

        <div className="stage-controls">
          <button type="button" className="btn primary" onClick={() => play(true)}>
            <span aria-hidden="true">▶</span> {t('show.withVoice')}
          </button>
          <button type="button" className="btn secondary" onClick={() => play(false)}>
            {running ? t('show.replaying') : t('show.replay')}
          </button>
          <span className="stage-note">
            {voice === 'browser' && t('show.voiceBrowser')}
            {voice === 'none' && t('show.voiceNone')}
            {voice === 'idle' && !hasClip && t('show.voiceNoClip')}
          </span>
        </div>

        {/* preload metadata once we know the clip exists so scroll-autoplay can start promptly */}
        <audio
          ref={audioRef}
          src={AUDIO_SRC}
          preload={hasClip ? 'auto' : 'none'}
          onError={() => setHasClip(false)}
        />
      </div>
    </section>
  );
}
