require('dotenv').config({ path: './envvars' });
var BlueBirdQueue = require('bluebird-queue')
var express = require('express');
var fs = require('fs');
var Q = require('bluebird');
var SERVER = require('./server');
var INFO = require('./info');
var APP = require('./app');
var UPLOAD = require('./upload');
const exec = require('child_process').execSync

const queue = new BlueBirdQueue({
    concurrency: 1 // optional, how many items to process at a time
});

if(fs.existsSync(process.env.PROJECT)){
    const _cmd = `rm -rf ${process.env.PROJECT}`
    exec(_cmd)
}
fs.mkdirSync(process.env.PROJECT)

const BEAT_SEQUENCES = [5, 9, 5, 7, 3, 5, 9, 5]

function add(trackId, outFile) {
    const p = APP.add(trackId, outFile, BEAT_SEQUENCES.map(v => (v - 1)), 20)
        .then(final => {
            console.log(final);
            return INFO.info(trackId)
                .then(info => {
                    const item = info[0]
                    return UPLOAD.upload(`${outFile}.mp4`, { title: item.snippet.title })
                })
        })
    queue.add(p)
    return p
}

const router = express.Router()
router.get('/churn', function(req, res, next) {
    const { query } = req
    console.log(query);
    add(query.id)
        .then(uploaded => {
            res.status(200).send('nothing to see here...');
        })
});

router.get('/', function(req, res) {
    res.status(200).send('nothing to see here...');
});

const server = new SERVER(router)

queue.start().then(function(results) {
    console.log(results);
});

//add('wF0DoWPimGg', 'test')