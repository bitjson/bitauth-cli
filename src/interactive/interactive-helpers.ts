import { logger } from '../internal/initialize';

/**
 * End the program, logging only if the error was thrown by a user-issued SIGINT
 * (Ctrl+C).
 *
 * (Currently, Enquirer throws an empty string when cancelled.)
 */
export const handleEnquirerError = async (error: Error | '') =>
  error === ''
    ? // eslint-disable-next-line unicorn/no-process-exit
      process.exit(0)
    : (await logger).fatal('Unexpected Enquirer error %j', error);
