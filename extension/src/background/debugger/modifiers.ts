export const modifierMask = (values: unknown) => {
  const names = Array.isArray(values) ? values.map(String) : typeof values === "string" ? values.split("+") : [];
  return names.reduce((mask, name) => mask
    | (/^(alt|option)(left|right)?$|^altgraph$/i.test(name) ? 1 : 0)
    | (/^(ctrl|control)(left|right)?$/i.test(name) ? 2 : 0)
    | (/^(meta|command|cmd)(left|right)?$|^os$/i.test(name) ? 4 : 0)
    | (/^shift(left|right)?$/i.test(name) ? 8 : 0), 0);
};
