#!/usr/bin/env node
/**
 * #229: read-only, local-only replay of the Owner's actual Run format gate.
 * Outputs NO original XML, Branchname, mapped field value, regex pattern,
 * config JSON or browser localStorage. Never sends network requests.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { xmlCiiBranchScopeFromState, xmlCiiSourceDigest } from '../tabs/xml-cii-2019-standalone/xml-cii-branch-scope.js';
import { auditConfiguredBranchFormats } from '../tabs/xml-cii-2019-standalone/xml-cii-branch-format-release.js';

// Only the two source-identity fields may make configured formats ambiguous.
const FIELDS = ['lineKey','pipingClass'];
const digest = value => createHash('sha256').update(String(value),'utf8').digest('hex');
function plain(value) {return value && typeof value==='object' && !Array.isArray(value) ? value : {};}
function formatReason(candidate) {
  return {formatIndex:candidate.formatIndex, status:candidate.status,
    fieldMethods:plain(candidate.fieldMethods),reasons:plain(candidate.reasons)};
}
function conflicts(candidates) {
  const matched=candidates.filter(candidate=>candidate.status==='MATCHED');
  return FIELDS.filter(field=>new Set(matched.map(c=>String(c[field]??''))).size>1);
}
function publicExample(failure) {
  const candidates=Array.isArray(failure.formatCandidates)?failure.formatCandidates:[];
  return {
    occurrenceOrdinal:Number(failure.occurrenceIndex)+1,
    status:failure.status,
    configOrigin:failure.configOrigin || '',
    // Never include branchName, branchOccurrenceId, candidate value or config.
    formats:candidates.map(formatReason),
    differingFields:failure.status==='AMBIGUOUS'?conflicts(candidates):[],
  };
}
export function buildRedactedOwner229Report({xml,config,selection=null,regexStorage=null,expectedCount=null}) {
  const sourceText=String(xml??'');
  if(!sourceText.trim())throw Error('XML_INPUT_EMPTY');
  const effective=plain(typeof config==='string'?JSON.parse(config):config);
  const support=typeof effective.supportConfigJson==='string'
    ? plain(JSON.parse(effective.supportConfigJson))
    : effective;
  if(!Array.isArray(support.regexTester?.formats)&&!Array.isArray(support.formats)) {
    throw Error('RUN_EFFECTIVE_FORMATS_REQUIRED: provide the actual supportConfigJson from 5 Run; browser regex-only storage is not enough');
  }
  const bound=selection===null ? null : plain(selection);
  const sourceDigest=xmlCiiSourceDigest(sourceText);
  if(bound && (!bound.sourceDigest || bound.sourceDigest!==sourceDigest)){
    throw Error('SELECTION_SOURCE_MISMATCH: saved branch selection must be bound to the exact same XML source');
  }
  const scope=xmlCiiBranchScopeFromState({
    sourceKind:'xml',sourceText,
    ...(bound?{branchSelection:bound}:{}),
  });
  if(!scope.applicable)throw Error('NO_XML_BRANCH_OCCURRENCES');
  if(scope.blocked)throw Error('SELECTED_SCOPE_BLOCKED');
  const checked=scope.selectedBranchOccurrences || [];
  const audit=auditConfiguredBranchFormats(checked,support,null,{includeCandidates:true});
  if(!audit.required)throw Error('RUN_CONFIGURED_FORMAT_GATE_NOT_ACTIVE');
  if(expectedCount!==null && checked.length!==Number(expectedCount)) {
    throw Error('EXPECTED_OCCURRENCE_COUNT_MISMATCH: checked count '+checked.length);
  }
  const unmatched=audit.failures.filter(f=>f.status==='UNMATCHED').length;
  const ambiguous=audit.failures.filter(f=>f.status==='AMBIGUOUS').length;
  const presentNested=Array.isArray(support.regexTester?.formats);
  const selectedOrigin=presentNested?'regexTester.formats':'formats';
  const activeFormats=presentNested?support.regexTester.formats:support.formats;
  const mismatch=regexStorage===null?null:
    JSON.stringify(plain(regexStorage).formats||null)!==JSON.stringify(support.regexTester?.formats||null);
  return {
    schema:'XML229_PRIVATE_FORMAT_DIAG_V1',
    authority:'RUN_FORMAT_ONLY_NOT_PREVIEW_OR_FINAL_CII',
    evidence:'LOCAL_INPUT_NOT_OWNER_ATTESTED',
    sensitiveDataIncluded:false,
    sourceSha256:digest(sourceText),
    effectiveSupportConfigSha256:digest(JSON.stringify(support)),
    selectionBoundToSource:!!bound,
    selectionProof:bound?'SOURCE_DIGEST_MATCHED':'ALL_SOURCE_UNVERIFIED',
    checkedOriginalOccurrences:checked.length,
    duplicateNameOccurrences:checked.filter(c=>Number(c.duplicateCount)>1).length,
    formatSource:selectedOrigin, configuredFormatCount:activeFormats.length,
    persistedRegexDiffersFromEffectiveRun:mismatch,
    blocked:audit.blocked,
    unmatched,ambiguous,
    first20:audit.failures.slice(0,20).map(publicExample),
    note:'Redacted: no original names, mapped values or regex patterns. A clear format gate does NOT prove Preview/Weight/CII release approval.',
  };
}
const asMain=process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1];
if(asMain){
  try {
    const opts={};const args=process.argv.slice(2);
    for(let i=0;i<args.length;i+=2) {
      if(!args[i].startsWith('--') || i+1>=args.length)throw Error('INVALID_ARGUMENTS');
      opts[args[i].slice(2)]=args[i+1];
    }
    if(!opts.xml||!opts.config)throw Error('USAGE: node scripts/xml-cii-229-private-run-audit.mjs --xml private.xml --config private-run-support.json [--selection private-selection.json] [--regex-storage private-regex-storage.json] [--expect 28] [--out redacted-report.json]');
    const safeRead=async (filename,max)=>{const body=await readFile(filename,'utf8');if(Buffer.byteLength(body)>max)throw Error('INPUT_EXCEEDS_PRIVATE_BOUND');return body};
    const xml=await safeRead(opts.xml,100*1024*1024);
    const config=JSON.parse(await safeRead(opts.config,2*1024*1024));
    const selection=opts.selection?JSON.parse(await safeRead(opts.selection,2*1024*1024)):null;
    const regexStorage=opts['regex-storage']?JSON.parse(await safeRead(opts['regex-storage'],2*1024*1024)):null;
    const expectedCount=opts.expect?Number(opts.expect):null;
    if(expectedCount!==null&&(!Number.isSafeInteger(expectedCount)||expectedCount<1))throw Error('INVALID_EXPECTED_COUNT');
    const report=buildRedactedOwner229Report({xml,config,selection,regexStorage,expectedCount});
    const printable=JSON.stringify(report,null,2)+'\n';
    if(opts.out)await writeFile(opts.out,printable,'utf8');
    else process.stdout.write(printable);
  } catch(error) {
    // Safe local diagnostic only; never dump a path, original input or stack.
    console.error('XML229_PRIVATE_AUDIT_ERROR:',String(error?.message||error).split('\n')[0]);
    process.exitCode=2;
  }
}
