type ToggleProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description?: string;
  onChange: (checked: boolean) => void;
};

export const Toggle = ({ checked, disabled, label, description, onChange }: ToggleProps) => (
  <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      <div className="text-sm font-medium text-zinc-100">{label}</div>
      {description ? <div className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</div> : null}
    </div>
    <button
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled}
      className={`relative h-7 w-12 shrink-0 rounded-full border p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "border-sky-300 bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.25)]" : "border-zinc-700 bg-zinc-900"
      }`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={`block size-5 rounded-full bg-white shadow-md transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  </div>
);
