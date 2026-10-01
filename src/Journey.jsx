import { useEffect, useMemo, useRef, useState } from 'react';
import { api, downscaleImage, setStoredCase } from './api.js';
import { parseIntakeDeterministic } from '../server/intake.js';
import { canCheckLocally, checkLocally } from './engine.js';
import { measureImage } from './measure.js';
import Assistant from './Assistant.jsx';
// The same classifier the server uses, so the kind we measure against and the
// kind the document ends up filed as cannot disagree.
import { classifyByFileName } from '../server/extract.js';
import { LANGS } from './i18n.js';
import { createRecognizer, recognitionSupported, stopSpeaking } from './speech.js';
import {
  Brand, Button, LanguageSwitch, Notice, SeverityBadge, SpeakButton, Spinner, WhyThisAnswer,
  useLang, useTransitionedValue, rupees
} from './ui.jsx';

const STEPS = ['language', 'intake', 'office', 'documents', 'check', 'packet', 'clock', 'done'];

/* ================================================================== *
 * Step rail
 * ================================================================== */

function Rail({ step }) {
  const { t } = useLang();
  const labels = {
    language: t('step.language'), intake: t('step.intake'), office: t('step.office'),
    documents: t('step.documents'), check: t('step.check'), packet: t('step.packet'),
    clock: t('step.clock'), done: t('step.done')
  };
  const index = STEPS.indexOf(step);
  return (
    <div className="rail">
      <div className="rail-track"><div className="rail-fill" style={{ width: `${(index / (STEPS.length - 1)) * 100}%` }} /></div>
      <ol className="rail-steps">
        {STEPS.map((id, i) => (
          <li key={id} className={i < index ? 'done' : i === index ? 'now' : ''}>
            <span className="rail-dot" aria-hidden="true">{i < index ? '✓' : i + 1}</span>
            <span className="rail-label">{labels[id]}</span>
          </li>
        ))}
      </ol>
      <div className="rail-mobile">{labels[step]} · {index + 1} {t('common.of')} {STEPS.length}</div>
    </div>
  );
}

/* ================================================================== *
 * 0 · Language
 * ================================================================== */

