# VS Code Tools

Shows remaining Codex usage limits (for example, **5h 75% · 7d 60%**) on the right side of the VS Code status bar. Hover to see reset times and time left in days, hours, and minutes. Click the status bar item to refresh immediately. Requires the Codex CLI to be installed and signed in with a ChatGPT account. Refreshes limits every 60 seconds by default; change `vscodeTools.refreshIntervalSeconds` in VS Code settings. The countdown updates every minute.

Run `./install.sh` to package the current source and install it into VS Code. Run it again after changes to update the installed extension.
