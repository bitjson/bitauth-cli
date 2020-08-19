import { sortObjectKeys, utf8ToBin } from '@bitauth/libauth';
import * as colors from 'ansi-colors';

export { colors };

const jsonPadding = 2;
/**
 * Format a JSON value for output.
 * @param json - the value to serialize
 */
export const formatJsonUnsorted = (json: unknown) =>
  JSON.stringify(json, null, jsonPadding);

/**
 * Canonically sort and format a JSON value for output.
 * @param json - the value to serialize
 */
export const formatJson = (json: unknown) =>
  formatJsonUnsorted(sortObjectKeys(json, true));

/**
 * Canonically sort and serialize a JSON value to produce a preimage for
 * signing.
 * @param json - the value to serialize
 */
export const serializeJsonForSigning = (json: unknown) =>
  utf8ToBin(JSON.stringify(sortObjectKeys(json, true), null, 0));

/**
 * Covert any string to `kebab-case`,the recommended format for all types of
 * aliases.
 * @param text - the string to convert
 */
export const toKebabCase = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]/gu, '-');

/**
 * Escape a string for use in a bash command.
 * @param bashString - the string to escape
 */
export const bashEscapeSingleQuote = (bashString: string) =>
  bashString.replace(/\\/gu, '\\').replace(/'/gu, "'\\''");
