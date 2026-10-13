import fs from 'node:fs';
import path from 'node:path';

if (process.env.VERCEL !== '1') {
  console.log('Skipping ONNX Runtime pruning outside a Vercel build.');
  process.exit(0);
}

if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error(`Expected a Linux x64 Vercel build; got ${process.platform}/${process.arch}.`);
}

const projectRoot = fs.realpathSync(process.cwd());
const packageRoot = fs.realpathSync(path.join(projectRoot, 'node_modules', 'onnxruntime-node'));
const binRoot = path.join(packageRoot, 'bin', 'napi-v6');
const requiredRuntime = path.join(binRoot, 'linux', 'x64');

if (!fs.existsSync(path.join(requiredRuntime, 'onnxruntime_binding.node')) ||
    !fs.existsSync(path.join(requiredRuntime, 'libonnxruntime.so.1'))) {
  throw new Error('The required Linux x64 ONNX Runtime binaries are missing; refusing to prune the package.');
}

for (const relativePath of ['darwin', 'win32', path.join('linux', 'arm64')]) {
  const target = path.resolve(binRoot, relativePath);
  const relativeTarget = path.relative(binRoot, target);
  if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    throw new Error(`Refusing to remove a path outside the ONNX Runtime binary directory: ${target}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
}

console.log('Kept ONNX Runtime Linux x64 binaries; removed unused macOS, Windows, and Linux ARM64 binaries.');
