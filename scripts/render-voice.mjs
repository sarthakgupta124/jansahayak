/**
 * Pre-renders the spoken lines with ElevenLabs and writes them to public/audio.
 *
 * WHY PRE-RENDER RATHER THAN CALL AT REQUEST TIME
 * -----------------------------------------------
 * This is the same argument the product makes everywhere else. A phrase spoken
 * to one citizen is identical to the phrase spoken to the next, so it should be
 * generated once and served as a flat file. That means:
 *
 *   - no API key on the server, and none in the browser
 *   - no per-listen cost, so audio does not get more expensive with scale
 *   - it plays instantly on a slow connection, and it works offline
 *
 * The same shape extends to the defect ledger: one clip per
 * (defect code x language) is about 141 files in total, ever.
 *
 * KANNADA COVERAGE — READ THIS BEFORE TRUSTING THE OUTPUT
 * -------------------------------------------------------
 * ElevenLabs multilingual models do not officially list Kannada among their
 * supported languages. In practice the multilingual model will attempt it, and
 * the result ranges from good to obviously wrong depending on the voice. So:
 *
 *   LISTEN TO THE FILE BEFORE SHIPPING IT.
 *
 * If it is not right, delete it. The app falls back to the browser's own
 * kn-IN synthesis, and failing that to captions — both of which are honest,
 * and neither of which is a mispronounced sentence presented as a native one.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... npm run voice
 *   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npm run voice -- --force
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/audio');

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pFZP5JQG7iQjIQuC4Bku';   // "Lily", a stock voice
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const FORCE = process.argv.includes('--force');

/**
 * One entry per clip. `id` becomes the filename, which the UI references
 * directly — see AUDIO_SRC in src/Showcase.jsx.
 */
const CLIPS = [
  {
    id: 'lakshmi-intake-kn',
    language: 'kn',
    text: 'ಸರ್, ನಾನು ಅಪ್ಪನ ಮನೆಯ ಖಾತಾ ಟ್ರಾನ್ಸ್‌ಫರ್ ಮಾಡ್ಬೇಕು. ಅಪ್ಪ ಕಳೆದ ನವೆಂಬರ್‌ನಲ್ಲಿ ತೀರಿಕೊಂಡ್ರು. ಮನೆ ಬ್ರೂಕ್‌ಫೀಲ್ಡ್‌ನಲ್ಲಿ ಇದೆ, ಅದನ್ನ ಮಾರ್ಬೇಕು. ಪೇಪರ್ಸ್ ಎಲ್ಲಾ ಇದೆ.',
    note: 'The landing-page showcase. Identical to the string the intake parser is given.'
  }
];

if (!API_KEY) {
  console.log(`
No ELEVENLABS_API_KEY set, so nothing was rendered — and nothing is broken.

The showcase falls back, in order, to:
  1. the browser's own Kannada speech synthesis
  2. captions alone

Both are labelled on screen, so a viewer is never told they are hearing a
studio voice when they are not.

To render the clips:
  ELEVENLABS_API_KEY=... npm run voice
`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let rendered = 0;
let skipped = 0;

for (const clip of CLIPS) {
  const target = path.join(OUT_DIR, `${clip.id}.mp3`);

  if (fs.existsSync(target) && !FORCE) {
    console.log(`  skip   ${clip.id}.mp3 already exists (--force to re-render)`);
    skipped += 1;
    continue;
  }

  process.stdout.write(`  render ${clip.id}.mp3 … `);
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text: clip.text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true }
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.log(`FAILED (${response.status})`);
    console.error(`         ${detail.slice(0, 240)}`);
    process.exitCode = 1;
    continue;
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 1024) {
    console.log(`FAILED (only ${audio.length} bytes back)`);
    process.exitCode = 1;
    continue;
  }

  fs.writeFileSync(target, audio);
  console.log(`${(audio.length / 1024).toFixed(0)} KB`);
  rendered += 1;
}

console.log(`
${rendered} rendered, ${skipped} skipped, into public/audio.
Model ${MODEL_ID}, voice ${VOICE_ID}.

NOW LISTEN TO IT. Kannada is not on the officially supported list for these
models, so verify the pronunciation before you ship. If it is wrong, delete the
file — the browser fallback is better than a confidently mispronounced sentence.
`);
