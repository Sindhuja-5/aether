"""Compare embedding models and suitable retrieval/ranking methods locally.
"""

import argparse
import json
import math
import re
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

try:
    import psutil
except ImportError:
    psutil = None

ROOT = Path(__file__).resolve().parent
CORPUS = json.loads((ROOT / "corpus-v2.json").read_text(encoding="utf-8"))
EVAL = json.loads((ROOT / "queries-v2.json").read_text(encoding="utf-8"))
STORIES = CORPUS["stories"]
QUERIES = EVAL["queries"]
OUTPUT = ROOT / "experiments-v1.json"
TOKEN_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)
MODELS = [
    {"id": "sentence-transformers/all-MiniLM-L6-v2", "queryPrefix": "", "passagePrefix": "", "license": "Apache-2.0", "maxInputTokens": 256, "modelCardUrl": "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2"},
    {"id": "sentence-transformers/all-mpnet-base-v2", "queryPrefix": "", "passagePrefix": "", "license": "Apache-2.0", "maxInputTokens": 384, "modelCardUrl": "https://huggingface.co/sentence-transformers/all-mpnet-base-v2"},
    {"id": "intfloat/e5-small-v2", "queryPrefix": "query: ", "passagePrefix": "passage: ", "license": "MIT", "maxInputTokens": 512, "modelCardUrl": "https://huggingface.co/intfloat/e5-small-v2"},
]


def tokens(text):
    return TOKEN_RE.findall(text.lower())


def body_chunks(text):
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]


def ranked_metrics(rankings, queries, k=3):
    recalls, reciprocal_ranks, ndcgs, precisions = [], [], [], []
    for query in queries:
        grades = query["relevant"]
        found = [grades.get(hit["id"], 0) for hit in rankings[query["id"]][:k]]
        recalls.append(int(any(grade == 2 for grade in found)))
        reciprocal_ranks.append(next((1 / i for i, grade in enumerate(found, 1) if grade == 2), 0))
        precisions.append(sum(grade == 2 for grade in found) / k)
        dcg = sum((2**grade - 1) / np.log2(i + 1) for i, grade in enumerate(found, 1))
        ideal = sorted(grades.values(), reverse=True)[:k]
        idcg = sum((2**grade - 1) / np.log2(i + 1) for i, grade in enumerate(ideal, 1))
        ndcgs.append(dcg / idcg if idcg else 0)
    return {
        "queryCount": len(queries),
        "recall@3": round(float(np.mean(recalls)), 6),
        "mrr@3": round(float(np.mean(reciprocal_ranks)), 6),
        "precision@3": round(float(np.mean(precisions)), 6),
        "ndcg@3": round(float(np.mean(ndcgs)), 6),
    }


def metric_groups():
    return {
        "all": QUERIES,
        "semanticParaphrases": [q for q in QUERIES if q["kind"] == "semantic paraphrase"],
        "exactOrMetadata": [q for q in QUERIES if q["kind"].startswith("exact") or "author" in q["kind"]],
        "noHit": [q for q in QUERIES if "no-hit" in q["kind"]],
    }


def make_rankings(score_matrix, higher_is_better=True):
    result = {}
    for qi, query in enumerate(QUERIES):
        order = sorted(range(len(STORIES)), key=lambda i: ((-1 if higher_is_better else 1) * float(score_matrix[qi, i]), i))
        result[query["id"]] = [
            {"id": STORIES[i]["id"], "title": STORIES[i]["title"], "score": round(float(score_matrix[qi, i]), 7)}
            for i in order
        ]
    return result


def bm25_scores():
    """Small in-process Okapi BM25 reference implementation (k1=1.2, b=.75)."""
    docs = [tokens(" ".join([s["title"], s["author"], s["body"], *s["tags"]])) for s in STORIES]
    lengths = np.asarray([len(doc) for doc in docs], dtype=np.float64)
    avg_len = float(np.mean(lengths)) if len(lengths) else 0
    doc_freq = {}
    frequencies = []
    for doc in docs:
        freq = {}
        for term in doc:
            freq[term] = freq.get(term, 0) + 1
        frequencies.append(freq)
        for term in freq:
            doc_freq[term] = doc_freq.get(term, 0) + 1
    matrix = np.zeros((len(QUERIES), len(STORIES)), dtype=np.float64)
    n = len(STORIES)
    for qi, query in enumerate(QUERIES):
        for term in set(tokens(query["query"])):
            df = doc_freq.get(term, 0)
            if not df:
                continue
            idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
            for di, freq in enumerate(frequencies):
                tf = freq.get(term, 0)
                if tf:
                    denom = tf + 1.2 * (1 - 0.75 + 0.75 * lengths[di] / max(avg_len, 1))
                    matrix[qi, di] += idf * tf * 2.2 / denom
    return matrix


def rrf_rankings(left, right, constant=60):
    matrix = np.zeros((len(QUERIES), len(STORIES)), dtype=np.float64)
    for qi, query in enumerate(QUERIES):
        qid = query["id"]
        for source in (left, right):
            for rank, hit in enumerate(source[qid], 1):
                matrix[qi, next(i for i, story in enumerate(STORIES) if story["id"] == hit["id"])] += 1 / (constant + rank)
    return make_rankings(matrix)


