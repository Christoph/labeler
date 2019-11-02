import { autoinject } from 'aurelia-dependency-injection';
import { DataStore } from 'data-store';
import * as Mark from 'mark.js';
import * as math from 'mathjs';
import * as _ from 'lodash';
import { timingSafeEqual } from 'crypto';

@autoinject()
export class P1 {
    public documents;
    public label_list;
    public keyword_list;
    public autocompleteData = {};

    // Selection
    public selected_document_list = [];
    public selected_document;
    public selected_keyword;
    public showDocuments = false;
    public selected_similarities = [];

    // Similarity list
    public sim_property = "text_similarity";

    // Temp variables
    public sort_property = "descending";

    // Distance Metrics
    cosine_similarity(v1, v2) {
        if (v1 && v2) {
            return math.dot(v1, v2) / (math.norm(v1) * math.norm(v2))
        }
        else {
            return 0
        }
    }

    jaccard_similarity(s1, s2) {
        return math.setIntersect(s1, s2).length / math.setUnion(s1, s2).length
    }

    constructor(public store: DataStore) {
        this.documents = store.getMeta();
        this.label_list = store.getClasses();
        this.keyword_list = {}

        for (const doc of this.documents) {
            let unknown = 0;

            if (doc["Keywords"]) {
                doc["Keywords"] = doc["Keywords"].toLowerCase()
            }
            else {
                doc["Keywords"] = ""
            }

            doc["DOI"] = "https://doi.org/" + doc["DOI"]

            // Create final keywords field
            doc["Keywords"] = doc["Keywords"].split(";");

            // Populate final keyword list
            let final = doc["Keywords"]
                .map(x => this.store.getKeywordMapping(x).replace(/[^a-zA-Z]/g, ""))
                .filter(x => x !== "unclear");

            final = _.uniq(final);

            for (const author_key of doc["Keywords"]) {
                if (!this.keyword_list.hasOwnProperty(author_key)) {
                    let mapping = this.store.getKeywordMapping(author_key);
                    if (mapping.length > 0) {
                        this.keyword_list[author_key] = {
                            mapping: mapping,
                            count: 0,
                            docs: [doc]
                        }
                    }
                    else {
                        this.keyword_list[author_key] = {
                            mapping: "",
                            count: 0,
                            docs: [doc]
                        }
                        unknown++;
                    }
                }
                else {
                    let keyword = this.keyword_list[author_key];
                    keyword.count++;
                    keyword.docs.push(doc)
                    this.keyword_list[author_key] = keyword
                }
            }

            doc["Unknown"] = unknown;

            let temp = new Array();

            for (const elem of final) {
                if (elem.length > 0) temp.push({ tag: elem })
            }

            doc["Final"] = temp;
        }

        // Flatten keyword list
        let temp = new Array();

        for (let [key, value] of Object.entries(this.keyword_list)) {
            value["keyword"] = key
            temp.push(value)
        }

        this.keyword_list = temp

        // Replace keyword strings with objects
        for (const doc of this.documents) {
            let temp = []
            for (const keyword of doc["Keywords"]) {
                temp.push(this.keyword_list.filter(e => e.keyword == keyword)[0])
            }
            doc["Keywords"] = temp
        }

        // Prepare autocomplete list
        for (const keyword of this.label_list) {
            this.autocompleteData[keyword["Cluster"]] = null;
        }

        this.selectDocument(0);
    }

    selectDocument(index) {
        let doc;
        // Set new document
        if (this.selected_similarities.length > 0) {
            doc = this.selected_similarities[index].document;
        }
        else {
            doc = this.documents[index]
        }

        this.selected_document = doc;
        this.selected_document_list.push(index);
        this.computeSimilarities();
        this.computeKeywordSimilarity();
    }

    selectKeyword(index) {
        let key;
        if (!isNaN(index)) {
            key = this.keyword_list[index]
        }
        else {
            key = index
        }

        this.selected_keyword = key;
        this.selected_document = key.docs[0]
        this.selected_document_list.push(key.docs[0])

        this.selected_similarities.length = 0;
        for (const element of key.docs) {
            this.selected_similarities.push({
                document: element,
                text_similarity: this.cosine_similarity(this.selected_document["Abstract_Vector"], element["Abstract_Vector"]),
                //keyword_similarity: this.jaccard_similarity(this.selected_document["Keywords"], element["Keywords"])
                keyword_similarity: this.cosine_similarity(this.selected_document["Keyword_Vector"], element["Keyword_Vector"])
            })
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

    setSortProperty(property) {
        this.sim_property = property;
    }

    setActiveKeyword(keyword) {
        this.selectKeyword(keyword)
    }

    nextDocument() {
        this.selected_document["Done"] = true;
        const index = this.documents.findIndex(x => x["Key"] === this.selected_document["Key"])
        this.selectDocument(index + 1)
    }

    lastDocument() {
        // Remove the current document from the list
        this.selected_document_list.pop();
        // Get and remove the previous element
        const index = this.selected_document_list.pop();
        this.selectDocument(index)
    }

    toggleDocuments() {
        this.showDocuments = !this.showDocuments;
    }

    getMapping(keyword) {
        return this.store.getKeywordMapping(keyword);
    }

    checkMapping(keyword) {
        if (this.store.getKeywordMapping(keyword).length > 0) return 1
        else return 0
    }

    checkActiveKeyword(keyword) {
        if (this.selected_keyword) {
            if (this.selected_keyword === keyword) return 1
            else return 0
        }
    }

    removeKeyword(keyword) {
        this.selected_document["Final"] = this.selected_document["Final"]
            .filter(item => item !== keyword);
    }

    addKeyword(keyword) {
        this.selected_document["Final"] = this.selected_document["Final"]
            .concat({ tag: keyword })
    }

    applyKeyword(label) {
        this.selected_keyword.mapping = label["Cluster"]
    }
}