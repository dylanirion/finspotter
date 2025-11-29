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