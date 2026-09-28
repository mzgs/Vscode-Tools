const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { createInterface } = require('node:readline');
const { delimiter, join } = require('node:path');
const { homedir } = require('node:os');

const execFileAsync = promisify(execFile);

function parseGitChanges(numstat) {
  return numstat.trim().split('\n').reduce((total, line) => {
    const [added, removed] = line.split('\t').map(Number);
    if (Number.isFinite(added)) total.added += added;
    if (Number.isFinite(removed)) total.removed += removed;
    return total;
  }, { added: 0, removed: 0 });
}

async function getGitChanges(cwd) {
  if (!cwd) return;
  const { stdout } = await execFileAsync('git', ['diff', '--numstat', 'HEAD'], { cwd });
  return parseGitChanges(stdout);
}

function formatLimits(result, now = Date.now(), gitChanges) {
  const limits = result.rateLimitsByLimitId?.codex ?? result.rateLimits;
  const windows = [limits?.primary, limits?.secondary].filter(window =>
    window && Number.isFinite(window.usedPercent) && Number.isFinite(window.windowDurationMins) && Number.isFinite(window.resetsAt)
  );
  if (!windows.length) throw new Error('No Codex usage limits available');

  const label = minutes => minutes % 1440 === 0 ? `${minutes / 1440}d`
    : minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
  const remaining = window => Math.max(0, Math.min(100, Math.round(100 - window.usedPercent)));
  const timeLeft = resetsAt => {
    const minutes = Math.max(0, Math.ceil((resetsAt * 1000 - now) / 60000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor(minutes % 1440 / 60);
    return [days && `${days}d`, hours && `${hours}h`, !days && minutes % 60 && `${minutes % 60}m`].filter(Boolean).join(' ') || '0m';
  };
  const labelWidth = Math.max(...windows.map(window => label(window.windowDurationMins).length));
  return {
    text: `Codex ${windows.map(window => `${label(window.windowDurationMins)} ${remaining(window)}%`).join(' · ')}`,
    tooltip: `### Stats\n\n\`\`\`text\n${windows.map(window => {
      const percent = remaining(window);
      const filled = Math.round(percent * 24 / 100);
      const date = new Date(window.resetsAt * 1000);
      const reset = window.windowDurationMins < 1440
        ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${`${label(window.windowDurationMins)} limit:`.padEnd(labelWidth + 8)} ${'█'.repeat(filled)}${'░'.repeat(24 - filled)}  ${`${percent}% left`.padStart(9)} (resets ${reset} · ${timeLeft(window.resetsAt)} left)`;
    }).join('\n')}\n\`\`\`${gitChanges?.added || gitChanges?.removed ? `\n\n### Git Changes\n\n\`\`\`diff\n+ ${gitChanges.added} added lines\n- ${gitChanges.removed} removed lines\n\`\`\`` : ''}`,
  };
}

function activate(context) {
  const vscode = require('vscode');
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
  item.text = 'Codex limits…';
  item.command = 'vscodeTools.refresh';
  item.show();

  let child;
  let latestResult;
  let latestGitChanges;
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
      latestGitChanges = await getGitChanges(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath).catch(() => undefined);
      const display = formatLimits(result, Date.now(), latestGitChanges);
      latestResult = result;
      item.text = display.text;
      item.tooltip = new vscode.MarkdownString(display.tooltip);
    } catch (error) {
      latestResult = undefined;
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
  const countdown = setInterval(() => {
    if (latestResult) item.tooltip = new vscode.MarkdownString(formatLimits(latestResult, Date.now(), latestGitChanges).tooltip);
  }, 60000);
  context.subscriptions.push(item, settings, vscode.commands.registerCommand('vscodeTools.refresh', refresh), { dispose() { clearInterval(interval); clearInterval(countdown); child?.kill(); } });
}

module.exports = { activate, formatLimits, parseGitChanges };
