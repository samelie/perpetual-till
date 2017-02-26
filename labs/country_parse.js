var fs = require('fs');
var Redis = require('@samelie/chewb-redis');
var readline = require('readline');

var fs = require('fs')
    , util = require('util')
    , stream = require('stream')
    , es = require('event-stream');

var lineNr = 0;

const R =  new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || '6379',
}, true)

const COUNTRIES = 'worldcitiespop.txt'

var s = fs.createReadStream(COUNTRIES)
    .pipe(es.split())
    .pipe(es.mapSync(function(line){

        // pause the readstream
        s.pause();
        lineNr += 1;

        const split = line.split(',');
        const country = split[0].toUpperCase()

        R.rpush(`perpetual-till:geocode:${split[0]}`,`${split[5]},${split[6]}`)
        .then(()=>(s.resume()))
    })
    .on('error', function(){
        console.log('Error while reading file.');
    })
    .on('end', function(){
        fs.unlinkSync(COUNTRIES)
        console.log('Read entire file.')
        process.exit()
    })
);
