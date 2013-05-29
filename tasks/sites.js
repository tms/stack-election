var storage,
    meddle;

exports.update = function update(callback) {
    meddle.sites().filter('!SmNuUIu5_.JNtMJjlC').get(function (sites) {
        var stored = storage.getItem('sites') || {},
            changed = false;

        sites && sites.forEach(function (site) {
            if (site.site_type === 'main_site' && !stored[site.site_url]) {
                stored[site.site_url] = {
                    favicon: site.favicon_url,
                    icon: site.icon_url,
                    name: site.name,
                    elections: []
                };

                changed = true;
            }
        });

        if (changed) {
            storage.setItem('sites', stored);
        }

        if (callback) {
            callback(null, sites);
        }
    });
};

exports.init = function (options, callback) {
    storage = options.storage;
    meddle = options.meddle;

    var sites;

    if (sites = storage.getItem('sites')) {
        callback(null, sites);
    } else {
        exports.update(callback);
    }
};