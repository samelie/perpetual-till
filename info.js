const Youtube = require("youtube-api")
var Q = require('bluebird');

const INFO = (() => {

  Youtube.authenticate({
    type: "key",
    key: process.env.YOUTUBE_API_KEY
  });

  function info(id) {
    return new Q((yes, no) => {
      Youtube.videos.list({
        part: 'snippet',
        id: id
      }, (err,data)=>{
        yes(data.items)
      })
    })
  }

  return {
    info: info
  }
})()

module.exports = INFO