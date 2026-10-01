import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { makeT, speechLocale, LANGS } from './i18n.js';
import { speak, stopSpeaking, synthesisSupported } from './speech.js';

/* ------------------------------------------------------------------ *
 * Language context
 * ------------------------------------------------------------------ */

export const LanguageContext = createContext({ language: 'en', setLanguage: () => {}, t: makeT('en') });
export const useLang = () => useContext(LanguageContext);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try { return localStorage.getItem('jansahayak:lang') || 'hi'; } catch { return 'hi'; }
  });
  const setLanguage = (next) => {
    setLanguageState(next);
    try { localStorage.setItem('jansahayak:lang', next); } catch { /* private mode */ }
    document.documentElement.lang = next;
  };
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: makeT(language), locale: speechLocale(language) }}>
      {children}
    </LanguageContext.Provider>
  );
}

/* ------------------------------------------------------------------ *
 * Chrome
 * ------------------------------------------------------------------ */

export function MockBanner() {
  const { t } = useLang();
  return (
    <div className="mock-banner" role="note">
      <span className="mock-dot" aria-hidden="true" />
      <span>{t('banner.text')}</span>
      <a href="#/register">{t('banner.link')} →</a>
    </div>
  );
}

export function LanguageSwitch({ compact }) {
  const { language, setLanguage } = useLang();
  return (
    <div className={`lang-switch ${compact ? 'compact' : ''}`} role="group" aria-label="Language">
      {LANGS.map((entry) => (
        <button
          key={entry.code}
          type="button"
          className={entry.code === language ? 'on' : ''}
          aria-pressed={entry.code === language}
          onClick={() => { stopSpeaking(); setLanguage(entry.code); }}
        >
          {entry.native}
        </button>
      ))}
    </div>
  );
}

/**
 * The JanSahayak mark.
 *
 * A helping hand (sahayak) reaching toward the citizen — a bridge between
 * the citizen and the state system. Jan = people, Sahayak = helper.
 */
export function BrandMark({ size = 30 }) {
  return (
    <svg
      className="brand-glyph"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label="JanSahayak"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" className="glyph-bg" />
      {/* hand reaching / helping gesture */}
      <path d="M8 22 Q10 14 16 12 Q22 10 24 18" className="glyph-detour" fill="none" strokeWidth="2" strokeLinecap="round" strokeDasharray="2.6 3.2" />
      {/* direct path — straight through */}
      <path d="M8 22h14" className="glyph-straight glyph-line" fill="none" strokeWidth="3" strokeLinecap="round" />
      <path d="m18.5 18 3.5 4-3.5 4" className="glyph-straight glyph-arrow" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ small }) {
  return (
    <a className={`brand ${small ? 'small' : ''}`} href="#/" aria-label="JanSahayak — home">
      <BrandMark size={small ? 26 : 30} />
      <span className="brand-word">
        Jan<em lang="hi">सहायक</em>
      </span>
    </a>
  );
}

