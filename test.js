const assert = require('node:assert/strict');
const { formatLimits } = require('./extension');

const now = 1780000000;
const limits = { rateLimits: {
  primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: now + 5 * 60 },
  secondary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: now + (24 * 60 + 2 * 60 + 3) * 60 },
} };
const display = formatLimits(limits, now * 1000);
assert.equal(display.text, 'Codex 5h 75% · 7d 60%');
assert.match(display.tooltip, /^### Stats\n\n```text\n5h limit:  █{18}░{6}   75% left \(resets \d{1,2}:\d{2} [AP]M · 5m left\)/);
assert.match(display.tooltip, /\n7d limit:  █{14}░{10}   60% left \(resets [A-Z][a-z]{2} \d{1,2} · 1d 2h left\)\n```$/);
assert.match(formatLimits({ rateLimits: { secondary: { ...limits.rateLimits.secondary, resetsAt: now + (24 * 60 + 3) * 60 } } }, now * 1000).tooltip, /1d left\)/);
assert.match(formatLimits(limits, (now + 5 * 60) * 1000).tooltip, /0m left/);
assert.throws(() => formatLimits({ rateLimits: {} }), /No Codex usage limits/);
