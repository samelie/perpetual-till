require('dotenv').config({ path: './envvars' });
const Youtube = require("youtube-api")
var Q = require('bluebird');
var _ = require('lodash');

const CLIPS = (() => {


  const RADIUS = ['5km', '10km', '100km']
  const QUERIES = ['.flv', '.wmv', '.avi', '.mov', '.mp4']

  function _query(location, locationRadius, q) {
    return new Q((yes, no) => {
      Youtube.search.list({
        part: 'snippet',
        maxResults: 50,
        type: 'video',
        locationRadius: locationRadius,
        location: `${location.lat}, ${location.lng}`,
        q: q
      }, (err, data) => {
        if (err) {
          yes(null)
        }
        if(!data){
          yes(null)
        }else{
          if (!data.items.length) {
            yes(null)
          } else {
            const r = _.compact(_.shuffle(data.items).map(obj => (obj.id.videoId)))
            yes(r)
          }
        }
      })
    })
  }

  function _queryLocation(coord) {
    return new Q((yes, no) => {
      let qI = 0
      let rI = 0

      function _r(qI, rI) {
        console.log(coord, RADIUS[rI], QUERIES[qI]);
        _query(coord, RADIUS[rI], QUERIES[qI])
          .then(r => {
            if (r) {
              yes(r)
            } else {
              if (qI % QUERIES.length) {
                rI = (rI + 1) % RADIUS.length
              }
              qI = (qI + 1) % QUERIES.length
              _r(qI, rI, coord)
            }
          })
      }

      _r(qI, rI)

    })
  }

  function findCoords(coords, maxVideos) {
    return new Q((yes, no) => {

      let found = 0
      let i = 0
      let ids = []

      function _f(coord) {
        return _queryLocation(coords[i])
          .then(r => {
            i++
            if (r) {
              ids.push(r)
              found++
              console.log(`Found ${found}/${maxVideos}`);
              if (found >= maxVideos) {
                return yes(ids)
              }
              _f(coords[i])
            } else {
              _f(coords[i])
            }
          })
      }

      _f(coords[i])

    })
  }

  return {
    findCoords: findCoords
  }
})()

module.exports = CLIPS
