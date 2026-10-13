# Aether | Tell your stories

**Aether** is a professional, full-stack story publishing platform built with Next.js, MongoDB, and AWS S3. It offers a seamless writing experience coupled with a beautiful, high-performance reader interface.

## ✨ Key Features

- 📊 **Feed**: View all public stories, including a curated tab with an auto-filter based on interests selected in your profile settings.
- 🔍 **Discovery**: Global search functionality and content filtering to discover stories across the community.
- 🧠 **Semantic Search**: The search combines Atlas fuzzy text search with pretrained MiniLM meaning-based retrieval.
- 🛡️ **Content Moderation**: Pretrained classifiers flag stories that may contain spam, scams, or toxic content and show readers a warning.
- 🧡 **Favorites System**: Save your favorite stories to your personal library.
- 🔐 **Authentication**: Secure login and profile management powered by **Auth0**.
- 📁 **Cloud Storage**: Image management with **AWS S3** integration for reliable media delivery.
- 🖋️ **Elite Editor**: Rich text editor with custom formatting and **Cover Image** support.
- 📖 **Reader Preview**: High-fidelity reading experience for all published stories.



## Semantic Search: Evaluation and Current Choice

The current choice is **MiniLM embeddings with the existing field-max cosine scorer and reciprocal-rank fusion (RRF) with Atlas Search**. The model and ranking alternatives below were evaluated offline on a snapshot of 15 stories and 25 evaluator-written queries. These are useful for comparing options, but they are not production search logs or a large relevance benchmark. Full per-query scores, timings, and memory estimates are in [experiments-v1.json](docs/search/experiments-v1.json), using the saved [corpus](docs/search/corpus-v2.json) and [queries and relevance labels](docs/search/queries-v2.json).

### Embedding models

Metrics are Recall@3 / MRR@3 / nDCG@3 over all 25 queries, before applying the semantic score cutoff. Timing and memory were measured with cached FP32 models on CPU; production uses a quantized ONNX MiniLM model, so these figures compare model sizes and relative cost rather than production latency. The currently applied `0.44` cutoff is evaluated separately below.


