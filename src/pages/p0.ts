import {
    autoinject
} from 'aurelia-dependency-injection';
import {
    DataStore
} from 'data-store';
import * as _ from 'lodash';
import { computedFrom } from 'aurelia-framework';
import * as tfidf from 'tiny-tfidf';
import * as porter from 'wink-porter2-stemmer';
import * as distances from 'wink-distance';

@autoinject()
export class P0 {
    public documents;
    public labeled_documents;
    public label_list;
    public label_docs;
    public keyword_list;
    public keyword_mapping;
    public autocompleteData = {};

    // Filter
    public searchKeywordsTerm = "";
    public finishedKeywords = false;
    public searchLabelsTerm = "";
    public searchDocumentTerm = "";

    // Selection
    public selected_document_list = [];
    public selected_document;
    public selected_keyword;
    public selected_additional_keywords = [];
    public selected_label;
    public showDocuments = false;
    public selected_similarities = [];
    public selected_similar_keywords = [];

    // Similarity list
    public sim_property = "text_similarity";
    public key_property = "highest_value";
    public label_sort_property = "total_similarity";
    public label_sort_value = 0;

    // Status variables
    public docs_todo = 0;
    public docs_done = 0;
    public docs_per = 0;
    public keywords_todo = 0;
    public keywords_done = 0;
    public keywords_per = 0;

    // NLP
    public tfidf;

    // Temp variables
    public sort_property = "descending";
    public graph_data;

    // Distance Metrics
    // cosine_similarity(v1, v2) {
    //     if (v1 && v2) {
    //         return Math.abs(Math.dot(v1, v2) / (math.norm(v1) * math.norm(v2)))
    //     } else {
    //         return 0
    //     }
    // }

    jaccard_similarity(s1, s2) {
        // return math.setIntersect(s1, s2).length / math.setUnion(s1, s2).length
        return _.intersection(s1, s2).length / _.union(s1, s2).length
    }

    jaccard_similarityBy(s1, s2, property) {
        // return math.setIntersect(s1, s2).length / math.setUnion(s1, s2).length
        return _.intersectionBy(s1, s2, property).length / _.unionBy(s1, s2, property).length
    }

