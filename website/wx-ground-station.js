
//
// Replace BUCKET_NAME with the bucket name.
//
var bucketName = '';
// Replace this block of code with the sample code located at:
// Cognito -- Manage Identity Pools -- [identity_pool_name] -- Sample Code -- JavaScript
//
// Initialize the Amazon Cognito credentials provider
AWS.config.region = 'us-west-2'; // Region
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: ''
});

// Create a mapbox.com account and get access token
const MAP_BOX_ACCESS_TOKEN = 'YOUR MAPBOX TOKEN';
const GROUND_STATION_LAT =  45.0468;
const GROUND_STATION_LON = -93.4747;
const GROUND_STATION_NAME = 'my ground station';
const MAX_CAPTURES = 20;
const DIR_NAME = "images";

// Create a new service object
var s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  params: {Bucket: bucketName}
});

var tlejs = new TLEJS();
var lastPositionOfNextPass;
var nextPass = null

function getSatelliteLink(tles) {
  var satNum = tlejs.getSatelliteNumber(tles);
  return "https://www.n2yo.com/satellite/?s=" + satNum;
}


function load() {
  $('#location').html(GROUND_STATION_LAT + ', ' + GROUND_STATION_LON);
  getUpcomingPassInfo();
  getImageMetadata(DIR_NAME, function (err, metadata) {
    if (err) {
      $('#messages').html('<div class="alert alert-danger" role="alert">Error getting image metadata: ' + err + '</div>');
      return;
    }
    $('#messages').html('');

    // show newest first
    var sortedMeta = metadata.sort(function (m1, m2) {
      var m1key = m1.date + "-" + m1.time;
      var m2key = m2.date + "-" + m2.time;
      return (m1key > m2key) ? -1 : 1;
    });

    var captureCount = 0;

    sortedMeta.forEach(function (m) {
      if (++captureCount > MAX_CAPTURES) return;
      if (m == null) return;
      var mapId = m.imageKey + '-gt';
      var satLink = '<a target="_blank" href="' + getSatelliteLink([m.tle1, m.tle2]) + '">' + m.satellite + '</a>';
      $('#previous_passes').append([
        //'<br clear="all"/>',
        '<h3 class="mt-1">', m.date, '  ', m.time, '</h3>',
        '<div class="row" style="margin-left:0px;">',
          '<div id=', mapId, ' style="height: 240px;" class="col-lg-6 col-md-6 col-xs-8">',
          '</div>',
          '<div style="margin-bottom:10px;" class="col-lg-6 col-md-6 col-xs-4">',
            '<div>satellite: ', satLink, '</div>',
            '<div>elevation: ', m.elevation, '&deg;', '</div>',
            '<div>direction: ', m.direction, '</div>',
            '<div>downlink freq: ', m.frequency, ' MHz', '</div>',
            '<div>gain: ', m.gain, '</div>',
            '<div>channel A: ', m.chan_a, '</div>',
            '<div>channel B: ', m.chan_b, '</div>',
          '</div>',
        '</div>'].join(''));
      $('#previous_passes').append([
        '<div class="row" style="margin-bottom: 8px;">',
          '<div style="margin-bottom:10px;" class="col-lg-12 col-md-12 col-xs-12">',
            '<div>orbital elements:</div>',
            '<div>', m.tle1.replace(/ /g, "&nbsp;"), '</div>',
            '<div>', m.tle2.replace(/ /g, "&nbsp;"), '</div>',
          '</div>',
        '</div>'].join(''));

      var mapOptions = {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        touchZoom: false,
        doubleClickZoom: false,
        dragging: false
      };
      var groundTrackMap = L.map(mapId, mapOptions).setView([GROUND_STATION_LAT, GROUND_STATION_LON], 4);

      L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
        tileSize: 512,
        maxZoom: 18,
        zoomOffset: -1,
        id: 'mapbox/streets-v11',
        accessToken: MAP_BOX_ACCESS_TOKEN
      }).addTo(groundTrackMap);

      var bounds = groundTrackMap.getBounds();
      var marker = L.marker([GROUND_STATION_LAT, GROUND_STATION_LON], {title: GROUND_STATION_NAME}).addTo(groundTrackMap);

      var t = m.time.split(' ').join('');
      var captureTime = new Date(m.date + 'T' + t).getTime();
      if (m.duration) {
        // get the current orbit at the middle of the pass duration so it is the correct orbit for the ground station location.
        captureTime += (m.duration/2) * 1000;
      }

      const orbits = tlejs.getGroundTrackLatLng(
        [m.tle1, m.tle2],
        10000,
        captureTime
      );
      var orbit = orbits[1];
      var polyline = L.polyline(orbit, {color: 'red'}).addTo(groundTrackMap);
      const lat = 0;
      const lon = 1;
      const tickLength = 0.5;
      for(var i=0;i<orbit.length-1;i=i+5) {
        var origin = orbit[i];
        if ((origin[lat] < bounds.getNorth()) && (origin[lat] > bounds.getSouth())) {
          // draw two ticks to indicate direction of orbit
          /*

          directionAngle:   |
                  +135deg  /|\  -135deg
                            |
           */
          var dlon = orbit[i+1][lon] - origin[lon];
          var dlat = orbit[i+1][lat] - origin[lat];

          // angle from point i and point i+1
          var directionAngle = Math.atan2(dlat,dlon);

          var tickAngle = directionAngle - (135 * (Math.PI/180))
          var tick = [tickLength * Math.sin(tickAngle), tickLength * Math.cos(tickAngle)];
          var tickPoints = [ [origin[lat], origin[lon]], [origin[lat]+tick[lat], origin[lon]+tick[lon]] ];
          L.polyline(tickPoints, {color: 'red'}).addTo(groundTrackMap);

          tickAngle = directionAngle + (135 * (Math.PI/180))
          tick = [tickLength * Math.sin(tickAngle), tickLength * Math.cos(tickAngle)];
          tickPoints = [ [origin[lat], origin[lon]], [origin[lat]+tick[lat], origin[lon]+tick[lon]] ];
          L.polyline(tickPoints, {color: 'red'}).addTo(groundTrackMap);
        }
      }

      m.images.forEach(function (i) {
        if (i.filename.endsWith("-ZA.png")) i.order = 1;
        if (i.filename.endsWith("-MCIR.png")) i.order = 2;
        if (i.filename.endsWith("-NO.png")) i.order = 3;
        if (i.filename.endsWith("-MSA.png")) i.order = 4;
        if (i.filename.endsWith("-MSAPRECIP.png")) i.order = 5;
        if (i.filename.endsWith("-THERM.png")) i.order = 6;
      });
      var images = m.images.sort(function (i1, i2) {
        return (i1.order < i2.order) ? -1 : 1;
      });
      var imageHtml = [
        '<div class="row mb-5">'
      ];
      images.forEach(function (i) {
        if (i.filename.endsWith('-MSAPRECIP.png')) {
          return;
        }
        if (m.chan_a == '3/3B (mid infrared)') {
          // Show MSA image if sensor 3 was used.
          if (i.filename.endsWith('-MSA.png')) {
            return;
          }
        }
        if (m.chan_a != '3/3B (mid infrared)') {
          // If no sensor 3 data, then show the thermal IR image.
          if (i.filename.endsWith('-THERM.png')) {
            return;
          }
        }
        var url = DIR_NAME + '/' + i.filename;
        var thumburl = DIR_NAME + '/' + i.thumbfilename;
        imageHtml.push([
          '<figure class="col-lg-3 col-md-6 col-xs-6">',
            '<a target="_blank" rel="group" href="', url, '" data-width="', i.width, '" data-height="', i.height, '" data-toggle="lightbox" data-type="image">',
              '<img class="img-fluid img-responsive" src="', thumburl, '" alt="">',
            '</a>',
            '<div class="caption">',
              i.enhancement,
            '</div>',
          '</figure>'].join(''));
      });
      imageHtml.push('</div>');
      $('#previous_passes').append(imageHtml.join(''));
    });
  });
}


