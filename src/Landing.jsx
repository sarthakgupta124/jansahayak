import { Fragment, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Showcase from './Showcase.jsx';
import { FALLBACK_META } from './demo-meta.js';
import { Brand, Button, Counter, FlowArrow, LanguageSwitch, Reveal, RingStat, scrollToSection, SiteFooter, SiteNav, SpeakButton, useLang, useStagedEntrance, rupees } from './ui.jsx';

function officeMapsHref(candidate) {
  return candidate.mapsUrl
    || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${candidate.office}, Bhopal, Madhya Pradesh, India`)}`;
}

/* ------------------------------------------------------------------ *
 * The hero's live office lookup.
 *
 * This is the most important element on the page and it is deliberately placed
 * above everything else, with no sign-in, no email capture and no case.
 * "Which office holds my file" is precisely the question a middleman monetises
 * since BBMP became five corporations. Giving the answer away in the hero,
 * before asking for anything at all, is the argument.
 * ------------------------------------------------------------------ */

function OfficeLookup() {
  const { t } = useLang();
  const [value, setValue] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [localities, setLocalities] = useState([]);

  useEffect(() => {
    api.meta().then((m) => setLocalities(m.localities || [])).catch(() => {});
  }, []);

  const run = async (address) => {
    const query = (address ?? value).trim();
    if (!query) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const { jurisdiction } = await api.publicLookup(query);
      setResult(jurisdiction);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="lookup">
      <div className="lookup-head">
        <span className="lookup-tag">{t('lookup.tag')}</span>
        <h2>{t('lookup.title')}</h2>
        <p>{t('lookup.sub')}</p>
      </div>

      <form className={`lookup-form ${busy ? 'is-busy' : ''}`} onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('lookup.placeholder')}
          aria-label={t('lookup.placeholder')}
          autoComplete="off"
          list="locality-list"
        />
        <datalist id="locality-list">
          {localities.map((name) => <option key={name} value={name} />)}
        </datalist>
        <Button type="submit" busy={busy}>{busy ? t('lookup.trying') : t('lookup.button')}</Button>
        {busy && <div className="lookup-scan" aria-hidden="true"><span /><span /><span /></div>}
      </form>

      <div className="lookup-chips">
        {['Arera Colony', 'TT Nagar', 'Govindpura', 'Bairagarh'].map((chip) => (
          <button key={chip} type="button" onClick={() => { setValue(chip); run(chip); }}>{chip}</button>
        ))}
      </div>

      {error && <p className="lookup-error">{error}</p>}

      {result && (
        <div className={`lookup-result ${result.confidence}`}>
          <div className="lookup-verdict">
            <span className={`conf conf-${result.confidence}`}>
              {result.confidence === 'resolved' && 'Resolved'}
              {result.confidence === 'contested' && 'Boundary case'}
              {result.confidence === 'unresolved' && 'Not placed'}
              {result.confidence === 'outside-coverage' && 'Outside the city corporations'}
            </span>
            <p>{result.message}</p>
          </div>

          {result.candidates?.map((candidate, index) => (
            <div className="office-card" key={candidate.corporationId} style={{ '--card-i': index }}>
              {result.candidates.length > 1 && (
                <span className="office-order">{index === 0 ? t('office.tryFirst') : t('office.alternate')}</span>
              )}
              <strong>{candidate.corporation}</strong>
              <span className="office-zone">{candidate.zone}</span>
              <span className="office-counter">{candidate.office}</span>
              <a className="office-maps" href={officeMapsHref(candidate)} target="_blank" rel="noopener noreferrer">
                Open in Google Maps <span aria-hidden="true">↗</span>
              </a>
              {index === 0 && candidate.previousWard && <span className="office-ward">Formerly {candidate.previousWard}</span>}
            </div>
          ))}

          {result.nextStep && <p className="lookup-next">{result.nextStep}</p>}

          {result.confidence === 'unresolved' && (
            <details className="lookup-known">
              <summary>{t('office.known')} ({result.knownLocalities?.length})</summary>
              <p>{result.knownLocalities?.join(' · ')}</p>
            </details>
          )}

          <p className="lookup-caveat">
            Boundary geometry here is approximate — we say so on <a href="#/register">the mock register</a> rather than in a footnote nobody reads. When a property sits within 1.5 km of a divide we name both offices instead of guessing.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The right-hand visual.
 *
 * Two claims, shown rather than written. Five document fragments lying at odd
 * angles pull themselves into an ordered, checked stack — that is the whole
 * product in one gesture. Then the fee the agent quoted is struck through and
 * replaced.
 *
 * Everything renders in its FINISHED state by default; the animation only runs
 * when the hero has opted into staging. A stalled timeline shows a neat stack
 * and the corrected price, never scattered paper frozen mid-air.
 * ------------------------------------------------------------------ */

function PriceCut() {
  const { t } = useLang();
  return (
    <figure className="pricecut">
      <div className="shards" role="img" aria-label={t('cut.gathered')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`shard s${n}`} aria-hidden="true">
            <i /><i /><i /><i />
          </span>
        ))}
        <span className="seal" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.6 4.5L19 7.5" />
          </svg>
        </span>
      </div>

      <figcaption className="cut">
        <span className="cut-side was">
          <s>₹3,000&ndash;15,000</s>
          <em>{t('cut.was')}</em>
        </span>
        <span className="cut-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
        <span className="cut-side now">
          <b>₹500</b>
          <em>{t('cut.now')}</em>
        </span>
      </figcaption>

      <p className="cut-note">{t('cut.refund')}</p>
    </figure>
  );
}

/* ------------------------------------------------------------------ *
 * The money moment
 * ------------------------------------------------------------------ */

function PriceContrast() {
  return (
    <section className="price" id="price">
      <div className="price-head">
        <span className="kicker">The itemised bill</span>
        <h2>What that fee actually buys.</h2>
        <p>
          Three facts, each already published by the state, none of them findable by the
          person who needs them. Priced by the state at nothing.
        </p>
      </div>

      <Reveal className="price-viz" delay={0}>
        <div className="price-compare">
          <div className="price-col agent">
            <span className="price-col-label">What agents quote</span>
            <div className="price-stack">
              <div className="price-stack-bar" style={{ '--h': 100 }}>
                <span>₹3,000–15,000</span>
              </div>
            </div>
            <em>Opaque bundle — no itemisation</em>
          </div>
          <div className="price-col-arrow" aria-hidden="true">
            <svg viewBox="0 0 32 24" width="32" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 12h20M20 7l6 5-6 5" />
            </svg>
          </div>
          <div className="price-col state">
            <span className="price-col-label">What the state charges</span>
            <div className="price-stack">
              <div className="price-stack-bar zero" style={{ '--h': 8 }}><span>₹0</span></div>
              <div className="price-stack-bar zero" style={{ '--h': 8 }}><span>₹0</span></div>
              <div className="price-stack-bar zero" style={{ '--h': 8 }}><span>₹0</span></div>
            </div>
            <em>Three public facts — already yours</em>
          </div>
        </div>
      </Reveal>

      <ol className="tax-list">
        <Reveal as="li" delay={0}>
          <span className="tax-what">Which zone office holds your property record</span>
          <span className="tax-where">Published. Resolvable from your address in about a second.</span>
          <span className="tax-price">₹0</span>
        </Reveal>
        <Reveal as="li" delay={120}>
          <span className="tax-what">Which document is actually wrong, and why</span>
          <span className="tax-where">A notified checklist, plus consistency the counter checks silently.</span>
          <span className="tax-price">₹0</span>
        </Reveal>
        <Reveal as="li" delay={240}>
          <span className="tax-what">That you have a 30-day right, and how to enforce it</span>
          <span className="tax-where">MP Public Services Guarantee Act. Almost nobody claims it.</span>
          <span className="tax-price">₹0</span>
        </Reveal>
      </ol>

      <div className="tax-total">
        <p>
          <strong>This part is an information tax.</strong> Not corruption — just three public
          facts with no route to the person who needs them, and it is the part software can
          delete outright. We cannot tell you what share of any given fee it is, because
          nobody can measure that honestly. The rest — somebody genuinely sitting on your
          file — is what the clock is for, and the clock is slower than cash. We do not
          pretend otherwise.
        </p>
        <span className="price-note">
          Intended product fee: <strong>₹500</strong> for the route — refunded if the work
          does not get done. Payment is not wired in this prototype yet (no checkout).
          Government counter fees stay separate; see <a href="#/mocks">what is mocked</a>.
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * The evidence
 * ------------------------------------------------------------------ */

function Evidence() {
  const { locale } = useLang();
  const [hovered, setHovered] = useState(null);
  const spoken = 'Forty per cent of bribes paid in India are for property registration and land. But thirty eight per cent of people say they paid because it was the only way to get their work done. That is not a moral problem. It is a friction problem.';
  const stats = [
    { id: 'property', to: 40, label: 'of bribes paid in India are for property registration and land — the largest single category, ahead of police and municipal services.', big: true },
    { id: 'only-way', to: 38, label: <>of people who paid say it was <em>the only way to get their work done</em>.</> },
    { id: 'forced', to: 54, label: <>of businesses report being <em>forced</em> to pay. That is extortion, not willing bribery.</> }
  ];
  return (
    <section className="evidence" id="why">
      <div className="evidence-grid">
        {stats.map((stat, index) => (
          <Reveal
            key={stat.id}
            className={`stat ${stat.big ? 'big' : ''} ${hovered === stat.id ? 'hovered' : ''}`}
            delay={index * 130}
            onMouseEnter={() => setHovered(stat.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="stat-num"><Counter to={stat.to} /><i>%</i></span>
            <span className="stat-label">{stat.label}</span>
            <span className="stat-bar" style={{ '--stat-pct': stat.to }} aria-hidden="true" />
          </Reveal>
        ))}
      </div>
      <div className="evidence-claim">
        <p>
          Read that middle number again. Most of this money is not buying an unfair advantage.
          It is buying a service the state already owes you.
        </p>
        <p className="claim-punch">
          Which means it is not a moral problem to be shamed away.
          <strong> It is a friction problem, and friction can be engineered away.</strong>
        </p>
        <SpeakButton text={spoken} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * The three mechanics
 * ------------------------------------------------------------------ */

const MECHANICS = [
  {
    id: 'office',
    step: '01',
    title: 'Find the office that actually holds your file',
    body: 'BBMP was replaced by five city corporations. Your address is resolved against the corporation boundaries — and when it sits near a divide, you get both offices and which to try first, not a confident guess.',
    proof: 'Bengaluru East · Mahadevapura zone',
    proofLabel: 'Resolved from “42, Brookefield Main Road”'
  },
  {
    id: 'papers',
    step: '02',
    title: 'Find out what is wrong before they do',
    body: 'Forty-six deterministic rules compare names, survey numbers, property IDs, tax years, dates and stamp duty across every document you have. Each finding names the rule, the two documents that disagreed, and the exact field.',
    proof: '2 blocking · 1 objection · 5 worth knowing',
    proofLabel: 'A real result from the demo document set'
  },
  {
    id: 'clock',
    step: '03',
    title: 'Make the deadline do the pushing',
    body: 'Your acknowledgement number attaches a statutory deadline. When it lapses, the first appeal is already drafted — correct addressee, correct date arithmetic, your name at the bottom. You sign it. It is not as fast as paying someone, and we do not pretend otherwise — it is the only lever you have that costs nothing.',
    proof: 'Day 31 · appeal ready',
    proofLabel: 'The only pressure you have that is not money'
  }
];

const OFFICE_ZONES = [
  { name: 'Z-1', x: 20, y: 22 },
  { name: 'Z-2', x: 102, y: 22 },
  { name: 'Z-3', x: 184, y: 22, highlight: true },
  { name: 'Z-4', x: 20, y: 86 },
  { name: 'Z-5', x: 184, y: 86 }
];

function MechanicsVisual({ id }) {
  if (id === 'office') {
    return (
      <div className="mech-viz office-viz" aria-hidden="true">
        <svg viewBox="0 0 280 148" className="mech-svg">
          <rect className="mv-bg" x="8" y="8" width="264" height="132" rx="10" />
          {OFFICE_ZONES.map((zone) => (
            <g key={zone.name} className={zone.highlight ? 'mv-zone active' : 'mv-zone'}>
              <rect x={zone.x} y={zone.y} width="74" height="48" rx="6" />
              <text x={zone.x + 37} y={zone.y + 28} textAnchor="middle">{zone.name}</text>
            </g>
          ))}
          <circle className="mv-pin" cx="139" cy="74" r="7" />
          <circle className="mv-pulse" cx="139" cy="74" r="7" />
          <path className="mv-route" d="M139 81v10" />
          <rect className="mv-office" x="107" y="98" width="64" height="22" rx="5" />
          <text className="mv-office-label" x="139" y="112" textAnchor="middle">TT Nagar</text>
        </svg>
      </div>
    );
  }
  if (id === 'papers') {
    return (
      <div className="mech-viz papers-viz" aria-hidden="true">
        <div className="mv-docs">
          {['Sale deed', 'EC', 'Tax receipt', 'ID', 'NOC'].map((doc, i) => (
            <span key={doc} className="mv-doc" style={{ '--doc-i': i }}>{doc}</span>
          ))}
        </div>
        <div className="mv-checks">
          <span className="mv-check block"><i>2</i> blocking</span>
          <span className="mv-check warn"><i>1</i> objection</span>
          <span className="mv-check ok"><i>5</i> advisory</span>
        </div>
      </div>
    );
  }
  return (
    <div className="mech-viz clock-viz" aria-hidden="true">
      <svg viewBox="0 0 132 64" className="mech-svg">
        <circle className="mv-clock-ring" cx="32" cy="32" r="26" />
        <circle className="mv-clock-fill" cx="32" cy="32" r="26" />
        <text className="mv-clock-num" x="32" y="35">31</text>
        <text className="mv-clock-sub" x="32" y="43">days</text>
        <path className="mv-arrow-out" d="M62 32h5" />
        <path className="mv-doc-out" d="M70 20h24v36H70z" />
        <path className="mv-doc-fold" d="M70 20l9-7h15v7" />
        <text className="mv-appeal" x="82" y="41">Appeal</text>
      </svg>
    </div>
  );
}

function Mechanics() {
  const [active, setActive] = useState('office');
  const mechanic = MECHANICS.find((m) => m.id === active);
  return (
    <section className="mechanics" id="how">
      <div className="section-head">
        <span className="kicker">The three things that change</span>
        <h2>The counter should never be where you discover a problem.</h2>
      </div>
      <div className="mechanics-body">
        <div className="mechanics-tabs" role="tablist">
          {MECHANICS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={active === m.id}
              className={active === m.id ? 'on' : ''}
              onClick={() => setActive(m.id)}
            >
              <span className="tab-step">{m.step}</span>
              <span className="tab-title">{m.title}</span>
              <span className="tab-progress" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="mechanics-panel" role="tabpanel" key={active}>
          <MechanicsVisual id={active} />
          <p className="panel-body">{mechanic.body}</p>
          <div className="panel-proof">
            <span className="proof-label">{mechanic.proofLabel}</span>
            <strong>{mechanic.proof}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Architecture
 * ------------------------------------------------------------------ */

function Architecture() {
  const [activeNode, setActiveNode] = useState(null);
  const nodes = [
    { id: 'model', role: 'Model', title: 'Reads a photo into fields', body: 'Every value it reads is shown to you as an editable field first.', cls: 'model' },
    { id: 'you', role: 'You', title: 'Confirm each value', body: 'Nothing reaches a rule until a human has looked at it.', cls: 'you' },
    { id: 'engine', role: 'Engine', title: 'Decides, deterministically', body: '46 rules. Same input, same output, every time. Returns a code and an evidence trail.', cls: 'engine' },
    { id: 'ledger', role: 'Ledger', title: 'Turns the code into your language', body: '47 codes × 3 languages = 141 explanations that exist once, for everybody.', cls: 'ledger' }
  ];
  return (
    <section className="arch" id="architecture">
      <div className="section-head light">
        <span className="kicker">The one architectural commitment</span>
        <h2>Rules decide. The model only reads and explains.</h2>
        <p>
          A hallucinated “your papers are fine” costs someone a day of work, a bus fare, and the only
          leverage they had. So the model is never in the decision path.
        </p>
      </div>
      <div className="arch-flow">
        {nodes.map((node, i) => (
          <Fragment key={node.id}>
            <Reveal
              className={`arch-node ${node.cls} ${activeNode === node.id ? 'active' : ''}`}
              delay={i * 140}
              onMouseEnter={() => setActiveNode(node.id)}
              onMouseLeave={() => setActiveNode(null)}
              onClick={() => setActiveNode((v) => (v === node.id ? null : node.id))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveNode((v) => (v === node.id ? null : node.id)); } }}
            >
              <span className="node-role">{node.role}</span>
              <strong>{node.title}</strong>
              <p>{node.body}</p>
              <span className="node-glow" aria-hidden="true" />
            </Reveal>
            {i < nodes.length - 1 && <FlowArrow active={activeNode === node.id || activeNode === nodes[i + 1].id} />}
          </Fragment>
        ))}
      </div>
      <p className="arch-scale">
        That last line is also the scale answer. Because explanations are cached per defect code and not
        per citizen, serving one crore people costs the same model spend as serving ten thousand.
        Adding a second service means authoring another rule file — not writing another scraper.
        <a href="#/ledger">See all 47 codes →</a>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Personas
 * ------------------------------------------------------------------ */

function Personas({ personas, onStart, starting, standalone = false }) {
  const list = personas?.length ? personas : FALLBACK_META.personas;
  return (
    <section className={`personas ${standalone ? 'personas-standalone' : ''}`} id="personas">
      <div className="section-head">
        <span className="kicker">Two minutes, start to finish</span>
        <h2>Pick someone and walk their whole case.</h2>
        <p>Each one has a complete synthetic document set with real defects in it. The engine has not been told which is which.</p>
      </div>
      <div className="persona-grid">
        {list.map((persona, index) => (
          <Reveal
            as="button"
            key={persona.id}
            delay={index * 110}
            revealDisabled={standalone}
            className={`persona-card ${persona.resolvableByPaperwork ? '' : 'hard'}`}
            onClick={() => onStart(persona.id)}
            disabled={Boolean(starting)}
          >
            <span className="persona-avatar" aria-hidden="true">{persona.initial}</span>
            <span className="persona-name">{persona.name}</span>
            <span className="persona-head">{persona.headline}</span>
            <span className="persona-foot">
              <span className="persona-quote">Quoted {rupees(persona.quotedByAgent)}</span>
              <span className="persona-go">{starting === persona.id ? 'Opening…' : 'Walk this case →'}</span>
            </span>
            {!persona.resolvableByPaperwork && <span className="persona-flag">The hard case — cannot be fixed with better paperwork</span>}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Honesty strip
 * ------------------------------------------------------------------ */

function Honesty({ meta }) {
  return (
    <section className="honesty" id="honesty">
      <div className="honesty-inner">
        <div>
          <span className="kicker">Before you look for the seam</span>
          <h2>Here is where it is.</h2>
          <p>
            Every property record here is invented. Nothing is submitted to any office. No payment is taken.
            No government login is ever asked for, stored or used. The corporation boundaries are approximate
            envelopes, not official geometry. Appeals are drafted and downloadable — never delivered.
          </p>
          <p>
            The full register lists fourteen of these, each with what we do instead and what would replace it.
            If you find something on it we have not listed, that is a bug in the page.
          </p>
          <a className="btn ghost" href="#/register">Read the mock register →</a>
        </div>
        <ul className="honesty-facts">
          <li>
            <RingStat value={meta?.ruleCount ?? 46} max={50} color="var(--deep)"><Counter to={meta?.ruleCount ?? 46} /></RingStat>
            <span>deterministic rules, none of them a model call</span>
          </li>
          <li>
            <RingStat value={meta?.ledger?.codes ?? 47} max={50} color="var(--deep-2)"><Counter to={meta?.ledger?.codes ?? 47} /></RingStat>
            <span>defect codes, each with a cited source</span>
          </li>
          <li>
            <RingStat value={meta?.ledger?.unverifiedCitations ?? 12} max={47} color="var(--amber)"><Counter to={meta?.ledger?.unverifiedCitations ?? 12} /></RingStat>
            <span>of them marked “not traced to a published clause”, because they aren’t</span>
          </li>
          <li>
            <RingStat value={0} max={1} color="var(--ok)"><strong>0</strong></RingStat>
            <span>government systems contacted, ever</span>
          </li>
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Start — three demo cases, front and centre
 * ------------------------------------------------------------------ */

export function PersonaPicker({ meta, onStart, starting }) {
  return (
    <>
      <SiteNav />
      <main className="persona-picker">
        <Personas
          personas={meta?.personas}
          onStart={onStart}
          starting={starting}
          standalone
        />
        <p className="persona-picker-back">
          <a href="#/">← Back to home</a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function Landing({ meta, onStart, starting, focusSection }) {
  const { t } = useLang();
  // Opts the hero into its entrance animation after mount, and back out once
  // the sequence has played. See useStagedEntrance.
  const heroRef = useStagedEntrance(3600);

  useEffect(() => {
    if (!focusSection) return;
    const scroll = () => scrollToSection(focusSection);
    scroll();
    const retry = window.setTimeout(scroll, 400);
    return () => window.clearTimeout(retry);
  }, [focusSection]);

  return (
    <>
      <SiteNav />

      {/*
        The hook is the sentence itself.
        Every person this is built for has stood at a counter and heard it, and
        the whole product is the answer to the question it refuses to answer.
        So the sentence leads, in the language the reader chose, and the turn
        underneath it is the promise.
      */}
      <section className="hero" ref={heroRef}>
        <div className="hero-copy">
          <span className="hero-eyebrow">{t('hero.eyebrow')}</span>

          {/*
            Played straight. Read literally, "it" refers to bribery, so the line
            relies on the reader hearing the irony unaided — which is exactly why
            the gloss below is set at reading size in full-strength ink rather
            than as a caption. It names the ₹6,000 as the AGENT'S FEE, so the joke
            resolves into the actual claim within one line of being made.
          */}
          <h1 className="hero-head">
            <span className="head-price">{t('hero.price')}</span>
            <span className="head-claim">{t('hero.claim')}</span>
          </h1>

          <p className="hero-gloss">{t('hero.gloss')}</p>
          <ol className="hero-three">
            <li>{t('hero.item1')}</li>
            <li>{t('hero.item2')}</li>
            <li>{t('hero.item3')}</li>
          </ol>

          {/*
            The payoff. This is the answer to the question the headline asks, so
            it breaks out of the text column into its own panel rather than
            reading as one more paragraph. The offer is revealed word by word —
            the words are split here rather than in CSS because the split has to
            work in Kannada and Hindi too, and because a real space has to stay
            OUTSIDE each span or the line stops wrapping at 320px.
          */}
          <div className="hero-payoff">
            <p className="payoff-lead">{t('hero.turnLead')}</p>
            <p className="payoff-offer">
              {t('hero.turn').split(' ').map((word, index, all) => (
                <Fragment key={`${word}-${index}`}>
                  <span style={{ '--w': Math.min(index, 14) }}>{word}</span>
                  {index < all.length - 1 ? ' ' : ''}
                </Fragment>
              ))}
            </p>
          </div>

          <p className="hero-sub">{t('hero.sub')}</p>

          <div className="hero-actions">
            <Button kind="primary big" onClick={() => { window.location.hash = '#/start'; }}>
              {t('hero.cta')} <span aria-hidden="true">→</span>
            </Button>
          </div>
          <span className="hero-microcopy">{t('hero.ctaSub')}</span>
          <p className="hero-who">{t('hero.who')}</p>
        </div>
        <div className="hero-side">
          <PriceCut />
          <div className="hero-lookup" id="lookup"><OfficeLookup /></div>
        </div>
      </section>

      <Showcase meta={meta} />
      <Evidence />
      <PriceContrast />
      <Mechanics />
      <Personas personas={meta?.personas || []} onStart={onStart} starting={starting} />
      <Architecture />
      <Honesty meta={meta} />

      {/* The punchline is a callback: the statistic says a bribe is "the only way",
          and the answer is the one word that undoes it. Note what it does NOT
          claim — we are not saying bribery ends, because it does not, and a
          product whose whole argument is "stop overclaiming" cannot close on an
          overclaim. */}
      <section className="closer">
        <p>{t('closer.lead')}</p>
        <h2>{t('closer.punch')}</h2>
        <Button kind="primary big" onClick={() => { window.location.hash = '#/start'; }}>
          {t('hero.cta')} <span aria-hidden="true">→</span>
        </Button>
      </section>

      <SiteFooter />
    </>
  );
}
