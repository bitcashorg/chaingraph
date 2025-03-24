#!/bin/bash

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Source shared library
source "$(dirname "$0")/backend-lib.sh"

# Stop all services first
print_status "Stopping all services..."
"$(dirname "$0")/supa-stop.sh"

# Reset Supabase
print_status "Resetting Supabase..."
supabase db reset --workdir "$SUPABASE_DIR"

# Start services again
print_status "Starting services..."
"$(dirname "$0")/supa-start.sh"
