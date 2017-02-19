var fs = require('fs');
var path = require('path');

var ROUTES = function(router) {

    //*********************
    //POST
    //*********************

    router.get('/churn', function(req, res, next) {
        res.send({code:200})
    });

    ////////////////////////
    //PUBLIC
    ////////////////////////

};

module.exports = ROUTES;
