/* The build version: shown under the brand name, and the name of the
 * service worker's shell cache. The Docker build sets APP_VERSION
 * (v<year>.<month>.<day>-build<HHMMSS>); any other build is "dev". */

export const VERSION_PATTERN = /^[\w.-]{1,64}$/;

export function appVersion(env: NodeJS.ProcessEnv = process.env): string {
  const version = env.APP_VERSION || "dev";
  if (!VERSION_PATTERN.test(version)) throw new Error(`Invalid APP_VERSION: ${JSON.stringify(version)}`);
  return version;
}
