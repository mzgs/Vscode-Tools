const vscode = require('vscode');

function activate(context) {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.text = 'Hello';
  item.show();
  context.subscriptions.push(item);
}

module.exports = { activate };