    constructor(public store: DataStore) {
        this.documents = store.getNew();
        this.labeled_documents = store.getLabeled();
        this.label_list = store.getClasses();
        let mapping = store.getMapping();

        this.label_docs = {}
        this.keyword_mapping = {}
        this.keyword_list = []

        // Initialize the label document mapping
        for (const label of this.label_list) {
            this.label_docs[label["Cluster"]] = []
        }

        for (const doc of this.labeled_documents) {
            for (const label of doc["Clusters"].split(";")) {
                if (this.label_docs.hasOwnProperty(label)) {
                    let doc_list = this.label_docs[label]
                    doc_list.push(doc)
                    this.label_docs[label] = doc_list
                }
            }

            // TODO: fix casing in preprocessing
            doc["Keywords_Processed"] = doc["Keywords_Processed"].toLowerCase().split(";");

            for (const author_key of doc["Keywords_Processed"]) {
                if (!this.keyword_mapping.hasOwnProperty(author_key)) {
                    let mapping = this.store.getKeywordMapping(author_key).replace(",", "");
                    if (mapping.length > 0) {
                        this.keyword_mapping[author_key] = {
                            mapping: mapping,
                            label: {},
                            count: 1,
                            isActive: false,
                            docs: [doc],
                            isDone: true,
                            highest_property: "",
                            highest_value: 0,
                            sub_label: 0,
                            sub_key: 0,
                            sims: [],
                            co_oc: []
                        }
                    }
                    else {
                        this.keyword_mapping[author_key] = {
                            mapping: "ERROR IN PREPROCESSING",
                            label: {},
                            count: 1,
                            isActive: false,
                            docs: [doc],
                            isDone: true,
                            highest_property: "",
                            highest_value: 0,
                            sub_label: 0,
                            sub_key: 0,
                            sims: [],
                            co_oc: []
                        }
                    }
                } else {
                    let keyword = this.keyword_mapping[author_key];
                    keyword.count++;
                    keyword.docs.push(doc)
                    this.keyword_mapping[author_key] = keyword
                }
            }

            doc["type"] = "old";
        }


        let temp_labels = new Array();

        for (let [key, value] of Object.entries(this.label_docs)) {
            let o = {}
            let keywords = []

            o["label"] = key
            o["docs"] = value
            o["n_docs"] = o["docs"].length
            o["substring_similarity"] = 0.0
            o["keyword_avg_similarity"] = 0.0
            o["total_similarity"] = 0.0
            o["isActive"] = false


            for (let [k, l] of Object.entries(_.pickBy(mapping, x => x === key))) {
                keywords.push(k)
            }

            o["keywords"] = keywords.join(" ")

            temp_labels.push(o)
        }

        this.label_docs = temp_labels

        for (const doc of this.documents) {
            let unknown = 0;

            // if (!doc["Keywords_Processed"]) {
            //     doc["Keywords_Processed"] = ""
            // }

            doc["DOI"] = "https://doi.org/" + doc["DOI"]
            doc["type"] = "new"

            // Create final keywords field
            // TODO: fix casing in preprocessing
            doc["Keywords_Processed"] = doc["Keywords_Processed"].toLowerCase().split(";");

            // // Populate final keyword list
            // let final = doc["Keywords_Processed"]
            //     // .map(x => this.store.getKeywordMapping(x).replace(/[^a-zA-Z]/g, ""))
            //     .map(x => this.store.getKeywordMapping(x))
            // // .filter(x => x !== "unclear");

            // final = _.uniq(final);

            for (const author_key of doc["Keywords_Processed"]) {
                if (!this.keyword_mapping.hasOwnProperty(author_key)) {
                    let mapping = this.store.getKeywordMapping(author_key);
                    let new_obj = {
                        mapping: "",
                        label: {},
                        count: 1,
                        isActive: false,
                        docs: [doc],
                        isDone: false,
                        highest_property: "",
                        highest_value: 0,
                        sub_label: 0,
                        sub_key: 0,
                        sims: [],
                        co_oc: []
                    }

                    if (mapping.length > 0) {
                        new_obj.isDone = true
                        new_obj.mapping = mapping
                    }
                    else {
                        new_obj.isDone = false
                        new_obj.mapping = ""
                        unknown++;
                    }

                    this.keyword_mapping[author_key] = new_obj;

                } else {
                    let keyword = this.keyword_mapping[author_key];
                    keyword.count++;
                    keyword.docs.push(doc)
                    this.keyword_mapping[author_key] = keyword
                }
            }

            doc["Unknown"] = unknown;

            // let temp = new Array();

            // for (const elem of final) {
            //     if (elem.length > 0) temp.push({
            //         tag: elem
            //     })
            // }

            // doc["Final"] = temp;
        }

        // Flatten keyword list
        for (let [key, value] of Object.entries(this.keyword_mapping)) {
            value["keyword"] = key
            this.keyword_list.push(value)
        }

        // Add label object to keywords
        for (const key of this.keyword_list) {
            if (key.mapping) {
                let label = this.label_docs.filter(x => x.label.toLowerCase() == key.mapping.replace(/[^\w]*/g, "").toLowerCase())

                key["label"] = label[0]
            }
        }

        // Replace keyword strings with objects
        for (const doc of this.documents) {
            let temp = []
            for (const keyword of doc["Keywords_Processed"]) {
                temp.push(this.keyword_list.filter(e => e.keyword == keyword)[0])
            }
            doc["Keywords_Processed"] = temp

            // Check if doc is already done
            if (temp.every(x => x["mapping"].length > 0)) doc["isDone"] = true;

            // Build coocurrence information
            for (const keyword of temp) {
                for (const co of temp) {
                    if (keyword != co) {
                        let found = co.co_oc.find(x => x.keyword.keyword == keyword.keyword)

                        if (found) {
                            found.count = found.count + 1
                        }
                        else {
                            co.co_oc.push({
                                keyword: keyword,
                                count: 1
                            })
                        }
                    }
                }
            }
        }

        for (const doc of this.labeled_documents) {
            let temp = []
            for (const keyword of doc["Keywords_Processed"]) {
                temp.push(this.keyword_list.filter(e => e.keyword == keyword)[0])
            }
            doc["Keywords_Processed"] = temp

            // Build coocurrence information
            for (const keyword of temp) {
                for (const co of temp) {
                    if (keyword != co) {
                        let found = co.co_oc.find(x => x.keyword.keyword == keyword.keyword)

                        if (found) {
                            found.count = found.count + 1
                        }
                        else {
                            co.co_oc.push({
                                keyword: keyword,
                                count: 1
                            })
                        }
                    }
                }
            }
        }

        // Compute all similarities for all new keywords
        for (const keyword of this.keyword_list) {
            if (!keyword["isDone"]) {
                // Populate global variables
                // this.updateSelectedSimilarities(keyword);
                // this.computeLabelSimilarities(this.label_docs, keyword)
            }
        }

        // Precompute tfidf
        let identifiers = {}

        for (const key of this.keyword_list) {
            let mapping = key.mapping.toLowerCase();
            // let keyword = key.keyword.replace(" ", "SEP")
            let keyword = key.keyword

            if (identifiers.hasOwnProperty(mapping)) {

                identifiers[mapping] = identifiers[mapping] + " " + keyword
            }
            else {
                identifiers[mapping] = keyword
            }

        }

        this.tfidf = new tfidf.Corpus(
            Object.keys(identifiers),
            Object.values(identifiers),
        );

        for (const label of this.label_docs) {
            label["top_words"] = this.tfidf.getTopTermsForDocument(label.label.toLowerCase()).map(x => x[0])
        }

        // let sim = new tfidf.Similarity(corpus).getDistanceMatrix()
        // console.log(tfidf.Similarity.cosineSimilarity(corpus.getDocumentVector("document2"), corpus.getDocumentVector("document3")))


        // // Distances
        // console.log(distances.string.levenshtein("hamming", "haming"))
        // console.log(distances.string.jaroWinkler("hamming", "haming"))
        // console.log(distances.string.soundex("hamming", "haming"))

        // // Stemmer
        // console.log(porter("running"))

        console.log(this.labeled_documents)
        console.log(this.documents)
        console.log(this.keyword_list)
        console.log(this.label_docs)

        this.updateDocumentStats();
        this.updateKeywordStats();
        // Prepare autocomplete list
        // for (const keyword of this.label_list) {
        //     this.autocompleteData[keyword["Cluster"]] = null;
        // }

        // this.selectDocument(0);
        this.selectKeyword(this.keyword_list.filter(x => !x.label)[0])
    }

