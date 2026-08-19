export type ActionCapability = readonly [name: string, available: boolean];

export const apiCapability = (
  owner: unknown,
  member: string,
  name: string,
): ActionCapability => [
  name,
  Boolean((owner as Record<string, unknown> | undefined)?.[member]),
];

export const combinedCapability = (
  name: string,
  ...members: Array<unknown>
): ActionCapability => [name, members.every(Boolean)];

export const assertActionCapability = (capability?: ActionCapability) => {
  if (capability && !capability[1]) {
    throw new Error(`${capability[0]} is not available in this browser.`);
  }
};
