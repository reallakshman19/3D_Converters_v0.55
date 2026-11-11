# LEG-003 pre-edit backup receipt

CHAIN_ID: XMLCII-ISSUE-769
LEG: LEG-003
BASIS_HEAD: 550ccdb2bda0c563dd208bf1ebbb28f6aa064355
PRIMARY_BACKUP_COMMIT: 430ce62674745ecd7edfd98544321040dff9e754
BACKUP_METHOD: CONNECTOR_RECONSTRUCTED_EXACT_GIT_BLOB_COPY
NATIVE_BACKUP_UTILITY_STATUS: NOT_RUN
NATIVE_BACKUP_UTILITY_REASON: connected GitHub workspace does not expose an executable repository checkout; `node utils/backup.js save` cannot truthfully be executed here.

Exact pre-edit blobs in the primary receipt:

- `converters/xml-cii2019-core/weight-match-model.js` @ `abb8f9293f74b24e84454055d86bdad9c44a5fd7` -> `.backups/LEG003_weight-match-model.js.bak`
- `tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js` @ `55e42c0475694854e8bf9d7971aec1903240d277` -> `.backups/LEG003_weight-match-renderer.js.bak`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-review-mode-a-state.js` @ `d383006b00df80c8ade4130732317cad435c6361` -> `.backups/LEG003_rigid-review-mode-a-state.js.bak`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow.js` @ `38638b724b58ef8597b6fbdfb7921acc26c4d3c0` -> `.backups/LEG003_run-workflow.js.bak`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-atta-default.js` @ `41c04871a337536b1f0d318a195dfc21fc100fa8` -> `.backups/LEG003_run-workflow-atta-default.js.bak`
- `tabs/model-converters/converters/xmltocii2019_runner.js` @ `bcc909d2835d793a1569cd65a991a9f240015326` -> `.backups/LEG003_xmltocii2019_runner.js.bak`
- `tabs/xml-cii-2019-standalone/xml-cii-standalone-run-parity.js` @ `00ea0eec33dc3094941c83ba0ca8d22e388aa226` -> `.backups/LEG003_standalone-run-parity.js.bak`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun-core.js` @ `017cb0aa33712c9910ef80ed961a89b35da54675` -> `.backups/LEG003_preview-dryrun-core.js.bak`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-validation-report.js` @ `38d583a713e0dad963c9791f373a1613319e3b95` -> `.backups/LEG003_weight-validation-report.js.bak`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-weight-actions.js` @ `bdcfb334781d58b3ae53e8949689f22808973c7a` -> `.backups/LEG003_mode-a-weight-actions.js.bak`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js` -> `.backups/LEG003_weight-match-v2.js.bak`
- `tabs/xml-cii-2019-standalone/xml-cii-workflow-ui-adapter.js` -> `.backups/LEG003_workflow-ui-adapter.js.bak`
- `tests/xml-cii-mode-a-consolidated-rigid-review.test.mjs` -> `.backups/LEG003_xml-cii-mode-a-consolidated-rigid-review.test.mjs.bak`

Additional files were discovered to be material owners during the trace and were backed up before their first LEG-003 production edits:

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-review-mode-a.js` -> `.backups/LEG003_rigid-review-mode-a.js.bak`; backup commit `68a8515c07fcab826ed3a7609110de674990dabf`.
- `tabs/model-converters/xml-cii-post-run-validator-standalone.js` -> `.backups/issue-769/LEG003/tabs__model-converters__xml-cii-post-run-validator-standalone.js.bak`; backup commit `a42150f9a3df21564dd65540d3fa8279cb14ef47`.
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js` -> `.backups/issue-769/LEG003/tabs__xml-cii-2019-standalone__ui-adapted__xml-cii-adapted-preview-dryrun.js.bak`; backup commit `9539a2d3c3199c9569b07634df49e4839f64b363`.

No listed production file was modified before its corresponding backup commit.