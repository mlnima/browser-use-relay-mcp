import { useState } from "react";
import { UNAVAILABLE_VALUE } from "./display";
import { CheckIcon, CopyIcon } from "./icons";

type AddressRowProps = {
  address?: string;
  label: string;
};

export const AddressRow = ({ address, label }: AddressRowProps) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <button
          aria-label={`Copy ${label}`}
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:border-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!address}
          onClick={() => void copy()}
          title={`Copy ${label}`}
          type="button"
        >
          {copied ? <CheckIcon className="size-4 text-emerald-400" /> : <CopyIcon />}
        </button>
        <span className="min-w-0 select-all truncate font-mono text-xs text-zinc-200">
          {address || UNAVAILABLE_VALUE}
        </span>
      </div>
    </div>
  );
};