    selectDocument(doc) {
        this.selected_document = doc;
    }

    selectLabel(label) {
        if (this.selected_label) this.selected_label["isActive"] = false;
        this.selected_label = label
        this.selected_label["isActive"] = true

        this.updateSelectedSimilarities(this.selected_keyword);

        // Update graph
        // this.createGraphData();
    }

    selectLabelName(label_name) {
        let index = this.label_docs.findIndex(x => x.label === label_name)

        if (index) this.selectLabel(this.label_docs[index])
    }

    async selectKeyword(key) {
        // Set active keyword
        if (this.selected_keyword) this.selected_keyword.isActive = false;
        key.isActive = true;

        this.selected_keyword = key;
        this.selected_document = key.docs[0]
        // this.selected_document_list.push(key.docs[0])

        this.updateSelectedSimilarities(this.selected_keyword);

        // Update Labels List
        this.computeLabelSimilarities(this.label_docs, this.selected_keyword);
        this.populateLabels(this.label_docs, this.selected_keyword);

        // Update graph
        // this.createGraphData();
    }

    updateSelectedSimilarities(keyword) {
        // Prepare Document List
        this.selected_similarities.length = 0;
        this.selected_similar_keywords = [];
        let groups = {}

        if (keyword) {
            for (const element of keyword.docs) {
                this.selected_similarities.push({
                    document: element,
                    text_similarity: 0,
                    // text_similarity: this.cosine_similarity(this.selected_document["Abstract_Vector"], element["Abstract_Vector"]),
                    //keyword_similarity: this.jaccard_similarity(this.selected_document["Keywords"], element["Keywords"])
                    // keyword_similarity: this.cosine_similarity(this.selected_document["Keyword_Vector"], element["Keyword_Vector"])
                    keyword_similarity: 0
                })
            }

            // Populate similar keywords
            for (const element of keyword.co_oc) {
                // this.selected_similar_keywords.push({
                //     keyword: element.keyword,
                //     count: element.keyword.count,
                //     cooc_sim: this.jaccard_similarityBy(element.keyword.co_oc, this.selected_keyword.co_oc, "keyword")
                // })

                // Populate groups
                if (groups.hasOwnProperty(element.keyword.mapping)) {
                    groups[element.keyword.mapping].push(element.keyword)
                }
                else {
                    let temp = []
                    temp.push(element.keyword)
                    groups[element.keyword.mapping] = temp
                }
            }

            for (const [key, value] of Object.entries(groups)) {
                let norm_key = key.replace(/[^A-Za-z0-9]/g, "")
                let label_obj = this.label_docs.find(x => x.label === norm_key)
                this.selected_similar_keywords.push({
                    label: norm_key,
                    label_object: label_obj,
                    keywords: value,
                })
            }
        }

        // if (this.selected_label) {
        //     for (const element of this.selected_label.docs) {
        //         this.selected_similarities.push({
        //             document: element,
        //             text_similarity: 0,
        //             // text_similarity: this.cosine_similarity(this.selected_document["Abstract_Vector"], element["Abstract_Vector"]),
        //             //keyword_similarity: this.jaccard_similarity(this.selected_document["Keywords"], element["Keywords"])
        //             // keyword_similarity: this.cosine_similarity(this.selected_document["Keyword_Vector"], element["Keyword_Vector"])
        //             keyword_similarity: 0
        //         })
        //     }
        // }
    }