export function SiteNav() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-nav">
      <Brand />
      <button className="nav-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        <span className="sr-only">Menu</span>
      </button>
      <nav className={open ? 'open' : ''} onClick={() => setOpen(false)}>
        <NavSectionLink route="/how">{t('nav.how')}</NavSectionLink>
        <NavSectionLink route="/mocks">{t('nav.mocks')}</NavSectionLink>
        <NavSectionLink route="/rulebook">{t('nav.ledger')}</NavSectionLink>
        <NavSectionLink route="/index">{t('nav.index')}</NavSectionLink>
        <LanguageSwitch compact />
        <a className="nav-cta" href="#/start">{t('nav.start')}</a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Brand small />
        <p>An independent prototype for a public-service problem in Bhopal, Madhya Pradesh. Not affiliated with, endorsed by, or connected to any government body. No government logo is used anywhere in this product, and no government system is accessed by it.</p>
      </div>
      <div className="footer-links">
        <NavSectionLink route="/mocks">Everything that is mocked</NavSectionLink>
        <NavSectionLink route="/rulebook">The rulebook</NavSectionLink>
        <NavSectionLink route="/index">Friction index</NavSectionLink>
        <NavSectionLink route="/how">How it works</NavSectionLink>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export function Button({ kind = 'primary', busy, children, ...props }) {
  return (
    <button className={`btn ${kind} ${busy ? 'busy' : ''}`} disabled={busy || props.disabled} {...props}>
      {busy && <span className="btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Notice({ tone = 'info', title, children }) {
  return (
    <div className={`notice-box ${tone}`} role={tone === 'error' ? 'alert' : 'note'}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="spinner-row" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** A read-aloud control. Present next to anything a citizen must understand. */
export function SpeakButton({ text, label }) {
  const { locale, t } = useLang();
  const [on, setOn] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!synthesisSupported()) return null;
  return (
    <button
      type="button"
      className={`speak-btn ${on ? 'on' : ''}`}
      aria-label={label || t('common.listen')}
      title={label || t('common.listen')}
      onClick={() => {
        if (on) { stopSpeaking(); setOn(false); return; }
        setOn(true);
        speak(text, { locale, onEnd: () => setOn(false) });
      }}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        {on ? <path d="M17 9l4 6M21 9l-4 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
      </svg>
      <span>{on ? t('common.stop') : t('common.listen')}</span>
    </button>
  );
}

export function SeverityBadge({ severity }) {
  const { t } = useLang();
  // Short form on the chip. The long phrasing belongs on the group heading, and
  // repeating it on every card just made the same sentence appear twice.
  const label = { blocks: t('sev.blocks'), delays: t('sev.delays'), advisory: t('sev.advisory') }[severity];
  return <span className={`sev sev-${severity}`}>{label}</span>;
}

/**
 * "Why this answer" — the expander that has to exist on every verdict.
 * It shows the rule id, the documents and fields that disagreed, and the
 * source the requirement came from. Without this the product is asking to be
 * trusted; with it, it is showing its work.
 */
export function WhyThisAnswer({ finding }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const evidence = finding.evidence || {};
  return (
    <div className={`why ${open ? 'open' : ''}`}>
      <button type="button" className="why-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="why-icon" aria-hidden="true">{open ? '−' : '+'}</span>
        {t('check.why')}
        <code>{finding.ruleId}</code>
      </button>
      {open && (
        <div className="why-body">
          {evidence.note && <p className="why-note">{evidence.note}</p>}
          {evidence.comparison && <p className="why-compare"><code>{evidence.comparison}</code></p>}
          {Array.isArray(evidence.documents) && evidence.documents.length > 0 && (
            <table className="why-table">
              <thead><tr><th>Document</th><th>Field</th><th>Value read</th></tr></thead>
              <tbody>
                {evidence.documents.map((doc, i) => (
                  <tr key={`${doc.kind}-${doc.field}-${i}`}>
                    <td>{doc.fileName || doc.kind}</td>
                    <td><code>{doc.field}</code></td>
                    <td>{doc.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <dl className="why-meta">
            <div><dt>{t('check.rule')}</dt><dd><code>{finding.ruleId}</code> · {finding.rulePack}</dd></div>
            {finding.citation && (
              <div>
                <dt>{t('check.source')}</dt>
                <dd>
                  {finding.citation.source}
                  <span className={`verified ${finding.citation.verified ? 'yes' : 'no'}`}>
                    {finding.citation.verified ? `verified ${finding.citation.lastVerified}` : 'not traced to a published clause'}
                  </span>
                </dd>
              </div>
            )}
          </dl>
          <p className="why-arch">No language model took part in this verdict. A deterministic rule compared the fields above and returned code <code>{finding.code}</code>; this page only translated that code into your language.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, '') || '/');
  useEffect(() => {
    const handler = () => {
      setRoute(window.location.hash.replace(/^#/, '') || '/');
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  // navigate(to) pushes a history entry; navigate(to, { replace: true }) swaps
  // the current one. Replace matters when a route is only being canonicalised
  // — rewriting "/case" to "/case/intake" by pushing would leave "/case" behind
  // in the history, and pressing Back onto it would just redirect forward
  // again, trapping the user on the first step.
  return [route, (next, { replace = false } = {}) => {
    if (replace) window.location.replace(next.startsWith('#') ? next : `#${next}`);
    else window.location.hash = next;
  }];
}

/** Nav routes that open the landing page at a specific infographic section. */
export const LANDING_SECTION_ROUTES = {
  '/how': 'how',
  '/mocks': 'honesty',
  '/rulebook': 'architecture',
  '/index': 'why'
};

export function landingSectionForRoute(route = '') {
  const normalized = route.startsWith('/') ? route : `/${route}`;
  for (const [path, section] of Object.entries(LANDING_SECTION_ROUTES)) {
    if (normalized === path || normalized.startsWith(`${path}/`)) return section;
  }
  return null;
}

export function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Scroll to the three demo persona cards on the landing page. */
export function scrollToPersonas() {
  scrollToSection('personas');
}

export function NavSectionLink({ route, className = '', children }) {
  const href = `#${route}`;
  const section = LANDING_SECTION_ROUTES[route];
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        if (window.location.hash === href) scrollToSection(section);
      }}
    >
      {children}
    </a>
  );
}

/**
 * Should this visit get entrance animation at all?
 *
 * No, if the reader asked for reduced motion — and no, if the document is
 * hidden right now. A page opened into a background tab does not composite, so
 * CSS animations never advance; with `animation-fill-mode: both` that leaves
 * every staged element frozen at opacity 0. Someone middle-clicking the link
 * and switching to the tab a minute later would find a blank page.
 *
 * The entrance is a nicety. Being able to read the page is not.
 */
export const motionWelcome = () => typeof window !== 'undefined'
  && document.visibilityState === 'visible'
  && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Staged entrance for a section.
 *
 * The markup renders finished. This opts the section INTO the animation after
 * mount, and opts it back out once the sequence has had time to play — so a
 * paused or broken timeline resolves to the finished page rather than a blank
 * one, and `will-change` does not linger on a dozen elements forever.
 */
export function useStagedEntrance(totalMs = 2600) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !motionWelcome()) return undefined;
    node.dataset.stage = 'on';
    const done = setTimeout(() => { delete node.dataset.stage; }, totalMs);
    return () => clearTimeout(done);
  }, [totalMs]);
  return ref;
}

/**
 * A number that counts up when it scrolls into view.
 *
 * Renders its FINAL value on first paint and only drops to zero inside a
 * layout effect, so there is no flash of the wrong number and no frame where a
 * statistic reads as something it is not. If motion is unwelcome, the observer
 * is unavailable, or nothing ever fires, the real value simply stays on screen.
 */
export function Counter({ to, duration = 1200, className }) {
  const target = Number(to) || 0;
  const [value, setValue] = useState(target);
  const ref = useRef(null);
  const raf = useRef();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !motionWelcome() || typeof IntersectionObserver === 'undefined') {
      setValue(target);
      return undefined;
    }
    if (target === 0) return undefined;   // nothing to count to

    setValue(0);
    let finished = false;
    const settle = () => { finished = true; setValue(target); };

    const run = () => {
      if (finished) return;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        setValue(Math.round(target * (1 - (1 - progress) ** 3)));
        if (progress < 1) raf.current = requestAnimationFrame(tick);
        else finished = true;
      };
      raf.current = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { observer.disconnect(); run(); }
    }, { threshold: 0.35 });
    observer.observe(node);

    // Never leave a statistic reading zero because a frame never came.
    const failsafe = setTimeout(settle, 5000);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf.current);
      clearTimeout(failsafe);
    };
  }, [target, duration]);

  return <span ref={ref} className={className}>{value}</span>;
}

/**
 * Returns 0 on the first paint and the real value on the next frame, so a CSS
 * transition has something to travel from. Used for the progress rings, whose
 * fill is a custom property rather than a layout value.
 *
 * Falls straight through to the real value when motion is unwelcome.
 */
export function useTransitionedValue(target, delay = 90) {
  const [value, setValue] = useState(() => (motionWelcome() ? 0 : target));
  useEffect(() => {
    if (!motionWelcome()) { setValue(target); return undefined; }
    const timer = setTimeout(() => setValue(target), delay);
    const failsafe = setTimeout(() => setValue(target), 2500);
    return () => { clearTimeout(timer); clearTimeout(failsafe); };
  }, [target, delay]);
  return value;
}

/**
 * Reveal-on-scroll, built so it can never strand content invisible.
 *
 * The element renders fully visible. Only once JS has run does it mark itself
 * hidden and hand itself to an IntersectionObserver — so a failed script, a
 * browser without IntersectionObserver, or a reader who has asked for reduced
 * motion all get plain visible content rather than a blank column. A long
 * failsafe covers the remaining case where the observer exists but never fires.
 *
 * This matters more here than on a normal marketing page: the thing being
 * revealed is somebody's explanation of why their property transfer is stuck.
 */
export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, revealDisabled = false, ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    if (revealDisabled) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    if (!motionWelcome()) return undefined;

    node.dataset.reveal = 'out';
    const show = () => { node.dataset.reveal = 'in'; };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { show(); observer.disconnect(); }
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    observer.observe(node);

    const failsafe = setTimeout(show, 6000);
    return () => { observer.disconnect(); clearTimeout(failsafe); };
  }, []);

  return (
    <Tag
      ref={ref}
      className={className}
      style={revealDisabled ? undefined : { transitionDelay: `${delay}ms` }}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}

