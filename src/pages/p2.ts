import {
    autoinject
} from 'aurelia-dependency-injection';
import {
    DataStore
} from 'data-store';
import * as _ from 'lodash';
import { computedFrom, observable } from 'aurelia-framework';
import * as tfidf from 'tiny-tfidf';
import * as porter from 'wink-porter2-stemmer';
import * as distances from 'wink-distance';
import { max } from 'd3';

@autoinject()
export class P2 {
    public documents;
    public labeled_documents;
    public label_list;
    public label_docs;
    public label_categories;
    public keyword_list;
    public keyword_mapping;
    public autocompleteData = {};

    // Scrolling
    @observable scrollCategory = 0;

    // Filter
    public searchKeywordsTerm = "";
    public finishedKeywords = false;
    public searchLabelsTerm = "";
    public searchDocumentTerm = "";

    // Selection
    public selected_document_list = [];
    public selected_document;
    public selected_keyword;
    public last_selected_keyword;
    public selected_additional_keywords = [];
    public last_selected_additional_keywords = [];
    public selected_label;
    public showDocuments = false;
    public showCategory = true;
    public selected_similarities = [];
    public selected_similar_keywords = [];
    public s_words = [];
    public selected_category;
    public selected_label_list = [];

    // Similarity list
    public sim_property = "text_similarity";
    public key_property = "highest_value";
    public label_sort_property = "total_similarity";
    public label_sort_value = 0;

    // Status variables
    public finished = false;
    public docs_todo = 0;
    public docs_done = 0;
    public docs_per = 0;
    public keywords_todo = 0;
    public keywords_done = 0;
    public keywords_per = 0;

    // NLP
    public tfidf;
    public tfidf_keywords = {};

    // Time
    public time = 0;
    public keyword_time = 0;
    public timerActive = false;
    public timer;

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

    activate() {
        window.addEventListener('keydown', this.handleKeyInput, false);
    }

    deactivate() {
        window.removeEventListener('keydown', this.handleKeyInput);
    }

    handleKeyInput = (event) => {
        if (event.key == "Enter" && this.selected_label) {
            this.throttled_applyLabel();
        }

        // if (event.key == "ArrowDown" && this.selected_label) {
        //     let index = this.label_docs.findIndex(x => x.label == this.selected_label.label)
        //     this.selectLabel(this.label_docs[Math.min(index + 1, this.label_docs.length - 1)])
        // }

        // if (event.key == "ArrowUp" && this.selected_label) {
        //     let index = this.label_docs.findIndex(x => x.label == this.selected_label.label)
        //     this.selectLabel(this.label_docs[Math.max(index - 1, 0)])
        // }

        // if (event.key == "ArrowRight" && this.selected_label) {
        //     this.skipKeyword();
        // }

        // if (event.key == "ArrowLeft" && this.selected_label) {
        //     this.undoKeyword();
        // }
    }

