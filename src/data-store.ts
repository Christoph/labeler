import { autoinject } from 'aurelia-dependency-injection';
import { Store } from 'aurelia-store';
import { State } from 'store/state';

@autoinject()
export class DataStore {
  public state: State;
  private subscription;

  public dataset_size;
  public data_meta;
  public data_new;
  public data_fulltext;
  public data_projections;
  public classes;
  public recommendations;
  public keyword_propagation;
  public keyword_mapping;

  constructor(private store: Store<State>) {
    let meta = require('../datasets/reduced_meta.json')
    let fulltexts = require('../datasets/reduced_fulltext.json')
    let classes = require('../datasets/classes.json')
    let recommendation = require('../datasets/recommendation.json')
    let mapping = require('../datasets/mapping.json')
    let new_data = require('../datasets/new_data.json')

    this.dataset_size = Object.keys(meta).length
    this.data_meta = new Array();
    this.data_fulltext = new Array();
    this.classes = new Array();
    this.recommendations = new Array();
    this.keyword_propagation = new Array();
    this.keyword_mapping = new Array();
    this.data_new = new Array();

    for (let [key, value] of Object.entries(mapping)) {
      this.keyword_mapping[value["AuthorKeyword"]] = value["ExpertKeyword"]
    }

    for (let key in meta) {
      // Fix CLusters format
      let formatted = meta[key]["Clusters"].split(";")
      meta[key]["Clusters"] = formatted

      let update = meta[key]

      if (update["type"] === "new") {
        // Set meta data
        update["Done"] = false
        update["Key"] = parseInt(key)
        this.data_meta[key] = update

        // Set fulltext data
        let texts = fulltexts[key]
        this.data_fulltext[key] = texts
      }

      // Propagate keywords
      /*
      let keywords = new Array()

      for (let word of update["Keywords"].split(";")) {
        if (word in this.keyword_mapping) {
          keywords.push(this.keyword_mapping[word])
        }
      }

      this.keyword_propagation[key] = Array.from(new Set([].concat(...keywords)))
      */
    }

    for (let key in new_data) {

      let update = new_data[key]

      update["type"] = "new";

      if (update["type"] === "new") {
        // Set meta data
        update["Done"] = false
        update["Key"] = parseInt(key)
        this.data_new[key] = update
      }

      // Propagate keywords
      /*
      let keywords = new Array()

      for (let word of update["Keywords"].split(";")) {
        if (word in this.keyword_mapping) {
          keywords.push(this.keyword_mapping[word])
        }
      }

      this.keyword_propagation[key] = Array.from(new Set([].concat(...keywords)))
      */
    }

    console.log(this.data_new)

    for (let row in classes) {
      this.classes.push(classes[row])
    }

    for (let row in recommendation) {
      let vector = recommendation[row];
      let clusters = new Array();

      for (let i = 0; i < recommendation.length; i++) {
        if (vector[i] > 0) {
          clusters.push({
            name: this.classes[i]["Cluster"],
            type: "Classifier",
            used: false
          })
        }
      }

      /*
      for (let rec of this.keyword_propagation[row]) {
        clusters.push({
          name: rec,
          type: "Propagation",
          used: true
        })
      }
      */

      this.recommendations[row] = clusters;
    }
    console.log(this.data_meta)
    // this.loadProjection("single keywords")
  }

  bind() {
    this.subscription = this.store.state.subscribe(
      (state) => this.state = state
    );
  }

  unbind() {
    this.subscription.unsubscribe();
  }

  stateChanged(newState: State) {
    console.log(newState)
    console.log("test")
  }

  loadProjection(name: string) {
    // let json;
    //
    // if(name == "abstract") {
    //   json = require('../data/projections_abstract.json');
    // }
    // else if(name == "full") {
    //   json = require('../data/projections_full.json');
    // }
    // else if(name == "multi keywords") {
    //   json = require('../data/projections_keywords_multi.json');
    // }
    // else if(name == "single keywords") {
    //   json = require('../data/projections_keywords_single.json');
    // }
    //
    // this.preprocessProjections(json)
  }

  preprocessProjections(json) {
    this.data_projections = new Array(this.dataset_size);

    for (let key in json) {
      let temp = {};

      for (let [proj, value] of Object.entries(json[key])) {
        let values = value.toString().split(",")
        temp[proj] = [parseFloat(values[0]), parseFloat(values[1])]
      }

      this.data_projections[key] = temp
    }
  }

  getClasses() {
    return this.classes;
  }

  getRecommendation(id: number) {
    return this.recommendations[id]
  }

  getKeywordMapping(keyword: string) {
    if(this.keyword_mapping.hasOwnProperty(keyword)) {
      return this.keyword_mapping[keyword]
    }
    else {
      return ""
    }
  }

  getFulltext(id: number) {
    return this.data_fulltext[id]
  }

  getMetaData(id: number) {
    //return this.data_meta[id];
    return this.data_new[id];
  }

  getMeta() {
    //return this.data_meta;
    return this.data_new;
  }

  getProjections() {
    return this.data_projections;
  }

  getProjectionNames() {
    return Object.keys(this.data_projections[0]);
  }
}
