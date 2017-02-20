require('dotenv').config({ path: './envvars' });
var express = require('express');
var fs = require('fs');
var uuid = require('uuid');
var readDir = require('readdir');
var Q = require('bluebird');
var SERVER = require('./server');
const IO = require('./socket')
var INFO = require('./info');
var REDIS = require('./redis');
var APP = require('./app');
var UPLOAD = require('./upload');
const exec = require('child_process').execSync

const BEAT_SEQUENCES = [5, 9, 5, 2, 3, 3, 4, 5]

const trackQueue = []
let io;
let processing = false

function addTrack(trackId) {
    trackQueue.unshift(trackId)
}

function getNextTrack() {
    if (trackQueue.length) {
        return trackQueue.shift()
    }
    return null
}

function start() {
    setInterval(() => {
        if (!processing) {
            const trackI = getNextTrack()
            if (trackI) {
                processing = true
                startEncoding(trackI, uuid.v4())
            }
        }
    }, 2000)
}

function encodingFinished(youtubeId) {
    io.videoEncoded(youtubeId)
    REDIS.sadd(`${process.env.REDIS_PROJECT}:uploads`, youtubeId)
        .then(d => {
            console.log(d);
        })
}

function startEncoding(trackId, outFile) {

    if (fs.existsSync(process.env.PROJECT)) {
        const _cmd = `rm -rf ${process.env.PROJECT}`
        exec(_cmd)
    }
    fs.mkdirSync(process.env.PROJECT)

    return APP.add(trackId, outFile, BEAT_SEQUENCES.map(v => (v - 1)), process.env.CLIPS_PER)
        .then(final => {
            console.log(final);
            return INFO.info(trackId)
                .then(info => {
                    const item = info[0]
                    console.log(info);
                    return UPLOAD.upload(`${outFile}.mp4`, { title: item.snippet.title })
                        .then(youtubeId => {
                            console.log("processing done", youtubeId);
                            processing = false
                            encodingFinished(youtubeId)
                            return youtubeId
                        })

                })
        })
}

APP.setHandlers({
    gotBuffer: (id) => {
        io.emitAll('gotbuffer', id)
    }
})

const router = express.Router()
router.get('/churn', function(req, res, next) {
    const { query } = req

    addTrack(query.id)
});

router.get('/', function(req, res) {
    res.status(200).send('nothing to see here...');
});

const server = new SERVER(router)

io = IO(server.server);

start()

setTimeout(() => {

        encodingFinished('wF0DoWPimGg')
    }, 2000)
    //add('wF0DoWPimGg', 'test')
