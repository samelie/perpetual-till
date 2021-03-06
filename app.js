var Q = require('bluebird');
var _ = require('lodash');
var colors = require('colors');
var fs = require('fs');
var path = require('path');
var NOISE = require('./noise');
var TRACK = require('./track');
var CLIPS = require('./clips');
var lodash = require('lodash');
var uuid = require('uuid');
var csv = require('fast-csv');
var ffmpeg = require('fluent-ffmpeg');
var stream = require('stream');
var Interface = require('@samelie/node-youtube-dash-sidx');
var Range = require('@samelie/dash-record');
var toBuffer = require('typedarray-to-buffer')
const spawn = require('child_process').spawnSync

const APP = (() => {

    const PROJECT_P = process.env.PROJECT

    const WIDTH = 640
    const HEIGHT = 360

    const MAX_SIDX = 100

    const VIDEO_LOOK_AHEAD_PER = 0.3;

    const sidxs = [];

    function parseCsv(file) {
        return new Q((yes, no) => {
            let output = []
            var csvStream = csv()
                .on("data", function(data) {
                    output.push(data)
                })
                .on("end", function() {
                    yes(output)
                });

            fs.createReadStream(file).pipe(csvStream);
        });
    }

    function chooseMediaRange(references, options) {
        let sIndex = Math.floor(Math.random() * references.length - 1)
        if (isNaN(sIndex) || sIndex < 0) {
            sIndex = 0
        }
        let sRef = references[sIndex]
        let eIndex = sIndex + (Math.ceil(options.duration / sRef.durationSec) - 1)
        let refs = []
        for (var i = sIndex; i <= eIndex; i++) {
            refs.push(references[i] || references[0])
        }

        return refs
    }

    function doRange(url, mediaRange, iBuffer) {
        console.log(mediaRange);
        return Range.getRange(url, mediaRange)
            .then(rangeBuffer => {
                const rBuffer = new Buffer(rangeBuffer)
                return Buffer.concat([iBuffer, rBuffer], iBuffer.length + rBuffer.length)
            })
    }

    function getSidx(options) {
        const { id } = options
        const found = _.find(sidxs, id)
        return new Q((yes, no) => {
            if (found) {
                console.log(colors.green(`CACHE SIDX ${id}`));
                console.log(`Got Cache sidx for ${id}`);
                yes(found[id])
            } else {
                yes(Interface.start(options)
                    .then(results => {
                        sidxs.push({
                            [id]: results[0]
                        })
                        if (sidxs.length > MAX_SIDX) {
                            sidxs.shift()
                        }
                        return results[0]
                    }))
            }
        })
    }

    function record(options) {
        return getSidx(options)
            .then(r => {
                const { sidx } = r
                if (!sidx) {
                    console.log(`No SIDX for ${options.id}`);
                    return null
                }
                const { references } = sidx
                const ref = references[Math.floor(references.length / 2)]

                return Range.getRange(r.url, r.indexRange)
                    .then(indexBuffer => {
                        const iBuffer = new Buffer(indexBuffer)
                        const refs = chooseMediaRange(references, options)
                        return Q.map(refs, rr => {

                            const name = `${options.id}_${rr.mediaRange}`
                            const tsFile = path.join(process.cwd(), PROJECT_P, `${name}.ts`)

                            if (fs.existsSync(tsFile)) {
                                console.log(`${tsFile} Exists`);
                                return {
                                    options: options,
                                    file: tsFile
                                }
                            }

                            return doRange(r.url, rr.mediaRange, iBuffer)
                                .then(buffer => {

                                    _handlers.gotBuffer(options.id)

                                    return writeMp4({
                                        buffer: buffer,
                                        options: options,
                                        encodeOptions: {
                                            //leave as yt dur if multiple buffers, we trim later if so
                                            duration: refs.length === 1 ? options.duration : rr.durationSec,
                                            name: `${name}.mp4`,
                                        }
                                    })
                                })
                        }, { concurrency: 1 })
                    })
            })
            .catch(err => {
                console.log(err);
            })
    }

    function toTs(mp4Path, outFile) {
        return new Q((yes, no) => {
            ffmpeg(mp4Path)
                .noAudio()
                .videoCodec('copy')
                .outputOptions('-bsf:v h264_mp4toannexb')
                .outputFormat('mpegts')
                .output(outFile)
                .on('start', (cmd) => {
                    console.log(cmd);
                })
                .on('end', () => {
                    console.log('ts finished!');
                    yes(outFile)
                })
                .on('error', err => {
                    console.log('format buffer error: ', err);
                    no()
                })
                .run();
        })
    }

    function writeMp4(obj) {
        const { buffer, encodeOptions } = obj
        const { duration, name } = encodeOptions
        return new Q((yes, no) => {
            const fileIn = `${uuid.v1()}.mp4`
            fs.writeFileSync(fileIn, buffer)

            var outFile = path.join(process.cwd(), PROJECT_P, name)
            var tsFile = path.join(process.cwd(), PROJECT_P, `${path.parse(outFile).name}.ts`)

            const returnObj = Object.assign({}, obj, { file: tsFile })
            ffmpeg(fileIn)
                .size(`${WIDTH}x${HEIGHT}`)
                .outputOptions(['-an', `-t ${duration}`])
                .output(outFile)
                .on('start', (cmd) => {
                    console.log(cmd);
                })
                .on('end', () => {
                    fs.unlinkSync(fileIn)
                    console.log('formatting finished!', outFile);
                    delete returnObj.buffer

                    ffmpeg(outFile)
                        .noAudio()
                        .videoCodec('copy')
                        .outputOptions('-bsf:v h264_mp4toannexb')
                        .outputFormat('mpegts')
                        .output(tsFile)
                        .on('start', (cmd) => {
                            console.log(cmd);
                        })
                        .on('end', () => {
                            console.log('ts finished!');

                            yes(returnObj)

                        })
                        .on('error', err => {
                            console.log('format buffer error: ', err);
                            no()
                        })
                        .run();
                })
                .on('error', err => {
                    console.log('format buffer error: ', err);
                    no()
                })
                .run();

        })
    }

    function concatVideoClips(filePath, outFile, options = []) {
        return new Q((yes, no) => {
            console.log(`Concating clips ${filePath}`);
            ffmpeg(filePath)
                .inputOptions(['-f concat'])
                .outputOptions([...['-an'], ...options])
                .output(outFile)
                .on('start', (cmd) => {
                    console.log(cmd);
                })
                .on('end', () => {
                    console.log('formatting finished!', outFile);
                    yes(outFile)
                })
                .on('error', err => {
                    console.log('format buffer error: ', err);
                    no()
                })
                .run();
        })
    }

    function muxMp4(videoFile, audioFile, outFile, options = []) {
        return new Q((yes, no) => {
            ffmpeg(audioFile)
                .inputOptions([`-i ${videoFile}`])
                .outputOptions([...['-c:v copy', '-y', '-shortest'], ...options])
                .output(outFile)
                .on('start', (cmd) => {
                    console.log(cmd);
                })
                .on('end', () => {
                    console.log('formatting finished!', outFile);
                    yes(outFile)
                })
                .on('error', err => {
                    console.log('format buffer error: ', err);
                    no()
                })
                .run();
        })
    }


    function getBeats(data, sequences, duration) {
        const beats = []
        let l = data.length
        let previousI = -1
        let i = 0
        let v = 0
        let t = 0
        let allBeats = false
        while (!allBeats) {
            const r = v % (sequences.length)
            const jump = sequences[r]
            let previous = parseFloat(data[previousI] || 0)
            let current = parseFloat(data[i])
                //how long a cut
            const d = current - previous
            t += d
            if (current) {
                beats.push(d)
            }
            v++
            previousI = i
            i += jump
            if (i > l - 1) {
                previousI = -1
                i = 0
            }
            if (t > duration) {
                allBeats = true
            }
        }
        return beats
    }

    //******************
    //?API
    //******************

    function add(INPUT_TRACK, OUTPUT, BEAT_SEQUENCES, maxClips = 10) {

        /* return TRACK.start(INPUT_TRACK)
             .then(trackObj => {
                 return CLIPS.get(maxClips)
                     .then(clipsObj => {

                         const ids = clipsObj.map(id => {
                             return { id: id, itags: ['134'] }
                         })

                         console.log(ids);

                         return parseCsv(trackObj.csv)
                             .then(results => {
                                 const times = _.flatten(results)

                                 return Q.promisify(ffmpeg.ffprobe)(`${PROJECT_P}/${INPUT_TRACK}.m4a`)
                                     .then(metadata => {
                                         console.dir(metadata);
                                         return
                                         const beats = getBeats(times, BEAT_SEQUENCES)

                                         const vos = beats.map((o, i) => {
                                             const vid = Object.assign({}, ids[(i % ids.length)])
                                             vid.duration = o
                                             return vid
                                         })


                                         return Q.map(vos, options => {
                                                 return record(options)
                                             }, { concurrency: 1 })
                                             .then(responses => {
                                                 let t = 0
                                                     //concat the clip segments
                                                 return Q.map(_.compact(responses), outs => {
                                                     const concat = outs.map(obj => {
                                                         return `file '${path.join(process.cwd(),PROJECT_P,obj.file)}'`
                                                     })
                                                     const { id, duration } = outs[0].options
                                                     const concatFile = `${id}.txt`
                                                     fs.writeFileSync(concatFile, concat.join('\n'))
                                                     fs.chmodSync(concatFile, '777')
                                                     const outFile = `${id}_${uuid.v4()}.mp4`
                                                     if (concat.length > 1) {
                                                         return concatVideoClips(concatFile, outFile, [`-t ${duration}`])
                                                             .then(mp4Path => {
                                                                 fs.unlinkSync(concatFile)
                                                                 const tsFile = path.join(process.cwd(), PROJECT_P, `${path.parse(mp4Path).name}.ts`)
                                                                 return toTs(mp4Path, tsFile)
                                                             })
                                                     } else {
                                                         return path.parse(concat[0]).base
                                                     }
                                                 })
                                             })
                                             //all the videos
                                             .then(clipFiles => {
                                                 const concat = clipFiles.map(p => {
                                                     return `file '${path.join(process.cwd(),PROJECT_P,p)}`
                                                 })
                                                 const concatFile = `${uuid.v4()}.txt`
                                                 fs.writeFileSync(concatFile, concat.join('\n'))
                                                 return concatVideoClips(concatFile, `${uuid.v4()}.mp4`, ['-c:v copy', '-bsf:a aac_adtstoasc'])
                                                     .then((outFile) => {
                                                         fs.unlinkSync(concatFile)
                                                         clipFiles.forEach(f => {
                                                             try {
                                                                 fs.unlinkSync(f)
                                                             } catch (e) {

                                                             }
                                                         })
                                                         return muxMp4(outFile, `${PROJECT_P}/${INPUT_TRACK}.m4a`, `${OUTPUT}.mp4`)
                                                     })
                                             })
                                     })
                             })
                     })
             })*/
    }


    function _groupMatchingValues(arr) {
        var hash = {};
        return arr.reduce(function(res, e) {
            if (hash[e] === undefined) // if we haven't hashed the index for this value
                hash[e] = res.push([e]) - 1; // then hash the index which is the index of the newly created array that is initialized with e
            else // if we have hashed it
                res[hash[e]].push(e); // then push e to the array at that hashed index
            return res;
        }, []);
    }

    /*

    RETURN THE options to replace old ones
    {id:..., itag:...}
    */
    function _findSidx(options, backup) {
        return new Q((yes, no) => {
            function _r(q) {
                return getSidx(q)
                    .then((d) => {
                        yes(q)
                    })
                    .catch(err => {
                        return _r(_.assign({}, options, { id: backup.pop() }))
                    })
            }
            _r(options)
        })
    }

    function _bufferSidx(ids, backup) {
        return Q.map(ids, options => {
            return _findSidx(options, backup)
        }, { concurrency: 1 })
    }

    function _getNoise(v) {
  return Math.max(Math.abs(NOISE.simplex2(v, v)), 0.1);
}


    /*
    clipBundle
    {
    desired,
    backup
    }
    */
    function addFromClipIds(INPUT_TRACK, OUTPUT, BEAT_SEQUENCES, clipBundle) {
        //clear
        sidx = []

        return TRACK.start(INPUT_TRACK)
            .then(trackObj => {
                const { desired, backup } = clipBundle

                //640x
                let ids = desired.map(id => {
                    return { id: id, itags: ['134'] }
                })

                return _bufferSidx(ids, backup)
                    .then((newIds) => {
                        //replace
                        ids = newIds

                        return parseCsv(trackObj.csv)
                            .then(results => {

                                return Q.promisify(ffmpeg.ffprobe)(`${PROJECT_P}/${INPUT_TRACK}.m4a`)
                                    .then(metadata => {
                                        NOISE.seed(Math.random());

                                        const times = _.flatten(results)
                                            //loop over the sequence and return durations for each cut
                                        const beats = getBeats(times, BEAT_SEQUENCES, metadata.streams[0].duration)
                                        const groupedVideoIndexs = _groupMatchingValues(beats.map((b, i) => ((i % ids.length))))
                                        const lookAhead = Math.floor(VIDEO_LOOK_AHEAD * groupedVideoIndexs.length)
                                        const idsOrders = []
                                        while(idsOrders.length < beats.length){
                                            const n = _getNoise(idsOrders.length + 1)
                                            //console.log("idsOrders.length",idsOrders.length);
                                            //console.log("noise",n);
                                            for (var i = lookAhead - 1; i >= 0; i--) {
                                                //console.log("n > i / lookAhead",n , i / lookAhead, i);
                                                if(n > i / lookAhead){
                                                    for (var k = i; k > -1; k--) {
                                                        if(groupedVideoIndexs[k]){
                                                        //console.log("groupedVideoIndexs[k].length",groupedVideoIndexs[k].length,"at ", k);
                                                            if(groupedVideoIndexs[k].length){
                                                                idsOrders.push(groupedVideoIndexs[k].shift())
                                                                break;
                                                            }else{
                                                                groupedVideoIndexs.splice(k,1)
                                                            }
                                                        }
                                                    }
                                                    break;
                                                }
                                            }
                                        }

                                        const vos = idsOrders.map((o,i) => {
                                            const vid = Object.assign({}, ids[o])
                                            vid.duration = beats[i]
                                            return vid
                                        })

                                        console.log(vos);
                                        return Q.map(vos, options => {
                                                return record(options)
                                            }, { concurrency: 1 })
                                            .then(responses => {
                                                let _count = 0
                                                    //concat the clip segments
                                                responses = _.compact(responses)
                                                return Q.map(responses, outs => {
                                                        //concat wants the file relative to the .txt
                                                        const concat = outs.map(obj => {
                                                            console.log(colors.yellow(`${path.parse(obj.file).base}`));
                                                            return `file '${path.parse(obj.file).base}'`
                                                        })

                                                        const { id, duration } = outs[0].options
                                                            //save the concat
                                                        const concatFile = path.join(process.cwd(), PROJECT_P, `${uuid.v4()}.txt`)
                                                        fs.writeFileSync(concatFile, concat.join('\n'))
                                                        fs.chmodSync(concatFile, '777')
                                                            //the output
                                                        const outFile = path.join(process.cwd(), PROJECT_P, `${uuid.v4()}.mp4`)
                                                        if (concat.length > 1) {
                                                            console.log(colors.green(`Concating ${_count} to ${path.parse(outFile).base}`));
                                                            return concatVideoClips(concatFile, outFile, [`-t ${duration}`])
                                                                //mp4Path = outFile
                                                                .then(mp4Path => {
                                                                    console.log(colors.green(`Concated mp4 ${path.parse(tsFile).base}`));
                                                                    fs.unlinkSync(concatFile)
                                                                    const tsFile = path.join(process.cwd(), PROJECT_P, `${path.parse(mp4Path).name}.ts`)
                                                                        //convert to ts
                                                                    return toTs(mp4Path, tsFile)
                                                                        .then(tsFile => {
                                                                            _count++
                                                                            console.log(colors.green(`Concated ts ${path.parse(tsFile).base} ${_count}/${responses.length}`));
                                                                            return tsFile
                                                                        })
                                                                })
                                                        } else {
                                                            return Q.resolve(outs[0].file)
                                                        }
                                                    })
                                                    .catch(err => {
                                                        console.log(colors.red(`Error on clip concat handled`));
                                                        return null
                                                    })
                                            }, { concurrency: 1 })
                                            //all the videos
                                            .then(clipFiles => {
                                                const concat = _.compact(clipFiles).map(p => {
                                                    return `file '${path.parse(p).base}`
                                                })
                                                const concatFile = `${PROJECT_P}/${uuid.v4()}.txt`
                                                fs.writeFileSync(concatFile, concat.join('\n'))
                                                return concatVideoClips(concatFile, `${PROJECT_P}${uuid.v4()}_final.mp4`, ['-c:v copy', '-bsf:a aac_adtstoasc'])
                                                    .then((outFile) => {
                                                        fs.unlinkSync(concatFile)
                                                        clipFiles.forEach(f => {
                                                            try {
                                                                fs.unlinkSync(f)
                                                            } catch (e) {

                                                            }
                                                        })

                                                        return muxMp4(outFile, `${PROJECT_P}/${INPUT_TRACK}.m4a`, `${OUTPUT}.mp4`)
                                                    })
                                            })
                                            .catch(err => {
                                                console.log(colors.red("Big err"));
                                            })

                                    })
                            })
                    })
            })


    }


    function setHandlers(handlers) {
        _handlers = handlers
    }

    return {
        add: add,
        addFromClipIds: addFromClipIds,
        setHandlers: setHandlers
    }


})()

module.exports = APP
