import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { relative } from 'node:path';

const summaryFile = process.env.GITHUB_STEP_SUMMARY;
const resultsFile = 'jest-results.json';
const coverageSummaryFile = 'coverage/coverage-summary.json';

const lines = ['## Test Results', ''];

if (!existsSync(resultsFile)) {
  lines.push(
    '⚠️ No `jest-results.json` was produced — the test run likely crashed before Jest could report results.'
  );
  appendFileSync(summaryFile, lines.join('\n') + '\n');
  process.exit(0);
}

const results = JSON.parse(readFileSync(resultsFile, 'utf-8'));
const {
  numTotalTests,
  numPassedTests,
  numFailedTests,
  numPendingTests,
  testResults,
} = results;

lines.push(
  '| Metric | Count |',
  '| --- | --- |',
  `| Total | ${numTotalTests} |`,
  `| ✅ Passed | ${numPassedTests} |`,
  `| ❌ Failed | ${numFailedTests} |`,
  `| ⏭️ Skipped | ${numPendingTests} |`,
  ''
);

if (existsSync(coverageSummaryFile)) {
  const coverage = JSON.parse(readFileSync(coverageSummaryFile, 'utf-8'));
  const { lines: lineCov, statements, functions, branches } = coverage.total;
  lines.push(
    '### Coverage',
    '',
    '| Type | % |',
    '| --- | --- |',
    `| Lines | ${lineCov.pct}% |`,
    `| Statements | ${statements.pct}% |`,
    `| Functions | ${functions.pct}% |`,
    `| Branches | ${branches.pct}% |`,
    ''
  );
}

if (numFailedTests > 0) {
  lines.push('### ❌ Failures', '');

  for (const suite of testResults) {
    const file = relative(process.cwd(), suite.name).replace(/\\/g, '/');

    for (const assertion of suite.assertionResults ?? []) {
      if (assertion.status !== 'failed') continue;

      const title = [...assertion.ancestorTitles, assertion.title].join(' › ');
      const message = (assertion.failureMessages || [])
        .join(' | ')
        .replace(/\r?\n/g, ' ')
        .slice(0, 500);

      lines.push(`- **${title}** (\`${file}\`)`);
      console.log(`::error file=${file}::${title}: ${message}`);
    }
  }

  lines.push('');
}

appendFileSync(summaryFile, lines.join('\n') + '\n');
