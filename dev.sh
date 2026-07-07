#!/bin/bash
# Sprout — local dev launcher
# Usage: ./dev.sh
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🌱 Sprout — starting dev environment${NC}"

# 1. Check dependencies
command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js not found. Install from nodejs.org${NC}"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo -e "${YELLOW}⚠ pnpm not found — installing...${NC}"; npm install -g pnpm; }

# 2. Start MySQL via Docker if not already running
if command -v docker >/dev/null 2>&1; then
  if ! docker compose ps db 2>/dev/null | grep -q "running"; then
    echo -e "${YELLOW}🐳 Starting MySQL via Docker (host port 3307)...${NC}"
    # Remove any stale container from a previous failed start (e.g. old port conflict)
    docker compose rm -f db >/dev/null 2>&1 || true
    docker compose up -d db
    echo -n "   Waiting for MySQL to be ready"
    until docker compose exec db mysqladmin ping -h localhost -uroot -pchildflow --silent 2>/dev/null; do
      echo -n "."
      sleep 2
    done
    echo -e " ${GREEN}ready!${NC}"
  else
    echo -e "${GREEN}✓ MySQL already running${NC}"
  fi
else
  # Fall back to checking if mysql is already running on the host (port 3307 per .env)
  if ! mysql -u root -pchildflow -h 127.0.0.1 -P 3307 -e "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${RED}❌ MySQL not reachable. Install Docker (recommended) or MySQL:${NC}"
    echo "   Docker:  https://docs.docker.com/get-docker/"
    echo "   Homebrew: brew install mysql && brew services start mysql"
    echo ""
    echo "   Then create the DB and user:"
    echo "   mysql -u root -e \"CREATE DATABASE IF NOT EXISTS childflow;\""
    echo "   mysql -u root -e \"ALTER USER 'root'@'localhost' IDENTIFIED BY 'childflow';\""
    exit 1
  fi
fi

# 3. Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 Installing dependencies...${NC}"
  pnpm install
fi

# 4. Push DB schema (safe — drizzle-kit only adds missing tables/columns)
echo -e "${YELLOW}🗄  Syncing database schema...${NC}"
pnpm run db:push

# 5. Start the dev server
echo -e "${GREEN}🚀 Starting Sprout at http://localhost:3000${NC}"
echo -e "   Login: any email works with ALLOW_DEV_AUTH_BYPASS=true"
echo ""
pnpm run dev
