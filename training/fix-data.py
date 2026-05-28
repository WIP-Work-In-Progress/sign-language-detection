import pandas as pd

df = pd.read_csv('./data/asl-datav4-augmented.csv')

def check_zeros(row):
    return all(val == 0 for val in row[:-1])

df['label'] = df.apply(lambda row: 'Blank' if check_zeros(row) else row['label'], axis=1)

df.to_csv('data_modified.csv', index=False)
