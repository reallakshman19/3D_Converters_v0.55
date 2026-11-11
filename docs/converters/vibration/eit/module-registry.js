export const ENERGY_INSTITUTE_EIT_MODULE_REGISTRY_SCHEMA = 'EnergyInstituteEitModuleRegistry.v1';
export const ENERGY_INSTITUTE_EIT_MODULE_REGISTRY_REVISION = 'EIT-V5-CONTROLLED-2026-08-18';

const MODULES = [
  {
    code: 'fit', mechanismId: 'fit', label: 'Flow-Induced Turbulence',
    resultField: 'fit', detailField: 'fit_data', phase: 'SCREEN', scope: 'MAINLINE', specialty: 'FLOW',
    calculationId: 'VIB.FIV.FLOW_TURBULENCE',
  },
  {
    code: 'fip', mechanismId: 'deadlegPulsation', label: 'Deadleg / Flow-Induced Pulsation',
    resultField: 'fip', detailField: 'fip_data', phase: 'SCREEN', scope: 'CROSS_BOUNDARY', specialty: 'PULSATION',
  },
  {
    code: 'mex', mechanismId: 'mechanicalExcitation', label: 'Mechanical Excitation',
    resultField: 'mex', detailField: 'mex_data', phase: 'SCREEN', scope: 'MAINLINE', specialty: 'MECHANICAL',
  },
  {
    code: 'aiv', mechanismId: 'aiv', label: 'Acoustic-Induced Vibration',
    resultField: 'aiv', detailField: 'aiv_data', phase: 'SCREEN', scope: 'MAINLINE', specialty: 'ACOUSTIC',
    calculationId: 'VIB.AIV.ACOUSTIC',
  },
  {
    code: 'sbc', mechanismId: 'smallBoreConnections', label: 'Small-Bore Connections',
    resultField: 'sbc', detailField: 'sbc_data', phase: 'SCREEN', scope: 'BRANCH_ATTACHMENT', specialty: 'BRANCH_INTEGRITY',
  },
  {
    code: 'thw', mechanismId: 'thermowells', label: 'Thermowell / Intrusive Element',
    resultField: 'thw', detailField: 'thw_data', phase: 'SCREEN', scope: 'BRANCH_ATTACHMENT', specialty: 'INTRUSIVE_ELEMENT',
  },
  {
    code: 'tra', mechanismId: 'valveTransients', label: 'Valve Transient / Surge',
    resultField: 'tra', detailField: 'tra_data', phase: 'SCREEN', scope: 'MAINLINE', specialty: 'TRANSIENT',
  },
  {
    code: 'caf', mechanismId: 'cavitationFlashing', label: 'Cavitation / Flashing',
    resultField: 'caf', detailField: 'caf_data', phase: 'SCREEN', scope: 'MAINLINE', specialty: 'PROCESS_INSTABILITY',
  },
];

function freezeEntry(entry) {
  return Object.freeze({ ...entry });
}

export const ENERGY_INSTITUTE_EIT_MODULES = Object.freeze(MODULES.map(freezeEntry));

const BY_CODE = new Map(ENERGY_INSTITUTE_EIT_MODULES.map((entry) => [entry.code, entry]));

export function getEnergyInstituteEitModule(code) {
  return BY_CODE.get(String(code ?? '').trim().toLowerCase()) ?? null;
}

export function listEnergyInstituteEitModules() {
  return ENERGY_INSTITUTE_EIT_MODULES;
}

export function energyInstituteEitModuleFingerprint() {
  return JSON.stringify([
    ENERGY_INSTITUTE_EIT_MODULE_REGISTRY_SCHEMA,
    ENERGY_INSTITUTE_EIT_MODULE_REGISTRY_REVISION,
    ENERGY_INSTITUTE_EIT_MODULES.map((entry) => [entry.code, entry.mechanismId, entry.resultField, entry.detailField]),
  ]);
}
