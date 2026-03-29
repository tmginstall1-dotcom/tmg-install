#!/bin/bash
set -e

# Apply schema changes non-interactively (sends empty to answer prompts with default)
echo "" | npm run db:push 2>&1 || true
