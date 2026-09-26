const assert = require('node:assert/strict');
const { formatLimits } = require('./extension');

const display = formatLimits({ rateLimits: {
  primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1780000000 },
  secondary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: 1780100000 },
} });
assert.equal(display.text, 'Codex 5h 75% · 7d 60%');
assert.match(display.tooltip, /5h: 75% remaining; resets /);
assert.throws(() => formatLimits({ rateLimits: {} }), /No Codex usage limits/);
