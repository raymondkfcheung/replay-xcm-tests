#!/usr/bin/env bash

mkdir -p ~/projects/replay-xcm-tests
cd ~/projects/replay-xcm-tests
npm init -y
npm i -g @acala-network/chopsticks@latest
npm i --save-dev typescript @types/node
npm i --save-dev tsx
npm i polkadot-api
npx tsc --init
