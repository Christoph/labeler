import pandas as pd

labels = pd.read_csv("../input_data/labels-B.csv", sep=';', index_col=0)
ranking = pd.read_csv("../input_data/ranking_B.csv", index_col=0)

cols = labels.columns
out = pd.DataFrame(columns=cols, index=labels.index)

for row in labels.iterrows():
    index = row[0]
    l = row[1]
    temp = []

    for coder in l:
        rank = 11
        t = ranking.loc[index.lower()]
        mask = t == coder

        if sum(mask) > 0:
            rank = int(t[mask].index[0])
        else:
            rank = 11

        temp.append(rank)

    out.loc[index] = temp

out.to_csv('rankings_B.csv')
out.to_json('rankings_B.json', orient='index')
