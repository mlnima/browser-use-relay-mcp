# Browser Use Relay MCP

A standalone Model Context Protocol server, Manifest V3 extension, and Native Messaging host for observing and controlling one selected Chromium browser. It supports local and trusted-LAN agents, multiple installed browser families, revision-aware page targeting, browser-generated input, browser APIs, and operating-system fallback behind one action catalog.

## Architecture

```text
AI agent
  ↕ MCP over stdio
MCP server on the agent device
  ↕ WebSocket using the selected relay URL
Native Messaging host on the browser device
  ↕ Chromium Native Messaging
MV3 service worker
  ├─ Browser/CDP engine
  ├─ Content-script DOM engine
  └─ Native OS engine through the host
```

The browser device and agent device can be the same computer. For LAN use, the extension and Native Messaging host stay on the browser device; the MCP server runs wherever the agent runs.

The content engine assigns element IDs in memory. It does not add marker IDs or classes to website DOM. Targets are revisioned and revalidated after SPA, frame, resize, intersection, input, focus, scroll, and DOM changes.

## Requirements

- Node.js 20.19 or newer and npm.
- Chrome, Microsoft Edge, Chromium, Brave, or Vivaldi based on Chromium 130 or newer.
- Windows, macOS, or Linux, including Ubuntu.
- A graphical desktop session for native mouse, keyboard, dialog, and clipboard actions.
- User-level permission to register a Native Messaging host.

macOS can request Accessibility, Input Monitoring, or Screen Recording permission for native interaction. Linux native input requires an accessible graphical session; compositor and Wayland policies can restrict synthetic OS input.

## Build

Run commands from this package directory:

```bash
npm ci --workspaces=false
npm run typecheck
npm run build
```

Build output:

- `extension/dist` — unpacked MV3 extension.
- `dist/mcp/entry.js` — MCP stdio server.
- `dist/native/entry.js` — Native Messaging host and WebSocket relay.

## Install on a browser device

### 1. Load the extension

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge. Other Chromium browsers expose an equivalent extensions page.
2. Enable Developer mode.
3. Select **Load unpacked** and choose this package's `extension/dist` directory.
4. Copy the extension ID shown by the browser. The included manifest key should produce `eacicnagoagiekpfomdocomknbjhmalh`; always use the ID actually displayed by that browser.

The browser can require separate user approval for incognito access or `file://` URLs.

### 2. Register the Native Messaging host

Run one command for each browser family in which the extension will be installed:

```bash
npm run native:install --workspaces=false -- chrome eacicnagoagiekpfomdocomknbjhmalh
npm run native:install --workspaces=false -- edge eacicnagoagiekpfomdocomknbjhmalh
```

Supported browser values are `chrome`, `edge`, `chromium`, `brave`, and `vivaldi`. Replace the sample extension ID if the browser displays a different one.

The installer verifies the native build and creates a user-scoped browser manifest and launcher. It writes to the current user's browser Native Messaging configuration and, on Windows, its documented per-user registry key. Re-run installation if this package directory moves.

### 3. Enable the relay

1. Reload the extension after registering the host.
2. Open the extension popup and turn **Browser relay** on.
3. For same-device use, copy the local `ws://127.0.0.1:<port>` address.
4. For another device on the same trusted network, open Settings, enable **External Access**, apply the desired port, and copy the displayed LAN address.

The first run requests port `32145`. If that port is unavailable, the host selects a free port and persists the actual port shown by the extension. A host firewall can require approval for trusted private-network access.

Install the extension in any supported browsers you need, but keep only the selected browser relay enabled. The MCP server controls the single relay URL configured for it.

## Configure an MCP client

Use an absolute path and the exact address copied from the extension.

```json
{
  "mcpServers": {
    "browser-use-relay": {
      "command": "node",
      "args": [
        "/absolute/path/to/browser-use-relay-mcp/dist/mcp/entry.js"
      ],
      "env": {
        "BROWSER_RELAY_URL": "ws://127.0.0.1:32145"
      }
    }
  }
}
```

On Windows, use an escaped absolute path such as `C:\\path\\to\\browser-use-relay-mcp\\dist\\mcp\\entry.js`.

On a remote agent device, use the browser device's LAN relay address instead of `127.0.0.1`. The agent device needs the built MCP package, but it does not need that browser's Native Messaging registration.

Equivalent command-line configuration is available:

```bash
node dist/mcp/entry.js --relay-url ws://127.0.0.1:32145
```

Optional environment settings:

