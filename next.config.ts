import type { NextConfig } from "next";

const sharpRuntimeFiles = [
  './node_modules/@huggingface/transformers/node_modules/sharp/**/*',
  './node_modules/@huggingface/transformers/node_modules/@img/sharp-linux-x64/**/*',
  './node_modules/@huggingface/transformers/node_modules/@img/sharp-libvips-linux-x64/**/*',
  './node_modules/sharp/**/*',
  './node_modules/@img/sharp-linux-x64/**/*',
  './node_modules/@img/sharp-libvips-linux-x64/**/*',
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    // Sharp's native binding loads libvips at runtime; include both the
    // Transformers.js nested copy and any hoisted copy in Vercel functions.
    '/api/blogs': sharpRuntimeFiles,
    '/api/blogs/*': sharpRuntimeFiles,
  },
};

export default nextConfig;
