#!/bin/bash

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Source shared library
source "$(dirname "$0")/backend-lib.sh"

# Stop Supabase
stop_supabase

# Stop any running Hasura containers
print_status "Stopping Hasura containers..."
docker ps -q --filter "name=hasura-engine" | xargs -r docker stop

print_status "All services have been stopped."
