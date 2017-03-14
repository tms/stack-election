var sax = require('sax'),
    storage,
    xhr;

exports.update = function update(callback) {
    var req = new xhr(),
        latest = storage.getItem('rss-latest') || 0;

    req.open('GET', 'http://stackexchange.com/feeds/tagsets/22714/elections?sort=newest');
    req.onload = function () {
        parse(this.responseText, latest, function (entries, latest) {
            storage.setItem('rss-latest', latest);

            entries.forEach(function (entry) {
                var name = entry.link.match(/^(https?:\/\/[^\/]+)\//)[1]
                    .replace('meta.', '')
                    .replace('https://', 'http://');

                if (entry.author.name === 'Community' && (
                    entry.title.indexOf('Moderator Election') !== -1 ||
                    entry.title.indexOf('Eleição Para Moderadores') !== -1
                )) {
                    var sites = storage.getItem('sites'),
                        site = sites[name];

                    if (!site.elections.length || site.elections[0] < entry.posted) {
                        site.elections.unshift(entry.posted);
                        storage.setItem('sites', sites);
                    }
                }
            });

            if (callback) {
                callback(null, null);
            }
        });
    };
    req.send();
};

exports.init = function (options, callback) {
    storage = options.storage;
    xhr = options.xhr;
    exports.update(callback);
};

function parse(xml, latest, callback) {
    var feed = sax.parser(true),
        state = {
            tags: [],
            entries: [],
            finished: false,
            latest: 0
        };

    feed.onopentag = function onopentag(node) {
        state.tags.push(node.name);

        if (node.name === 'entry') {
            state.entries.push({});
        } else if (state.tags[1] === 'entry' && node.name === 'link') {
            state.entries[state.entries.length - 1].link = node.attributes.href;
        }
    };

    feed.ontext = function ontext(text) {
        var tag = state.tags[state.tags.length - 1],
            entry;

        if (state.tags[1] === 'entry') {
            entry = state.entries[state.entries.length - 1];

            switch (tag) {
                case 'title':
                    entry.title = text;
                    break;
                case 'name':
                case 'uri':
                    entry.author = entry.author || {};

                    if (tag === 'name') {
                        entry.author.name = text;
                    } else {
                        entry.author.link = text;
                    }

                    break;
                case 'published':
                    entry.posted = +(new Date(text));
                    state.latest = Math.max(entry.posted, state.latest);
                    break;
            }

            if (entry.posted && entry.posted < latest) {
                var end = feed.onend;

                state.entries.pop();

                delete feed.onerror;
                delete feed.onopentag;
                delete feed.ontext;
                delete feed.onclosetag;
                delete feed.onend;

                end();
            }
        }
    };

    feed.onclosetag = function onclosetag(tag) {
        state.tags.pop();
    };

    feed.onend = function onend() {
        callback(state.entries, state.latest);
    };

    feed.write(xml).close();
}
