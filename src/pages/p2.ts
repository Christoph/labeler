import { autoinject } from 'aurelia-dependency-injection';
import { DataStore } from 'data-store';
import * as Mark from 'mark.js';
import * as math from 'mathjs';

import { connectTo, dispatchify } from 'aurelia-store';
import { State } from 'store/state';
import { selectProjection, selectDataset } from 'store/actions/data';


@autoinject()
@connectTo()
export class P2 {
  // Data
  public meta;
  public classes;
  public class_vectors;
  public class_recommendation;

  // Interaction variables
  public selected_cluster;
  public selected_documents;
  public selected_similarities;

  public state: State;

  // Table variables
  public pageSize = 10;
  public totalItems = 0;
  public selectionSize = 5;
  public totalSelection = 0;

  public filters = [
    { value: '', keys: ['Title'] },
    // {value: false, keys: ['Done']},
  ];

  // Custom search variables
  public search_term = "";
  public search_results = 0;
  public search_sentences = [];

  // Progress bar variables
  public progress = 0;
  public progressStyle = "width: " + this.progress + "%";

  // Marking varibles
  public fulltext_marking;
  public search_marking;

  public labelingStatus = [false, true];

  // Methods
  cosine_similarity(v1, v2) {
    return math.dot(v1, v2) / (math.norm(v1) * math.norm(v2))
  }


  // public projections;
  // public datasets = ["full", "abstract", "single keywords", "multi keywords"];
  // public selected_projection;
  // public selected_dataset;

  constructor(public store: DataStore) {
    this.meta = store.getMeta()
    this.classes = new Array()
    this.class_vectors = {}
    this.class_recommendation = {}
    let classes = store.getClasses()

    // Derived
    this.totalItems = this.meta.length;

    // TODO: Inefficient
    for (let cls of classes) {
      let counter = 0;
      let temp = new Array();

      for (let row of this.meta) {
        if (row["Clusters"].includes(cls["Cluster"])) {
          counter++;
          temp.push(row["Key"])
        }
      }

      this.class_recommendation[cls["Cluster"]] = temp;

      this.classes.push({
        "Title": cls["Cluster"],
        "Recommendations": counter,
        "Used": 0
      })

      this.class_vectors[cls["Cluster"]] = cls["Vector"]
    }

    // Define mark areas
    this.fulltext_marking = new Mark("#context");
    this.search_marking = new Mark("#search");

    // this.projections = this.store.getProjectionNames()
    // this.selected_projection = this.projections[3]
    // this.selected_dataset = this.datasets[2]

    // Order matters!
    // dispatchify(selectProjection)(this.selected_dataset);
    // dispatchify(selectProjection)(this.selected_projection);
  }

  rowSelected(row) {
    this.selected_cluster = row;
    this.selected_documents = new Array();
    this.selected_similarities = {};

    for (let key in this.class_recommendation[row]) {
      let doc = this.meta[key]
      let temp = new Array()

      this.selected_documents.push({
        "Document": doc,
        "Similarity": this.cosine_similarity(this.class_vectors[row], doc["Vector"])
      })

      for (let cluster of doc["Clusters"]) {
        temp.push({
          "Name": cluster,
          "Similarity": this.cosine_similarity(this.class_vectors[cluster], doc["Vector"])
        })
      }

      this.selected_similarities[doc["Key"]] = temp;
    }

    // this.Title = this.selectedRow.Title
    // this.Abstract = this.selectedRow.Abstract
    // this.Clusters = this.selectedRow.Clusters
    // this.DOI = this.selectedRow.DOI
    // this.Keywords = this.selectedRow.Keywords
    // this.Fulltext = this.store.getFulltext(this.selectedRow.Key)
    //
    // this.recommendations = this.store.getRecommendation(this.selectedRow.Key)
    //
    // this.marking()
  }

  marking() {
    if (this.search_term.length > 1) {
      this.fulltext_marking.unmark();
      this.fulltext_marking.mark(this.search_term, {
        "done": (counter: number) => {
          this.search_results = counter
        }
      });

      this.extractSearch();

      this.search_marking.unmark();
      this.search_marking.mark(this.search_term);
    }
  }

  extractSearch() {
    // let indices = this.getIndicesOf(this.search_term, this.Fulltext, false)
    // this.search_sentences = new Array()
    //
    // for(let index of indices) {
    //   let text = this.Fulltext.substring(index-40, index+this.search_term.length+40)
    //   this.search_sentences.push("..."+text+"...")
    // }
  }

  getIndicesOf(searchStr: string, str: string, caseSensitive: boolean) {
    var searchStrLen = searchStr.length;
    if (searchStrLen == 0) {
      return [];
    }
    var startIndex = 0, index: number, indices = [];
    if (!caseSensitive) {
      str = str.toLowerCase();
      searchStr = searchStr.toLowerCase();
    }
    while ((index = str.indexOf(searchStr, startIndex)) > -1) {
      indices.push(index);
      startIndex = index + searchStrLen;
    }
    return indices;
  }

  collapsibleOpen(element) {
    if (element.id === "search") {
      this.search_marking.unmark();
      this.search_marking.mark(this.search_term);
    }
  }

  statusChanged(status: boolean) {
    if (status) {
      this.progress = this.progress + (1 / this.totalItems)
    }
    else {
      this.progress = this.progress - (1 / this.totalItems)
    }

    this.progressStyle = "width: " + this.progress + "%";

    // this.updateFilter()
  }

  // updateFilter() {
  //   this.filters[1].value = !this.filters[1].value;
  //   this.filters[1].value = !this.filters[1].value;
  // }

  done() {
    // this.selectedRow.Done = true;
    // this.statusChanged(true);
    //
    // if(this.$displayData.length-1 > 0) {
    //   let current_id = this.selectedRow.Key
    //   let position = this.$displayData.findIndex(x => x.Key === current_id)
    //   let next = this.meta[this.$displayData[position+1].Key];
    //   next.$isSelected = true;
    //   this.tableApi.revealItem(next);
    //
    //   this.rowSelected(next)
    // }
  }

  // ProjectionSelected() {
  //   dispatchify(selectProjection)(this.selected_projection);
  // }
  //
  // DatasetSelected() {
  //   dispatchify(selectDataset)(this.selected_dataset);
  // }
}
