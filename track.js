var Q = require('bluebird');
var path = require('path');
const spawn = require('child_process').spawn
var Interface = require('@samelie/node-youtube-dash-sidx');
const TRACK = (() => {

  function _parseBeats(file) {
    return new Q((yes, no) => {
      var id = path.parse(file).name
      const outFile = `${process.env.PROJECT}/${id}.csv`
      var child = spawn('./beats.py', [file, outFile])
      child.stderr.on('data', function(data) {
        no()
      })
      child.stdout.on('data', function(data) {
        console.log("Got data from child: " + data);
      });
      child.on('exit', function(exitCode) {
        console.log("Child exited with code: " + exitCode);
        if(exitCode === 0){
          yes({
            track:file,
            csv:outFile,
          })
        }else{
          no()
        }
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
        _parseBeats(`${process.env.PROJECT}/${id}.m4a`)
        .then(data=>(yes(data)))
        .catch(err=>{
          no(err)
        })
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