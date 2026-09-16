import { useEffect, useState } from "react";
import { MAX_TIMER_MS } from "../../../src/protocol/limits.js";
import { Feedback } from "../shared/feedback";
import { runtimeMessage } from "../shared/messages";
import type { ExtensionSettings } from "../shared/model";
import { StatusBadge } from "../shared/status-badge";
import { Toggle } from "../shared/toggle";
import { useExtensionState } from "../shared/use-extension-state";
import { AddressLabel } from "./address-label";
import { PortField } from "./port-field";

const ActionDelayFields = ({ settings, disabled, onApply }: {
  settings: ExtensionSettings;
  disabled: boolean;
  onApply: (actionDelayMinMs?: number, actionDelayMaxMs?: number) => void;
}) => {
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  useEffect(() => {
    setMinimum(settings.actionDelayMinMs?.toString() || "");
    setMaximum(settings.actionDelayMaxMs?.toString() || "");
  }, [settings.actionDelayMinMs, settings.actionDelayMaxMs]);
  const parsedMinimum = minimum === "" ? undefined : Number(minimum);
  const parsedMaximum = maximum === "" ? undefined : Number(maximum);
  const valid = [parsedMinimum, parsedMaximum].every((value) => value === undefined ||
    Number.isSafeInteger(value) && value >= 0 && value <= MAX_TIMER_MS) &&
    (parsedMinimum === undefined || parsedMaximum === undefined || parsedMaximum >= parsedMinimum);
  const changed = minimum !== (settings.actionDelayMinMs?.toString() || "") ||
    maximum !== (settings.actionDelayMaxMs?.toString() || "");

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black">
      <h2 className="mb-2 text-sm font-semibold text-zinc-100">Action delay</h2>
      <p className="mb-4 text-xs leading-5 text-zinc-500">
        Delay between browser actions. Set either value for a fixed delay, or both for a range.
        Leave both blank for no delay unless provided by MCP configuration, which takes precedence.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-100" htmlFor="action-delay-minimum">Minimum action delay (ms)</label>
          <input
            className="h-11 w-full min-w-0 rounded-xl border border-zinc-800 bg-black px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            disabled={disabled}
            id="action-delay-minimum"
            inputMode="numeric"
            max={MAX_TIMER_MS}
            min={0}
            onChange={(event) => setMinimum(event.target.value)}
            placeholder="Minimum delay"
            step={1}
            type="number"
            value={minimum}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-100" htmlFor="action-delay-maximum">Maximum action delay (ms)</label>
          <input
            className="h-11 w-full min-w-0 rounded-xl border border-zinc-800 bg-black px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            disabled={disabled}
            id="action-delay-maximum"
            inputMode="numeric"
            max={MAX_TIMER_MS}
            min={0}
            onChange={(event) => setMaximum(event.target.value)}
            placeholder="Maximum delay"
            step={1}
            type="number"
            value={maximum}
          />
        </div>
      </div>
      {!valid ? <p className="mt-2 text-xs text-rose-300">Enter whole milliseconds from 0 to {MAX_TIMER_MS}, with maximum at least minimum.</p> : null}
      <button
        className="mt-4 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300/60 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
        disabled={disabled || !valid || !changed}
        onClick={() => onApply(parsedMinimum, parsedMaximum)}
        type="button"
      >
        Apply action delay
      </button>
    </section>
  );
};

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

            <ActionDelayFields
              disabled={pending}
              onApply={(actionDelayMinMs, actionDelayMaxMs) => void update({ type: runtimeMessage.applyActionDelay, actionDelayMinMs, actionDelayMaxMs })}
              settings={state.settings}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
};
