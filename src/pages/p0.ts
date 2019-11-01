import { autoinject } from 'aurelia-dependency-injection';
import { DataStore } from 'data-store';
import * as Mark from 'mark.js';
import * as math from 'mathjs';
import * as _ from 'lodash';

@autoinject()
export class P1 {
    public documents;
    public keyword_list;
    public autocompleteData = {};

    // Selection
    public selected_document_list = [];
    public selected_document;
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
        this.keyword_list = store.getClasses();

        for (const doc of this.documents) {
            let unknown = 0;

            if (doc["Keywords"]) {
                doc["Keywords"] = doc["Keywords"].toLowerCase()
            }
            else {
                doc["Keywords"] = ""
            }

            for (const author_key of doc["Keywords"].split(";")) {
                let mapping = this.store.getKeywordMapping(author_key);
                if (mapping.length < 1) {
                    unknown++;
                }
            }

            doc["Unknown"] = unknown;

            doc["DOI"] = "https://doi.org/" + doc["DOI"]

            // Create final keywords field
            doc["Keywords"] = doc["Keywords"].split(";");

            // Populate final keyword list
            let final = doc["Keywords"]
                .map(x => this.store.getKeywordMapping(x).replace(/[^a-zA-Z]/g, ""))
                .filter(x => x !== "unclear");

            final = _.uniq(final);

            let temp = new Array();

            for (const elem of final) {
                if (elem.length > 0) temp.push({ tag: elem })
            }

            doc["Final"] = temp;
        }

        // Prepare autocomplete list
        for (const keyword of this.keyword_list) {
            this.autocompleteData[keyword["Cluster"]] = null;
        }

        this.selectDocument(0);
    }

    selectDocument(index) {
        // Set new document
        const doc = this.documents[index];
        this.selected_document = doc;
        this.selected_document_list.push(index);
        this.computeSimilarities();
        this.computeKeywordSimilarity();
    }

    computeKeywordSimilarity() {
        this.keyword_list.forEach(element => {
            element["Similarity"] = this.cosine_similarity(element["Abstract_Vector"], this.selected_document["Abstract_Vector"])
        });
    }

    computeSimilarities() {
        this.selected_similarities.length = 0;
        this.documents.forEach(element => {
            this.selected_similarities.push({
                document: element,
                text_similarity: this.cosine_similarity(this.selected_document["Abstract_Vector"], element["Abstract_Vector"]),
                keyword_similarity: this.jaccard_similarity(this.selected_document["Final"], element["Final"])
            })
        });
    }

    setSortProperty(property) {
        this.sim_property = property;
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

    removeKeyword(keyword) {
        this.selected_document["Final"] = this.selected_document["Final"]
            .filter(item => item !== keyword);
    }

    addKeyword(keyword) {
        this.selected_document["Final"] = this.selected_document["Final"]
            .concat({ tag: keyword })
    }
}