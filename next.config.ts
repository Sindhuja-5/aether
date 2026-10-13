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
    '/api/blogs': transformerRuntimeFiles,
    '/api/blogs/\\[id\\]': transformerRuntimeFiles,
  },
};

export default nextConfig;
