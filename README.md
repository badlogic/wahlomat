# Wahlomat
Playground to explore election programs and election results.

Try things at [wahlomat.mariozechner.at](https://wahlomat.mariozechner.at).

You'll need to preprocess the election program data in `preprocessing/data` first. Preprocessing uses PyMuPDF to extract plain text from election programs, which is then fed to OpenAI's GPT 4o-mini, which is tasked to extract policital demands from the plain text. Each demand is a single line which is vectorized/embedded via OpenAI's text-embedding-3-small model. The resulting embeddings are then projected to 2D via UMAP.

All outputs from preprocessing are placed in the `html/data` folder. For each party program, there is a file containing the plain text extracted from the PDF (e.g `html/data/regierung2024/neos.txt`) and a file containing the political demands extracted by GPT (e.g. `html/data/regierung/neos-summary.txt`). All embedding vectors are stored in a single `vectors.tsv` file. The 2D projections of each embedding vector are stored in a `projection-2d.tsv` file. The meta data for each vector (political party, page, extracted policital demand) is stored in `vectors.meta.tsv`. The web app uses the `projection-2d.tsv` and `vectors.meta.tsv` files.

To preprocess the data:

1. Install Python 3+
2. Ideally, create a virtual environment
2. `pip3 install PyMuPDF openai tiktoken numpy pandas umap-learn`
3. Set your OPENAI access token `export OPENAI_KEY=<your-openai-key>`
3. `cd preprocessing && python3 regierung2024.py && python3 europa2024.py`

To run and work on the web app:

1. Install & run Docker
2. Install NodeJS +19

```
npm run dev
```

In VS Code run the `server` and `client` launch configurations.

The app is self-contained, so you can just deploy the contents of the `html/` folder to a web root near you.