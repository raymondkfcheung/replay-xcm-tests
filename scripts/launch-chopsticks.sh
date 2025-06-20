#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Define Directories ---
CONFIGS_DIR="configs" # Assuming this script is run from the project root

# --- Function to get override config path ---
# Checks if an override config exists, otherwise returns the chain name directly
get_config_path() {
    local chain_name="$1"
    local override_path="${CONFIGS_DIR}/${chain_name}-override.yaml"
    
    if [ -f "${override_path}" ]; then
        echo "${override_path}"
    else
        # Return the chain name directly - Chopsticks will attempt to load built-in config
        echo "${chain_name}"
    fi
}

# --- Parse Arguments and Set Defaults ---

# Relay Chain
RELAY_CHAIN_ARG="${1}"
DEFAULT_RELAY_CHAIN="polkadot"

if [ -z "${RELAY_CHAIN_ARG}" ]; then
    echo "No relay chain specified. Defaulting to '${DEFAULT_RELAY_CHAIN}'."
    RELAY_CHAIN_FINAL_NAME="${DEFAULT_RELAY_CHAIN}"
else
    RELAY_CHAIN_FINAL_NAME="${RELAY_CHAIN_ARG}"
fi

RELAY_CHAIN_CONFIG=$(get_config_path "${RELAY_CHAIN_FINAL_NAME}")
echo "Relay Chain config: ${RELAY_CHAIN_CONFIG}"

# Parachain 1
PARA_CHAIN_1_ARG="${2}"
DEFAULT_PARA_CHAIN_1="polkadot-asset-hub"

if [ -z "${PARA_CHAIN_1_ARG}" ]; then
    echo "No first parachain specified. Defaulting to '${DEFAULT_PARA_CHAIN_1}'."
    PARA_CHAIN_1_FINAL_NAME="${DEFAULT_PARA_CHAIN_1}"
else
    PARA_CHAIN_1_FINAL_NAME="${PARA_CHAIN_1_ARG}"
fi

PARA_CHAIN_1_CONFIG=$(get_config_path "${PARA_CHAIN_1_FINAL_NAME}")
echo "Parachain 1 config: ${PARA_CHAIN_1_CONFIG}"

# Parachain 2
PARA_CHAIN_2_ARG="${3}"
DEFAULT_PARA_CHAIN_2="acala"

if [ -z "${PARA_CHAIN_2_ARG}" ]; then
    echo "No second parachain specified. Defaulting to '${DEFAULT_PARA_CHAIN_2}'."
    PARA_CHAIN_2_FINAL_NAME="${DEFAULT_PARA_CHAIN_2}"
else
    PARA_CHAIN_2_FINAL_NAME="${PARA_CHAIN_2_ARG}"
fi

PARA_CHAIN_2_CONFIG=$(get_config_path "${PARA_CHAIN_2_FINAL_NAME}")
echo "Parachain 2 config: ${PARA_CHAIN_2_CONFIG}"

# --- Execute Chopsticks Command ---
echo ""
echo "Running Chopsticks XCM with the following configurations:"
echo " Relay Chain: ${RELAY_CHAIN_CONFIG}"
echo " Parachain 1: ${PARA_CHAIN_1_CONFIG}"
echo " Parachain 2: ${PARA_CHAIN_2_CONFIG}"
echo ""

npx @acala-network/chopsticks xcm \
    -r "${RELAY_CHAIN_CONFIG}" \
    -p "${PARA_CHAIN_1_CONFIG}" \
    -p "${PARA_CHAIN_2_CONFIG}"