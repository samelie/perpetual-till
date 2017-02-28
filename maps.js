var fs = require('fs');
var _ = require('lodash');
var Q = require('bluebird');
const Maps = (() => {

  const googleMapsClient = require('@google/maps').createClient({
    key: process.env.GOOGLE_API_KEY
  });

  const DATA = JSON.parse(fs.readFileSync('labs/countries.json'))
  const { continents, countries } = DATA
  delete continents['AN']
  const countryMap = Object.keys(countries).map(code => ({ code: code.toLowerCase(), continent: countries[code].continent }))

  function _redisQ(REDIS, country) {
    return REDIS.lrange(`perpetual-till:geocode:${country}`, 0, -1)
  }

  function _chooseStartEnd(REDIS) {
    const _v = _.values(continents);
    const _r = Math.floor(Math.random() * _v.length);
    const continentKey = _.keys(continents)[_r];
    const countriez = _.shuffle([...(_.values(_.filter(countryMap, { continent: continentKey })))]);
    const start = countriez.shift()
    const end = countriez.shift()
    return Q.all([_redisQ(REDIS, start.code), _redisQ(REDIS, end.code)])
  }

  function chooseRoute(REDIS) {

    return _chooseStartEnd(REDIS)
      .then(r => {
        const s = r[0][_.random(0, r[0].length, false)]
        const e = r[1][_.random(0, r[1].length, false)]
        return directions({origin:s, destination:e})
        .catch(err=>{
          console.log("Err");
          return chooseRoute(REDIS)
        })
      })
  }

  function directions(options = {}) {
    console.log(options);
    return new Q((yes, no) => {
      googleMapsClient.directions({
        origin: options.origin,
        destination: options.destination,
        avoid: 'highways',
      }, function(err, response) {
        if (!err) {
          if (response.json.routes.length) {
            yes(response.json.routes[0])
          } else {
            no()
          }
        } else {
          no(err)
        }
      });
    })
  }

  return {
    chooseRoute: chooseRoute,
    directions: directions
  }


})()

module.exports = Maps
