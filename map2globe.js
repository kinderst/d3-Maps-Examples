var mapWidth = 960,
mapHeight = 500,
active = d3.select(null);
focused = false,
ortho = true, 
dragging = false,
sens = 0.25,
speed = -7e-3,
start = Date.now(),
globGDistance = 1.2,
corr = 0;

const center = [mapWidth/2, mapHeight/2];

var projectionGlobe = d3.geo.orthographic()
.scale(240)
.center([0, 0])
.rotate([0, 0])
.translate([mapWidth / 2, mapHeight / 2])
.clipAngle(90);

var projectionMap = d3.geo.equirectangular()
.scale(145)
.center([0, 0])
.translate([mapWidth / 2, mapHeight / 2])

var projection = projectionGlobe;

var path = d3.geo.path()
.projection(projection);

var globe2map = interpolatedProjection(projectionGlobe, projectionMap),
map2globe = interpolatedProjection(projectionMap, projectionGlobe);

var svgMap = d3.select("div#map").append("svg")
.attr("overflow", "hidden")
.attr("width", mapWidth)
.attr("height", mapHeight);

var zoneTooltip = d3.select("div#map").append("div").attr("class", "zoneTooltip"),
pointLlabel = d3.select("div#map").append("div").attr("class", "pointLabel"),
infoLabel = d3.select("div#map").append("div").attr("class", "infoLabel");

var g = svgMap.append("g");

//const markerGroup = svgMap.append('g');

//Unreelling transformation

function animation(interProj) {
  defaultRotate();
  g.transition()
  .duration(1500)
  .tween("projection", function() {
    return function(_) {
      interProj.alpha(_);
      g.selectAll("path").attr("d", path);
    };
  })
}

function interpolatedProjection(a, b) {
  var projection = d3.geo.projection(raw).scale(1),
  center = projection.center,
  translate = projection.translate,
  clip = projection.clipAngle,
  α;

  function raw(λ, φ) {
    var pa = a([λ *= 180 / Math.PI, φ *= 180 / Math.PI]), pb = b([λ, φ]);
    return [(1 - α) * pa[0] + α * pb[0], (α - 1) * pa[1] - α * pb[1]];
  }

  projection.alpha = function(_) {
    if (!arguments.length) return α;
    α = +_;
    var ca = a.center(), cb = b.center(),
    ta = a.translate(), tb = b.translate();
    center([(1 - α) * ca[0] + α * cb[0], (1 - α) * ca[1] + α * cb[1]]);
    translate([(1 - α) * ta[0] + α * tb[0], (1 - α) * ta[1] + α * tb[1]]);
    if (ortho === true) {clip(180 - α * 90);}
    return projection;
  };

  delete projection.scale;
  delete projection.translate;
  delete projection.center;
  return projection.alpha(0);
}

//Rotate to default before animation

function defaultRotate() {
  d3.transition()
  .duration(1600)
  .tween("rotate", function() {
    var r = d3.interpolate(projection.rotate(), [0, 0]);
    return function(t) {
      projection.rotate(r(t));
      g.selectAll("path").attr("d", path);
    };
  })
};

//Starter for function AFTER All transitions

function endall(transition, callback) { 
  var n = 0; 
  transition 
  .each(function() { ++n; }) 
  .each("end", function() { if (!--n) callback.apply(this, arguments); }); 
}

//Loading data

queue()
.defer(d3.json, "world-110m.json")
.defer(d3.tsv, "world-110m-country-names.tsv")
.defer(d3.json, 'locations.json')
.await(ready);


