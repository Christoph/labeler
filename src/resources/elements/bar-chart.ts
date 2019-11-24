import * as d3 from "d3";
import { inject, noView, bindable } from 'aurelia-framework';
import * as _ from "lodash"


@inject(Element)
@noView()
export class BarChartCustomElement {
  @bindable data: Array<number>;
  @bindable property: string;
  @bindable bins: string = "10";
  @bindable xSize: string = "150";
  @bindable ySize: string = "50";

  // D3 variables
  private isInitialized = false;
  private svg;
  private x;
  private y;
  private width;
  private height;

  margin = { top: 5, right: 10, bottom: 20, left: 10 };

  constructor(public element: Element) { }

  attached() {
    this.width = parseInt(this.xSize) - this.margin.left - this.margin.right;
    this.height = parseInt(this.ySize) - this.margin.top - this.margin.bottom;

    this.initChart();
    // this.updateChart();
    this.isInitialized = true;
  }

  dataChanged(data) {
    if (data.length) {
      // Convert string to array of numbers
      if (typeof data === "string") {
        this.data = data.split(",").map(Number)
      }

      if (this.isInitialized) {
        this.updateChart();
      }
    }
  }

  initChart() {
    // append the svg object to the chart div of the page
    // append a 'group' element to 'svg'
    // moves the 'group' element to the top left margin
    this.svg = d3.select(this.element)
      .append("svg")
      .attr("width", this.width + this.margin.left + this.margin.right)
      .attr("height", this.height + this.margin.top + this.margin.bottom)
      .append("g")
      .attr("transform",
        "translate(" + this.margin.left + "," + this.margin.top + ")");

    // set the ranges
    this.x = d3.scaleLinear()
      .domain([0, 1])
      .range([0, this.width])

    this.y = d3.scaleLinear()
      .range([this.height, 0]);

    // add the x Axis
    this.svg.append("g")
      .attr("transform", "translate(0," + this.height + ")")
      .attr("class", "xAxis");

    // add the y Axis
    // this.svg.append("g")
    //   .attr("class", "yAxis");
  }

  updateChart() {
    let self = this;

    // Compute histogram
    let histogram = d3.histogram()
      .value(d => +d)
      .domain(self.x.domain())
      .thresholds(self.x.ticks(parseInt(self.bins)));

    let bins = histogram(self.data);

    // Update domains
    this.y.domain([0, d3.max(bins, function (d) { return d.length })]);

    this.svg.selectAll(".xAxis")
      .call(d3.axisBottom(this.x).ticks(5));

    let chart = this.svg.selectAll("rect")
      .data(bins)

    // Select chart
    // let chart = this.svg.selectAll("g.bar")
    //   .data(data)
    //   .enter()
    //   .append("g")
    //   .attr("class", "bar")
    //   .attr("transform", function (d) {
    //     return "translate(" + (self.x(d["party"])) + ",0)"
    //   })
    //   .on("click", function (d) {
    //   })

    // Update axis
    // this.svg.selectAll(".yAxis")
    //   .call(d3.axisLeft(this.y));

    // Add and update points
    chart
      .enter()
      .append("rect")
      // .on("click", function(d) {
      //   // dispatchify(select)(d)
      // })
      .merge(chart)
      .transition(1000)
      .attr("x", 1)
      .attr("transform", function (d) { return "translate(" + self.x(d.x0) + "," + self.y(d.length) + ")"; })
      .attr("width", function (d) {
        return self.x(d.x1) - self.x(d.x0);
      })
      .attr("height", function (d) { return self.height - self.y(d.length); })
      .style("fill", "steelblue")

    // chart.append("text")
    //   .merge(chart)
    //   .transition(1000)
    //   // .attr("width", self.x.bandwidth())
    //   .attr("y", function (d) { return self.y(d["total"]) - 3; })
    //   // .attr("height", function(d) { return self.height - self.y(d["total"]); });
    //   .text(function (d) { return d["total"]; })

    // Remove points
    chart.exit().remove();
  }
}
