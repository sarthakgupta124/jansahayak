/**
 * MEASUREMENT, NOT OPINION
 *
 * Three rules in the pack — FMT-03, FMT-05 and FMT-06 — read fields that
 * describe the physical quality of an upload rather than anything written on
 * it: whether a scan is legible, whether a signature block was actually
 * signed, whether a photograph meets the counter's specification.
 *
 * Those rules were always shaped correctly. Look at what FMT-05 consumes:
 *
 *     f(d, 'legibility') < 0.6
 *
 * A number and a threshold. What was missing was anything that produced the
 * number — so the vision model was asked for it, in among the fields it was
 * asked to transcribe:
 *
 *     "legibility": number between 0 and 1 describing how readable the scan is
 *
 * That is not transcription. That is a judgement, and it was the one place in
 * the product where a language model's opinion reached a rule and changed a
 * verdict. The commitment everywhere else is that rules decide and the model
 * only reads; here the model was quietly deciding.
 *
 * This module closes that. Every value below comes from arithmetic over pixels
 * on the citizen's own device. The rule pack does not change at all — it was
 * already waiting for real numbers.
 *
 * THE HONESTY RULE THAT GOVERNS THIS FILE
 *
 * Every one of these measures is a heuristic, and a heuristic that is confident
 * when it should not be is worse than no measure at all: it sends someone to a
 * notary, or to a photo studio, for nothing. So each function returns
 * `undefined` when it cannot tell, and `undefined` is not a value the rules
 * fire on — FMT-03 tests `=== false`, FMT-06 tests `=== false`, FMT-05 tests
 * `typeof === 'number'`. Not knowing therefore produces silence, which is the
 * correct behaviour. We only speak when the pixels are unambiguous.
 *
 * Nothing here uploads anything. This all runs before the file leaves, and on
 * the offline path it runs when the file never leaves at all.
 */

/** Everything is measured at this width so scores mean the same on any camera. */
const WORK_WIDTH = 1000;

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** Draws the image at a fixed working width and returns its grayscale plane. */
function grayscalePlane(image) {
  const scale = Math.min(1, WORK_WIDTH / image.naturalWidth);
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    // Rec. 601 luma. Green dominates because that is where the eye — and a
    // scanner's sharpest channel — carries most detail.
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { gray, width: w, height: h, ctx, canvas };
}

/**
 * Blur, by the variance of the Laplacian.
 *
 * The Laplacian is the second derivative of intensity: it is near zero across
 * flat paper and spikes at every edge. A sharp page of text is nearly all
 * edges, so the response has a wide spread. Blur is a low-pass filter — it
 * removes exactly those high frequencies — so a blurred page's response
 * collapses toward zero and its variance with it. The variance of the
 * Laplacian is therefore a direct read on how much fine detail survived, and
 * it is the standard measure for precisely this.
 *
 * Measured at a fixed width, because variance scales with resolution: the same
 * page shot on a 48 MP phone and a 5 MP one would otherwise score differently
 * for no reason a citizen could act on.
 *
 * @returns {number|undefined} 0..1, where FMT-05 refuses below 0.60
 */
function legibilityOf(gray, width, height) {
  if (width < 32 || height < 32) return undefined;

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      // 4-neighbour Laplacian kernel: [0 1 0; 1 -4 1; 0 1 0]
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  if (!n) return undefined;

  const variance = sumSq / n - (sum / n) ** 2;

  // Calibration. On document scans this variance runs from single digits for
  // an unreadable photograph to the high hundreds or low thousands for a
  // clean flatbed scan. The log map below puts variance 10 at 0.00 and 500 at
  // about 0.87, which places the rule's 0.60 threshold near variance 105 —
  // roughly where text stops being reliably machine-readable.
  //
  // These constants are honest guesses from the shape of the measure, not
  // values fitted to a corpus of real Bengaluru khata scans. Tuning them
  // against such a corpus is the single highest-value thing anyone could do to
  // this file, and until that happens FMT-05 is a hint and not a verdict.
  return clamp01((Math.log10(variance + 1) - 1) / 1.7);
}