function ready(error, world, countryData, locations) {

  var countryById = {},
  countries = topojson.feature(world, world.objects.countries).features;

  //Adding countries by name

  countryData.forEach(function(d) {
    countryById[d.id] = d.name;
  });

  //Drawing countries on the globe

  var world = g.selectAll("path").data(countries);
  world.enter().append("path")
  .attr("class", "mapData")
  .attr("d", path)
  .classed("ortho", ortho = true);

  //Extra
  const markers = g.selectAll('circle')
      .data(locations);
  markers
      .enter()
      .append('circle')
      .attr('cx', d => projection([d.longitude, d.latitude])[0])
      /*.attr('cx', d => {
        console.log("test");
        console.log(projection([d.longitude, d.latitude])[0]);
        return 0;
      })
      */
      .attr('cy', d => projection([d.longitude, d.latitude])[1])
      /*
      .attr('fill', d => {
          const coordinate = [d.longitude, d.latitude];
          gdistance = d3.geo.distance(coordinate, projection.invert(center));
          return gdistance < globGDistance ? 'none' : 'steelblue';
      })
      */
      .attr('r', 7);

  /*
  markerGroup.each(function () {
      this.parentNode.appendChild(this);
  });
  */
  //end extra

  //Drag event

  world.call(d3.behavior.drag()
    .origin(function() { var r = projection.rotate(); return {x: r[0] / sens, y: -r[1] / sens}; })
    .on("dragstart", function() {
      dragging = true;
    })
    .on("drag", function() {
      var λ = d3.event.x * sens,
      φ = -d3.event.y * sens,
      rotate = projection.rotate();
      //Restriction for rotating upside-down
      φ = φ > 30 ? 30 :
      φ < -30 ? -30 :
      φ;
      projection.rotate([λ, φ]);
      g.selectAll("path.ortho").attr("d", path);
      g.selectAll(".focused").classed("focused", focused = false);
      g.selectAll("circle").each(function(d) {
        var coords = projection([d.longitude, d.latitude]);
        d3.select(this).attr("cx", function(d) {
                return coords[0];
            })
            .attr("cy", function(d) {
                return coords[1];
            })
            /*
            .attr('fill', d => {
                gdistance = d3.geo.distance(coords, projection.invert(center));
                console.log(gdistance);
                return gdistance < globGDistance ? 'none' : 'steelblue';
            })
            */
      })
    })
    .on("dragend", function() {
      dragging = false;
    }));

  //Events processing

  world.on("mouseover", function(d) {
    if (ortho === true) {
      infoLabel.text(countryById[d.id])
      .style("display", "inline");
    } else {
      zoneTooltip.text(countryById[d.id])
      .style("left", (d3.event.pageX + 7) + "px")
      .style("top", (d3.event.pageY - 15) + "px")
      .style("display", "block");
    }
  })
  .on("mouseout", function(d) {
    if (ortho === true) {
      infoLabel.style("display", "none");
    } else {
      zoneTooltip.style("display", "none");
    }
  })
  .on("mousemove", function() {
    if (ortho === false) {
      zoneTooltip.style("left", (d3.event.pageX + 7) + "px")
      .style("top", (d3.event.pageY - 15) + "px");
    }
  })
  .on("click", function(d) {
    if (d3.event.defaultPrevented) return; // dragged
    if (focused === d) return reset();
    g.selectAll(".focused").classed("focused", false);
    d3.select(this).classed("focused", focused = d);
    infoLabel.text(countryById[d.id])
    .style("display", "inline");

    //Transforming Globe to Map

    if (ortho === true) {
      defaultRotate();
      setTimeout(function() {
        projection = globe2map;
        path.projection(projection);
        animation(projection);
        g.selectAll(".ortho").classed("ortho", ortho = false);
        /*
        markerGroup.selectAll("circle").each(function(d) {
        var coords = projection([d.longitude, d.latitude]);
        d3.select(this).attr("cx", function(d) {
                return coords[0];
            })
            .attr("cy", function(d) {
                return coords[1];
            })
            
      })
      */   
      g.selectAll("circle").transition().duration(750)
            .attr("cx", function(d) {
                console.log(d)
                return projection([d.longitude, d.latitude])[0];
            })
            .attr("cy", function(d) {
                console.log("second d");
                return projection([d.longitude, d.latitude])[1];
            })
      }
      , 1600);
    } else {


    //BOSTOCK CODE

    if (active.node() === this) return reset();
  active.classed("active", false);
  active = d3.select(this).classed("active", true);

  var bounds = path.bounds(d),
      dx = bounds[1][0] - bounds[0][0],
      dy = bounds[1][1] - bounds[0][1],
      x = (bounds[0][0] + bounds[1][0]) / 2,
      y = (bounds[0][1] + bounds[1][1]) / 2,
      scale = .6 / Math.max(dx / mapWidth, dy / mapHeight),
      translate = [mapWidth / 2 - scale * x, mapHeight / 2 - scale * y];

  g.transition()
      .duration(750)
      .style("stroke-width", 1.5 / scale + "px")
      .attr("transform", "translate(" + translate + ")scale(" + scale + ")");

    //END BOSTOCK CODE*/

  g.selectAll("circle").transition().duration(750)
    .attr("r", 1);

  }

  });

  //Globe rotating via timer
  
  d3.timer(function() {
    if (!dragging && ortho) {
      var λ = speed * (Date.now() - start);

      projection.rotate([λ + corr, -5]);
      g.selectAll(".ortho").attr("d", path);
      g.selectAll("circle").each(function(d) {
        var coords = projection([d.longitude, d.latitude]);
        d3.select(this).attr("cx", function(d) {
                return coords[0];
            })
            .attr("cy", function(d) {
                return coords[1];
            })
            /*
            .attr('fill', d => {
                gdistance = d3.geo.distance(coords, projection.invert(center));
                console.log(gdistance);
                return gdistance < globGDistance ? 'none' : 'steelblue';
            })
            */
      })
    }

  });
  

  //Adding extra data when focused

  function focus(d) {
    if (focused === d) return reset();
    g.selectAll(".focused").classed("focused", false);
    d3.select(this).classed("focused", focused = d);
  }

  //Reset projection

  function reset() {
    setTimeout(function() {
      g.selectAll(".focused").classed("focused", focused = false);
      infoLabel.style("display", "none");
      zoneTooltip.style("display", "none");

      //Transforming Map to Globe

      projection = map2globe;
      path.projection(projection);
      animation(projection);
      g.selectAll("path").classed("ortho", ortho = true);
    }, 750);


    active.classed("active", false);
    active = d3.select(null);

    g.transition()
        .duration(750)
        .style("stroke-width", "1.5px")
        .attr("transform", "");

    g.selectAll("circle").transition().duration(750)
    .attr("r", 7);
  }

};