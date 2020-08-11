import * as colors from 'ansi-colors';

export { colors };

const jsonPadding = 2;
export const formatJson = (json: unknown) =>
  JSON.stringify(json, null, jsonPadding);

export const toKebabCase = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]/gu, '-');
