/**
 * Bundled demo metadata so the landing page works even when /api/meta is slow,
 * blocked by a stale service worker, or unavailable (e.g. static preview).
 */
export const FALLBACK_META = {
  rulePack: 'property-mutation@1.0.0',
  ruleCount: 46,
  ledger: { codes: 47, unverifiedCitations: 12 },
  personas: [
    {
      id: 'savita',
      name: 'Savita Gupta',
      initial: 'स',
      headline: 'Inherited her father\'s house in Arera Colony. Cannot sell it until the mutation moves to her name.',
      quotedByAgent: 5000,
      resolvableByPaperwork: true
    },
    {
      id: 'farhan',
      name: 'Farhan Ansari',
      initial: 'फ',
      headline: 'Bought a plot in April. His bank will not release the home loan until the mutation is in his name.',
      quotedByAgent: 12000,
      resolvableByPaperwork: true
    },
    {
      id: 'ramkali',
      name: 'Ramkali Bai',
      initial: 'र',
      headline: 'A 1998 deed that was never registered. The hard case — and the one where telling the truth matters most.',
      quotedByAgent: 20000,
      resolvableByPaperwork: false
    }
  ]
};
