const assert = require('node:assert/strict');
const { formatLimits, parseGitChanges } = require('./extension');

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
