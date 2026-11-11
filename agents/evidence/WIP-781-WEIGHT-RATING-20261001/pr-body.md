## Owner follow-up to #781 / merged #810

Phase 6 Weight Match now uses Rating prefix mapping when Preview has no Rating, and provides editable Rating cells with same-class fill (`↓`).

### Repair
- Persist prefix-editor changes immediately into Regex and converter configuration, including across a page reload before building Preview or Weight.
- Share Rating authority between worker basis validation and candidate ranking: saved manual input → nonempty Preview → configured prefix. Conflicting Preview stays unresolved; DTXR remains explicit.
- Save manual Rating through existing line/branch override buckets. Class fill updates visible same-class rows without a global class override, then rebuilds suggestions asynchronously.
- Preserve successive saves through the adapter's latest configuration. Rating changes invalidate old accepted Match-1 weights before suggestions are ranked.
- Update active module cache URLs and byte-identical source/docs copies. No workflow, writer, runtime ownership, master data, or numerical matching changes.

### Validation
- 38/38 focused Node checks pass, including supplied prefix/candidate values, manual/clear/invalid input, class isolation, snapshot conflict, worker provenance invalidation, and deployment parity.
- Full `/docs/` Chromium workflow: exact 41 branches / 1,654 nodes and APPLIED 1,595-row Weight master; 180 Weight rows.
- Edit `3 → 600`, reload page, enter Weight without Preview: Rating 600. Manual 900 and 450 both persist. Class `31441C4` fill 300 updates 178 rows and leaves the other class unchanged. Previous 10.5 kg Match-1 acceptance becomes stale. Repeat Build and panel reopen preserve Ratings. No page errors; max frame gap ≤250 ms.
- Combined Regex → Preview → Weight regression passes with APPLIED piping/line/weight masters: entry max gap 83 ms, Build 166 ms, 180/180 decorated rows.
- 33 source/docs pairs match; changed source syntax and diff whitespace checks pass.

### Review boundaries
Manual Rating uses existing line/branch scope. Class fill rejects a Line Key shared by a different piping class before mutation; review those Line Keys in Preview. Current owner browser profile and post-merge deployed acceptance have not been run. Open draft #801 and Mode B #792 overlap cache ancestors; their heads are unchanged, and no changes were cherry-picked or merged.

Recovery report: `agents/PR811_workreport.md` (renamed after PR allocation). Browser JSON, screenshot, and execution transcripts are in `agents/evidence/WIP-781-WEIGHT-RATING-20261001/`.

Merge requires explicit owner authorization.

### CI on a7856900
13 checks pass, including the full41 Rating UI exercised in the existing browser-worker gate. Three inherited failures remain: CAESAR/FBX startup key expectations and InputXML module/hash contracts. Independent current-main Git blob inspection confirms these inputs already disagree with their old expectations/manifest; no unrelated repair included. Merge is owner-only; deployed owner-profile acceptance remains NOT_RUN.
