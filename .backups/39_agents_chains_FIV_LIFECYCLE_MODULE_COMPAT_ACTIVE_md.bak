CHAIN_STATE_VERSION: 3
CHAIN_ID: FIV-LIFECYCLE-MODULE-COMPAT
MISSION: Restore Flow-Induced Vibration Screening module loading when browsers retain a pre-PR720 vibration project schema module, without weakening lifecycle persistence authority.
ACTIVE_ENDPOINT: EP-0001
ACTIVE_ENDPOINT_FILE: agents/chains/FIV-LIFECYCLE-MODULE-COMPAT/endpoints/EP-0001.md
BRANCH: fix/fiv-lifecycle-module-cache-20260903
BASE_MAIN: 8b395134063be518b5ebd8174fe1007667530ebe
STATE: ACTIVE
ENGINEERING_STATE: READY
CUSTODY_STATE: HELD
QUALIFICATION_STATE: PASS
WRITE_AUTHORITY: WRITE_ALLOWED
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
ROOT_CAUSE: Current main exports vibrationProjectLifecycleLedgers and attachVibrationProjectLifecycleLedgers, but lifecycle consumers use named ESM imports. A browser retaining a pre-PR720 cached schema.js therefore fails the whole FIV module graph during ESM link before fail-closed runtime logic can execute.
PATCH_SCOPE: Replace direct named lifecycle-schema imports in lifecycle consumers with a new namespace-based compatibility adapter that keeps missing newer APIs as explicit runtime fail-closed errors rather than module-link failures.
NUMERICAL_CHANGE: NONE
ENGINEERING_AUTHORITY_CHANGE: NONE
WORKFLOW_CHANGE: NONE
CHROMIUM_STATUS: NOT_RUN
NODE_STATUS: NOT_RUN
HOSTED_STATUS: NOT_RUN
RELEASE_STATE: RELEASE_NOT_QUALIFIED
EXACT_NEXT_ACTION: Preserve pre-edit blobs, add the compatibility adapter and focused regression, update only the lifecycle handoff and roadmap-controller imports/calls, then execute Node and Chromium module-load checks.