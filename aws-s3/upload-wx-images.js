var fs =  require('fs');
var path = require('path');
var glob = require("glob");
var AWS = require('aws-sdk');
var uuid = require('uuid');
var Jimp = require('jimp');
var dateFormat = require('dateformat');

var REGION = "";
var BUCKET = "";
var LOCATION = "";
var IMAGE_DIR = "images/";

AWS.config.update({region: REGION});
var s3 = new AWS.S3();

var satellite = process.argv[2];
var frequency = process.argv[3];
var filebase = process.argv[4];
var elevation = process.argv[5];
var direction = process.argv[6];
var duration = process.argv[7];
var tle1 = process.argv[8];
var tle2 = process.argv[9];
var gain = process.argv[10];
var chan_a = process.argv[11];
var chan_b = process.argv[12];

var basename = filebase.slice(filebase.lastIndexOf('/')+1);
var dirname = filebase.slice(0, filebase.lastIndexOf('/')+1);
var components = basename.split("-");
var date = components[1];
date = date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6);
var time = components[2];
time = time.slice(0, 2) + ':' + time.slice(2, 4) + ':' + time.slice(4) + ' ' + dateFormat(new Date, "o");


// example "Gain: 15.2"
if (gain) {
  gain = gain.substring(gain.indexOf(": ")  + 2)
}

// example "Channel A: 1 (visible)"
if (chan_a) {
  chan_a = chan_a.substring(chan_a.indexOf(": ")+2);
}
// example "Channel B: 4 (thermal infrared)"
if (chan_b) {
  chan_b = chan_b.substring(chan_b.indexOf(": ")+2);
}

console.log("Uploading files " + path.basename(filebase) + "* to S3...");

var metadata = {
  satellite: satellite,
  date: date,
  time: time,
  elevation: elevation,
  direction: direction,
  duration: duration,
  imageKey: filebase.slice(filebase.lastIndexOf('/')+1),
  tle1: tle1,
  tle2: tle2,
  frequency: frequency,
  gain: gain,
  chan_a: chan_a,
  chan_b: chan_b,
  images: []
};

async function uploadImage(image, filename) {
  var w = image.bitmap.width;
  var h = image.bitmap.height;
  var enhancement;
  if (filename.endsWith("-ZA.png")) enhancement = "normal infrared";
  if (filename.endsWith("-NO.png")) enhancement = "color infrared";
  if (filename.endsWith("-MSA.png")) enhancement = "multispectral analysis";
  if (filename.endsWith("-MSAPRECIP.png")) enhancement = "multispectral precip";
  if (filename.endsWith("-MCIR.png")) enhancement = "map color infrared";
  if (filename.endsWith("-THERM.png")) enhancement = "thermal";
  var imageInfo = {
    filename: filename,
    width: w,
    height: h,
    thumbfilename: 'thumbs/' + filename,
    enhancement: enhancement
  };


  var font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  var newImage = await new Jimp(image.bitmap.width, image.bitmap.height+64, '#000000');
  newImage.composite(image, 0, 48);
  image = newImage;
  image.print(font, 5, 5, metadata.date + " " + metadata.time + "  satellite: " + metadata.satellite +
    "  elevation: " + metadata.elevation + '\xB0' + "  enhancement: " + enhancement);
  image.print(font, 5, 25, LOCATION);

  image.getBuffer(Jimp.MIME_PNG, (err, buffer) => {
    var params = {
      ACL: "public-read",
      ContentType: "image/png",
      Bucket: BUCKET,
      Key: IMAGE_DIR + filename,
      Body: buffer
    };
    s3.putObject(params, (err, data) => {
      if (err) {
        console.log(err)
      } else {
        console.log("  successfully uploaded " + filename);
      }
    });
  });

  var thumb = image.clone();
  thumb.cover(260, 200);
  var thumbFilename = "thumbs/" + filename;
  thumb.getBuffer(Jimp.MIME_PNG, (err, buffer) => {
    var params = {
      ACL: "public-read",
      ContentType: "image/png",
      Bucket: BUCKET,
      Key: IMAGE_DIR + thumbFilename,
      Body: buffer
    };
    s3.putObject(params, (err, data) => {
      if (err) {
        console.log(err)
      } else {
        console.log("  successfully uploaded thumb " + filename);
      }
    });
  });

  return imageInfo;
}

function uploadMetadata(filebase) {
  var metadataFilename = filebase + ".json";
  console.log("uploading metadata " + JSON.stringify(metadata, null, 2));
  var params = {
    ACL: "public-read",
    Bucket: BUCKET,
    Key: IMAGE_DIR + metadataFilename,
    Body: JSON.stringify(metadata, null, 2)
  };

  s3.putObject(params, function(err, data) {
    if (err) {
      console.log(err)
    } else {
      console.log("  successfully uploaded metadata " + metadataFilename);
    }
  });
}


glob(filebase + "-[A-Z]*.png", {}, function (err, files) {
  var uploadPromises = [];
  files.forEach(function(filename) {
    var basename = path.basename(filename);
    Jimp.read(filename)
      .then(image => {
        uploadPromises.push(uploadImage(image, basename));
        if (uploadPromises.length == files.length) {
          Promise.all(uploadPromises).then((values) => {
            metadata.images = values;
            console.log("values: " + JSON.stringify(values, null, 2));
            uploadMetadata(path.basename(filebase));
          });
        }
      });
  });
});
