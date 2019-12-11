import { autoinject } from 'aurelia-dependency-injection';

@autoinject()
export class DataStore {
  private subscription;

  public data_new;
  public data_old;
  public dataset_size;

  public classes;
  public keyword_propagation;
  public keyword_mapping;

  constructor() {
    let classes = require('../datasets/classes.json')
    let mapping = require('../datasets/mapping.json')
    let new_data = require('../datasets/new_data.json')
    let old_data = require('../datasets/old_data.json')

    this.dataset_size = Object.keys(new_data).length
    this.classes = new Array();
    this.keyword_propagation = new Array();
    this.keyword_mapping = new Array();
    this.data_new = new Array();
    this.data_old = new Array();

    for (let [key, value] of Object.entries(mapping)) {
      this.keyword_mapping[value["AuthorKeyword"]] = value["ExpertKeyword"]
    }

    for (const key in old_data) {
      let update = old_data[key]

      update["Done"] = true
      update["Key"] = parseInt(key)
      this.data_old.push(update)

    }

    for (let key in new_data) {
      let update = new_data[key]

      update["Done"] = false
      update["Key"] = parseInt(key)
      this.data_new.push(update)
    }

    for (let row in classes) {
      this.classes.push(classes[row])
    }
  }

  getClasses() {
    return this.classes;
  }

  getKeywordMapping(keyword: string) {
    if (this.keyword_mapping.hasOwnProperty(keyword)) {
      return this.keyword_mapping[keyword]
    }
    else {
      return ""
    }
  }

  getMapping() {
    return this.keyword_mapping
  }

  getMetaData(id: number) {
    //return this.data_meta[id];
    return this.data_new[id];
  }

  getNew() {
    //return this.data_meta;
    return this.data_new;
  }

  getLabeled() {
    //return this.data_meta;
    return this.data_old;
  }
}
