import pandas as pd
import numpy as np
from sklearn.metrics import cohen_kappa_score
import plotly.figure_factory as ff
from nltk.metrics.agreement import AnnotationTask
import itertools

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

data = pd.read_csv('../input_data/labels-C.csv', sep=';', index_col=0)

allcoders = data.columns
experts = ['KEY', 'MG', 'MS', 'TM']
novices = ['KEY', 'CK', 'GK', 'RM']

cols = novices

# Total values
taskdata = []
for coder in cols:
    for i in data[coder].index:
        taskdata.append([coder, i, data[coder][i]])

ratingtask = AnnotationTask(data=taskdata)
print("kappa " + str(ratingtask.kappa()))
print("fleiss " + str(ratingtask.multi_kappa()))
print("alpha " + str(ratingtask.alpha()))
print("scotts " + str(ratingtask.pi()))

# Pairwise values
similarities = []
for coders in itertools.product(cols, repeat=2):
    if coders[0] == coders[1]:
        similarities.append(1)
    else:
        taskdata = []
        for coder in coders:
            for i in data[coder].index:
                taskdata.append([coder, i, data[coder][i]])

        ratingtask = AnnotationTask(data=taskdata)
        k = ratingtask.kappa()
        f = ratingtask.multi_kappa()
        a = ratingtask.alpha()
        s = ratingtask.pi()

        similarities.append(a)

similarities = np.reshape(similarities, (len(cols), len(cols)))

z_text = np.around(similarities, decimals=2)
fig = ff.create_annotated_heatmap(
    similarities,
    x=list(cols),
    y=list(cols),
    annotation_text=z_text,
    colorscale=colors)
fig.show()
