var mapDataDate = "";
var minDate = undefined;
var maxDate = undefined;

function httpGet(url) {
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.open("GET", url, false); // false for synchronous request
  xmlHttp.send(null);
  return xmlHttp.responseText;
}

// convert csv to js object
const lines = httpGet(
  "https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-province/dpc-covid19-ita-province.csv"
).split("\n");
let data = {};
lines.forEach(x => {
  let splited = x.split(",");
  if (!data[splited[5]]) data[splited[5]] = [];

  data[splited[5]].push({
    date: splited[0].split(" ")[0],
    infectedNumber: splited[9]
  });

  try {
    var tmpDate = new Date(splited[0].split(" ")[0]);
    if (tmpDate instanceof Date && !isNaN(tmpDate)) {
      if (!minDate || minDate > tmpDate) {
        minDate = tmpDate;
      }
      if (!maxDate || maxDate < tmpDate) {
        maxDate = tmpDate;
      }
    }
  } catch {}
});

// convert object to array
let array = [];
for (var key in data) {
  if (data.hasOwnProperty(key)) {
    array.push({
      name: key,
      data: data[key]
    });
  }
}

let listOfProvincesWithInfectionData = [];
// provinces from listOfItalyProvinces.js
provinces.forEach(x => {
  array.forEach(t => {
    if (x.tags.toLocaleLowerCase().includes(t.name.toLocaleLowerCase())) {
      listOfProvincesWithInfectionData.push(Object.assign(x, { data: t.data }));
    }
  });
});

statesData.features.forEach(function(state) {
  listOfProvincesWithInfectionData.forEach(function(infec) {
    if (state.properties.id == infec.id) {
      state.properties.infections = infec;
    }
  });
});


var map = L.map('map', {
  maxBounds: [
          //south west
          [36, 6],
          //north east
          [47, 19]
          ],
}).setView([41.9, 11.66], 5);

// L.marker([42.309, 12.194]) .addTo(map);

L.tileLayer(
  "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw",
  {
    maxZoom: 9,
    minZoom: 4,
    attribution:
      '<a href="https://www.openstreetmap.org/">OpenStreetMap</a>' +
      '|<a href="https://www.mapbox.com/">Mapbox</a>',
    id: "mapbox/light-v9",
    tileSize: 512,
    zoomOffset: -1
  }
).addTo(map);

// control that shows state info on hover
var info = L.control();

info.onAdd = function(map) {
  this._div = L.DomUtil.create("div", "info details");
  this.update();
  return this._div;
};

info.update = function(props) {
  if (!props) return;
  var pname = props.prov_name;
  var date = "";
  var number = "0";

  var labes = [];
  var infecs = [];

  try {
    var infoData = props.infections.data[props.infections.data.length - 1];
    date = infoData.date;
    number = infoData.infectedNumber;

    props.infections.data.forEach(function(item) {
      labes.push(item.date);
      infecs.push(item.infectedNumber);
    });
  } catch {}
  this._div.innerHTML =
    "<div id='close-btn' style='  position: absolute;    top: 5px;    right: 10px;    cursor: pointer;    padding: 5px;    border: 1px solid black;    border-radius: 50%;    width: 10px;    height: 10px;    line-height: 10px;    text-align: center;'>x</div>" +
    "<h4>Covid-19 outbreak in Italy</h4>" +
    "<b>" +
    pname +
    "</b><br />" +
    "<h5>Last update:</h5>" +
    date +
    "</b><br />" +
    "<h5>Infections:</h5>" +
    number +
    " people" +
    "<br/>" +
    "<canvas id='chart'></canvas>";

  updateChart(labes, infecs);

  document.getElementsByClassName("details")[0].style.visibility = "visible";
  document.getElementById("close-btn").onclick = x => {
    document.getElementsByClassName("details")[0].style.visibility = "hidden";
  };
};

info.addTo(map);

// get color depending on population density value
function getColor(v) {
  var d = +v;
  return d > 50000
    ? "#000000"
    : d > 20000
    ? "#3d0012"
    :  d > 10000
    ? "#800026"
    : d > 5000
    ? "#BD0026"
    : d > 2000
    ? "#E31A1C"
    : d > 1000
    ? "#FC4E2A"
    : d > 500
    ? "#FD8D3C"
    : d > 200
    ? "#FEB24C"
    : d > 100
    ? "#FED976"
    : d == 0
    ? "gray"
    : "#FFEDA0";
}

function style(feature) {
  var infected = 0;
  try {
    if (mapDataDate) {
      feature.properties.infections.data.forEach(item => {
        if (item.date.includes(mapDataDate)) infected = item.infectedNumber;
      });
    } else {
      infected =
        feature.properties.infections.data[
          feature.properties.infections.data.length - 1
        ].infectedNumber;
    }
  } catch {}
  return {
    weight: 2,
    opacity: 1,
    color: "white",
    dashArray: "3",
    fillOpacity: 0.7,
    fillColor: getColor(infected)
  };
}

var lastHighlightTarget;
function highlightFeature(e) {
  if (e.type == "click" && lastHighlightTarget)
    resetHighlight(lastHighlightTarget);
  lastHighlightTarget = e;
  var layer = e.target;

  layer.setStyle({
    weight: 5,
    color: "#666",
    dashArray: "",
    fillOpacity: 0.7
  });

  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }

  info.update(layer.feature.properties);
  document.getElementsByClassName("details")[0].style.visibility = "visible";
}

