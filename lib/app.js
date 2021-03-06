
var express = require('express')

var session = require('express-session')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
var multer = require('multer')

var lessMiddleware = require('less-middleware')
var browserifyMiddleware = require('browserify-middleware')

var config = require('./config')

var SequelizeStore = require('connect-sequelize')(session)

const db = require('./db')

const initSSE = require('./sse').initSSE

var cache = require('./cache')

var views = {
    index: require('./views/index'),
    about: require('./views/about'),
    browse: require('./views/browse'),
    login: require('./views/login'),
    logout: require('./views/logout'),
    register: require('./views/register'),
    resetPassword: require('./views/resetPassword'),
    profile: require('./views/profile'),
    search: require('./views/search'),
    advancedSearch: require('./views/advancedSearch'),
    submit: require('./views/submit'),
    manage: require('./views/manage'),
    topLevel: require('./views/topLevel'),
    setup: require('./views/setup'),
    dataIntegration: require('./views/dataIntegration'),
    jobs: require('./views/jobs'),
    sparql: require('./views/sparql'),
    admin: {
        status: require('./views/admin/status'),
        graphs: require('./views/admin/graphs'),
        sparql: require('./views/admin/sparql'),
        users: require('./views/admin/users'),
        update: require('./views/admin/update'),
        jobs: require('./views/admin/jobs'),
        theme: require('./views/admin/theme'),
    }
}

var api = {
    search: require('./api/search'),
    sbolTopLevel: require('./api/sbolTopLevel'),
    summary: require('./api/summary'),
    fasta: require('./api/fasta'),
    genBank: require('./api/genBank'),
    autocomplete: require('./api/autocomplete'),
    count: require('./api/count'),
    rootCollections: require('./api/rootCollections'),
    subCollections: require('./api/subCollections'),
    download: require('./api/download')
}

var actions = {
    makePublic: require('./actions/makePublic'),
    makeTopLevelPublic: require('./actions/makeTopLevelPublic'),
    removeSubmission: require('./actions/removeSubmission'),
    cloneSubmission: require('./actions/cloneSubmission'),
    resetPassword: require('./actions/resetPassword'),
    setNewPassword: require('./actions/setNewPassword'),
    remove: require('./actions/remove'),
    updateMutableDescription: require('./actions/updateMutableDescription'),
    updateMutableNotes: require('./actions/updateMutableNotes'),
    updateMutableSource: require('./actions/updateMutableSource'),
    updateCitations: require('./actions/updateCitations'),
    cancelJob: require('./actions/cancelJob'),
    restartJob: require('./actions/restartJob'),
    upload: require('./actions/upload')
}

