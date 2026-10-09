import { watch } from 'node:fs';
import { fork } from 'node:child_process';
import { resolve } from 'node:path';
import { buildApp, appRoot, outputRoot } from './build.mjs';

let child;
let closing = false;
let queued = false;
let rebuilding = false;
let timer;
const stopChild = () => new Promise((done) => {
  if (!child || child.exitCode !== null) return done();
  child.once('exit', done);
  child.send('shutdown');
});
const rebuild = async () => {
  if (rebuilding || closing) return void (queued = !closing);
  rebuilding = true;
  await stopChild();
  try {
    await buildApp(true);
    if (!closing) child = fork(resolve(outputRoot, 'server.mjs'), [], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
  } catch (error) { process.stderr.write(`${error.message}\n`); }
  rebuilding = false;
  if (queued && !closing) { queued = false; await rebuild(); }
};
await rebuild();
const watcher = watch(resolve(appRoot, 'src'), { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 180);
});
const close = async () => {
  closing = true;
  watcher.close();
  clearTimeout(timer);
  await stopChild();
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
