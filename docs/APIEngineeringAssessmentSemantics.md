# Engineering Calculation Assessment Semantics

**Status:** implementation semantics clarification  
**Applies to:** current Engineering Calculation API result envelopes, adapters, console/report consumers, and future calculator migrations  
**Authority:** architecture and interface guidance only; this document is not numerical qualification evidence, Code compliance, design approval, or a replacement for `docs/APIEngineeringCalcContracts.md`.

## Purpose

Engineering calculation execution, engineering decision, domain disposition, and authority are separate concerns. Current implementations shall keep those concerns explicit so a successful software execution cannot be mistaken for an engineering PASS and a benchmark/reference result cannot be mistaken for design authority.

This note documents the current result-envelope convention introduced after the frozen v1 contract. It does not change the frozen contract version or remove legacy compatibility fields.

## Canonical assessment decision axis

`assessment.outcome` is the canonical top-level engineering decision presented to API consumers and UI/report surfaces.

Allowed values are:

```text
PASS
FAIL
NOT_ASSESSED
INDETERMINATE
```

The meanings are:

| Outcome | Meaning |
|---|---|
| `PASS` | An explicit acceptance/screening/reference criterion was evaluated within the declared authority scope and was satisfied. |
| `FAIL` | An explicit acceptance/screening/reference criterion was evaluated within the declared authority scope and was not satisfied. |
| `NOT_ASSESSED` | Numerical or workflow execution completed, but the result does not contain one qualified top-level acceptance decision. |
| `INDETERMINATE` | An assessment was intended but the available evaluated state cannot support PASS or FAIL. |

`ok: true` means the calculation software completed successfully. It does **not** mean `assessment.outcome === 'PASS'`.

## Domain disposition

`assessment.disposition` carries calculator-specific or workflow-specific meaning. It is intentionally not restricted to the canonical outcome vocabulary.

Examples include:

```text
REFERENCE_RELATIONSHIP_EXCEEDED
REFERENCE_STRESS_NOT_EXCEEDED
TRACE_ONLY
SOURCE_PENDING
CALCULATED_REVIEW
ENGINEERING_REVIEW_WITHIN_UNITY
REFERENCE_BELOW_THRESHOLD
ASSESSMENT_SCREENING
```

A disposition may contain words such as `PASS`, `FAIL`, `BELOW_THRESHOLD`, or `WITHIN_UNITY` without automatically defining the canonical outcome. The producer must declare the top-level decision explicitly when a qualified criterion supports one.

## Legacy `assessment.status`

`assessment.status` is retained for backward compatibility with existing domain and integration consumers. It may contain either canonical values or historical/domain-specific values.

New UI/report logic shall not use `assessment.status` as the canonical decision axis. New or materially modified adapters should emit `assessment.outcome` and `assessment.disposition` explicitly. The central result normalizer remains a compatibility fallback for legacy producers.

Removal or semantic repurposing of `assessment.status` requires a versioned compatibility plan; it is not part of the current migration.

## Authority is orthogonal

Assessment outcome and engineering authority are independent dimensions. A `PASS` can still be benchmark-only, screening-only, review-only, or otherwise non-design-authoritative.

Consumers must evaluate authority separately from outcome using the applicable qualification and authority fields, including as available:

```text
qualification.effective
qualification.designAuthority
assessment.designAuthority
assessment.codeCompliance
definition.authority.codeCompliance
assessment.governingEligible
```

Examples:

- UG-44 benchmark relationship satisfied: `outcome = PASS`, authority `BENCHMARK_ONLY`, `designAuthority = false`.
- FIT bounded screening below threshold: `outcome = PASS`, effective authority `SCREENING`, `designAuthority = false`.
- B31.3 engineering-review static check within the review criterion: `outcome = PASS`, review-only authority, not Code/design authority.

Therefore:

```text
PASS != design authority
PASS != Code compliance
PASS != governing eligibility
COMPLETED != PASS
```

## Producer rules

Adapters and assessment layers should follow these rules:

