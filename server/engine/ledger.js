/**
 * THE DEFECT LEDGER
 *
 * Every verdict this product can produce is one of the codes below. The
 * compliance engine emits a code plus an evidence object; this file is the only
 * place that turns a code into human language.
 *
 * That separation is the whole architectural commitment:
 *   - the engine decides, deterministically, and can be tested
 *   - the ledger explains, in the citizen's language
 *   - a model is never in the decision path
 *
 * Because explanations are keyed on (code x language) and not on a citizen, the
 * total number of explanations that ever need to exist is
 * (number of codes) x (number of languages) — about 135 today. Serving one
 * citizen and serving one crore citizens costs the same here.
 *
 * severity:
 *   blocks   — the counter will refuse the application
 *   delays   — it will be accepted but will come back as an objection
 *   advisory — not a defect; worth knowing before you go
 *
 * `citation` names the source of the requirement. Where we could not verify a
 * clause we say so rather than inventing one — see `verified: false`.
 */

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', speech: 'en-IN' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', speech: 'kn-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी', speech: 'hi-IN' }
];

const CITATION = {
  ekhata: {
    source: 'e-Khata / Khata transfer document checklist published for Bengaluru city corporations',
    lastVerified: '2026-08-01',
    verified: true
  },
  taxContinuity: {
    source: 'Property tax clearance requirement for khata transfer — three consecutive assessment years',
    lastVerified: '2026-08-01',
    verified: true
  },
  registration: {
    source: 'Registration Act 1908, s.17 — compulsory registration of instruments transferring immovable property',
    lastVerified: '2026-08-01',
    verified: true
  },
  stamp: {
    source: 'Karnataka Stamp Act 1957 — stamp duty payable on a conveyance',
    lastVerified: '2026-08-01',
    verified: true
  },
  succession: {
    source: 'Requirement of proof of succession (death certificate + heirship evidence) for transfer to an heir',
    lastVerified: '2026-08-01',
    verified: true
  },
  officePractice: {
    source: 'Commonly applied counter practice — not traced to a published clause',
    lastVerified: '2026-08-01',
    verified: false
  }
};

/**
 * @typedef {Object} DefectEntry
 * @property {'blocks'|'delays'|'advisory'} severity
 * @property {string} category
 * @property {number} expectedDays  working days the fix typically takes
 * @property {object} citation
 * @property {Record<string,{title:string,why:string,fix:string,owner:string,where:string}>} text
 */

