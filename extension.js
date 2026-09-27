const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { delimiter, join } = require('node:path');
const { homedir } = require('node:os');

function formatLimits(result) {
  const limits = result.rateLimitsByLimitId?.codex ?? result.rateLimits;
  const windows = [limits?.primary, limits?.secondary].filter(window =>
    window && Number.isFinite(window.usedPercent) && Number.isFinite(window.windowDurationMins)
  );
  if (!windows.length) throw new Error('No Codex usage limits available');

  const label = minutes => minutes % 1440 === 0 ? `${minutes / 1440}d`
    : minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
  const remaining = window => Math.max(0, Math.min(100, Math.round(100 - window.usedPercent)));
  const labelWidth = Math.max(...windows.map(window => label(window.windowDurationMins).length));
  return {
    text: `Codex ${windows.map(window => `${label(window.windowDurationMins)} ${remaining(window)}%`).join(' · ')}`,
    tooltip: `\`\`\`text\n${windows.map(window => {
      const percent = remaining(window);
      const filled = Math.round(percent * 24 / 100);
      const date = new Date(window.resetsAt * 1000);
      const reset = window.windowDurationMins < 1440
        ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${`${label(window.windowDurationMins)} limit:`.padEnd(labelWidth + 8)} ${'█'.repeat(filled)}${'░'.repeat(24 - filled)}  ${`${percent}% left`.padStart(9)} (resets ${reset})`;
    }).join('\n')}\n\`\`\``,
  };
}

function activate(context) {
  const vscode = require('vscode');
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
  item.text = 'Codex limits…';
  item.command = 'vscodeTools.refresh';
  item.show();

  let child;
  async function refresh() {
    if (child) return;
    try {
      const result = await new Promise((resolve, reject) => {
        child = spawn('codex', ['app-server'], {
          env: { ...process.env, PATH: [join(homedir(), '.bun/bin'), join(homedir(), '.local/bin'), process.env.PATH].filter(Boolean).join(delimiter) },
          stdio: ['pipe', 'pipe', 'ignore'],
        });
        const proc = child;
        const lines = createInterface({ input: proc.stdout });
        const timer = setTimeout(() => finish(new Error('Codex timed out')), 30000);
        let done = false;
        function finish(error, value) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          lines.close();
          proc.kill();
          child = undefined;
          if (error) reject(error); else resolve(value);
        }
        const send = message => proc.stdin.write(JSON.stringify(message) + '\n');
        proc.on('error', finish);
        proc.on('exit', () => finish(new Error('Codex app-server exited')));
        proc.stdin.on('error', finish);
        lines.on('line', line => {
          try {
            const message = JSON.parse(line);
            if (message.id === 0) {
              if (message.error) throw new Error(message.error.message);
              send({ method: 'account/rateLimits/read', id: 1 });
            } else if (message.id === 1) {
              if (message.error) throw new Error(message.error.message);
              finish(null, message.result);
            }
          } catch (error) { finish(error); }
        });
        proc.on('spawn', () => {
          send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'vscode_tools', title: 'VS Code Tools', version: '0.0.1' } } });
          send({ method: 'initialized', params: {} });
        });
      });
      const display = formatLimits(result);
      item.text = display.text;
      item.tooltip = new vscode.MarkdownString(display.tooltip);
    } catch (error) {
      item.text = 'Codex limits unavailable';
      item.tooltip = error.message;
    }
  }

  refresh();
  let interval;
  function scheduleRefresh() {
    clearInterval(interval);
    const seconds = vscode.workspace.getConfiguration('vscodeTools').get('refreshIntervalSeconds', 60);
    interval = setInterval(refresh, Math.max(1, seconds) * 1000);
  }
  scheduleRefresh();
  const settings = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('vscodeTools.refreshIntervalSeconds')) scheduleRefresh();
  });
  context.subscriptions.push(item, settings, vscode.commands.registerCommand('vscodeTools.refresh', refresh), { dispose() { clearInterval(interval); child?.kill(); } });
}

module.exports = { activate, formatLimits };
