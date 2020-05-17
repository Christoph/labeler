import pandas as pd
import numpy as np
from sklearn.metrics import cohen_kappa_score
import plotly.figure_factory as ff

colors = [
    [0, 'rgb(40, 40, 40)'],
    # [0.1, 'rgb(0, 0, 0)'],
    # [0.1, 'rgb(20, 20, 20)'],
    [0.2, 'rgb(40, 40, 40)'],
    [0.2, 'rgb(80, 80, 80)'],
    # [0.3, 'rgb(40, 40, 40)'],
    # [0.3, 'rgb(60, 60, 60)'],
    [0.4, 'rgb(80, 80, 80)'],
    [0.4, 'rgb(120, 120, 120)'],
    # [0.5, 'rgb(80, 80, 80)'],
    # [0.5, 'rgb(100, 100, 100)'],
    [0.6, 'rgb(120, 120, 120)'],
    [0.6, 'rgb(160, 160, 160)'],
    # [0.7, 'rgb(120, 120, 120)'],
    # [0.7, 'rgb(140, 140, 140)'],
    [0.8, 'rgb(160, 160, 160)'],
    [0.8, 'rgb(200, 200, 200)'],
    # [0.9, 'rgb(160, 160, 160)'],
    # [0.9, 'rgb(180, 180, 180)'],
    [1.0, 'rgb(200, 200, 200)']
]

data = pd.read_csv('../input_data/labels-manual.csv', sep=';', index_col=0)

similarities = []
for x in data.columns:
    temp = []
    for y in data.columns:
        temp.append(cohen_kappa_score(data[x], data[y]))
    similarities.append(temp)

z_text = np.around(similarities, decimals=2)
fig = ff.create_annotated_heatmap(
    similarities,
    x=list(data.columns),
    y=list(data.columns),
    annotation_text=z_text,
    colorscale=colors)
fig.show()
