import { autoinject } from 'aurelia-dependency-injection';
import { DataStore } from 'data-store';
import * as Mark from 'mark.js';
import * as _ from 'lodash';


@autoinject()
export class P1 {
    public test = "Test";

    public documents;

    constructor(public store: DataStore) {
        this.documents = store.getMeta();

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

            if (unknown > 0) {
                console.log(doc)
            }

            doc["Unknown"] = unknown;
        }
    }


}