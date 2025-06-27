# 🛰️ Replay XCMs Using Chopsticks

[Chopsticks](https://github.com/AcalaNetwork/chopsticks) is a tool for forking live [Polkadot SDK](https://github.com/paritytech/polkadot-sdk)-based chains in a local environment. This project demonstrates how to **replay and debug XCMs** locally using Chopsticks, [Polkadot-API](https://docs.polkadot.com/develop/toolkit/api-libraries/papi/), and the [XCM Runtime APIs](https://docs.polkadot.com/develop/interoperability/xcm-runtime-apis/).

📘 If you’re unfamiliar with Chopsticks, start with the [Get Started guide](https://docs.polkadot.com/develop/toolkit/parachains/fork-chains/chopsticks/get-started/).

## 🧭 What This Project Enables

* 🔍 Replaying real XCMs from the live network using `callData`
* 🐞 Debugging XCM failures by dry-running them without changing state
* 🔁 Tracing multi-hop messages and observing forwarded XCMs
* ⚖️ Analysing weight usage, fee logic, and emitted events via runtime APIs

## ⚙️ Setup

Clone this repository using Git:

```bash
git clone git@github.com:raymondkfcheung/replay-xcm-tests.git
cd replay-xcm-tests
```

Install the required dependencies:

```bash
npm install
```

Compile the TypeScript code:

```bash
npm run build
```

## 🚀 Usage

### Running Local Chains with Chopsticks

Launch local forks of relevant chains. For example, to fork Polkadot, Asset Hub, and Acala:

```bash
npx @acala-network/chopsticks xcm -r polkadot -p polkadot-asset-hub -p acala

# Or use the helper script provided
# ./scripts/launch-chopsticks.sh
```

The WebSocket endpoints are typically exposed at `localhost:8000`, `8001`, `8002`, but always check the terminal output from Chopsticks.

---

### Generating Polkadot-API Descriptors

Generate typed API descriptors for your forked chain using [`papi`](https://docs.polkadot.com/develop/toolkit/api-libraries/papi/):

```bash
npx papi add assetHub -w ws://localhost:8000
```

### Running the Example Scripts

Once descriptors are available, the following scripts may be executed:

#### 🔖 Set an XCM Topic

Helps trace XCMs with a consistent topic ID:

```bash
npx ts-node src/set-topic.ts
```

#### 🧬 Replay Using Call Data

Replays an encoded call captured from Subscan:

```bash
npx ts-node src/use-calldata.ts
```

#### 🧪 Dry Run the XCM

Simulates execution of the XCM without affecting state. This outputs execution success, emitted events, and forwarded messages:

```bash
npx ts-node src/exec-dry-run.ts
```

Example output on success:

```json
{
  "execution_result": { "success": true, "value": { ... } },
  "emitted_events": [ ... ],
  "local_xcm": { ... },
  "forwarded_xcms": [ ... ]
}
```

Example output on failure:

```json
{
  "execution_result": {
    "type": "Incomplete",
    "value": {
      "used": { "ref_time": 1690000, "proof_size": 0 },
      "error": { "type": "Barrier", "value": null }
    }
  }
}
```

Further details are available in the [Dry Run Call](https://docs.polkadot.com/develop/interoperability/xcm-runtime-apis/#dry-run-call) and [Dry Run XCM](https://docs.polkadot.com/develop/interoperability/xcm-runtime-apis/#dry-run-xcm) documentation.

## 🪪 Licence

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
