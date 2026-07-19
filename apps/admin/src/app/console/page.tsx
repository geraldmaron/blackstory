/**
 * Presents the administration-console workspace directory.
 */
import { ConsoleOverview } from '../../console/components';
import { tryListConsoleResearchCaseRows } from '../../console/research-case-store';

export default async function AdministrationConsolePage() {
  if (process.env.ADMIN_CONSOLE_USE_FIXTURES === '1') {
    return <ConsoleOverview />;
  }
  const rows = await tryListConsoleResearchCaseRows(100);
  const candidates = rows === null ? null : rows.length;
  return <ConsoleOverview liveCounts={{ candidates }} />;
}
