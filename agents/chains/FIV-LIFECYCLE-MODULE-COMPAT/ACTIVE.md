CHAIN_STATE_VERSION: 3
CHAIN_ID: FIV-LIFECYCLE-MODULE-COMPAT
MISSION: Restore Flow-Induced Vibration Screening module loading when browsers retain a pre-PR720 vibration project schema module, without weakening lifecycle persistence authority.
ACTIVE_ENDPOINT: EP-0004
ACTIVE_ENDPOINT_FILE: agents/chains/FIV-LIFECYCLE-MODULE-COMPAT/endpoints/EP-0004.md
LATEST_MATERIAL_LEG: LEG-001
LATEST_MATERIAL_LEG_FILE: agents/chains/FIV-LIFECYCLE-MODULE-COMPAT/material-legs/LEG-001.md
BRANCH: main
BASE_MAIN: 8b395134063be518b5ebd8174fe1007667530ebe
VALIDATION_CODE_HEAD: 4d5363dd89c4d9ad3f790cbafcdada2f6cb3871e
PR: 726
PR_STATE: MERGED
PR_HEAD_AT_MERGE: 0e0d4dbb2dae372f0ac9bcb0e5f91db0815da91f
MERGE_METHOD: SQUASH
MERGE_COMMIT: 831f72b423d4ec307be6df847e48ff8ff8e5aa82
MERGED_AT: 2026-09-03T11:32:42Z
POST_MERGE_CHECKPOINT_HEAD: 0f6fe666de8266991e6a9b4c5dd122afe895e400
STATE: ACTIVE
ENGINEERING_STATE: BLOCKED
CUSTODY_STATE: HELD
QUALIFICATION_STATE: PASS
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: PAUSED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: CONSUMED
MERGE_RESULT: MERGED
WORK_ITEM_SOURCE: OWNER_DIRECT
WORK_ITEM_KEY: owner-direct:reallaksh19/3D_Converters:FIV-lifecycle-module-compat
WORK_ITEM_MODE: EXCLUSIVE
AUTHORITY_DOMAIN: FIV_MODULE_LOADING_AND_LIFECYCLE_SCHEMA_COMPAT_ONLY
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: 293a3db7993a6945c01adc592a7ff14a339c504a
OWNER_DIRECTIVE: 2026-09-03T11:31:59Z — merge
ROOT_CAUSE: Current main exported the post-PR720 lifecycle APIs, but direct named ESM imports from an unversioned project schema allowed a cached pre-PR720 schema module to abort the FIV module graph during linking.
PATCH_STATUS: MERGED_TO_MAIN
PATCH_MECHANISM: namespace-import cache-busted project schema; resolve lifecycle APIs at invocation; fail closed with VIBRATION_PROJECT_SCHEMA_LIFECYCLE_API_UNAVAILABLE when absent
NUMERICAL_CHANGE: NONE
ENGINEERING_AUTHORITY_CHANGE: NONE
WORKFLOW_CHANGE: NONE
HOSTED_FIV_COMPAT_REGRESSION: PASS
HOSTED_LIFECYCLE_WORKFLOW: FAIL_PREEXISTING_EIT_REGEX_49_OF_50
ROADMAP_NODE_CONTRACTS: PASS_29_OF_29
CHROMIUM_ISOLATED_COMPAT: PASS_3_OF_3_CHROME_144
HOSTED_ROADMAP_RENDERED_CHROMIUM: FAIL_NODE_CRYPTO_IMPORTMAP_CORS
FULL_APPLICATION_CHROMIUM_STATUS: NOT_RUN
MERGE_COMMIT_WORKFLOW_RECEIPT: NO_RUNS_OBSERVED_IMMEDIATELY_POST_MERGE
RELEASE_STATE: RELEASE_NOT_QUALIFIED
CURRENT_BLOCKER: The requested FIV lifecycle named-export defect is merged and closed. Full release qualification remains blocked only by separately scoped existing failures: the project-EIT stale message regex and the Roadmap rendered-browser node:crypto import-map/CORS harness issue.
EXACT_NEXT_ACTION: No further runtime change under this repair scope. If full release qualification is required, open or authorize separate bounded work for the existing EIT regex and Roadmap browser-harness blockers.
