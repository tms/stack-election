var jsdom = require('jsdom'),
    deferred = require('deferred');

var IndexController = {};

module.exports = function (options) {
    return {
        index: IndexController.index(options),
        election: IndexController.election(options),
        candidateTags: IndexController.candidateTags(options)
    };
};

IndexController.index = function (options) {
    var storage = options.storage;

    function insertSiteInto(array, site) {
        if (!array.length) {
            array.push(site);
            return;
        }

        for (var i = 0; i < array.length; ++i) {
            if (site.elections[0] > array[i].elections[0]
                || (site.elections[0] === array[i].elections[0] && site.name < array[i].name)) {
                array.splice(i, 0, site);
                return;
            }
        }

        array.push(site);
    }

    return function(req, res){
        var sites = storage.getItem('sites'),
            current = [],
            finished = [];

        Object.keys(sites).forEach(function (key) {
            var site = sites[key];

            if (site.elections.length) {
                site.url = key;
                site.sitename = key.match(/^http:\/\/(.*?)\.com\/?/)[1];

                var election = storage.getItem('election-' + site.sitename),
                    isFinished;

                if (election && election.update > site.elections[0]) {
                    isFinished = election.finished;
                } else {
                    isFinished = site.elections[0] < Date.now() - 23 * 24 * 60 * 60 * 1000;
                }

                insertSiteInto(
                    isFinished ? finished : current,
                    site
                );
            }
        });

        res.render('index', {
            current: current,
            finished: finished,
            badges: JSON.stringify(storage.getItem('badges') || [])
        });
    }
};

IndexController.election = function (options) {
    var pending = {},
        storage = options.storage,
        xhr = options.xhr;

    var cacheDuration = 5 * 60 * 1000;

    function scrapeElection(site) {
        var defer = deferred(),
            req = new xhr();

        // Didn't know this route existed, which is helpful...unfortunately
        // it doesn't respect our query parameters, so we need to grab the
        // redirect location and then make a separate request manually.
        req.open('head', 'https://' + site + '.com/election/latest');
        req.onload = function () {
            jsdom.env(
                'https://' + site + '.com' + this.getResponseHeader('location') + '?tab=nomination',
                ['http://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js'],
                function (errors, window) {
                    var $ = window.$,
                        election = { candidates: {} },
                        status = $('.question-status').text().trim();

                    election.update = Date.now();
                    election.title = $('h1:first').text().trim();
                    election.finished = status.indexOf('election ended') !== -1
                        || status.indexOf('eleição encerrou') !== -1 ? Date.now() : false;
                    election.phase = election.finished ? 'completed' : status.split(' ')[0].toLowerCase();
                    election.stats = [];

                    var elected = [];

                    if (election.finished) {
                        $('.question-status a:has(img)').each(function () {
                            elected.push(+this.href.match(/\/(\d+)(?:\/[^\/]+)?$/)[1]);
                        });
                    }

                    $('.module:first p.label-key').each(function () {
                        var label = $(this), value = label.next();

                        election.stats.push({
                            label: label.text(),
                            value: value.text(),
                            title: value.attr('title')
                        });
                    });

                    $('[id^=post-]').each(function (i) {
                        var post = $(this),
                            id = +post.find('.user-details a').attr('href').match(/\/(\d+)(?:\/[^\/]+)?$/)[1];

                        // Tag links have a domainless target, so we need to fix that
                        post.find('.post-text a.post-tag').each(function () {
                            var target = this.getAttribute('href');

                            if (target.indexOf('http://') !== 0) {
                                this.setAttribute('href', 'http://' + site + '.com' + target);
                            }
                        });
                        post.find('.post-text a.post-tag img').remove();

                        election.candidates[id] = {
                            user_id: id,
                            text: post.find('.post-text').html().trim(),
                            nominated_order: i,
                            elected: election.finished && elected.indexOf(id) !== -1
                        };
                    });

                    defer.resolve(election);
                }
            );
        };
        req.send();

        return defer.promise;
    }

    return function (req, res) {
        var site = storage.getItem('sites')['http://' + req.params.site + '.com'],
            election = storage.getItem('election-' + req.params.site);

        if (!site || !site.elections[0]) {
            res.send(404, { error: 'Unknown site' });
            return;
        }

        var beforeElection, duringElection, cacheExpired, withinGracePeriod;

        if (election) {
            beforeElection =  election.update < site.elections[0];
            duringElection = !election.finished;
            cacheExpired = election.update < Date.now() - cacheDuration;
            withinGracePeriod = election.finished && (election.finished > Date.now() - 5 * 60 * 60 * 1000)
        }

        if (!election || beforeElection || (duringElection && cacheExpired) || (withinGracePeriod && cacheExpired)) {
            if (!pending[req.params.site]) {
                pending[req.params.site] = scrapeElection(req.params.site);
                pending[req.params.site].done(function (election) {
                    storage.setItem('election-' + req.params.site, election);
                    delete pending[req.params.site];
                });
            }

            pending[req.params.site].done(function (election) {
                res.send(election);
            });
        } else {
            res.send(election);
        }
    };
};

IndexController.candidateTags = function (options) {
    var pending = {},
        storage = options.storage,
        meddle = options.meddle;

    var cacheDuration = 12 * 60 * 60 * 1000;

    function fetchBadgeAndTagData(site, candidate) {
        var defer = deferred();

        meddle.With(site).users(candidate).topAnswerTags().pagesize(9).pages(1).filter('!n0xze7daYK').get(function (tags) {
            var lookup = {};

            tags.forEach(function (tag) {
                lookup[tag.tag_name] = tag;
            });

            meddle.With(site).users(candidate).badges().pagesize(100).sort('type').min('tag_based').filter('!m_*kMUgZgG').get(function (badges) {
                badges.forEach(function (badge) {
                    var tag = lookup[badge.name];

                    if (tag && tag.badge_rank !== 'gold') {
                        if (badge.rank !== 'bronze' || !tag.badge_rank) {
                            tag.badge_rank = badge.rank;
                        }
                    }
                });

                defer.resolve({
                    update: Date.now(),
                    tags: tags
                });
            });
        });

        return defer.promise;
    }

    return function (req, res) {
        var site = storage.getItem('sites')['http://' + req.params.site + '.com'],
            election = storage.getItem('election-' + req.params.site),
            candidate = storage.getItem('candidate-' + req.params.site + '-' + req.params.id);

        if (!site || !site.elections[0]) {
            res.send(404, { error: 'Unknown site' });
            return;
        }

        if (!election || !election.candidates[+req.params.id]) {
            res.send(404, { error: 'Unknown candidate' });
            return;
        }

        var cacheExpired = candidate && candidate.update < Date.now() - cacheDuration;

        if (!candidate || cacheExpired) {
            if (!pending[req.params.site + '-' + req.params.id]) {
                pending[req.params.site + '-' + req.params.id] = fetchBadgeAndTagData(req.params.site, req.params.id);
                pending[req.params.site + '-' + req.params.id].done(function (candidate) {
                    storage.setItem('candidate-' + req.params.site + '-' + req.params.id, candidate);
                    delete pending[req.params.site + '-' + req.params.id];
                });
            }

            pending[req.params.site + '-' + req.params.id].done(function (candidate) {
                res.send(candidate.tags);
            });
        } else {
            res.send(candidate.tags);
        }
    };
};
