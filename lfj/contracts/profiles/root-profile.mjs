/**
 * LFJ/1.0 R01 root/profile authority (no I/O, JSON.parse, full-file copies or normalization).
 *
 * The caller supplies a parsed *small root descriptor* now. R04 will provide the
 * equivalent token-derived descriptor for large files without whole-document DOM.
 * This inspection never grants application edit/export authority; R12–R19 own that.
 *
 * Preservation invariant: The input object, its envelope fields, unknown metadata,
 * children, original bytes and engineering attributes are never modified here.
 */

export const ROOT_PROFILE_SCHEMA = 'lfj-root-profile/v1';
// Shallow byte-token facts provided by a future R04 lexer, without constructing AST arrays.
export const TOKEN_ROOT_FACTS_SCHEMA = 'lfj-token-root-facts/v1';
export const MANAGED_STAGE_SCHEMA = 'inputxml-managed-stage/v1';
export const MARKUP_RVM_PROFILE = 'AVEVA_JSON_FOR_3D_RVM_VIEWER';
export const RICH_TOPOLOGY_CONVERTER = 'INPUTXML->STAGEDJSON';
export const RICH_TOPOLOGY_CONVERTER_SCHEMA = 'inputxml-direct-managed-stage/v2-rich-topology';

const ENVELOPES = Object.freeze(['hierarchy', 'branches', 'objects']);
const SAFE_CAPABILITIES = Object.freeze({
  read: true,
  index: true,
  view: true,
  edit: false,
  export: false,
});

export class RootProfileError extends TypeError {
  constructor(code, description) {
    super(`${code}: ${description}`);
    this.name = 'RootProfileError';
    this.code = code;
  }
}