1. If there is no top-level acceptance rule, emit `outcome: 'NOT_ASSESSED'` or return `assessment: null` when there is no assessment metadata at all.
2. Emit `PASS` or `FAIL` only when an explicit criterion is evaluated within a declared authority scope.
3. Emit `INDETERMINATE` when a decision was intended but evaluated information is insufficient, conflicting, or unresolved.
4. Keep workflow, trace, resolver, and domain state in `disposition` or other named fields; do not promote those states to PASS/FAIL by string matching.
5. Preserve authority boundaries. Adding `outcome` must not promote qualification, Code compliance, governing eligibility, or design authority.
6. Preserve legacy `status` when compatibility requires it, but do not require consumers to infer the canonical outcome from that status.
7. Prefer explicit producer semantics over relying on the central compatibility normalizer.

## Consumer rules

Console, report, export, and batch consumers should present the dimensions separately:

```text
Execution:   COMPLETED | FAILED | NOT RUN
Assessment:  PASS | FAIL | NOT_ASSESSED | INDETERMINATE
Disposition: calculator/domain-specific text
Authority:   effective qualification / screening / benchmark / review scope
```

Decision badges and success/failure color semantics must use the canonical assessment outcome, not `ok`, not execution status, and not arbitrary domain status strings.

A large result container should not become implicitly successful merely because execution completed. When announcing results accessibly, prefer a concise message such as:

```text
Calculation completed. Assessment failed. Authority benchmark only.
```

## Representative cases

### UG-44 benchmark relationship exceeded

```js
assessment: {
  status: 'FAIL',
  outcome: 'FAIL',
  disposition: 'REFERENCE_RELATIONSHIP_EXCEEDED',
  governingEligible: false,
  designAuthority: false,
  codeCompliance: false,
}
```

The failed relationship is explicit, but it remains benchmark-only and non-design-authoritative.

### FIT benchmark execution below the reference threshold

```text
execution      = COMPLETED
outcome        = NOT_ASSESSED
disposition    = REFERENCE_BELOW_THRESHOLD
authority      = BENCHMARK_ONLY
designAuthority = false
```

The benchmark result is evidence/reference information, not an authorized screening decision.

### FIT bounded screening below the threshold

```text
execution      = COMPLETED
outcome        = PASS
disposition    = REFERENCE_BELOW_THRESHOLD
authority      = SCREENING
designAuthority = false
```

The same numerical relationship has a screening decision only because the execution mode and qualification scope authorize that assessment.

### AIV assessment-level screening result set

```text
execution      = COMPLETED
outcome        = NOT_ASSESSED
disposition    = ASSESSMENT_SCREENING
```

The adapter returns multiple assessment-level screening results and deliberately does not invent one aggregate line/case PASS/FAIL. Assessment-level authority remains available in the domain results.

### Chapter IX trace/resolver arithmetic

```text
execution      = COMPLETED
outcome        = NOT_ASSESSED
disposition    = TRACE_ONLY | SOURCE_PENDING | other resolver state
```

A traceable calculation or resolver state is not an engineering acceptance decision.

## Compatibility boundary

The central engine currently normalizes legacy assessment fragments so all public result envelopes can expose a canonical outcome. That normalization is a safety net, not permission for new adapters to overload `status`.

When modifying an existing adapter, prefer this structure:

```js
assessment: {
  status: legacyStatus,          // compatibility where needed
  outcome: 'PASS',               // canonical decision axis
  disposition: domainDisposition,
  // authority fields remain explicit and independent
}
```

For calculation-only or trace-only results:

```js
assessment: {
  outcome: 'NOT_ASSESSED',
  disposition: 'TRACE_ONLY',
  // authority fields remain explicit and independent
}
```

## Review checklist

A PR that adds or changes an engineering assessment should be reviewed for all of the following:

- execution success cannot be mistaken for assessment success;
- PASS/FAIL has an explicit named criterion and authority scope;
- `NOT_ASSESSED` is used instead of inventing a generic success state;
- domain/workflow wording is preserved as disposition rather than overloaded decision status;
- design authority and Code compliance remain separate from outcome;
- UI/report consumers use canonical outcome for decision semantics;
- audit/export output retains outcome, disposition, qualification, provenance, and legacy compatibility fields where applicable.
