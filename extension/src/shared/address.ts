export const formatRelayEndpoint = (address?: string, port?: number) => {
  if (!address || !port) return undefined;

  const host = address.includes(":") && !address.startsWith("[") ? `[${address}]` : address;
  return `ws://${host}:${port}`;
};
