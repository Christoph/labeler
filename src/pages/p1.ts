import { autoinject } from 'aurelia-dependency-injection';
import { DataStore } from 'data-store';
import * as Mark from 'mark.js';

import { connectTo, dispatchify } from 'aurelia-store';
import { State } from 'store/state';
import { selectProjection, selectDataset } from 'store/actions/data';


@autoinject()
@connectTo()
export class P1 {
  public state: State;
  public meta;
  public pageSize = 10;

  public search_term = "";
  public search_results = 0;
  public search_sentences = [];

  public totalItems = 0;
  public progress = 0;
  public progressStyle = "width: " + this.progress + "%";
  public Title;
  public Abstract;
  public Clusters;
  public DOI;
  public Keywords;
  public Fulltext;
  public selectedRow;
  public tableApi;
  public $displayData;

  public recommendations;
  public fulltext_marking;
  public search_marking;

  public filters = [
    { value: '', keys: ['Title'] },
    { value: false, keys: ['Done'] },
  ];

  public labelingStatus = [false, true];

  // public projections;
  // public datasets = ["full", "abstract", "single keywords", "multi keywords"];
  // public selected_projection;
  // public selected_dataset;

  constructor(public store: DataStore) {
    this.meta = store.getMeta()

    this.fulltext_marking = new Mark("#context");
    this.search_marking = new Mark("#search");
    this.totalItems = this.meta.length;

    // this.projections = this.store.getProjectionNames()
    // this.selected_projection = this.projections[3]
    // this.selected_dataset = this.datasets[2]

    // Order matters!
    // dispatchify(selectProjection)(this.selected_dataset);
    // dispatchify(selectProjection)(this.selected_projection);
  }

  rowSelected(row) {
    this.selectedRow = row;

    this.Title = this.selectedRow.Title
    this.Abstract = this.selectedRow.Abstract
    this.Clusters = this.selectedRow.Clusters
    this.DOI = this.selectedRow.DOI
    this.Keywords = this.selectedRow.Keywords
    this.Fulltext = this.store.getFulltext(this.selectedRow.Key)

    this.recommendations = this.store.getRecommendation(this.selectedRow.Key)

    this.marking()
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
    let indices = this.getIndicesOf(this.search_term, this.Fulltext, false)
    this.search_sentences = new Array()

    for (let index of indices) {
      let text = this.Fulltext.substring(index - 40, index + this.search_term.length + 40)
      this.search_sentences.push("..." + text + "...")
    }
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

    this.updateFilter()
  }

  updateFilter() {
    this.filters[1].value = !this.filters[1].value;
    this.filters[1].value = !this.filters[1].value;
  }

  done() {
    this.selectedRow.Done = true;
    this.statusChanged(true);

    if (this.$displayData.length - 1 > 0) {
      let current_id = this.selectedRow.Key
      let position = this.$displayData.findIndex(x => x.Key === current_id)
      let next = this.meta[this.$displayData[position + 1].Key];
      next.$isSelected = true;
      this.tableApi.revealItem(next);

      this.rowSelected(next)
    }
  }

  // ProjectionSelected() {
  //   dispatchify(selectProjection)(this.selected_projection);
  // }
  //
  // DatasetSelected() {
  //   dispatchify(selectDataset)(this.selected_dataset);
  // }
}