    computeKeywordSimilarity() {
        this.label_list.forEach(element => {
            // element["Similarity"] = this.cosine_similarity(this.selected_document["Keyword_Vector"], element["Vector"])
            element["Similarity"] = 0
        });
    }

    computeSimilarities() {
        this.selected_similarities.length = 0;
        this.documents.forEach(element => {
            this.selected_similarities.push({
                document: element,
                // text_similarity: this.cosine_similarity(this.selected_document["Abstract_Vector"], element["Abstract_Vector"]),
                text_similarity: 0,
                //keyword_similarity: this.jaccard_similarity(this.selected_document["Keywords"], element["Keywords"])
                // keyword_similarity: this.cosine_similarity(this.selected_document["Keyword_Vector"], element["Keyword_Vector"])
                keyword_similarity: 0
            })
        });
    }

    colorConverter(num: number) {
        let color = "none"

        if (num > 0.5) return "green"
        else if (num > 0) return "orange"
        else return "#A6A6A6"
    }

    populateLabels(labels, keyword) {
        // console.log("NEW", keyword)
        for (const label of labels) {
            label["substring_similarity"] = keyword["sub_label"][label.label]
            label["keyword_substring_similarity"] = keyword["sub_key"][label.label]
            label["edit_distance_similarity"] = keyword["sub_edit"][label.label]
            label["cooc_similarity"] = keyword["sub_cooc"][label.label]

            let temp = []
            temp.push({
                type: "Label Substring",
                color: this.colorConverter(label["substring_similarity"]),
                value: label["substring_similarity"]
            })
            temp.push({
                type: "Keyword Substring",
                color: this.colorConverter(label["keyword_substring_similarity"]),
                value: label["keyword_substring_similarity"]
            })
            temp.push({
                type: "Cooccurrent Keywords",
                color: this.colorConverter(label["cooc_similarity"]),
                value: label["cooc_similarity"]
            })
            temp.push({
                type: "Edit Distance",
                color: this.colorConverter(label["edit_distance_similarity"]),
                value: label["edit_distance_similarity"]
            })

            label["similarities"] = temp

            label["total_similarity"] =
                label["substring_similarity"] +
                label["keyword_substring_similarity"] +
                // label["edit_distance_similarity"] +
                label["cooc_similarity"]

            // if (label["total_similarity"] > 0) console.log(label.label, label["total_similarity"])
        }

        // Sort labels list
        // this.label_sort_value = keyword["highest_value"]
        this.label_sort_property = "";
        this.label_sort_property = "total_similarity"
    }

