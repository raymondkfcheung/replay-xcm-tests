#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Define Project Directories ---
THIS_DIR=$(cd $(dirname $0); pwd)
PROJECTS_DIR="${THIS_DIR}/../.."
REPLAY_XCM_TESTS_DIR="${PROJECTS_DIR}/replay-xcm-tests"
RUNTIMES_DIR="${PROJECTS_DIR}/runtimes"
WASM_DIR="${REPLAY_XCM_TESTS_DIR}/wasms"
CONFIGS_DIR="${REPLAY_XCM_TESTS_DIR}/configs"
RUNTIME_REPO="polkadot-fellows/runtimes"
CHOPSTICKS_CONFIG_REPO_BASE="https://raw.githubusercontent.com/AcalaNetwork/chopsticks/master/configs"

# --- Parse Arguments and Set Defaults ---
TARGET_RUNTIME_ARG="${1:-asset-hub-polkadot}" # Default to 'asset-hub-polkadot' if no argument is provided
IS_SDK_ARGS="${2:-false}" # Default to false if not provided
if [ "${IS_SDK_ARGS}" != "false" ]; then
    RUNTIMES_DIR="${PROJECTS_DIR}/polkadot-sdk"
    RUNTIME_REPO="paritytech/polkadot-sdk"
fi

# Dynamically derive Cargo package name: always append -runtime
CARGO_PACKAGE="${TARGET_RUNTIME_ARG}-runtime"

# Determine Chopsticks config base name: using a case statement instead of associative array
CHOPSTICKS_CONFIG_BASENAME=""
case "${TARGET_RUNTIME_ARG}" in
    "asset-hub-polkadot")
        CHOPSTICKS_CONFIG_BASENAME="polkadot-asset-hub"
        ;;
    "asset-hub-kusama")
        CHOPSTICKS_CONFIG_BASENAME="kusama-asset-hub"
        ;;
    *) # Default case if no special mapping is found
        CHOPSTICKS_CONFIG_BASENAME="${TARGET_RUNTIME_ARG}"
        ;;
esac

WASM_FILENAME="${CARGO_PACKAGE//-/_}.wasm" # e.g., polkadot-runtime -> polkadot_runtime
OVERRIDE_CONFIG_FILE="${CONFIGS_DIR}/${CHOPSTICKS_CONFIG_BASENAME}-override.yaml"

echo "--- Setting up ${TARGET_RUNTIME_ARG} runtime and Chopsticks configuration ---"
echo "  Target Runtime: ${TARGET_RUNTIME_ARG}"
echo "  Cargo Package: ${CARGO_PACKAGE}"
echo "  Chopsticks Config Base: ${CHOPSTICKS_CONFIG_BASENAME}.yml"
echo "  Wasm Filename: ${WASM_FILENAME}"
echo "  Override Config Path: ${OVERRIDE_CONFIG_FILE}"

# 1. Clone and build the specified runtime
echo "1. Building ${TARGET_RUNTIME_ARG} runtime..."
mkdir -p "${PROJECTS_DIR}"
if [ ! -d "${RUNTIMES_DIR}" ]; then
    echo "Cloning ${RUNTIME_REPO} repository..."
    git clone git@github.com:${RUNTIME_REPO}.git "${RUNTIMES_DIR}"
else
    echo "Runtimes repository already exists. Attempting to pull updates..."
    # Suppress errors for git pull if it fails (e.g., no internet, no new commits)
    (cd "${RUNTIMES_DIR}" && git pull) || echo "Warning: git pull failed for runtimes repository. Continuing anyway."
fi

cd "${RUNTIMES_DIR}"
echo "Running cargo build -p ${CARGO_PACKAGE}..."
# Execute cargo build and capture its exit status
if ! cargo build -p "${CARGO_PACKAGE}"; then
    echo "" # Add an empty line for readability
    echo "ERROR: Failed to build the Rust package '${CARGO_PACKAGE}'."
    echo "This usually means: "
    echo "  - The package name '${CARGO_PACKAGE}' is incorrect or does not exist in the cloned 'runtimes' repository."
    echo "  - There's an issue with your Rust toolchain or build environment."
    echo ""
    echo "Please ensure '${TARGET_RUNTIME_ARG}' corresponds to a valid *polkadot-fellows* runtime package."
    echo "For custom or other runtimes (e.g., from different repositories), you may need to manually build the runtime WASM"
    echo "and then copy the '*.wasm' file into the ${WASM_DIR} folder."
    exit 1
