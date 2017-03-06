var getCollectionMetaData = require('../get-sbol').getCollectionMetaData

var loadTemplate = require('../loadTemplate')

var pug = require('pug')

var retrieveCitations = require('../citations');

var fs = require('fs');

var async = require('async');

var SBOLDocument = require('sboljs')

var extend = require('xtend')

var uuid = require('node-uuid');

var serializeSBOL = require('../serializeSBOL')

var request = require('request')

var config = require('../config')

var sparql = require('../sparql/sparql')

const prepareSubmission = require('../prepare-submission')

const multiparty = require('multiparty')

module.exports = function(req, res) {

    if(req.method === 'POST') {

        submitPost(req, res)

    } else {

        submitForm(req, res, {}, {})

    }
}

function submitForm(req, res, submissionData, locals) {
	
    submissionData = extend({
        id: '',
        version: '1',
        name: '',
        description: '',
        citations: '', // comma separated pubmed IDs
        keywords: '',
        overwrite_merge: '0',
        //createdBy: req.url==='/remoteSubmit'?JSON.parse(req.body.user):req.user,
        createdBy: req.user,
        file: ''
    }, submissionData)

	locals = extend({
        config: config.get(),
        section: 'submit',
        user: req.user,
        submission: submissionData,
        errors: []
    }, locals)

    res.send(pug.renderFile('templates/views/submit.jade', locals))
}
	

function submitPost(req, res) {

    const form = new multiparty.Form()

    form.on('error', (err) => {
        res.status(500).send(err)
    })

    form.parse(req, (err, fields, files) => {

        if(err) {
            res.status(500).send(err.stack)
            return
        }

        const submissionData = {
            id: (fields.id[0] || '').trim(),
            version: (fields.version[0] || '1').trim(),
            name: (fields.name[0] || '').trim(),
            description: (fields.description[0] || '').trim(),
            citations: fields.citations[0] || '', // comma separated pubmed IDs
            keywords: fields.keywords[0] || '',
            overwrite_merge: fields.overwrite_merge[0] || '0',
            createdBy: req.url==='/remoteSubmit'?JSON.parse(fields.user[0]):req.user
        }

        var errors = []

        if(submissionData.createdBy === undefined) {
            errors.push('Must be logged in to submit')
        }

        if(submissionData.id === '') {
            errors.push('Please enter an id for your submission')
        }

        if(submissionData.version === '') {
            errors.push('Please enter a version for your submission')
        }

        if(submissionData.name === '') {
            errors.push('Please enter a name for your submission')
        }

        if(submissionData.description === '') {
            errors.push('Please enter a brief description for your submission')
        }

        if(errors.length > 0) {
            if (req.url==='/remoteSubmit') {
                res.status(500).type('text/plain').send(errors)			
                return
            } else {
                return submitForm(req, res, submissionData, {
                    errors: errors
                })
            }
        }

        if(submissionData.citations) {
            submissionData.citations = submissionData.citations.split(',').map(function(pubmedID) {
                return pubmedID.trim();
            }).filter(function(pubmedID) {
                return pubmedID !== '';
            });
        } else {
            submissionData.citations = []
        }

        var graphUris
        var uri

        graphUris = [
            submissionData.createdBy.graphUri
        ]

        uri = config.get('databasePrefix') + 'user/' + encodeURIComponent(submissionData.createdBy.username) + '/' + submissionData.id + '/' + submissionData.id + '_collection' + '/' + submissionData.version

        getCollectionMetaData(uri, graphUris).then((result) => {

            if(!result) {
                console.log('not found')
                return doSubmission()
            }

            const graphUri = result.graphUri
            const metaData = result.metaData

            if (submissionData.overwrite_merge === '2') {

                // Merge
                console.log('merge')
                submissionData.name = metaData.name || ''
                submissionData.description = metaData.description || ''

                return doSubmissionNew()

            } else if (submissionData.overwrite_merge === '1') {
                // Overwrite
                console.log('overwrite')
                uriPrefix = uri.substring(0,uri.lastIndexOf('/'))
                uriPrefix = uriPrefix.substring(0,uriPrefix.lastIndexOf('/')+1)

                var templateParams = {
                    uriPrefix: uriPrefix,
                    version: submissionData.version
                }
                console.log('removing ' + templateParams.uriPrefix)
                var removeQuery = loadTemplate('sparql/remove.sparql', templateParams)
                console.log(removeQuery)

                return sparql.queryJson(removeQuery, graphUri).then(doSubmission)

            } else {

                // Prevent make public
                console.log('prevent')

                if (req.url==='/remoteSubmit') {
                    console.log('prevent')
                    res.status(500).type('text/plain').send('Submission id and version already in use')                 
                    return
                } else {
                    errors.push('Submission id and version already in use')

                    submitForm(req, res, submissionData, {
                        errors: errors
                    })
                }
            }

        }).catch((err) => {

            if (req.url==='/remoteSubmit') {
                res.status(500).type('text/plain').send(err.stack)
            } else {
                const locals = {
                    config: config.get(),
                    section: 'errors',
                    user: req.user,
                    errors: [ err.stack ]
                }
                res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
            }

        })

        function doSubmissionNew() {
            var xml = req.url==='/remoteSubmit'?req.body.file.toString('utf8'):req.file.buffer.toString('utf8')
            console.log(xml)
            if (req.url==='/remoteSubmit') {
                res.status(200).type('text/plain').send('Successfully uploaded')
            } else {
                res.redirect('/manage')
            }
        }

        function doSubmission() {

            console.log('-- validating/converting');

            const tmpFilename = files.file[0].path

            console.log('tmpFilename is ' + tmpFilename)

            return prepareSubmission(tmpFilename, {

                uriPrefix: config.get('databasePrefix') + 'user/' + encodeURIComponent(submissionData.createdBy.username) + '/' + submissionData.id + '/',

                name: submissionData.name,
                description: submissionData.description,
                version: submissionData.version,

                keywords: submissionData.keywords.split(',')
                    .map((keyword) => keyword.trim())
                    .filter((keyword) => keyword !== ''),

                newRootCollectionDisplayId: submissionData.id + '_collection',
                ownedByURI: config.get('databasePrefix') + 'user/' + submissionData.createdBy.username,
                creatorName: submissionData.createdBy.name,
                citationPubmedIDs: submissionData.citations

            }).then((result) => {

                const { success, log, errorLog, resultFilename } = result

                if(!success) {

                    if (req.url==='/remoteSubmit') {
                        res.status(500).type('text/plain').send(errorLog)			
                        return        
                    } else {

                        const locals = {
                            config: config.get(),
                            section: 'invalid',
                            user: req.user,
                            errors: [ errorLog ]
                        }

                        res.send(pug.renderFile('templates/views/errors/invalid.jade', locals))

                        return
                    }
                }

                console.log('uploading sbol...');

                if (req.url==='/remoteSubmit') {
                    return sparql.uploadFile(submissionData.createdBy.graphUri, resultFilename, 'application/rdf+xml').then(() => {
                        res.status(200).type('text/plain').send('Successfully uploaded')
                    })
                } else {
                    return sparql.uploadFile(submissionData.createdBy.graphUri, resultFilename, 'application/rdf+xml').then((result) => {

                        res.redirect('/manage')

                    })
                }

            })

        }
    })
}




