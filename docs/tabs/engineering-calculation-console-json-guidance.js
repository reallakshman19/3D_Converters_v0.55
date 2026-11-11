const GUIDANCE = Object.freeze({
  'PIPE.B313.MATERIAL_DESIGN': Object.freeze({
    material: Object.freeze({
      help: 'Optional material identity object. Prefer the separate Material ID or Material family fields when they are sufficient.',
      example: Object.freeze({ family: 'DSS' }),
    }),
    factorOverrides: Object.freeze({
      help: 'Optional explicit B31.3 factor overrides. Keys follow the material-factor API: S allowable stress in MPa, and dimensionless E, W, and Y.',
      example: Object.freeze({ S: 170, E: 1, W: 1, Y: 0.4 }),
    }),
  }),
  'PIPE.B313.CH9.RESOLVE_BASIS': Object.freeze({
    basisPackage: Object.freeze({
      help: 'Governed Chapter IX basis-package shape. Replace the empty master arrays with governed rows carrying the required source and qualification custody; this shape alone is not design authority.',
      example: Object.freeze({
        packageVersion: 'b313-ch9-basis-package/v1',
        query: Object.freeze({
          materialId: 'TEST-MAT',
          b313Edition: '2024',
          materialTemperatureC: 150,
          productId: 'TEST-PROD-NPS4',
        }),
        masters: Object.freeze({
          materialAllowable: Object.freeze([]),
          pipeProduct: Object.freeze([]),
          pipeDimension: Object.freeze([]),
          manufacturingTolerance: Object.freeze([]),
          sources: Object.freeze([]),
        }),
      }),
    }),
  }),
  'PIPE.B313.CH9.STRAIGHT_PRESSURE_FROM_BASIS': Object.freeze({
    basisPackage: Object.freeze({
      help: 'Governed Chapter IX basis-package shape. Replace the empty master arrays with governed rows carrying the required source and qualification custody; this shape alone is not design authority.',
      example: Object.freeze({
        packageVersion: 'b313-ch9-basis-package/v1',
        query: Object.freeze({
          materialId: 'TEST-MAT',
          b313Edition: '2024',
          materialTemperatureC: 150,
          productId: 'TEST-PROD-NPS4',
        }),
        masters: Object.freeze({
          materialAllowable: Object.freeze([]),
          pipeProduct: Object.freeze([]),
          pipeDimension: Object.freeze([]),
          manufacturingTolerance: Object.freeze([]),
          sources: Object.freeze([]),
        }),
      }),
    }),
  }),
  'PIPE.B313.CH9.FATIGUE_USER_REVIEW': Object.freeze({
    spectrum: Object.freeze({
      help: 'Transient-spectrum header used by the Chapter IX engineering-review fatigue intake.',
      example: Object.freeze({ spectrumId: 'S1', designLifeYears: 20 }),
    }),
    states: Object.freeze({
      help: 'JSON array of operating-state rows. State IDs referenced by transitions must exist in this array.',
      example: Object.freeze([
        Object.freeze({ spectrumId: 'S1', stateId: 'LOW', pressureMpa: 5, materialTemperatureC: 40, structuralTemperatureC: 40 }),
        Object.freeze({ spectrumId: 'S1', stateId: 'HIGH', pressureMpa: 30, materialTemperatureC: 40, structuralTemperatureC: 40 }),
      ]),
    }),
    transitions: Object.freeze({
      help: 'JSON array of pressure-cycle transitions linking declared operating states.',
      example: Object.freeze([
        Object.freeze({ spectrumId: 'S1', cycleId: 'C1', fromStateId: 'LOW', toStateId: 'HIGH', totalCycles: 10000, category: 'PROCESS_CYCLE' }),
      ]),
    }),
    externalResults: Object.freeze({
      help: 'Engineering-review Seq/N rows. Provenance/checker custody may be advisory in this review route, but numerical inputs still fail closed when invalid.',
      example: Object.freeze([
        Object.freeze({
          cycleId: 'C1',
          locationId: 'BORE_INNER_SURFACE',
          fromStateId: 'LOW',
          toStateId: 'HIGH',
          userAlternatingStressIntensityMpa: 87.91596640349115,
          equivalentAlternatingStressMpa: 95,
          permissibleCycles: 20000,
        }),
      ]),
    }),
  }),
  'PIPE.B313.CH9.FATIGUE_USER_CALCULATED': Object.freeze({
    spectrum: Object.freeze({
      help: 'Governed transient-spectrum header for the formal USER_CALCULATED_KD3 intake.',
      example: Object.freeze({ spectrumId: 'S1', designLifeYears: 20 }),
    }),
    states: Object.freeze({
      help: 'JSON array of governed operating-state rows. State IDs referenced by transitions must exist in this array.',
      example: Object.freeze([
        Object.freeze({ spectrumId: 'S1', stateId: 'LOW', pressureMpa: 5, materialTemperatureC: 40, structuralTemperatureC: 40 }),
        Object.freeze({ spectrumId: 'S1', stateId: 'HIGH', pressureMpa: 30, materialTemperatureC: 40, structuralTemperatureC: 40 }),
      ]),
    }),
    transitions: Object.freeze({
      help: 'JSON array of governed pressure-cycle transitions linking declared operating states.',
      example: Object.freeze([
        Object.freeze({ spectrumId: 'S1', cycleId: 'C1', fromStateId: 'LOW', toStateId: 'HIGH', totalCycles: 10000, category: 'PROCESS_CYCLE' }),
      ]),
    }),
    externalResults: Object.freeze({
      help: 'Formal external KD-3 Seq/N rows. Each row requires controlled calculation-basis evidence with distinct calculatedBy and checkedBy identities.',
      example: Object.freeze([
        Object.freeze({
          cycleId: 'C1',
          locationId: 'BORE_INNER_SURFACE',
          fromStateId: 'LOW',
          toStateId: 'HIGH',
          userAlternatingStressIntensityMpa: 87.91596640349115,
          equivalentAlternatingStressMpa: 95,
          permissibleCycles: 20000,
          calculationBasis: Object.freeze({
            code: 'ASME BPVC VIII-3',
            edition: '2025',
            methodRef: 'KD-3 external calculation',
            calculationRef: 'HP-FAT-EXT-001',
            calculatedBy: 'ENGINEER_A',
            checkedBy: 'ENGINEER_B',
            checkedAt: '2026-08-16T04:30:00Z',
          }),
        }),
      ]),
    }),
  }),
});

export function isEngineeringConsoleAggregateField(field) {
  return ['object', 'array', 'table'].includes(field?.type);
}

export function usesGenericEngineeringConsoleInputSurface(definition) {
  const surface = definition?.ui?.productSurface;
  return !surface || surface === 'ENGINEERING_CALCULATIONS';
}

export function getEngineeringConsoleJsonGuidance(definition, field) {
  if (!definition?.id || !field?.key) return null;
  return GUIDANCE[definition.id]?.[field.key] ?? null;
}

export function engineeringConsoleJsonExampleText(definition, field) {
  const guidance = getEngineeringConsoleJsonGuidance(definition, field);
  if (!guidance || guidance.example === undefined) return '';
  try {
    return JSON.stringify(guidance.example, null, 2);
  } catch {
    return '';
  }
}