fi
echo "${TARGET_RUNTIME_ARG} runtime built successfully."

# Verify build (this check is still useful after the cargo build check)
COMPILED_WASM_PATH="target/debug/wbuild/${CARGO_PACKAGE}/${WASM_FILENAME}"
if [ ! -f "${COMPILED_WASM_PATH}" ]; then
    echo "Error: ${WASM_FILENAME} not found at expected path: ${COMPILED_WASM_PATH} after successful build command!"
    echo "This might indicate a problem with the wbuild process or a misconfigured target path."
    exit 1
fi
echo "Compiled WASM file found: ${COMPILED_WASM_PATH}"

# 2. Copy the compiled Wasm to your working directory
echo "2. Copying compiled Wasm to ${WASM_DIR}..."
mkdir -p "${WASM_DIR}"
cp "${COMPILED_WASM_PATH}" "${WASM_DIR}/${WASM_FILENAME}"
echo "Wasm copied to ${WASM_DIR}/${WASM_FILENAME}."

# 3. Download and modify a config file for Chopsticks
echo "3. Configuring Chopsticks ${CHOPSTICKS_CONFIG_BASENAME}.yml..."
mkdir -p "${CONFIGS_DIR}"

if [ ! -f "${OVERRIDE_CONFIG_FILE}" ]; then
    echo "Checking for official Chopsticks config for ${CHOPSTICKS_CONFIG_BASENAME}.yml..."
    CHOPSTICKS_SOURCE_CONFIG_URL="${CHOPSTICKS_CONFIG_REPO_BASE}/${CHOPSTICKS_CONFIG_BASENAME}.yml"

    # Check if the URL actually exists before trying to wget
    if wget --spider "${CHOPSTICKS_SOURCE_CONFIG_URL}" 2>/dev/null; then
        echo "Official config found. Downloading ${OVERRIDE_CONFIG_FILE}..."
        wget "${CHOPSTICKS_SOURCE_CONFIG_URL}" -O "${OVERRIDE_CONFIG_FILE}"
        echo "File downloaded. Applying modifications..."

        # Use sed to update wasm-override path
        # macOS compatible sed -i '' for in-place editing
        sed -i '' "s|# wasm-override: ${WASM_FILENAME}|wasm-override: wasms/${WASM_FILENAME}|g" "${OVERRIDE_CONFIG_FILE}" || \
        sed -i '' "s|wasm-override:.*|wasm-override: wasms/${WASM_FILENAME}|g" "${OVERRIDE_CONFIG_FILE}" # Fallback for already uncommented or different values
        
        # Ensure runtime-log-level: 5 is present/set.
        if ! grep -q "^runtime-log-level:" "${OVERRIDE_CONFIG_FILE}"; then
            echo "Adding runtime-log-level: 5"
            echo "runtime-log-level: 5" >> "${OVERRIDE_CONFIG_FILE}"
        else
            echo "Updating runtime-log-level to 5"
            sed -i '' "s/^runtime-log-level:.*$/runtime-log-level: 5/g" "${OVERRIDE_CONFIG_FILE}"
        fi

        echo "${OVERRIDE_CONFIG_FILE} configured successfully."
    else
        echo "Warning: Official Chopsticks config for ${CHOPSTICKS_CONFIG_BASENAME}.yml not found at ${CHOPSTICKS_SOURCE_CONFIG_URL}."
        echo "You will need to create and configure '${OVERRIDE_CONFIG_FILE}' manually."
        echo "Ensure it has 'runtime-log-level: 5' and 'wasm-override: wasms/${WASM_FILENAME}'."
    fi
else
    echo "${OVERRIDE_CONFIG_FILE} already exists. Please ensure:"
    echo "  - runtime-log-level: 5"
    echo "  - wasm-override: wasms/${WASM_FILENAME}"
    echo "You can manually verify and edit the file if needed: ${OVERRIDE_CONFIG_FILE}"
fi

echo "--- Setup complete for ${TARGET_RUNTIME_ARG}! ---"