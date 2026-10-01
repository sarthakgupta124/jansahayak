/**
 * THE MOCK REGISTER
 *
 * Every place this prototype stands in for something real, what it does
 * instead, and what would replace it in production. Served at /api/mocks and
 * rendered at /mocks.
 *
 * The register is written to be read by someone looking for the seam. If a
 * reviewer finds something we did not list here, that is a bug in this file.
 */

export const MOCK_REGISTER = [
  {
    id: 'records',
    area: 'Property records',
    status: 'mocked',
    whatWeDo: 'Every deed, property mutation extract, tax receipt, death certificate, heirship certificate, electricity bill and encumbrance certificate in the demo personas is invented. So is every name, survey number, PID, property mutation number and receipt number.',
    whatIsReal: 'The compliance engine. It runs on whatever fields it is given — invented or uploaded by you — with no special-casing for the demo data.',
    productionPath: 'Citizens upload their own documents, which is what the upload path already does. No government database is read.'
  },
  {
    id: 'aadhaar',
    area: 'Aadhaar numbers',
    status: 'mocked',
    whatWeDo: 'The demo personas carry fictitious twelve-digit numbers chosen only because they satisfy the public Verhoeff checksum. They are not allocated to anybody.',
    whatIsReal: 'The checksum itself. KYC-01 runs the real Verhoeff algorithm, so a mistyped number is caught the same way a portal would catch it.',
    productionPath: 'Aadhaar is never collected by us. eKYC happens at the counter between the citizen and the office. We only ever check that a number is well-formed before the trip.'
  },
  {
    id: 'submission',
    area: 'Submission to a government office',
    status: 'not-performed',
    whatWeDo: 'Nothing is submitted. The packet is generated for the citizen to carry and file. The "submit" step records an acknowledgement number that the citizen types in from their own receipt.',
    whatIsReal: 'The packet, the enclosure ordering, the counter checklist and the readiness report are all really generated as PDFs.',
    productionPath: 'This stays exactly as it is. Building on credential automation or screen scraping of a government portal is the design mistake we are deliberately not making.'
  },
  {
    id: 'credentials',
    area: 'Government portal credentials',
    status: 'never-collected',
    whatWeDo: 'We never ask for, store, transmit or use a citizen\'s government portal password or OTP. There is no field for one anywhere in the product.',
    whatIsReal: 'The commitment. It is architectural, not a policy we could quietly relax.',
    productionPath: 'Consent-based data access along the lines of the account aggregator model, which forbids credential storage and mandates consented transport. That framework does not exist yet for civic records; until it does, the citizen uploads their own documents.'
  },
  {
    id: 'payments',
    area: 'Payments',
    status: 'absent',
    whatWeDo: 'No payment is taken yet — there is no checkout. The ₹500 on the landing page is the intended fixed price of JanSahayak’s route (pre-flight, packet, clock), not a charge made in this prototype, and not the government’s notified counter fee. The refund line describes the intended commercial term once payments exist.',
    whatIsReal: 'The price point and the split: ₹500 for the route; public facts stay free; counter fees stay with the office that issues a receipt.',
    productionPath: 'A payment gateway charging a fixed ₹500, with a receipt and a refund path tied to the “work not done” guarantee.'
  },
  {
    id: 'boundaries',
    area: 'Corporation boundaries',
    status: 'approximate',
    whatWeDo: 'The five city corporation polygons are hand-drawn envelopes, not official geometry. They reproduce the correct corporation for every locality in our gazetteer.',
    whatIsReal: 'The geometry code: point-in-polygon, distance-to-edge, and the contested-boundary path that returns two offices instead of a confident guess when a property sits within 1.5 km of a divide.',
    productionPath: 'Drop in the official machine-readable boundary files. Nothing above the polygon data changes.'
  },
  {
    id: 'geocoding',
    area: 'Address to coordinates',
    status: 'limited',
    whatWeDo: 'An offline gazetteer of well-known Bhopal localities. An address we cannot place returns "we could not place this, and we are not going to guess" with the list of names we do know.',
    whatIsReal: 'The refusal. An unresolvable address never gets a confident answer.',
    productionPath: 'A geocoder, used with the citizen\'s consent. The offline path stays as the fallback, because it works on a connection that a geocoder call would not survive.'
  },
  {
    id: 'sla',
    area: 'Statutory timelines and the escalation ladder',
    status: 'encoded',
    whatWeDo: 'The stipulated period, the appeal stages and their disposal windows are encoded from the published framework and stamped with a verification date.',
    whatIsReal: 'All the arithmetic. Deadlines, elapsed days, days overdue, which rung is available and when — every date in a generated letter is computed, never typed.',
    productionPath: 'A maintained service catalogue with a review date per service, and a fail-safe that shows "we cannot verify this — here is the official source" rather than a stale confident number.'
  },
  {
    id: 'escalation-delivery',
    area: 'Appeals and RTI applications',
    status: 'drafted-not-sent',
    whatWeDo: 'First appeal, second appeal and RTI drafts are fully generated with correct date arithmetic and downloadable. None is delivered to anybody.',
    whatIsReal: 'The drafting, the arithmetic, and the availability logic that refuses to produce an appeal before the statutory period has actually lapsed.',
    productionPath: 'Filing still stays with the citizen. Delivery would be an integration with the official grievance channel, on the citizen\'s explicit instruction each time.'
  },
  {
    id: 'time-travel',
    area: 'The demo time-travel control',
    status: 'demo-affordance',
    whatWeDo: 'A clearly labelled control moves the date the clock is evaluated against, so a reviewer can see a breach without waiting thirty days.',
    whatIsReal: 'Everything downstream of it. The breach detection, the escalation availability and the letter dates are computed from that date by the same code that would run on a real day.',
    productionPath: 'Remove the control. Nothing else changes.'
  },
  {
    id: 'extraction',
    area: 'Reading fields off a document photo',
    status: 'conditional',
    whatWeDo: 'If a vision model is configured, uploaded photographs are read into candidate field values. If not, documents are classified by file name and you confirm the fields yourself. The app states which path ran, on every document.',
    whatIsReal: 'Both paths are real and both feed the identical engine. Every extracted value is shown to you as an editable field before a single rule runs on it.',
    productionPath: 'The same, with on-device pre-processing for face and signature regions where the browser allows it.'
  },
  {
    id: 'showcase-voice',
    area: 'The Kannada voice in the landing-page showcase',
    status: 'browser-native',
    whatWeDo: 'The spoken line is a pre-rendered audio file when one has been generated with "npm run voice", which calls ElevenLabs at build time. If that file is absent, the browser\'s own Kannada synthesis reads the same sentence, and if the browser has no Kannada voice the captions carry it alone. Nothing is generated at request time.',
    whatIsReal: 'The words. It is Lakshmi\'s actual demo utterance, the same string the intake parser is given, so what you hear is what the engine reads.',
    productionPath: 'The same shape, applied to the defect ledger: one clip per (defect code x language), rendered once and served flat. That is roughly 141 clips in total, which is why voice output does not get more expensive as more citizens use it.'
  },
  {
    id: 'voice',
    area: 'Voice input and spoken output',
    status: 'browser-native',
    whatWeDo: 'Speech recognition and speech synthesis use the browser\'s own engines. There is no server-side ASR, and audio never leaves the device.',
    whatIsReal: 'The intake parsing. Code-mixed cue matching runs on whatever text arrives, typed or spoken, entirely offline.',
    productionPath: 'Pre-rendered audio cached per defect code and language rather than live synthesis — about 135 clips total today, which is why this cost does not grow with the number of citizens.'
  },
  {
    id: 'friction-index',
    area: 'The friction index',
    status: 'seeded',
    whatWeDo: 'Fifteen synthetic rows seed the index so it is legible on a fresh deployment. Cases completed in this deployment add real rows, marked separately.',
    whatIsReal: 'The aggregation, and the constraint that it is by office and service only — never by officer, and with no citizen identifier attached to any row.',
    productionPath: 'A published threshold (no office shown below five cases) and an open data feed.'
  },
  {
    id: 'storage',
    area: 'Where your case lives',
    status: 'memory-only',
    whatWeDo: 'A case is held in server memory for three hours and then discarded. Nothing is written to disk. Closing the tab and starting again loses everything, which is the intended behaviour.',
    whatIsReal: 'The expiry, and the delete endpoint that removes a case immediately on request.',
    productionPath: 'A retention design settled with a privacy review, aligned to DPDP Act principles, with explicit and revocable consent — not a default inherited from whatever database was convenient.'
  }
];

export const MOCK_COUNTS = MOCK_REGISTER.reduce((acc, entry) => {
  acc[entry.status] = (acc[entry.status] || 0) + 1;
  return acc;
}, {});
