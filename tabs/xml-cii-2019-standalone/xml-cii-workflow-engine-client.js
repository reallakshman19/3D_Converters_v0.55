const CLIENT_URL = new URL('../../converters/xml-cii-2019-standalone/engine-worker-client.mjs?v=20261031-native-run-debug-2', import.meta.url);

export async function runXmlCii2019StandaloneEngineJob(job, runtime = {}) {
  if (typeof runtime.engineRunner === 'function') return runtime.engineRunner(job);
  const client = await import(CLIENT_URL.href);
  return client.runStandaloneEngineWorkerJob(job, runtime);
}