function refuse(code, description) {
  throw new RootProfileError(code, description);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function identifyRoot(value) {
  if (Array.isArray(value)) return { rootKind: 'array', rootKey: null, rootPath: '$' };
  if (!isObject(value)) refuse('UNSUPPORTED_ROOT', 'JSON root must be an array or recognized object');

  const declared = ENVELOPES.filter((key) => Object.hasOwn(value, key));
  for (const key of declared) if (!Array.isArray(value[key])) {
    refuse('INVALID_ROOT_ENVELOPE', 'Recognized own root key '+key+' must contain an array');
  }
  const matches = declared;
  const typed = Object.hasOwn(value, 'type') && Object.hasOwn(value, 'children')
    && typeof value.type === 'string' && value.type.trim() !== ''
    && Array.isArray(value.children);

  if (matches.length + Number(typed) > 1) {
    refuse('AMBIGUOUS_ROOT', 'Multiple incompatible root collection strategies are present');
  }
  if (matches.length === 1) {
    const key = matches[0];
    return { rootKind: key, rootKey: key, rootPath: `$.${key}` };
  }
  if (typed) return { rootKind: 'typed-single', rootKey: null, rootPath: '$' };

  refuse('UNSUPPORTED_ROOT', 'No supported root collection is present');
}

function classifyProfile(meta, root) {
  const {schema,profile,converter,converterSchema,unitsLength,
    unitsPresent,unitsObject,hierarchyCount}=meta;
  if (schema !== undefined && schema !== MANAGED_STAGE_SCHEMA) {
    refuse('UNSUPPORTED_SCHEMA', 'Producer schema is unknown or unsupported');
  }
  if (profile === undefined) return 'staged-generic/v1';
  if (profile !== MARKUP_RVM_PROFILE) {
    refuse('UNSUPPORTED_PROFILE', 'Declared managed-stage consumer profile is unsupported');
  }
  if (schema !== MANAGED_STAGE_SCHEMA) {
    refuse('UNSUPPORTED_SCHEMA', 'Strict managed-stage viewer profile requires declared source version');
  }
  if (converter !== RICH_TOPOLOGY_CONVERTER ||
      converterSchema !== RICH_TOPOLOGY_CONVERTER_SCHEMA) {
    refuse('CONVERTER_MISMATCH', 'Strict managed-stage rich topology converter identity is incorrect');
  }
  if (!unitsPresent || !unitsObject || unitsLength !== 'mm') {
    refuse('UNITS_MISMATCH', 'Strict managed-stage RVM requires millimetre length units');
  }
  if (root.rootKind !== 'hierarchy') {
    refuse('INCOMPATIBLE_PROFILE', 'Strict rich-topology profile requires a hierarchy root');
  }
  if (!hierarchyCount) {
    refuse('EMPTY_RICH_HIERARCHY', 'Strict rich-topology profile cannot have an empty hierarchy');
  }
  return 'managed-stage-markup-rich/v2';
}

function identifyProfile(value, root) {
  if (!isObject(value)) return 'staged-generic/v1';
  const own = (key) => Object.hasOwn(value, key) ? value[key] : undefined;
  const units=own('units');
  return classifyProfile({
    schema:own('schema'),profile:own('profile'),converter:own('converter'),
    converterSchema:own('converterSchema'),unitsPresent:Object.hasOwn(value,'units'),
    unitsObject:isObject(units)&&Object.hasOwn(units,'length'),
    unitsLength:isObject(units)&&Object.hasOwn(units,'length')?units.length:undefined,
    hierarchyCount:root.rootKind==='hierarchy'?value.hierarchy.length:0,
  },root);
}

function profileRecord(v,context) {
  if (!v || typeof v!=='object' || Array.isArray(v) ||
      (Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)) {
    refuse('INVALID_ROOT_FACTS',context+' must be a plain record');
  }
  return v;
}
const TOKEN_TYPES=new Set(['array','object','string','number','boolean','null']);
function factFields(fields,path) {
  profileRecord(fields,path);
  for(const [key,descriptor] of Object.entries(fields)) {
    if(key==='__proto__'||key==='constructor'||key==='prototype')
      refuse('INVALID_ROOT_FACTS','unsafe own field name '+key);
    profileRecord(descriptor,path+'.'+key);
    if(!TOKEN_TYPES.has(descriptor.type))
      refuse('INVALID_ROOT_FACTS','unknown shallow token type '+key);
    if(descriptor.type==='array'&&(!Number.isSafeInteger(descriptor.count)||descriptor.count<0))
      refuse('INVALID_ROOT_FACTS','array must contain nonnegative item count: '+key);
    if(descriptor.type==='string'&&typeof descriptor.value!=='string')
      refuse('INVALID_ROOT_FACTS','string fact must contain a scalar value: '+key);
    if(descriptor.type==='object')profileRecord(descriptor.fields,path+'.'+key+'.fields');
  }
  return fields;
}
function ownString(fields,key) {
  if(!Object.hasOwn(fields,key))return undefined;
  const item=fields[key];
  if(item.type!=='string')refuse('INVALID_ROOT_FACTS',key+' metadata must be a string');
  return item.value;
}
function profileFromFacts(fields,root) {
  const units=Object.hasOwn(fields,'units')?fields.units:null;
  const unitsFields=units?.type==='object'?factFields(units.fields,'$.units'):null;
  return classifyProfile({
    schema:ownString(fields,'schema'),profile:ownString(fields,'profile'),
    converter:ownString(fields,'converter'),
    converterSchema:ownString(fields,'converterSchema'),
    unitsPresent:units!==null,unitsObject:!!unitsFields,
    unitsLength:unitsFields?ownString(unitsFields,'length'):undefined,
    hierarchyCount:root.rootKind==='hierarchy'?fields.hierarchy.count:0,
  },root);
}
function result(root,profileId) {
  return Object.freeze({
    schema:ROOT_PROFILE_SCHEMA,profileId,rootKind:root.rootKind,
    rootKey:root.rootKey,rootPath:root.rootPath,
    capabilities:SAFE_CAPABILITIES,rightsBasis:'STRUCTURAL_INSPECTION_ONLY',
  });
}

/**
 * Inspect only the shallow verified-token root descriptor emitted by a caller.
 * The R04 tokenizer (not this function) must prove these facts correspond to
 * complete, valid original JSON bytes with no duplicate raw root keys.
 * This function never treats a caller-supplied descriptor as cryptographic proof.
 */
export function inspectStructuredJsonRootFacts(facts) {
  profileRecord(facts,'RootFacts');
  if(facts.schemaVersion!==TOKEN_ROOT_FACTS_SCHEMA ||
     typeof facts.complete!=='boolean'||
     typeof facts.duplicateRootKeys!=='boolean')
    refuse('INVALID_ROOT_FACTS','version, complete and duplicateRootKeys are required');
  if(facts.complete!==true)refuse('INCOMPLETE_ROOT_FACTS','a truncated source has no profile authority');
  if(facts.duplicateRootKeys)refuse('DUPLICATE_ROOT_KEY','duplicate root fields are not a canonical source');
  let root,fields;
  if(facts.rootType==='array') {
    if(!Number.isSafeInteger(facts.rootCount)||facts.rootCount<0)
      refuse('INVALID_ROOT_FACTS','root array count must be known');
    root={rootKind:'array',rootKey:null,rootPath:'$'};
    fields={};
  } else if(facts.rootType==='object') {
    fields=factFields(facts.fields,'$.fields');
    const declared=ENVELOPES.filter(key=>Object.hasOwn(fields,key));
    for(const key of declared)if(fields[key].type!=='array')
      refuse('INVALID_ROOT_ENVELOPE',key+' is present but not an array');
    const typed=Object.hasOwn(fields,'type')&&Object.hasOwn(fields,'children')
      &&fields.type.type==='string'&&fields.type.value.trim()!==''&&fields.children.type==='array';
    if(declared.length+Number(typed)>1)
      refuse('AMBIGUOUS_ROOT','multiple own collection strategies');
    if(declared.length===1){
      const key=declared[0];root={rootKind:key,rootKey:key,rootPath:'$.'+key};
    } else if(typed)root={rootKind:'typed-single',rootKey:null,rootPath:'$'};
    else refuse('UNSUPPORTED_ROOT','no recognized shallow array collection or typed root');
  } else refuse('INVALID_ROOT_FACTS','only complete object or array roots are supported');
  const profileId=profileFromFacts(fields,root);
  return result(root,profileId);
}

/**
 * Classify a structural source root, not a complete file parse or an edit/export grant.
 *
 * @param {unknown} documentRoot Input parsed root/descriptor; never mutated.
 * @returns {{schema:string, profileId:string, rootKind:string, rootKey:string|null,
 *   rootPath:string, capabilities:Readonly<Record<string,boolean>>, rightsBasis:string}}
 * @throws {RootProfileError} Typed unsupported/ambiguous or strict-profile errors.
 */
export function inspectStructuredJsonRoot(documentRoot) {
  const root = identifyRoot(documentRoot);
  const profileId = identifyProfile(documentRoot, root);

  return result(root,profileId);
}
