const VERSION_PATTERN = /^[\w.-]{1,64}$/;

/** The build version shown under the brand name (from APP_VERSION at build
 * time, otherwise "dev"), or null if it isn't a valid version. */
export function buildVersion(version: string = __APP_VERSION__): string | null {
  return VERSION_PATTERN.test(version) ? version : null;
}