/** @type {Record<string, DefectEntry>} */
export const DEFECTS = {
  /* ---------------------------------------------------------------- *
   * DOC — a required document is absent
   * ---------------------------------------------------------------- */
  'DOC-01': {
    severity: 'blocks', category: 'missing-document', expectedDays: 3, citation: CITATION.ekhata,
    text: {
      en: { title: 'Sale deed is missing', why: 'The registered sale deed is the document that proves how the property came to the current owner. Without it there is nothing to transfer from.', fix: 'Get a certified copy of the registered sale deed. Carry the document number and year of registration if you have them.', owner: 'Sub-Registrar office where the deed was registered', where: 'Sub-Registrar office, or Kaveri online services' },
      kn: { title: 'ಕ್ರಯಪತ್ರ (ಸೇಲ್ ಡೀಡ್) ಇಲ್ಲ', why: 'ನೋಂದಾಯಿತ ಕ್ರಯಪತ್ರವೇ ಆಸ್ತಿ ಈಗಿನ ಮಾಲೀಕರಿಗೆ ಹೇಗೆ ಬಂತು ಎಂಬುದನ್ನು ಸಾಬೀತು ಮಾಡುತ್ತದೆ. ಅದಿಲ್ಲದೆ ವರ್ಗಾವಣೆ ಸಾಧ್ಯವಿಲ್ಲ.', fix: 'ನೋಂದಾಯಿತ ಕ್ರಯಪತ್ರದ ದೃಢೀಕೃತ ಪ್ರತಿ ಪಡೆಯಿರಿ. ದಾಖಲೆ ಸಂಖ್ಯೆ ಮತ್ತು ವರ್ಷ ಗೊತ್ತಿದ್ದರೆ ಜೊತೆಗೆ ಒಯ್ಯಿರಿ.', owner: 'ದಾಖಲಾತಿ ಆದ ಉಪ-ನೋಂದಣಾಧಿಕಾರಿ ಕಚೇರಿ', where: 'ಉಪ-ನೋಂದಣಾಧಿಕಾರಿ ಕಚೇರಿ ಅಥವಾ ಕಾವೇರಿ ಆನ್‌ಲೈನ್ ಸೇವೆ' },
      hi: { title: 'बिक्री विलेख (सेल डीड) नहीं है', why: 'पंजीकृत बिक्री विलेख ही यह साबित करता है कि संपत्ति मौजूदा मालिक तक कैसे पहुँची। इसके बिना हस्तांतरण नहीं हो सकता।', fix: 'पंजीकृत बिक्री विलेख की प्रमाणित प्रति लें। दस्तावेज़ संख्या और पंजीकरण वर्ष साथ रखें।', owner: 'वह उप-पंजीयक कार्यालय जहाँ विलेख पंजीकृत हुआ', where: 'उप-पंजीयक कार्यालय या कावेरी ऑनलाइन सेवा' }
    }
  },
  'DOC-02': {
    severity: 'blocks', category: 'missing-document', expectedDays: 2, citation: CITATION.ekhata,
    text: {
      en: { title: 'Current khata extract is missing', why: 'The transfer moves the khata from one name to another. The office needs to see the khata as it stands today.', fix: 'Obtain the current khata extract for the property. If it was issued more than a year ago, take a fresh one.', owner: 'Your city corporation ward office', where: 'Corporation ward office or Bengaluru One centre' },
      kn: { title: 'ಪ್ರಸ್ತುತ ಖಾತಾ ಉದ್ಧೃತ ಇಲ್ಲ', why: 'ವರ್ಗಾವಣೆ ಎಂದರೆ ಖಾತಾ ಒಂದು ಹೆಸರಿನಿಂದ ಇನ್ನೊಂದಕ್ಕೆ ಬದಲಾಗುವುದು. ಇಂದಿನ ಸ್ಥಿತಿಯ ಖಾತಾ ಕಚೇರಿಗೆ ಬೇಕು.', fix: 'ಆಸ್ತಿಯ ಪ್ರಸ್ತುತ ಖಾತಾ ಉದ್ಧೃತ ಪಡೆಯಿರಿ. ಒಂದು ವರ್ಷಕ್ಕಿಂತ ಹಳೆಯದಾಗಿದ್ದರೆ ಹೊಸದನ್ನು ಪಡೆಯಿರಿ.', owner: 'ನಿಮ್ಮ ಪಾಲಿಕೆಯ ವಾರ್ಡ್ ಕಚೇರಿ', where: 'ಪಾಲಿಕೆ ವಾರ್ಡ್ ಕಚೇರಿ ಅಥವಾ ಬೆಂಗಳೂರು ಒನ್ ಕೇಂದ್ರ' },
      hi: { title: 'मौजूदा खाता उद्धरण नहीं है', why: 'हस्तांतरण में खाता एक नाम से दूसरे नाम पर जाता है। कार्यालय को आज की स्थिति का खाता चाहिए।', fix: 'संपत्ति का मौजूदा खाता उद्धरण लें। एक साल से पुराना हो तो नया लें।', owner: 'आपका नगर निगम वार्ड कार्यालय', where: 'निगम वार्ड कार्यालय या बेंगलुरु वन केंद्र' }
    }
  },
  'DOC-03': {
    severity: 'blocks', category: 'missing-document', expectedDays: 1, citation: CITATION.taxContinuity,
    text: {
      en: { title: 'No property tax receipts provided', why: 'The office will not transfer a khata while tax status is unknown. Three consecutive years are expected.', fix: 'Download the last three years of paid property tax receipts using your property ID.', owner: 'You, using the corporation property tax portal', where: 'Corporation property tax portal or ward help desk' },
      kn: { title: 'ಆಸ್ತಿ ತೆರಿಗೆ ರಸೀದಿಗಳೇ ಇಲ್ಲ', why: 'ತೆರಿಗೆ ಸ್ಥಿತಿ ಗೊತ್ತಿಲ್ಲದೆ ಕಚೇರಿ ಖಾತಾ ವರ್ಗಾಯಿಸುವುದಿಲ್ಲ. ಸತತ ಮೂರು ವರ್ಷಗಳ ರಸೀದಿ ಬೇಕು.', fix: 'ನಿಮ್ಮ ಆಸ್ತಿ ಗುರುತಿನ ಸಂಖ್ಯೆ ಬಳಸಿ ಕಳೆದ ಮೂರು ವರ್ಷಗಳ ಪಾವತಿ ರಸೀದಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ.', owner: 'ನೀವೇ — ಪಾಲಿಕೆ ತೆರಿಗೆ ಪೋರ್ಟಲ್ ಮೂಲಕ', where: 'ಪಾಲಿಕೆ ಆಸ್ತಿ ತೆರಿಗೆ ಪೋರ್ಟಲ್ ಅಥವಾ ವಾರ್ಡ್ ಸಹಾಯ ಕೇಂದ್ರ' },
      hi: { title: 'संपत्ति कर की कोई रसीद नहीं दी गई', why: 'कर की स्थिति जाने बिना कार्यालय खाता हस्तांतरित नहीं करेगा। लगातार तीन वर्षों की रसीदें चाहिए।', fix: 'अपनी संपत्ति आईडी से पिछले तीन वर्षों की भुगतान रसीदें डाउनलोड करें।', owner: 'आप स्वयं — निगम कर पोर्टल से', where: 'निगम संपत्ति कर पोर्टल या वार्ड सहायता केंद्र' }
    }
  },
  'DOC-04': {
    severity: 'blocks', category: 'missing-document', expectedDays: 1, citation: CITATION.ekhata,
    text: {
      en: { title: 'Aadhaar for eKYC is missing', why: 'e-Khata requires Aadhaar-based eKYC of the applicant. Without it the application cannot be opened.', fix: 'Carry your Aadhaar. The number is verified by OTP at the counter; do not share it with anyone else.', owner: 'You', where: 'You already have this' },
      kn: { title: 'ಇ-ಕೆವೈಸಿಗೆ ಆಧಾರ್ ಇಲ್ಲ', why: 'ಇ-ಖಾತಾಗೆ ಅರ್ಜಿದಾರರ ಆಧಾರ್ ಆಧಾರಿತ ಇ-ಕೆವೈಸಿ ಬೇಕು. ಅದಿಲ್ಲದೆ ಅರ್ಜಿ ತೆರೆಯುವುದಿಲ್ಲ.', fix: 'ನಿಮ್ಮ ಆಧಾರ್ ಒಯ್ಯಿರಿ. ಕೌಂಟರ್‌ನಲ್ಲಿ ಒಟಿಪಿ ಮೂಲಕ ಪರಿಶೀಲನೆ ಆಗುತ್ತದೆ; ಬೇರೆ ಯಾರಿಗೂ ಹಂಚಬೇಡಿ.', owner: 'ನೀವು', where: 'ಇದು ಈಗಾಗಲೇ ನಿಮ್ಮ ಬಳಿ ಇದೆ' },
      hi: { title: 'ई-केवाईसी के लिए आधार नहीं है', why: 'ई-खाता के लिए आवेदक का आधार आधारित ई-केवाईसी ज़रूरी है। इसके बिना आवेदन नहीं खुलेगा।', fix: 'अपना आधार साथ रखें। काउंटर पर ओटीपी से सत्यापन होगा; किसी और को न दें।', owner: 'आप', where: 'यह आपके पास पहले से है' }
    }
  },
  'DOC-05': {
    severity: 'delays', category: 'missing-document', expectedDays: 1, citation: CITATION.ekhata,
    text: {
      en: { title: 'Latest electricity bill is missing', why: 'The BESCOM bill is used to tie the property to a physical address. Its absence is a common objection.', fix: 'Print or download the most recent BESCOM bill for the property.', owner: 'You, from the BESCOM portal', where: 'BESCOM portal or the sub-division office' },
      kn: { title: 'ಇತ್ತೀಚಿನ ವಿದ್ಯುತ್ ಬಿಲ್ ಇಲ್ಲ', why: 'ಬೆಸ್ಕಾಂ ಬಿಲ್ ಆಸ್ತಿಯನ್ನು ಭೌತಿಕ ವಿಳಾಸಕ್ಕೆ ಜೋಡಿಸಲು ಬಳಕೆಯಾಗುತ್ತದೆ. ಇದಿಲ್ಲದಿರುವುದು ಸಾಮಾನ್ಯ ಆಕ್ಷೇಪ.', fix: 'ಆಸ್ತಿಯ ಇತ್ತೀಚಿನ ಬೆಸ್ಕಾಂ ಬಿಲ್ ಮುದ್ರಿಸಿ ಅಥವಾ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ.', owner: 'ನೀವೇ — ಬೆಸ್ಕಾಂ ಪೋರ್ಟಲ್‌ನಿಂದ', where: 'ಬೆಸ್ಕಾಂ ಪೋರ್ಟಲ್ ಅಥವಾ ಉಪ-ವಿಭಾಗ ಕಚೇರಿ' },
      hi: { title: 'नवीनतम बिजली बिल नहीं है', why: 'बेस्कॉम बिल संपत्ति को भौतिक पते से जोड़ने के लिए इस्तेमाल होता है। इसका न होना आम आपत्ति है।', fix: 'संपत्ति का सबसे नया बेस्कॉम बिल प्रिंट या डाउनलोड करें।', owner: 'आप — बेस्कॉम पोर्टल से', where: 'बेस्कॉम पोर्टल या उप-मंडल कार्यालय' }
    }
  },
  'DOC-06': {
    severity: 'delays', category: 'missing-document', expectedDays: 7, citation: CITATION.officePractice,
    text: {
      en: { title: 'Encumbrance certificate is missing', why: 'The EC shows whether any loan or claim is registered against the property. Many counters ask for 13 years.', fix: 'Apply for an encumbrance certificate covering at least the last 13 years.', owner: 'Sub-Registrar office', where: 'Sub-Registrar office or Kaveri online services' },
      kn: { title: 'ಋಣಭಾರ ಪ್ರಮಾಣಪತ್ರ (ಇಸಿ) ಇಲ್ಲ', why: 'ಆಸ್ತಿಯ ಮೇಲೆ ಸಾಲ ಅಥವಾ ಹಕ್ಕು ನೋಂದಾಯಿತವಾಗಿದೆಯೇ ಎಂದು ಇಸಿ ತೋರಿಸುತ್ತದೆ. ಹಲವು ಕಚೇರಿಗಳು 13 ವರ್ಷದ ಇಸಿ ಕೇಳುತ್ತವೆ.', fix: 'ಕನಿಷ್ಠ ಕಳೆದ 13 ವರ್ಷಗಳ ಋಣಭಾರ ಪ್ರಮಾಣಪತ್ರಕ್ಕೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ.', owner: 'ಉಪ-ನೋಂದಣಾಧಿಕಾರಿ ಕಚೇರಿ', where: 'ಉಪ-ನೋಂದಣಾಧಿಕಾರಿ ಕಚೇರಿ ಅಥವಾ ಕಾವೇರಿ ಆನ್‌ಲೈನ್' },
      hi: { title: 'भार-मुक्ति प्रमाणपत्र (ईसी) नहीं है', why: 'ईसी दिखाता है कि संपत्ति पर कोई ऋण या दावा दर्ज है या नहीं। कई काउंटर 13 वर्ष की ईसी माँगते हैं।', fix: 'कम से कम पिछले 13 वर्षों का भार-मुक्ति प्रमाणपत्र लें।', owner: 'उप-पंजीयक कार्यालय', where: 'उप-पंजीयक कार्यालय या कावेरी ऑनलाइन' }
    }
  },
  'DOC-07': {
    severity: 'blocks', category: 'missing-document', expectedDays: 5, citation: CITATION.succession,
    text: {
      en: { title: 'Death certificate is missing', why: 'For a transfer to an heir, the office must first see proof that the recorded owner has died.', fix: 'Obtain the registered death certificate of the recorded owner.', owner: 'Registrar of Births and Deaths', where: 'Corporation health office or Seva Sindhu' },
      kn: { title: 'ಮರಣ ಪ್ರಮಾಣಪತ್ರ ಇಲ್ಲ', why: 'ವಾರಸುದಾರರಿಗೆ ವರ್ಗಾವಣೆ ಮಾಡಲು, ದಾಖಲಾದ ಮಾಲೀಕರು ಮೃತರಾಗಿದ್ದಾರೆ ಎಂಬ ಪುರಾವೆ ಮೊದಲು ಬೇಕು.', fix: 'ದಾಖಲಾದ ಮಾಲೀಕರ ನೋಂದಾಯಿತ ಮರಣ ಪ್ರಮಾಣಪತ್ರ ಪಡೆಯಿರಿ.', owner: 'ಜನನ-ಮರಣ ನೋಂದಣಾಧಿಕಾರಿ', where: 'ಪಾಲಿಕೆ ಆರೋಗ್ಯ ಕಚೇರಿ ಅಥವಾ ಸೇವಾ ಸಿಂಧು' },
      hi: { title: 'मृत्यु प्रमाणपत्र नहीं है', why: 'वारिस को हस्तांतरण के लिए कार्यालय को पहले यह प्रमाण चाहिए कि दर्ज मालिक की मृत्यु हो चुकी है।', fix: 'दर्ज मालिक का पंजीकृत मृत्यु प्रमाणपत्र प्राप्त करें।', owner: 'जन्म-मृत्यु रजिस्ट्रार', where: 'निगम स्वास्थ्य कार्यालय या सेवा सिंधु' }
    }
  },
  'DOC-08': {
    severity: 'blocks', category: 'missing-document', expectedDays: 21, citation: CITATION.succession,
    text: {
      en: { title: 'Legal heir / succession certificate is missing', why: 'A death certificate proves the owner died. It does not prove who inherits. That needs a separate document.', fix: 'Apply for a legal heir certificate naming every heir. This is the slowest step — start it first.', owner: 'Tahsildar of your taluk', where: 'Taluk office or Nadakacheri / Seva Sindhu' },
      kn: { title: 'ವಾರಸುದಾರ ಪ್ರಮಾಣಪತ್ರ ಇಲ್ಲ', why: 'ಮರಣ ಪ್ರಮಾಣಪತ್ರ ಮಾಲೀಕರ ಮರಣವನ್ನಷ್ಟೇ ಸಾಬೀತು ಮಾಡುತ್ತದೆ. ಯಾರು ವಾರಸುದಾರರು ಎಂಬುದನ್ನಲ್ಲ. ಅದಕ್ಕೆ ಪ್ರತ್ಯೇಕ ದಾಖಲೆ ಬೇಕು.', fix: 'ಎಲ್ಲ ವಾರಸುದಾರರ ಹೆಸರಿರುವ ವಾರಸುದಾರ ಪ್ರಮಾಣಪತ್ರಕ್ಕೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ. ಇದು ಅತಿ ನಿಧಾನದ ಹಂತ — ಮೊದಲು ಇದನ್ನೇ ಶುರು ಮಾಡಿ.', owner: 'ನಿಮ್ಮ ತಾಲ್ಲೂಕಿನ ತಹಶೀಲ್ದಾರ್', where: 'ತಾಲ್ಲೂಕು ಕಚೇರಿ ಅಥವಾ ನಾಡಕಚೇರಿ / ಸೇವಾ ಸಿಂಧು' },
      hi: { title: 'वारिस / उत्तराधिकार प्रमाणपत्र नहीं है', why: 'मृत्यु प्रमाणपत्र केवल मृत्यु सिद्ध करता है, यह नहीं कि उत्तराधिकारी कौन है। उसके लिए अलग दस्तावेज़ चाहिए।', fix: 'सभी वारिसों के नाम वाला वारिस प्रमाणपत्र बनवाएँ। यह सबसे धीमा चरण है — इसे पहले शुरू करें।', owner: 'आपके तालुक के तहसीलदार', where: 'तालुक कार्यालय या नाडकचेरी / सेवा सिंधु' }
    }
  },
  'DOC-09': {
    severity: 'blocks', category: 'missing-document', expectedDays: 1, citation: CITATION.ekhata,
    text: {
      en: { title: 'Application form is not signed', why: 'An unsigned application is returned at the counter without being read.', fix: 'Sign the application in the two places marked in your packet before you go.', owner: 'You', where: 'At home, before the visit' },
      kn: { title: 'ಅರ್ಜಿ ನಮೂನೆಗೆ ಸಹಿ ಇಲ್ಲ', why: 'ಸಹಿ ಇಲ್ಲದ ಅರ್ಜಿಯನ್ನು ಓದದೆಯೇ ಕೌಂಟರ್‌ನಲ್ಲಿ ಹಿಂತಿರುಗಿಸಲಾಗುತ್ತದೆ.', fix: 'ಹೋಗುವ ಮೊದಲು ಪ್ಯಾಕೆಟ್‌ನಲ್ಲಿ ಗುರುತಿಸಿದ ಎರಡು ಸ್ಥಳಗಳಲ್ಲಿ ಸಹಿ ಮಾಡಿ.', owner: 'ನೀವು', where: 'ಮನೆಯಲ್ಲಿ, ಭೇಟಿಗೆ ಮೊದಲು' },
      hi: { title: 'आवेदन पत्र पर हस्ताक्षर नहीं है', why: 'बिना हस्ताक्षर का आवेदन काउंटर पर पढ़े बिना लौटा दिया जाता है।', fix: 'जाने से पहले पैकेट में चिह्नित दो जगहों पर हस्ताक्षर करें।', owner: 'आप', where: 'घर पर, जाने से पहले' }
    }
  },
  'DOC-10': {
    severity: 'delays', category: 'missing-document', expectedDays: 1, citation: CITATION.officePractice,
    text: {
      en: { title: 'Passport photograph is missing', why: 'Most counters attach a recent photograph of the applicant to the file.', fix: 'Carry two recent passport-size photographs.', owner: 'You', where: 'Any photo studio' },
      kn: { title: 'ಪಾಸ್‌ಪೋರ್ಟ್ ಅಳತೆಯ ಭಾವಚಿತ್ರ ಇಲ್ಲ', why: 'ಬಹುತೇಕ ಕೌಂಟರ್‌ಗಳು ಅರ್ಜಿದಾರರ ಇತ್ತೀಚಿನ ಭಾವಚಿತ್ರವನ್ನು ಕಡತಕ್ಕೆ ಲಗತ್ತಿಸುತ್ತವೆ.', fix: 'ಇತ್ತೀಚಿನ ಎರಡು ಪಾಸ್‌ಪೋರ್ಟ್ ಅಳತೆಯ ಫೋಟೋ ಒಯ್ಯಿರಿ.', owner: 'ನೀವು', where: 'ಯಾವುದೇ ಫೋಟೋ ಸ್ಟುಡಿಯೋ' },
      hi: { title: 'पासपोर्ट फोटो नहीं है', why: 'अधिकतर काउंटर आवेदक का हाल का फोटो फाइल में लगाते हैं।', fix: 'दो हाल की पासपोर्ट साइज़ फोटो साथ रखें।', owner: 'आप', where: 'कोई भी फोटो स्टूडियो' }
    }
  },
  'DOC-11': {
    severity: 'blocks', category: 'missing-document', expectedDays: 10, citation: CITATION.succession,
    text: {
      en: { title: 'No-objection from the other heirs is missing', why: 'Your heirship document names more than one heir. The khata cannot go into one name while the others are silent.', fix: 'Get a notarised no-objection affidavit from each of the other heirs, or register a partition/release deed.', owner: 'The other heirs, with a notary', where: 'Notary, or Sub-Registrar for a release deed' },
      kn: { title: 'ಇತರ ವಾರಸುದಾರರ ನಿರಾಕ್ಷೇಪಣಾ ಪತ್ರ ಇಲ್ಲ', why: 'ನಿಮ್ಮ ವಾರಸು ದಾಖಲೆಯಲ್ಲಿ ಒಂದಕ್ಕಿಂತ ಹೆಚ್ಚು ವಾರಸುದಾರರಿದ್ದಾರೆ. ಉಳಿದವರು ಮೌನವಾಗಿರುವಾಗ ಖಾತಾ ಒಬ್ಬರ ಹೆಸರಿಗೆ ಹೋಗುವುದಿಲ್ಲ.', fix: 'ಉಳಿದ ಪ್ರತಿಯೊಬ್ಬ ವಾರಸುದಾರರಿಂದ ನೋಟರೈಸ್ಡ್ ನಿರಾಕ್ಷೇಪಣಾ ಪ್ರಮಾಣಪತ್ರ ಪಡೆಯಿರಿ, ಅಥವಾ ವಿಭಾಗ/ಬಿಡುಗಡೆ ಪತ್ರ ನೋಂದಾಯಿಸಿ.', owner: 'ಇತರ ವಾರಸುದಾರರು, ನೋಟರಿ ಜೊತೆ', where: 'ನೋಟರಿ, ಅಥವಾ ಬಿಡುಗಡೆ ಪತ್ರಕ್ಕೆ ಉಪ-ನೋಂದಣಾಧಿಕಾರಿ' },
      hi: { title: 'अन्य वारिसों का अनापत्ति पत्र नहीं है', why: 'आपके वारिस दस्तावेज़ में एक से अधिक वारिस हैं। बाकी की सहमति के बिना खाता एक नाम पर नहीं जाएगा।', fix: 'बाकी हर वारिस से नोटरीकृत अनापत्ति शपथपत्र लें, या विभाजन/रिलीज़ डीड पंजीकृत कराएँ।', owner: 'अन्य वारिस, नोटरी के साथ', where: 'नोटरी, या रिलीज़ डीड के लिए उप-पंजीयक' }
    }
  },

  /* ---------------------------------------------------------------- *
   * NAME — the same person is written differently across documents
   * ---------------------------------------------------------------- */
  'NAME-01': {
    severity: 'blocks', category: 'consistency', expectedDays: 1, citation: CITATION.ekhata,
    text: {
      en: { title: 'Owner name differs between the deed and the khata', why: 'The two documents do not agree on who owns this property. This is the single most common reason an application is refused — and the most common thing a middleman charges to "handle".', fix: 'Get a one-page notarised affidavit stating that both names refer to the same person, and attach an ID that carries both forms if you have one.', owner: 'Notary or advocate', where: 'Any notary — usually near the Sub-Registrar office' },
      kn: { title: 'ಕ್ರಯಪತ್ರ ಮತ್ತು ಖಾತಾದಲ್ಲಿ ಮಾಲೀಕರ ಹೆಸರು ಬೇರೆ ಬೇರೆ', why: 'ಈ ಆಸ್ತಿಯ ಮಾಲೀಕರು ಯಾರು ಎಂಬ ಬಗ್ಗೆ ಎರಡು ದಾಖಲೆಗಳು ಒಪ್ಪುತ್ತಿಲ್ಲ. ಅರ್ಜಿ ತಿರಸ್ಕೃತವಾಗಲು ಇದೇ ಅತಿ ಸಾಮಾನ್ಯ ಕಾರಣ — ಮತ್ತು ಮಧ್ಯವರ್ತಿ ಹಣ ಪಡೆಯುವುದೂ ಇದನ್ನೇ "ಸರಿಪಡಿಸಲು".', fix: 'ಎರಡೂ ಹೆಸರುಗಳು ಒಬ್ಬರೇ ವ್ಯಕ್ತಿಗೆ ಸೇರಿವೆ ಎಂದು ಹೇಳುವ ಒಂದು ಪುಟದ ನೋಟರೈಸ್ಡ್ ಪ್ರಮಾಣಪತ್ರ ಪಡೆಯಿರಿ; ಎರಡೂ ರೂಪಗಳಿರುವ ಗುರುತಿನ ಚೀಟಿ ಇದ್ದರೆ ಲಗತ್ತಿಸಿ.', owner: 'ನೋಟರಿ ಅಥವಾ ವಕೀಲರು', where: 'ಯಾವುದೇ ನೋಟರಿ — ಸಾಮಾನ್ಯವಾಗಿ ಉಪ-ನೋಂದಣಿ ಕಚೇರಿ ಬಳಿ' },
      hi: { title: 'विलेख और खाते में मालिक का नाम अलग है', why: 'दोनों दस्तावेज़ इस बात पर सहमत नहीं कि मालिक कौन है। आवेदन अस्वीकार होने का यही सबसे आम कारण है — और बिचौलिया इसी को "सँभालने" के पैसे लेता है।', fix: 'एक पेज का नोटरीकृत शपथपत्र लें कि दोनों नाम एक ही व्यक्ति के हैं; दोनों रूप वाला कोई पहचान पत्र हो तो लगाएँ।', owner: 'नोटरी या अधिवक्ता', where: 'कोई भी नोटरी — आमतौर पर उप-पंजीयक कार्यालय के पास' }
    }
  },
  'NAME-02': {
    severity: 'delays', category: 'consistency', expectedDays: 2, citation: CITATION.taxContinuity,
    text: {
      en: { title: 'Tax receipts are in a different name from the khata', why: 'The receipts prove tax was paid, but not that it was paid for this owner\'s holding. The counter will raise this.', fix: 'Either get the receipts reissued against the correct property ID, or add the same-person affidavit covering both names.', owner: 'Property tax help desk, or a notary', where: 'Corporation property tax counter' },
      kn: { title: 'ತೆರಿಗೆ ರಸೀದಿಗಳಲ್ಲಿನ ಹೆಸರು ಖಾತಾಗಿಂತ ಬೇರೆ', why: 'ರಸೀದಿಗಳು ತೆರಿಗೆ ಪಾವತಿಯನ್ನು ತೋರಿಸುತ್ತವೆ, ಆದರೆ ಈ ಮಾಲೀಕರ ಆಸ್ತಿಗೆ ಪಾವತಿಯಾಗಿದೆ ಎಂದಲ್ಲ. ಕೌಂಟರ್‌ನಲ್ಲಿ ಇದನ್ನು ಎತ್ತುತ್ತಾರೆ.', fix: 'ಸರಿಯಾದ ಆಸ್ತಿ ಗುರುತಿನ ಸಂಖ್ಯೆಗೆ ರಸೀದಿಗಳನ್ನು ಮರು-ವಿತರಿಸಿ, ಅಥವಾ ಎರಡೂ ಹೆಸರುಗಳ ಒಂದೇ-ವ್ಯಕ್ತಿ ಪ್ರಮಾಣಪತ್ರ ಸೇರಿಸಿ.', owner: 'ಆಸ್ತಿ ತೆರಿಗೆ ಸಹಾಯ ಕೇಂದ್ರ ಅಥವಾ ನೋಟರಿ', where: 'ಪಾಲಿಕೆ ಆಸ್ತಿ ತೆರಿಗೆ ಕೌಂಟರ್' },
      hi: { title: 'कर रसीदें खाते से अलग नाम में हैं', why: 'रसीदें कर भुगतान दिखाती हैं, पर यह नहीं कि इसी मालिक की संपत्ति का भुगतान है। काउंटर पर आपत्ति आएगी।', fix: 'सही संपत्ति आईडी पर रसीदें दोबारा जारी कराएँ, या दोनों नामों वाला एक-ही-व्यक्ति शपथपत्र जोड़ें।', owner: 'संपत्ति कर सहायता केंद्र या नोटरी', where: 'निगम संपत्ति कर काउंटर' }
    }
  },
  'NAME-03': {
    severity: 'blocks', category: 'consistency', expectedDays: 7, citation: CITATION.ekhata,
    text: {
      en: { title: 'Aadhaar name does not match the applicant name', why: 'eKYC compares the name on Aadhaar with the name on the application. A mismatch stops the eKYC step itself, before any human sees the file.', fix: 'Correct whichever is wrong. Updating the name on Aadhaar is free once and takes about a week.', owner: 'You, at an Aadhaar enrolment centre', where: 'Any Aadhaar Seva Kendra or authorised centre' },
      kn: { title: 'ಆಧಾರ್ ಹೆಸರು ಅರ್ಜಿದಾರರ ಹೆಸರಿಗೆ ಹೊಂದುತ್ತಿಲ್ಲ', why: 'ಇ-ಕೆವೈಸಿ ಆಧಾರ್ ಹೆಸರನ್ನು ಅರ್ಜಿಯ ಹೆಸರಿಗೆ ಹೋಲಿಸುತ್ತದೆ. ವ್ಯತ್ಯಾಸವಿದ್ದರೆ ಯಾರೂ ಕಡತ ನೋಡುವ ಮೊದಲೇ ಇ-ಕೆವೈಸಿ ನಿಲ್ಲುತ್ತದೆ.', fix: 'ತಪ್ಪಿರುವುದನ್ನು ಸರಿಪಡಿಸಿ. ಆಧಾರ್‌ನಲ್ಲಿ ಹೆಸರು ತಿದ್ದುಪಡಿ ಒಮ್ಮೆ ಉಚಿತ, ಸುಮಾರು ಒಂದು ವಾರ ಬೇಕು.', owner: 'ನೀವೇ — ಆಧಾರ್ ನೋಂದಣಿ ಕೇಂದ್ರದಲ್ಲಿ', where: 'ಯಾವುದೇ ಆಧಾರ್ ಸೇವಾ ಕೇಂದ್ರ' },
      hi: { title: 'आधार का नाम आवेदक के नाम से मेल नहीं खाता', why: 'ई-केवाईसी आधार के नाम की तुलना आवेदन के नाम से करता है। अंतर होने पर फाइल किसी के देखने से पहले ही रुक जाती है।', fix: 'जो गलत है उसे सुधारें। आधार में नाम सुधार एक बार निःशुल्क है और लगभग एक सप्ताह लगता है।', owner: 'आप — आधार नामांकन केंद्र पर', where: 'कोई भी आधार सेवा केंद्र' }
    }
  },
  'NAME-04': {
    severity: 'advisory', category: 'consistency', expectedDays: 0, citation: CITATION.officePractice,
    text: {
      en: { title: 'Electricity bill is in someone else\'s name', why: 'This is normal for an inherited property and is usually accepted. Some counters still ask about it, so be ready to explain.', fix: 'No action needed before submission. If asked, say the connection is still in the previous owner\'s name and offer the death certificate.', owner: 'Nobody — this is informational', where: '—' },
      kn: { title: 'ವಿದ್ಯುತ್ ಬಿಲ್ ಬೇರೊಬ್ಬರ ಹೆಸರಿನಲ್ಲಿದೆ', why: 'ವಾರಸಾಗಿ ಬಂದ ಆಸ್ತಿಗೆ ಇದು ಸಹಜ ಮತ್ತು ಸಾಮಾನ್ಯವಾಗಿ ಸ್ವೀಕಾರಾರ್ಹ. ಕೆಲವು ಕೌಂಟರ್‌ಗಳು ಕೇಳಬಹುದು, ಉತ್ತರ ಸಿದ್ಧವಿರಲಿ.', fix: 'ಸಲ್ಲಿಕೆಗೆ ಮೊದಲು ಏನೂ ಮಾಡಬೇಕಿಲ್ಲ. ಕೇಳಿದರೆ, ಸಂಪರ್ಕ ಇನ್ನೂ ಹಿಂದಿನ ಮಾಲೀಕರ ಹೆಸರಿನಲ್ಲಿದೆ ಎಂದು ಹೇಳಿ ಮರಣ ಪ್ರಮಾಣಪತ್ರ ತೋರಿಸಿ.', owner: 'ಯಾರೂ ಅಲ್ಲ — ಇದು ಮಾಹಿತಿಗಷ್ಟೇ', where: '—' },
      hi: { title: 'बिजली बिल किसी और के नाम है', why: 'विरासत में मिली संपत्ति के लिए यह सामान्य है और आमतौर पर स्वीकार्य है। कुछ काउंटर पूछ सकते हैं, जवाब तैयार रखें।', fix: 'जमा करने से पहले कुछ करने की ज़रूरत नहीं। पूछे जाने पर बताएँ कि कनेक्शन अब भी पिछले मालिक के नाम है और मृत्यु प्रमाणपत्र दिखाएँ।', owner: 'कोई नहीं — यह केवल जानकारी है', where: '—' }
    }
  },
  'NAME-05': {
    severity: 'blocks', category: 'consistency', expectedDays: 21, citation: CITATION.succession,
    text: {
      en: { title: 'You are not the owner on record, and the chain to you is not proved', why: 'The khata is in one name and you are applying in another, with nothing in the file that connects the two.', fix: 'Supply the document that makes you the successor: a death certificate plus a legal heir certificate for an inheritance, or a registered deed for a purchase.', owner: 'Tahsildar (heirship) or Sub-Registrar (deed)', where: 'Taluk office, or Sub-Registrar office' },
      kn: { title: 'ದಾಖಲೆಯ ಮಾಲೀಕರು ನೀವಲ್ಲ, ಮತ್ತು ನಿಮ್ಮವರೆಗಿನ ಕೊಂಡಿ ಸಾಬೀತಾಗಿಲ್ಲ', why: 'ಖಾತಾ ಒಂದು ಹೆಸರಿನಲ್ಲಿದೆ, ನೀವು ಇನ್ನೊಂದು ಹೆಸರಿನಲ್ಲಿ ಅರ್ಜಿ ಹಾಕುತ್ತಿದ್ದೀರಿ; ಎರಡನ್ನೂ ಜೋಡಿಸುವ ದಾಖಲೆ ಕಡತದಲ್ಲಿಲ್ಲ.', fix: 'ನಿಮ್ಮನ್ನು ಉತ್ತರಾಧಿಕಾರಿಯಾಗಿಸುವ ದಾಖಲೆ ಕೊಡಿ: ವಾರಸಿಗೆ ಮರಣ ಪ್ರಮಾಣಪತ್ರ ಮತ್ತು ವಾರಸುದಾರ ಪ್ರಮಾಣಪತ್ರ, ಖರೀದಿಗೆ ನೋಂದಾಯಿತ ಕ್ರಯಪತ್ರ.', owner: 'ತಹಶೀಲ್ದಾರ್ (ವಾರಸು) ಅಥವಾ ಉಪ-ನೋಂದಣಾಧಿಕಾರಿ (ಕ್ರಯಪತ್ರ)', where: 'ತಾಲ್ಲೂಕು ಕಚೇರಿ ಅಥವಾ ಉಪ-ನೋಂದಣಿ ಕಚೇರಿ' },
      hi: { title: 'रिकॉर्ड में मालिक आप नहीं हैं, और आप तक की कड़ी सिद्ध नहीं है', why: 'खाता एक नाम पर है और आप दूसरे नाम से आवेदन कर रहे हैं; फाइल में दोनों को जोड़ने वाला कुछ नहीं है।', fix: 'वह दस्तावेज़ दें जो आपको उत्तराधिकारी बनाता है: विरासत के लिए मृत्यु प्रमाणपत्र और वारिस प्रमाणपत्र, खरीद के लिए पंजीकृत विलेख।', owner: 'तहसीलदार (वारिस) या उप-पंजीयक (विलेख)', where: 'तालुक कार्यालय या उप-पंजीयक कार्यालय' }
    }
  },
  'NAME-06': {
    severity: 'blocks', category: 'consistency', expectedDays: 10, citation: CITATION.succession,
    text: {
      en: { title: 'The name on the death certificate is not the owner on record', why: 'The certificate proves someone died, but not that the owner of this property died. The file has a gap.', fix: 'If the same person is written differently, add a notarised same-person affidavit. If it is genuinely a different person, the correct owner\'s certificate is needed.', owner: 'Notary, or Registrar of Births and Deaths', where: 'Notary, or corporation health office' },
      kn: { title: 'ಮರಣ ಪ್ರಮಾಣಪತ್ರದ ಹೆಸರು ದಾಖಲೆಯ ಮಾಲೀಕರದ್ದಲ್ಲ', why: 'ಪ್ರಮಾಣಪತ್ರ ಯಾರೋ ಮೃತರಾಗಿದ್ದಾರೆ ಎನ್ನುತ್ತದೆ, ಈ ಆಸ್ತಿಯ ಮಾಲೀಕರೇ ಎಂದಲ್ಲ. ಕಡತದಲ್ಲಿ ಕೊರತೆ ಇದೆ.', fix: 'ಒಬ್ಬರೇ ವ್ಯಕ್ತಿಯ ಹೆಸರು ಬೇರೆ ರೀತಿ ಬರೆದಿದ್ದರೆ ನೋಟರೈಸ್ಡ್ ಒಂದೇ-ವ್ಯಕ್ತಿ ಪ್ರಮಾಣಪತ್ರ ಸೇರಿಸಿ. ನಿಜಕ್ಕೂ ಬೇರೆ ವ್ಯಕ್ತಿಯಾದರೆ ಸರಿಯಾದ ಮಾಲೀಕರ ಪ್ರಮಾಣಪತ್ರ ಬೇಕು.', owner: 'ನೋಟರಿ ಅಥವಾ ಜನನ-ಮರಣ ನೋಂದಣಾಧಿಕಾರಿ', where: 'ನೋಟರಿ ಅಥವಾ ಪಾಲಿಕೆ ಆರೋಗ್ಯ ಕಚೇರಿ' },
      hi: { title: 'मृत्यु प्रमाणपत्र का नाम रिकॉर्ड के मालिक का नहीं है', why: 'प्रमाणपत्र किसी की मृत्यु सिद्ध करता है, पर यह नहीं कि इसी संपत्ति के मालिक की। फाइल में कड़ी टूटी है।', fix: 'एक ही व्यक्ति का नाम अलग लिखा हो तो नोटरीकृत एक-ही-व्यक्ति शपथपत्र जोड़ें। सचमुच अलग व्यक्ति हो तो सही मालिक का प्रमाणपत्र चाहिए।', owner: 'नोटरी या जन्म-मृत्यु रजिस्ट्रार', where: 'नोटरी या निगम स्वास्थ्य कार्यालय' }
    }
  },
  'NAME-07': {
    severity: 'advisory', category: 'consistency', expectedDays: 0, citation: CITATION.ekhata,
    text: {
      en: { title: 'Spelling of the name varies, but it is the same person', why: 'We matched these as one person after accounting for initials and spelling. A clerk reading quickly may not. It is worth pre-empting.', fix: 'Nothing is required. Carry one ID that shows the longer form of the name, so the question is answered in five seconds.', owner: 'Nobody — this is informational', where: '—' },
      kn: { title: 'ಹೆಸರಿನ ಕಾಗುಣಿತ ಬೇರೆ, ಆದರೆ ವ್ಯಕ್ತಿ ಒಬ್ಬರೇ', why: 'ಮೊದಲಕ್ಷರ ಮತ್ತು ಕಾಗುಣಿತ ಪರಿಗಣಿಸಿ ಇವರನ್ನು ಒಬ್ಬರೇ ಎಂದು ಗುರುತಿಸಿದ್ದೇವೆ. ಬೇಗ ಓದುವ ಗುಮಾಸ್ತರಿಗೆ ಹಾಗನಿಸದಿರಬಹುದು. ಮೊದಲೇ ಸಿದ್ಧರಾಗಿರಿ.', fix: 'ಏನೂ ಬೇಕಿಲ್ಲ. ಹೆಸರಿನ ಪೂರ್ಣ ರೂಪ ತೋರಿಸುವ ಒಂದು ಗುರುತಿನ ಚೀಟಿ ಒಯ್ಯಿರಿ; ಪ್ರಶ್ನೆ ಐದು ಸೆಕೆಂಡಿನಲ್ಲಿ ಮುಗಿಯುತ್ತದೆ.', owner: 'ಯಾರೂ ಅಲ್ಲ — ಇದು ಮಾಹಿತಿಗಷ್ಟೇ', where: '—' },
      hi: { title: 'नाम की वर्तनी अलग है, पर व्यक्ति एक ही है', why: 'आद्याक्षर और वर्तनी को ध्यान में रखकर हमने इन्हें एक ही व्यक्ति माना। जल्दी पढ़ने वाला क्लर्क शायद न माने। पहले से तैयार रहना बेहतर है।', fix: 'कुछ करने की ज़रूरत नहीं। नाम का पूरा रूप दिखाने वाला एक पहचान पत्र साथ रखें; सवाल पाँच सेकंड में खत्म।', owner: 'कोई नहीं — यह केवल जानकारी है', where: '—' }
    }
  },

  /* ---------------------------------------------------------------- *
   * ID — the documents disagree about which property this is
   * ---------------------------------------------------------------- */
  'ID-01': {
    severity: 'blocks', category: 'consistency', expectedDays: 15, citation: CITATION.ekhata,
    text: {
      en: { title: 'Survey number differs between the deed and the khata', why: 'These two documents are describing different pieces of land. Either one carries a typing error, or the khata was created against the wrong survey number.', fix: 'Apply for a khata correction citing the registered deed as evidence. Do not let this be "fixed" informally — insist on a written correction.', owner: 'Revenue officer at your corporation ward office', where: 'Corporation ward office — khata correction counter' },
      kn: { title: 'ಕ್ರಯಪತ್ರ ಮತ್ತು ಖಾತಾದಲ್ಲಿ ಸರ್ವೆ ನಂಬರ್ ಬೇರೆ', why: 'ಈ ಎರಡು ದಾಖಲೆಗಳು ಬೇರೆ ಬೇರೆ ಜಮೀನನ್ನು ವಿವರಿಸುತ್ತಿವೆ. ಒಂದರಲ್ಲಿ ಬರವಣಿಗೆ ದೋಷವಿದೆ, ಅಥವಾ ತಪ್ಪು ಸರ್ವೆ ನಂಬರ್‌ಗೆ ಖಾತಾ ಸೃಷ್ಟಿಯಾಗಿದೆ.', fix: 'ನೋಂದಾಯಿತ ಕ್ರಯಪತ್ರವನ್ನು ಸಾಕ್ಷ್ಯವಾಗಿ ತೋರಿಸಿ ಖಾತಾ ತಿದ್ದುಪಡಿಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ. ಇದನ್ನು ಅನೌಪಚಾರಿಕವಾಗಿ "ಸರಿಪಡಿಸಲು" ಬಿಡಬೇಡಿ — ಲಿಖಿತ ತಿದ್ದುಪಡಿಯನ್ನೇ ಕೇಳಿ.', owner: 'ಪಾಲಿಕೆ ವಾರ್ಡ್ ಕಚೇರಿಯ ಕಂದಾಯ ಅಧಿಕಾರಿ', where: 'ಪಾಲಿಕೆ ವಾರ್ಡ್ ಕಚೇರಿ — ಖಾತಾ ತಿದ್ದುಪಡಿ ಕೌಂಟರ್' },
      hi: { title: 'विलेख और खाते में सर्वे नंबर अलग है', why: 'ये दोनों दस्तावेज़ अलग-अलग ज़मीन बता रहे हैं। या तो किसी में टाइपिंग की गलती है, या खाता गलत सर्वे नंबर पर बना है।', fix: 'पंजीकृत विलेख को प्रमाण बनाकर खाता सुधार का आवेदन दें। इसे अनौपचारिक रूप से "ठीक" न कराएँ — लिखित सुधार पर ज़ोर दें।', owner: 'निगम वार्ड कार्यालय का राजस्व अधिकारी', where: 'निगम वार्ड कार्यालय — खाता सुधार काउंटर' }
    }
  },
  'ID-02': {
    severity: 'blocks', category: 'consistency', expectedDays: 3, citation: CITATION.taxContinuity,
    text: {
      en: { title: 'Property ID on the tax receipts is not the khata property ID', why: 'You may have paid tax against a different property. The office cannot count these receipts towards this khata.', fix: 'Check the PID on your khata extract and re-download receipts for that exact PID.', owner: 'You, using the property tax portal', where: 'Corporation property tax portal' },
      kn: { title: 'ತೆರಿಗೆ ರಸೀದಿಯ ಆಸ್ತಿ ಗುರುತಿನ ಸಂಖ್ಯೆ ಖಾತಾದ್ದಲ್ಲ', why: 'ನೀವು ಬೇರೆ ಆಸ್ತಿಗೆ ತೆರಿಗೆ ಕಟ್ಟಿರಬಹುದು. ಈ ರಸೀದಿಗಳನ್ನು ಈ ಖಾತಾಗೆ ಪರಿಗಣಿಸಲಾಗದು.', fix: 'ನಿಮ್ಮ ಖಾತಾ ಉದ್ಧೃತದಲ್ಲಿನ ಪಿಐಡಿ ನೋಡಿ, ಅದೇ ಪಿಐಡಿಗೆ ರಸೀದಿಗಳನ್ನು ಮತ್ತೆ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ.', owner: 'ನೀವೇ — ತೆರಿಗೆ ಪೋರ್ಟಲ್ ಬಳಸಿ', where: 'ಪಾಲಿಕೆ ಆಸ್ತಿ ತೆರಿಗೆ ಪೋರ್ಟಲ್' },
      hi: { title: 'कर रसीद की संपत्ति आईडी खाते वाली नहीं है', why: 'शायद आपने किसी और संपत्ति का कर भरा है। कार्यालय इन रसीदों को इस खाते के लिए नहीं गिन सकता।', fix: 'अपने खाता उद्धरण की पीआईडी देखें और उसी पीआईडी की रसीदें दोबारा डाउनलोड करें।', owner: 'आप — कर पोर्टल से', where: 'निगम संपत्ति कर पोर्टल' }
    }
  },
  'ID-03': {
    severity: 'delays', category: 'consistency', expectedDays: 5, citation: CITATION.ekhata,
    text: {
      en: { title: 'Property address differs materially across documents', why: 'Small differences are normal. This one is large enough that a verifier may not accept the documents as describing the same property.', fix: 'Carry the address-proof document (electricity bill or khata) that matches the property on the ground, and mark the difference in your covering note.', owner: 'You', where: 'Explain at the counter with the bill in hand' },
      kn: { title: 'ದಾಖಲೆಗಳಲ್ಲಿ ಆಸ್ತಿಯ ವಿಳಾಸ ಗಣನೀಯವಾಗಿ ಬೇರೆ', why: 'ಸಣ್ಣ ವ್ಯತ್ಯಾಸ ಸಹಜ. ಇದು ದೊಡ್ಡದಾಗಿದೆ — ಪರಿಶೀಲಕರು ಇವು ಒಂದೇ ಆಸ್ತಿಯ ದಾಖಲೆಗಳೆಂದು ಒಪ್ಪದಿರಬಹುದು.', fix: 'ನೆಲದ ಮೇಲಿನ ಆಸ್ತಿಗೆ ಹೊಂದುವ ವಿಳಾಸ ಪುರಾವೆ (ವಿದ್ಯುತ್ ಬಿಲ್ ಅಥವಾ ಖಾತಾ) ಒಯ್ಯಿರಿ ಮತ್ತು ಮುಖಪತ್ರದಲ್ಲಿ ವ್ಯತ್ಯಾಸವನ್ನು ನಮೂದಿಸಿ.', owner: 'ನೀವು', where: 'ಬಿಲ್ ಕೈಯಲ್ಲಿಟ್ಟುಕೊಂಡು ಕೌಂಟರ್‌ನಲ್ಲಿ ವಿವರಿಸಿ' },
      hi: { title: 'दस्तावेज़ों में संपत्ति का पता काफ़ी अलग है', why: 'छोटे अंतर सामान्य हैं। यह अंतर इतना बड़ा है कि सत्यापनकर्ता इन्हें एक ही संपत्ति का न माने।', fix: 'ज़मीनी संपत्ति से मेल खाता पता-प्रमाण (बिजली बिल या खाता) साथ रखें और कवरिंग नोट में अंतर लिखें।', owner: 'आप', where: 'बिल हाथ में लेकर काउंटर पर समझाएँ' }
    }
  },
  'ID-04': {
    severity: 'delays', category: 'consistency', expectedDays: 2, citation: CITATION.ekhata,
    text: {
      en: { title: 'Khata extract carries no property ID', why: 'Without a PID the office cannot link your file to the tax record, and the application sits.', fix: 'Ask the ward office to print a khata extract that carries the PID, or get the PID from the tax portal by address.', owner: 'Corporation ward office', where: 'Ward office, khata counter' },
      kn: { title: 'ಖಾತಾ ಉದ್ಧೃತದಲ್ಲಿ ಆಸ್ತಿ ಗುರುತಿನ ಸಂಖ್ಯೆ ಇಲ್ಲ', why: 'ಪಿಐಡಿ ಇಲ್ಲದೆ ಕಚೇರಿ ನಿಮ್ಮ ಕಡತವನ್ನು ತೆರಿಗೆ ದಾಖಲೆಗೆ ಜೋಡಿಸಲಾಗದು, ಅರ್ಜಿ ನಿಂತುಬಿಡುತ್ತದೆ.', fix: 'ಪಿಐಡಿ ಇರುವ ಖಾತಾ ಉದ್ಧೃತ ಮುದ್ರಿಸಲು ವಾರ್ಡ್ ಕಚೇರಿಗೆ ಕೇಳಿ, ಅಥವಾ ವಿಳಾಸದ ಮೂಲಕ ತೆರಿಗೆ ಪೋರ್ಟಲ್‌ನಿಂದ ಪಿಐಡಿ ಪಡೆಯಿರಿ.', owner: 'ಪಾಲಿಕೆ ವಾರ್ಡ್ ಕಚೇರಿ', where: 'ವಾರ್ಡ್ ಕಚೇರಿ, ಖಾತಾ ಕೌಂಟರ್' },
      hi: { title: 'खाता उद्धरण में संपत्ति आईडी नहीं है', why: 'पीआईडी के बिना कार्यालय आपकी फाइल को कर रिकॉर्ड से नहीं जोड़ सकता, और आवेदन अटक जाता है।', fix: 'वार्ड कार्यालय से पीआईडी वाला खाता उद्धरण माँगें, या पते से कर पोर्टल पर पीआईडी निकालें।', owner: 'निगम वार्ड कार्यालय', where: 'वार्ड कार्यालय, खाता काउंटर' }
    }
  },
  'ID-05': {
    severity: 'delays', category: 'consistency', expectedDays: 15, citation: CITATION.ekhata,
    text: {
      en: { title: 'Site area differs between the deed and the khata', why: 'The recorded extent of the property is not the same in both documents. This affects the tax computation, so it is checked.', fix: 'Apply for a khata correction with the registered deed measurement, or attach the approved sanction plan showing the correct extent.', owner: 'Revenue officer at the ward office', where: 'Corporation ward office' },
      kn: { title: 'ಕ್ರಯಪತ್ರ ಮತ್ತು ಖಾತಾದಲ್ಲಿ ನಿವೇಶನದ ವಿಸ್ತೀರ್ಣ ಬೇರೆ', why: 'ಆಸ್ತಿಯ ದಾಖಲಾದ ವಿಸ್ತೀರ್ಣ ಎರಡರಲ್ಲೂ ಒಂದೇ ಆಗಿಲ್ಲ. ಇದು ತೆರಿಗೆ ಲೆಕ್ಕಕ್ಕೆ ಪರಿಣಾಮ ಬೀರುವುದರಿಂದ ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ.', fix: 'ನೋಂದಾಯಿತ ಕ್ರಯಪತ್ರದ ಅಳತೆಯೊಂದಿಗೆ ಖಾತಾ ತಿದ್ದುಪಡಿಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ, ಅಥವಾ ಸರಿಯಾದ ವಿಸ್ತೀರ್ಣ ತೋರಿಸುವ ಮಂಜೂರಾತಿ ನಕ್ಷೆ ಲಗತ್ತಿಸಿ.', owner: 'ವಾರ್ಡ್ ಕಚೇರಿಯ ಕಂದಾಯ ಅಧಿಕಾರಿ', where: 'ಪಾಲಿಕೆ ವಾರ್ಡ್ ಕಚೇರಿ' },
      hi: { title: 'विलेख और खाते में प्लॉट का क्षेत्रफल अलग है', why: 'दोनों दस्तावेज़ों में दर्ज क्षेत्रफल एक जैसा नहीं है। इससे कर की गणना बदलती है, इसलिए इसे जाँचा जाता है।', fix: 'पंजीकृत विलेख की माप के साथ खाता सुधार का आवेदन दें, या सही क्षेत्रफल दिखाने वाला स्वीकृत नक्शा लगाएँ।', owner: 'वार्ड कार्यालय का राजस्व अधिकारी', where: 'निगम वार्ड कार्यालय' }
    }
  },

  /* ---------------------------------------------------------------- *
   * TAX — payment continuity
   * ---------------------------------------------------------------- */
  'TAX-01': {
    severity: 'blocks', category: 'tax', expectedDays: 1, citation: CITATION.taxContinuity,
    text: {
      en: { title: 'A year is missing from the tax receipts', why: 'Three consecutive years are expected. One gap in the middle is treated the same as not paying at all.', fix: 'Pay or download the receipt for the missing year. If it was already paid, the portal will reissue it immediately using your property ID.', owner: 'You, using the property tax portal', where: 'Corporation property tax portal, or ward help desk' },
      kn: { title: 'ತೆರಿಗೆ ರಸೀದಿಗಳಲ್ಲಿ ಒಂದು ವರ್ಷ ಬಿಟ್ಟುಹೋಗಿದೆ', why: 'ಸತತ ಮೂರು ವರ್ಷ ಬೇಕು. ನಡುವೆ ಒಂದು ವರ್ಷ ಇಲ್ಲದಿದ್ದರೆ ಪೂರ್ತಿ ಕಟ್ಟದಂತೆಯೇ ಪರಿಗಣಿಸಲಾಗುತ್ತದೆ.', fix: 'ಬಿಟ್ಟುಹೋದ ವರ್ಷದ ರಸೀದಿ ಕಟ್ಟಿ ಅಥವಾ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ. ಈಗಾಗಲೇ ಕಟ್ಟಿದ್ದರೆ ಆಸ್ತಿ ಗುರುತಿನ ಸಂಖ್ಯೆಯಿಂದ ಪೋರ್ಟಲ್ ತಕ್ಷಣ ಮರು-ವಿತರಿಸುತ್ತದೆ.', owner: 'ನೀವೇ — ಆಸ್ತಿ ತೆರಿಗೆ ಪೋರ್ಟಲ್ ಬಳಸಿ', where: 'ಪಾಲಿಕೆ ತೆರಿಗೆ ಪೋರ್ಟಲ್ ಅಥವಾ ವಾರ್ಡ್ ಸಹಾಯ ಕೇಂದ್ರ' },
      hi: { title: 'कर रसीदों में एक साल गायब है', why: 'लगातार तीन वर्ष चाहिए। बीच का एक साल छूटना पूरा कर न भरने जैसा माना जाता है।', fix: 'छूटे साल की रसीद भरें या डाउनलोड करें। पहले से भरा हो तो पोर्टल आपकी संपत्ति आईडी से तुरंत दोबारा जारी कर देगा।', owner: 'आप — संपत्ति कर पोर्टल से', where: 'निगम कर पोर्टल या वार्ड सहायता केंद्र' }
    }
  },
  'TAX-02': {
    severity: 'blocks', category: 'tax', expectedDays: 1, citation: CITATION.taxContinuity,
    text: {
      en: { title: 'The most recent assessment year is not paid', why: 'Transfer requires the tax to be current, not merely paid at some point in the past.', fix: 'Pay the current year\'s property tax and carry that receipt as the top sheet of your tax enclosures.', owner: 'You', where: 'Corporation property tax portal' },
      kn: { title: 'ಇತ್ತೀಚಿನ ಮೌಲ್ಯಮಾಪನ ವರ್ಷದ ತೆರಿಗೆ ಕಟ್ಟಿಲ್ಲ', why: 'ವರ್ಗಾವಣೆಗೆ ತೆರಿಗೆ ಪ್ರಸ್ತುತವಾಗಿರಬೇಕು, ಹಿಂದೆ ಯಾವಾಗಲೋ ಕಟ್ಟಿದ್ದರೆ ಸಾಲದು.', fix: 'ಈ ವರ್ಷದ ಆಸ್ತಿ ತೆರಿಗೆ ಕಟ್ಟಿ, ಆ ರಸೀದಿಯನ್ನು ತೆರಿಗೆ ದಾಖಲೆಗಳ ಮೇಲಿನ ಹಾಳೆಯಾಗಿ ಇಡಿ.', owner: 'ನೀವು', where: 'ಪಾಲಿಕೆ ಆಸ್ತಿ ತೆರಿಗೆ ಪೋರ್ಟಲ್' },
      hi: { title: 'सबसे हालिया मूल्यांकन वर्ष का कर नहीं भरा है', why: 'हस्तांतरण के लिए कर चालू होना चाहिए, कभी अतीत में भरा होना काफ़ी नहीं।', fix: 'इस वर्ष का संपत्ति कर भरें और वह रसीद कर दस्तावेज़ों में सबसे ऊपर रखें।', owner: 'आप', where: 'निगम संपत्ति कर पोर्टल' }
    }
  },
  'TAX-03': {
    severity: 'delays', category: 'tax', expectedDays: 2, citation: CITATION.taxContinuity,
    text: {
      en: { title: 'Arrears or penalty are shown as outstanding', why: 'An outstanding balance on the property will hold the transfer even if the main tax is paid.', fix: 'Clear the arrears shown on the receipt and carry the zero-balance acknowledgement.', owner: 'You', where: 'Corporation property tax portal or counter' },
      kn: { title: 'ಬಾಕಿ ಅಥವಾ ದಂಡ ಉಳಿದಿದೆ ಎಂದು ತೋರಿಸಿದೆ', why: 'ಮುಖ್ಯ ತೆರಿಗೆ ಕಟ್ಟಿದ್ದರೂ ಆಸ್ತಿಯ ಮೇಲಿನ ಬಾಕಿ ವರ್ಗಾವಣೆಯನ್ನು ತಡೆಯುತ್ತದೆ.', fix: 'ರಸೀದಿಯಲ್ಲಿ ತೋರಿಸಿದ ಬಾಕಿ ಪಾವತಿಸಿ ಮತ್ತು ಶೂನ್ಯ-ಬಾಕಿ ದೃಢೀಕರಣ ಒಯ್ಯಿರಿ.', owner: 'ನೀವು', where: 'ಪಾಲಿಕೆ ತೆರಿಗೆ ಪೋರ್ಟಲ್ ಅಥವಾ ಕೌಂಟರ್' },
      hi: { title: 'बकाया या जुर्माना शेष दिख रहा है', why: 'मुख्य कर भर देने पर भी संपत्ति पर बकाया हस्तांतरण रोक देगा।', fix: 'रसीद में दिखा बकाया चुकाएँ और शून्य-शेष की पावती साथ रखें।', owner: 'आप', where: 'निगम संपत्ति कर पोर्टल या काउंटर' }
    }
  },
  'TAX-04': {
    severity: 'advisory', category: 'tax', expectedDays: 0, citation: CITATION.taxContinuity,
    text: {
      en: { title: 'More tax years supplied than required', why: 'Extra receipts do no harm, but a thick file slows the counter down.', fix: 'Keep the three most recent years on top. The rest can stay in your folder.', owner: 'Nobody — this is informational', where: '—' },
      kn: { title: 'ಬೇಕಾದ್ದಕ್ಕಿಂತ ಹೆಚ್ಚು ವರ್ಷಗಳ ತೆರಿಗೆ ರಸೀದಿ ಕೊಟ್ಟಿದ್ದೀರಿ', why: 'ಹೆಚ್ಚಿನ ರಸೀದಿಗಳಿಂದ ತೊಂದರೆಯಿಲ್ಲ, ಆದರೆ ದಪ್ಪ ಕಡತ ಕೌಂಟರ್ ಅನ್ನು ನಿಧಾನ ಮಾಡುತ್ತದೆ.', fix: 'ಇತ್ತೀಚಿನ ಮೂರು ವರ್ಷಗಳನ್ನು ಮೇಲೆ ಇಡಿ. ಉಳಿದವು ನಿಮ್ಮ ಕಡತದಲ್ಲೇ ಇರಲಿ.', owner: 'ಯಾರೂ ಅಲ್ಲ — ಮಾಹಿತಿಗಷ್ಟೇ', where: '—' },
      hi: { title: 'ज़रूरत से ज़्यादा वर्षों की रसीदें दी हैं', why: 'अतिरिक्त रसीदों से नुकसान नहीं, पर मोटी फाइल काउंटर को धीमा करती है।', fix: 'हाल के तीन वर्ष ऊपर रखें। बाकी अपने फोल्डर में रहने दें।', owner: 'कोई नहीं — केवल जानकारी', where: '—' }
    }
  },

  /* ---------------------------------------------------------------- *
   * FMT — the document exists but will not be accepted as it is
   * ---------------------------------------------------------------- */
  'FMT-01': {
    severity: 'blocks', category: 'format', expectedDays: 7, citation: CITATION.stamp,
    text: {
      en: { title: 'Stamp duty on the deed appears insufficient', why: 'An under-stamped instrument is not admissible. This is checked, and it cannot be argued away at the counter.', fix: 'Have the deed adjudicated and pay the deficit stamp duty with penalty. Get legal advice first — the amount is calculable in advance.', owner: 'District Registrar (adjudication), with an advocate', where: 'District Registrar office' },
      kn: { title: 'ಕ್ರಯಪತ್ರದ ಮುದ್ರಾಂಕ ಶುಲ್ಕ ಸಾಲದಂತೆ ಕಾಣುತ್ತದೆ', why: 'ಕಡಿಮೆ ಮುದ್ರಾಂಕದ ದಾಖಲೆ ಸ್ವೀಕಾರಾರ್ಹವಲ್ಲ. ಇದನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ, ಕೌಂಟರ್‌ನಲ್ಲಿ ವಾದಿಸಿ ಮುಗಿಸಲಾಗದು.', fix: 'ಕ್ರಯಪತ್ರವನ್ನು ನಿರ್ಣಯಕ್ಕೆ (adjudication) ಒಳಪಡಿಸಿ, ಕೊರತೆ ಮುದ್ರಾಂಕ ಮತ್ತು ದಂಡ ಪಾವತಿಸಿ. ಮೊದಲು ಕಾನೂನು ಸಲಹೆ ಪಡೆಯಿರಿ — ಮೊತ್ತವನ್ನು ಮೊದಲೇ ಲೆಕ್ಕ ಹಾಕಬಹುದು.', owner: 'ಜಿಲ್ಲಾ ನೋಂದಣಾಧಿಕಾರಿ, ವಕೀಲರ ಜೊತೆ', where: 'ಜಿಲ್ಲಾ ನೋಂದಣಾಧಿಕಾರಿ ಕಚೇರಿ' },
      hi: { title: 'विलेख पर स्टांप शुल्क कम लगता है', why: 'कम स्टांप वाला दस्तावेज़ स्वीकार्य नहीं। यह जाँचा जाता है और काउंटर पर बहस से हल नहीं होता।', fix: 'विलेख का न्यायनिर्णयन (adjudication) कराएँ और कमी का स्टांप शुल्क जुर्माने सहित भरें। पहले कानूनी सलाह लें — राशि पहले से निकाली जा सकती है।', owner: 'ज़िला पंजीयक, अधिवक्ता के साथ', where: 'ज़िला पंजीयक कार्यालय' }
    }
  },
  'FMT-02': {
    severity: 'blocks', category: 'format', expectedDays: 30, citation: CITATION.registration,
    text: {
      en: { title: 'The deed does not carry a registration number', why: 'An unregistered transfer of immovable property does not pass title. A khata cannot be issued on it.', fix: 'Register the deed. If the seller is unavailable or deceased, this becomes a legal matter — see an advocate before spending anything else.', owner: 'Sub-Registrar, with an advocate', where: 'Sub-Registrar office for the property\'s jurisdiction' },
      kn: { title: 'ಕ್ರಯಪತ್ರದಲ್ಲಿ ನೋಂದಣಿ ಸಂಖ್ಯೆ ಇಲ್ಲ', why: 'ನೋಂದಣಿಯಾಗದ ಸ್ಥಿರಾಸ್ತಿ ವರ್ಗಾವಣೆ ಹಕ್ಕನ್ನು ವರ್ಗಾಯಿಸುವುದಿಲ್ಲ. ಅದರ ಮೇಲೆ ಖಾತಾ ನೀಡಲಾಗದು.', fix: 'ಕ್ರಯಪತ್ರವನ್ನು ನೋಂದಾಯಿಸಿ. ಮಾರಾಟಗಾರರು ಲಭ್ಯವಿಲ್ಲದಿದ್ದರೆ ಅಥವಾ ಮೃತರಾಗಿದ್ದರೆ ಇದು ಕಾನೂನು ವಿಷಯ — ಬೇರೆ ಖರ್ಚು ಮಾಡುವ ಮೊದಲು ವಕೀಲರನ್ನು ಕಾಣಿ.', owner: 'ಉಪ-ನೋಂದಣಾಧಿಕಾರಿ, ವಕೀಲರ ಜೊತೆ', where: 'ಆಸ್ತಿಯ ವ್ಯಾಪ್ತಿಯ ಉಪ-ನೋಂದಣಿ ಕಚೇರಿ' },
      hi: { title: 'विलेख पर पंजीकरण संख्या नहीं है', why: 'अपंजीकृत अचल संपत्ति हस्तांतरण से स्वामित्व नहीं मिलता। उस पर खाता जारी नहीं हो सकता।', fix: 'विलेख पंजीकृत कराएँ। विक्रेता उपलब्ध न हो या मृत हो तो यह कानूनी मामला है — और खर्च से पहले अधिवक्ता से मिलें।', owner: 'उप-पंजीयक, अधिवक्ता के साथ', where: 'संपत्ति के क्षेत्राधिकार का उप-पंजीयक कार्यालय' }
    }
  },
  'FMT-03': {
    severity: 'blocks', category: 'format', expectedDays: 1, citation: CITATION.ekhata,
    text: {
      en: { title: 'A required signature is missing on a document', why: 'An unsigned enclosure is treated as not submitted.', fix: 'Sign the document, or get the signature of whoever must sign it, before you leave home.', owner: 'You, or the named signatory', where: 'At home, before the visit' },
      kn: { title: 'ದಾಖಲೆಯಲ್ಲಿ ಅಗತ್ಯ ಸಹಿ ಇಲ್ಲ', why: 'ಸಹಿ ಇಲ್ಲದ ಲಗತ್ತನ್ನು ಸಲ್ಲಿಸದಂತೆಯೇ ಪರಿಗಣಿಸಲಾಗುತ್ತದೆ.', fix: 'ಮನೆಯಿಂದ ಹೊರಡುವ ಮೊದಲು ದಾಖಲೆಗೆ ಸಹಿ ಮಾಡಿ, ಅಥವಾ ಸಹಿ ಮಾಡಬೇಕಾದವರಿಂದ ಪಡೆಯಿರಿ.', owner: 'ನೀವು ಅಥವಾ ಸಹಿ ಮಾಡಬೇಕಾದವರು', where: 'ಮನೆಯಲ್ಲಿ, ಭೇಟಿಗೆ ಮೊದಲು' },
      hi: { title: 'दस्तावेज़ पर ज़रूरी हस्ताक्षर नहीं है', why: 'बिना हस्ताक्षर का संलग्नक जमा न किया गया माना जाता है।', fix: 'घर से निकलने से पहले दस्तावेज़ पर हस्ताक्षर करें, या जिसे करना है उससे कराएँ।', owner: 'आप या नामित हस्ताक्षरकर्ता', where: 'घर पर, जाने से पहले' }
    }
  },
  'FMT-04': {
    severity: 'blocks', category: 'format', expectedDays: 2, citation: CITATION.ekhata,
    text: {
      en: { title: 'Pages appear to be missing from a document', why: 'A partial deed or extract is rejected. Schedules and annexures count as pages.', fix: 'Scan or photocopy the complete document including every schedule page and the back of the last page.', owner: 'You', where: 'Any scan shop, or your phone camera' },
      kn: { title: 'ದಾಖಲೆಯ ಕೆಲವು ಪುಟಗಳು ಬಿಟ್ಟುಹೋಗಿವೆ', why: 'ಅಪೂರ್ಣ ಕ್ರಯಪತ್ರ ಅಥವಾ ಉದ್ಧೃತ ತಿರಸ್ಕೃತವಾಗುತ್ತದೆ. ಅನುಸೂಚಿ ಮತ್ತು ಅನುಬಂಧಗಳೂ ಪುಟಗಳೇ.', fix: 'ಪ್ರತಿಯೊಂದು ಅನುಸೂಚಿ ಪುಟ ಮತ್ತು ಕೊನೆಯ ಪುಟದ ಹಿಂಭಾಗ ಸೇರಿ ಪೂರ್ಣ ದಾಖಲೆಯನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.', owner: 'ನೀವು', where: 'ಯಾವುದೇ ಸ್ಕ್ಯಾನ್ ಅಂಗಡಿ ಅಥವಾ ನಿಮ್ಮ ಫೋನ್ ಕ್ಯಾಮೆರಾ' },
      hi: { title: 'दस्तावेज़ के कुछ पन्ने गायब लगते हैं', why: 'अधूरा विलेख या उद्धरण अस्वीकार होता है। अनुसूची और अनुलग्नक भी पन्ने हैं।', fix: 'हर अनुसूची पन्ने और आखिरी पन्ने के पीछे सहित पूरा दस्तावेज़ स्कैन करें।', owner: 'आप', where: 'कोई स्कैन दुकान या अपना फोन कैमरा' }
    }
  },
  'FMT-05': {
    severity: 'delays', category: 'format', expectedDays: 1, citation: CITATION.ekhata,
    text: {
      en: { title: 'A scan is too unclear to read', why: 'If a verifier cannot read a field, they will not guess it. They will mark the file for clarification, which costs weeks.', fix: 'Rescan in daylight, flat on a table, with the whole page in frame and no shadow across the text.', owner: 'You', where: 'At home — no shop needed' },
      kn: { title: 'ಸ್ಕ್ಯಾನ್ ಓದಲಾಗದಷ್ಟು ಅಸ್ಪಷ್ಟವಾಗಿದೆ', why: 'ಪರಿಶೀಲಕರಿಗೆ ಒಂದು ಕ್ಷೇತ್ರ ಓದಲಾಗದಿದ್ದರೆ ಅವರು ಊಹಿಸುವುದಿಲ್ಲ. ಸ್ಪಷ್ಟೀಕರಣಕ್ಕೆ ಗುರುತು ಹಾಕುತ್ತಾರೆ, ಅದು ವಾರಗಳನ್ನು ತಿನ್ನುತ್ತದೆ.', fix: 'ಹಗಲು ಬೆಳಕಿನಲ್ಲಿ, ಮೇಜಿನ ಮೇಲೆ ಸಪಾಟಾಗಿ ಇಟ್ಟು, ಪೂರ್ಣ ಪುಟ ಚೌಕಟ್ಟಿನಲ್ಲಿ ಬರುವಂತೆ, ಅಕ್ಷರಗಳ ಮೇಲೆ ನೆರಳಿಲ್ಲದೆ ಮತ್ತೆ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.', owner: 'ನೀವು', where: 'ಮನೆಯಲ್ಲೇ — ಅಂಗಡಿ ಬೇಕಿಲ್ಲ' },
      hi: { title: 'स्कैन पढ़ने लायक साफ़ नहीं है', why: 'सत्यापनकर्ता कोई फ़ील्ड न पढ़ पाए तो अनुमान नहीं लगाएगा। फाइल स्पष्टीकरण के लिए रोक दी जाएगी, जिसमें हफ़्ते लगते हैं।', fix: 'दिन के उजाले में, मेज़ पर सपाट रखकर, पूरा पन्ना फ्रेम में और अक्षरों पर छाया के बिना दोबारा स्कैन करें।', owner: 'आप', where: 'घर पर ही — दुकान की ज़रूरत नहीं' }
    }
  },
  'FMT-06': {
    severity: 'delays', category: 'format', expectedDays: 1, citation: CITATION.officePractice,
    text: {
      en: { title: 'Photograph does not meet the usual specification', why: 'Counters generally want a recent passport-size photo with a plain light background and the full face visible.', fix: 'Take a fresh passport photo against a plain wall. A phone photo is fine if the face fills the frame and the background is uniform.', owner: 'You', where: 'Any photo studio, or at home' },
      kn: { title: 'ಭಾವಚಿತ್ರ ಸಾಮಾನ್ಯ ಮಾನದಂಡಕ್ಕೆ ಹೊಂದುತ್ತಿಲ್ಲ', why: 'ಕೌಂಟರ್‌ಗಳಿಗೆ ಸಾಮಾನ್ಯವಾಗಿ ಇತ್ತೀಚಿನ ಪಾಸ್‌ಪೋರ್ಟ್ ಅಳತೆಯ, ತಿಳಿ ಸರಳ ಹಿನ್ನೆಲೆಯ, ಪೂರ್ಣ ಮುಖ ಕಾಣುವ ಫೋಟೋ ಬೇಕು.', fix: 'ಸರಳ ಗೋಡೆಯ ಮುಂದೆ ಹೊಸ ಫೋಟೋ ತೆಗೆಸಿ. ಮುಖ ಚೌಕಟ್ಟನ್ನು ತುಂಬಿ ಹಿನ್ನೆಲೆ ಏಕರೂಪವಾಗಿದ್ದರೆ ಫೋನ್ ಫೋಟೋ ಸಾಕು.', owner: 'ನೀವು', where: 'ಯಾವುದೇ ಫೋಟೋ ಸ್ಟುಡಿಯೋ ಅಥವಾ ಮನೆಯಲ್ಲಿ' },
      hi: { title: 'फोटो सामान्य मानक पर खरा नहीं है', why: 'काउंटर आमतौर पर हाल की पासपोर्ट साइज़ फोटो चाहते हैं — सादा हल्का बैकग्राउंड और पूरा चेहरा दिखता हुआ।', fix: 'सादी दीवार के सामने नई फोटो लें। चेहरा फ्रेम भरता हो और बैकग्राउंड एकसमान हो तो फोन की फोटो भी चलेगी।', owner: 'आप', where: 'कोई फोटो स्टूडियो या घर पर' }
    }
  },
  'FMT-07': {
    severity: 'blocks', category: 'format', expectedDays: 2, citation: CITATION.succession,
    text: {
      en: { title: 'A document that must be attested is not attested', why: 'For a succession claim the office wants an attested copy, not a plain photocopy, of the certificate.', fix: 'Take the original and a photocopy to a notary or the issuing office and get the copy attested.', owner: 'Notary, or the issuing authority', where: 'Any notary, or the office that issued it' },
      kn: { title: 'ದೃಢೀಕರಣ ಬೇಕಾದ ದಾಖಲೆ ದೃಢೀಕೃತವಾಗಿಲ್ಲ', why: 'ವಾರಸು ಹಕ್ಕಿಗೆ ಕಚೇರಿಗೆ ಸಾಮಾನ್ಯ ನಕಲಲ್ಲ, ದೃಢೀಕೃತ ಪ್ರತಿ ಬೇಕು.', fix: 'ಮೂಲ ಪ್ರತಿ ಮತ್ತು ನಕಲನ್ನು ನೋಟರಿ ಅಥವಾ ವಿತರಿಸಿದ ಕಚೇರಿಗೆ ಒಯ್ದು ದೃಢೀಕರಿಸಿ.', owner: 'ನೋಟರಿ ಅಥವಾ ವಿತರಿಸಿದ ಪ್ರಾಧಿಕಾರ', where: 'ಯಾವುದೇ ನೋಟರಿ, ಅಥವಾ ವಿತರಿಸಿದ ಕಚೇರಿ' },
      hi: { title: 'जिस दस्तावेज़ का सत्यापन ज़रूरी है वह अप्रमाणित है', why: 'उत्तराधिकार के दावे के लिए कार्यालय को सादी फोटोकॉपी नहीं, प्रमाणित प्रति चाहिए।', fix: 'मूल और फोटोकॉपी लेकर नोटरी या जारी करने वाले कार्यालय जाएँ और प्रति प्रमाणित कराएँ।', owner: 'नोटरी या जारीकर्ता प्राधिकरण', where: 'कोई नोटरी, या जारी करने वाला कार्यालय' }
    }
  },
  'FMT-08': {
    severity: 'advisory', category: 'format', expectedDays: 0, citation: CITATION.officePractice,
    text: {
      en: { title: 'A file is very large and may fail to upload', why: 'Portals commonly cap uploads. A large photo of a clear document is not more useful than a small one.', fix: 'Reduce the file below 2 MB before uploading. Any phone gallery "share as small image" option does this.', owner: 'You', where: 'On your phone' },
      kn: { title: 'ಫೈಲ್ ತುಂಬಾ ದೊಡ್ಡದು, ಅಪ್‌ಲೋಡ್ ವಿಫಲವಾಗಬಹುದು', why: 'ಪೋರ್ಟಲ್‌ಗಳು ಸಾಮಾನ್ಯವಾಗಿ ಗಾತ್ರ ಮಿತಿ ಇಡುತ್ತವೆ. ಸ್ಪಷ್ಟ ದಾಖಲೆಯ ದೊಡ್ಡ ಫೋಟೋ ಸಣ್ಣದಕ್ಕಿಂತ ಹೆಚ್ಚು ಉಪಯುಕ್ತವಲ್ಲ.', fix: 'ಅಪ್‌ಲೋಡ್ ಮಾಡುವ ಮೊದಲು ಫೈಲ್ ಅನ್ನು 2 MBಗಿಂತ ಕಡಿಮೆ ಮಾಡಿ. ಫೋನ್ ಗ್ಯಾಲರಿಯ "ಸಣ್ಣ ಚಿತ್ರವಾಗಿ ಹಂಚಿ" ಆಯ್ಕೆ ಇದನ್ನು ಮಾಡುತ್ತದೆ.', owner: 'ನೀವು', where: 'ನಿಮ್ಮ ಫೋನ್‌ನಲ್ಲಿ' },
      hi: { title: 'फाइल बहुत बड़ी है, अपलोड फेल हो सकता है', why: 'पोर्टल आमतौर पर अपलोड की सीमा रखते हैं। साफ़ दस्तावेज़ की बड़ी फोटो छोटी से ज़्यादा उपयोगी नहीं होती।', fix: 'अपलोड से पहले फाइल 2 MB से कम करें। फोन गैलरी का "छोटी इमेज के रूप में भेजें" विकल्प यही करता है।', owner: 'आप', where: 'अपने फोन पर' }
    }
  },

  /* ---------------------------------------------------------------- *
   * ENC — claims registered against the property
   * ---------------------------------------------------------------- */
  'ENC-01': {
    severity: 'blocks', category: 'encumbrance', expectedDays: 20, citation: CITATION.officePractice,
    text: {
      en: { title: 'A loan is still registered against this property', why: 'The encumbrance certificate shows a subsisting mortgage. The khata will not move while a lender has a registered claim.', fix: 'If the loan is repaid, get the release deed from the bank and register it. If it is running, the lender must consent in writing.', owner: 'The lending bank, then the Sub-Registrar', where: 'Bank branch that holds the loan, then Sub-Registrar' },
      kn: { title: 'ಈ ಆಸ್ತಿಯ ಮೇಲೆ ಸಾಲ ಇನ್ನೂ ನೋಂದಾಯಿತವಾಗಿದೆ', why: 'ಋಣಭಾರ ಪ್ರಮಾಣಪತ್ರದಲ್ಲಿ ಚಾಲ್ತಿಯಲ್ಲಿರುವ ಅಡಮಾನ ಕಾಣಿಸುತ್ತದೆ. ಸಾಲದಾತರಿಗೆ ನೋಂದಾಯಿತ ಹಕ್ಕಿರುವಾಗ ಖಾತಾ ಚಲಿಸುವುದಿಲ್ಲ.', fix: 'ಸಾಲ ತೀರಿದ್ದರೆ ಬ್ಯಾಂಕಿನಿಂದ ಬಿಡುಗಡೆ ಪತ್ರ ಪಡೆದು ನೋಂದಾಯಿಸಿ. ಚಾಲ್ತಿಯಲ್ಲಿದ್ದರೆ ಸಾಲದಾತರ ಲಿಖಿತ ಒಪ್ಪಿಗೆ ಬೇಕು.', owner: 'ಸಾಲ ನೀಡಿದ ಬ್ಯಾಂಕ್, ನಂತರ ಉಪ-ನೋಂದಣಾಧಿಕಾರಿ', where: 'ಸಾಲದ ಬ್ಯಾಂಕ್ ಶಾಖೆ, ನಂತರ ಉಪ-ನೋಂದಣಿ ಕಚೇರಿ' },
      hi: { title: 'इस संपत्ति पर अब भी ऋण दर्ज है', why: 'भार-मुक्ति प्रमाणपत्र में चालू बंधक दिख रहा है। ऋणदाता का दर्ज दावा रहते खाता नहीं हिलेगा।', fix: 'ऋण चुका हो तो बैंक से रिलीज़ डीड लेकर पंजीकृत कराएँ। चालू हो तो ऋणदाता की लिखित सहमति चाहिए।', owner: 'ऋण देने वाला बैंक, फिर उप-पंजीयक', where: 'ऋण वाली बैंक शाखा, फिर उप-पंजीयक' }
    }
  },
  'ENC-02': {
    severity: 'delays', category: 'encumbrance', expectedDays: 10, citation: CITATION.officePractice,
    text: {
      en: { title: 'The encumbrance certificate shows a transaction you have not accounted for', why: 'There is a registered entry on this property that does not appear anywhere in the documents you supplied.', fix: 'Get a certified copy of that registered document and read it before submitting. Do not submit until you know what it is.', owner: 'Sub-Registrar office', where: 'Sub-Registrar office, or Kaveri online services' },
      kn: { title: 'ಇಸಿಯಲ್ಲಿ ನೀವು ಲೆಕ್ಕಕ್ಕೆ ತೆಗೆದುಕೊಳ್ಳದ ವ್ಯವಹಾರ ಕಾಣಿಸುತ್ತಿದೆ', why: 'ಈ ಆಸ್ತಿಯ ಮೇಲೆ ನೋಂದಾಯಿತ ದಾಖಲೆ ಇದೆ, ಆದರೆ ನೀವು ಕೊಟ್ಟ ಯಾವ ದಾಖಲೆಯಲ್ಲೂ ಅದು ಕಾಣಿಸುತ್ತಿಲ್ಲ.', fix: 'ಆ ನೋಂದಾಯಿತ ದಾಖಲೆಯ ದೃಢೀಕೃತ ಪ್ರತಿ ಪಡೆದು ಸಲ್ಲಿಸುವ ಮೊದಲು ಓದಿ. ಅದೇನೆಂದು ತಿಳಿಯುವವರೆಗೆ ಸಲ್ಲಿಸಬೇಡಿ.', owner: 'ಉಪ-ನೋಂದಣಾಧಿಕಾರಿ ಕಚೇರಿ', where: 'ಉಪ-ನೋಂದಣಿ ಕಚೇರಿ ಅಥವಾ ಕಾವೇರಿ ಆನ್‌ಲೈನ್' },
      hi: { title: 'ईसी में ऐसा लेनदेन है जिसका हिसाब आपके पास नहीं', why: 'इस संपत्ति पर एक पंजीकृत प्रविष्टि है जो आपके दिए किसी दस्तावेज़ में नहीं दिखती।', fix: 'उस पंजीकृत दस्तावेज़ की प्रमाणित प्रति लेकर जमा करने से पहले पढ़ें। जब तक पता न चले, जमा न करें।', owner: 'उप-पंजीयक कार्यालय', where: 'उप-पंजीयक कार्यालय या कावेरी ऑनलाइन' }
    }
  },
  'ENC-03': {
    severity: 'blocks', category: 'encumbrance', expectedDays: 0, citation: CITATION.officePractice,
    text: {
      en: { title: 'A court attachment or dispute is noted against the property', why: 'While a court order is in force no office will transfer the khata, and nobody can make that go away for a fee.', fix: 'This needs an advocate, not a document. Free legal aid is available through the District Legal Services Authority.', owner: 'An advocate, or District Legal Services Authority', where: 'DLSA office at the district court complex' },
      kn: { title: 'ಆಸ್ತಿಯ ಮೇಲೆ ನ್ಯಾಯಾಲಯದ ಜಪ್ತಿ ಅಥವಾ ವಿವಾದ ದಾಖಲಾಗಿದೆ', why: 'ನ್ಯಾಯಾಲಯದ ಆದೇಶ ಜಾರಿಯಲ್ಲಿರುವಾಗ ಯಾವ ಕಚೇರಿಯೂ ಖಾತಾ ವರ್ಗಾಯಿಸುವುದಿಲ್ಲ, ಮತ್ತು ಹಣ ಕೊಟ್ಟು ಇದನ್ನು ಯಾರೂ ತೆಗೆಯಲಾಗದು.', fix: 'ಇದಕ್ಕೆ ದಾಖಲೆಯಲ್ಲ, ವಕೀಲರು ಬೇಕು. ಜಿಲ್ಲಾ ಕಾನೂನು ಸೇವಾ ಪ್ರಾಧಿಕಾರದಿಂದ ಉಚಿತ ಕಾನೂನು ನೆರವು ಸಿಗುತ್ತದೆ.', owner: 'ವಕೀಲರು ಅಥವಾ ಜಿಲ್ಲಾ ಕಾನೂನು ಸೇವಾ ಪ್ರಾಧಿಕಾರ', where: 'ಜಿಲ್ಲಾ ನ್ಯಾಯಾಲಯ ಸಂಕೀರ್ಣದ ಡಿಎಲ್‌ಎಸ್‌ಎ ಕಚೇರಿ' },
      hi: { title: 'संपत्ति पर अदालती कुर्की या विवाद दर्ज है', why: 'अदालती आदेश लागू रहते कोई कार्यालय खाता हस्तांतरित नहीं करेगा, और पैसे लेकर इसे कोई हटा नहीं सकता।', fix: 'इसके लिए दस्तावेज़ नहीं, अधिवक्ता चाहिए। ज़िला विधिक सेवा प्राधिकरण से निःशुल्क कानूनी सहायता मिलती है।', owner: 'अधिवक्ता या ज़िला विधिक सेवा प्राधिकरण', where: 'ज़िला न्यायालय परिसर का डीएलएसए कार्यालय' }
    }
  },

  /* ---------------------------------------------------------------- *
   * DATE — the timeline in the documents does not hold together
   * ---------------------------------------------------------------- */
  'DATE-01': {
    severity: 'blocks', category: 'dates', expectedDays: 5, citation: CITATION.succession,
    text: {
      en: { title: 'The heirship document is dated before the date of death', why: 'A succession document cannot precede the death it relies on. One of the two dates is wrong.', fix: 'Check both certificates. Whichever carries the error must be corrected by its issuing office.', owner: 'Tahsildar or Registrar of Births and Deaths', where: 'The office that issued the wrong document' },
      kn: { title: 'ವಾರಸು ದಾಖಲೆಯ ದಿನಾಂಕ ಮರಣ ದಿನಾಂಕಕ್ಕಿಂತ ಹಿಂದಿನದು', why: 'ಯಾವ ಮರಣವನ್ನು ಆಧರಿಸಿದೆಯೋ ಅದಕ್ಕಿಂತ ಮೊದಲು ವಾರಸು ದಾಖಲೆ ಇರಲಾಗದು. ಎರಡರಲ್ಲಿ ಒಂದು ದಿನಾಂಕ ತಪ್ಪಾಗಿದೆ.', fix: 'ಎರಡೂ ಪ್ರಮಾಣಪತ್ರ ಪರಿಶೀಲಿಸಿ. ತಪ್ಪಿರುವುದನ್ನು ವಿತರಿಸಿದ ಕಚೇರಿಯೇ ತಿದ್ದಬೇಕು.', owner: 'ತಹಶೀಲ್ದಾರ್ ಅಥವಾ ಜನನ-ಮರಣ ನೋಂದಣಾಧಿಕಾರಿ', where: 'ತಪ್ಪು ದಾಖಲೆ ವಿತರಿಸಿದ ಕಚೇರಿ' },
      hi: { title: 'वारिस दस्तावेज़ की तारीख मृत्यु की तारीख से पहले की है', why: 'जिस मृत्यु पर आधारित है, उससे पहले उत्तराधिकार दस्तावेज़ नहीं हो सकता। दोनों में से एक तारीख गलत है।', fix: 'दोनों प्रमाणपत्र जाँचें। जिसमें गलती है उसे जारी करने वाला कार्यालय ही सुधारेगा।', owner: 'तहसीलदार या जन्म-मृत्यु रजिस्ट्रार', where: 'गलत दस्तावेज़ जारी करने वाला कार्यालय' }
    }
  },
  'DATE-02': {
    severity: 'delays', category: 'dates', expectedDays: 2, citation: CITATION.officePractice,
    text: {
      en: { title: 'The khata extract is more than a year old', why: 'Many counters will not accept an extract older than about twelve months, because the record may have changed since.', fix: 'Get a fresh khata extract. It is usually issued the same day.', owner: 'Corporation ward office', where: 'Ward office or Bengaluru One centre' },
      kn: { title: 'ಖಾತಾ ಉದ್ಧೃತ ಒಂದು ವರ್ಷಕ್ಕಿಂತ ಹಳೆಯದು', why: 'ಸುಮಾರು ಹನ್ನೆರಡು ತಿಂಗಳಿಗಿಂತ ಹಳೆಯ ಉದ್ಧೃತವನ್ನು ಹಲವು ಕೌಂಟರ್‌ಗಳು ಒಪ್ಪುವುದಿಲ್ಲ, ಏಕೆಂದರೆ ದಾಖಲೆ ಬದಲಾಗಿರಬಹುದು.', fix: 'ಹೊಸ ಖಾತಾ ಉದ್ಧೃತ ಪಡೆಯಿರಿ. ಸಾಮಾನ್ಯವಾಗಿ ಅದೇ ದಿನ ಸಿಗುತ್ತದೆ.', owner: 'ಪಾಲಿಕೆ ವಾರ್ಡ್ ಕಚೇರಿ', where: 'ವಾರ್ಡ್ ಕಚೇರಿ ಅಥವಾ ಬೆಂಗಳೂರು ಒನ್' },
      hi: { title: 'खाता उद्धरण एक साल से पुराना है', why: 'कई काउंटर लगभग बारह महीने से पुराना उद्धरण नहीं लेते, क्योंकि रिकॉर्ड बदल चुका हो सकता है।', fix: 'नया खाता उद्धरण लें। आमतौर पर उसी दिन मिल जाता है।', owner: 'निगम वार्ड कार्यालय', where: 'वार्ड कार्यालय या बेंगलुरु वन' }
    }
  },
  'DATE-03': {
    severity: 'delays', category: 'dates', expectedDays: 7, citation: CITATION.officePractice,
    text: {
      en: { title: 'The encumbrance certificate does not cover the relevant period', why: 'The EC period stops before the transaction it is supposed to prove is clean.', fix: 'Apply for an EC that runs up to the current date.', owner: 'Sub-Registrar office', where: 'Sub-Registrar office or Kaveri online services' },
      kn: { title: 'ಇಸಿ ಸಂಬಂಧಿತ ಅವಧಿಯನ್ನು ಒಳಗೊಂಡಿಲ್ಲ', why: 'ಯಾವ ವ್ಯವಹಾರ ಶುದ್ಧವೆಂದು ಸಾಬೀತು ಮಾಡಬೇಕೋ ಅದಕ್ಕಿಂತ ಮೊದಲೇ ಇಸಿ ಅವಧಿ ಮುಗಿಯುತ್ತದೆ.', fix: 'ಇಂದಿನವರೆಗಿನ ಅವಧಿಯ ಇಸಿಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ.', owner: 'ಉಪ-ನೋಂದಣಾಧಿಕಾರಿ ಕಚೇರಿ', where: 'ಉಪ-ನೋಂದಣಿ ಕಚೇರಿ ಅಥವಾ ಕಾವೇರಿ ಆನ್‌ಲೈನ್' },
      hi: { title: 'ईसी संबंधित अवधि को कवर नहीं करता', why: 'जिस लेनदेन को साफ़ साबित करना है, ईसी की अवधि उससे पहले ही खत्म हो जाती है।', fix: 'आज की तारीख तक की ईसी के लिए आवेदन करें।', owner: 'उप-पंजीयक कार्यालय', where: 'उप-पंजीयक कार्यालय या कावेरी ऑनलाइन' }
    }
  },
  'DATE-04': {
    severity: 'advisory', category: 'dates', expectedDays: 1, citation: CITATION.officePractice,
    text: {
      en: { title: 'The electricity bill is several months old', why: 'A stale bill is usually accepted, but a current one removes one thing to argue about.', fix: 'Download this month\'s bill. It takes a minute on the BESCOM portal.', owner: 'You', where: 'BESCOM portal' },
      kn: { title: 'ವಿದ್ಯುತ್ ಬಿಲ್ ಹಲವು ತಿಂಗಳ ಹಳೆಯದು', why: 'ಹಳೆಯ ಬಿಲ್ ಸಾಮಾನ್ಯವಾಗಿ ಸ್ವೀಕಾರಾರ್ಹ, ಆದರೆ ಹೊಸದು ಒಂದು ವಾದವನ್ನೇ ಕಡಿಮೆ ಮಾಡುತ್ತದೆ.', fix: 'ಈ ತಿಂಗಳ ಬಿಲ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ. ಬೆಸ್ಕಾಂ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಒಂದು ನಿಮಿಷ ಸಾಕು.', owner: 'ನೀವು', where: 'ಬೆಸ್ಕಾಂ ಪೋರ್ಟಲ್' },
      hi: { title: 'बिजली बिल कई महीने पुराना है', why: 'पुराना बिल आमतौर पर चल जाता है, पर नया बिल एक बहस कम कर देता है।', fix: 'इस महीने का बिल डाउनलोड करें। बेस्कॉम पोर्टल पर एक मिनट लगता है।', owner: 'आप', where: 'बेस्कॉम पोर्टल' }
    }
  },

  /* ---------------------------------------------------------------- *
   * KYC
   * ---------------------------------------------------------------- */
  'KYC-01': {
    severity: 'blocks', category: 'kyc', expectedDays: 0, citation: CITATION.ekhata,
    text: {
      en: { title: 'The Aadhaar number is not in a valid format', why: 'The number entered fails the standard checksum, so eKYC will reject it before it reaches any officer.', fix: 'Re-enter the twelve digits from your Aadhaar carefully. Do not share the number with anyone offering to "process" it.', owner: 'You', where: 'Check the card in your hand' },
      kn: { title: 'ಆಧಾರ್ ಸಂಖ್ಯೆಯ ಸ್ವರೂಪ ಸರಿಯಿಲ್ಲ', why: 'ನಮೂದಿಸಿದ ಸಂಖ್ಯೆ ಪ್ರಮಾಣಿತ ಪರಿಶೀಲನೆಯಲ್ಲಿ ವಿಫಲವಾಗಿದೆ; ಯಾವ ಅಧಿಕಾರಿಯನ್ನೂ ತಲುಪುವ ಮೊದಲೇ ಇ-ಕೆವೈಸಿ ತಿರಸ್ಕರಿಸುತ್ತದೆ.', fix: 'ಆಧಾರ್‌ನ ಹನ್ನೆರಡು ಅಂಕಿಗಳನ್ನು ಎಚ್ಚರಿಕೆಯಿಂದ ಮತ್ತೆ ನಮೂದಿಸಿ. "ಪ್ರೊಸೆಸ್ ಮಾಡುತ್ತೇವೆ" ಎನ್ನುವವರಿಗೆ ಸಂಖ್ಯೆ ಕೊಡಬೇಡಿ.', owner: 'ನೀವು', where: 'ಕೈಯಲ್ಲಿರುವ ಕಾರ್ಡ್ ನೋಡಿ' },
      hi: { title: 'आधार संख्या का प्रारूप सही नहीं है', why: 'दर्ज संख्या मानक जाँच में विफल है; किसी अधिकारी तक पहुँचने से पहले ही ई-केवाईसी इसे अस्वीकार कर देगा।', fix: 'आधार के बारह अंक ध्यान से दोबारा दर्ज करें। "प्रोसेस करा देंगे" कहने वाले को संख्या न दें।', owner: 'आप', where: 'हाथ में मौजूद कार्ड देखें' }
    }
  },
  'KYC-02': {
    severity: 'advisory', category: 'kyc', expectedDays: 0, citation: CITATION.officePractice,
    text: {
      en: { title: 'Your Aadhaar address is not the property address', why: 'This is expected and fine — you do not have to live in a property to inherit or own it. Some counters ask anyway.', fix: 'Nothing to do. If asked, say the Aadhaar is identity proof, and the electricity bill and khata are the address proof.', owner: 'Nobody — this is informational', where: '—' },
      kn: { title: 'ಆಧಾರ್ ವಿಳಾಸ ಆಸ್ತಿಯ ವಿಳಾಸವಲ್ಲ', why: 'ಇದು ಸಹಜ ಮತ್ತು ಸರಿ — ಆಸ್ತಿಯನ್ನು ಪಡೆಯಲು ಅಥವಾ ಹೊಂದಲು ಅಲ್ಲಿ ವಾಸಿಸಬೇಕಿಲ್ಲ. ಕೆಲವು ಕೌಂಟರ್‌ಗಳು ಆದರೂ ಕೇಳುತ್ತವೆ.', fix: 'ಏನೂ ಮಾಡಬೇಕಿಲ್ಲ. ಕೇಳಿದರೆ, ಆಧಾರ್ ಗುರುತಿನ ಪುರಾವೆ, ವಿದ್ಯುತ್ ಬಿಲ್ ಮತ್ತು ಖಾತಾ ವಿಳಾಸದ ಪುರಾವೆ ಎಂದು ಹೇಳಿ.', owner: 'ಯಾರೂ ಅಲ್ಲ — ಮಾಹಿತಿಗಷ್ಟೇ', where: '—' },
      hi: { title: 'आपका आधार पता संपत्ति का पता नहीं है', why: 'यह सामान्य और ठीक है — संपत्ति पाने या रखने के लिए वहाँ रहना ज़रूरी नहीं। फिर भी कुछ काउंटर पूछते हैं।', fix: 'कुछ नहीं करना। पूछे तो कहें कि आधार पहचान प्रमाण है, और बिजली बिल व खाता पते का प्रमाण।', owner: 'कोई नहीं — केवल जानकारी', where: '—' }
    }
  },

  /* ---------------------------------------------------------------- *
   * INH — inheritance-specific
   * ---------------------------------------------------------------- */
  'INH-01': {
    severity: 'advisory', category: 'inheritance', expectedDays: 0, citation: CITATION.succession,
    text: {
      en: { title: 'A will is mentioned but not probated', why: 'A will that has not been through probate carries less weight than a legal heir certificate at a revenue counter.', fix: 'You can proceed on the heir certificate. Raise the will only if another heir contests, and then take legal advice.', owner: 'An advocate, if it becomes contested', where: 'District Legal Services Authority for free advice' },
      kn: { title: 'ಉಯಿಲು ಇದೆ ಎಂದು ಹೇಳಲಾಗಿದೆ, ಆದರೆ ಪ್ರೊಬೇಟ್ ಆಗಿಲ್ಲ', why: 'ಪ್ರೊಬೇಟ್ ಆಗದ ಉಯಿಲಿಗೆ ಕಂದಾಯ ಕೌಂಟರ್‌ನಲ್ಲಿ ವಾರಸುದಾರ ಪ್ರಮಾಣಪತ್ರಕ್ಕಿಂತ ಕಡಿಮೆ ತೂಕ.', fix: 'ವಾರಸುದಾರ ಪ್ರಮಾಣಪತ್ರದ ಮೇಲೆಯೇ ಮುಂದುವರಿಯಬಹುದು. ಬೇರೆ ವಾರಸುದಾರರು ವಿರೋಧಿಸಿದರೆ ಮಾತ್ರ ಉಯಿಲು ಎತ್ತಿ, ಆಗ ಕಾನೂನು ಸಲಹೆ ಪಡೆಯಿರಿ.', owner: 'ವಿವಾದವಾದರೆ ವಕೀಲರು', where: 'ಉಚಿತ ಸಲಹೆಗೆ ಜಿಲ್ಲಾ ಕಾನೂನು ಸೇವಾ ಪ್ರಾಧಿಕಾರ' },
      hi: { title: 'वसीयत का ज़िक्र है पर प्रोबेट नहीं हुआ', why: 'बिना प्रोबेट की वसीयत का राजस्व काउंटर पर वारिस प्रमाणपत्र से कम वज़न होता है।', fix: 'वारिस प्रमाणपत्र के आधार पर आगे बढ़ सकते हैं। कोई दूसरा वारिस विरोध करे तभी वसीयत लाएँ, और तब कानूनी सलाह लें।', owner: 'विवाद होने पर अधिवक्ता', where: 'निःशुल्क सलाह के लिए ज़िला विधिक सेवा प्राधिकरण' }
    }
  },
  'INH-02': {
    severity: 'advisory', category: 'inheritance', expectedDays: 0, citation: CITATION.succession,
    text: {
      en: { title: 'You are one of several heirs on record', why: 'This is not a defect. It means the file needs the other heirs\' consent, which you already have in the packet.', fix: 'Keep the no-objection affidavits stapled directly behind the heir certificate so the verifier sees them together.', owner: 'Nobody — this is informational', where: '—' },
      kn: { title: 'ದಾಖಲೆಯಲ್ಲಿ ನೀವು ಹಲವು ವಾರಸುದಾರರಲ್ಲಿ ಒಬ್ಬರು', why: 'ಇದು ದೋಷವಲ್ಲ. ಕಡತಕ್ಕೆ ಇತರ ವಾರಸುದಾರರ ಒಪ್ಪಿಗೆ ಬೇಕು ಎಂದಷ್ಟೇ — ಅದು ಈಗಾಗಲೇ ನಿಮ್ಮ ಪ್ಯಾಕೆಟ್‌ನಲ್ಲಿದೆ.', fix: 'ನಿರಾಕ್ಷೇಪಣಾ ಪ್ರಮಾಣಪತ್ರಗಳನ್ನು ವಾರಸುದಾರ ಪ್ರಮಾಣಪತ್ರದ ಹಿಂದೆಯೇ ಜೋಡಿಸಿ ಇಡಿ, ಪರಿಶೀಲಕರು ಒಟ್ಟಿಗೇ ನೋಡಲಿ.', owner: 'ಯಾರೂ ಅಲ್ಲ — ಮಾಹಿತಿಗಷ್ಟೇ', where: '—' },
      hi: { title: 'रिकॉर्ड में आप कई वारिसों में से एक हैं', why: 'यह दोष नहीं है। इसका मतलब बस यह कि फाइल में बाकी वारिसों की सहमति चाहिए, जो आपके पैकेट में पहले से है।', fix: 'अनापत्ति शपथपत्रों को वारिस प्रमाणपत्र के ठीक पीछे लगाएँ ताकि सत्यापनकर्ता दोनों साथ देखे।', owner: 'कोई नहीं — केवल जानकारी', where: '—' }
    }
  },

  /* ---------------------------------------------------------------- *
   * PASS — the positive verdict, so that "everything is fine" is also
   * a code with an evidence trail rather than an absence of output.
   * ---------------------------------------------------------------- */
  'PASS-01': {
    severity: 'advisory', category: 'pass', expectedDays: 0, citation: CITATION.ekhata,
    text: {
      en: { title: 'Every required check passed', why: 'All required documents are present, the names and identifiers agree across them, and the tax years are continuous.', fix: 'Print the packet and take it to your office. If anyone says the papers are not in order, ask which document and which field — you have the answer.', owner: 'You', where: 'Your matched office' },
      kn: { title: 'ಎಲ್ಲ ಅಗತ್ಯ ಪರಿಶೀಲನೆಗಳು ಉತ್ತೀರ್ಣ', why: 'ಬೇಕಾದ ಎಲ್ಲ ದಾಖಲೆಗಳಿವೆ, ಹೆಸರು ಮತ್ತು ಗುರುತಿನ ಸಂಖ್ಯೆಗಳು ಎಲ್ಲದರಲ್ಲೂ ಹೊಂದುತ್ತವೆ, ತೆರಿಗೆ ವರ್ಷಗಳು ಸತತವಾಗಿವೆ.', fix: 'ಪ್ಯಾಕೆಟ್ ಮುದ್ರಿಸಿ ನಿಮ್ಮ ಕಚೇರಿಗೆ ಒಯ್ಯಿರಿ. "ಪೇಪರ್ ಸರಿಯಿಲ್ಲ" ಎಂದು ಯಾರಾದರೂ ಹೇಳಿದರೆ, ಯಾವ ದಾಖಲೆ ಯಾವ ಕ್ಷೇತ್ರ ಎಂದು ಕೇಳಿ — ಉತ್ತರ ನಿಮ್ಮ ಬಳಿ ಇದೆ.', owner: 'ನೀವು', where: 'ನಿಮಗೆ ಹೊಂದಿಸಿದ ಕಚೇರಿ' },
      hi: { title: 'हर ज़रूरी जाँच पास हुई', why: 'सभी आवश्यक दस्तावेज़ मौजूद हैं, उनमें नाम और पहचान संख्याएँ मेल खाती हैं, और कर वर्ष लगातार हैं।', fix: 'पैकेट प्रिंट करें और अपने कार्यालय ले जाएँ। कोई कहे "कागज़ ठीक नहीं", तो पूछें कौन-सा दस्तावेज़ और कौन-सा फ़ील्ड — जवाब आपके पास है।', owner: 'आप', where: 'आपका मिलान किया गया कार्यालय' }
    }
  }
};

