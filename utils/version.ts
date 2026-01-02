/**
 * Application version - automatically injected from package.json at build time
 * To update the version, simply update the "version" field in package.json
 */
export const APP_VERSION = (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0') as string;
