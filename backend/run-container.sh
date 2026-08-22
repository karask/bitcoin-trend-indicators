#!/bin/sh
set -eu
npm start &
web_pid=$!
trap 'kill "$web_pid"' EXIT INT TERM
python3 -m uvicorn backend.bitcoin_regime.api:app --host 0.0.0.0 --port 8000
