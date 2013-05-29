var express = require('express'),
    http = require('http'),
    path = require('path'),
    hbs = require('express-hbs'),
    storage = require('node-persist'),
    scheduler = require('node-schedule'),
    deferred = require('deferred'),
    xhr = require('xmlhttprequest').XMLHttpRequest,
    meddle = require('./public/javascripts/meddle.js');


var tasks = {
    sites: {
        job: require('./tasks/sites.js'),
        schedule: { dayOfWeek: 0, hour: 3, minute: 0 }
    },
    badges: {
        job: require('./tasks/badges.js'),
        schedule: { dayOfWeek: 0, hour: 3, minute: 5 }
    },
    elections: {
        job: require('./tasks/elections.js'),
        schedule: { minute: new scheduler.Range(5, 55, 10) }
    }
};

// Background task setup
storage.initSync({ dir: '../../../data' });
meddle.Configure({
    requestHandler: xhr,
    key: 'LYwuXpduJM2Kk9Twsc008w((',
    debug: true
});

var promises = [];

Object.keys(tasks).forEach(function (key) {
    promises.push(deferred.promisify(tasks[key].job.init)({
        storage: storage,
        meddle: meddle,
        xhr: xhr
    }));
});

// Defer starting Express until we have the prerequisite template data
deferred.apply(null, promises)
.then(scheduleTasks)
.then(startExpress)
.done();

function scheduleTasks() {
    Object.keys(tasks).forEach(function (key) {
        scheduler.scheduleJob(tasks[key].schedule, tasks[key].job.update);
    });
}

// Express setup
function startExpress() {
    var app = express();

    app.engine('hbs', hbs.express3({
        partialsDir: __dirname + '/views/partials',
        contentHelperName: 'content'
    }));
    app.set('port', process.env.PORT || 3000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'hbs');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.compress());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));

    if ('development' == app.get('env')) {
        app.use(express.errorHandler());
    }

    var routes = require('./routes')({
        storage: storage,
        meddle: meddle,
        xhr: xhr
    });

    app.get('/', routes.index);
    app.get('/:site/election', routes.election);
    app.get('/:site/candidate-tags/:id', routes.candidateTags);

    http.createServer(app).listen(app.get('port'), function(){
        console.log('Express server listening on port ' + app.get('port'));
    });
}
