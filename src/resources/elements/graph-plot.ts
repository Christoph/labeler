import * as d3 from "d3";
import { inject, noView, bindable } from 'aurelia-framework';
import * as _ from "lodash"

import { connectTo } from 'aurelia-store';

@inject(Element)
@noView()
export class GraphPlotCustomElement {
  @bindable data: Array<Object>;

  // D3 variables
  private svg;
  private x;
  private y;

  // set the dimensions and margins of the graph
  margin = { top: 20, right: 20, bottom: 30, left: 40 };
  width = 300 - this.margin.left - this.margin.right;
  height = 300 - this.margin.top - this.margin.bottom;

  constructor(public element: Element) {
    this.initChart();

    // https://github.com/wbkd/d3-extended
    d3.selection.prototype.moveToFront = function () {
      return this.each(function () {
        this.parentNode.appendChild(this);
      });
    };

    d3.selection.prototype.moveToBack = function () {
      return this.each(function () {
        var firstChild = this.parentNode.firstChild;
        if (firstChild) {
          this.parentNode.insertBefore(this, firstChild);
        }
      });
    };
  }

  dataChanged(data) {
    this.svg.selectAll("line").remove();
    this.svg.selectAll("circle").remove();

    this.updateChart();
  }

  initChart() {
    // append the svg object to the chart div of the page
    // append a 'group' element to 'svg'
    // moves the 'group' element to the top left margin
    // this.svg = d3.create("svg")
    //   .attr("viewBox", [-100 / 2, -100 / 2, 100, 100]);

    this.svg = d3.select(this.element)
      .append("svg")
      .attr("width", this.width + this.margin.left + this.margin.right)
      .attr("height", this.height + this.margin.top + this.margin.bottom)
    //   .append("g")
    //   .attr("transform",
    //     "translate(" + this.margin.left + "," + this.margin.top + ")");

  }

  updateChart() {
    const self = this;

    const links = this.data["links"].map(d => d);
    const nodes = this.data["nodes"].map(d => d);

    const simulation = d3.forceSimulation(nodes)
      // .force("link", d3.forceLink(links).id(function (d) { return d["id"]; }).strength(function (d) { return d["strength"]; })
      // .distance(100))
      .force("links", d3.forceLink(links))
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(this.width / 2, this.height / 2))
    // .force("x", d3.forceX())
    // .force("y", d3.forceY());

    const link = this.svg.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => d.strength * 10);
    // .attr("stroke-width", d => Math.sqrt(d.value));

    const node = this.svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 5)
      .attr("fill", "green")

    simulation.on("tick", () => {
      link
        .attr("x1", d => d["source"].x)
        .attr("y1", d => d["source"].y)
        .attr("x2", d => d["target"].x)
        .attr("y2", d => d["target"].y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    });
  }
}
