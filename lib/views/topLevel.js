var getType = require('../get-sbol').getType

var async = require('async')

var config = require('../config')

var collection = require('./collection')

var component = require('./component')

module.exports = function(req, res) {

    var stack = require('../stack')()
    var designId
    var uri
    
    async.series([

        function getTopLevel(next) {
	    if(req.params.userId) {
		designId = req.params.collectionId + '/' + req.params.displayId + '/' + req.params.version
		uri = config.get('databasePrefix') + 'user/' + encodeURIComponent(req.params.userId) + '/' + designId
	    } else {
		designId = req.params.collectionId + '/' + req.params.displayId + '/' + req.params.version
		uri = config.get('databasePrefix') + 'public/' + designId
	    } 
	    console.log(uri)

            var stores = [
                stack.getDefaultStore()
            ]

            if(req.userStore)
                stores.push(req.userStore)

            getType(uri, stores, function(err, result) {

                if(err) {

                    res.status(500).send(err)

                } else {

                    if(result[0] && result[0].type==='http://sbols.org/v2#Collection') {
			collection(req, res)
			return
                    } else if(result[0] && result[0].type==='http://sbols.org/v2#ComponentDefinition') { 
			component(req, res)
			return
                    } else {
			res.status(500).send(err)
		    }

		}
            })

        }

    ], function done(err) {

            res.status(500).send(err)
                
    })
	
};