    computeLabelSimilarities(labels, keyword) {
        // Only compute if not already computed
        if (!keyword["sub_label"]) {
            let sub_label_obj = {}
            let sub_key_obj = {}
            let sub_edit_obj = {}
            let sub_cooc_obj = {}

            for (let label of labels) {
                let substring_dist = 0
                let keyword_substring_dist = 0
                let cooc_sim = 0
                let edit_dist = 4

                let keywords = keyword.keyword.split(" ");

                // Label Substring
                for (const keyword of keywords) {
                    if (label.label.toLowerCase().includes(keyword.toLowerCase())) {
                        substring_dist++;
                    }
                }

                // Keyword Substring
                n_gram_loop:
                for (let n_gram_size = Math.min(keywords.length - 1, 2); n_gram_size > 0; n_gram_size--) {
                    for (let index = 0; index < n_gram_size; index++) {
                        let n_gram = keywords.slice(index, index + n_gram_size + 1).join(" ")

                        if (label.keywords.includes(n_gram)) {
                            keyword_substring_dist = n_gram_size;
                            // Stop after finding highest n_gram
                            break n_gram_loop;
                        }
                    }
                }

                // Cooc dist
                let cooc_keywords = keyword.co_oc.filter(x => x.keyword.label == label)

                if (cooc_keywords) cooc_sim = cooc_keywords.length

                // Edit dist
                edit_loop:
                for (const keyword of keywords) {
                    if (label.top_words) {
                        for (const top of label.top_words) {
                            const dist = distances.string.jaroWinkler(keyword, top)

                            // if (dist < 0.2) console.log(keyword, top)

                            if (dist < edit_dist) edit_dist = dist

                            // if (dist == 1) {
                            //     edit_dist = 1;
                            //     break edit_loop;
                            // }

                            // if (dist > 1 && dist < 4 && dist < edit_dist) {
                            //     edit_dist = dist;
                            // }
                        }
                    }
                }

                let substring_avg_dist = substring_dist / keywords.length;
                sub_label_obj[label.label] = substring_avg_dist

                // let edit_norm_sim = 1 - (edit_dist - 1) / 3
                let edit_norm_sim = 1 - edit_dist
                sub_edit_obj[label.label] = edit_norm_sim

                let cooc_norm_sim = 0
                if (cooc_sim >= 3) cooc_norm_sim = 1 + 0.01
                else if (cooc_sim == 2) cooc_norm_sim = 0.66 + 0.01
                else if (cooc_sim == 1) cooc_norm_sim = 0.33 + 0.01
                sub_cooc_obj[label.label] = cooc_norm_sim

                let substring_avg_dist_keyword = keyword_substring_dist / keywords.length;
                sub_key_obj[label.label] = substring_avg_dist_keyword
            }

            // Set property in object
            keyword["sub_label"] = sub_label_obj
            keyword["sub_key"] = sub_key_obj
            keyword["sub_edit"] = sub_edit_obj
            keyword["sub_cooc"] = sub_cooc_obj
        }
    }

    // Sort Function
    setSortProperty = (property) => this.sim_property = property;
    setKeywordSortProperty = (property) => this.key_property = property;
    setLabelSortProperty = (property) => this.label_sort_property = property;

    setActiveKeyword = (keyword) => this.selectKeyword(keyword);
    getMapping = (keyword) => this.store.getKeywordMapping(keyword);
    checkMapping = (keyword) => keyword.mapping.length > 0 ? 1 : 0;

    removeAddKeyword(keyword) {
        this.selected_additional_keywords.splice(
            this.selected_additional_keywords.indexOf(keyword), 1
        );
    }

