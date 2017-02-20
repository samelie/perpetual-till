var express = require('express');
var cors = require('cors')
var bodyParser = require('body-parser');

class Server {
    constructor(router) {

        var server, routes;
        this.app = express();


        this.app.use(cors())

        this.app.use(bodyParser.urlencoded({
            extended: true
        }));
        this.app.use(bodyParser.json());

        let _port = process.env.EXPRESS_PORT || 8080
        let _host = process.env.SERVER_HOST || '127.0.0.1'
        console.log(_host, _port);
        var server = this.app.listen(_port)

        this.server = server

        this.app.use(router)


        this.port = _port
        this.host = _host
    }
}

module.exports = Server


