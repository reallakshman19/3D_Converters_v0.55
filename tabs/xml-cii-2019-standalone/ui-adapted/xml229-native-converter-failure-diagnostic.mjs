/** Allowlisted, non-authorizing failure evidence for XML229 native CII.
 * Original stderr, tracebacks, file paths and model contents never escape.
 */
const NATIVE_GUARDS=Object.freeze([
 'CII_CONTROL_INVALID',
 'CII_ELEMENTS_FORMAT_INVALID',
 'CII_ELEMENTS_RECORD_INVALID',
 'CII_ELEMENTS_SECTION_INVALID',
 'CII_FORCE_UNIT_UNVERIFIED',
 'CII_GRAPH_ELEMENT_COUNT_DRIFT',
 'CII_GRAPH_RIGID_COUNT_DRIFT',
 'CII_MASS_RECORD_COUNT_MISMATCH',
 'CII_MASS_SECTION_MISSING',
 'CII_NATIVE_APPLIED_MASS_MISMATCH',
 'CII_NATIVE_CENSUS_INCOMPLETE',
 'CII_NATIVE_MASS_OUT_OF_RANGE',
 'CII_NATIVE_MASS_SCALE_UNSUPPORTED',
 'CII_NATIVE_MASS_UNREPRESENTABLE',
 'CII_NATIVE_MODEL_MASS_MISMATCH',
 'CII_NATIVE_PHYSICAL_OWNER_AMBIGUOUS',
 'CII_NATIVE_PHYSICAL_OWNER_MISSING',
 'CII_NATIVE_PHYSICAL_OWNER_MULTIPLE',
 'CII_NATIVE_PHYSICAL_RIGID_POINTER_UNVERIFIED',
 'CII_NATIVE_UNCLAIMED_POSITIVE_RIGID',
 'CII_RIGID_DOUBLE_OWNER',
 'CII_RIGID_ORPHANED',
 'CII_RIGID_POINTER_INVALID',
 'CII_RIGID_ROW_INVALID',
 'CII_RIGID_VALUE_INVALID',
 'CII_SECTION_DUPLICATED',
 'CII_SERIALIZE',
 'CII_WEIGHT_INVALID',
 'CII_WEIGHT_OWNER_AMBIGUOUS',
 'CII_WEIGHT_OWNER_UNRESOLVED',
 'CII_ZERO_INSTRUMENT_ELEMENT_AMBIGUOUS',
 'CII_ZERO_INSTRUMENT_ELEMENT_DUPLICATED',
 'CII_ZERO_INSTRUMENT_NOT_CONFIRMED',
 'CII_ZERO_INSTRUMENT_OUTPUT_NOT_VERIFIED',
 'ENGINE_XML_MALFORMED',
 'ENGINE_XML_NOT_PIPESTRESSEXPORT',
 'NATIVE_ACCEPTED_PHYSICAL_NOT_IN_FINAL_GEOMETRY',
 'NATIVE_AUTHORED_RESTRAINT_PROOF_OUTPUT_INVALID',
 'NATIVE_BRANCH_NAME_DRIFT',
 'NATIVE_BRANCH_OCCURRENCE_DRIFT',
 'NATIVE_BRANCH_OUT_OF_RANGE',
 'NATIVE_CHILD_GEOMETRY_DRIFT',
 'NATIVE_CHILD_LINEAGE_MISSING_OR_SPLIT',
 'NATIVE_DOUBLE_ENDPOINT_MASS_OWNER',
 'NATIVE_ENDPOINT_ALIAS_OVERLAP',
 'NATIVE_FINALIZED_GEOMETRY_CENSUS_DRIFT',
 'NATIVE_FINALIZED_GEOMETRY_ORDINAL_DRIFT',
 'NATIVE_FINALIZED_GEOMETRY_REQUIRED',
 'NATIVE_FINALIZED_GEOMETRY_SHA_DRIFT',
 'NATIVE_FINALIZED_GEOMETRY_SOURCE_DRIFT',
 'NATIVE_FINALIZED_NODE_ID_MAP_DRIFT',
 'NATIVE_FINALIZED_NODE_ID_MAP_INVALID',
 'NATIVE_FINAL_INTENT_REQUIRED',
 'NATIVE_FINAL_MASS_REQUIRED',
 'NATIVE_FINAL_POPULATION_INCOMPLETE',
 'NATIVE_GEOMETRY_CHANGED_AFTER_WEIGHT_ACCEPTANCE',
 'NATIVE_GEOMETRY_POSITION_INVALID',
 'NATIVE_LINEAGE_STAGE_LOST',
 'NATIVE_MASS_ROW_INVALID',
 'NATIVE_NODE_ORDINAL_OUT_OF_RANGE',
 'NATIVE_NONCANONICAL_ENDPOINT_OWNER',
 'NATIVE_OCCURRENCE_INVALID',
 'NATIVE_ORIGINAL_POPULATION_DRIFT',
 'NATIVE_OWNER_DUPLICATED',
 'NATIVE_OWNER_LINEAGE_AMBIGUOUS',
 'NATIVE_PACKET_INVALID',
 'NATIVE_PACKET_SCHEMA',
 'NATIVE_PHYSICAL_SIGNATURE_DRIFT',
 'NATIVE_PHYSICAL_LINEAGE_ALIAS_DRIFT',
 'NATIVE_PHYSICAL_LINEAGE_COUNT_DRIFT',
 'NATIVE_PHYSICAL_LINEAGE_OWNER_ALIAS_DRIFT',
 'NATIVE_PHYSICAL_LINEAGE_OWNER_DRIFT',
 'NATIVE_PHYSICAL_LINEAGE_PAIR_DRIFT',
 'NATIVE_PHYSICAL_LINEAGE_REQUIRED',
 'NATIVE_PHYSICAL_LINEAGE_SCHEMA_DRIFT',
 'NATIVE_PHYSICAL_LINEAGE_SUPPRESSED_PAIR_DRIFT',
 'NATIVE_PREACCEPTANCE_OWNER_CARDINALITY_DRIFT',
 'NATIVE_PREACCEPTANCE_RIGID_EDGE_DRIFT',
 'NATIVE_PREFINAL_RESTRAINT_STAGE_INVALID',
 'NATIVE_PREFINAL_RESTRAINT_SOURCE_SHA_DRIFT',
 'NATIVE_PREFINAL_RESTRAINT_SOURCE_INVALID',
 'NATIVE_PREFINAL_RESTRAINT_CONFIG_REQUIRED',
 'NATIVE_PREFINAL_RESTRAINT_MATCH_AMBIGUOUS',
 'NATIVE_PREFINAL_RESTRAINT_GAP_INVALID',
 'NATIVE_PREFINAL_RESTRAINT_GAP_AMBIGUOUS',
 'NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS',
 'NATIVE_PREFINAL_RESTRAINT_TYPE_AMBIGUOUS',
 'NATIVE_PREFINAL_RESTRAINT_TYPE_INVALID',
 'NATIVE_PREFINAL_RESTRAINT_TYPE_KIND_CONFLICT',

 'NATIVE_RIGID_OWNER_UNSUPPORTED',
 'NATIVE_SOURCE_ID_REQUIRED',
 'NATIVE_UNTRUSTED_LINEAGE_TAG',
 'XML229_NATIVE_FINAL_PACKET_REQUIRED',
 'XML229_NATIVE_MASS_PROOF_AND_KG_TO_N_REQUIRED',
 'XML229_NATIVE_PACKET_REQUIRES_XML_AND_CII',
]);
// Exact, non-content engineering guards introduced by source-value hydration and
// staged custody. Never allow arbitrary Python messages or wildcard prefixes.
const SOURCE_ENGINEERING_GUARDS=Object.freeze([
 'NATIVE_PREFINAL_RESTRAINT_CONFIG_INVALID',
 'NATIVE_PREFINAL_RESTRAINT_KIND_UNSUPPORTED',
 'NATIVE_PYTHON_ATTRIBUTE_ERROR',
 'NATIVE_PYTHON_IMPORT_ERROR',
 'NATIVE_PYTHON_KEY_ERROR',
 'NATIVE_PYTHON_MEMORY_ERROR',
 'NATIVE_PYTHON_NAME_ERROR',
 'NATIVE_PYTHON_RECURSION_ERROR',
 'NATIVE_PYTHON_RUNTIME_ERROR',
 'NATIVE_PYTHON_TYPE_ERROR',
 'XML229_BRANCH_FORMAT_AMBIGUOUS',
 'XML229_BRANCH_FORMAT_INVALID',
 'XML229_BRANCH_FORMAT_UNMATCHED',
 'XML229_LINE_MATERIAL_AMBIGUOUS',
 'XML229_MATERIAL_CODE_AMBIGUOUS',
 'XML229_MATERIAL_PIN_CONFLICT',
 'XML229_MATERIAL_PIN_INVALID',
 'XML229_MATERIAL_PIN_MAP_CONFLICT',
 'XML229_MATERIAL_PIN_OWNER_AMBIGUOUS',
 'XML229_PIPING_CLASS_BORE_AMBIGUOUS',
 'XML229_PIPING_CLASS_BORE_INVALID',
 'XML229_PIPING_CLASS_CORROSION_AMBIGUOUS',
 'XML229_PIPING_CLASS_CORROSION_INVALID',
 'XML229_PIPING_CLASS_INVALID_MASTER_VALUE',
 'XML229_PIPING_CLASS_MATERIAL_RATING_AMBIGUOUS',
 'XML229_PIPING_CLASS_WALL_EXCEEDS_OD',
 'XML229_PROCESS_MATERIAL_CODE_CONFLICT',
 'XML229_PROCESS_MATERIAL_NAME_CONFLICT',
 'XML229_SOURCE_XML_RESTRAINT_GAP_CONFLICT',
 'XML229_SOURCE_XML_RESTRAINT_TYPE_AMBIGUOUS',
 'XML229_SOURCE_XML_RESTRAINT_TYPE_CONFLICT',
 'XML229_STAGED_POSITION_AMBIGUOUS',
 'XML229_STAGED_POSITION_PARTIAL_TRANSFER',
 'XML229_STAGED_TRANSFER_NO_MATCH',
 'XML229_VERIFIED_CLASS_CORROSION_CONFLICT',
 'XML229_VERIFIED_CLASS_DN_WALL_CONFLICT',
 'XML229_VERIFIED_CLASS_DN_WALL_MISSING',
 'XML229_VERIFIED_CLASS_LOOKUP_UNAVAILABLE',
 'XML229_VERIFIED_CLASS_RATING_CONFLICT',
 'XML229_VERIFIED_CLASS_RATING_MISSING',
 'XML229_VERIFIED_DENSITY_CONFLICT',
 'XML229_VERIFIED_DENSITY_MISSING',
 'XML229_VERIFIED_LINE_LIST_UNRESOLVED',
 'XML229_VERIFIED_MATERIAL_CODE_CONFLICT',
 'XML229_VERIFIED_MATERIAL_CODE_UNAPPROVED',
 'XML229_VERIFIED_MATERIAL_NAME_CONFLICT',
 'XML229_VERIFIED_PIPE_CENSUS_EMPTY',
 'XML229_VERIFIED_PIPING_CLASS_UNRESOLVED',
 'XML229_VERIFIED_PRESSURE_MISSING',
 'XML229_VERIFIED_PROCESS_FIELD_CONFLICT',
 'XML229_VERIFIED_T1_MISSING',
 'XML229_VERIFIED_T2_MISSING',
 'XML229_VERIFIED_T3_MISSING',
 'XML229_XML_RESTRAINT_PROVENANCE_UNRESOLVED',
]);
const KNOWN_CODES=new Set([...NATIVE_GUARDS,...SOURCE_ENGINEERING_GUARDS]);
const STAGES=new Set([
 'PYODIDE_INITIALIZE','SCRIPT_LOAD','BASE_MODULE_RESET',
 'INPUT_PREPARATION','TOPOLOGY_STAGE','ENRICH_XML',
 'CII_CONVERSION','MASS_PROOF_READ','MASS_PROOF_VERIFY',
 'RUNTIME_OPTIONS','ORIGINAL_LINEAGE_STAGE','STAGED_ENRICHMENT',
 'LINEAGE_PACKET_VALIDATE','LINEAGE_GEOMETRY_VERIFY','LINEAGE_PREFINAL_RESTRAINT_REPLAY','LINEAGE_FINAL_SOURCE_COMPARE','LINEAGE_OWNER_CENSUS','STAGED_POSITION_TRANSFER','SOURCE_VALUE_HYDRATION','VERIFIED_MASTER_COMPLETENESS','BEND_RADIUS_POLICY',
 'PREACCEPTANCE_GEOMETRY','FINAL_MASS_BINDING','FINAL_GEOMETRY_READ',
 'MODEL_PARSE','MODEL_BUILD','MODEL_GEOMETRY_CHECK',
 'RIGID_WEIGHT_OWNER_CHECK','CII_SERIALIZE','EMITTED_MASS_VERIFY',
 'OUTPUT_WRITE',
]);
export const XML229_NATIVE_FAILURE_SCHEMA='XML229.NativeConverterFailure.v1';
const AMBIGUITY_MARKER='XML229_STAGED_POSITION_AMBIGUITY ';
/** Parse only the allowlisted, bounded source-index receipt; never forward native logs. */
export function readXml229BoundedStagedPositionEvidence(logs){
 if(!Array.isArray(logs))return null;
 const line=logs.find(x=>typeof x==='string'&&x.startsWith(AMBIGUITY_MARKER)&&x.length<8192);
 if(!line)return null;
 let parsed;
 try{parsed=JSON.parse(line.slice(AMBIGUITY_MARKER.length));}catch{return null;}
 const index=x=>Number.isSafeInteger(x)&&x>=0&&x<=10000000;
 if(!index(parsed?.count)||parsed.count<1||!Array.isArray(parsed?.sample)||parsed.sample.length>20)return null;
 const reasons=new Set(['NON_UNIQUE_POSITION_OWNER','COMPETING_POSITION_TRANSFORMS']);
 const scopes=new Set(['MANDATORY','NOT_APPLICABLE']);
 const geometry=new Set(['COINCIDENT','DISTINCT']);
 const hasRouteStatus=parsed.matcherRevision==='XML229_POSITION_CARRIER_PROVENANCE_V6';
 const hasCarrier=parsed.matcherRevision==='XML229_POSITION_CARRIER_AUTHORITY_V4'||
  parsed.matcherRevision==='XML229_POSITION_CARRIER_EDGE_V5'||hasRouteStatus;
 const carrierStatuses=new Set(['NOT_DECLARED','MALFORMED_REFERENCE',
  'CONFLICTING_DECLARATIONS','BRANCH_UNRESOLVED','ROUTE_REF_NOT_FOUND',
  'ROUTE_REF_OTHER_BRANCH','ROUTE_REF_DUPLICATED','VERIFIED']);
 const hasOriginalProof=hasCarrier||
  parsed.matcherRevision==='XML229_POSITION_ORIGINAL_AUTHOR_V3';
 const hasVersion=hasOriginalProof||
  parsed.matcherRevision==='XML229_POSITION_PRECISION_V2';
 if(parsed.matcherRevision!==undefined&&!hasVersion)return null;
 if(hasVersion&&!(parsed.matchToleranceMm===null||
    (Number.isFinite(parsed.matchToleranceMm)&&parsed.matchToleranceMm>=0&&
     parsed.matchToleranceMm<=1000000000)))return null;
 const sample=[];
 for(const x of parsed.sample){
   if(!index(x?.sourceClaimIndex)||!index(x?.candidateCount)||
      !reasons.has(x.reason)||!Array.isArray(x.candidatePositionRowIndices)||
      x.candidatePositionRowIndices.length>12||
      !x.candidatePositionRowIndices.every(index)||
      (x.scope!==undefined&&!scopes.has(x.scope)))return null;
   if(hasVersion&&(!geometry.has(x.candidateGeometry)||
      !index(x.preciseCandidateCount)||!index(x.guardBandCandidateCount)||
      !index(x.matchedTransformCount)||!index(x.psCorroboratedCandidateCount)||
      typeof x.explicitXmlRefPresent!=='boolean'||
      x.preciseCandidateCount>x.candidateCount||
      x.guardBandCandidateCount>x.candidateCount||
      x.psCorroboratedCandidateCount>x.candidateCount||
      x.matchedTransformCount>3))return null;
   if(hasOriginalProof&&(
      typeof x.originalSourceProofPresent!=='boolean'||
      !index(x.originalSourceRestraintCandidates)||
      !index(x.originalMatchingRestraintCandidates)||
      x.originalSourceRestraintCandidates>x.candidateCount||
      x.originalMatchingRestraintCandidates>x.originalSourceRestraintCandidates||
      (!x.originalSourceProofPresent&&
       (x.originalSourceRestraintCandidates!==0||
        x.originalMatchingRestraintCandidates!==0))
    ))return null;
   if(hasCarrier&&(
      typeof x.carrierRefDeclared!=='boolean'||
      typeof x.carrierRouteVerified!=='boolean'||
      !index(x.carrierCandidateCount)||
      x.carrierCandidateCount>x.candidateCount||
      (x.carrierRouteVerified&&!x.carrierRefDeclared)||
      (!x.carrierRouteVerified&&x.carrierCandidateCount!==0)
    ))return null;
   if(hasRouteStatus&&(
      !carrierStatuses.has(x.carrierRouteStatus)||
      x.carrierRouteVerified!==(x.carrierRouteStatus==='VERIFIED')||
      x.carrierRefDeclared!==(x.carrierRouteStatus!=='NOT_DECLARED')
    ))return null;
   sample.push({sourceClaimIndex:x.sourceClaimIndex,reason:x.reason,
     ...(x.scope!==undefined?{scope:x.scope}:{}),
     candidateCount:x.candidateCount,
     candidatePositionRowIndices:[...x.candidatePositionRowIndices],
     ...(hasVersion?{
       candidateGeometry:x.candidateGeometry,
       preciseCandidateCount:x.preciseCandidateCount,
       guardBandCandidateCount:x.guardBandCandidateCount,
       matchedTransformCount:x.matchedTransformCount,
       psCorroboratedCandidateCount:x.psCorroboratedCandidateCount,
       explicitXmlRefPresent:x.explicitXmlRefPresent,
     }:{}),
     ...(hasOriginalProof?{
       originalSourceProofPresent:x.originalSourceProofPresent,
       originalSourceRestraintCandidates:x.originalSourceRestraintCandidates,
       originalMatchingRestraintCandidates:x.originalMatchingRestraintCandidates,
     }:{}),
     ...(hasCarrier?{
       carrierRefDeclared:x.carrierRefDeclared,
       carrierRouteVerified:x.carrierRouteVerified,
       carrierCandidateCount:x.carrierCandidateCount,
     }:{}),
     ...(hasRouteStatus?{carrierRouteStatus:x.carrierRouteStatus}:{}),
   });
 }
 return Object.freeze({schema:'XML229.NativeStagedPositionAmbiguity.v1',
   ambiguousCount:parsed.count,
   ...(hasVersion?{matcherRevision:parsed.matcherRevision,
     matchToleranceMm:parsed.matchToleranceMm}:{}),
   sample,sampleTruncated:parsed.sampleTruncated===true});
}
export function diagnoseXml229NativeConverterFailure(native){
 const category=native?.ok!==true?'ENGINE_FAILED':
   !native?.ciiText?'CII_OUTPUT_MISSING':'NATIVE_MASS_PROOF_MISSING';
 const python=category==='ENGINE_FAILED'&&
   native?.nativeFailurePhase==='CII_CONVERSION'&&
   native?.nativePythonFailure&&typeof native.nativePythonFailure==='object'
     ?native.nativePythonFailure:null;
 const hasReceipt=!!python;
 const phase=hasReceipt
   ?(STAGES.has(python.stage)?python.stage:'UNKNOWN'):
   category==='ENGINE_FAILED'&&STAGES.has(native?.nativeFailurePhase)
     ?native.nativeFailurePhase:
     category==='CII_OUTPUT_MISSING'?'CII_CONVERSION':
     category==='NATIVE_MASS_PROOF_MISSING'?'MASS_PROOF_READ':'UNKNOWN';
 // Typed in-process Python receipt takes precedence over log text, which
 // may contain private source material or misleading arbitrary strings.
 const code=hasReceipt
   ?(KNOWN_CODES.has(python.code)?python.code:'UNCLASSIFIED_EXCEPTION'):
   NATIVE_GUARDS.find(x=>[native?.error,...(Array.isArray(native?.logs)?native.logs:[])]
     .some(message=>typeof message==='string'&&message.includes(x)))||
   'NATIVE_CANDIDATE_CONVERTER_FAILED';
 const ownerMatchCardinality=code==='CII_NATIVE_PHYSICAL_OWNER_MISSING'?'ZERO':
   code==='CII_NATIVE_PHYSICAL_OWNER_MULTIPLE'?'MULTIPLE':null;
 const stagedPositionAmbiguity=code==='XML229_STAGED_POSITION_AMBIGUOUS'
   ?readXml229BoundedStagedPositionEvidence(native?.logs):null;
 return Object.freeze({
   schema:XML229_NATIVE_FAILURE_SCHEMA,code,category,phase,
   ...(ownerMatchCardinality?{ownerMatchCardinality}:{}),
   ...(stagedPositionAmbiguity?{stagedPositionAmbiguity}:{}),
   candidatePublished:false,nativeCiiReleaseAuthorized:false,
 });
}