def mmr_rankings(query_doc_cos, doc_doc_cos, lambda_relevance=0.75):
    rankings = {}
    for qi, query in enumerate(QUERIES):
        remaining, selected, scored = set(range(len(STORIES))), [], []
        while remaining:
            best = None
            best_score = -float("inf")
            for candidate in remaining:
                redundancy = max((float(doc_doc_cos[candidate, prior]) for prior in selected), default=0.0)
                score = lambda_relevance * float(query_doc_cos[qi, candidate]) - (1 - lambda_relevance) * redundancy
                if score > best_score:
                    best, best_score = candidate, score
            selected.append(best)
            remaining.remove(best)
            scored.append({"id": STORIES[best]["id"], "title": STORIES[best]["title"], "score": round(best_score, 7)})
        rankings[query["id"]] = scored
    return rankings


class RssMonitor:
    def __init__(self):
        self.process = psutil.Process() if psutil else None
        self.peak = 0
        self.stop = threading.Event()
        self.thread = None

    def _sample(self):
        while not self.stop.wait(0.02):
            self.peak = max(self.peak, self.process.memory_info().rss)

    def start(self):
        if self.process:
            self.peak = self.process.memory_info().rss
            self.thread = threading.Thread(target=self._sample, daemon=True)
            self.thread.start()

    def end(self):
        if self.thread:
            self.stop.set()
            self.thread.join()
            self.peak = max(self.peak, self.process.memory_info().rss)
        return self.peak


def encode(model, texts, prefix=""):
    return model.encode([prefix + text for text in texts], normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)


