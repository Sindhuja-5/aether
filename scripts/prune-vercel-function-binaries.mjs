import fs from 'node:fs';
import path from 'node:path';

if (process.env.VERCEL !== '1') {
  console.log('Skipping Vercel function pruning outside a Vercel build.');
  process.exit(0);
}

if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error(`Expected a Linux x64 Vercel build; got ${process.platform}/${process.arch}.`);
}

const projectRoot = fs.realpathSync(process.cwd());
const candidates = [
  process.env.VERCEL_OUTPUT_DIR,
  path.join(projectRoot, '.vercel', 'output'),
  '/vercel/output',
].filter(Boolean);
const outputRoot = candidates.find((candidate) =>
  fs.existsSync(path.join(candidate, 'functions'))
);

if (!outputRoot) {
  throw new Error(`Could not find Vercel's generated functions directory. Checked: ${candidates.join(', ')}`);
}

const functionsRoot = path.join(outputRoot, 'functions');
const functionEntries = fs.readdirSync(functionsRoot, { withFileTypes: true });
let prunedFunctionCount = 0;

for (const entry of functionEntries) {
  if (!entry.name.endsWith('.func')) continue;
  const functionRoot = path.join(functionsRoot, entry.name);
  const binaryRoot = path.join(functionRoot, 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6');
  const requiredRuntime = path.join(binaryRoot, 'linux', 'x64');

  if (!fs.existsSync(binaryRoot)) continue;
  if (!fs.existsSync(path.join(requiredRuntime, 'onnxruntime_binding.node')) ||
      !fs.existsSync(path.join(requiredRuntime, 'libonnxruntime.so.1'))) {
    throw new Error(`Required Linux x64 ONNX Runtime files are missing from ${functionRoot}.`);
  }

  for (const relativePath of ['darwin', 'win32', path.join('linux', 'arm64')]) {
    const target = path.resolve(binaryRoot, relativePath);
    const relativeTarget = path.relative(binaryRoot, target);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
      throw new Error(`Refusing to remove a path outside the ONNX Runtime binary directory: ${target}`);
    }
    fs.rmSync(target, { recursive: true, force: true });
  }

  prunedFunctionCount += 1;
  console.log(`Pruned non-Linux-x64 ONNX binaries from ${entry.name}.`);
}

if (prunedFunctionCount === 0) {
  throw new Error(`No Vercel function bundles containing onnxruntime-node were found under ${functionsRoot}.`);
}

console.log(`Kept Linux x64 ONNX Runtime binaries in ${prunedFunctionCount} Vercel function bundle(s).`);
