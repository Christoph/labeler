import pandas as pd
import random

# Export study data
meta = pd.read_json("../input_data/old_data.json", orient="index")
mapping = pd.read_json("../input_data/mapping_original.json", orient="index")
classes = pd.read_json("../input_data/classes.json", orient="index")
usedKeywords = pd.read_csv("../input_data/used_keywords.csv")

study_data = meta.drop(["Abstract_Vector", "Keyword_Vector"], axis=1)

# Check data for consistency and remove errors
allKeywords = set(mapping['AuthorKeyword'])

study_clean = []
for i, doc in study_data.iterrows():
    keywords = doc['Keywords'].split(';')
    keep = True

    for k in keywords:
        if k not in allKeywords:
            keep = False

    if keep:
        study_clean.append(doc)

study_data = pd.DataFrame(study_clean)

# Select study datasets based on
# Same amount of Keywords for each author -> 100?

study = study_data[study_data["DOI"].str.contains(
    '2010|2011|2012|2013', regex=True)]
not_study = study_data[~study_data["DOI"].str.contains(
    '2010|2011|2012|2013', regex=True)]

# add old keywords to used
used = set(usedKeywords['keyword'])

for i, doc in not_study.iterrows():
    keywords = doc['Keywords'].split(';')

    for k in keywords:
        used.add(k)

# More then 3 and less then 7 Keywords per publication
goodPublications = []

for i, doc in study.iterrows():
    if len(doc['Keywords'].split(';')) > 3 and len(doc['Keywords'].split(';')) < 10:
        goodPublications.append(doc)


# Create study data
p0Keywords = set()
p0Docs = []
remainingDocs = []
p0map = mapping.copy()

random.shuffle(goodPublications)
for doc in goodPublications:
    keywords = doc['Keywords'].split(';')
    isNew = False

    for k in keywords:
        if k not in used and len(p0Keywords) < 98:
            p0Keywords.add(k)
            used.add(k)
            isNew = True

        if k in p0Keywords:
            isNew = True

    if isNew:
        p0Docs.append(doc)
    else:
        remainingDocs.append(doc)


newData = pd.DataFrame(p0Docs)
oldData = pd.DataFrame(remainingDocs)

for k in p0Keywords:
    p0map = p0map[p0map['AuthorKeyword'] != k]

newData.to_json('new_data.json', orient='index')
oldData.to_json('old_data.json', orient='index')
p0map.to_json('mapping.json', orient='index')
