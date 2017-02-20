const io = require('socket.io');
const fs = require('fs');
const uuid = require('uuid');
const path = require('path');
const _ = require('lodash');
const request = require('request');
var Q = require('bluebird');
var REDIS = require('./redis');

const generateError = (msg, options = {}) => {
  return _.assign({}, { error: true, message: msg }, options)
}

const emit = (userSocket, key, value) => {
  if (userSocket) {
    userSocket.emit(key, value)
  }
}

const SOCKET = function(express) {

  var users = {};
  var ids = [];

  const IO = io(express, { path: '/perpetual-till-api' }).listen(express);
  IO.on('connection', userConnected);

  function userConnected(socket) {

    ids.push(socket.id);
    users[socket.id] = socket;

    users[socket.id].on('perpetual-till:getlatest', () => {
      REDIS.smembers(`${process.env.REDIS_PROJECT}:uploads`)
        .then(data => {
          emit(users[socket.id], 'perpetual-till:getlatest:resp', data)
        })
    })

    //*********
    //*********

    users[socket.id].onDisconnect = () => {
      _.forIn(users[socket.id]._events, (func, key) => {
        socket.removeListener(key, func)
      })
      let _i = ids.indexOf(socket.id)
      ids.splice(_i, 1)
      users[socket.id] = null
      delete users[socket.id]
      console.log(`Disconnected ${socket.id}`);
    }

    socket.once('disconnect', users[socket.id].onDisconnect)

    socket.emit('handshake', {
      index: ids.length - 1,
      id: socket.id,
    });

    console.log("Connection: ", socket.id, 'at: ');
  }

  function videoEncoded(id) {
    IO.sockets.emit('perpetual-till:videoencoded', id)
  }

  function emitAll(str, data) {
    IO.sockets.emit(`perpetual-till:${str}`, data)
  }

  return {
    videoEncoded: videoEncoded,
    emitAll: emitAll
  }
};

module.exports = SOCKET;
