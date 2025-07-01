#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Define Project Directories ---
PROJECTS_DIR="${1:-${HOME}/projects}"
REPLAY_XCM_TESTS_DIR="${PROJECTS_DIR}/replay-xcm-tests"

echo "Creating a dedicated directory for your replay environment..."
mkdir -p "${REPLAY_XCM_TESTS_DIR}"
cd "${REPLAY_XCM_TESTS_DIR}"

echo "Initialising a new Node.js project..."
npm init -y

echo "Installing Chopsticks globally..."
npm i -g @acala-network/chopsticks@latest

echo "Installing TypeScript and related tooling for local development..."
npm i --save-dev typescript @types/node tsx

echo "Installing the required Polkadot packages..."
npm install @polkadot/api polkadot-api

echo "Initialising the TypeScript config..."
npx tsc --init

echo "--- Setup complete for ${REPLAY_XCM_TESTS_DIR}! ---"