function getImageMetadata(DIR_NAME, cb) {
  var pattern = new RegExp(".+-[0-9]+[0-9]+\.json$");
  s3.listObjects({Prefix: DIR_NAME}, function(err, data) {
    if (err) {
      return cb('There was an error viewing the directory: ' + err.message);
    }
    if (data && data.Contents && (data.Contents.length == 0)) {
      return cb('directory not found');
    }
    var metadataFiles = data.Contents.filter(function (object) {
      return pattern.test(object.Key);
    });

    var promises = metadataFiles.map(function(md) {
      var params = {
        Bucket: bucketName,
        Key: md.Key
      };
      return s3.getObject(params).promise().then(function(data) {
        var s = JSON.parse(data.Body.toString());
        return s;
      });
    });

    Promise.all(promises).then(function(results) {
        cb(null, results);
    })

  });
}

function getUpcomingPassInfo() {

  $.get(DIR_NAME + "/upcoming_passes.json", function(data) {
    var now = new Date();
    var processingTime = 180000; // approx 3 minutes to process and upload images.
    for(var i=0;i<data.length;i++) {
      var passTime = new Date(data[i].end + processingTime);
      if ((!nextPass) && (passTime > now)) {
        nextPass = data[i];
      }
    }
    var satLink = '<a target="_blank" href="' + getSatelliteLink([nextPass.tle1, nextPass.tle2]) + '">' + nextPass.satellite + '</a>';
    var startDate = new Date(nextPass.start);
    var endDate = new Date(nextPass.end + processingTime);
    $("#upcoming_passes").append([
      '<div>',
      '<h5>next image capture: ',
      satLink,
      ' ',
      nextPass.direction,
      ' at ',
      nextPass.elevation,
      '&deg elevation',
      '</h5>',
      '<h5>capture begins at: ',
      ("0" + startDate.getHours()).slice(-2) + ":" + ("0" + startDate.getMinutes()).slice(-2),
      '</h5>',
      '<h5>imagery approx: ',
      ("0" + endDate.getHours()).slice(-2) + ":" + ("0" + endDate.getMinutes()).slice(-2),
      '</h5>',
      '</div>'].join('')
    );

    lastPositionOfNextPass = tlejs.getLatLon([nextPass.tle1, nextPass.tle2], new Date().getTime());

    mapboxgl.accessToken = MAP_BOX_ACCESS_TOKEN;

    var flyoverMap = new mapboxgl.Map({
      container: 'flyover_map',
      style: 'mapbox://styles/mapbox/satellite-streets-v10',
      center: [lastPositionOfNextPass.lng, lastPositionOfNextPass.lat],
      pitch: 60,
      bearing: 0,
      zoom: 3
    });

    var staticMap = new mapboxgl.Map({
      container: 'static_map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [0, 0],
      zoom: 0
    });

    function getSatLocation() {
      var location = tlejs.getLatLon([nextPass.tle1, nextPass.tle2], new Date().getTime());
      return new mapboxgl.LngLat(location.lng, location.lat);
    }

    function getSatLocationPoint() {
      var l = getSatLocation();
      return {
        "type": "Point",
        "coordinates": [l.lng, l.lat]
      };
    }

    function getCurrentOrbit() {
      var orbits = tlejs.getGroundTrackLatLng(
        [nextPass.tle1, nextPass.tle2],
        10000,
        new Date().getTime()
      );
      var currentOrbit = orbits[1]; // [lat, lng] ordering
      var r = [];
      // Convert to [lng, lat] ordering as required by MapBox APIs
      for(var i=0;i<currentOrbit.length;i++) {
        var point = currentOrbit[i];
        r.push([point[1], point[0]]);
      }
      return r;
    }

    function getBearing(l) {
      var l2 = lastPositionOfNextPass;
      var bearing = -((Math.atan2(l.lat - l2.lat, l.lng - l2.lng) * 180 / Math.PI) - 90.0);
      lastPositionOfNextPass = l;
      return bearing;
    }

    function getOrbitData() {
      return {
        "type": "FeatureCollection",
        "features": [{
          "type": "Feature",
          "geometry": {
            "type": "LineString",
            "coordinates": getCurrentOrbit()
          }
        }]
      };
    }


    flyoverMap.on('load', function() {
      flyoverMap.addLayer({
        "id": "ground-station",
        "type": "circle",
        "source": {
          "type": "geojson",
          "data": {
            "type": "Point",
            "coordinates": [GROUND_STATION_LON, GROUND_STATION_LAT]
          }
        },
        "paint": {
          "circle-radius": 10,
          "circle-color": "#ff0000"
        }
      });

      setInterval(() => {
        var currentLocation = getSatLocation();
        var bearing = getBearing(currentLocation);
        flyoverMap.setCenter([currentLocation.lng, currentLocation.lat]);
        flyoverMap.setBearing(bearing);
      }, 500);
    });



    staticMap.on('load', function() {
      staticMap.addSource('satellite-location', {
        "type": "geojson",
        "data": getSatLocationPoint()
      });

      staticMap.addSource('current-orbit', {
        "type": "geojson",
        "data": getOrbitData()
      });


      staticMap.addLayer({
        'id': 'orbit',
        'type': 'line',
        'source': 'current-orbit',
        'layout': {
          'line-cap': 'round',
          'line-join': 'round'
        },
        'paint': {
          'line-color': '#eeee00',
          'line-width': 5,
          'line-opacity': .8
        }
      });

      staticMap.addLayer({
        "id": "ground-station",
        "type": "circle",
        "source": {
          "type": "geojson",
          "data": {
            "type": "Point",
            "coordinates": [GROUND_STATION_LON, GROUND_STATION_LAT]
          }
        },
        "paint": {
          "circle-radius": 10,
          "circle-color": "#ff0000"
        }
      });

      staticMap.addLayer({
        "id": "satellites",
        "source": "satellite-location",
        "type": "circle",
        "paint": {
          "circle-radius": 10,
          "circle-color": "#007cbf"
        }
      });

      staticMap.setZoom(0);

      setInterval(() => {
        staticMap.getSource('satellite-location').setData(getSatLocationPoint());
      }, 500);

      setInterval(() => {
        // set the current orbit every minute.
        staticMap.getSource('current-orbit').setData(getOrbitData());
      }, 60000);


    });

  });
}