export function OfflineBar() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-bar" role="alert">
      You are offline. What is already on this screen stays readable — including every fix and where to get it. New checks will run when you reconnect.
    </div>
  );
}

export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/* ------------------------------------------------------------------ *
 * Infographics — animated SVG primitives for landing sections
 * ------------------------------------------------------------------ */

/** Animated donut chart. Segments: [{ value, color, label }]. */
export function DonutChart({ segments, size = 160, stroke = 18, className = '' }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg className={`donut ${className}`} viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const len = (seg.value / total) * c;
        const dash = `${len} ${c - len}`;
        const rot = (offset / total) * 360 - 90;
        offset += seg.value;
        return (
          <circle
            key={seg.label || i}
            className="donut-seg"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={dash}
            strokeDashoffset={0}
            transform={`rotate(${rot} ${size / 2} ${size / 2})`}
            style={{ '--seg-len': len, '--seg-c': c, animationDelay: `${i * 0.12}s` }}
          />
        );
      })}
    </svg>
  );
}

/** Horizontal bar for comparisons. Value 0–100. */
export function CompareBar({ value, color = 'var(--deep)', label, sublabel, delay = 0 }) {
  return (
    <div className="compare-bar" style={{ '--bar-delay': `${delay}ms` }}>
      <div className="compare-bar-head">
        <span className="compare-bar-label">{label}</span>
        {sublabel && <span className="compare-bar-sub">{sublabel}</span>}
      </div>
      <div className="compare-bar-track">
        <div className="compare-bar-fill" style={{ '--pct': value, '--bar-color': color }} />
      </div>
    </div>
  );
}

/** Circular progress ring for stat highlights. */
export function RingStat({ value, max = 100, size = 72, stroke = 5, color = 'var(--deep)', children }) {
  const pct = Math.min(100, (value / max) * 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring-stat" style={{ '--ring-pct': pct, '--ring-color': color, width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          className="ring-stat-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-stat-inner">{children}</span>
    </div>
  );
}

/** Animated flow arrow for architecture diagrams. */
export function FlowArrow({ active }) {
  return (
    <div className={`flow-arrow ${active ? 'active' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 48 24" width="48" height="24" fill="none">
        <path className="flow-arrow-line" d="M2 12h38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path className="flow-arrow-head" d="M34 6l8 6-8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle className="flow-arrow-dot" cx="12" cy="12" r="3" fill="var(--lime)" />
      </svg>
    </div>
  );
}
