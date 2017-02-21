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

            child.stdout.on('data', function(data) {
                yes(data.toString())
            });
            child.on('exit', function(exitCode, err, data) {
                if (exitCode !== 0) {
                    //err
                    console.log("Error");
                    no()
                } else {

                }
            });
        })
    }

    return {
        upload: upload
    }


})()

//UPLOAD.upload("2c200ee2-bbe1-49dd-931e-eb09c9679287.mp4", {})

module.exports = UPLOAD
