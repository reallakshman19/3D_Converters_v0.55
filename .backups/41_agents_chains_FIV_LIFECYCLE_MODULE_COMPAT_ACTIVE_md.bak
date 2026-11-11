CHAIN_STATE_VERSION: 3
CHAIN_ID: FIV-LIFECYCLE-MODULE-COMPAT
MISSION: Restore Flow-Induced Vibration Screening module loading when browsers retain a pre-PR720 vibration project schema module, without weakening lifecycle persistence authority.
ACTIVE_ENDPOINT: EP-0003
ACTIVE_ENDPOINT_FILE: agents/chains/FIV-LIFECYCLE-MODULE-COMPAT/endpoints/EP-0003.md
LATEST_MATERIAL_LEG: LEG-001
LATEST_MATERIAL_LEG_FILE: agents/chains/FIV-LIFECYCLE-MODULE-COMPAT/material-legs/LEG-001.md
BRANCH: fix/fiv-lifecycle-module-cache-20260903
BASE_MAIN: 8b395134063be518b5ebd8174fe1007667530ebe
VALIDATION_CODE_HEAD: 4d5363dd89c4d9ad3f790cbafcdada2f6cb3871e
PR: 726
PR_STATE: OPEN_DRAFT
STATE: ACTIVE
ENGINEERING_STATE: BLOCKED
CUSTODY_STATE: HELD
QUALIFICATION_STATE: PASS
WRITE_AUTHORITY: READ_ONLY
AUTO_STATE: PAUSED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
WORK_ITEM_SOURCE: OWNER_DIRECT
WORK_ITEM_KEY: owner-direct:reallaksh19/3D_Converters:FIV-lifecycle-module-compat
WORK_ITEM_MODE: EXCLUSIVE
AUTHORITY_DOMAIN: FIV_MODULE_LOADING_AND_LIFECYCLE_SCHEMA_COMPAT_ONLY
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: 293a3db7993a6945c01adc592a7ff14a339c504a
OWNER_DIRECTIVE: 2026-09-03T10:53:00Z — fix FIV load failure caused by missing vibrationProjectLifecycleLedgers export
ROOT_CAUSE: Current main exports the post-PR720 lifecycle APIs, but direct named ESM imports from an unversioned project schema allow a cached pre-PR720 schema module to abort the FIV module graph during linking.
PATCH_STATUS: SOURCE_NODE_AND_ISOLATED_CHROMIUM_VALIDATED
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
RELEASE_STATE: RELEASE_NOT_QUALIFIED
CURRENT_BLOCKER: The reported FIV lifecycle named-export failure is closed by the compatibility patch, but full release qualification remains blocked by unrelated existing hosted failures: the project-EIT stale message regex and the Roadmap rendered-browser harness node:crypto import-map/CORS issue.
EXACT_NEXT_ACTION: Owner may disposition PR726. Do not merge without explicit Owner authorization. Repair/disposition the unrelated EIT regex and Roadmap browser harness only under separate qualified scope if full release qualification is required.
