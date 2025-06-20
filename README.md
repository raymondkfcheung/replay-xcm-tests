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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
