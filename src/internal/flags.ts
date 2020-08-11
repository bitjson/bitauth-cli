import { flags } from '@oclif/command';

export const jsonFlag = {
  json: flags.boolean({
    description: 'return output in JSON format',
  }),
};
