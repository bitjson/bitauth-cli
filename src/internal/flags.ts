import { flags } from '@oclif/command';

import { logger } from './initialize';

export const jsonFlag = {
  json: flags.boolean({
    description: 'return output in JSON format',
  }),
};

export const parseJsonFlag = (
  maybeJson: string | undefined
):
  | undefined
  | { success: true; parsed: unknown }
  | { success: false; error: SyntaxError } => {
  // eslint-disable-next-line functional/no-let, @typescript-eslint/init-declarations
  let parsed: unknown;
  if (maybeJson === undefined) {
    return undefined;
  }
  // eslint-disable-next-line functional/no-try-statement
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    parsed = JSON.parse(maybeJson);
  } catch (error) {
    return { error: error as SyntaxError, success: false };
  }
  return { parsed, success: true };
};

export const parseJsonFlagOrFail = async <
  FlagObjectType extends { [key: string]: unknown },
  FlagObjectKeyType extends keyof FlagObjectType
>(
  flagObject: FlagObjectType,
  flagKey: FlagObjectKeyType
) => {
  const flagValue = flagObject[flagKey];
  if (flagValue === undefined) {
    return undefined;
  }
  if (typeof flagValue !== 'string') {
    return undefined as never;
  }
  const parseResult = parseJsonFlag(flagValue);
  if (parseResult !== undefined && !parseResult.success) {
    (await logger).fatal(
      `The --${flagKey.toString()} flag contains invalid JSON: ${
        parseResult.error.message
      }`
    );
  }
  return parseResult as FlagObjectType[FlagObjectKeyType] extends
    | string
    | undefined
    ?
        | {
            success: true;
            parsed: unknown;
          }
        | undefined
    : never;
};
