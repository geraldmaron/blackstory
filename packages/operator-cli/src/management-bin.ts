#!/usr/bin/env node
/** Authenticated client of the work service; it never publishes directly from the laptop. */
import { readFileSync } from 'node:fs';
import { remoteManagementClient } from '@repo/ops-data/management/client';

const [operation, id, inputFile] = process.argv.slice(2);
const usage =
  'blackstory-work list | get <work-id> | submit <request.json> | decide <work-id> <decision.json> | retry <work-id>. Use - to read JSON from stdin. Credentials: BLACKSTORY_ACCESS_TOKEN and BLACKSTORY_MANAGEMENT_URL.';
try {
  if (operation === '--help') console.log(usage);
  else {
    if (!['list', 'get', 'submit', 'decide', 'retry'].includes(operation ?? ''))
      throw new Error(usage);
    if (['get', 'decide', 'retry'].includes(operation!) && !/^[a-f0-9-]{36}$/u.test(id ?? ''))
      throw new Error('A work UUID is required');
    const client = remoteManagementClient(
      process.env.BLACKSTORY_MANAGEMENT_URL ?? 'https://blackstory.app',
      async () => {
        const token = process.env.BLACKSTORY_ACCESS_TOKEN;
        if (!token) throw new Error('A current account access token is required');
        return token;
      },
    );
    const input = (file: string | undefined) => {
      if (!file) throw new Error('A JSON file or - is required');
      return JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8')) as unknown;
    };
    const result =
      operation === 'list'
        ? await client('')
        : operation === 'get'
          ? await client(`/${id}`)
          : operation === 'submit'
            ? await client('', input(id))
            : operation === 'decide'
              ? await client(`/${id}/decisions`, input(inputFile))
              : await client(`/${id}/retry`, {});
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Work operation failed');
  process.exitCode = 1;
}
