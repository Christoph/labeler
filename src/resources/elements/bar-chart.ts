import * as d3 from "d3";
import {inject, noView } from 'aurelia-framework';
import * as _ from "lodash"

import { DataStore } from 'data-store';

import { connectTo, dispatchify } from 'aurelia-store';
import { State } from 'store/state';
import { selectProjection } from 'store/actions/data';

@inject(Element, DataStore)
@noView()
@connectTo()
export class BarChartCustomElement{
  public state: State;

  // D3 variables
  private svg;
  private x;
  private y;

  // set the dimensions and margins of the graph
  margin = { top: 20, right: 20, bottom: 30, left: 40 };
  width = 900 - this.margin.left - this.margin.right;
  height = 500 - this.margin.top - this.margin.bottom;

  constructor(public element: Element, public store: DataStore) {
    this.initChart();
  }

  stateChanged(newState: State) {
    // this.svg.selectAll(".point").remove();
    this.updateChart(newState);
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
    this.x = d3.scaleBand()
      .rangeRound([0, this.width])
      .paddingInner(0.1);

    this.y = d3.scaleLinear()
      .range([this.height, 0]);

    // add the x Axis
    this.svg.append("g")
      .attr("transform", "translate(0," + this.height + ")")
      .attr("class", "xAxis");

    // add the y Axis
    this.svg.append("g")
      .attr("class", "yAxis");
  }

  updateChart(state) {
    let self = this;

    let data = this.store.getMeta();

    // Update domains
    this.x.domain(data.map(function(d) { return d["party"]; }));
    this.y.domain(d3.extent(data, function(d) {
      return +d["total"]
    }));

    // Select chart
    let chart = this.svg.selectAll("g.bar")
      .data(data)
      .enter()
      .append("g")
      .attr("class", "bar")
      .attr("transform", function(d) {
        return "translate(" + (self.x(d["party"])) + ",0)"
      })
      .on("click", function(d) {
        dispatchify(selectProjection)(d["party"])
      })

    // Update axis
    this.svg.selectAll(".xAxis")
      .call(d3.axisBottom(this.x));
    this.svg.selectAll(".yAxis")
      .call(d3.axisLeft(this.y));

    // Add and update points
    chart.append("rect")
      // .on("click", function(d) {
      //   // dispatchify(select)(d)
      // })
      .merge(chart)
        .transition(1000)
        .attr("width", self.x.bandwidth())
        .attr("y", function(d) { return self.y(d["total"]); })
        .attr("height", function(d) { return self.height - self.y(d["total"]); });

    chart.append("text")
      .merge(chart)
        .transition(1000)
        // .attr("width", self.x.bandwidth())
        .attr("y", function(d) { return self.y(d["total"]) - 3; })
        // .attr("height", function(d) { return self.height - self.y(d["total"]); });
        .text(function(d) { return d["total"]; })

    // Remove points
    chart.exit().remove();
  }
}
