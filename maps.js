var fs = require('fs');
var Q = require('bluebird');
const Maps = (() => {

  const googleMapsClient = require('@google/maps').createClient({
    key: process.env.GOOGLE_API_KEY
  });

  function directions(options = {}) {
    return new Q((yes,no)=>{
      googleMapsClient.directions({
        origin:options.origin,
        destination:options.destination,
        avoid:'highways',
      }, function(err, response) {
        if (!err) {
          if(response.json.routes.length){
            yes(response.json.routes[0])
          }else{
            no()
          }
        }else{
          no()
        }
      });
    })
  }

  return {
    directions: directions
  }


})()

module.exports = Maps
