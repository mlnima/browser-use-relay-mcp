import { useEffect, useState } from "react";
import { RefreshIcon } from "../shared/icons";

type PortFieldProps = {
  disabled: boolean;
  port?: number;
  onApply: (port: number) => void;
};

export const PortField = ({ disabled, port, onApply }: PortFieldProps) => {
  const [value, setValue] = useState("");
  useEffect(() => setValue(port?.toString() || ""), [port]);

  const parsedPort = Number(value);
  const valid = value !== "" && Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535;
  const changed = value !== (port?.toString() || "");

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-100" htmlFor="relay-port">
        Port
      </label>
      <div className="flex gap-2">
        <input
          className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-black px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          id="relay-port"
          inputMode="numeric"
          max={65535}
          min={1}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Port"
          type="number"
          value={value}
        />
        <button
          aria-label="Apply port"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-500 text-black transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300/60 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
          disabled={disabled || !valid || !changed}
          onClick={() => onApply(parsedPort)}
          title="Apply port"
          type="button"
        >
          <RefreshIcon className={`size-4.5 ${disabled ? "animate-spin" : ""}`} />
        </button>
      </div>
      {value && !valid ? <p className="mt-2 text-xs text-rose-300">Enter a port from 1 to 65535.</p> : null}
    </div>
  );
};
