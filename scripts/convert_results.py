import pandas as pd
from sklearn.preprocessing._label import MultiLabelBinarizer


def prepareData(data):
    data['labelVecs'] = ''
    data['labels'] = data['labels'].str.replace(" ", "")
    data['labels'] = data['labels'].str.lower()
    data['labels'] = data['labels'].str.split(';')

    return data


truth = pd.read_csv("../input_data/labeled_data_truth.csv")
torsten = pd.read_csv("../input_data/labeled_data_Torsten.csv")
Mike = pd.read_csv("../input_data/labeled_data_Mike.csv")
CK = pd.read_csv("../input_data/labeled_data_CK.csv")
RM = pd.read_csv("../input_data/labeled_data_RM.csv")
GK = pd.read_csv("../input_data/labeled_data_GK.csv")

truth['labelVecs'] = ''
truth['labels'] = truth['Clusters'].str.lower()
truth['labels'] = truth['labels'].str.rstrip(';')
truth['labels'] = truth['labels'].str.split(';')

data = [prepareData(d) for d in [torsten, Mike, CK, RM, GK]]
data.append(truth)

clusters = set()
for d in data:
    clusters.update([item for sublist in d['labels'] for item in sublist])

enc = MultiLabelBinarizer()
enc.fit([clusters])

for result in data:
    for i, doc in result.iterrows():
        doc['labelVecs'] = enc.transform([doc['labels']])[0]
        doc['labelVecs'] = doc['labelsVecs'].str.wrap(500)

pd.DataFrame(enc.classes_, columns=['Label']).to_csv('labels.csv', index=False)
truth.to_csv('truth.csv', index=False)
torsten.to_csv('labeler1.csv', index=False)
Mike.to_csv('labeler2.csv', index=False)
CK.to_csv('labeler3.csv', index=False)
RM.to_csv('labeler4.csv', index=False)
GK.to_csv('labeler5.csv', index=False)
