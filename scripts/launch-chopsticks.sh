#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Define Directories ---
CONFIGS_DIR="configs" # Assuming this script is run from the project root

# --- Function to get override config path ---
# Checks if an override config exists, then if a default .yml exists,
# otherwise returns the direct chain name.
get_config_path() {
    local chain_name="$1" # This will be the name provided as argument (e.g., "polkadot-asset-hub")

    local override_path="${CONFIGS_DIR}/${chain_name}-override.yml"
    local default_yml_path="${CONFIGS_DIR}/${chain_name}.yml"

    if [ -f "${override_path}" ]; then
        echo "${override_path}"
    elif [ -f "${default_yml_path}" ]; then
        echo "${default_yml_path}"
    else
        # If neither an override nor a default .yml file exists,
        # return the chain_name directly. Chopsticks will then
        # attempt to load a built-in config by this name, or fail.
        echo "${chain_name}"
    fi
}


# --- Parse Arguments and Set Defaults ---

# REPLAY_CHAIN (Relay Chain)
REPLAY_CHAIN_ARG="${1}"
DEFAULT_REPLAY_CHAIN="polkadot" # Default name if no argument is provided
if [ -z "${REPLAY_CHAIN_ARG}" ]; then
    echo "No relay chain specified. Defaulting to '${DEFAULT_REPLAY_CHAIN}'."
    REPLAY_CHAIN_FINAL_NAME="${DEFAULT_REPLAY_CHAIN}"
else
    REPLAY_CHAIN_FINAL_NAME="${REPLAY_CHAIN_ARG}"
fi
REPLAY_CHAIN_CONFIG=$(get_config_path "${REPLAY_CHAIN_FINAL_NAME}")
echo "Relay Chain config: ${REPLAY_CHAIN_CONFIG}"


# PARA_CHAIN_1
PARA_CHAIN_1_ARG="${2}"
DEFAULT_PARA_CHAIN_1="polkadot-asset-hub" # Default name if no argument is provided
if [ -z "${PARA_CHAIN_1_ARG}" ]; then
    echo "No first parachain specified. Defaulting to '${DEFAULT_PARA_CHAIN_1}'."
    PARA_CHAIN_1_FINAL_NAME="${DEFAULT_PARA_CHAIN_1}"
else
    PARA_CHAIN_1_FINAL_NAME="${PARA_CHAIN_1_ARG}"
fi
PARA_CHAIN_1_CONFIG=$(get_config_path "${PARA_CHAIN_1_FINAL_NAME}")
echo "Parachain 1 config: ${PARA_CHAIN_1_CONFIG}"


# PARA_CHAIN_2
PARA_CHAIN_2_ARG="${3}"
DEFAULT_PARA_CHAIN_2="acala" # Default name if no argument is provided
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
echo "  Relay Chain: ${REPLAY_CHAIN_CONFIG}"
echo "  Parachain 1: ${PARA_CHAIN_1_CONFIG}"
echo "  Parachain 2: ${PARA_CHAIN_2_CONFIG}"
echo ""

npx @acala-network/chopsticks xcm \
  -r "${REPLAY_CHAIN_CONFIG}" \
  -p "${PARA_CHAIN_1_CONFIG}" \
  -p "${PARA_CHAIN_2_CONFIG}"
