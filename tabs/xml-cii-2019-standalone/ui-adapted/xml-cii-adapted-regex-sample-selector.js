import { buildRegexSampleBuckets } from '../xml-cii-regex-sample-buckets.js';

function findSampleSelect(builder) {
  return [...builder.querySelectorAll('select')]
    .find((node) => /Select Sample Branch/i.test(node.parentElement?.textContent || '')) || null;
}

function activeDelimiter(regexTesterConfig = {}) {
  const formats = regexTesterConfig.formats || [];
  const index = Number(regexTesterConfig.activeFormatIndex || 0);
  return formats[index]?.tokenDelimiter || regexTesterConfig.tokenDelimiter || '-';
}

function ensureBucketNote(select) {
  let note = select.parentElement?.querySelector('[data-regex-sample-bucket-note]');
  if (!note && select.parentElement) {
    note = document.createElement('div');
    note.dataset.regexSampleBucketNote = 'true';
    Object.assign(note.style, { width: '100%', fontSize: '10px', color: '#94a3b8', marginTop: '3px' });
    select.parentElement.appendChild(note);
  }
  return note;
}

export function decorateRegexSampleSelector(builder, branchSamples = [], regexTesterConfig = {}) {
  const select = findSampleSelect(builder);
  if (!select) return;
  const buckets = buildRegexSampleBuckets(branchSamples, activeDelimiter(regexTesterConfig));
  if (!buckets.length) return;

  const previous = select.value;
  select.innerHTML = '';
  for (const bucket of buckets) {
    const option = document.createElement('option');
    const representative = bucket.members.includes(previous) ? previous : bucket.representative;
    option.value = representative;
    option.textContent = `${bucket.count}× · ${representative} · ${bucket.signature}`;
    option.selected = bucket.members.includes(previous);
    select.appendChild(option);
  }
  if (!select.value && select.options.length) select.options[0].selected = true;

  const note = ensureBucketNote(select);
  if (note) {
    note.textContent = `${buckets.length} representative structural bucket${buckets.length === 1 ? '' : 's'} from ${branchSamples.length} branch samples. Extraction and coverage still evaluate the full sample set.`;
  }
}
