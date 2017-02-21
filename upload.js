require('dotenv').config({ path: './envvars' });
var Q = require('bluebird');
var fs = require('fs');
var _ = require('lodash');


const spawn = require('child_process').spawn
const exec = require('child_process').exec

const UPLOAD = (() => {
    const PATH = process.env.YOUTUBE_UPLOAD || 'youtube-upload'

    function upload(path, options = {}) {
        return new Q((yes, no) => {
            const _cmd = `${PATH} --title ${options.title} ${path}`
            console.log(_cmd);
            const child = exec(_cmd)

            child.stdout.on('data', function(data) {
                console.log(data.toString());
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

//UPLOAD.upload("2d776808-c71a-4373-adef-ae6eac427827.mp4", {})

module.exports = UPLOAD
