var getCount = require('../get-sbol').getCount

var pug = require('pug')

module.exports = function(req, res) {

    getCount(req.params.type, [null]).then((result) => {

	res.header('content-type', 'text/plain').send(result[0].count.toString())

    }).catch((err) => {

        locals = {
            section: 'errors',
            user: req.user,
            errors: [ err ]
        }
        res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
        return        

    })

}
