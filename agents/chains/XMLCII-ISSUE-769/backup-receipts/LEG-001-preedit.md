CHAIN_ID: XMLCII-ISSUE-769
MATERIAL_LEG_ID: LEG-001
BACKUP_STATUS: CONNECTOR_RECONSTRUCTED_EXACT_BLOBS
BACKUP_COMMIT: 251f4f0aac80a03c3b05e2c1f02ba26f8ea15a25
LOCAL_BACKUP_COMMAND_STATUS: NOT_RUN — no real repository checkout is available to the connector session

# LEG-001 pre-edit backup receipt

The project overlay requires `node utils/backup.js save <file> <context>` before editing existing files. This execution environment has GitHub connector write access but no real checked-out repository on which that command can truthfully run. Before any production mutation, byte-identical copies of the exact current Git blobs were committed under `.backups/` using Git tree references.

| Backup | Source path | Source blob |
|---|---|---|
| `.backups/42_tabs_xml-cii-2019-standalone_ui-adapted_xml-cii-adapted-fuzzy-mapper_js.bak` | `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-fuzzy-mapper.js` | `d5ea996029c0bb7996098510b636d7b034398149` |
| `.backups/43_converters_xml-cii2019-core_linelist-mapping_js.bak` | `converters/xml-cii2019-core/linelist-mapping.js` | `5b5e3a96e0fe4fa8a6bec57678fcfd68f294ace1` |
| `.backups/44_tabs_xml-cii-2019-standalone_ui-adapted_xml-cii-adapted-master-runtime_js.bak` | `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js` | `fe33ba573e3e8f24e360fc9fb0bd8d80e7e28de7` |
| `.backups/45_tabs_xml-cii-2019-standalone_ui-adapted_xml-cii-adapted-master-events_js.bak` | `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js` | `4f29d3c34a5402782e34cc6314afa9e95237c241` |

These are exact pre-edit recovery blobs, not validation evidence. The inability to execute the Node backup command remains explicitly recorded rather than represented as PASS.