# Replay XCMs Using Chopsticks

[Chopsticks](https://github.com/AcalaNetwork/chopsticks) is a tool for forking live Polkadot SDK-based chains in a local environment. If you're new to it, check out the [Get Started](https://docs.polkadot.com/develop/toolkit/parachains/fork-chains/chopsticks/get-started/) guide.

This tutorial focuses specifically on replaying [XCMs](https://docs.polkadot.com/develop/interoperability/intro-to-xcm/), a powerful technique for:

* [Debugging cross-chain message failures](https://docs.polkadot.com/develop/interoperability/test-and-debug/)
* Tracing execution across relay chains and parachains
* Analysing weight usage, error types, and message flow

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Clone the Repository

First, clone the repository to your local machine using Git:

```bash
git clone git@github.com:raymondkfcheung/replay-xcm-tests.git
cd replay-xcm-tests
```

### Install Dependencies

Navigate into the cloned project directory and install the required Node.js dependencies:

```bash
npm install
```

This command will install all the necessary packages listed in `package.json`.

### Build the Project

This project uses TypeScript. Before running, you need to compile the TypeScript source files into JavaScript:

```bash
npm run build
```

This will compile the TypeScript code from the `src/` directory into JavaScript files in the `dist/` directory.

## Usage

### Running Local Chains with Chopsticks

To test XCM, you'll need to run local instances of the relevant blockchain networks using Chopsticks. The project's tests assume you have these local chains running.

An example command to run a Polkadot relay chain with Pokadot Asset Hub and Acala parachains locally:

```bash
npx @acala-network/chopsticks xcm -r polkadot -p polkadot-asset-hub -p acala

# Or using the script to launch
# ./scripts/launch-chopsticks.sh
```

This command will typically start nodes on `ws://localhost:8000`, `ws://localhost:8001`, `ws://localhost:8002`. Check your terminal output from the `chopsticks` command for the exact endpoints.

### Running Sample Code

Assume Polkadot Asset Hub is on the port 8000, you can use [Polkadot-API](https://docs.polkadot.com/develop/toolkit/api-libraries/papi/) to generate the necessary types:

```bash
npx papi add assetHub -w ws://localhost:8000
```

Once your local Chopsticks networks are running, you can execute the sample script:

```bash
npx ts-node src/set-topic.ts
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