- `BROWSER_RELAY_CONNECT_TIMEOUT_MS` — WebSocket connection timeout; default `10000`.
- `BROWSER_RELAY_ACTION_TIMEOUT_MS` — default action timeout; default `60000`.
- `BROWSER_RELAY_ACTION_DELAY_MIN_MS` and `BROWSER_RELAY_ACTION_DELAY_MAX_MS` — optional minimum and maximum intervals between browser actions, in milliseconds. The equivalent flags are `--action-delay-min-ms` and `--action-delay-max-ms`; each flag takes precedence over its environment setting.

Set action delays in the MCP JSON `env` object or the target browser extension's Settings. For example, `"BROWSER_RELAY_ACTION_DELAY_MIN_MS": "500"` and `"BROWSER_RELAY_ACTION_DELAY_MAX_MS": "1000"` select a random interval from 500 to 1000 milliseconds. One supplied endpoint means a fixed interval. An explicit MCP range overrides the extension's entire range; an explicit zero disables the delay when supplied alone or for both endpoints. Without MCP values, the browser uses its saved extension values. With neither configured, no delay is imposed.

Delays are enforced on the browser device, including over LAN, before each action and each `browser_batch` member. Time already spent since the previous dispatch or completion counts toward the interval, so slow model responses do not add another full wait. Concurrent observation waits remain active while later actions are dispatched. Internal file-transfer chunks, finalization, and cleanup are not paced. Delay time counts toward the action timeout. Extension delay changes apply to subsequent actions without restarting the relay.

If the browser device has several physical or virtual adapters, set `BROWSER_USE_RELAY_NETWORK_ADDRESS` in the browser process environment to the assigned LAN IPv4 address that External Access should display.

The server supports current MCP discovery and compatible 2025-era initialization through the official TypeScript SDK.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `browser_capabilities` | Return the protocol, target grammar, parameter guides, action catalog, and selected browser's runtime availability. |
| `browser_snapshot` | Return page state and revisioned element catalogs across permitted frames. |
| `browser_query` | Execute one catalog-defined read action; some observations can attach the debugger or temporarily activate a tab. |
| `browser_action` | Execute one action with automatic or explicit engine routing. |
| `browser_batch` | Run an ordered workflow and optionally stop on the first action failure. |
| `browser_events` | Read buffered relay, navigation, DOM, network, download, and page-error events with sequence cursors and overflow reporting. |
| `browser_upload_files` | Transfer local files or isolated directory trees to the browser device, verify SHA-256 integrity, and set a file input. |
| `browser_download_file` | Copy a browser-device file to the MCP device with chunk integrity verification. |

Call `browser_capabilities` before using unfamiliar actions. Its target and category guides are the authoritative runtime-facing contract.

## Targeting and routing

A target can contain:

```json
{
  "tabId": 42,
  "frameId": 0,
  "documentId": "optional-document-id",
  "elementId": "element-id-from-a-snapshot",
  "locator": {
    "selector": "button[type=submit]",
    "text": "Continue",
    "exactText": true,
    "role": "button",
    "name": "Continue",
    "label": "Email",
    "placeholder": "name@example.com",
    "nth": 0
  },
  "x": 640,
  "y": 420
}
```

Target precedence is element ID, locator, then coordinates. Browser and DOM coordinates use the selected frame's viewport; explicit native actions use OS screen coordinates.

Use `engine: "auto"` unless a workflow specifically needs `browser`, `dom`, or `native`. Automatic routing follows each action's catalog metadata and returns the engine that actually completed it.

For change-sensitive actions, pass the latest snapshot `expectedRevision`. A stale target is fingerprint-revalidated before execution or returned as a retryable failure.

## Usage examples

Observe all permitted frames:

```json
{
  "includeScreenshot": false,
  "allFrames": true,
  "maxElements": 5000
}
```

Extract visible matching elements:

```json
{
  "action": "querySelectorAll",
  "target": {
    "locator": {
      "selector": "article"
    }
  },
  "params": {
    "limit": 200
  }
}
```

Click a revisioned element with browser input:

```json
{
  "action": "clickElement",
  "engine": "auto",
  "target": {
    "tabId": 42,
    "elementId": "element-id-from-the-latest-snapshot"
  },
  "expectedRevision": 17
}
```

Fill a field:

```json
{
  "action": "fillField",
  "target": {
    "locator": {
      "label": "Email"
    }
  },
  "params": {
    "value": "person@example.com"
  }
}
```

Transfer local files and set a remote file input with `browser_upload_files`:

```json
{
  "paths": [
    "C:\\Users\\person\\Documents\\report.pdf"
  ],
  "target": {
    "locator": {
      "selector": "input[type=file]"
    }
  }
}
```

