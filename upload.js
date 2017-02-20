require('dotenv').config({ path: './envvars' });
var Q = require('bluebird');
var fs = require('fs');
var _ = require('lodash');


const spawn = require('child_process').spawn
const exec = require('child_process').exec

const UPLOAD = (() => {
    const PATH = process.env.YOUTUBE_UPLOAD || 'youtube-upload'

    function upload(path, options) {
        return new Q((yes, no) => {
            const _cmd = `${PATH} --title ${options.title} ${path}`
            const child = exec(_cmd)
                // Listen for stdout data
            child.stderr.on('data', function(data) {
                console.log(data.toString());
            })
            child.stdout.on('data', function(data) {
                console.log("Done");
                fs.unlinkSync(path)
                yes(data)
                console.log("Got data from child: " + data);
            });
            // Listen for an exit event:
            child.on('exit', function(exitCode) {
                if (exitCode !== 0) {
                    //err
                    console.log("Error");
                    no()
                } else {

                }
                console.log("Child exited with code: " + exitCode);
            });
        })
    }

    return {
        upload: upload
    }


})()


module.exports = UPLOAD
