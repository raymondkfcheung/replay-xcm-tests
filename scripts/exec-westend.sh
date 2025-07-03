#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Define Project Directories ---
THIS_DIR=$(cd $(dirname $0); pwd)

# --- Build the Westend runtimes ---
echo "Building Westend runtime..."
${THIS_DIR}/build-runtime.sh westend true

echo "Building Westend Asset Hub runtime..."
${THIS_DIR}/build-runtime.sh asset-hub-westend true

echo "Building Westend Bridge Hub runtime..."
${THIS_DIR}/build-runtime.sh bridge-hub-westend true

# --- Launch Chopsticks with Westend configs ---
echo "Launching Chopsticks with Westend configs..."
${THIS_DIR}/launch-chopsticks.sh westend westend-asset-hub westend-bridge-hub
