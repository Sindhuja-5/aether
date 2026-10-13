import type { NextConfig } from "next";

const transformerRuntimeFiles = [
  './node_modules/@huggingface/transformers/node_modules/sharp/**/*',
  './node_modules/@huggingface/transformers/node_modules/@img/sharp-linux-x64/**/*',
  './node_modules/@huggingface/transformers/node_modules/@img/sharp-libvips-linux-x64/**/*',
  './node_modules/sharp/**/*',
  './node_modules/@img/sharp-linux-x64/**/*',
  './node_modules/@img/sharp-libvips-linux-x64/**/*',
  './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/package.json',
  './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/dist/**/*',
  './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**/*',
  './node_modules/@huggingface/transformers/node_modules/onnxruntime-common/**/*',
  './node_modules/onnxruntime-node/package.json',
  './node_modules/onnxruntime-node/dist/**/*',
  './node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**/*',
  './node_modules/onnxruntime-common/**/*',
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    // Transformers.js loads Sharp and ONNX Runtime through external/dynamic
    // imports, which file tracing does not reliably discover on Vercel.
    '/api/blogs': transformerRuntimeFiles,
    '/api/blogs/*': transformerRuntimeFiles,
  },
  outputFileTracingExcludes: {
    // ONNX Runtime's npm package contains native binaries for several
    // operating systems and architectures. Vercel runs these functions on
    // Linux x64, so tracing the other binaries only inflates the bundle.
    '/api/blogs': [
      './node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*',
      './node_modules/onnxruntime-node/bin/napi-v6/win32/**/*',
      './node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*',
      './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*',
      './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v6/win32/**/*',
      './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*',
    ],
    '/api/blogs/*': [
      './node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*',
      './node_modules/onnxruntime-node/bin/napi-v6/win32/**/*',
      './node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*',
      './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*',
      './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v6/win32/**/*',
      './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*',
    ],
  },
};

export default nextConfig;
