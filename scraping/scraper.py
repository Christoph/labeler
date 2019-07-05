import urllib3
import pandas as pd
import io
import certifi
import time


http = urllib3.PoolManager(
    cert_reqs='CERT_REQUIRED',
    ca_certs=certifi.where())


def generate_url(gkz, year):
    return "https://www.offenerhaushalt.at/data/download/"+gkz+"_"+year+"_STA_RA"


def add(data, missed, gkz, year):
    time.sleep(1)
    try:
        r = http.request('GET', generate_url(gkz, year),
                         retries=2,
                         timeout=urllib3.Timeout(connect=3.0, read=10.0))
        c = pd.read_csv(io.StringIO(r.data.decode('utf-8')), sep=";")
        data = data.append(c)
    except:
        missed.append([gkz, year])


def scrape(years=["2017"]):
    gkz_list = pd.read_csv(
        "../data/gkz.csv", encoding="latin-1")["Gemeinde kennziffer"].tolist()

    data = pd.DataFrame()
    missed = []

    for y in years:
        for id in gkz_list:
            add(data, missed, str(id), y)

    print("Successful: "+str(len(data)))
    print("Missed: "+str(len(missed)))

    pd.DataFrame(missed).to_csv(
        "../data/STA_RA_missed.csv")
    data.to_csv(
        "../data/STA_RA_data.csv")


def retry_missed():
    gkz_list = pd.read_csv("../data/STA_RA_missed.csv")["0"].tolist()
    years = pd.read_csv("../data/STA_RA_missed.csv")["1"].unique().tolist()

    data = pd.read_csv("../data/STA_RA_data.csv")
    size = len(data)
    missed = []

    for y in years:
        for id in gkz_list[:10]:
            add(data, missed, str(id), y)

    print("Successful: "+str(len(data)-size))
    print("Missed: "+str(len(missed)))

    pd.DataFrame(missed).to_csv(
        "../data/STA_RA_missed.csv")
    data.to_csv(
        "../data/STA_RA_data.csv")


# retry_missed()
scrape(["2015", "2016", "2017"])
# scrape(["2007", "2008", "2009", "2010", "2011", "2012", "2013", "2014", "2015", "2016", "2017"])
