import {
    autoinject
} from 'aurelia-dependency-injection';
import {
    DataStore
} from 'data-store';
import * as Mark from 'mark.js';
import * as math from 'mathjs';
import * as _ from 'lodash';
import { templateController } from 'aurelia-framework';

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

    // Selection
    public selected_document_list = [];
    public selected_document;
    public selected_keyword;
    public selected_label;
    public showDocuments = false;
    public selected_similarities = [];
    public selected_similar_keywords = [];

    // Similarity list
    public sim_property = "text_similarity";
    public key_property = "highest_value";
    public label_sort_property = "n_docs";
    public label_sort_value = 0;

    // Temp variables
    public sort_property = "descending";
    public graph_data;

    // Distance Metrics
    cosine_similarity(v1, v2) {
        if (v1 && v2) {
            return math.abs(math.dot(v1, v2) / (math.norm(v1) * math.norm(v2)))
        } else {
            return 0
        }
    }

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

            for (const author_key of doc["Keywords"].split(";")) {
                if (!this.keyword_mapping.hasOwnProperty(author_key)) {
                    let mapping = this.store.getKeywordMapping(author_key);
                    if (mapping.length > 0) {
                        this.keyword_mapping[author_key] = {
                            mapping: mapping,
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
                    } else {
                        this.keyword_mapping[author_key] = {
                            mapping: "",
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


            for (let [k, l] of Object.entries(_.pickBy(mapping, x => x === key))) {
                keywords.push(k)
            }

            o["keywords"] = keywords.join(" ")

            temp_labels.push(o)
        }

        this.label_docs = temp_labels
        console.log(this.label_docs)

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

            // Populate final keyword list
            let final = doc["Keywords_Processed"]
                // .map(x => this.store.getKeywordMapping(x).replace(/[^a-zA-Z]/g, ""))
                .map(x => this.store.getKeywordMapping(x))
            // .filter(x => x !== "unclear");

            final = _.uniq(final);

            for (const author_key of doc["Keywords_Processed"]) {
                if (!this.keyword_mapping.hasOwnProperty(author_key)) {
                    let mapping = this.store.getKeywordMapping(author_key);
                    if (mapping.length > 0) {
                        this.keyword_mapping[author_key] = {
                            mapping: mapping,
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
                    } else {
                        this.keyword_mapping[author_key] = {
                            mapping: "",
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
                        unknown++;
                    }
                } else {
                    let keyword = this.keyword_mapping[author_key];
                    keyword.count++;
                    keyword.docs.push(doc)
                    this.keyword_mapping[author_key] = keyword
                }
            }

            doc["Unknown"] = unknown;

            let temp = new Array();

            for (const elem of final) {
                if (elem.length > 0) temp.push({
                    tag: elem
                })
            }

            doc["Final"] = temp;
        }

        // Create coocurrence informations


        // Flatten keyword list
        for (let [key, value] of Object.entries(this.keyword_mapping)) {
            value["keyword"] = key
            this.keyword_list.push(value)
        }

        // Compuate all similarities for all new keywords
        // for (const keyword of this.keyword_list) {
        //     if (!keyword["isDone"]) {
        //         // Populate global variables
        //         this.computeLabelSimilarities(this.label_docs, keyword)

        //         // Set values for the keyword
        //         keyword["highest_value"] = this.label_sort_value;
        //         keyword["highest_property"] = this.label_sort_property;
        //     }
        // }

        // Replace keyword strings with objects
        for (const doc of this.documents) {
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

        for (const doc of this.labeled_documents) {
            let temp = []
            for (const keyword of doc["Keywords"].split(";")) {
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

        console.log(this.keyword_list)

        // Prepare autocomplete list
        for (const keyword of this.label_list) {
            this.autocompleteData[keyword["Cluster"]] = null;
        }

        this.selectDocument(0);
    }

    selectDocument(doc) {
        this.selected_document = doc;
    }

    selectLabel(label) {
        this.selected_label = label

        this.updateSelectedSimilarities();

        // Update graph
        // this.createGraphData();
    }

    selectKeyword(key) {
        // Set active keyword
        if (this.selected_keyword) this.selected_keyword.isActive = false;
        key.isActive = true;

        this.selected_keyword = key;
        this.selected_document = key.docs[0]
        // this.selected_document_list.push(key.docs[0])

        this.updateSelectedSimilarities();

        // Update Labels List
        this.computeLabelSimilarities(this.label_docs, this.selected_keyword);
        this.populateLabels(this.label_docs, this.selected_keyword);

        // Update graph
        // this.createGraphData();
    }

    updateSelectedSimilarities() {
        // Prepare Document List
        this.selected_similarities.length = 0;
        this.selected_similar_keywords.length = 0;

        if (this.selected_keyword) {
            for (const element of this.selected_keyword.docs) {
                this.selected_similarities.push({
                    document: element,
                    text_similarity: this.cosine_similarity(this.selected_document["Abstract_Vector"], element["Abstract_Vector"]),
                    //keyword_similarity: this.jaccard_similarity(this.selected_document["Keywords"], element["Keywords"])
                    keyword_similarity: this.cosine_similarity(this.selected_document["Keyword_Vector"], element["Keyword_Vector"])
                })
            }

            // Populate similar keywords
            for (const element of this.selected_keyword.co_oc) {
                this.selected_similar_keywords.push({
                    keyword: element.keyword,
                    count: element.keyword.count,
                    cooc_sim: this.jaccard_similarityBy(element.keyword.co_oc, this.selected_keyword.co_oc, "keyword")
                })
            }
        }

        console.log(this.selected_similarities)

        if (this.selected_label) {
            for (const element of this.selected_label.docs) {
                this.selected_similarities.push({
                    document: element,
                    text_similarity: this.cosine_similarity(this.selected_document["Abstract_Vector"], element["Abstract_Vector"]),
                    //keyword_similarity: this.jaccard_similarity(this.selected_document["Keywords"], element["Keywords"])
                    keyword_similarity: this.cosine_similarity(this.selected_document["Keyword_Vector"], element["Keyword_Vector"])
                })
            }
        }
    }

    computeKeywordSimilarity() {
        this.label_list.forEach(element => {
            element["Similarity"] = this.cosine_similarity(this.selected_document["Keyword_Vector"], element["Vector"])
        });
    }

    computeSimilarities() {
        this.selected_similarities.length = 0;
        this.documents.forEach(element => {
            this.selected_similarities.push({
                document: element,
                text_similarity: this.cosine_similarity(this.selected_document["Abstract_Vector"], element["Abstract_Vector"]),
                //keyword_similarity: this.jaccard_similarity(this.selected_document["Keywords"], element["Keywords"])
                keyword_similarity: this.cosine_similarity(this.selected_document["Keyword_Vector"], element["Keyword_Vector"])
            })
        });
    }


    populateLabels(labels, keyword) {
        for (const label of labels) {
            label["keyword_similarities"] = keyword["sims"][label.label]
            label["keyword_avg_similarity"] = math.median(keyword["sims"][label.label])

            label["substring_similarity"] = keyword["sub_label"][label.label]
            label["keyword_substring_similarity"] = keyword["sub_key"][label.label]
        }

        // Sort labels list
        this.label_sort_value = keyword["highest_value"]
        this.label_sort_property = "";
        this.label_sort_property = keyword["highest_property"];
    }

    computeLabelSimilarities(labels, keyword) {
        // Only compute if not already computed
        if (!keyword["highest_property"]) {
            let highest_sim_type = "n_docs"
            let highest_sim = 0;

            let sub_label_obj = {}
            let sub_key_obj = {}
            let sims_obj = {}

            for (let label of labels) {
                let similarities = [];

                for (const doc of labels) {
                    for (const key_doc of keyword.docs) {
                        similarities.push(this.cosine_similarity(key_doc.Abstract_Vector, doc.Abstract_Vector))
                    }
                }

                sims_obj[label.label] = similarities
                let avg_sim = math.median(similarities)

                if (avg_sim > highest_sim) {
                    highest_sim = avg_sim
                    highest_sim_type = "keyword_avg_similarity"
                }


                // Keyword Substring
                // Label Substring
                let substring_dist = 0
                let keyword_substring_dist = 0
                let keywords = keyword.keyword.split(" ")

                for (const keyword of keywords) {
                    if (label.label.toLowerCase().includes(keyword)) {
                        substring_dist++;
                    }
                }

                n_gram_loop:
                for (let n_gram_size = math.min(keywords.length - 1, 4); n_gram_size > 0; n_gram_size--) {
                    for (let index = 0; index < n_gram_size; index++) {
                        let n_gram = keywords.slice(index, index + n_gram_size + 1).join(" ")

                        if (label.keywords.includes(n_gram)) {
                            keyword_substring_dist = n_gram_size;
                            // Stop after finding highest n_gram
                            break n_gram_loop;
                        }
                    }
                }

                let substring_avg_dist = substring_dist / keywords.length;
                sub_label_obj[label.label] = substring_avg_dist

                if (substring_avg_dist >= highest_sim) {
                    highest_sim = substring_avg_dist
                    highest_sim_type = "substring_similarity"
                }

                let substring_avg_dist_keyword = keyword_substring_dist / keywords.length;
                sub_key_obj[label.label] = substring_avg_dist_keyword

                if (substring_avg_dist_keyword > highest_sim) {
                    highest_sim = substring_avg_dist_keyword
                    highest_sim_type = "keyword_substring_similarity"
                }
            }

            // Set property in object
            keyword["sub_label"] = sub_label_obj
            keyword["sub_key"] = sub_key_obj
            keyword["sims"] = sims_obj

            keyword["highest_property"] = highest_sim_type
            keyword["highest_value"] = highest_sim
        }
    }

    // Sort Function
    setSortProperty = (property) => this.sim_property = property;
    setKeywordSortProperty = (property) => this.key_property = property;
    setLabelSortProperty = (property) => this.label_sort_property = property;

    setActiveKeyword = (keyword) => this.selectKeyword(keyword);
    getMapping = (keyword) => this.store.getKeywordMapping(keyword);
    checkMapping = (keyword) => keyword.mapping.length > 0 ? 1 : 0;
    applyLabel = () => this.selected_keyword.mapping = this.selected_label.label;
    // applyLabel() {
    //     this.graph_data = {
    //         nodes: [],
    //         links: []
    //     }

    //     this.graph_data.nodes.push({
    //         "id": 112,
    //         "name": "X"
    //     })
    // }

    createGraphData() {
        // Reset graph data for easiest view update
        const temp = {
            nodes: [],
            links: []
        }
        let all_docs = this.selected_similarities;

        for (let index = 0; index < all_docs.length; index++) {
            const doc = all_docs[index].document;

            // Add doc as node
            temp.nodes.push(doc)

            for (let j = index + 1; j < all_docs.length; j++) {
                const check = all_docs[j].document;

                let overlap = _.intersectionBy(doc["Keywords_Processed"], check["Keywords_Processed"])
                let union = _.union(doc["Keywords_Processed"], check["Keywords_Processed"])

                let strength = overlap.length / union.length

                if (overlap.length >= 1) {
                    temp.links.push({
                        source: doc,
                        target: check,
                        strength: strength
                    })
                }
            }
        }

        console.log(temp)
        this.graph_data = temp;
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

}