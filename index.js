require('dotenv').config({ path: './envvars' });
var BlueBirdQueue = require('bluebird-queue')
var express = require('express');
var Q = require('bluebird');
var SERVER = require('./server');
var INFO = require('./info');
var APP = require('./app');
var UPLOAD = require('./upload');

const queue = new BlueBirdQueue({
    concurrency: 1 // optional, how many items to process at a time
});

const BEAT_SEQUENCES = [5, 9, 5, 7, 3, 5, 9, 5]

function add(trackId, outFile) {
    const p = APP.add(trackId, outFile, BEAT_SEQUENCES.map(v => (v - 1)), 1)
        .then(final => {
            console.log(final);
            INFO.info(trackId)
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

add('wF0DoWPimGg')
.then(uploadUrl=>{
    console.log(uploadUrl);
})

queue.start().then(function(results) {
    console.log(results);
});