The result always includes every staging ID in `transferIds`. Its `pathMetadata` contains the returned file paths, directory roots, encoded byte limit, actual encoded bytes, returned and omitted counts, and `PATH_METADATA_BYTE_BUDGET_EXCEEDED` when the 8 MiB result budget requires truncation. After the website has consumed a file, `uploadFile` with `engine: "native"` and `params: { "operation": "cancel", "transferId": "…" }` releases it. A client can stage at most 4,096 files and 8 GiB; the MCP preflights those limits before transferring. Unfinalized groups have a renewable 24-hour inactivity lease with a seven-day absolute limit. The high-level tool refreshes prior groups during active transfer progress, then atomically validates and finalizes every real directory group and its synthetic standalone-file group with one shared nonrenewing 30-minute deadline. Retrying the same consistent bulk finalization is idempotent and cannot extend that deadline. All owner staging is removed when that relay client disconnects or the native host stops. File and directory names are preserved exactly; names unsupported by the browser device's operating system or filesystem are rejected and are never silently rewritten.

Copy a completed browser-device download back with `browser_download_file`:

```json
{
  "remotePath": "C:\\Users\\browser\\Downloads\\result.zip",
  "destinationPath": "C:\\Users\\agent\\Downloads\\result.zip",
  "overwrite": false
}
```

## Capability notes

- CDP browser input is higher fidelity than script-dispatched events, but attaching `chrome.debugger` displays Chromium's debugger notice. Opening DevTools for the same target or dismissing the notice can detach the session.
- Native actions control the focused desktop and are used for browser chrome, file choosers, Save As, permission prompts, and other UI outside webpage content.
- `chrome://`, extension-store pages, browser-owned viewers, and other protected surfaces restrict content scripts or debugger access.
- Cross-origin frame access depends on host permission and Chromium restrictions. The extension reports frame-specific failures rather than silently targeting the wrong frame.
- Tab audio/video capture and some browser UI operations remain subject to Chromium user-activation rules.
- Website defenses can observe debugger attachment or automation-relevant behavior. This package does not claim invisibility.

## Network security

This release is intentionally unauthenticated. External Access binds the relay to the browser device's network interfaces and uses unencrypted `ws://` transport.

- Use External Access only on a trusted private network.
- Do not expose or forward the relay port to the public internet.
- Disable the extension relay when it is not in use.
- Anyone who can reach the relay can request the capabilities granted to the extension and native host.

## Uninstall the native host

Run the matching command for each registered browser:

```bash
npm run native:uninstall --workspaces=false -- chrome
npm run native:uninstall --workspaces=false -- edge
```

Then remove the unpacked extension from the browser.

## Troubleshooting

- **Native host not found:** confirm `npm run build` completed, install the host for the correct browser family and displayed extension ID, then reload the extension.
- **Relay address is absent:** enable the extension and inspect the status message. The local endpoint uses `127.0.0.1` with the saved port; the LAN endpoint appears only after the native host reports a network address.
- **LAN connection fails:** enable External Access, use the displayed LAN address, and allow the selected Node process/port through the browser device's private-network firewall.
- **Action targets the wrong page state:** take a new snapshot and send its element ID and revision.
- **Debugger action fails:** close DevTools for the target tab, keep the debugger session attached, and retry with a fresh snapshot.
- **Native input misses the target:** focus the intended browser window and verify display scaling and OS permissions.
- **Package directory moved:** rebuild if needed and reinstall the Native Messaging host so its absolute launcher paths are current.

## Browser interaction test web app

`test-web-app/` is a standalone React 19.3.0 application for exercising the relay against repeatable website interactions. Its dependencies, source, scripts and output stay in this repository. It does not use the parent agent harness or change the extension's React dependency.

From the root of this standalone repository, install the app's dependencies once:

```bash
npm --prefix test-web-app ci --workspaces=false --ignore-scripts
```

The repository's existing dependencies must also be installed, because the app uses its existing esbuild package. Run the app independently with:

```bash
npm run test-web:build --workspaces=false
npm run test-web:start --workspaces=false
```

For development:

```bash
npm run test-web:dev --workspaces=false
```

Development watches the app source, rebuilds its bundles and restarts its server. Reload the browser after editing source. Production output is isolated in `dist/test-web-app/`. The MCP's `build:server` clears `dist`, so run `test-web:build` after a main MCP build if you also want the app output.

Open `http://localhost:5000`. Set `BROWSER_USE_RELAY_MCP_TEST_WEB_APP` to choose another port; an absent variable uses 5000. Environment variables and a `.env` in the command's working directory are supported. For example, in PowerShell:

```powershell
$env:BROWSER_USE_RELAY_MCP_TEST_WEB_APP = '5001'
npm run test-web:start --workspaces=false
```

In bash/zsh:

```bash
BROWSER_USE_RELAY_MCP_TEST_WEB_APP=5001 npm run test-web:start --workspaces=false
```

