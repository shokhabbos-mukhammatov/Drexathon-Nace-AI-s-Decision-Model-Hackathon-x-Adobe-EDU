// Build each commander's persona from his own documents with NDI Extract.
//   npm run personas            all commanders
//   npm run personas -- hood    one commander
// Writes data/personas/<id>.json. The game loads those files in place of the authored traits,
// and every trait keeps the page and quote NDI cited. Nothing is invented here: a field NDI
// reports as not_found is dropped.
import fs from 'node:fs';
import path from 'node:path';
import type { Trait } from '../../shared/types.ts';

const BASE = 'https://console.nace.ai';
const KEY = process.env.NACE_API_KEY;
if (!KEY) { console.error('NACE_API_KEY is not set (put it in .env).'); process.exit(1); }

interface Source { doc: string; url: string; fileName: string; pages?: { start: number; end: number }; pageLabel?: string }

// Scanned volumes on archive.org, with the page window for July 2 (PDF page indices are the
// research file's estimates). Several clean-text sites answer NDI's fetcher with 403, and the
// scans are the real thing anyway.
const OR1 = 'https://archive.org/download/warofrebellion271unit/warofrebellion271unit.pdf';
const OR2 = 'https://archive.org/download/warofrebellion272unit/warofrebellion272unit.pdf';
const JCCW = 'https://archive.org/download/reportofjointcom01unit/reportofjointcom01unit.pdf';
const SOURCES: Record<string, { who: string; sources: Source[] }> = {
  lee: { who: 'General Robert E. Lee', sources: [
    { doc: "Lee's report on the Gettysburg campaign, January 1864 (Official Records, Ser. I, Vol. 27, Part 2, scan)", url: OR2, fileName: 'official-records-27-2.pdf', pages: { start: 324, end: 326 }, pageLabel: 'pp. 318-320' },
  ] },
  longstreet: { who: 'Lieutenant General James Longstreet', sources: [
    { doc: 'Longstreet, From Manassas to Appomattox (1896), ch. XXVII (scan)', url: 'https://archive.org/download/manassasappomatt00longrich/manassasappomatt00longrich_bw.pdf', fileName: 'longstreet-manassas-to-appomattox.pdf', pages: { start: 434, end: 436 }, pageLabel: 'pp. 366-368' },
    { doc: "Longstreet's report, July 27, 1863 (Official Records, Ser. I, Vol. 27, Part 2, scan)", url: OR2, fileName: 'official-records-27-2.pdf', pages: { start: 364, end: 365 }, pageLabel: 'pp. 358-359' },
  ] },
  hood: { who: 'Major General John Bell Hood', sources: [
    { doc: 'Hood to Longstreet, June 28, 1875 (Advance and Retreat)', url: 'https://www.wtj.com/archives/hood/hood03b.htm', fileName: 'hood-letter-1875.htm', pageLabel: 'pp. 55-59' },
  ] },
  meade: { who: 'Major General George G. Meade', sources: [
    { doc: "Meade's report, October 1, 1863 (Official Records, Ser. I, Vol. 27, Part 1, scan)", url: OR1, fileName: 'official-records-27-1.pdf', pages: { start: 133, end: 135 }, pageLabel: 'pp. 115-117' },
    { doc: 'Minutes of council, July 2, 1863 (Official Records, Ser. I, Vol. 27, Part 1, scan)', url: OR1, fileName: 'official-records-27-1.pdf', pages: { start: 91, end: 92 }, pageLabel: 'pp. 73-74' },
  ] },
  sickles: { who: 'Major General Daniel E. Sickles', sources: [
    { doc: 'Sickles, testimony of February 26, 1864 (Report of the Joint Committee on the Conduct of the War, vol. 1, scan)', url: JCCW, fileName: 'joint-committee-vol1.pdf', pages: { start: 377, end: 379 }, pageLabel: 'pp. 297-299' },
  ] },
  warren: { who: 'Brigadier General Gouverneur K. Warren', sources: [
    { doc: 'Norton, The Attack and Defense of Little Round Top (1913): Warren to Farley, July 13, 1872 (scan)', url: 'https://archive.org/download/attackdefenseofl00nort/attackdefenseofl00nort.pdf', fileName: 'norton-little-round-top.pdf', pages: { start: 326, end: 328 }, pageLabel: 'pp. 308-310' },
  ] },
  chamberlain: { who: 'Colonel Joshua L. Chamberlain', sources: [
    { doc: "Chamberlain's report, July 6, 1863 (Official Records, Ser. I, Vol. 27, Part 1, scan)", url: OR1, fileName: 'official-records-27-1.pdf', pages: { start: 643, end: 645 }, pageLabel: 'pp. 623-625' },
  ] },
};

