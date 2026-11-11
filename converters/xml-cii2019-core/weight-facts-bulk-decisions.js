// Explicit-click Match-1 bulk command planner: full source facts, never a DOM row subset.
// This port consumes the portable GC-PW service and does not write decisions by itself.
const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
function pages(load) {
  const all = []; let cursor = null; let count = null;
  do {
    const page = load(cursor);
    if (!page || page.complete !== true || !Array.isArray(page.items)) {
      throw new Error('Incomplete or failed Weight facts/proposal page; bulk acceptance blocked');
    }
    if (count === null) count = page.totalCount;
    if (page.totalCount !== count || page.nextCursor === cursor && cursor !== null) {
      throw new Error('Changing or looping Weight page; bulk acceptance blocked');
    }
    all.push(...page.items); cursor = page.nextCursor;
  } while (cursor);
  if (all.length !== count) throw new Error('Truncated Weight page population; bulk acceptance blocked');
  return all;
}
export function planExactSourceWeightCommands(service, { basisId, scopeId, pageSize = 200 } = {}) {
  const stage = 'RigidMatch1';
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new RangeError('Invalid pageSize');
  const existing = service.getDecisionState({basisId, scopeId, stage});
  const facts = pages(cursor => service.getFacts({
    basisId, sourceId: scopeId, subjectType: 'physical-component', cursor, limit: pageSize,
  }));
  const physical = new Map();
  for (const fact of facts) {
    if (!physical.has(fact.occurrenceId)) physical.set(fact.occurrenceId, { source: false });
    if (fact.fieldId === 'mass.kg' && ['source', 'manual'].includes(fact.authority) && positive(fact.value)) {
      physical.get(fact.occurrenceId).source = true;
    }
  }
  const eligible = [...physical.keys()].filter(id =>
    !physical.get(id).source && !existing.decisions[id]);
  const commands = []; let unresolved = 0;
  // Disjoint full-source exclusion categories; lowerRankQualified is a subset
  // of topRankUnqualified and is for diagnosis only, never auto-approval.
  const exclusions = {
    sourceMassPresent: [...physical.values()].filter(x => x.source).length,
    match1DecisionPresent: Object.keys(existing.decisions).filter(id =>
      physical.has(id) && !physical.get(id).source).length,
    noRank1Proposal: 0, topRankUnqualified: 0,
    topRankInvalidMass: 0, topRankInvalidUnit: 0,
    lowerRankQualified: 0,
  };
  // 80 physical occurrences × 5 legacy candidates ≤ one 500-item service page.
  // Still walk all continuation pages if another domain returns more.
  for (let offset = 0; offset < eligible.length; offset += 80) {
    const ids = eligible.slice(offset, offset + 80);
    const proposals = pages(cursor => service.getProposals({
      basisId, occurrenceIds: ids, cursor, limit: 500,
    }));
    const best = new Map(), byOccurrence = new Map();
    for (const proposal of proposals) {
      if (!byOccurrence.has(proposal.occurrenceId)) byOccurrence.set(proposal.occurrenceId, []);
      byOccurrence.get(proposal.occurrenceId).push(proposal);
      if (proposal.ranking === 1 && !best.has(proposal.occurrenceId)) {
        best.set(proposal.occurrenceId, proposal);
      }
    }
    for (const id of ids) {
      const candidate = best.get(id);
      if (!candidate) { exclusions.noRank1Proposal++; unresolved++; continue; }
      if (!candidate.qualified) {
        exclusions.topRankUnqualified++;
        if ((byOccurrence.get(id) || []).some(p =>
          p.ranking !== 1 && p.qualified === true && positive(p.value) && p.unit === 'kg'))
          exclusions.lowerRankQualified++;
        unresolved++; continue;
      }
      if (!positive(candidate.value)) { exclusions.topRankInvalidMass++; unresolved++; continue; }
      if (candidate.unit !== 'kg') { exclusions.topRankInvalidUnit++; unresolved++; continue; }
      commands.push({
        commandId: JSON.stringify(['bulk-direct-exact', basisId, scopeId, id, candidate.proposalId]),
        basisId, scopeId, occurrenceId: id, expectedDecisionRevision: existing.decisionRevision,
        action: 'accept-proposal', proposalId: candidate.proposalId,
      });
    }
  }
  return {
    basisId, scopeId, stage, expectedDecisionRevision: existing.decisionRevision,
    physicalCount: physical.size,
    alreadyReviewed: physical.size - eligible.length - [...physical.values()].filter(x => x.source).length,
    preservedSourceWeights: exclusions.sourceMassPresent,
    exclusions: Object.freeze(exclusions),
    unresolved, qualified: commands.length, commands,
  };
}
export function commitExactSourceWeightCommands(service, plan) {
  if (!plan || plan.stage !== 'RigidMatch1' || !Array.isArray(plan.commands)) {
    throw new Error('Explicit Match-1 source bulk plan required');
  }
  if (!plan.commands.length) return [];
  return service.applyDecisions({
    basisId: plan.basisId, scopeId: plan.scopeId, stage: plan.stage,
    expectedDecisionRevision: plan.expectedDecisionRevision,
    commands: plan.commands,
  });
}
