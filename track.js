var Q = require('bluebird');
var path = require('path');
const spawn = require('child_process').spawn
var Interface = require('@samelie/node-youtube-dash-sidx');
const TRACK = (() => {

  function _parseBeats(file) {
    return new Q((yes, no) => {
      var id = path.parse(file).name
      var child = spawn('./beats.py', [file, `${process.env.PROJECT}/${id}.csv`])
      child.stdout.on('data', function(data) {
        console.log("Got data from child: " + data);
      });
      child.on('exit', function(exitCode) {
        console.log("Child exited with code: " + exitCode);
        yes({
          track:file,
          csv:`${id}.csv`,
        })
      });
    });
  }

  function _downloadTrack(id) {
    return new Q((yes, no) => {
      var child = spawn('youtube-dl', [`https://www.youtube.com/watch?v=${id}`, '-f 140', `-o${process.env.PROJECT}/%(id)s.%(ext)s`])

      // Listen for stdout data
      child.stdout.on('data', function(data) {
        console.log("Got data from child: " + data);
      });
      // Listen for an exit event:
      child.on('exit', function(exitCode) {
        console.log("Child exited with code: " + exitCode);
        yes(_parseBeats(`${id}.m4a`))
      });
    });
  }

  function start(id) {
    return _downloadTrack(id)
  }

  return {
    start: start
  }
})()

module.exports = TRACK