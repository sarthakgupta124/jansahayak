import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Counter, Notice, Reveal, SiteFooter, SiteNav, SpeakButton, Spinner, useLang } from './ui.jsx';

/* ================================================================== *
 * /mocks — the register
 * ================================================================== */

const STATUS_LABEL = {
  mocked: 'Mocked',
  'not-performed': 'Not performed at all',
  'never-collected': 'Never collected',
  absent: 'Absent',
  approximate: 'Approximate',
  limited: 'Limited',
  encoded: 'Encoded from a published source',
  'drafted-not-sent': 'Drafted, never sent',
  'demo-affordance': 'Demo affordance',
  conditional: 'Depends on deployment',
  'browser-native': 'Runs in your browser',
  seeded: 'Seeded with synthetic rows',
  'memory-only': 'Held in memory only'
};

export function MocksPage() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.mocks().then(setData).catch((e) => setError(e.message)); }, []);

  return (
    <>
      <SiteNav />
      <main className="page">
        <header className="page-head">
          <span className="kicker">The mock register</span>
          <h1>{t('mocks.title')}</h1>
          <p className="lede">{t('mocks.sub')}</p>
        </header>

        {error && <Notice tone="error">{error}</Notice>}
        {!data && !error && <Spinner label="Loading the register…" />}

        {data && (
          <>
            <div className="mock-summary">
              <div><strong>{data.register.length}</strong><span>entries in the register</span></div>
              <div><strong>{data.extraction.mode}</strong><span>extraction mode on this deployment</span></div>
              <div><strong>{data.ledger.unverifiedCitations}</strong><span>of {data.ledger.codes} defect codes not traced to a published clause</span></div>
              <div><strong>{data.store.ttlMinutes} min</strong><span>before a case expires from memory</span></div>
            </div>

            <div className="mock-list">
              {data.register.map((entry) => (
                <section className="mock-entry" key={entry.id} id={entry.id}>
                  <header>
                    <h2>{entry.area}</h2>
                    <span className={`mock-status s-${entry.status}`}>{STATUS_LABEL[entry.status] || entry.status}</span>
                  </header>
                  <dl>
                    <div><dt>What this prototype does</dt><dd>{entry.whatWeDo}</dd></div>
                    <div><dt>What is genuinely real</dt><dd>{entry.whatIsReal}</dd></div>
                    <div><dt>What production would do</dt><dd>{entry.productionPath}</dd></div>
                  </dl>
                </section>
              ))}
            </div>

            <Notice tone="info" title="Two things that are not mocked, and never will be">
              <p>We never ask for, store or use a government portal password or OTP. There is no field for one anywhere in this product, and there is no code path that would accept one.</p>
              <p>We never submit anything to a government system. The citizen submits; we prepare and track. This is not a limitation of the prototype — it is the design.</p>
            </Notice>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

/* ================================================================== *
 * /rulebook — the defect ledger
 * ================================================================== */

export function RulebookPage() {
  const { t, language } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => { setData(null); api.ledger(language).then(setData).catch((e) => setError(e.message)); }, [language]);

  const entries = (data?.entries || []).filter((entry) => {
    if (filter !== 'all' && entry.severity !== filter) return false;
    if (!query.trim()) return true;
    const needle = query.toLowerCase();
    return entry.code.toLowerCase().includes(needle) || entry.title.toLowerCase().includes(needle) || entry.fix.toLowerCase().includes(needle);
  });

  return (
    <>
      <SiteNav />
      <main className="page">
        <header className="page-head">
          <span className="kicker">The defect ledger</span>
          <h1>{t('ledger.title')}</h1>
          <p className="lede">{t('ledger.sub')}</p>
        </header>

        {error && <Notice tone="error">{error}</Notice>}
        {!data && !error && <Spinner label="Loading the rulebook…" />}

        {data && (
          <>
            <div className="ledger-stats">
              <div><strong>{data.stats.codes}</strong><span>defect codes</span></div>
              <div><strong>{data.stats.languages}</strong><span>languages</span></div>
              <div><strong><Counter to={data.stats.totalExplanations} /></strong><span>explanations that exist in total, for everybody, forever</span></div>
              <div><strong>{data.stats.bySeverity.blocks}</strong><span>of them stop you at the counter</span></div>
            </div>

            <p className="ledger-scale">
              That third number is the scale argument in one figure. Explanations are cached per
              (defect code × language), never per citizen. Serving one crore people costs the same model
              spend as serving ten thousand, because the explaining was done once.
            </p>

            <div className="ledger-controls">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search codes, titles or fixes"
                aria-label="Search the rulebook"
              />
              <div className="ledger-filters" role="group">
                {['all', 'blocks', 'delays', 'advisory'].map((key) => (
                  <button key={key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>
                    {key === 'all' ? 'All' : key}
                  </button>
                ))}
              </div>
            </div>

            <div className="ledger-list">
              {entries.map((entry) => (
                <details className={`ledger-entry sev-${entry.severity}`} key={entry.code}>
                  <summary>
                    <code>{entry.code}</code>
                    <span className="le-title">{entry.title}</span>
                    <span className={`sev sev-${entry.severity}`}>{entry.severity}</span>
                  </summary>
                  <div className="le-body">
                    <p>{entry.why}</p>
                    <dl>
                      <div><dt>What to do</dt><dd>{entry.fix}</dd></div>
                      <div><dt>Who fixes it</dt><dd>{entry.owner}</dd></div>
                      <div><dt>Where</dt><dd>{entry.where}</dd></div>
                      <div><dt>Typical time</dt><dd>{entry.expectedDays} day(s)</dd></div>
                      <div><dt>Emitted by</dt><dd>{entry.rules.length ? entry.rules.map((r) => <code key={r}>{r}</code>) : <em>no rule emits this code</em>}</dd></div>
                      {entry.citation && (
                        <div>
                          <dt>Source</dt>
                          <dd>
                            {entry.citation.source}
                            <span className={`verified ${entry.citation.verified ? 'yes' : 'no'}`}>
                              {entry.citation.verified ? `verified ${entry.citation.lastVerified}` : 'not traced to a published clause'}
                            </span>
                          </dd>
                        </div>
                      )}
                    </dl>
                    <SpeakButton text={`${entry.title}. ${entry.why} ${entry.fix}`} />
                  </div>
                </details>
              ))}
              {!entries.length && <p className="empty">Nothing matches that.</p>}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

/* ================================================================== *
 * /index — the friction index
 * ================================================================== */

export function FrictionIndexPage() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.frictionIndex().then(setData).catch((e) => setError(e.message)); }, []);
  const max = data ? Math.max(...data.index.map((row) => row.medianDays)) : 1;

  return (
    <>
      <SiteNav />
      <main className="page">
        <header className="page-head">
          <span className="kicker">The systemic byproduct</span>
          <h1>{t('index.title')}</h1>
          <p className="lede">{t('index.sub')}</p>
        </header>

        {error && <Notice tone="error">{error}</Notice>}
        {!data && !error && <Spinner label="Loading the index…" />}

        {data && (
          <>
            <Notice tone="info" title="Why this is aggregate-only, on purpose">
              Earlier bribe-reporting platforms collected testimony about named individuals and plateaued into
              heat maps nobody could act on, because an unverified allegation about a person is not actionable.
              A distribution of actual resolution times for a service at an office is. So this index records
              office, service and days — and never an officer.
            </Notice>

            <div className="index-table">
              {data.index.map((row, i) => (
                <Reveal
                  className={`index-row ${row.slaMetRate < 0.5 ? 'poor' : row.slaMetRate < 0.8 ? 'mid' : 'good'}`}
                  key={`${row.office}-${row.service}`}
                  delay={Math.min(i, 6) * 70}
                >
                  <div className="ir-office">
                    <strong>{row.office}</strong>
                    <span>{row.corporation} · {row.cases} {row.cases === 1 ? 'case' : 'cases'}{row.liveCases ? ` · ${row.liveCases} from this deployment` : ''}</span>
                  </div>
                  <div className="ir-bar">
                    <div className="ir-fill" style={{ width: `${(row.medianDays / max) * 100}%` }} />
                    <span className="ir-marker" style={{ left: `${(30 / max) * 100}%` }} title="30-day statutory period" />
                  </div>
                  <div className="ir-num"><strong>{row.medianDays}</strong><span>median days</span></div>
                  <div className="ir-sla"><strong>{Math.round(row.slaMetRate * 100)}%</strong><span>met the period</span></div>
                </Reveal>
              ))}
            </div>
            <p className="index-legend"><span className="legend-marker" aria-hidden="true" /> the 30-day statutory period</p>
            <p className="index-disclosure">{data.disclosure} A real deployment would publish no office with fewer than {data.minimumCasesToPublish} cases.</p>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

/* ================================================================== *
 * /how — end-to-end thinking
 * ================================================================== */

export function HowPage() {
  const [meta, setMeta] = useState(null);
  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);

  return (
    <>
      <SiteNav />
      <main className="page">
        <header className="page-head">
          <span className="kicker">End to end</span>
          <h1>What is actually behind the screen.</h1>
          <p className="lede">
            The interface is the small part. What makes this a process fix rather than a nicer form is
            everything below it: a versioned rule pack, a deterministic engine, a defect ledger with cited
            sources, statutory date arithmetic, and an anonymised outcome record.
          </p>
        </header>

        <section className="how-pipeline">
          {[
            { n: '01', h: 'Intake, code-mixed', b: 'Cue matching over romanised Kannada, Hindi and English runs offline with no language-ID decision. A model may fill gaps it missed; it can never overturn a cue match.' },
            { n: '02', h: 'Jurisdiction', b: 'Point-in-polygon over five corporation envelopes, with distance-to-edge. Within 1.5 km of a divide, both offices are named and neither is presented as certain.' },
            { n: '03', h: 'Extraction', b: 'A vision model reads a photo into candidate fields, or you type them. Either way every value is shown to you as an editable field before a rule sees it.' },
            { n: '04', h: 'The engine', b: `${meta?.ruleCount ?? 46} deterministic rules over a versioned pack. Rules that do not apply to your case are excluded from the score rather than silently passing, so the denominator is honest.` },
            { n: '05', h: 'The ledger', b: `${meta?.ledger?.codes ?? 47} codes × ${meta?.ledger?.languages ?? 3} languages. Explanations are cached per code, not per citizen — which is why cost is flat in population.` },
            { n: '06', h: 'The packet', b: 'Cover sheet, ordered enclosures, counter checklist and full evidence report, generated as PDFs the citizen files themselves.' },
            { n: '07', h: 'The clock', b: 'The statutory period attaches to the acknowledgement number. Breach detection, escalation availability and every date in a generated letter are computed, never typed.' },
            { n: '08', h: 'The record', b: 'One anonymous row per completed case: office, service, days, whether the period was met. Never an officer, never an identifier.' }
          ].map((step) => (
            <div className="how-step" key={step.n}>
              <span className="how-n">{step.n}</span>
              <div><h3>{step.h}</h3><p>{step.b}</p></div>
            </div>
          ))}
        </section>

        <section className="how-scale">
          <h2>Why this survives being used by a lot of people</h2>
          <div className="scale-grid">
            <div>
              <h3>Cost is flat in population</h3>
              <p>
                Explanations cache per (defect code × language) — {meta?.ledger?.totalExplanations ?? 141} of them exist in
                total, ever. Marginal cost per citizen is one deterministic engine call plus, optionally, one
                extraction. There is no per-citizen generation anywhere in the verdict path.
              </p>
            </div>
            <div>
              <h3>Adding a service is authoring data</h3>
              <p>
                A rule pack declares its required documents, its consistency constraints, its statutory period
                and its escalation ladder. EPF claims, caste certificates and trade licences fit the same shape.
                One state machine with per-service rule packs — not one scraper per website.
              </p>
            </div>
            <div>
              <h3>The document vault compounds</h3>
              <p>
                Most Indian bureaucratic friction is the same five documents, reformatted, forty times across a
                lifetime. Confirm them once and every later service starts from a set that is already checked.
              </p>
            </div>
            <div>
              <h3>Credentials are never the mechanism</h3>
              <p>
                A product built on storing citizens’ portal passwords cannot survive its own scale, legally or
                operationally. The destination is consent-based data access of the kind the account aggregator
                framework established for finance. Until that exists for civic records, the citizen uploads
                their own documents — and we say so rather than scraping our way there.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
