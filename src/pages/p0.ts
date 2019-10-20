import { autoinject } from 'aurelia-dependency-injection';
import { DataStore } from 'data-store';
import * as Mark from 'mark.js';
import * as _ from 'lodash';

@autoinject()
export class P1 {
    public documents;
    public keyword_list;
    public autocompleteData = {
    Apple: null,
    Google: null,
    Microsoft: null
  };

    // Selection
    public selected_document;
    public showDocuments = false;

    // Temp variables
    public sort_property = "descending";

    constructor(public store: DataStore) {
        this.documents = store.getMeta();
        this.keyword_list = store.getClasses();

        for (const doc of this.documents) {
            let unknown = 0;
            for (const author_key of doc["Keywords"].split(";")) {
                let mapping = this.store.getKeywordMapping(author_key);
                if (!mapping) {
                    unknown++;
                }

                // Temp solution until new docs are added
                if (mapping === "unclear") {
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

            for(const elem of final) {
                temp.push({tag: elem})
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
            .concat({ tag: keyword} )
    }
}