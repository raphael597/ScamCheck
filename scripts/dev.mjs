// Starts the API server and the Vite dev server side by side (npm run dev).
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const procs = [
  ['server', '\x1b[34m'],
  ['web', '\x1b[36m'],
].map(([name, color]) => {
  const child = spawn(npm, ['run', 'dev', '-w', name], { stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const prefix = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) => stream.on('data', (d) => out.write(d.toString().replace(/^(?=.)/gm, prefix)));
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${prefix}beendet (${code ?? 'signal'})`);
    procs.forEach((p) => p.kill());
    process.exit(code ?? 0);
  });
  return child;
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => procs.forEach((p) => p.kill(sig)));