function LanguageStep({ onNext }) {
  const { t, language, setLanguage } = useLang();
  return (
    <article className="card">
      <h1>{t('lang.title')}</h1>
      <p className="lede">{t('lang.sub')}</p>
      <div className="lang-choices">
        {LANGS.map((entry) => (
          <button
            key={entry.code}
            className={`lang-choice ${entry.code === language ? 'on' : ''}`}
            onClick={() => { stopSpeaking(); setLanguage(entry.code); }}
          >
            <span className="lang-native">{entry.native}</span>
            <span className="lang-code">{entry.code.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <Notice tone="info">
        Every problem we find is explained in this language, and can be read aloud. The letters we generate stay in English, because that is the language the office record and the receiving clerk work in — a letter the counter cannot process helps nobody.
      </Notice>
      <div className="card-actions">
        <span />
        <Button onClick={onNext}>{t('common.next')} →</Button>
      </div>
    </article>
  );
}

/* ================================================================== *
 * 1 · Intake
 * ================================================================== */

function IntakeStep({ caseData, setCaseData, onNext, onBack }) {
  const { t, locale, language } = useLang();
  const [text, setText] = useState(caseData.intake?.utterance || '');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [micError, setMicError] = useState('');
  const [busy, setBusy] = useState(false);
  const [intake, setIntake] = useState(caseData.intake || null);
  const recognizerRef = useRef(null);

  const persona = caseData.personaId;
  const suggestion = caseData.suggestedUtterance;

  const startListening = () => {
    setMicError('');
    if (!recognitionSupported()) { setMicError(t('intake.noMic')); return; }
    const recognizer = createRecognizer({
      locale,
      onResult: ({ interim: partial, final }) => {
        if (partial) setInterim(partial);
        if (final) { setText((prev) => `${prev} ${final}`.trim()); setInterim(''); }
      },
      onError: (err) => { setMicError(err === 'not-allowed' ? t('intake.noMic') : `Microphone: ${err}`); setListening(false); },
      onEnd: () => { setListening(false); setInterim(''); }
    });
    recognizerRef.current = recognizer;
    recognizer.start();
    setListening(true);
  };

  const stopListening = () => { recognizerRef.current?.stop(); setListening(false); };
  useEffect(() => () => recognizerRef.current?.stop(), []);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setMicError('');
    try {
      const result = await api.intake(caseData.id, text.trim());
      setIntake(result.intake);
      setCaseData(result.case);
    } catch (e) {
      const parsed = parseIntakeDeterministic(text.trim());
      const intake = {
        ...parsed,
        utterance: text.trim(),
        at: new Date().toISOString()
      };
      const nextCase = {
        ...caseData,
        intake,
        ...(parsed.variant ? { variant: parsed.variant } : {}),
        ...(parsed.locality && !caseData.address ? { address: parsed.locality } : {})
      };
      setIntake(intake);
      setCaseData(nextCase);
      setStoredCase(nextCase);
      try {
        const synced = await api.intake(caseData.id, text.trim());
        setIntake(synced.intake);
        setCaseData(synced.case);
      } catch {
        /* Parsed locally; server sync can retry on the next step. */
      }
    } finally {
      setBusy(false);
    }
  };

  const chooseVariant = async (variant) => {
    setBusy(true);
    try {
      const result = await api.setApplicant(caseData.id, { name: caseData.applicant?.name || 'Applicant', variant });
      setCaseData(result.case);
    } catch (e) { setMicError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <article className="card">
      <h1>{t('intake.title')}</h1>
      <p className="lede">{t('intake.sub')}</p>

      <div className="mic-block">
        <button
          type="button"
          className={`mic ${listening ? 'live' : ''}`}
          onClick={() => (listening ? stopListening() : startListening())}
          aria-pressed={listening}
        >
          <span className="mic-ring" aria-hidden="true" />
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
          </svg>
          <span>{listening ? t('intake.listening') : t('intake.speak')}</span>
        </button>
        {suggestion && !text && (
          <button type="button" className="try-line" onClick={() => setText(suggestion)}>
            Try: “{suggestion}”
          </button>
        )}
      </div>

      {interim && <p className="interim">{interim}…</p>}
      {micError && <Notice tone="warn">{micError}</Notice>}

      <label className="field">
        <span>{t('intake.typeInstead')}</span>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('intake.placeholder')}
        />
      </label>
      <Button kind="secondary" onClick={send} busy={busy} disabled={!text.trim()}>Understand this</Button>

      {intake && (
        <div className="intake-result">
          <h3>{t('intake.understood')}</h3>
          <dl className="intake-grid">
            <div><dt>Service</dt><dd>{intake.service ? 'Property Mutation transfer' : '—'}</dd></div>
            <div><dt>Kind</dt><dd>{intake.variant === 'inheritance' ? 'After inheritance' : intake.variant === 'sale' ? 'After purchase' : '—'}</dd></div>
            <div><dt>Relationship</dt><dd>{intake.relationship || '—'}</dd></div>
            <div><dt>Why it is urgent</dt><dd>{intake.urgency || '—'}</dd></div>
            <div><dt>Area</dt><dd>{intake.locality || '—'}</dd></div>
          </dl>
          {intake.summaryEnglish && <p className="intake-gloss">“{intake.summaryEnglish}”</p>}
          <p className="intake-engine">
            Parsed by <code>{intake.engine}</code> · confidence {Math.round(intake.confidence * 100)}%
            {intake.cues?.service?.length ? ` · matched cues: ${[...intake.cues.service, ...intake.cues.inheritance, ...intake.cues.sale, ...intake.cues.urgency].slice(0, 6).join(', ')}` : ''}
          </p>
          {!intake.variant && <Notice tone="warn">{t('intake.notUnderstood')}</Notice>}
        </div>
      )}

      <div className="variant-block">
        <h3>{t('intake.variant')}</h3>
        <div className="variant-choices">
          {[
            { id: 'inheritance', label: 'After inheritance', sub: 'The owner on record has died and the property passes to an heir' },
            { id: 'sale', label: 'After purchase', sub: 'You bought the property and the property mutation is still in the seller’s name' }
          ].map((option) => (
            <button
              key={option.id}
              className={`variant ${caseData.variant === option.id ? 'on' : ''}`}
              onClick={() => chooseVariant(option.id)}
              disabled={busy}
            >
              <strong>{option.label}</strong>
              <span>{option.sub}</span>
            </button>
          ))}
        </div>
        <p className="hint">This choice changes which rules apply. A purchase is never checked for a death certificate, and a purchase is not flagged for the property mutation still standing in the seller’s name — that is the whole reason you are here.</p>
      </div>

      <div className="card-actions">
        <Button kind="ghost" onClick={onBack}>← {t('common.back')}</Button>
        <Button onClick={onNext} disabled={!caseData.variant}>{t('common.next')} →</Button>
      </div>
    </article>
  );
}

/* ================================================================== *
 * 2 · Office
 * ================================================================== */

function OfficeStep({ caseData, setCaseData, onNext, onBack }) {
  const { t } = useLang();
  const [address, setAddress] = useState(caseData.address || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const jurisdiction = caseData.jurisdiction;

  const resolve = async (body) => {
    setBusy(true); setError('');
    try {
      const result = await api.jurisdiction(caseData.id, body);
      setCaseData(result.case);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const useLocation = () => {
    if (!navigator.geolocation) { setError('This browser will not share a location.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, address }),
      () => { setBusy(false); setError('Location was not shared. Type the area name instead — it works just as well.'); },
      { timeout: 8000 }
    );
  };

  const spoken = jurisdiction
    ? `${jurisdiction.message} ${jurisdiction.candidates?.[0] ? `The office is ${jurisdiction.candidates[0].office}.` : ''} ${jurisdiction.nextStep || ''}`
    : '';

  return (
    <article className="card">
      <h1>{t('office.title')}</h1>
      <p className="lede">{t('office.sub')}</p>

      <label className="field">
        <span>{t('office.placeholder')}</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="42, Brookefield Main Road, Bhopal" />
      </label>
      <div className="inline-actions">
        <Button onClick={() => resolve({ address })} busy={busy} disabled={!address.trim()}>{t('office.find')}</Button>
        <Button kind="ghost" onClick={useLocation} disabled={busy}>{t('office.useLocation')}</Button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {jurisdiction && (
        <div className={`resolution ${jurisdiction.confidence}`}>
          <div className="resolution-head">
            <span className={`conf conf-${jurisdiction.confidence}`}>
              {jurisdiction.confidence === 'resolved' ? 'Resolved'
                : jurisdiction.confidence === 'contested' ? t('office.contested')
                  : jurisdiction.confidence === 'unresolved' ? t('office.unresolved') : 'Outside coverage'}
            </span>
            <SpeakButton text={spoken} />
          </div>
          <p className="resolution-message">{jurisdiction.message}</p>

          {jurisdiction.candidates?.map((candidate, index) => (
            <div className={`office-card ${index === 0 ? 'first' : ''}`} key={candidate.corporationId}>
              {jurisdiction.candidates.length > 1 && (
                <span className="office-order">{index === 0 ? t('office.tryFirst') : t('office.alternate')}</span>
              )}
              <strong>{candidate.corporation}</strong>
              <span className="office-zone">{candidate.zone}</span>
              <span className="office-counter">{candidate.office}</span>
              {index === 0 && candidate.previousWard && <span className="office-ward">Formerly {candidate.previousWard}</span>}
              <span className="office-dist">{candidate.distanceToBoundaryKm} km from the nearest corporation boundary</span>
            </div>
          ))}

          {jurisdiction.nextStep && <p className="resolution-next">{jurisdiction.nextStep}</p>}

          {jurisdiction.knownLocalities && (
            <details className="lookup-known">
              <summary>{t('office.known')} ({jurisdiction.knownLocalities.length})</summary>
              <p>{jurisdiction.knownLocalities.join(' · ')}</p>
            </details>
          )}
        </div>
      )}

      <div className="card-actions">
        <Button kind="ghost" onClick={onBack}>← {t('common.back')}</Button>
        <Button onClick={onNext} disabled={!jurisdiction || jurisdiction.confidence === 'unresolved'}>{t('common.next')} →</Button>
      </div>
    </article>
  );
}

/* ================================================================== *
 * 3 · Documents
 * ================================================================== */

function DocumentCard({ doc, kinds, visionFallback, onSave, onRemove, onReadVision }) {
  const { t } = useLang();
  const [open, setOpen] = useState(!doc.confirmed && doc.extractionSource !== 'fixture');
  const [draft, setDraft] = useState(doc.fields || {});
  const [kind, setKind] = useState(doc.kind || '');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const template = kinds[kind]?.fields || doc.template || [];

  useEffect(() => {
    setDraft(doc.fields || {});
    setKind(doc.kind || '');
  }, [doc.id, doc.fields, doc.kind]);

  const save = async () => {
    setBusy(true);
    try { await onSave(doc.id, { kind, fields: draft, confirmed: true }); setOpen(false); }
    finally { setBusy(false); }
  };

  const readVision = async () => {
    if (!onReadVision || !doc._dataUrl || !kind) return;
    setReading(true);
    try {
      await onReadVision(doc.id, { dataUrl: doc._dataUrl, kind });
    } finally {
      setReading(false);
    }
  };

  const sourceLabel = {
    'openai-vision': `${t('docs.readBy')} ${doc.extractionModel || 'a vision model'}`,
    'citizen-confirmed': t('docs.readByYou'),
    manual: t('docs.needsConfirm'),
    fixture: 'Synthetic demo document'
  }[doc.extractionSource] || doc.extractionSource;

  return (
    <div className={`doc ${doc.confirmed || doc.extractionSource === 'fixture' ? 'ok' : 'pending'}`}>
      <button className="doc-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="doc-icon" aria-hidden="true">{doc.extractionSource === 'fixture' ? '▤' : '▧'}</span>
        <span className="doc-name">
          <strong>{kinds[kind]?.label || kind || 'Unrecognised document'}</strong>
          <span>{doc.fileName}</span>
        </span>
        <span className={`doc-src src-${doc.extractionSource}`}>{sourceLabel}</span>
        <span className="doc-chev" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="doc-body">
          {doc.extractionNote && <p className="doc-note">{doc.extractionNote}</p>}
          {doc.extractionError && <Notice tone="warn">Reading failed: {doc.extractionError}</Notice>}

          <label className="field">
            <span>Document type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">— choose —</option>
              {Object.entries(kinds).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
            </select>
          </label>

          {template.length > 0 && <p className="doc-confirm-lede">{t('docs.confirmSub')}</p>}

          <div className="doc-fields">
            {template.map((field) => (
              <label className={`field ${field.sensitive ? 'sensitive' : ''}`} key={field.key}>
                <span>{field.label}{field.required && <i aria-hidden="true"> *</i>}</span>
                {field.type === 'boolean' ? (
                  <select
                    value={draft[field.key] === true ? 'true' : draft[field.key] === false ? 'false' : ''}
                    onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value === '' ? undefined : e.target.value === 'true' })}
                  >
                    <option value="">— not known —</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : field.type === 'list' ? (
                  <textarea
                    rows={3}
                    value={Array.isArray(draft[field.key]) ? draft[field.key].join('\n') : (draft[field.key] || '')}
                    onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value.split('\n') })}
                  />
                ) : field.type === 'entries' ? (
                  <span className="field-static">{(draft[field.key] || []).length} entries — edit not supported in this prototype</span>
                ) : (
                  <input
                    type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                    value={draft[field.key] ?? ''}
                    placeholder={field.hint || ''}
                    onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                  />
                )}
                {field.hint && <em className="field-hint">{field.hint}</em>}
              </label>
            ))}
          </div>

          <div className="doc-actions">
            {visionFallback && doc._dataUrl && (
              <Button kind="secondary" onClick={readVision} busy={reading} disabled={!kind || reading}>
                {t('docs.readVision')}
              </Button>
            )}
            <Button kind="secondary" onClick={save} busy={busy} disabled={!kind}>{t('common.save')}</Button>
            <Button kind="ghost" onClick={() => onRemove(doc.id)}>{t('common.remove')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsStep({ caseData, setCaseData, meta, kinds, onNext, onBack }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const variant = meta?.variants?.find((v) => v.id === caseData.variant);
  const present = new Set((caseData.documents || []).map((d) => d.kind).filter(Boolean));
  const missingRequired = (variant?.required || []).filter((k) => !present.has(k));
  const missingRecommended = (variant?.recommended || []).filter((k) => !present.has(k));

  const upload = async (files) => {
    setError('');
    for (const file of Array.from(files)) {
      setUploading(file.name);
      try {
        let dataUrl;
        let measured;
        if (file.type.startsWith('image/')) {
          const scaled = await downscaleImage(file);
          dataUrl = scaled?.dataUrl;
          // Measured here, on the device, before anything is sent. These are the
          // physical-quality fields FMT-03, FMT-05 and FMT-06 read; they used to
          // be asked of the vision model, which meant a language model's opinion
          // was reaching a rule. Arithmetic over pixels answers them instead.
          if (dataUrl) measured = await measureImage(dataUrl, classifyByFileName(file.name).kind);
        }
        // Upload stays on the offline path (classify + confirm). Vision is only
        // requested later if the citizen taps “Read from photo”.
        const result = await api.addDocument(caseData.id, {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          dataUrl,
          measured,
          useVision: false
        });
        const nextCase = result.case;
        if (dataUrl && result.document?.id) {
          nextCase.documents = (nextCase.documents || []).map((doc) => (
            doc.id === result.document.id ? { ...doc, _dataUrl: dataUrl } : doc
          ));
        }
        setCaseData(nextCase);
        // Keep the photo only in memory for the vision fallback — sessionStorage
        // cannot hold multi‑MB data URLs.
        setStoredCase({
          ...nextCase,
          documents: (nextCase.documents || []).map(({ _dataUrl, ...rest }) => rest)
        });
      } catch (e) { setError(`${file.name}: ${e.message}`); }
    }
    setUploading('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const loadFixtures = async (corrected) => {
    setBusy(true); setError('');
    try { setCaseData((await api.loadFixtures(caseData.id, { corrected })).case); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const saveDoc = async (docId, body) => {
    const result = await api.updateDocument(caseData.id, docId, body);
    setCaseData(result.case);
  };
  const removeDoc = async (docId) => {
    const result = await api.removeDocument(caseData.id, docId);
    setCaseData(result.case);
  };
  const readVision = async (docId, body) => {
    setError('');
    try {
      const existing = (caseData.documents || []).find((d) => d.id === docId);
      const result = await api.readDocumentVision(caseData.id, docId, body);
      const nextCase = result.case;
      // Keep the session-only image so they can re-try the fallback.
      if (existing?._dataUrl) {
        nextCase.documents = (nextCase.documents || []).map((doc) => (
          doc.id === docId ? { ...doc, _dataUrl: existing._dataUrl } : doc
        ));
      }
      setCaseData(nextCase);
      setStoredCase({
        ...nextCase,
        documents: (nextCase.documents || []).map(({ _dataUrl, ...rest }) => rest)
      });
    } catch (e) {
      setError(e.message);
      throw e;
    }
  };

  const unconfirmed = (caseData.documents || []).filter((d) => !d.confirmed && d.extractionSource !== 'fixture');
  const visionFallback = Boolean(meta?.extraction?.visionFallback);

  return (
    <article className="card wide">
      <h1>{t('docs.title')}</h1>
      <p className="lede">{t('docs.subUpload')}</p>

      <div className="doc-checklist">
        <div>
          <h3>{t('docs.required')}</h3>
          <ul>
            {(variant?.required || []).map((k) => (
              <li key={k} className={present.has(k) ? 'has' : 'lacks'}>
                <span aria-hidden="true">{present.has(k) ? '✓' : '○'}</span>{kinds[k]?.label || k}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{t('docs.recommended')}</h3>
          <ul>
            {(variant?.recommended || []).map((k) => (
              <li key={k} className={present.has(k) ? 'has' : 'lacks'}>
                <span aria-hidden="true">{present.has(k) ? '✓' : '○'}</span>{kinds[k]?.label || k}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="upload-row">
        <button className="dropzone" onClick={() => fileRef.current?.click()} disabled={Boolean(uploading)}>
          <span className="dz-icon" aria-hidden="true">↑</span>
          <strong>{t('docs.add')}</strong>
          <span>Photo or PDF. Images are shrunk on your phone before they are sent, so this works on a slow connection.</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => upload(e.target.files)}
        />
        {caseData.personaId && (
          <div className="demo-load">
            <strong>{t('docs.demo')}</strong>
            <span>{t('docs.demoNote')}</span>
            <Button kind="secondary" onClick={() => loadFixtures(false)} busy={busy}>Load {caseData.personaId}’s documents</Button>
          </div>
        )}
      </div>

      {uploading && <Spinner label={`Adding ${uploading}…`} />}
      {error && <Notice tone="error">{error}</Notice>}
      {meta?.extraction && (
        <p className="extraction-mode">
          Extraction mode on this deployment: <code>{meta.extraction.mode}</code>
          {meta.extraction.visionFallback ? ' · vision fallback available' : ''}
          {meta.extraction.model ? ` (${meta.extraction.model})` : ''}. {meta.extraction.note}
        </p>
      )}

      <div className="doc-list">
        {(caseData.documents || []).map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            kinds={kinds}
            visionFallback={visionFallback}
            onSave={saveDoc}
            onRemove={removeDoc}
            onReadVision={readVision}
          />
        ))}
        {!caseData.documents?.length && <p className="empty">Nothing added yet.</p>}
      </div>

      {(missingRequired.length > 0 || unconfirmed.length > 0) && (
        <Notice tone="warn" title="Before you run the check">
          {missingRequired.length > 0 && <p>{t('docs.missing')}: {missingRequired.map((k) => kinds[k]?.label || k).join(', ')}. You can still run the check — it will tell you exactly what each missing document costs you.</p>}
          {unconfirmed.length > 0 && <p>{unconfirmed.length} document(s) still need their fields confirmed. Rules run on those values.</p>}
        </Notice>
      )}

      <div className="card-actions">
        <Button kind="ghost" onClick={onBack}>← {t('common.back')}</Button>
        <Button onClick={onNext} disabled={!caseData.documents?.length}>{t('docs.run')} →</Button>
      </div>
    </article>
  );
}

/* ================================================================== *
 * 4 · The check
 * ================================================================== */

function Finding({ finding }) {
  const { t } = useLang();
  const spoken = `${finding.title}. ${finding.why} ${finding.fix}`;
  return (
    <div className={`finding sev-${finding.severity}`}>
      <div className="finding-top">
        <code className="finding-code">{finding.code}</code>
        <SeverityBadge severity={finding.severity} />
        <SpeakButton text={spoken} />
      </div>
      <h3>{finding.title}</h3>
      <p className="finding-why">{finding.why}</p>
      <div className="finding-fix">
        <div><span className="fx-label">{t('check.fix')}</span><p>{finding.fix}</p></div>
        <div className="fx-meta">
          <div><span className="fx-label">{t('check.who')}</span><p>{finding.owner}</p></div>
          <div><span className="fx-label">{t('check.where')}</span><p>{finding.where}</p></div>
          <div><span className="fx-label">{t('check.howLong')}</span><p>{finding.expectedDays} {finding.expectedDays === 1 ? t('common.day') : t('common.days')}</p></div>
        </div>
      </div>
      <WhyThisAnswer finding={finding} />
    </div>
  );
}

function CheckStep({ caseData, setCaseData, evaluation, setEvaluation, meta, onNext, onBack }) {
  const { t, language } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // MUST sit above the early returns below. Placing it after them changed the
  // hook count between the "no evaluation yet" render and the "evaluation
  // arrived" render, which is React error #310 and takes the whole app down to
  // a blank screen — the check step is exactly where that is least survivable.
  const ringPct = useTransitionedValue(evaluation?.score ?? 0);

  const run = async () => {
    setError('');

    // Answer from the device first. The rule pack is in this bundle, so this
    // needs no network and completes before a request would have left the
    // phone. On a 2G connection in a queue outside an office, this is very
    // often the only answer the citizen is going to get.
    const haveLocal = canCheckLocally(caseData);
    if (haveLocal) setEvaluation(checkLocally(caseData, { language }));

    setBusy(true);
    try {
      const result = await api.check(caseData.id);
      setEvaluation(result.evaluation);
      setCaseData(result.case);
    } catch (e) {
      // Nothing to retract: the verdict already on screen came from the same
      // rule pack over the same case. What failed is only persisting it, and
      // the server re-runs the check itself before it will attach a clock.
      if (!haveLocal) setError(e.message);
    }
    finally { setBusy(false); }
  };

  useEffect(() => { if (!evaluation) run(); /* eslint-disable-next-line */ }, []);

  const demoFix = async () => {
    setBusy(true); setError('');
    try {
      await api.loadFixtures(caseData.id, { corrected: true });
      const result = await api.check(caseData.id);
      setEvaluation(result.evaluation);
      setCaseData(result.case);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (busy && !evaluation) return <article className="card"><Spinner label={t('docs.running')} /></article>;
  if (!evaluation) return <article className="card">{error && <Notice tone="error">{error}</Notice>}<Button onClick={run}>{t('common.retry')}</Button></article>;

  const blocking = evaluation.findings.filter((f) => f.severity === 'blocks');
  const delaying = evaluation.findings.filter((f) => f.severity === 'delays');
  const advisory = evaluation.findings.filter((f) => f.severity === 'advisory');
  const persona = meta?.personas?.find((p) => p.id === caseData.personaId);
  const headline = { 'will-be-refused': t('check.refused'), 'may-be-objected': t('check.objected'), ready: t('check.ready') }[evaluation.verdict];

  return (
    <article className="card wide">
      <div className={`verdict ${evaluation.verdict}`}>
        <div className="verdict-ring" style={{ '--pct': ringPct }}>
          <div className="verdict-inner">
            <strong>{blocking.length}</strong>
            <span>blocking</span>
          </div>
        </div>
        <div className="verdict-copy">
          <h1>{headline}</h1>
          <p className="verdict-counts">
            <b>{blocking.length}</b> {t('check.blocking')} · <b>{delaying.length}</b> {t('check.delaying')} · <b>{advisory.length}</b> {t('check.advisory')}
          </p>
          <p className="verdict-basis">
            Readiness {evaluation.score}% — a severity-weighted pass rate over the {evaluation.scoreBasis.rulesApplied} rules
            that applied to your case ({evaluation.scoreBasis.rulesSkipped} did not apply and are not counted).
            Rule pack <code>{evaluation.rulePack}</code>.
          </p>
          {evaluation.computedOn === 'device' && (
            <p className="verdict-provenance">
              {t('check.onDevice')}
            </p>
          )}
          <SpeakButton text={`${headline} ${blocking.length} issues will stop you at the counter. ${delaying.length} will come back as an objection.`} />
        </div>
      </div>

      {persona && blocking.length > 0 && (
        <div className="agent-contrast">
          <p className="ac-line">{t('check.agentLine')} <strong>{rupees(persona.quotedByAgent)}</strong>.</p>
          <p className="ac-line2">{t('check.agentLine2')}</p>
        </div>
      )}

      {evaluation.fixPlan.steps.length > 0 && (
        <div className="fix-plan">
          <h3>{t('check.plan')}</h3>
          <ol>
            {evaluation.fixPlan.steps.map((step) => (
              <li key={step.code} className={`plan-${step.severity}`}>
                <span className="plan-days">{step.expectedDays}d</span>
                <span className="plan-body"><strong>{step.title}</strong><em>{step.owner} · {step.where}</em></span>
              </li>
            ))}
          </ol>
          <p className="plan-total">
            {t('check.planLongest')}: <strong>{evaluation.fixPlan.criticalPathDays} {t('common.days')}</strong>
            {' · '}{t('check.planSerial')}: <strong>{evaluation.fixPlan.serialDays} {t('common.days')}</strong>
          </p>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {blocking.length > 0 && (
        <section className="finding-group">
          <h2 className="group-head blocks">{t('check.blocking')}</h2>
          {blocking.map((f) => <Finding key={f.ruleId} finding={f} />)}
        </section>
      )}
      {delaying.length > 0 && (
        <section className="finding-group">
          <h2 className="group-head delays">{t('check.delaying')}</h2>
          {delaying.map((f) => <Finding key={f.ruleId} finding={f} />)}
        </section>
      )}
      {advisory.length > 0 && (
        <section className="finding-group">
          <h2 className="group-head advisory">{t('check.advisory')}</h2>
          <p className="group-note">
            {t('check.notFlagged')} — these are things a careless check would have called defects and sent you
            to a notary for. We looked, and decided they are not problems. That decision is as important as the ones above.
          </p>
          {advisory.map((f) => <Finding key={f.ruleId} finding={f} />)}
        </section>
      )}

      <div className="card-actions stack">
        <Button kind="ghost" onClick={onBack}>← {t('common.back')}</Button>
        <div className="action-cluster">
          <Button kind="secondary" onClick={run} busy={busy}>{t('check.recheck')}</Button>
          {caseData.personaId && (caseData.personaId !== 'sarala' && caseData.personaId !== 'ramkali') && !evaluation.submittable && (
            <Button kind="secondary" onClick={demoFix} busy={busy}>{t('check.demoFix')}</Button>
          )}
          <Button onClick={onNext} disabled={!evaluation.submittable}>{t('common.next')} →</Button>
        </div>
      </div>

      {!evaluation.submittable && (caseData.personaId === 'sarala' || caseData.personaId === 'ramkali') && (
        <Notice tone="warn" title="This one cannot be fixed with better paperwork">
          {caseData.personaId === 'ramkali' ? 'Ramkali Bai’s' : 'Sarala’s'} deed was never registered, and no amount of document preparation changes that. The honest
          answer is that this is a legal matter, and free legal aid exists for it through the District Legal
          Services Authority. A product that only ever shows the happy path would have told her to try harder.
        </Notice>
      )}
    </article>
  );
}

/* ================================================================== *
 * 5 · Packet
 * ================================================================== */

function PacketStep({ caseData, evaluation, onNext, onBack }) {
  const { t } = useLang();
  return (
    <article className="card">
      <h1>{t('packet.title')}</h1>
      <p className="lede">{t('packet.sub')}</p>

      <div className="packet-preview">
        <div className="packet-strip">JanSahayak · CITIZEN-PREPARED · SYNTHETIC DEMO</div>
        <h3>Property Mutation transfer<br />{caseData.variant === 'sale' ? 'after purchase' : 'after inheritance'}</h3>
        <ul>
          <li>Cover sheet naming your corporation, zone and counter</li>
          <li>Enclosure list in the exact order to assemble them</li>
          <li>Every check we ran, with the evidence for each</li>
          <li>A counter checklist, including what to say if you are told the papers are not in order</li>
        </ul>
        {caseData.jurisdiction?.candidates?.[0] && (
          <p className="packet-office">→ {caseData.jurisdiction.candidates[0].office}</p>
        )}
      </div>

      <div className="download-row">
        <a className="btn primary" href={api.packetUrl(caseData.id)} download>↓ {t('packet.download')}</a>
        <a className="btn secondary" href={api.reportUrl(caseData.id)} download>↓ {t('packet.report')}</a>
      </div>

      <Notice tone="info">
        We do not submit this. We never sign in as you and we never ask for a government portal password —
        there is no field for one anywhere in this product. You hand the packet over yourself, and you come
        back with an acknowledgement number.
      </Notice>

      <div className="card-actions">
        <Button kind="ghost" onClick={onBack}>← {t('common.back')}</Button>
        <Button onClick={onNext}>{t('packet.next')} →</Button>
      </div>
    </article>
  );
}

/* ================================================================== *
 * 6 · The clock
 * ================================================================== */

function ClockStep({ caseData, setCaseData, onNext, onBack }) {
  const { t, language } = useLang();
  const [ack, setAck] = useState(caseData.clock?.acknowledgementNumber || '');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const clock = caseData.clock;

  useEffect(() => {
    if (!clock) return;
    api.clock(caseData.id).then((r) => setStatus(r.status)).catch(() => {});
  }, [clock, caseData.demoNow, caseData.id]);

  const attach = async () => {
    setBusy(true); setError('');
    try {
      const result = await api.submit(caseData.id, ack.trim());
      setCaseData(result.case);
      setStatus(result.status);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const travel = async (days) => {
    setBusy(true); setError('');
    try {
      const target = days === null ? null : new Date(new Date(clock.submittedAt).getTime() + days * 86400000).toISOString();
      const result = await api.demoNow(caseData.id, target);
      setCaseData(result.case);
      setStatus(result.status);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const days = status ? (status.breached ? status.daysOverdue : Math.max(0, status.remainingDays)) : null;
  const clockPct = useTransitionedValue(Math.round((status?.progress ?? 0) * 100));

  const fmt = (iso) => new Date(iso).toLocaleDateString(language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  if (!clock) {
    return (
      <article className="card">
        <h1>{t('clock.title')}</h1>
        <p className="lede">{t('clock.sub')}</p>
        <label className="field">
          <span>{t('clock.placeholder')}</span>
          <input value={ack} onChange={(e) => setAck(e.target.value)} placeholder="GBAE/MHD/2026/04821" />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <Button onClick={attach} busy={busy} disabled={ack.trim().length < 4}>{t('clock.attach')}</Button>
        <Notice tone="info">
          This number comes from your own receipt. We do not generate it, look it up, or verify it against
          any system — we simply attach the statutory deadline to it and count.
        </Notice>
        <div className="card-actions"><Button kind="ghost" onClick={onBack}>← {t('common.back')}</Button><span /></div>
      </article>
    );
  }

  return (
    <article className="card wide">
      <h1>{t('clock.title')}</h1>

      <div className={`clock-face ${status?.state || 'running'}`}>
        <div className="clock-ring" style={{ '--pct': clockPct }}>
          <div className="clock-inner">
            <strong>{days === null ? '—' : days}</strong>
            {/* "1 DAYS OVERDUE" is the first thing a close-up of this ring shows. */}
            <span>{status?.breached
              ? t(days === 1 ? 'clock.overdue1' : 'clock.overdue')
              : t(days === 1 ? 'clock.remaining1' : 'clock.remaining')}</span>
          </div>
        </div>
        <div className="clock-facts">
          <div><dt>Acknowledgement</dt><dd><code>{clock.acknowledgementNumber}</code></dd></div>
          <div><dt>{t('clock.deadline')}</dt><dd>{fmt(clock.deadlineAt)}</dd></div>
          <div><dt>Statutory period</dt><dd>{clock.slaDays} {t('common.days')} · {clock.framework}</dd></div>
          <div><dt>Office</dt><dd>{clock.office?.office || '—'}</dd></div>
          <p className="clock-caveat">{clock.caveat}</p>
        </div>
      </div>

      {status?.activeNudge && <Notice tone={status.breached ? 'warn' : 'info'}>{status.activeNudge.message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="time-travel">
        <span className="tt-label">{t('clock.timeTravel')}</span>
        <div className="tt-buttons">
          {[0, 15, 29, 31, 46].map((day) => (
            <button key={day} onClick={() => travel(day)} disabled={busy}>{t('clock.day')} {day + 1}</button>
          ))}
          <button onClick={() => travel(null)} disabled={busy} className="tt-reset">{t('clock.realTime')}</button>
        </div>
        <p className="tt-note">{t('clock.timeTravelNote')}</p>
      </div>

      {status?.breached && (
        <div className="escalations">
          <h2 className="group-head blocks">{t('clock.breached')}</h2>
          <p className="esc-lede">{t('clock.appealReady')}</p>
          {status.availableEscalations.map((rung) => (
            <div className="esc" key={rung.id}>
              <div className="esc-copy">
                <strong>{language === 'kn' ? rung.labelKn : language === 'hi' ? rung.labelHi : rung.label}</strong>
                <span>To: {rung.addressedToRole}</span>
                <em>{rung.basis}</em>
                <span className="esc-due">Reply due within {rung.disposalDays} days, by {fmt(rung.dueBy)}</span>
              </div>
              <a className="btn primary" href={api.escalationUrl(caseData.id, rung.id)} download>↓ {t('clock.download')}</a>
            </div>
          ))}
          {status.nextEscalation && (
            <div className="esc locked">
              <div className="esc-copy">
                <strong>{status.nextEscalation.label}</strong>
                <span>{t('clock.notYet')} — becomes available {fmt(status.nextEscalation.availableOn)}</span>
                <em>We will not draft an escalation before the law makes it available. A premature appeal is a wasted one.</em>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card-actions">
        <Button kind="ghost" onClick={onBack}>← {t('common.back')}</Button>
        <Button onClick={onNext}>{t('common.next')} →</Button>
      </div>
    </article>
  );
}

/* ================================================================== *
 * 7 · Done
 * ================================================================== */

function DoneStep({ caseData, evaluation, onRestart }) {
  const { t } = useLang();
  const [contributed, setContributed] = useState(caseData.outcomeRecorded);
  const [index, setIndex] = useState(null);
  const [busy, setBusy] = useState(false);

  const contribute = async () => {
    setBusy(true);
    try {
      const result = await api.complete(caseData.id);
      setContributed(true);
      setIndex(result.frictionIndex);
    } catch { /* the clock may not exist; the button is hidden then */ }
    finally { setBusy(false); }
  };

  return (
    <article className="card">
      <div className="done-tick" aria-hidden="true">✓</div>
      <h1>{t('done.title')}</h1>
      <p className="lede">{t('done.sub')}</p>

      <ol className="done-recap">
        <li><span>Office</span><strong>{caseData.jurisdiction?.candidates?.[0]?.office || '—'}</strong></li>
        <li><span>Checks run</span><strong>{evaluation?.scoreBasis?.rulesApplied ?? '—'} rules, {evaluation?.counts?.blocks ?? 0} blocking left</strong></li>
        <li><span>Acknowledgement</span><strong>{caseData.clock?.acknowledgementNumber || '—'}</strong></li>
      </ol>

      {caseData.clock && !contributed && (
        <div className="contribute">
          <p>{t('done.contribute')}</p>
          <Button kind="secondary" onClick={contribute} busy={busy}>{t('done.contribute')}</Button>
          <span className="hint">One row: office, service, days taken, whether the period was met. No name, no address, no identifier — and never an officer’s name.</span>
        </div>
      )}
      {contributed && <Notice tone="info">{t('done.contributed')} <a href="#/index">See the index →</a></Notice>}

      <div className="card-actions">
        <Button kind="ghost" onClick={onRestart}>{t('done.restart')}</Button>
        <a className="btn secondary" href="#/register">{t('nav.mocks')} →</a>
      </div>
    </article>
  );
}

/* ================================================================== *
 * Shell
 * ================================================================== */

/**
 * Where an arriving case belongs when the URL does not name a step.
 *
 * A case with a clock attached was filed days or weeks ago and is being looked
 * at again — that journey is inherently multi-session, and it was the one
 * landing people back on the first screen with every document already filled
 * in. Everything else starts where it always did.
 */
function resumeStep(caseData) {
  if (caseData?.clock) return 'clock';
  return caseData?.personaId ? 'intake' : 'language';
}

export default function Journey({ caseData, setCaseData, meta, route, navigate, onExit, onRestart }) {
  const { t, language } = useLang();
  // The step lives in the URL rather than in component state. Held in state, it
  // made the browser Back button leave the case entirely instead of going back
  // one step — which on a phone, where Back is the main way to move, meant
  // losing everything — and made a reload drop you at the first screen.
  const namedStep = route.split('/')[2] || '';
  const step = STEPS.includes(namedStep) ? namedStep : resumeStep(caseData);
  const [evaluation, setEvaluation] = useState(caseData.lastEvaluation || null);
  const [kinds, setKinds] = useState({});

  useEffect(() => { api.documentKinds().then((r) => {
    const map = {};
    for (const entry of r.kinds) map[entry.kind] = entry;
    setKinds(map);
  }).catch(() => {}); }, []);

  // Language changes must re-translate the findings, because the explanations
  // are keyed on (code x language) server-side.
  useEffect(() => {
    if (!caseData?.id) return;
    api.setLanguage(caseData.id, language)
      .then(() => (evaluation ? api.check(caseData.id) : null))
      .then((r) => { if (r) { setEvaluation(r.evaluation); setCaseData(r.case); } })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Rewrite an absent or unrecognised step segment to the one actually on
  // screen, so every step is linkable and survives a reload.
  useEffect(() => {
    if (namedStep !== step) navigate(`/case/${step}`, { replace: true });
  }, [namedStep, step, navigate]);

  // No scrollTo here: the hash router already scrolls on every route change.
  const go = (next) => navigate(`/case/${next}`);
  const at = STEPS.indexOf(step);
  const next = () => go(STEPS[Math.min(at + 1, STEPS.length - 1)]);
  const back = () => go(STEPS[Math.max(at - 1, 0)]);

  const persona = meta?.personas?.find((p) => p.id === caseData.personaId);
  const enriched = { ...caseData, suggestedUtterance: persona?.spokenIntake };

  return (
    <div className="journey">
      <header className="journey-nav">
        <Brand small />
        <div className="journey-nav-right">
          <LanguageSwitch compact />
          <button className="exit" onClick={onExit}>Exit ×</button>
        </div>
      </header>

      <Rail step={step} />

      {/* Eight steps is a real commitment to ask for blind. Say what it costs
          and what you walk away with, before the first question — and stop
          saying it once there is an evaluation, because by then they know. */}
      {(step === 'language' || step === 'intake') && !caseData.lastEvaluation && (
        <p className="journey-expect">{t('journey.expect')}</p>
      )}

      <main className="journey-main">
        {step === 'language' && <LanguageStep onNext={next} />}
        {step === 'intake' && <IntakeStep caseData={enriched} setCaseData={setCaseData} onNext={next} onBack={back} />}
        {step === 'office' && <OfficeStep caseData={caseData} setCaseData={setCaseData} onNext={next} onBack={back} />}
        {step === 'documents' && <DocumentsStep caseData={caseData} setCaseData={setCaseData} meta={meta} kinds={kinds} onNext={next} onBack={back} />}
        {step === 'check' && <CheckStep caseData={caseData} setCaseData={setCaseData} evaluation={evaluation} setEvaluation={setEvaluation} meta={meta} onNext={next} onBack={back} />}
        {step === 'packet' && <PacketStep caseData={caseData} evaluation={evaluation} onNext={next} onBack={back} />}
        {step === 'clock' && <ClockStep caseData={caseData} setCaseData={setCaseData} onNext={next} onBack={back} />}
        {step === 'done' && <DoneStep caseData={caseData} evaluation={evaluation} onRestart={onRestart} />}
      </main>

      {/* Ask sits on the check step only — that is where the findings live, and
          where a retrieved answer from the ledger is useful without becoming a
          tour guide for the rest of the journey. */}
      {step === 'check' && <Assistant caseData={caseData} evaluation={evaluation} />}
    </div>
  );
}
