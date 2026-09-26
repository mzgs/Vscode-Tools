const assert = require('node:assert/strict');
const { formatLimits } = require('./extension');

const now = 1780000000;
const limits = { rateLimits: {
  primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: now + 5 * 60 },
  secondary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: now + (24 * 60 + 2 * 60 + 3) * 60 },
} };
const display = formatLimits(limits, now * 1000);
assert.equal(display.text, 'Codex 5h 75% · 7d 60%');
assert.match(display.tooltip, /5h: 75% remaining; resets in 5m \(/);
assert.match(display.tooltip, /7d: 60% remaining; resets in 1d 2h 3m \(/);
assert.match(formatLimits(limits, (now + 5 * 60) * 1000).tooltip, /resets in 0m \(/);
assert.throws(() => formatLimits({ rateLimits: {} }), /No Codex usage limits/);