    selectAddKeyword(keyword) {
        if (!keyword.isDone) {
            if (this.selected_additional_keywords.includes(keyword)) {
                this.removeAddKeyword(keyword)
            }
            else {
                this.selected_additional_keywords.push(keyword)
            }
        }
    }

    skipKeyword() {

    }

    async applyLabel() {
        this.selected_keyword.mapping = this.selected_label.label;
        this.selected_keyword.label = this.selected_label;
        this.selected_keyword.isDone = true;

        if (this.selected_additional_keywords) {
            for (const keyword of this.selected_additional_keywords) {
                keyword.mapping = this.selected_label.label;
                keyword.label = this.selected_label;
                keyword.isDone = true;
            }

            this.selected_additional_keywords = [];
        }

        // Update keyword list view
        // this.finishedKeywords = !this.finishedKeywords;
        // this.finishedKeywords = !this.finishedKeywords;

        // this.selected_keyword = this.keyword_list.filter(x => !x.isDone)[0]
        // let index = this.keyword_list.indexOf(this.selected_keyword)

        await this.selectKeyword(this.keyword_list.filter(x => !x.isDone)[0])
        this.selectLabel(this.label_docs[0])

        this.updateKeywordStats();

        // Check if some documents are now finished
        for (const doc of this.documents) {
            if (doc["Keywords_Processed"].every(x => x["mapping"].length > 0)) doc["isDone"] = true;
        }

        this.updateDocumentStats();

        // Reset filter
        this.searchDocumentTerm = ""
        this.searchKeywordsTerm = ""
        this.searchLabelsTerm = ""
    }

    downloadData() {
        let rows = [
            ["title", "keywords", "authors", "doi", "labels"]
        ];

        for (const doc of this.documents) {
            let labels = _.uniq(doc["Keywords_Processed"].map(x => x.mapping).filter(x => x.length > 0)).join(";").replace(/,/g, ";")

            let keywords = "";
            if (doc["Keywords"]) keywords = doc["Keywords"].replace(/,/g, ";")

            rows.push([
                doc["Title"].replace(/,/g, ";"),
                keywords,
                doc["Authors"].replace(/,/g, ";"),
                doc["DOI"],
                labels
            ])
        }

        let csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.join(",")).join("\n");

        // var encodedUri = encodeURI(csvContent);
        // window.open(encodedUri);
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "labeled_data.csv");
        document.body.appendChild(link);

        link.click();
    }

    checkActiveKeyword(keyword) {
        if (this.selected_keyword) {
            if (this.selected_keyword === keyword) return 0
            else return 1
        }
    }

    removeKeyword(keyword) {
        this.selected_document["Final"] = this.selected_document["Final"]
            .filter(item => item !== keyword);
    }

    addKeyword(keyword) {
        this.selected_document["Final"] = this.selected_document["Final"]
            .concat({
                tag: keyword
            })
    }


    filterKeywordsFunc(searchExpression, value) {
        let itemValue = value["keyword"];
        if (!searchExpression || !itemValue) return false;

        return itemValue.toUpperCase().indexOf(searchExpression.toUpperCase()) !== -1;
    }

    filterLabelsFunc(searchExpression, value) {
        let itemValue = value["label"];
        if (!searchExpression || !itemValue) return false;

        return itemValue.toUpperCase().indexOf(searchExpression.toUpperCase()) !== -1;
    }

    filterDocumentsFunc(searchExpression, value) {
        let itemValue = value.document["Title"];
        if (!searchExpression || !itemValue) return false;

        return itemValue.toUpperCase().indexOf(searchExpression.toUpperCase()) !== -1;
    }

    updateDocumentStats() {
        this.docs_todo = this.documents.filter(x => !x.isDone).length
        this.docs_done = this.documents.filter(x => x.isDone).length + this.labeled_documents.length

        this.docs_per = this.docs_todo / (this.labeled_documents + this.documents)
    }

    updateKeywordStats() {
        this.keywords_todo = this.keyword_list.filter(x => x["mapping"].length == 0).length
        this.keywords_done = this.keyword_list.filter(x => x["mapping"].length > 0).length

        this.keywords_per = this.keywords_todo / this.keyword_list.length
    }
}