/**
 * Is there ink where a signature belongs?
 *
 * Without layout analysis we do not know where the signature block is, so this
 * looks at the bottom fifth of the page — where signatures sit on essentially
 * every Indian form — and asks how much of it is dark.
 *
 * This is the weakest measure in the file and it is deliberately the most
 * reluctant to speak. Near-zero ink in the whole band is unambiguous: nothing
 * was written there. Anything above that is not distinguishable from a printed
 * footer, an address block or a page number, so it says nothing at all rather
 * than guess "signed".
 */
function signatureInkOf(gray, width, height) {
  if (height < 100) return undefined;

  const bandTop = Math.floor(height * 0.8);
  let dark = 0;
  let total = 0;
  for (let y = bandTop; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (gray[y * width + x] < 110) dark += 1;
      total += 1;
    }
  }
  if (!total) return undefined;

  const density = dark / total;
  if (density < 0.0015) return false;   // effectively blank: nothing was signed
  if (density > 0.02) return true;      // a clear mark is present
  return undefined;                     // a footer, a stamp, a page number — do not guess
}

/**
 * Passport-photograph checks.
 *
 * faceVisible uses the browser's own FaceDetector where it exists. Where it
 * does not — which is most browsers — it returns undefined rather than false,
 * so an unsupported browser produces silence instead of telling every citizen
 * their photograph has no face in it.
 */
async function faceVisibleIn(canvas) {
  if (typeof window === 'undefined' || !('FaceDetector' in window)) return undefined;
  try {
    const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
    const faces = await detector.detect(canvas);
    return faces.length >= 1;
  } catch {
    return undefined;  // detector present but refused; that is not evidence of no face
  }
}

/**
 * Plain background, by how much the border of the frame varies.
 *
 * A studio passport photograph has a uniform backdrop, so the outermost band of
 * pixels is nearly one colour. A photo taken against a bookshelf is not. Only
 * the clear cases speak.
 */
function plainBackgroundOf(gray, width, height) {
  if (width < 64 || height < 64) return undefined;
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.06));

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 0; y < height; y += 1) {
    const edgeRow = y < band || y >= height - band;
    for (let x = 0; x < width; x += 1) {
      if (!edgeRow && x >= band && x < width - band) continue;
      const v = gray[y * width + x];
      sum += v; sumSq += v * v; n += 1;
    }
  }
  if (!n) return undefined;

  const sd = Math.sqrt(Math.max(0, sumSq / n - (sum / n) ** 2));
  if (sd < 12) return true;
  if (sd > 40) return false;
  return undefined;
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('image could not be decoded'));
  image.src = src;
});

/**
 * Measures an uploaded image and returns only the fields it is sure about.
 *
 * @param {string} dataUrl the image, already in the browser
 * @param {string} [kind] document kind, so a photograph gets the photo checks
 * @returns {Promise<object>} measured fields plus `_method`, which records how
 *   each number was arrived at so the UI can show its working.
 */
export async function measureImage(dataUrl, kind) {
  if (!dataUrl || typeof document === 'undefined') return {};

  let image;
  try { image = await loadImage(dataUrl); }
  catch { return {}; }

  const { gray, width, height, canvas } = grayscalePlane(image);
  const measured = {};
  const method = {};

  // Natural dimensions, not the working ones — FMT-06 asks whether the
  // photograph is at least 350px wide, and it means the file the citizen has.
  measured.widthPx = image.naturalWidth;
  measured.heightPx = image.naturalHeight;
  method.widthPx = 'image intrinsic width';

  const legibility = legibilityOf(gray, width, height);
  if (legibility !== undefined) {
    measured.legibility = Number(legibility.toFixed(3));
    method.legibility = `variance of the Laplacian at ${width}px wide`;
  }

  if (kind === 'photo') {
    const face = await faceVisibleIn(canvas);
    if (face !== undefined) {
      measured.faceVisible = face;
      method.faceVisible = 'browser FaceDetector';
    }
    const plain = plainBackgroundOf(gray, width, height);
    if (plain !== undefined) {
      measured.plainBackground = plain;
      method.plainBackground = 'standard deviation of the border band';
    }
  } else {
    const signed = signatureInkOf(gray, width, height);
    if (signed !== undefined) {
      measured.signaturePresent = signed;
      method.signaturePresent = 'dark-pixel density in the lower fifth';
    }
  }

  return { ...measured, _method: method };
}

/** Exported for tests: the pure parts, with no DOM in sight. */
export const __internals = { legibilityOf, signatureInkOf, plainBackgroundOf, clamp01, WORK_WIDTH };
