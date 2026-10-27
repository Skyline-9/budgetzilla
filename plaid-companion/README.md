# Plaid Local Companion distribution

`plaid-companion` is the same local service for Budgetzilla's hosted web app and Tauri desktop app. It owns Plaid API calls and credentials; the React app uses its HTTP API. The Tauri app does not call Plaid.

## Standalone web users

Download the `plaid-companion-<target>` executable and its `.sha256` file from the matching Budgetzilla GitHub release. Verify it with `shasum -a 256 -c plaid-companion-<target>.sha256` (macOS/Linux) or `Get-FileHash -Algorithm SHA256` (Windows). Make the executable runnable on macOS/Linux with `chmod +x plaid-companion-<target>`.

Run `plaid-companion configure --environment sandbox --origin https://budgetzilla-app.vercel.app` once for the hosted app, or pass both desktop origins (`--origin tauri://localhost --origin http://tauri.localhost`) for the desktop app. It prompts for your Plaid client ID and secret; secret input is hidden and stored by the companion in the OS credential store. Use `--environment production` for real accounts. Check setup with `plaid-companion status`; it reports configuration state without printing credential values.

Keep the companion running while using Budgetzilla in a browser. Start it with `plaid-companion serve`; it binds to an available loopback port and prints the port and a short-lived, one-time pairing code in that terminal. In Budgetzilla Settings, pair with that code. A browser may ask permission for the hosted page to connect to a local device; allow it for Plaid sync. If permission is denied, Budgetzilla remains usable and Plaid sync stays disconnected.

Do not paste the pairing code into chat, a browser address bar, or a support request. It is intended for entry in Budgetzilla Settings on the same computer. Stop the companion with Ctrl+C when finished.

## Tauri desktop users

The desktop release bundles the same companion executable as a Tauri sidecar. Budgetzilla starts it on app launch and exposes its dynamic loopback port and one-time pairing code through the `start_plaid_companion` native command. The frontend then uses the shared companion HTTP API. The code is returned only over native IPC and is not written to desktop logs. Closing the app stops the child process started by that app.

Configure Plaid credentials with the standalone setup utility before first use if the release does not expose a native setup screen. Credential storage and Plaid behavior are the same in desktop and hosted-web distributions.

## Release targets

Standalone binaries and Tauri sidecars are built for the repository's current desktop matrix:

| Target | Standalone executable | Tauri package |
| --- | --- | --- |
| `aarch64-apple-darwin` | macOS Apple Silicon | `.app` / `.dmg` |
| `x86_64-apple-darwin` | macOS Intel | `.app` / `.dmg` |
| `x86_64-pc-windows-msvc` | Windows x64 `.exe` | `.msi` / NSIS `.exe` |
| `x86_64-unknown-linux-gnu` | Linux x64 | `.deb` / `.rpm` / `.AppImage` |

Each standalone binary has an adjacent SHA-256 checksum. Desktop builds use the binary staged by `webapp/scripts/package-plaid-companion.mjs` as `src-tauri/binaries/plaid-companion-<target>`; Tauri packages it beside the desktop executable.

## Launcher protocol

When Tauri starts the bundled executable it runs `plaid-companion serve --ipc`. The companion must write exactly one JSON line to stdout once its loopback listener and one-time pairing code are ready:

```json
{"port":41731,"pairingCode":"one-time-code"}
```

That line is consumed by the native launcher and returned to the frontend through IPC. Do not write the pairing code to stderr, application logs, or subsequent stdout diagnostics in IPC mode. The listener must bind only to `127.0.0.1` (or another explicitly supported loopback address); web clients must continue to use the authenticated, origin-validated HTTP API.

Build a standalone release artifact and stage its identical sidecar with:

```sh
cargo build --manifest-path plaid-companion/Cargo.toml --release --target x86_64-unknown-linux-gnu --bin plaid-companion
cd webapp
npm run package:plaid-companion -- --target x86_64-unknown-linux-gnu --binary ../plaid-companion/target/x86_64-unknown-linux-gnu/release/plaid-companion
```

The release workflow builds each target on its native runner, runs Tauri packaging, and publishes standalone binaries with checksums in the same draft release.