const schema = {
  type: 'object',
  properties: {
    traits: {
      type: 'array', maxItems: 3,
      description: 'Traits of character and command style that this document itself shows in the commander: how he decides, how he treats orders, what he does under pressure.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Two to four words naming the trait, for example "Protests, then obeys".' },
          text: { type: 'string', description: 'One sentence in the third person saying how this commander decides or acts, supported by the document.' },
          quote: { type: 'string', description: 'A short phrase copied word for word from the document that shows the trait.' },
        },
        required: ['label', 'text', 'quote'],
      },
    },
  },
  required: ['traits'],
};

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(`${BASE}${url}`, {
    method, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(90_000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 500)}`);
  return json;
}

async function extract(who: string, src: Source) {
  const body: any = {
    source: { type: 'url', url: src.url, file_name: src.fileName },
    schema,
    instructions: `The subject is ${who} on July 2, 1863, at Gettysburg. Report only what this document supports about him. If the document is by someone else, report what it shows about ${who}.`,
    name: `clio persona: ${src.fileName}`,
  };
  if (src.pages) body.page_ranges = [src.pages];
  let job = await api('POST', '/v1/documents/extract?wait_seconds=60', body);
  const id = job.job_id ?? job.id;
  const started = Date.now();
  while (!['succeeded', 'failed', 'cancelled'].includes(job.status)) {
    if (Date.now() - started > 420_000) throw new Error('timed out waiting for the job');
    await new Promise((r) => setTimeout(r, 3000));
    job = await api('GET', `/v1/documents/jobs/${id}`);
  }
  if (job.status !== 'succeeded') throw new Error(`job ${job.status}: ${JSON.stringify(job.error ?? {}).slice(0, 300)}`);
  return job.result;
}

function toTraits(result: any, src: Source, prefix: string): Trait[] {
  const data: any[] = result?.data?.traits ?? [];
  const fields: any[] = result?.fields ?? [];
  const out: Trait[] = [];
  data.forEach((t, i) => {
    if (!t?.label || !t?.text) return;
    const item = fields.find((f) => f.path === `/traits/${i}`) ?? fields.find((f) => String(f.path).startsWith(`/traits/${i}`));
    if (item?.status === 'not_found') return;
    const cite = item?.citations?.[0];
    const page = cite?.location?.page;
    out.push({
      id: `${prefix}_${i}`,
      label: String(t.label).slice(0, 48),
      text: String(t.text),
      citation: {
        doc: src.doc, url: src.url,
        page: src.pageLabel ?? (page ? `page ${page}` : undefined),
        quote: (t.quote || cite?.source_text || '').slice(0, 220) || undefined,
        status: item?.status ?? 'found',
      },
    });
  });
  return out;
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const dir = path.join(process.cwd(), 'data', 'personas');
fs.mkdirSync(dir, { recursive: true });
let pages = 0;
for (const [id, spec] of Object.entries(SOURCES)) {
  if (only.length && !only.includes(id)) continue;
  const traits: Trait[] = []; const used: string[] = [];
  for (const [n, src] of spec.sources.entries()) {
    process.stdout.write(`${id}: ${src.fileName} ... `);
    try {
      const result = await extract(spec.who, src);
      const got = toTraits(result, src, `${id}${n}`);
      traits.push(...got); used.push(src.url); pages += result?.units ?? 0;
      console.log(`${got.length} traits`);
    } catch (e) { console.log(`failed: ${(e as Error).message}`); }
  }
  if (traits.length) {
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ commander: id, built_by: 'NDI Extract', built_at: new Date().toISOString(), sources: used, traits: traits.slice(0, 5) }, null, 1));
    console.log(`  -> data/personas/${id}.json (${Math.min(5, traits.length)} traits)`);
  } else console.log(`  -> nothing extracted; ${id} keeps the authored persona`);
}
console.log(`done. NDI units billed (as reported): ${pages}`);