function App() {
    
    var app = express()

    app.get('/bundle.js', browserifyMiddleware(__dirname + '/../browser/synbiohub.js'))


	app.use(lessMiddleware('public', { /*once: true*/ }))

    app.use(express.static('public'))

    app.use(cookieParser())

    app.use(session({
        secret: config.get('sessionSecret'),
        resave: false,
        saveUninitialized: false,
        store: new SequelizeStore(db.sequelize, {}, 'Session')
    }))

    app.use(bodyParser.urlencoded({
        extended: true
    }))

    app.use(bodyParser.json())

    app.use(function(req, res, next) {

        if(req.url !== '/setup' && config.get('firstLaunch') === true) {

            console.log('redirecting')

            res.redirect('/setup')

        } else {

            next()

        }
    })

    app.use(function(req, res, next) {

        var userID = req.session.user

        if(userID !== undefined) {

            db.model.User.findById(userID).then((user) => {

                req.user = user

                next()
            })

        } else {

            next()

        }

    })

    var uploadToMemory = multer({
        storage: multer.memoryStorage({})
    })

    initSSE(app)

    if(config.get('experimental').dataIntegration) {
        app.get('/jobs', requireUser, views.jobs)
        app.post('/actions/job/cancel', requireUser, actions.cancelJob)
        app.post('/actions/job/restart', requireUser, actions.restartJob)
        app.get('/admin/jobs', requireAdmin, views.admin.jobs);
        app.all('/user/:userId/:collectionId/:displayId/:version([^\\.]+)/integrate', requireUser, views.dataIntegration);
        app.all('/public/:collectionId/:displayId/:version([^\\.]+)/integrate', views.dataIntegration);
    }

	app.get('/', views.index);
	app.get('/about', views.about);

	app.all('/setup', views.setup);

    app.all('/browse', views.browse);

    app.all('/login', views.login);
    app.post('/remoteLogin', views.login);
    app.all('/logout', views.logout);
    app.all('/register', views.register);
    app.all('/resetPassword/token/:token', actions.resetPassword);
    app.all('/resetPassword', views.resetPassword);
    app.post('/setNewPassword', actions.setNewPassword);
    app.post('/updateMutableDescription', requireUser, actions.updateMutableDescription);
    app.post('/updateMutableNotes', requireUser, actions.updateMutableNotes);
    app.post('/updateMutableSource', requireUser, actions.updateMutableSource);
    app.post('/updateCitations', requireUser, actions.updateCitations);

    app.get('/submit/', requireUser, views.submit);
    app.post('/submit/', requireUser, views.submit);
    app.post('/remoteSubmit/', /*requireUser,*/ views.submit);

    app.get('/autocomplete/:query', api.autocomplete)
    app.get('/manage', requireUser, views.manage);

    app.get('/admin', requireAdmin, views.admin.status);
    app.get('/admin/graphs', requireAdmin, views.admin.graphs);
    app.get('/admin/sparql', requireAdmin, views.admin.sparql);
    app.get('/admin/users', requireAdmin, views.admin.users);
    app.get('/admin/update', requireAdmin, views.admin.update);
    app.get('/admin/theme', requireAdmin, views.admin.theme);
    app.post('/admin/theme', requireAdmin, bodyParser.urlencoded({ extended: true }), views.admin.theme);

    app.get('/search/:query?', views.search);
    app.get('/remoteSearch/:query?', views.search);
    app.get('/advancedSearch', views.advancedSearch);
    app.post('/advancedSearch', views.advancedSearch);
    app.get('/advancedSearch/:query?', views.search);

    app.get('/:type/count', api.count)
    app.get('/rootCollections', api.rootCollections)

    app.get('/public/:collectionId/:displayId/:version/removeSubmission', requireUser, actions.removeSubmission);
    app.get('/public/:collectionId(*)/:displayId/:version/subCollections', api.subCollections);
    app.post('/public/:collectionId/:displayId/:version/attach', requireUser, actions.upload);
    
    app.get('/public/:collectionId(*)/:displayId/search/:query?', views.search);
    app.get('/public/:collectionId/:displayId/:version/search/:query?', views.search);
    app.get('/public/:collectionId/:displayId/:version/uses', views.search);
    app.get('/public/:collectionId/:displayId/:version/twins', views.search);
    app.get('/public/:collectionId/:displayId/:version/download', api.download);
    app.get('/public/:collectionId(*)/:displayId/:version/sbol', api.sbolTopLevel);
    app.get('/public/:collectionId(*)/:displayId/:version/:filename.xml', api.sbolTopLevel);
    app.get('/public/:collectionId(*)/:displayId/:version/:filename.json', api.summary);
    app.get('/public/:collectionId(*)/:displayId/:version/:filename.fasta', api.fasta);
    app.get('/public/:collectionId(*)/:displayId/:version/:filename.gb', api.genBank);
    app.get('/public/:collectionId(*)/:displayId/:version/:query?', views.topLevel);
    app.get('/public/:collectionId/:displayId/:version([^\\.]+)', views.topLevel);

    app.get('/user/:userId/:collectionId/:displayId/:version/makePublic', requireUser, actions.makePublic);
    app.post('/user/:userId/:collectionId/:displayId/:version/makePublic', requireUser, uploadToMemory.single('file'), actions.makePublic);

    app.get('/user/:userId/:collectionId/:displayId/:version/makeTopLevelPublic', requireUser, actions.makeTopLevelPublic);
    app.post('/user/:userId/:collectionId/:displayId/:version/makeTopLevelPublic', requireUser, uploadToMemory.single('file'), actions.makeTopLevelPublic);

    app.get('/user/:userId/:collectionId/:displayId/:version/removeSubmission', requireUser, actions.removeSubmission);
    app.get('/user/:userId/:collectionId/:displayId/:version/cloneSubmission/', requireUser, actions.cloneSubmission);
    app.post('/user/:userId/:collectionId/:displayId/:version/cloneSubmission/', requireUser, uploadToMemory.single('file'), actions.cloneSubmission);
    app.post('/user/:userId/:collectionId/:displayId/:version/attach', requireUser, actions.upload);
    app.get('/user/:userId/:collectionId/:displayId/:version/remove', requireUser, actions.remove);

    app.get('/user/:userId/:collectionId/:displayId/:version/:hash/search/:query?', views.search);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/:hash/share/:filename.xml', api.sbolTopLevel);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/:hash/share/sbol', api.sbolTopLevel);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/:hash/share/:filename.json', api.summary);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/:hash/share/:filename.fasta', api.fasta);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/:hash/share/:filename.gb', api.genBank);
    app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share', views.topLevel);
    app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/remove', actions.remove);

    app.get('/user/:userId/:collectionId(*)/:displayId/search/:query?', views.search);
    app.get('/user/:userId/:collectionId/:displayId/:version/search/:query?', views.search);
    app.get('/user/:userId/:collectionId/:displayId/search/:query?', views.search);
    app.get('/user/:userId/:collectionId/:displayId/:version/uses', views.search);
    app.get('/user/:userId/:collectionId/:displayId/:version/twins', views.search);
    app.get('/user/:userId/:collectionId/:displayId/:version/download', requireUser, api.download);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/sbol', api.sbolTopLevel);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/:filename.xml', api.sbolTopLevel);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/:filename.json', api.summary);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/:filename.fasta', api.fasta);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/:filename.gb', api.genBank);
    app.get('/user/:userId/:collectionId(*)/:displayId/:version/:query?', views.topLevel);
    app.get('/user/:userId/:collectionId/:displayId/:version([^\\.]+)', views.topLevel);

    app.get('/sparql', views.sparql)
    app.post('/sparql', bodyParser.urlencoded({ extended: true }), views.sparql)

    function requireUser(req, res, next) {

        if(req.user === undefined)
            res.redirect('/login?next=' + encodeURIComponent(req.url))
        else
            next()
    }

    function requireAdmin(req, res, next) {

        if(req.user === undefined || !req.user.isAdmin)
            res.redirect('/login?next=' + encodeURIComponent(req.url))
        else
            next()
    }

    cache.update()

    return app
}

module.exports = App

