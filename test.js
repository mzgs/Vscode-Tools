const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { formatLimits, parseGitChanges, getGitChanges } = require('./extension');

const now = 1780000000;
const limits = { rateLimits: {
  primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: now + 5 * 60 },
  secondary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: now + (24 * 60 + 2 * 60 + 3) * 60 },
} };
const display = formatLimits(limits, now * 1000);
assert.equal(display.text, 'Codex 5h 75% · 7d 60%');
assert.match(display.tooltip, /^### Stats\n\n```text\n5h limit:  █{18}░{6}   75% left\nResets \d{1,2}:\d{2} [AP]M · 5m left/);
assert.match(display.tooltip, /\n\n7d limit:  █{14}░{10}   60% left\nResets [A-Z][a-z]{2} \d{1,2} · 1d 2h left\n```$/);
assert.match(formatLimits({ rateLimits: { secondary: { ...limits.rateLimits.secondary, resetsAt: now + (24 * 60 + 3) * 60 } } }, now * 1000).tooltip, /1d left\n/);
assert.match(formatLimits(limits, (now + 5 * 60) * 1000).tooltip, /0m left/);
assert.throws(() => formatLimits({ rateLimits: {} }), /No Codex usage limits/);
assert.deepEqual(parseGitChanges('10\t2\ta.js\n-\t-\timage.png\n3\t0\tb.js\n'), { added: 13, removed: 2 });
assert.match(formatLimits(limits, now * 1000, { added: 13, removed: 2 }).tooltip,
  /### Git Changes\n\n```diff\n\+ 13 added lines\n- 2 removed lines\n```$/);
assert.doesNotMatch(formatLimits(limits, now * 1000, { added: 0, removed: 0 }).tooltip, /Git Changes/);

async function checkGitChanges() {
  const cwd = mkdtempSync(join(tmpdir(), 'vscode-tools-git-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe' });
  const write = (file, content) => writeFileSync(join(cwd, file), content);
  try {
    git('init');
    write('.gitignore', 'ignored.txt\n');
    write('tracked.txt', 'keep\nold\n');
    write('deleted.txt', 'remove\nme\n');
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'Initial');
    assert.deepEqual(await getGitChanges(cwd), { added: 0, removed: 0 });

    write('tracked.txt', 'keep\nstaged\n');
    write('staged.txt', 'staged new\n');
    git('add', '.');
    write('tracked.txt', 'keep\nnew\nextra\n');
    write('staged.txt', 'staged new\nsecond\n');
    unlinkSync(join(cwd, 'deleted.txt'));
    write('new\tfile\n.txt', 'one\ntwo');
    write('binary.bin', Buffer.from([0, 1, 2]));
    write('empty.txt', '');
    write('ignored.txt', 'ignored\n');
    mkdirSync(join(cwd, 'nested'));
    assert.deepEqual(await getGitChanges(join(cwd, 'nested')), { added: 6, removed: 3 });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
checkGitChanges().catch(error => { console.error(error); process.exitCode = 1; });
