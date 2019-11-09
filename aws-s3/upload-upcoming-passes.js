var fs =  require('fs');
var path = require('path');
var AWS = require('aws-sdk');
var uuid = require('uuid');

var BUCKET = "";
var REGION = "";
var IMAGE_DIR = "images/";

AWS.config.update({region: REGION});
var s3 = new AWS.S3();

uploadUpcomingPasses(process.argv[2]);

function uploadUpcomingPasses(filename) {
  var upcomingPassesFilename = "upcoming_passes.json";
  var lines = fs.readFileSync(filename).toString().split("\n");
  var count = 0;
  var all_passes = [];
  lines.forEach((line) => {
    if (line.trim().length > 0) {
      var fields = line.split(',');
      var pass_info = {
        start: new Date(0).setUTCSeconds(fields[0]),
        end: new Date(0).setUTCSeconds(fields[1]),
        elevation: fields[2],
        direction: fields[3],
        satellite: fields[4],
        tle1: fields[5],
        tle2: fields[6]
      };
      all_passes.push(pass_info);
    }
    if (++count == lines.length) {
      all_passes = all_passes.sort((a, b) => { return a.start-b.start });
      console.log("uploading upcoming pass info");
      var params = {
        ACL: "public-read",
        ContentType: "application/json",
        Bucket: BUCKET,
        Key: IMAGE_DIR + upcomingPassesFilename,
        Body: JSON.stringify(all_passes, null, 2)
      };

      s3.putObject(params, function(err, data) {
        if (err) {
          console.log(err)
        } else {
          console.log("  successfully uploaded " + upcomingPassesFilename);
        }
      });
    }
  })
}
