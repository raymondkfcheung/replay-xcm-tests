#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Define Project Directories ---
THIS_DIR=$(cd $(dirname $0); pwd)

# --- Parse Arguments and Set Defaults ---
BUILD_RUNTIMES="${1:-true}" # Default to true if not provided
TESTNET="${2:-westend}" # Default to westend if not provided

if [ "${BUILD_RUNTIMES}" == "true" ]; then
    # --- Build the Westend runtimes ---
    echo "Building Westend runtime..."
    ${THIS_DIR}/build-runtime.sh ${TESTNET} true

    echo "Building Westend Asset Hub runtime..."
    ${THIS_DIR}/build-runtime.sh asset-hub-${TESTNET} true

    echo "Building Westend Bridge Hub runtime..."
    ${THIS_DIR}/build-runtime.sh bridge-hub-${TESTNET} true
fi

# --- Launch Chopsticks with Westend configs ---
echo "Launching Chopsticks with Westend configs..."
${THIS_DIR}/launch-chopsticks.sh ${TESTNET} ${TESTNET}-asset-hub ${TESTNET}-bridge-hub
