import * as d3 from "d3";
import { inject, noView, bindable } from 'aurelia-framework';
import * as _ from "lodash"

@inject(Element)
@noView()
export class SmallBarCustomElement {
  // D3 variables
  private svg;
  private x: d3.ScaleLinear<number, number>;

  private isInitialized = false;

  @bindable percent: number;
  @bindable orientation: string = "horizontal";
  @bindable xsize: string;
  @bindable ysize: string;

  // set the dimensions and margins of the graph
  margin = { top: 0, right: 0, bottom: 0, left: 0 };
  height: number;
  width: number;

  constructor(public element: Element) {
  }

  attached() {
    this.width = parseInt(this.xsize) - this.margin.left - this.margin.right;
    this.height = parseInt(this.ysize) - this.margin.top - this.margin.bottom;

    this.initChart();
    this.isInitialized = true;
    this.updateChart();
  }

  percentChanged(percent: string) {
    if (this.isInitialized) {
      if (typeof percent === "string") {
        this.percent = parseFloat(percent)
      }
      this.updateChart();
    }
  }

  initChart() {
    this.svg = d3.select(this.element)
      .append("svg")
      .attr("width", this.width + this.margin.left + this.margin.right)
      .attr("height", this.height + this.margin.top + this.margin.bottom)
      .append("g")
      .attr("transform",
        "translate(" + this.margin.left + "," + this.margin.top + ")");

    // set the ranges
    if (this.orientation == "horizontal") {
      this.x = d3.scaleLinear()
        .range([0, this.width])
        .domain([0, 1])
    }
    else {
      this.x = d3.scaleLinear()
        .range([this.height, 0])
        .domain([0, 1])
    }

    // add the x Axis
    // this.svg.append("g")
    //   .attr("transform", "translate(0," + this.height + ")")
    //   .attr("class", "xAxis");
  }

  updateChart() {
    let self = this;

    if (this.orientation == "horizontal") {
      this.svg.append("rect")
        .style("fill", "#D8DBDB")
        .attr("x", 0)
        .attr("width", self.x(1))
        .attr("y", 0)
        .attr("height", self.height);

      // Draw bar
      this.svg
        .append("rect")
        .attr("class", "small-bar")
        .attr("x", 0)
        .attr("width", self.x(self.percent))
        .attr("y", 0)
        .attr("height", self.height);
    }
    else {
      this.svg.append("rect")
        .style("fill", "#D8DBDB")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", self.height)
        .attr("width", self.width);

      // Draw bar
      this.svg
        .append("rect")
        .attr("class", "small-bar")
        .attr("x", 0)
        .attr("height", self.height - self.x(self.percent))
        .attr("y", self.x(self.percent))
        .attr("width", self.height);
    }
    // this.svg.selectAll(".xAxis")
    //   .call(d3.axisBottom(this.x).ticks(2))
  }
}
