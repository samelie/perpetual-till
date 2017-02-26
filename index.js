require('dotenv').config({ path: './envvars' });
var GoogleUpload = require('@samelie/google-cloudstorage');
var express = require('express');
var fs = require('fs');
var _ = require('lodash');
var uuid = require('uuid');
var readDir = require('readdir');
var Q = require('bluebird');
var SERVER = require('./server');
const IO = require('./socket')
var DIRECTION_CLIPS = require('./direction_clips');
var INFO = require('./info');
var MAPS = require('./maps');
var REDIS = require('./redis');
var APP = require('./app');
var UPLOAD = require('./upload');
const exec = require('child_process').execSync

//HARSH
const BEAT_SEQUENCES = [5, 9, 5, 2, 3, 3, 4, 5]

//const trackQueue = ["UkGXUn0Kuuw", "kFkQ-d0OeEg", "dkul5z9Rs3g", "_GA89EfQ0Pg", "zu6GO0e9pBo"]
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

    MAPS.directions({ origin: 'paris,france', destination: 'moscow, russia' })
    .then(route => {
        const steps = _.flatten(route.legs.map(leg => leg.steps))

        const passes = []
        let incre
        let i = 0
        let points
        while (steps.length) {
            incre = Math.floor(steps.length / MAX_VIDEOS)
            if (!points) {
                points = []
            }
            let index = (i * incre) % steps.length
            points.push([index, steps[index].start_location])
            if (points.length > MAX_VIDEOS - 1) {
                points.forEach(p => (steps.splice(p[0], 1)))
                passes.push([...points.map(p => p[1])])
                points = null
            }
            i++
        }

        return DIRECTION_CLIPS.findCoords(_.flatten(passes), MAX_VIDEOS)
            .then(videos => {
                console.log(videos.length);
                const ids = videos.map(group=>(group[0]))
                console.log(ids);
                return APP.addFromClipIds(trackId, outFile, BEAT_SEQUENCES.map(v => (v - 1)), ids)
                    .then(final => {
                        return INFO.info(trackId)
                            .then(info => {
                                const item = info[0]
                                console.log(info);
                                return UPLOAD.upload(final, { title: item.snippet.title })
                                    .then(youtubeId => {
                                        console.log("processing done", youtubeId);
                                        processing = false
                                        encodingFinished(youtubeId)
                                            //HARSH
                                        exec('rm *.txt')
                                        exec('rm *.mp4')
                                        return youtubeId
                                    })

                            })
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

