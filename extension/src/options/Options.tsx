import { Feedback } from "../shared/feedback";
import { runtimeMessage } from "../shared/messages";
import { StatusBadge } from "../shared/status-badge";
import { Toggle } from "../shared/toggle";
import { useExtensionState } from "../shared/use-extension-state";
import { AddressLabel } from "./address-label";
import { PortField } from "./port-field";

export const Options = () => {
  const { state, error, loading, pending, refresh, update } = useExtensionState();

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-sky-400/20 bg-sky-400/10">
              <span className="size-2.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.8)]" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Browser Relay settings</h1>
              {state ? <StatusBadge message={state.statusMessage} status={state.status} /> : null}
            </div>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-500">
            Configure which network interface exposes the relay and the port used by MCP clients.
          </p>
        </header>

        <Feedback error={error} loading={loading} onRetry={() => void refresh()} />

        {state ? (
          <div className="space-y-4">
            {state.status === "error" ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-100">
                <p className="font-medium">The relay is unavailable.</p>
                <p className="mt-1 text-xs leading-5 text-rose-200/80">Check native messaging host registration and reload the extension after fixing it.</p>
              </div>
            ) : null}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black">
              <h2 className="mb-4 text-sm font-semibold text-zinc-100">Network access</h2>
              <Toggle
                checked={state.settings.externalAccess}
                description="Allow MCP clients on the local network to connect."
                disabled={pending}
                label="External Access"
                onChange={(enabled) =>
                  void update({ type: runtimeMessage.setExternalAccess, enabled })
                }
              />
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                 <AddressLabel label="Local IP" value={state.addresses.localIp || "127.0.0.1"} />
                {state.settings.externalAccess ? (
                  <AddressLabel label="Local network IP" value={state.addresses.networkIp} />
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black">
              <PortField
                disabled={pending}
                onApply={(port) => void update({ type: runtimeMessage.applyPort, port })}
                port={state.settings.port}
              />
              {state.statusMessage ? (
                <p className={`mt-4 border-t border-zinc-800 pt-4 text-xs leading-5 ${state.status === "error" ? "text-rose-200" : "text-zinc-500"}`}>
                  {state.statusMessage}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
};
