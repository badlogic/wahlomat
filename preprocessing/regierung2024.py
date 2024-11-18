from pdftools import *
from llm import clear_history, complete, print_history, client, num_tokens
import os
import shutil
import numpy as np
import pandas as pd
import umap

OUTPUT_DIR = "../html/data/regierung2024/"
CLEAN = False
START_STOP = {
    "neos": [7, 43],
    "övp": [22, 269],
    "spö": [4, 113]
}

def summarize_file(party, filename, outputfile):
    file_content = read_file(filename)
    pages = file_content.split('========== PAGE ')
    summaries = []
    start_stop = START_STOP[party]

    for page in pages[1:]:
        page_number, page_text = page.split('\n', 1)
        print(f"Page {page_number}/{len(pages) - 1}")
        if (int(page_number) < start_stop[0] or
            int(page_number) > start_stop[1] or
            not page_text.strip() or
            page_text.count('\n') < 3):
            print("Skipping")
            summary = ''
        else:
            clear_history()
            summary = complete(f"""
Dieser Text ist Teil eines Wahlprogramms. Extrahiere die Schlüsselpunkte aus dem Text, der durch ``` (drei Backticks) abgegrenzt ist, mit besonderem Fokus auf die Forderungen und Pläne der Partei. Gib Zahlen zu den Forderungen und Plänen an, falls vorhanden. Erfinde keine Forderungen, wenn du keine Forderungen im Text findest. Schreibe jede Forderung in einer eigenen Zeile mit einem vorangesetztem Minus-Zeichen. Schreibe nichts anderes als die Forderungen.

```
{page_text}
```
        """, 4096).strip()
        summaries.append(f'========== PAGE {page_number}\n{summary}\n')

    summary = ''.join(summaries)
    write_file(outputfile, summary)

def vectorize_file(filename, label):
    lines = read_file(filename).splitlines()
    batchLines = []
    batchPages = []
    current_tokens = 0
    page = 0

    for line in lines:
        line = line.strip()
        line_tokens = num_tokens(line)
        if line.startswith("======"):
            page += 1
            continue
        if len(line) == 0:
            continue
        if current_tokens + line_tokens > 8000:
            response = client.embeddings.create(input=batchLines, model="text-embedding-3-small")
            save_vectors(response, label, batchLines, batchPages)
            batchLines = []
            batchPages = []
            current_tokens = 0

        batchLines.append(line)
        batchPages.append(page)
        current_tokens += line_tokens

    if batchLines:
        response = client.embeddings.create(input=batchLines, model="text-embedding-3-small")
        save_vectors(response, label, batchLines, batchPages)

def save_vectors(response, label, lines, pages):
    with open(OUTPUT_DIR + "vectors.tsv", 'a') as f:
        for i, embedding in enumerate(response.data):
            f.write('\t'.join(map(str, embedding.embedding)) + '\n')
    with open(OUTPUT_DIR + "vectors.meta.tsv", 'a') as f:
        for i, line in enumerate(lines):
            f.write(label + "\t" + str(pages[i]) + "\t" + label + line + "\n")

def convert():
    for file in files:
        text = convert_pdf(file)
        party = os.path.splitext(os.path.basename(file))[0]
        txt_file = OUTPUT_DIR + party + ".txt"
        summary_file = OUTPUT_DIR + party + "-summary.txt"
        write_file(txt_file, text)
        if not os.path.exists(summary_file):
            summarize_file(party, txt_file, summary_file)
        vectorize_file(summary_file, party)

def project():
    data = pd.read_csv(OUTPUT_DIR + "vectors.tsv", sep='\t', header=None)
    umap_2d = umap.UMAP(n_components=2, n_neighbors=10, n_epochs=500, random_state=42, metric="cosine")
    projection_2d = umap_2d.fit_transform(data)

    np.savetxt(OUTPUT_DIR + "projection-2d.tsv", projection_2d, delimiter='\t')

files = ["data/regierung2024/neos.pdf", "data/regierung2024/övp.pdf", "data/regierung2024/spö.pdf"]
if CLEAN and os.path.exists(OUTPUT_DIR):
    shutil.rmtree(OUTPUT_DIR)
if not os.path.exists(OUTPUT_DIR):
    os.mkdir(OUTPUT_DIR)
if os.path.exists(OUTPUT_DIR + "vectors.tsv"):
    os.remove(OUTPUT_DIR + "vectors.tsv")
if os.path.exists(OUTPUT_DIR + "vectors.meta.tsv"):
    os.remove(OUTPUT_DIR + "vectors.meta.tsv")
with open(OUTPUT_DIR + "vectors.meta.tsv", 'a') as f:
    f.write("party\tpage\tstatement\n")
convert()

project()