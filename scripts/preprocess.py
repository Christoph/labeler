import pandas as pd

classes = pd.read_json('../datasets/classes.json', orient="index")
labels = pd.read_json('../datasets/labels.json', orient="index")

classes['Category'] = ""
normClasses = classes['Cluster'].str.lower()

for row in labels.iterrows():
    norm_label = row[1]['Topic'].replace(" ", "").lower()
    if norm_label == "smallmobileandubiquitousvisualization":
        norm_label = "smallmobileubiquitousdevicesdisplays"
    print(norm_label)
    if norm_label != "unclear":
        index = classes.loc[normClasses == norm_label].index[0]
        classes.at[index, 'Category'] = row[1]['Category']

classes.to_json("classes.json", orient='index')
