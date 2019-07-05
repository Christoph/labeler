import * as d3 from "d3";
import {inject, noView } from 'aurelia-framework';
import * as _ from "lodash"

import { DataStore } from 'data-store';

import { connectTo } from 'aurelia-store';
import { State } from 'store/state';

@inject(Element, DataStore)
@noView()
@connectTo()
export class ScatterPlotCustomElement{
  // D3 variables
  private svg;
  private x;
  private y;

  // set the dimensions and margins of the graph
  margin = { top: 20, right: 20, bottom: 30, left: 40 };
  width = 600 - this.margin.left - this.margin.right;
  height = 500 - this.margin.top - this.margin.bottom;

  constructor(public element: Element, public store: DataStore) {
    this.initChart();

    // https://github.com/wbkd/d3-extended
    d3.selection.prototype.moveToFront = function() {
      return this.each(function(){
        this.parentNode.appendChild(this);
      });
    };

    d3.selection.prototype.moveToBack = function() {
        return this.each(function() {
            var firstChild = this.parentNode.firstChild;
            if (firstChild) {
                this.parentNode.insertBefore(this, firstChild);
            }
        });
    };
  }

  stateChanged(newState: State) {
    this.svg.selectAll(".point").remove();
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
    this.x = d3.scaleLinear()
      .range([0, this.width]);

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

    let data = this.store.getProjections();

    // Update domains
    this.x.domain(d3.extent(data, function(d) { return +d[state.selectedProjection][0] }));
    this.y.domain(d3.extent(data, function(d) { return +d[state.selectedProjection][1] }));

    // Select chart
    let chart = this.svg.selectAll(".points")
      .data(data)

    // Update axis
    this.svg.selectAll(".xAxis")
      .call(d3.axisBottom(this.x));
    this.svg.selectAll(".yAxis")
      .call(d3.axisLeft(this.y));

    // Remove points
    chart.exit().remove();

    // Add and update points
    chart.enter()
      .append("circle")
      .attr("class", "point")
      .attr('r', 5 )
      .on("mouseover", function(d, i) {
        console.log(self.store.getMetaData(i)["Keywords"])
        // dispatchify(select)(d)
      })
      .merge(chart)
        .transition(1000)
        .attr('cx', function(d){ return self.x(d[state.selectedProjection][0]); })
        .attr('cy', function(d){ return self.y(d[state.selectedProjection][1]); })
        .style('opacity',  function(d, i){
          let opacity;
          if(self.store.getMetaData(i)["type"] == "new") {
            opacity = 1
          }
          else {
            opacity = 0.2
          }
          return opacity
        })
        // .style('fill',  function(d, i){
        //   let color;
        //   if(self.store.getMetaData(i)["type"] == "new") {
        //     color = "steelblue"
        //     d3.select(this).moveToFront()
        //   }
        //   else {
        //     color = "lightgrey"
        //     d3.select(this).moveToBack()
        //   }
        //   return color
        // });
  }
}
