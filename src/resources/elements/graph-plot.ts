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
  width = 600 - this.margin.left - this.margin.right;
  height = 500 - this.margin.top - this.margin.bottom;

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

    const links = this.data["links"].map(d => Object.create(d));
    const nodes = this.data["nodes"].map(d => Object.create(d));

    const simulation = d3.forceSimulation()
      .force("link", d3.forceLink().id(function (d) { return d["id"]; }))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(this.width / 2, this.height / 2));

    graph.links.forEach(function (d) {
      d.source = d.source_id;
      d.target = d.target_id;
    });

    var link = this.svg.append("g")
      .style("stroke", "#aaa")
      .selectAll("line")
      .data(graph.links)
      .enter().append("line");

    var node = this.svg.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(graph.nodes)
      .enter().append("circle")
      .attr("r", 6);

    // var label = svg.append("g")
    //   .attr("class", "labels")
    //   .selectAll("text")
    //   .data(graph.nodes)
    //   .enter().append("text")
    //   .attr("class", "label")
    //   .text(function (d) { return d.name; });

    simulation.nodes(graph.nodes)

    simulation.force("link").links(graph.links);

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    });
  }

  updateChart(state) {
    let self = this;

    let data = []//this.store.getProjections();

    // Update domains
    this.x.domain(d3.extent(data, function (d) { return +d[state.selectedProjection][0] }));
    this.y.domain(d3.extent(data, function (d) { return +d[state.selectedProjection][1] }));

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
      .attr('r', 5)
      .on("mouseover", function (d, i) {
        // dispatchify(select)(d)
      })
      .merge(chart)
      .transition(1000)
      .attr('cx', function (d) { return self.x(d[state.selectedProjection][0]); })
      .attr('cy', function (d) { return self.y(d[state.selectedProjection][1]); })
      .style('opacity', function (d, i) {
        let opacity;
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
