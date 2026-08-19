import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname } from "node:path";
import { platform } from "node:os";
import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { requiredStringParam } from "./nativeParams.js";

const launch = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });

const commandFor = (path: string, reveal: boolean): [string, string[]] => {
  if (platform() === "win32") return ["explorer.exe", reveal ? [`/select,${path}`] : [path]];
  if (platform() === "darwin") return ["open", reveal ? ["-R", path] : [path]];
  return ["xdg-open", [reveal ? dirname(path) : path]];
};

export const executeNativeFileOpen = async (
  request: ActionRequest,
): Promise<JsonValue | undefined> => {
  const path = requiredStringParam(request, "path");
  const details = await stat(path);
  if (!details.isFile()) throw new Error("The native download path is not a file.");
  const [command, args] = commandFor(path, request.action === "revealDownload");
  await launch(command, args);
  return { path };
};
