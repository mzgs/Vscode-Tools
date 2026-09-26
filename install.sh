#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
npm ci --cache .npm
npm run package
code --install-extension vscode-tools.vsix --force
