import {createElement} from './xml-cii-adapted-dom.js';
import {isBranchFormatEnabled} from '../../../converters/xml-cii2019-core/branch-format-extraction.js';

/** Editing a format and enabling it are separate, explicit choices. */
export function createRegexFormatEnableControl(format, index, onChange) {
  const section = createElement('div');
  const label = createElement('label');
  const input = createElement('input');
  input.type = 'checkbox';
  input.dataset.field = 'regex-format-enabled';
  input.checked = isBranchFormatEnabled(format, index);
  input.disabled = typeof onChange !== 'function';
  input.addEventListener('change', () => onChange?.(input.checked));
  label.append(input, createElement('span', `Use Format ${index + 1} for extraction`));
  section.append(label, createElement('p',
    'Enable only formats used by this XML. All enabled formats are checked; conflicting results hold Run. Changing format rules requires rebuilding Preview and checking the Weight review.',
    'xml-cii-phase-help'));
  return section;
}
