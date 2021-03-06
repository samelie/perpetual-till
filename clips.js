require('dotenv').config({ path: './envvars' });
const Youtube = require("youtube-api")
var Q = require('bluebird');
var _ = require('lodash');

const CLIPS = (() => {

  const CHARS = process.env.CHARS || 3

  const EXT = ['flv', 'mov', 'avi', 'mp4', 'wmv']

  Youtube.authenticate({
    type: "key",
    key: process.env.YOUTUBE_API_KEY
  });


  const LANGS = [
    [0x0020, 0x007F], //latin:
    [0x0590, 0x05FF], //hebrew:
    [0x0400, 0x04FF], //cyrillic:
    [0x0700, 0x074F], //syric:
    [0x0370, 0x03FF], //greek:
    [0x0600, 0x06FF], //arabic:
    [0x0980, 0x09FF] //bengali:
    [0x4E00, 0x9FFF], //east asia:
    [0x0900, 0x097F], //bengali:
    [0x0A00, 0x0A7F], //bengali:
    [0x0E00, 0x0E00], //bengali:
    [0x3040, 0x309f], //Hiragana:
    [0x30a0, 0x30ff] //Katakana:
  ]

  const char = (lang) => (String.fromCharCode(lang[0] + Math.random() * (lang[1])))
  const ext = () => (EXT[Math.floor(Math.random() * EXT.length)])
  const lang = () => {
    let lang = undefined;

      while (!lang) {
        lang = LANGS[Math.floor(Math.random() * LANGS.length)]
      }
      console.log("Got lang", lang);

      return lang
  }

  function _recursive() {

    return new Q((yes, no) => {

      function __r() {
        console.log("Getting chars");
        const chars = new Array(CHARS).fill(0).map((v, i) => (char(lang()))).join('')
        console.log(chars);
        Youtube.search.list({
          part: 'snippet',
          maxResults: 50,
          type: 'videos',
          q: `${chars} ${ext()}`
        }, (err, data) => {
          if (err) {
            console.log(err);
            no(err)
          }
          console.log(data.items.length);
          if (!data.items.length) {
            __r()
          } else {
            const r = _.compact(_.shuffle(data.items).map(obj => (obj.id.videoId)))
            console.log(r);
            yes(r)
          }
        })
      }

      __r()
    })
  }

  function _find(howMany) {

    const arr = new Array(howMany).fill(0).map((v, i) => (i))

    return Q.map(arr, v => {
        return _recursive()
        .then(r=>{
          console.log(r);
          return r
        })
      })
      .then(results => {
        let videoIds = []
        let incre = 0

        while (videoIds.length < howMany) {
          let resultsSrc = results[incre]
          if (resultsSrc[0]) {
            videoIds.push(resultsSrc.shift())
          }
          incre += 1
          incre = incre % results.length
        }
        console.log(videoIds);
        return videoIds
      },{concurrency:1})
  }

  function get(howMany = 10) {
    return _find(howMany)
  }

  function location(lat,lng){

  }

  return {
    get: get,
    location:location
  }
})()

module.exports = CLIPS
