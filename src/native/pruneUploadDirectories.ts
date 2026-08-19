import { rmdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, sep } from "node:path";

export const pruneUploadDirectories = async (path: string, root?: string) => {
  if (!root) return;
  let current = dirname(path);
  for (;;) {
    const child = relative(root, current);
    if (!child || child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) return;
    try {
      await rmdir(current);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!["ENOENT"].includes(code || "")) return;
    }
    current = dirname(current);
  }
};
