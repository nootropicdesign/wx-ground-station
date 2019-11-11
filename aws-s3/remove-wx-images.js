var fs =  require('fs');
var AWS = require('aws-sdk');
var uuid = require('uuid');

var REGION = "";
var BUCKET = "";
var IMAGE_DIR = "images/";

AWS.config.update({region: REGION});
var s3 = new AWS.S3();

var filebase = process.argv[2];

console.log("Removing files " + filebase + "* from S3...");

var files = [
  filebase + ".json",
  filebase + "-ZA.png",
  filebase + "-NO.png",
  filebase + "-MSA.png",
  filebase + "-MSAPRECIP.png",
  filebase + "-MCIR.png",
  filebase + "-THERM.png",
  "thumbs/" + filebase + "-ZA.png",
  "thumbs/" + filebase + "-NO.png",
  "thumbs/" + filebase + "-MSA.png",
  "thumbs/" + filebase + "-MSAPRECIP.png",
  "thumbs/" + filebase + "-MCIR.png",
  "thumbs/" + filebase + "-THERM.png"
];

files.forEach(removeFile);


function removeFile(filename) {
  var params = {
    Bucket: BUCKET,
    Key: IMAGE_DIR + filename,
  };
  s3.deleteObject(params, (err, data) => {
    if (err) {
      console.log(err)
    } else {
      console.log("  successfully removed " + filename);
    }
  });
}
