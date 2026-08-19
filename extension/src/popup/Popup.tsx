import { AddressRow } from "../shared/address-row";
import { formatRelayEndpoint } from "../shared/address";
import { Feedback } from "../shared/feedback";
import { GearIcon } from "../shared/icons";
import { runtimeMessage } from "../shared/messages";
import { StatusBadge } from "../shared/status-badge";
import { Toggle } from "../shared/toggle";
import { useExtensionState } from "../shared/use-extension-state";

export const Popup = () => {
  const { state, error, loading, pending, refresh, update } = useExtensionState();
  const localEndpoint = formatRelayEndpoint(state?.addresses.localIp || "127.0.0.1", state?.settings.port);
  const networkEndpoint = formatRelayEndpoint(state?.addresses.networkIp, state?.settings.port);

  return (
    <main className="w-[360px] bg-black p-4 text-zinc-100">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl border border-sky-400/20 bg-sky-400/10">
            <span className="size-2.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.8)]" />
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Browser Relay</h1>
            {state ? <StatusBadge message={state.statusMessage} status={state.status} /> : null}
          </div>
        </div>
        <button
          aria-label="Open settings"
          className="grid size-9 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 transition hover:border-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          onClick={() => void update({ type: runtimeMessage.openOptions })}
          title="Settings"
          type="button"
        >
          <GearIcon className="size-4.5" />
        </button>
      </header>

      <Feedback error={error} loading={loading} onRetry={() => void refresh()} />

      {state ? (
        <div className="space-y-3">
          {state.status === "error" ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-3 text-xs leading-5 text-rose-100">
              Check native messaging host registration, then reload the extension.
            </div>
          ) : null}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <Toggle
              checked={state.settings.enabled}
              description={
                !state.settings.enabled ? "Disabled" : state.status === "error" ? "Unavailable — install the native host" : state.status === "connected" ? "Connected and ready" : state.status === "listening" ? "Ready for MCP clients" : "Starting relay…"
              }
              disabled={pending}
              label="Browser control"
              onChange={(enabled) => void update({ type: runtimeMessage.setEnabled, enabled })}
            />
            {state.statusMessage ? (
                <p className={`mt-3 border-t border-zinc-800 pt-3 text-xs leading-5 ${state.status === "error" ? "text-rose-200" : "text-zinc-500"}`}>
                {state.statusMessage}
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <AddressRow address={localEndpoint} label="Local relay" />
            {state.settings.externalAccess ? (
              <AddressRow address={networkEndpoint} label="Local network relay" />
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
};
