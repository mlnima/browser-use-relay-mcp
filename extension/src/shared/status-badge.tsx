import type { RelayStatus } from "./model";

const statusStyle: Record<RelayStatus, string> = {
  connected: "bg-emerald-400 shadow-emerald-400/40",
  listening: "bg-sky-400 shadow-sky-400/40",
  connecting: "bg-amber-400 shadow-amber-400/40",
  disconnected: "bg-zinc-600 shadow-zinc-600/30",
  error: "bg-rose-400 shadow-rose-400/40",
};

const statusLabel: Record<RelayStatus, string> = {
  connected: "Connected",
  listening: "Listening",
  connecting: "Connecting",
  disconnected: "Disconnected",
  error: "Connection error",
};

export const StatusBadge = ({ status, message }: { status: RelayStatus; message?: string }) => (
  <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
    <span className={`size-2 rounded-full shadow-[0_0_10px] ${statusStyle[status]}`} />
    <span title={message}>{status === "error" && message ? "Relay unavailable" : statusLabel[status]}</span>
  </div>
);
