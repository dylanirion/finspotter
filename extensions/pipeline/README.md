This folder contains extensions to the Image Processing Pipeline that enable Object Detection, Feature Extraction, Feature Indexing, Similarity Search, and Scoring. In order to work with the Image Processing Pipeline, each function category has some contraints.

# Detection

Detection functions must expect an event with the following shape

```python
{
  "payload": string
}
```

which should point to the S3 location (`<bucket>/<key>`) of a json file with information necessary to retrieve an image.
The detection function should return S3 location of an image with

# Extraction

# Similarity Search

# Match Refinement

# Indexed LNBNN scoring

`@finspotter/pgvector` searches descriptors within the extraction's category
using pgvector's L2 operator (`<->`). Configure `{ k: 5, knorm: 1 }` (the
defaults), or pass `null`. The handler reads the authoritative extraction
record and feature URI, excludes its `annotation_id` when present, and retrieves
`k + knorm` neighbors per descriptor in batches of 64 query descriptors.
It squares pgvector's Euclidean distances exactly once when writing the
artifact, matching the squared-distance convention used by IBEIS.
Approximate HNSW retrieval can return fewer neighbors after category filtering;
these incomplete neighborhoods are counted but do not vote.

The version-1 JSON artifact in S3 contains:

```typescript
{
  version: 1,
  distanceMetric: "squared_l2", // "l2" is also supported by the scorer
  k: 5,
  knorm: 1,
  query: { pk, sk, media_id, detection_id, annotation_id? },
  neighbors: [
    // One sorted list per query feature, including empty lists.
    [{ annotation_id, feature_id, distance }, /* ... */],
  ],
}
```

`@finspotter/lnbnn` is a scoring extension. Scoring functions run in the existing
ordered `refine` sequence and are exposed through `refineFunctions`, just like
refinements. Register the package in the infrastructure pipeline and follow
indexed search with:

```typescript
refine: [
  {
    functionName: Resource.SimilaritySearchPipeline.refineFunctions.lnbnn,
    config: null,
  },
]
```

The indexed demo is wired this way. Existing pairwise submission scoring is
unchanged.

For each query feature, LNBNN reserves the final `knorm` neighbors for
normalization and uses the last one's distance as the local background
distance. Only the first `k` neighbors vote. Each annotation receives at most
one vote per query feature, using its nearest descriptor:

```text
vote = background_distance - nearest_annotation_distance
annotation_score = sum(positive votes)
```

Higher scores are better; they are not probabilities. Distances are used in
the artifact's declared metric, without implicit squaring or square roots.
The pgvector path uses squared L2 distance margins, following IBEIS's
`lnbnn_fn` distance-subtraction convention. Unlike IBEIS's SIFT-specific
normalization, these distances retain the descriptor's native scale; absolute
score thresholds must be calibrated for the extractor. Other indexes must
explicitly declare the metric they return. Deduplicating votes by
annotation follows Algorithm 2's nearest-per-class rule, with an annotation
as the retrieval class; this does not aggregate catalog identities/names.

Optional config:

- `ratioThreshold`: keep a vote only when
  `distance < ratioThreshold * background_distance` (in `(0, 1]`, disabled
  by default). This is a local-background ratio, not the pairwise Lowe test.
- `minMatches`: minimum distinct query features supporting a candidate
  (default `1`).
- `minScore`: strict lower bound on summed score (default `0`).
- `limit`: maximum ranked annotations (default `50`, maximum `100`).

Empty neighborhoods, incomplete neighborhoods, and tied/zero distance margins
produce no evidence. Malformed, unsorted, duplicate, nonfinite, or self-match
neighbors fail explicitly. Score ties are ordered by annotation ID.

The scoring handler persists a ranking JSON artifact including match evidence
(`from`, `to`, `distance`, `normalizerDistance`, `score`), query provenance,
config, and the incomplete-neighborhood count. Each retained candidate has a
DynamoDB result containing its annotation ID, rank, summed score, match count,
artifact URI, and optional TTL. The returned `{ pk, sk, bucket, key }` points
to the ranking, even when no candidates pass. Candidate keys are deterministic
for retries. These are retrieval results, not automatically approved identity
assignments or review-ready pair claims.

Do not chain the existing `ratio`, `homog`, or `sum` extensions onto the indexed
artifact: they consume pairwise match arrays and observation-specific keypoint
artifacts, not indexed neighborhoods/rankings. Geometric verification of indexed
candidates requires resolving their source keypoint artifacts first and is not
enabled by this extension.

## References

- McCann and Lowe (2012), _Local Naive Bayes Nearest Neighbor for Image
  Classification_, especially Algorithm 2:
  <https://www.cs.ubc.ca/~lowe/papers/12mccannCVPR.pdf>.
- IBEIS pipeline ordering:
  <https://github.com/Erotemic/ibeis/blob/main/ibeis/algo/hots/pipeline.py>.
- IBEIS local normalization and weighting (`get_normk`, `lnbnn_fn`):
  <https://github.com/Erotemic/ibeis/blob/main/ibeis/algo/hots/nn_weights.py>.
- IBEIS squared-distance convention (`NeighborIndex.knn`):
  <https://github.com/Erotemic/ibeis/blob/main/ibeis/algo/hots/neighbor_index.py>.

Run the numerical and mocked indexed-search-to-scoring integration tests with
`pnpm --filter @finspotter/lnbnn test`.