The server binds to all interfaces, so another computer can open `http://<app-computer-LAN-IP>:<port>`. A second, automatically allocated port serves the cross-origin iframe fixture. Allow that port through the private-network firewall when testing those frames remotely. Both listeners stop with the app process; no separate frame-server command is required.

### Languages and navigation

The language selector provides English, Deutsch, French, Spanish, Chinese, Japanese, Persian, Arabic, Hindi (the requested Indian language) and Russian. Persian and Arabic set the document and layout to RTL. Language is kept in `?lang=<code>` and follows internal links, frames and popups.

Internal navigation uses the History API without refreshing the document. Page modules load with React `lazy` and dynamic imports. Direct URLs render their initial page on the server and hydrate it on the client; `/server` includes all 60 fixture rows in the initial HTML, without waiting for JavaScript or a fetch. `/async` and `/workflow` intentionally request data after mounting, exposing a visible loading state. All data is local fixture data, with no external website services.

### Scenario coverage

| Route | Level | Interactions |
| --- | --- | --- |
| `/overview` | Overview | Scenario catalog, difficulty filter, observed completion, reset |
| `/forms` | 1 | Controlled React inputs, required/invalid fields, dependent selects, radio/checkbox/multi-select, number/date/time/month/week/color, submit/reset, disabled/readonly controls |
| `/pointer` | 2 | Hover-only controls, double click, context menu, press-and-hold, range slider, moving target |
| `/navigation` | 2 | Validated wizard, back/forward, new tab, popup confirmation, native browser alert/confirm/prompt, notification permission |
| `/files` | 2 | Multiple files, directory chooser, file drop, byte uploads with SHA-256, actual downloads, uploaded-file round trip |
| `/server` | 2 | Initial server HTML, sortable table, record selection |
| `/board` | 3 | Kanban transfers, sortable rows, HTML drag events and pointer drops |
| `/editor` | 3 | Contenteditable, selections, bold/italic, keyboard editing, clipboard copy/paste, save actual HTML/text |
| `/media` | 3 | Real generated audio, play/pause/seek/volume, generated live video, fullscreen, canvas pointer drawing |
| `/async` | 4 | Debounced delayed requests, cancellation, loading, explicit HTTP 503, retry, pagination, changing cards |
| `/frames` | 4 | Same-origin, nested and genuinely cross-origin frames, open/closed shadow roots |
| `/scroll` | 4 | 1,000 virtual rows, nested vertical/horizontal scroll, sticky content and a distant target |
| `/workflow` | 5 | Delayed virtual list, blocking modal, duplicate hidden/disabled buttons, conditional steps, required upload, drag approval, verified receipt and browser print dialog |

Each scenario states an objective and shows results from actions actually observed. Completion starts empty and is earned by satisfying the scenario's checks. Reset clears the current run; navigating away resets that page's local controls, while completed scenario results remain until the run is reset. Upload bytes are kept in server memory until that process stops. Downloads return actual bytes, and the response metadata allows integrity checks.

For `/async`, search for `042`, select that record, trigger a failure and retry, then clear the search and load another page. For `/workflow`, find `042`, close the modal, complete contact fields and upload a real file, drag the approval token, then confirm the receipt. Do not edit the DOM to bypass these steps.

The event observer records input events, keys, target/value and `isTrusted`. It does not identify the engine: CDP input and OS input can both produce trusted events. To compare engines, run the same objective through the MCP with `engine: "dom"`, `engine: "browser"` (CDP) or `engine: "native"` explicitly on supported action calls and inspect their returned engine and the resulting page state. Native testing also needs the registered native host on the browser computer and a focused browser window.

Clipboard, notification permission and fullscreen depend on browser permissions and user activation. Clipboard and notification APIs generally need a secure context: localhost works, while plain HTTP at a LAN address may restrict them. Directory selection depends on browser support. Closed shadow roots deliberately require visual/coordinate targeting or keyboard navigation. This app exercises difficult interaction patterns; passing its scenarios does not prove compatibility with every website.

Implementation references: [React versions](https://react.dev/versions), [React lazy](https://react.dev/reference/react/lazy), [server rendering](https://react.dev/reference/react-dom/server/renderToString), [hydration](https://react.dev/reference/react-dom/client/hydrateRoot), and [esbuild API](https://esbuild.github.io/api/).

## Primary platform references

- [MCP TypeScript SDK v2 server API](https://ts.sdk.modelcontextprotocol.io/v2/api/%40modelcontextprotocol/server/)
- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Chrome extension permissions](https://developer.chrome.com/docs/extensions/reference/permissions-list)
- [Chrome Debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- [Chrome Tab Capture API](https://developer.chrome.com/docs/extensions/reference/api/tabCapture)
