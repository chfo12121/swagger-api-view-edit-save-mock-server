var fs = require('fs')
var express = require('express')
var bodyParser = require('body-parser')
var yaml = require('js-yaml')
var Swagmock = require('swagmock')
var specDirectory = 'api-spec'
var port = ~~process.argv[2] || 8080

express()
    .use(express.static(`${__dirname}/public`))
    .put('/catalogue.json', bodyParser.json({type: () => true}), function (req, res, next) {
        fs.writeFile(`${__dirname}/public/catalogue.json`, JSON.stringify(req.body, null, '\t'), err => {
            if (err) return res.end(err + '')
            res.end('ok')
        })
    })
    .put('*', bodyParser.raw({type: () => true}), function (req, res, next) {
        fs.readFile(`${__dirname}/public/catalogue.json`, 'utf8', (err, data) => {
            if (err) return res.end(err + '')
            try {
                if ((search => JSON.parse(data).find(specFile => specFile.path == search))(decodeURI(req.path).replace(RegExp(`^\/${specDirectory}\/`), ''))) {
                    console.log(req.body + '')
                    return fs.open(`${__dirname}/public${decodeURI(req.path)}`, 'w', (err, fd) => {
                        if (err) return res.end(err + '')
                        fs.write(fd, req.body, err => {
                            if (err) return res.end(err + '')
                            fs.close(fd, err => {
                                if (err) return res.end(err + '')
                                res.end('ok')
                            })
                        })
                    })
                }
            }
            catch (e) {
                return res.end(e + '')
            }
            next()
        })
    })
    .use(function (req, res, next) {
        fs.readFile(`${__dirname}/public/catalogue.json`, 'utf8', (err, data) => {
            if (err) return res.end(err + '')
            try {
                var catalogue = JSON.parse(data)
            }
            catch (e) {
                return res.end(e + '')
            }
            var reqPathSegments = req.path.split('/')
            ~function (sent) {
                Promise.all(catalogue.map(specFile => new Promise(resolve => {
                    fs.readFile(`${__dirname}/public/${specDirectory}/${specFile.path}`, 'utf8', (err, data) => {
                        if (err) return res.end((sent = err) + '')
                        if (sent) return resolve()
                        try {
                            var spec = yaml.safeLoad(data)
                        }
                        catch (e) {
                            return res.end((sent = e) + '')
                        }
                        Object.keys(spec.paths).find(path => {
                            if (
                                ((apiPathSegments) => {
                                    return apiPathSegments.length == reqPathSegments.length && apiPathSegments.every((segment, i) => {
                                        return segment == reqPathSegments[i] || segment[0] == '{'
                                    })
                                })(path.split('/'))
                            ) {
                                Swagmock(spec).responses({
                                    path: path,
                                    operation: req.method.toLowerCase(),
                                    response: 200,
                                }, function (err, mock) {
                                    if (err) return res.end((sent = err) + '')
                                    res.json(mock.responses)
                                })
                                return sent = true
                            }
                        })
                        resolve()
                    })
                }))).then(() => {
                    if (!sent) {
                        next()
                    }
                })
            }()
        })
    })
    .listen(port, function () {
        console.log(`*listening port: ${port}*`)
    })
