#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define project directories
PROJECTS_DIR="${HOME}/projects"
REPLAY_XCM_TESTS_DIR="${PROJECTS_DIR}/replay-xcm-tests"
RUNTIMES_DIR="${PROJECTS_DIR}/runtimes"
WASM_DIR="${REPLAY_XCM_TESTS_DIR}/wasms"
CONFIGS_DIR="${REPLAY_XCM_TESTS_DIR}/configs"
POLKADOT_OVERRIDE_CONFIG="${CONFIGS_DIR}/polkadot-override.yaml"

echo "--- Setting up Polkadot runtime and Chopsticks configuration ---"

# 1. Clone and build the Polkadot runtime
echo "1. Building Polkadot runtime..."
mkdir -p "${PROJECTS_DIR}"
if [ ! -d "${RUNTIMES_DIR}" ]; then
    echo "Cloning runtimes repository..."
    git clone git@github.com:polkadot-fellows/runtimes.git "${RUNTIMES_DIR}"
else
    echo "Runtimes repository already exists. Skipping clone."
    (cd "${RUNTIMES_DIR}" && git pull) || true # Pull updates, ignore errors if offline/no changes
fi

cd "${RUNTIMES_DIR}"
echo "Running cargo build --release -p polkadot-runtime..."
cargo build --release -p polkadot-runtime

# Verify build
POLKADOT_WASM_PATH="target/release/wbuild/polkadot-runtime/polkadot_runtime.compact.compressed.wasm"
if [ ! -f "${POLKADOT_WASM_PATH}" ]; then
    echo "Error: polkadot_runtime.compact.compressed.wasm not found after build!"
    exit 1
fi
echo "Polkadot runtime built successfully."

# 2. Copy the compiled Wasm to your working directory
echo "2. Copying compiled Wasm to ${WASM_DIR}..."
mkdir -p "${WASM_DIR}"
cp "${POLKADOT_WASM_PATH}" "${WASM_DIR}/polkadot_runtime.compact.compressed.wasm"
echo "Wasm copied."

# 3. Download and modify a config file for Chopsticks
echo "3. Configuring Chopsticks polkadot-override.yaml..."
mkdir -p "${CONFIGS_DIR}"

if [ ! -f "${POLKADOT_OVERRIDE_CONFIG}" ]; then
    echo "Downloading ${POLKADOT_OVERRIDE_CONFIG}..."
    wget https://raw.githubusercontent.com/AcalaNetwork/chopsticks/master/configs/polkadot.yml -O "${POLKADOT_OVERRIDE_CONFIG}"
    echo "File downloaded. Applying modifications..."

    # Use sed to update wasm-override path
    sed -i '' "s|wasm-override: polkadot_runtime.compact.compressed.wasm|wasm-override: wasms/polkadot_runtime.compact.compressed.wasm|g" "${POLKADOT_OVERRIDE_CONFIG}"
    
    # Ensure runtime-log-level: 5 is present/set.
    # This sed command adds or replaces the line. It's more robust than just search/replace.
    # It looks for lines starting with 'runtime-log-level:', replaces them, or adds the line if not found.
    if ! grep -q "^runtime-log-level:" "${POLKADOT_OVERRIDE_CONFIG}"; then
        # If not found, append it
        echo "Adding runtime-log-level: 5"
        echo "runtime-log-level: 5" >> "${POLKADOT_OVERRIDE_CONFIG}"
    else
        # If found, replace it
        echo "Updating runtime-log-level to 5"
        sed -i '' "s/^runtime-log-level:.*$/runtime-log-level: 5/g" "${POLKADOT_OVERRIDE_CONFIG}"
    fi

    echo "${POLKADOT_OVERRIDE_CONFIG} configured successfully."
else
    echo "${POLKADOT_OVERRIDE_CONFIG} already exists. Please ensure:"
    echo "  - runtime-log-level: 5"
    echo "  - wasm-override: wasms/polkadot_runtime.compact.compressed.wasm"
    echo "You can manually verify and edit the file if needed: ${POLKADOT_OVERRIDE_CONFIG}"
fi

echo "--- Setup complete! ---"