| Model                                                                                                | Whole-story cosine          | Current field-max scorer    | Query latency (p50 / p95) | Vector payload (float32 / Mongo numeric estimate) | Pros and cons                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------- | ------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) (384 dimensions)       | 0.88 / **0.86** / **0.912** | 0.88 / 0.82 / 0.889         | **27 / 31 ms**            | **0.19 / 0.38 MiB**                               | Best whole-story ranking in this run, fastest and smallest. Field-max results were a little lower than MPNet's.                                           |
| [all-mpnet-base-v2](https://huggingface.co/sentence-transformers/all-mpnet-base-v2) (768 dimensions) | 0.88 / 0.82 / 0.874         | 0.88 / **0.84** / **0.904** | 91 / 99 ms                | 0.38 / 0.76 MiB                                   | Slightly stronger field-max ranking than MiniLM here, but about 3× slower per query and uses twice the vector storage and about twice the model-load RSS. |
| [E5-small-v2](https://huggingface.co/intfloat/e5-small-v2) (384 dimensions)                          | 0.88 / 0.82 / 0.874         | 0.88 / 0.82 / 0.889         | 46 / 56 ms                | 0.19 / 0.38 MiB                                   | Retrieval-specific and compact, but did not improve these metrics; requires `query:` and `passage:` prefixes.                                             |


**Why keep MiniLM:** MPNet's small MRR/nDCG gain with the current scorer is not enough evidence to justify its higher latency and storage on a 25-query test. MiniLM has the strongest whole-story cosine result.

### Ranking methods


| Method                                                  | Recall@3 / MRR@3 / nDCG@3 | Pros and cons                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole-story cosine (MiniLM)                             | **0.88 / 0.86 / 0.912**   | Best aggregate result in this offline run. One vector per story is simple, but combining title, body, and topics can dilute a short relevant passage.                                              |
| Field-max cosine                                        | 0.88 / 0.82 / 0.889       | Scores title, body chunks, and topic tags independently, then uses the strongest field. Preserves exact topic and focused passage matches; a single accidental chunk or tag can over-rank a story. |
| BM25 lexical proxy                                      | 0.88 / 0.82 / 0.888       | Useful for exact words and metadata.                                                                                                                                                               |
| BM25 + field-max RRF                                    | 0.88 / 0.82 / 0.889       | RRF combines lexical and semantic ranks without comparing their raw score scales. It tied the field-max result here; the live Atlas + semantic merge was not evaluated by this experiment.         |
| MMR (lambda 0.75)                                       | 0.88 / 0.86 / 0.896       | Can diversify a result list, but had lower precision and nDCG than cosine. Better suited to “show me varied stories” than direct relevance search.                                                 |
| Weighted fields (20% title / 70% body / 10% topics)     | 0.88 / 0.807 / 0.863      | Makes field importance explicit, but ranked below the field-max setup.                                                                                                                             |
| Title + mean of top two body chunks                     | 0.84 / 0.80 / 0.809       | Reduces reliance on a single chunk, but averaging diluted relevant passage scores and reduced ranking quality here.                                                                                |
| Dot product or Euclidean distance on normalized vectors | Same rankings as cosine   | Equivalent ordering for unit-normalized embeddings, so neither provided a quality gain over cosine.                                                                                                |


**Current ranking choice:** Field-max cosine and RRF merge with Atlas Search. Whole-story cosine won on this small offline metric set. Field-max cosine didn’t prove it ranks better than whole-story cosine but we’re treating it as a design choice to validate against real searches—not as a measured winner. MMR is not the default because Aether search is intended to return relevant matches, not maximize diversity.

### Evaluation files

- `[corpus-v2.json](docs/search/corpus-v2.json)`: snapshot of the existing stories used in the offline evaluation.
- `[queries-v2.json](docs/search/queries-v2.json)`: 25 evaluator-written queries and their relevance grades.
- `[experiments-v1.json](docs/search/experiments-v1.json)`: detailed embedding-model and ranking-method comparisons, including per-query rankings, aggregate metrics, timings, and memory estimates.
- `[results-v2.json](docs/search/results-v2.json)`: a separate lexical-versus-semantic comparison for MiniLM, E5, and BGE on the same snapshot and query set.



## Automated Content Moderation

Stories are checked with **pretrained classifiers** to produce a review warning. The current choice combines the [Horizon Labs phishing and scam detector](https://huggingface.co/onnx-community/phishing-scam-detector-base-ONNX) with [Intel Toxic Prompt RoBERTa](https://huggingface.co/onnx-community/toxic-prompt-roberta-ONNX): it flags when the maximum of the fraud-plus-spam score and toxicity score reaches `0.5`.

Candidates were evaluated on the same 20-story holdout.

Pretrained classifiers are the moderation approach used by the app. I also trained TF-IDF classifiers out of curiosity to compare against the pretrained models; that experiment was only a baseline, not the implemented approach.


| Candidate                                                                                                                            | Precision / Recall / F1 / Accuracy | Safe real stories flagged | Model size / time for 95 stories | Observation and decision                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Tanaos multilingual spam detector](https://huggingface.co/onnx-community/tanaos-spam-detection-v1-ONNX), validation-selected cutoff | 1.00 / 0.11 / 0.20 / 0.60          | 1 / 15                    | 132 MiB / 4.1 s                  | High precision but missed most unsafe synthetic examples; not selected.                                                                                                                                         |
| [Horizon phishing/scam detector](https://huggingface.co/onnx-community/phishing-scam-detector-base-ONNX), validation-selected cutoff | 0 / 0 / 0 / 0.55                   | 0 / 15                    | 327 MiB / 11.7 s                 | Conservative alone, but missed every unsafe holdout example at its selected cutoff; not selected alone.                                                                                                         |
| [Intel Toxic Prompt RoBERTa](https://huggingface.co/onnx-community/toxic-prompt-roberta-ONNX), validation-selected cutoff            | 0.50 / 0.22 / 0.31 / 0.55          | 0 / 15                    | 123 MiB / 7.1 s                  | Adds a toxicity signal but performed poorly alone; retained as a complementary part of the pair.                                                                                                                |
| **Horizon + Intel, serving cutoff 0.5**                                                                                              | **0.78 / 0.78 / 0.78 / 0.80**      | **1 / 15**                | **450 MiB / 18.8 s**             | **Selected:** combines scam/spam and toxicity signals. At the pair's validation-selected cutoff of 0.3, holdout F1 rose to 0.84, but it flagged 3/15 safe stories; 0.5 is the more conservative warning cutoff. |
| Self-trained TF-IDF + Linear SVM (curiosity comparison)                                                                              | 0.75 / 0.67 / 0.71 / 0.75          | 6 / 15                    | 0.24 MB / 0.72 s fit and predict | Best of the self-trained Logistic Regression, Linear SVM, and Complement Naive Bayes baselines, but flagged 40% of the safe set. This was an additional comparison, not the initial approach.                   |


The TF-IDF baselines used word unigrams/bigrams and character 3–5-grams (5,000 features). Logistic Regression scored F1 **0.46** and Complement Naive Bayes **0.27**.

### Evaluation files

- `[evaluation-corpus.csv](docs/content-moderation/evaluation-corpus.csv)`: 95 labeled stories.
- `[pretrained-model-evaluation.json](docs/content-moderation/pretrained-model-evaluation.json)`: pretrained model and ensemble scores, thresholds, predictions, model sizes, and timing.
- `[self-trained-baseline-evaluation.json](docs/content-moderation/self-trained-baseline-evaluation.json)`: TF-IDF classifier metrics, predictions, and the safe-story check.
- `[evaluate-pretrained-models.mjs](docs/content-moderation/evaluate-pretrained-models.mjs)`: script to rerun pretrained evaluations.
- `[evaluate-tfidf-baselines.mjs](docs/content-moderation/evaluate-tfidf-baselines.mjs)`: script to rerun the exploratory TF-IDF baselines.



### Backfilling existing stories

New and edited stories are classified automatically. Existing published stories need a one-time backfill; deployment to Vercel does not run it automatically. Set `MONGODB_URI` in `.env.local` to the database you intend to update, then run from the repository root:

```bash
npm run moderation:backfill
```

This is a dry run: it reports how many published stories would be flagged or cleared and does not write changes. After reviewing the counts, apply the results with:

```bash
npm run moderation:backfill -- --apply
```

The `--apply` flag writes moderation results to all published stories in the selected database. Run the dry run first, especially when targeting production.

These results are exploratory. Gather reviewed examples and monitor false positives before treating the warning as reliable.

### 🛠️ Tech Stack


| Technology             | Purpose                     |
| ---------------------- | --------------------------- |
| **Next.js 16**         | Core Framework & App Router |
| **Tailwind CSS 4**     | Minimalist Styling          |
| **MongoDB / Mongoose** | NoSQL Database              |
| **Auth0**              | Identity Management         |
| **AWS S3**             | Cloud Object Storage        |




## 🔌 API Reference



### Blogs & Publishing

- `GET /api/blogs` - Retrieve all published stories.
- `POST /api/blogs` - Create a new story draft.
- `GET /api/blogs/me` - Access your personal dashboard items.
- `GET /api/blogs/[id]` - Detailed view of a specific story.
- `PUT /api/blogs/[id]` - Publish or update a story.
- `DELETE /api/blogs/[id]` - Remove a story forever.



### Favorites & Interactions

- `GET /api/favorites` - Retrieve all stories favorited by the current user.
- `POST /api/favorites` - Toggle favorite status



### Media & Profile

- `POST /api/upload` - Secure AWS S3 image upload bridge.
- `GET /api/user` - Auth0 user profile data and settings.



## 📁 Project Structure

```bash
├── src/
│   ├── app/           # Next.js App Router, APIs, and globals.css
│   ├── components/    # Reusable UI components (Sidebar, Editor, etc.)
│   ├── context/       # Auth & Theme State providers
│   ├── lib/           # Database connections & Shared utilities
│   ├── models/        # Mongoose Schemas (Blog, User, Comment)
│   └── proxy.ts       # S3 Media proxy utility
├── public/            # Static branding assets
└── package.json       # Project configuration
```



## 🚀 Getting Started



### 1. Prerequisites

- Node.js (v18+)
- npm or pnpm
- MongoDB Atlas account
- Auth0 application
- AWS S3 bucket



### 2. Installation

```bash
git clone https://github.com/Sindhuja-5/aether.git
cd aether
npm install
```



### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Database
MONGODB_URI=

# Auth0
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET_NAME=
```



### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 5. Build the semantic search index

After setting `MONGODB_URI` in `.env.local`, populate MiniLM vectors for existing stories with:

```bash
npm run search:backfill
```

New and edited stories maintain their vectors automatically. Semantic-only results must have cosine similarity of at least **0.44**; Atlas Search supplies the lexical results and remains available if semantic inference fails.

### 6. Backfill content moderation for existing stories

New and edited stories are classified automatically. To classify stories that were already published, first ensure `MONGODB_URI` in `.env.local` points to the database you intend to update. Cache the pretrained models, then preview the backfill:

```bash
npm run moderation:cache
npm run moderation:backfill
```

The backfill command is a dry run by default. Review its flagged and clear counts, then save those results to the database with:

```bash
npm run moderation:backfill -- --apply
```

This applies to all published stories in the configured database. Use `--apply` only when you intend to write to that database.

## 🚢 Deployment

Push to GitHub and connect to Vercel. Ensure all environment variables are configured in the Vercel dashboard.