def run_model(spec, allow_downloads):
    model_id = spec["id"]
    monitor = RssMonitor()
    rss_before = monitor.process.memory_info().rss if monitor.process else None
    monitor.start()
    load_start = time.perf_counter()
    model = SentenceTransformer(model_id, local_files_only=not allow_downloads, device="cpu")
    load_ms = (time.perf_counter() - load_start) * 1000
    rss_after_load = monitor.process.memory_info().rss if monitor.process else None

    title_texts = [s["title"] or "empty title" for s in STORIES]
    chunk_texts = [body_chunks(s["body"]) for s in STORIES]
    tag_texts = [s["tags"] for s in STORIES]
    all_passages = title_texts[:]
    all_passages.extend(text for parts in chunk_texts for text in parts)
    all_passages.extend(text for tags in tag_texts for text in tags)
    indexed_vector_count = len(all_passages)
    all_passages.extend(" ".join([s["title"], s["body"], *s["tags"]]) for s in STORIES)
    passages = encode(model, all_passages, spec["passagePrefix"])
    cursor = 0
    title_vectors = passages[cursor:cursor + len(STORIES)]; cursor += len(STORIES)
    body_vectors = []
    for parts in chunk_texts:
        body_vectors.append(passages[cursor:cursor + len(parts)])
        cursor += len(parts)
    tag_vectors = []
    for tags in tag_texts:
        tag_vectors.append(passages[cursor:cursor + len(tags)])
        cursor += len(tags)
    whole_vectors = passages[cursor:cursor + len(STORIES)]

    query_texts = [q["query"] for q in QUERIES]
    query_start = time.perf_counter()
    query_vectors = encode(model, query_texts, spec["queryPrefix"])
    query_batch_ms = (time.perf_counter() - query_start) * 1000
    # Warmed, single-query path approximation; report median and p95 over fixed query set.
    single_ms = []
    for query in query_texts:
        start = time.perf_counter()
        encode(model, [query], spec["queryPrefix"])
        single_ms.append((time.perf_counter() - start) * 1000)

    whole_cos = query_vectors @ whole_vectors.T
    title_cos = query_vectors @ title_vectors.T
    body_cos = np.array([[max((float(qv @ v) for v in vecs), default=-1) for vecs in body_vectors] for qv in query_vectors])
    topic_cos = np.array([[max((float(qv @ v) for v in vecs), default=-1) for vecs in tag_vectors] for qv in query_vectors])
    field_cos = np.maximum(np.maximum(title_cos, body_cos), topic_cos)
    bm25 = bm25_scores()

    rankers = {}
    scoring_ms = {}
    for name, matrix, higher in [
        ("cosine_whole_document", whole_cos, True),
        ("dot_product_normalized", query_vectors @ whole_vectors.T, True),
        ("euclidean_normalized", np.sqrt(np.maximum(0, 2 - 2 * whole_cos)), False),
        ("field_max_current_service", field_cos, True),
        ("bm25_lexical", bm25, True),
    ]:
        start = time.perf_counter()
        rankers[name] = make_rankings(matrix, higher)
        scoring_ms[name] = (time.perf_counter() - start) * 1000
    start = time.perf_counter()
    rankers["rrf_bm25_plus_field_max"] = rrf_rankings(rankers["bm25_lexical"], rankers["field_max_current_service"])
    scoring_ms["rrf_bm25_plus_field_max"] = (time.perf_counter() - start) * 1000
    start = time.perf_counter()
    rankers["mmr_lambda_0_75"] = mmr_rankings(whole_cos, whole_vectors @ whole_vectors.T)
    scoring_ms["mmr_lambda_0_75"] = (time.perf_counter() - start) * 1000

    groups = metric_groups()
    summary = {name: {group: ranked_metrics(ranking, queries) for group, queries in groups.items()} for name, ranking in rankers.items()}
    peak_rss = monitor.end()
    vector_count = indexed_vector_count
    model_card_revision = getattr(model[0].auto_model.config, "_commit_hash", None)
    if not model_card_revision:
        repo_dir = Path.home() / ".cache" / "huggingface" / "hub" / f"models--{model_id.replace('/', '--')}" / "snapshots"
        snapshots = sorted(path.name for path in repo_dir.iterdir() if path.is_dir()) if repo_dir.exists() else []
        model_card_revision = snapshots[0] if len(snapshots) == 1 else None
    return {
        "model": model_id,
        "modelCard": {k: spec[k] for k in ("license", "maxInputTokens", "modelCardUrl")},
        "queryPrefix": spec["queryPrefix"] or "none",
        "passagePrefix": spec["passagePrefix"] or "none",
        "dimensions": int(model.get_embedding_dimension()),
        "modelRevision": model_card_revision,
        "timing": {
            "loadMs": round(load_ms, 2),
            "documentAndFieldEmbeddingMs": round((query_start - (load_start + load_ms / 1000)) * 1000, 2),
            "queryBatch25Ms": round(query_batch_ms, 2),
            "singleQueryMsP50": round(float(np.percentile(single_ms, 50)), 2),
            "singleQueryMsP95": round(float(np.percentile(single_ms, 95)), 2),
            "rankingAlgorithmsMs": {k: round(v, 3) for k, v in scoring_ms.items()},
        },
        "memory": {
            "processRssBeforeModelBytes": rss_before,
            "processRssAfterModelLoadBytes": rss_after_load,
            "sampledPeakRssBytes": peak_rss,
            "rssDeltaAtLoadBytes": (rss_after_load - rss_before) if rss_before is not None else None,
            "indexedVectorCount": vector_count,
            "wholeDocumentComparisonVectorCount": len(STORIES),
            "embeddingBatchVectorCount": len(passages),
            "embeddingPayloadFloat32Bytes": int(passages[:vector_count].nbytes),
            "estimatedMongoNumericPayloadFloat64Bytes": int(vector_count * passages.shape[1] * 8),
            "note": "Process RSS includes Python, Torch, Transformers, and model runtime; sampled every 20 ms. Float64 Mongo estimate excludes BSON/document/index overhead.",
        },
        "summary": summary,
        "rankings": rankers,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-downloads", action="store_true", help="allow downloading uncached model checkpoints")
    parser.add_argument("--worker-model", choices=[m["id"] for m in MODELS], help=argparse.SUPPRESS)
    parser.add_argument("--worker-output", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker_model:
        spec = next(m for m in MODELS if m["id"] == args.worker_model)
        result = run_model(spec, args.allow_downloads)
        Path(args.worker_output).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        print(f"Completed isolated measurement for {args.worker_model}", flush=True)
        return

    existing = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    comparisons = []
    for spec in MODELS:
        print(f"Loading and evaluating {spec['id']} in an isolated CPU process", flush=True)
        fd, result_path = tempfile.mkstemp(prefix=".model-eval-", suffix=".json", dir=ROOT)
        import os
        os.close(fd)
        command = [sys.executable, str(Path(__file__).resolve()), "--worker-model", spec["id"], "--worker-output", result_path]
        if args.allow_downloads:
            command.append("--allow-downloads")
        try:
            subprocess.run(command, check=True, cwd=ROOT.parent.parent)
            comparisons.append(json.loads(Path(result_path).read_text(encoding="utf-8")))
        finally:
            Path(result_path).unlink(missing_ok=True)
    methods = {item["model"]: {name: data for name, data in item["summary"].items()} for item in comparisons}
    # Retain the original MiniLM analysis and append the new reproducible run.
    existing["schemaVersion"] = 2
    existing["corpusCount"] = len(STORIES)
    existing["queryCount"] = len(QUERIES)
    existing["measurementEnvironment"] = {
        "date": time.strftime("%Y-%m-%d"),
        "device": "CPU",
        "modelLoading": "isolated process per model; local cached weights; load time excludes initial download",
        "metric": "25 owner-independent evaluator-authored queries over the same 15-story export",
        "limitations": ["small synthetic query set", "flattened body export; sentence split approximates production chunks", "Atlas Search unavailable", "single local runtime; timing is not production latency"],
    }
    existing["modelComparisons"] = comparisons
    existing["rankingAlgorithmComparisons"] = methods
    OUTPUT.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"rankingAlgorithmComparisons": methods,
                      "measurements": [{"model": c["model"], "timing": c["timing"], "memory": c["memory"]} for c in comparisons]}, indent=2))
    print(f"Updated {OUTPUT}")


if __name__ == "__main__":
    main()
