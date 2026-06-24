#!/usr/bin/env bash
# Chainova WMS demo launcher
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "Creating virtualenv..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet fastapi "uvicorn[standard]" jinja2 numpy

echo "Seeding demo database..."
python init_data.py

echo ""
echo "============================================"
echo "  Chainova WMS  →  http://localhost:8800"
echo "============================================"
echo ""
( sleep 2 && (open http://localhost:8800 2>/dev/null || true) ) &
exec uvicorn app.main:app --host 0.0.0.0 --port 8800
