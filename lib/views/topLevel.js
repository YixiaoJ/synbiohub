var getType = require('../get-sbol').getType

var async = require('async')

var config = require('../config')

var collection = require('./collection')

var componentDefinition = require('./componentDefinition')

var moduleDefinition = require('./moduleDefinition')

var sequence = require('./sequence')

var model = require('./model')

var attachment = require('./attachment')

var genericTopLevel = require('./genericTopLevel')

var pug = require('pug')

var getUrisFromReq = require('../getUrisFromReq')

module.exports = function(req, res) {

	const { graphUris, uri, designId } = getUrisFromReq(req)

    getType(uri, graphUris).then((result) => {

        if(result[0] && result[0].type==='http://sbols.org/v2#Collection') {
            collection(req, res)
            return
        } else if(result[0] && result[0].type==='http://sbols.org/v2#ComponentDefinition') { 
            componentDefinition(req, res)
            return
        } else if(result[0] && result[0].type==='http://sbols.org/v2#ModuleDefinition') { 
            moduleDefinition(req, res)
            return
        } else if(result[0] && result[0].type==='http://sbols.org/v2#Sequence') { 
            sequence(req, res)
            return
        } else if(result[0] && result[0].type==='http://sbols.org/v2#Model') { 
            model(req, res)
            return
        } else if(result[0] && result[0].type==='http://wiki.synbiohub.org/wiki/Terms/synbiohub#Attachment') { 
            attachment(req, res)
            return
        } else {
            genericTopLevel(req, res)
            return
        }

    }).catch((err) => {

        var locals = {
            config: config.get(),
            section: 'errors',
            user: req.user,
            errors: [ err.stack ]
        }
        res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
        
    })
	
};


