import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { RELAY_NETWORK_ADDRESS_ENV } from "./constants.js";
import { createNativeError } from "./nativeError.js";

type Candidate = { address: string; name: string };
const virtualName = /docker|veth|br-|bridge|virbr|vmnet|vbox|virtualbox|vethernet|hyper-v|wsl|tailscale|zerotier|hamachi|utun|(^|[^a-z])tun\d*|(^|[^a-z])tap\d*|awdl|llw|loopback/i;
const physicalName = /^(wi-?fi|wlan|wlp|ethernet|eth|enp|ens|eno|enx|en\d)/i;
const privateAddress = (address: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
const usableAddress = (address: string) => {
  if (isIP(address) !== 4) return false;
  const [first, second] = address.split(".").map(Number);
  return first !== 0 && first !== 127 && first < 224 && !(first === 169 && second === 254);
};
const candidates = () => Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
  (entries || []).filter((entry) => entry.family === "IPv4" && !entry.internal && usableAddress(entry.address))
    .map((entry) => ({ address: entry.address, name })),
);
const compareCandidates = (left: Candidate, right: Candidate) => {
  const leftScore = Number(privateAddress(left.address)) * 2 + Number(physicalName.test(left.name));
  const rightScore = Number(privateAddress(right.address)) * 2 + Number(physicalName.test(right.name));
  return rightScore - leftScore || left.name.localeCompare(right.name) || left.address.localeCompare(right.address);
};

export const selectRelayNetworkAddress = () => {
  const available = candidates();
  const override = process.env[RELAY_NETWORK_ADDRESS_ENV];
  if (override) {
    if (!usableAddress(override) || !available.some(({ address }) => address === override))
      throw createNativeError("INVALID_NETWORK_ADDRESS", `${RELAY_NETWORK_ADDRESS_ENV} must name an assigned non-loopback IPv4 address.`);
    return override;
  }
  const selected = available.filter(({ name }) => !virtualName.test(name)).sort(compareCandidates)[0]?.address;
  if (selected) return selected;
  throw createNativeError(
    "NETWORK_ADDRESS_UNAVAILABLE",
    `No usable LAN IPv4 address was found. Set ${RELAY_NETWORK_ADDRESS_ENV} to an assigned address.`,
  );
};
