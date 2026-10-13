# Aether model inference service

This service runs Aether's existing MiniLM embedding model and moderation classifiers outside the Next.js/Vercel functions. Vercel sends inference requests here; MongoDB reads, writes, search ranking, and UI responses remain in the main app.

## Endpoints

- `GET /health` — basic process health check.
- `POST /v1/embed` — accepts `{ "texts": ["..."] }` and returns normalized 384-value vectors with the embedding model version.
- `POST /v1/moderate` — accepts `{ "title": "...", "body": { ... } }` and returns the same moderation status, score, model version, and timestamp shape used by Aether.

Inference endpoints require `Authorization: Bearer <MODEL_SERVICE_TOKEN>`. The service does not enable browser CORS.

## Run locally

From this directory, set `MODEL_SERVICE_TOKEN` to a long random value, then run:

```sh
npm install
npm start
```

The first inference downloads the models. Set `TRANSFORMERS_CACHE_DIR` to a persistent writable directory if you want model files to survive restarts. The default port is `8080`; `PORT` and `HOST` can override it.

## Connect the Next.js app

Set these server-side environment variables in the app's local environment and Vercel project:

- `MODEL_SERVICE_URL` — the service's HTTPS base URL, without a trailing slash.
- `MODEL_SERVICE_TOKEN` — the same secret configured on the service.

Keep the token private; do not prefix it with `NEXT_PUBLIC_`. Search and moderation inference will fail with a clear configuration error until a reachable service and matching token are configured. Atlas lexical search and non-search feeds do not call the model service.

## Container

Build and run from the repository root:

```sh
docker build -t aether-inference ./inference-service
docker run --rm -p 8080:8080 -e MODEL_SERVICE_TOKEN="replace-with-a-long-random-secret" -v aether-model-cache:/data/models aether-inference
```

Deploy this container to a Node/container host that supports persistent disk if you want to avoid downloading model files after restarts. The container and model downloads still need enough memory, storage, and CPU for inference. This moves those requirements off Vercel; it does not remove them.
