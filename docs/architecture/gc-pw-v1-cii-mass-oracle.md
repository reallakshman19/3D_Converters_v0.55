# GC-PW I03 — held-out CII RIGID mass and review decisions

**Status:** Independent, standalone qualification harness, NOT product integration. Authority: #1019 / #927 / #999; X003/X004 in docs/Overall_roadmap.md; original owner issue #781. Built from source review of \`converters/scripts/xml_to_cii2019.py:1329-1354,1703-1783,1821-1826\` on main@1188e44e3dd0d48b119c8098d36738799c537653. Protocol Common V3.2.

## What is independently observed

The converter's CII format has \`#$ CONTROL\`, four payload lines, with the number of \`#$ RIGID\` rows in the **second numeric field of control line 2**. Each RIGID row contains weight in its first field and a second numeric placeholder. A CII writer example scales source kilograms by an explicit \`--weight-scale 10\` compatibility setting; the normal command default is 1. Output writer uses ~6 significant digits. This oracle independently parses those sections (it never imports the application's converter). **It does not infer physical force units from a naked number.**

The verifier additionally requires:
1. Actual source XML files whose bytes match independently declared SHA256 and whose original source-local branch/node ordinal exists, verified using the separate merged #1008 source oracle.
2. All three stage snapshot *files*: \`preview\`, \`RigidMatch1\`, \`Rigidmatch2\`, SHA-bound independently to declared InputBasis; decision payloads must be stage-specific, source/physical-component scoped and cannot silently treat a proposed candidate as accepted.
3. A separately prepared **physical-component allocation ledger**, not generated from the final CII. Every group must declare original source occurrence, physical group ID, explicit final action, accepted mass kg and child allocations to exact CII RIGID record positions. The full \`RIGID\` record list must be accounted for or explicitly documented as zero-mass/noncomponent edges.
4. A byte-level CII SHA-256 that binds the actual tested output; the oracle checks selected mass, sum allocated child mass and actual output numeric values after exactly one declared scale. The default compatibility scale may **never silently toggle**. \`legacy-kgx10-N\` means explicit x10; \`legacy-unscaled-N\` is the historical x1 compatibility run option while the CII still labels N. Neither implies physical kg→N conversion at x1; the oracle also requires the actual CII \`UNITS\` section to contain \`N.\`.
5. Every false-completeness path fails (wrong source, wrong snapshot hash, an accepted review decision for an unlisted physical component, same NodeNumber alias, duplicate child RIGID ownership, missing/extra RIGID rows, incorrect CONTROL counts, changed CII, proposed-as-final, no final decision, nonconserved allocation and x100 scaling).

## CLI

    python3 scripts/gc-pw-v1-cii-mass-oracle.py \
      --ledger /path/to/independent-ledger.json \
      --cii /path/to/actually-emitted-output.cii \
      --sources /path/to/original-source-xml-directory \
      --evidence /path/to/frozen-snapshot-files

The ledger format \`gc-pw-cii-mass-oracle/v1\` is a **challenge manifest** separate from GC-PW/1.0 runtime application schemas. Domain adapters must emit the exact expected facts and independently attest them; no silent schema negotiation. Use all three evidence stages with exact case-sensitive names: \`preview\`, \`RigidMatch1\`, \`Rigidmatch2\`. Accepted actions are \`preserve-source\`, \`accept-match1\`, \`final-override\`; Match-1 decision must be \`accept\`; Match-2 decision must be \`keep-source\`, \`confirm-match1\` or \`override\`. \`candidateWeightKg\` and \`proposedWeightKg\` are information only and cannot become final without an actual decision.

The CLI prints \`MASS_LEDGER_VERIFIED\` only for the files provided; it cannot establish the independence of the ledger *author* unless the evidence source is independently controlled. A manifest synthesized by reading CII output back into itself is invalid evidence of engineering authority.

### Retained benchmark acceptance

The source roadmap X003 describes node 478→480, selected **120.73401kg** against a **15kg proposal**, and original output convention 1207.3401 (scale 10). The standalone synthetic fixture uses a CII-style six-significant-digit formatted \`1207.34\`; the oracle permits the *format's known rounding precision*, not an engineering tolerance drift. A split fixture allocates 60 + 60.73401kg to two separate RIGID rows; copying the entire 120.73401kg to both children is rejected as mass duplication.

This uses a **synthetic fixture preserving the numeric relationship**; no claim that actual owner Rigid 480 CII was re-executed.

## Run tests and provenance

    python3 tests/gc-pw-v1-cii-mass-oracle.test.py

No application engine imported. New synthetic tests verify positive mass/review cases and deliberate stale/collision/conflict cases. Hosted CI runs synthetic only, with no private Owner sources. Real owner acceptance additionally requires actual source files, frozen phase evidence and emitted CII supplied independently. A passing unit-level oracle therefore does NOT close the historical 356 Mode B parity errors, Material Code/B31.3, Preview hang, UI Weight accuracy, or full J06. Those remain #927/#998/#1000/#1001.

### Reviewer challenge / limitations

- An XML Source node may legitimately generate multiple child RIGID rows; require each allocated to a physical component group with source occurrence, not an unexplained same-number match.
- CII first RIGID numeric field is assessed relative to this converter's declared scale; mass-to-force physical \`g=9.81\` should NOT be silently asserted. The existing compatibility \`kg×10\` policy is held as an explicit user-visible selected run option.
- This oracle checks RIGID mass/authority and scope but does not prove independently which particular source component caused each CII RIGID slot. That external source→child mapping must be challenged by the later J06 domain oracle. It cannot detect an intentionally fraudulent but self-consistent mapping absent independent geometric/provenance evidence.
- The source and three evidence files must be real and immutable, not invented for a product release report. This checker does not mutate inputs or accepted engineering values.
