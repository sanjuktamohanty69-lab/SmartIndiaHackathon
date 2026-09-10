#!/usr/bin/env bash
set -euo pipefail

npm install-scripts approve better-sqlite3
npm install
(
  cd server
  npm install
)
(
  cd client
  npm install
)
