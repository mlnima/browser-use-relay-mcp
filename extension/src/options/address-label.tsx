type AddressLabelProps = {
  label: string;
  value?: string;
};

export const AddressLabel = ({ label, value }: AddressLabelProps) => (
  <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">
    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</div>
    <div className="mt-1.5 select-all font-mono text-sm text-zinc-200">{value || UNAVAILABLE_VALUE}</div>
  </div>
);
import { UNAVAILABLE_VALUE } from "../shared/display";