var geojson;

function resetHighlight(e) {
  geojson.resetStyle(e.target);
  info.update();
  document.getElementsByClassName("details")[0].style.visibility = "hidden";
}

function zoomToFeature(e) {
  map.fitBounds(e.target.getBounds());
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: highlightFeature
    /*click: zoomToFeature*/
  });
}

geojson = L.geoJson(statesData, {
  style: style,
  onEachFeature: onEachFeature
}).addTo(map);

var legend = L.control({ position: "bottomright" });

legend.onAdd = function(map) {
  var div = L.DomUtil.create("div", "info legend"),
    grades = [1, 100, 200, 500, 1000, 2000, 5000, 10000],
    labels = [],
    from,
    to;

  for (var i = 0; i < grades.length; i++) {
    from = grades[i];
    to = grades[i + 1];

    labels.push(
      '<i style="background:' +
        getColor(from + 1) +
        '"></i> ' +
        from +
        (to ? "&ndash;" + to : "+")
    );
  }

  div.innerHTML = labels.join("<br>");
  return div;
};

legend.addTo(map);

// ********************** chart *********************
function updateChart(labels, infections) {
  var ctx = document.getElementById("chart").getContext("2d");
  var chart = new Chart(ctx, {
    // The type of chart we want to create
    type: "line",

    // The data for our dataset
    data: {
      labels: labels,
      datasets: [
        {
          label: "Number of Infected",
          backgroundColor: "transparent",
          borderColor: "rgb(255, 0, 54)",
          data: infections
        }
      ]
    },

    // Configuration options go here
    options: {}
  });
}

// Add an event listener
document.addEventListener("slider-changed", function(e) {
  mapDataDate = e.detail;
  for (var key in geojson._layers) {
    if (geojson._layers.hasOwnProperty(key)) {
      let item = geojson._layers[key];
      try {
        item.feature.properties.infections.data.forEach(y => {
          if (y.date.includes(e.detail)) {
            item.setStyle({
              weight: 2,
              opacity: 1,
              color: "white",
              dashArray: "3",
              fillOpacity: 0.7,
              fillColor: getColor(y.infectedNumber)
            });
          }
        });
      } catch {}
    }
  }
});

// ****************************** slider ************************

var formatDateIntoYear = d3.timeFormat("%d");
var formatDate = d3.timeFormat("%d %b");

var startDate = minDate,
  endDate = maxDate;

var mright = 250;
var mleft = 70;
if (document.body.scrollWidth < 700) {
  mright = 30;
  mleft = 60;
}

var margin = { top: 0, right: mright, bottom: 0, left: mleft },
  width = document.body.scrollWidth * 0.8 - margin.left - margin.right,
  height = 100;

var moving = false;
var currentValue = 0;
var targetValue = width;

var svg = d3
  .select("#slider")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height);

var x = d3
  .scaleTime()
  .domain([startDate, endDate])
  .range([0, width])
  .clamp(true);

var slider = svg
  .append("g")
  .attr("class", "slider")
  .attr("transform", "translate(" + margin.left + "," + height / 2 + ")");

slider
  .append("line")
  .attr("class", "track")
  .attr("x1", x.range()[0])
  .attr("x2", x.range()[1])
  .select(function() {
    return this.parentNode.appendChild(this.cloneNode(true));
  })
  .attr("class", "track-inset")
  .select(function() {
    return this.parentNode.appendChild(this.cloneNode(true));
  })
  .attr("class", "track-overlay")
  .call(
    d3
      .drag()
      .on("start.interrupt", function() {
        slider.interrupt();
      })
      .on("start drag", function() {
        Update(x.invert(d3.event.x));
      })
  );

slider
  .insert("g", ".track-overlay")
  .attr("class", "ticks")
  .attr("transform", "translate(0," + 8 + ")")
  .selectAll("text")
  .data(x.ticks(10))
  .enter()
  .append("text")
  .attr("x", x)
  .attr("y", 10)
  .attr("text-anchor", "middle")
  .text(function(d) {
    return formatDateIntoYear(d);
  });

var label = slider
  .append("text")
  .attr("class", "label")
  .attr("text-anchor", "middle")
  .text(formatDate(startDate))
  .attr("transform", "translate(0," + -25 + ")");

var handle = slider
  .insert("circle", ".track-overlay")
  .attr("class", "handle")
  .attr("r", 9);

function Update(h) {
  handle.attr("cx", x(h));
  label.attr("x", x(h)).text(formatDate(h));

  // Create the event
  var event = new CustomEvent("slider-changed", {
    detail: d3.timeFormat("%Y-%m-%d")(h)
  });
  // Dispatch/Trigger/Fire the event
  document.dispatchEvent(event);
}

function step() {
  Update(x.invert(currentValue));
  currentValue = currentValue + targetValue / 151;
  if (currentValue > targetValue) {
    moving = false;
    currentValue = 0;
    clearInterval(timer);
    // timer = 0;
    playButton.text("Play");
    console.log("Slider moving: " + moving);
  }
}

var playButton = d3.select("#play-button");
playButton.on("click", function() {
  var button = d3.select(this);
  if (button.text() == "Pause") {
    moving = false;
    clearInterval(timer);
    // timer = 0;
    button.text("Play");
  } else {
    moving = true;
    timer = setInterval(step, 100);
    button.text("Pause");
  }
  console.log("Slider moving: " + moving);
});

Update(x.invert(targetValue));
