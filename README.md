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



### Semantic Search: Evaluation and Current Choice

The current choice is **MiniLM embeddings with the field-max cosine scorer and reciprocal-rank fusion (RRF) with Atlas Search**. The model and ranking alternatives below were evaluated offline on a snapshot of 15 stories and 25 evaluator-written queries. These are useful for comparing options, but they are not production search logs or a large relevance benchmark. Full per-query scores, timings, and memory estimates are in [experiments-v1.json](docs/search/experiments-v1.json), using the saved [corpus](docs/search/corpus-v2.json) and [queries and relevance labels](docs/search/queries-v2.json).

#### Embedding models

Metrics are Recall@3 / MRR@3 / nDCG@3 over all 25 queries, before applying the semantic score cutoff. Timing and memory were measured with cached FP32 models on CPU; production uses a quantized ONNX MiniLM model, so these figures compare model sizes and relative cost rather than production latency. The currently applied `0.44` cutoff is evaluated separately below.


| Model                                                                                                | Whole-story cosine          | Current field-max scorer    | Query latency (p50 / p95) | Vector payload (float32 / Mongo numeric estimate) | Pros and cons                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------- | ------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) (384 dimensions)       | 0.86 / 0.76 / 0.812 | **0.88 / 0.82 / 0.889**         | **27 / 31 ms**            | **0.19 / 0.38 MiB**                               | Best Field-max ranking in this run, fastest and smallest.                                           |
| [all-mpnet-base-v2](https://huggingface.co/sentence-transformers/all-mpnet-base-v2) (768 dimensions) | 0.88 / 0.82 / 0.874         | 0.88 / **0.84** / **0.904** | 91 / 99 ms                | 0.38 / 0.76 MiB                                   | Slightly stronger field-max ranking than MiniLM here, but about 3× slower per query and uses twice the vector storage and about twice the model-load RSS. |
| [E5-small-v2](https://huggingface.co/intfloat/e5-small-v2) (384 dimensions)                          | 0.88 / 0.82 / 0.874         | 0.88 / 0.82 / 0.889         | 46 / 56 ms                | 0.19 / 0.38 MiB                                   | Retrieval-specific and compact, but did not improve these metrics; requires `query:` and `passage:` prefixes.                                             |


**Why keep MiniLM:** MPNet's small MRR/nDCG gain with the current scorer is not enough evidence to justify its higher latency and storage on a 25-query test. MiniLM has the strongest whole-story cosine result.

#### Ranking methods


| Method                                                  | Recall@3 / MRR@3 / nDCG@3 | Pros and cons                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole-story cosine (MiniLM)                             | 0.86 / 0.76 / 0.812   | One vector per story is simple, but combining title, body, and topics can dilute a short relevant passage.                                              |
| Field-max cosine                                        | **0.88 / 0.82 / 0.889**       | Best aggregate result in this offline run. Scores title, body chunks, and topic tags independently, then uses the strongest field. Preserves exact topic and focused passage matches; a single accidental chunk or tag can over-rank a story. |
| BM25 lexical proxy                                      | 0.88 / 0.82 / 0.888       | Useful for exact words and metadata.                                                                                                                                                               |
| BM25 + field-max RRF                                    | 0.88 / 0.82 / 0.889       | RRF combines lexical and semantic ranks without comparing their raw score scales. It tied the field-max result here; the live Atlas + semantic merge was not evaluated by this experiment.         |
| MMR (lambda 0.75)                                       | 0.88 / 0.86 / 0.896       | Can diversify a result list, but had lower precision and nDCG than cosine. Better suited to “show me varied stories” than direct relevance search.                                                 |
| Weighted fields (20% title / 70% body / 10% topics)     | 0.88 / 0.807 / 0.863      | Makes field importance explicit, but ranked below the field-max setup.                                                                                                                             |
| Title + mean of top two body chunks                     | 0.84 / 0.80 / 0.809       | Reduces reliance on a single chunk, but averaging diluted relevant passage scores and reduced ranking quality here.                                                                                |
| Dot product or Euclidean distance on normalized vectors | Same rankings as cosine   | Equivalent ordering for unit-normalized embeddings, so neither provided a quality gain over cosine.                                                                                                |


**Current ranking choice:** Field-max cosine and RRF merge with Atlas Search. Field-max cosine proves it ranks better than others on this run. MMR is not the default because Aether search is intended to return relevant matches, not maximize diversity.

#### Evaluation files

- `[corpus-v2.json](docs/search/corpus-v2.json)`: snapshot of the existing stories used in the offline evaluation.
- `[queries-v2.json](docs/search/queries-v2.json)`: 25 evaluator-written queries and their relevance grades.
- `[experiments-v1.json](docs/search/experiments-v1.json)`: detailed embedding-model and ranking-method comparisons, including per-query rankings, aggregate metrics, timings, and memory estimates.



### Automated Content Moderation

**Deployed moderator: Horizon + Intel at a fixed 0.5 threshold.** Stories are scored by two pretrained classifiers. A flagged story gets a warning for readers to review before opening; they can go back or continue, and the classifier does not remove content. The score is max(P(fraud) + P(spam), P(toxic)), using the [Horizon Labs phishing and scam detector](https://huggingface.co/onnx-community/phishing-scam-detector-base-ONNX) and [Intel Toxic Prompt RoBERTa](https://huggingface.co/onnx-community/toxic-prompt-roberta-ONNX).

The evaluation covers 245 stories out of which 112 are flagged as inappropriate and 133 as safe (corpus flagged share = 45.7%.). Pretrained models were evaluated on every story at fixed 0.5.


| System                         | TP/FP/FN/TN      | Precision (%) | Recall (%) | False-positive rate (%) | F1 (%) [95% CI]       |
| ------------------------------ | ---------------- | ------------- | ---------- | ----------------------- | --------------------- |
| Horizon                        | 78/8/34/125      | 90.7          | 69.6       | 6.0                     | 78.8 [72.0, 84.4]     |
| Intel                          | 20/6/92/127      | 76.9          | 17.9       | 4.5                     | 29.0 [19.0, 38.9]     |
| **Horizon + Intel (deployed)** | **91/13/21/120** | **87.5**      | **81.3**   | **9.8**                 | **84.3 [78.7, 89.1]** |
| TF-IDF Linear SVM (baseline)   | 83/11/29/122     | 88.3          | 74.1       | 8.3                     | 80.6 [74.6, 85.7]     |




#### Why Horizon + Intel

**Why the pair:** I made a product decision that the moderator should prioritise catching spam, scam and abusive content, even if some harmless stories are flagged too. A missed harmful story is the worse outcome here, because a flag only shows a warning: no story is deleted or hidden, and readers can choose to open it anyway. Adding Intel to Horizon caught 13 more flagged stories (91 vs 78 of 112) and raised 5 more false alarms (13 vs 8 of 133). The paired test does not show a statistically supported advantage over Horizon alone (p = 0.096), so this is a deliberate trade-off, not a measured winner.


| Measure                            | Horizon alone | Horizon + Intel (deployed) | Difference   |
| ---------------------------------- | ------------- | -------------------------- | ------------ |
| Flagged stories caught (of 112)    | 78            | 91                         | +13          |
| Flagged stories missed             | 34            | 21                         | -13          |
| False alarms (of 133 not-flagged)  | 8             | 13                         | +5           |
| Precision (%)                      | 90.7          | 87.5                       | -3.2 points  |
| Recall (%)                         | 69.6          | 81.3                       | +11.7 points |
| False-positive rate (%)            | 6.0           | 9.8                        | +3.8 points  |
| ROC-AUC                            | 0.891         | 0.908                      | +0.017       |
| Scoring time for 245 stories (sec) | 19.0          | 31.1                       | +12.2        |




**Exploratory TF-IDF baselines (not used by the app):** To see how models without pretrained weights behave when learning from this dataset, I evaluated three TF-IDF classifiers: Logistic Regression, Linear SVM, and Complement Naive Bayes. Each learned from the training stories in a cross-validation fold and was evaluated on that fold’s held-out stories. 


| TF-IDF baseline        | TP  | FP  | Precision | F1    |
| ---------------------- | --- | --- | --------- | ----- |
| Logistic Regression    | 78  | 9   | 89.7%     | 78.4% |
| Linear SVM             | 83  | 11  | 88.3%     | 80.6% |
| Complement Naive Bayes | 80  | 11  | 87.9%     | 78.8% |




## 🛠️ Tech Stack


| Technology                       | Purpose                                                     |
| -------------------------------- | ----------------------------------------------------------- |
| **Next.js 16**                   | Core Framework & App Router                                 |
| **Hugging Face Transformers.js** | Run pretrained MiniLM embeddings and moderation classifiers |
| **Tailwind CSS 4**               | Minimalist Styling                                          |
| **MongoDB / Mongoose**           | NoSQL Database                                              |
| **Auth0**                        | Identity Management                                         |
| **AWS S3**                       | Cloud Object Storage                                        |




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