export const DEFECT_CODES = Object.keys(DEFECTS);

/** Resolves a code + language into display text, falling back to English. */
export function explain(code, language = 'en') {
  const entry = DEFECTS[code];
  if (!entry) {
    return {
      code,
      severity: 'advisory',
      title: `Unknown check (${code})`,
      why: 'This code is not in the ledger. That is a bug, not a finding about your documents.',
      fix: 'Please report it. Do not act on it.',
      owner: '—',
      where: '—',
      expectedDays: 0,
      citation: null,
      category: 'unknown'
    };
  }
  const text = entry.text[language] || entry.text.en;
  return {
    code,
    severity: entry.severity,
    category: entry.category,
    expectedDays: entry.expectedDays,
    citation: entry.citation,
    ...text
  };
}

/** Ledger statistics — used by /mocks and the scale argument. */
export function ledgerStats() {
  const bySeverity = { blocks: 0, delays: 0, advisory: 0 };
  for (const entry of Object.values(DEFECTS)) bySeverity[entry.severity] += 1;
  const verifiedCitations = Object.values(DEFECTS).filter((d) => d.citation.verified).length;
  return {
    codes: DEFECT_CODES.length,
    languages: LANGUAGES.length,
    totalExplanations: DEFECT_CODES.length * LANGUAGES.length,
    bySeverity,
    verifiedCitations,
    unverifiedCitations: DEFECT_CODES.length - verifiedCitations
  };
}