    constructor(public store: DataStore) {
        store.loadJson('p2')
        this.documents = store.getNew();
        this.labeled_documents = store.getLabeled();
        this.label_list = store.getClasses();
        let mapping = store.getMapping();

        this.label_docs = {}
        this.label_categories = {}
        let categories = {}
        this.keyword_mapping = {}
        this.keyword_list = []

        // Initialize the label document mapping
        for (const label of this.label_list) {
            this.label_docs[label["Cluster"]] = []
            this.label_categories[label["Cluster"]] = label['Category']
        }

        // Add missing unclear label
        this.label_docs["Unclear"] = [];
        this.label_categories["Unclear"] = "Unclear"

        for (const doc of this.labeled_documents) {
            for (const label of doc["Clusters"].split(";")) {
                if (this.label_docs.hasOwnProperty(label)) {
                    let doc_list = this.label_docs[label]
                    doc_list.push(doc)
                    this.label_docs[label] = doc_list
                }
            }

            // TODO: fix casing in preprocessing
            doc["Keywords_Processed"] = doc["Keywords"].split(";");

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
                            co_oc: [],
                            source: "db",
                            isNew: false,
                        }
                    }
                    else {
                        console.log(author_key, doc)
                        this.keyword_mapping[author_key] = {
                            mapping: "ERROR IN PREPROCEING",
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
                            co_oc: [],
                            source: "db",
                            isNew: false
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
            o["category"] = this.label_categories[key]
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

        // Create Category mapping
        for (let label of this.label_docs) {
            if (categories.hasOwnProperty(label['category'])) {
                categories[label['category']].labels.push(label)
            } else {
                categories[label['category']] = {
                    category: label['category'],
                    labels: [label],
                    isActive: false,
                    element: {}
                }
            }
        }

        let temp = []
        for (let [key, value] of Object.entries(categories)) {
            temp.push(value)
        }

        this.label_categories = temp

        for (const doc of this.documents) {
            let unknown = 0;

            // if (!doc["Keywords_Processed"]) {
            //     doc["Keywords_Processed"] = ""
            // }

            doc["DOI"] = "https://doi.org/" + doc["DOI"]
            doc["type"] = "new"

            // Create final keywords field
            // TODO: fix casing in preprocessing
            doc["Keywords_Processed"] = doc["Keywords"].split(";");

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
                        co_oc: [],
                        source: "new",
                        isNew: true
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

        // Properly format label string
        for (const label of this.label_docs) {
            label.label = label.label.split(/(?=[A-Z])/).join(" ")
        }

        // Properly format label string in keywords
        for (const keyword of this.keyword_list) {
            if (keyword.label.label) {
                keyword.mapping = keyword.label.label
            }
            else {
                keyword.mapping = ""
            }
        }

        // Precompute tfidf
        let identifiers = {}

        for (const key of this.keyword_list) {
            let mapping = key.label.label;
            // let mapping = key.mapping.toLowerCase();
            // let keyword = key.keyword.replace(" ", "SEP")
            let keyword = key.keyword

            if (identifiers.hasOwnProperty(mapping)) {

                identifiers[mapping] = identifiers[mapping] + " " + keyword
            }
            else {
                identifiers[mapping] = keyword
            }

        }

        // Add label Terms to the tfidf corpus
        for (const label of this.label_docs) {
            let words = label.label.toLowerCase().split(" ")
            let mapping = label.label;

            for (const keyword of words) {
                if (identifiers.hasOwnProperty(mapping)) {

                    identifiers[mapping] = identifiers[mapping] + " " + keyword
                }
                else {
                    identifiers[mapping] = keyword
                }
            }
        }

        this.tfidf = new tfidf.Corpus(
            Object.keys(identifiers),
            Object.values(identifiers),
        );

        for (const key of Object.keys(identifiers)) {
            let terms = this.tfidf.getTopTermsForDocument(key)

            for (const term of terms) {
                let name = term[0]
                let value = term[1]

                if (this.tfidf_keywords.hasOwnProperty(name)) {
                    this.tfidf_keywords[name].push(value)
                } else {
                    let temp = []
                    temp.push(value)
                    this.tfidf_keywords[name] = temp
                }
            }
        }

        let max_tfidf = 0;

        for (const key of Object.keys(this.tfidf_keywords)) {
            let values = this.tfidf_keywords[key]
            this.tfidf_keywords[key] = values.reduce((sum, x) => sum + x) / values.length;

            if (this.tfidf_keywords[key] > max_tfidf) max_tfidf = this.tfidf_keywords[key]
        }

        for (const key of Object.keys(this.tfidf_keywords)) {
            let value = this.tfidf_keywords[key]
            this.tfidf_keywords[key] = value / max_tfidf;
        }

        // for (const label of this.label_docs) {
        //     label["top_words"] = this.tfidf.getTopTermsForDocument(label.label.toLowerCase()).map(x => x[0])
        // }

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
        console.log(this.label_categories)
        console.log(this.tfidf_keywords)

        this.updateDocumentStats();
        this.updateKeywordStats();

        this.selectKeyword(this.keyword_list.filter(x => !x.isDone)[0])
    }

    attached() {
        // this.selectLabel(this.label_docs[0])
    }

    scrollCategoryChanged() {
        if (this.label_categories) {
            for (const c of this.label_categories) {
                if (c.element.offsetTop - this.scrollCategory < 150) {
                    // c['isActive'] = true
                    this.selectCategory(c)
                }
                // else {
                //     c['isActive'] = false
                // }
            }
        }
    }

    categoryHighlight(category) {
        if (category == this.selected_category) {
            return 1
        }
        else {
            return 0.3
        }
    }

    selectDocument(doc) {
        this.selected_document = doc;
    }

    unselectCategory() {
        this.showCategory = true
        this.selected_category = false
        // this.selected_label_list = []
    }

    selectCategory(category) {
        if (this.selected_category) this.selected_category["isActive"] = false;

        this.showCategory = false;
        this.selected_category = category;
        this.selected_label_list = category['labels'];
        this.selected_category["isActive"] = true

        const m = max(this.selected_label_list, d => d['total_similarity'])
        const index = this.selected_label_list.findIndex(d => d['total_similarity'] === m);
        this.selectLabel(this.selected_label_list[index])
    }

    unselectLabel() {
        if (this.selected_label) this.selected_label["isActive"] = false;
        this.selected_label = ""
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

        this.last_selected_keyword = this.selected_keyword;
        this.selected_keyword = key;
        this.selected_document = key.docs[0]
        // this.selected_document_list.push(key.docs[0])

        this.updateSelectedSimilarities(this.selected_keyword);

        // Update Labels List
        this.computeLabelSimilarities(this.label_docs, this.selected_keyword);
        this.updateCategoriyList(this.label_categories)
        // this.populateLabels(this.label_docs, this.selected_keyword);

        // Update graph
        // this.createGraphData();
        this.s_words = key.co_oc.filter(x => !x.keyword.mapping)

        // if (key.label) {
        //     this.selectLabel(key.label)
        // }
        // else {
        //     this.selectLabel(this.label_docs[0])
        // }

        // // Reset filter
        // this.searchDocumentTerm = ""
        // this.searchKeywordsTerm = ""
        // this.searchLabelsTerm = ""

        // // Reset scrolling after applying
        // this['labelsList'].scrollTop = 0;
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
                    hasKeywords: true,
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
                let norm_key = key//.replace(/[^A-Za-z0-9]/g, "")
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
                hasKeywords: true,
                //keyword_similarity: this.jaccard_similarity(this.selected_document["Keywords"], element["Keywords"])
                // keyword_similarity: this.cosine_similarity(this.selected_document["Keyword_Vector"], element["Keyword_Vector"])
                keyword_similarity: 0
            })
        });
    }

    colorConverter(num: number) {
        if (num > 0.5) return "#094D08"
        else if (num > 0.25) return "#108C0E"
        else if (num > 0) return "#7CC07B"
        else return "#D8DBDB"
    }

    colorConverterExplanation(num: number) {
        if (num > 0.5) return "#094D08"
        else if (num > 0.25) return "#108C0E"
        else return "#7CC07B"
    }

    updateCategoriyList(categories) {
        for (const category of categories) {
            let total_similarity = max(category.labels, d => d["total_similarity"])
            let temp = []

            let ls = []
            let lsex = []
            let ks = []
            let ksex = []
            let co = []
            let coex = []
            let ed = []
            let edex = []

            for (const label of category.labels) {
                for (const sim of label['similarities']) {
                    if (sim.type == 'Label Substring') {
                        ls.push(sim.value)
                        lsex.push(...sim.explanation)
                    }
                    if (sim.type == 'Keyword Substring') {
                        ks.push(sim.value)
                        ksex.push(...sim.explanation)
                    }
                    if (sim.type == 'Cooccurrent Keywords') {
                        co.push(sim.value)
                        coex.push(...sim.explanation)
                    }
                    if (sim.type == 'Edit Distance') {
                        ed.push(sim.value)
                        edex.push(...sim.explanation)
                    }
                }
            }

            let label_subs = max(ls)
            temp.push({
                type: 'Label Substring',
                color: this.colorConverter(Number(label_subs)),
                value: label_subs,
                explanation: lsex
            })
            let keyword_subs = max(ks)
            temp.push({
                type: 'Keyword Substring',
                color: this.colorConverter(Number(keyword_subs)),
                value: keyword_subs,
                explanation: ksex
            })
            let cooc = max(co)
            temp.push({
                type: 'Cooccurrent Keywords',
                color: this.colorConverter(Number(cooc)),
                value: cooc,
                explanation: coex
            })
            let edit = max(ed)
            temp.push({
                type: "Edit Distance",
                color: this.colorConverter(Number(edit)),
                value: edit,
                explanation: edex
            })


            category['total_similarity'] = total_similarity
            category['similarities'] = temp
        }
    }

    computeLabelSimilarities(labels, keyword) {
        // Only compute if not already computed
        for (let label of labels) {
            let substring_dist = 0
            let substring_ex = []
            let keyword_substring_dist = 0
            let keyword_ex = []
            let cooc_sim = 0
            let cooc_ex = []
            let edit_dist = 0
            let edit_ex = []

            let keywords = keyword.keyword.toLowerCase().split(" ");

            let lkw = label.keywords.split(" ")
            lkw.push(...label.label.toLowerCase().split(/(?=[A-Z])/));

            let keyword_list = Array.from(new Set(lkw))

            for (const keyword of keywords) {
                // Label Substring
                if (label.label.toLowerCase().includes(keyword)) {
                    substring_dist = substring_dist + this.tfidf_keywords[keyword]
                    substring_ex.push({
                        keyword: keyword,
                        strength: this.tfidf_keywords[keyword],
                        color: this.colorConverterExplanation(this.tfidf_keywords[keyword])
                    })
                }

                // Keyword Substring
                if (label.keywords.toLowerCase().includes(keyword)) {
                    keyword_substring_dist = keyword_substring_dist + this.tfidf_keywords[keyword]
                    keyword_ex.push({
                        keyword: keyword,
                        strength: this.tfidf_keywords[keyword],
                        color: this.colorConverterExplanation(this.tfidf_keywords[keyword])
                    })
                }

                // Edit dist
                for (const keyword of keywords) {
                    if (keyword.length > 3) {
                        for (const kw of keyword_list) {
                            let dist = distances.string.levenshtein(keyword, kw)

                            if (dist > 0 && dist < 2) {
                                edit_dist = edit_dist + this.tfidf_keywords[keyword]
                                edit_ex.push({
                                    keyword: keyword,
                                    strength: this.tfidf_keywords[keyword],
                                    color: this.colorConverterExplanation(this.tfidf_keywords[keyword])
                                })
                            }
                        }
                    }
                }
            }

            // Cooc dist
            let cooc_keywords = keyword.co_oc.filter(x => x.keyword.label == label)
            if (cooc_keywords) {
                cooc_sim = cooc_keywords.length

                for (const co of cooc_keywords) {
                    cooc_ex.push({
                        keyword: co.keyword.keyword,
                        strength: 1 / keyword.co_oc.length,
                        color: this.colorConverterExplanation(1 / keyword.co_oc.length)
                    })
                }
            }

            // Normalize all values
            let substring_avg_dist = substring_dist / keywords.length;
            let substring_avg_dist_keyword = keyword_substring_dist / keywords.length;
            let edit_norm_sim = edit_dist / keywords.length;
            let cooc_norm_sim
            if (keyword.co_oc) {
                cooc_norm_sim = cooc_sim / keyword.co_oc.length
            }
            else {
                cooc_norm_sim = 0
            }

            // Set all values
            label["substring_similarity"] = Math.min(substring_avg_dist * 2, 1)
            label["keyword_substring_similarity"] = Math.min(substring_avg_dist_keyword * 1.5, 1)
            label["edit_distance_similarity"] = edit_norm_sim
            label["cooc_similarity"] = cooc_norm_sim

            let temp = []
            temp.push({
                type: "Label Substring",
                color: this.colorConverter(label["substring_similarity"]),
                value: label["substring_similarity"],
                explanation: substring_ex
            })
            temp.push({
                type: "Keyword Substring",
                color: this.colorConverter(label["keyword_substring_similarity"]),
                value: label["keyword_substring_similarity"],
                explanation: keyword_ex
            })
            temp.push({
                type: "Cooccurrent Keywords",
                color: this.colorConverter(label["cooc_similarity"]),
                value: label["cooc_similarity"],
                explanation: cooc_ex
            })
            temp.push({
                type: "Edit Distance",
                color: this.colorConverter(label["edit_distance_similarity"]),
                value: label["edit_distance_similarity"],
                explanation: edit_ex
            })

            label["similarities"] = temp

            label["total_similarity"] =
                label["substring_similarity"] +
                label["keyword_substring_similarity"] +
                label["edit_distance_similarity"] +
                label["cooc_similarity"]
        }

        // Sort labels list
        this.label_sort_property = "";
        this.label_sort_property = "total_similarity"

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

            this.checkKeywordsForDoc();
        }
    }

    checkKeywordsForDoc() {
        let temp = []
        temp.push(this.selected_keyword, ...this.selected_additional_keywords)

        for (const doc of this.selected_similarities) {
            if (temp.every(r => doc.document["Keywords_Processed"].includes(r))) {
                doc.hasKeywords = true
            }
            else {
                doc.hasKeywords = false
            }
        }
    }

    async moveToKeyword(key) {
        await this.selectKeyword(key)

        // if (key.isDone) {
        //     this.selectLabel(key.label)
        // }
        // else {
        //     this.selectLabel(this.label_docs[0])
        // }

        // Reset filter
        this.searchDocumentTerm = ""
        this.searchKeywordsTerm = ""
        this.searchLabelsTerm = ""

        // Reset scrolling after applying
        this['labelsList'].scrollTop = 0;
    }

    async skipKeyword() {
        // Move current element to the end of the array
        this.keyword_list.splice(
            this.keyword_list.indexOf(this.selected_keyword), 1
        );
        this.keyword_list.push(this.selected_keyword)

        // Reset keyword
        this.selected_keyword.mapping = ""
        this.selected_keyword.label = {};
        this.selected_keyword.isDone = false;

        // Reset timing
        this.keyword_time = 0

        // Select next element
        this.moveToKeyword(this.keyword_list.filter(x => !x.isDone)[0])
        // await this.selectKeyword(this.keyword_list.filter(x => !x.isDone)[0])
        // this.selectLabel(this.label_docs[0])

        // // Reset filter
        // this.searchDocumentTerm = ""
        // this.searchKeywordsTerm = ""
        // this.searchLabelsTerm = ""

        // // Reset scrolling after applying
        // this['labelsList'].scrollTop = 0;
    }

    async undoKeyword() {
        // Reset last element
        this.last_selected_keyword.mapping = ""
        this.last_selected_keyword.label = {};
        this.last_selected_keyword.isDone = false;

        // Reset timing
        this.keyword_time = 0

        // Reset additional keyword
        if (this.last_selected_additional_keywords) {
            for (const keyword of this.last_selected_additional_keywords) {
                keyword.mapping = ""
                keyword.label = {}
                keyword.isDone = false;
            }

            this.last_selected_additional_keywords = [];
        }

        // Select last element
        this.moveToKeyword(this.keyword_list.filter(x => !x.isDone)[0])
        // await this.selectKeyword(this.last_selected_keyword);
        // this.selectLabel(this.label_docs[0])

        // // Reset filter
        // this.searchDocumentTerm = ""
        // this.searchKeywordsTerm = ""
        // this.searchLabelsTerm = ""

        // // Reset scrolling after applying
        // this['labelsList'].scrollTop = 0;
    }

    throttled_applyLabel = _.throttle(x => this.applyLabel(), 1000)

    async applyLabel() {
        this.selected_keyword.mapping = this.selected_label.label;
        this.selected_keyword.label = this.selected_label;
        this.selected_keyword.isDone = true;

        this.last_selected_additional_keywords = []

        // Handle timing
        let div = 0
        if (this.selected_additional_keywords) div = this.selected_additional_keywords.length

        let time_fraction = Math.ceil(this.keyword_time / (div + 1))

        this.selected_keyword["time"] = time_fraction


        if (this.selected_additional_keywords) {
            for (const keyword of this.selected_additional_keywords) {
                keyword.mapping = this.selected_label.label;
                keyword.label = this.selected_label;
                keyword.isDone = true;
                keyword["time"] = time_fraction;

                this.last_selected_additional_keywords.push(keyword)
            }

            this.selected_additional_keywords = [];
        }

        this.keyword_time = 0

        // Check if its done
        if (this.keywords_todo <= 1) {
            this.finished = true;
            this.updateDocumentStats();
            for (const doc of this.documents) {
                if (doc["Keywords_Processed"].every(x => x["isDone"])) doc["isDone"] = true;
            }
            this.updateKeywordStats();
        }
        // Update keyword list view
        // this.finishedKeywords = !this.finishedKeywords;
        // this.finishedKeywords = !this.finishedKeywords;

        // this.selected_keyword = this.keyword_list.filter(x => !x.isDone)[0]
        // let index = this.keyword_list.indexOf(this.selected_keyword)

        this.moveToKeyword(this.keyword_list.filter(x => !x.isDone)[0])
        // await this.selectKeyword(this.keyword_list.filter(x => !x.isDone)[0])
        // this.selectLabel(this.label_docs[0])

        this.updateKeywordStats();

        // Check if some documents are now finished
        for (const doc of this.documents) {
            if (doc["Keywords_Processed"].every(x => x["isDone"])) doc["isDone"] = true;
        }

        this.updateDocumentStats();

        this.unselectCategory();
        this.unselectLabel();

        // // Reset filter
        // this.searchDocumentTerm = ""
        // this.searchKeywordsTerm = ""
        // this.searchLabelsTerm = ""

        // // Reset scrolling after applying
        // this['labelsList'].scrollTop = 0;
    }

    download() {
        this.downloadKeywords();
        this.downloadData();
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
                "\"" + doc["Title"].replace(/,/g, ";") + "\"",
                "\"" + keywords + "\"",
                "\"" + doc["Authors"].replace(/,/g, ";") + "\"",
                "\"" + doc["DOI"] + "\"",
                "\"" + labels + "\""
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

    downloadKeywords() {
        let rows = [
            ["keyword", "label", "time"]
        ];

        for (const keyword of this.keyword_list.filter(x => x["source"] == "new")) {

            rows.push([
                "\"" + keyword.keyword + "\"",
                "\"" + keyword.mapping + "\"",
                keyword.time
            ])
        }

        let csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.join(",")).join("\n");

        // var encodedUri = encodeURI(csvContent);
        // window.open(encodedUri);
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "keyword_data.csv");
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
        this.docs_done = this.documents.filter(x => x.isDone).length

        this.docs_per = 1 - (this.docs_todo / this.documents.length)
    }

    updateKeywordStats() {
        let ll = this.keyword_list.filter(x => x["source"] == "new")
        this.keywords_todo = ll.filter(x => !x["isDone"]).length
        this.keywords_done = ll.filter(x => x["isDone"]).length

        this.keywords_per = 1 - (this.keywords_todo / ll.length)
    }

    startTimer() {
        if (!this.timerActive) {
            this.timerActive = true;

            // Call every second
            this.timer = setInterval(x => {
                this.time++;
                this.keyword_time++;
            }, 1000)
        }
    }

    endTimer() {
        // Stop timer
        clearInterval(this.timer);
        this.timerActive = false;
        this.time = 0;
        this.keyword_time = 0;
    }
}