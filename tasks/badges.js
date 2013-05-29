var storage,
    meddle;

exports.update = function update(callback) {
    meddle.With('stackoverflow').badges().filter('9e8ut8nybftG').sort('type').max('named').pagesize(100).all().get(function (badges) {
        badges && storage.setItem('badges', badges);

        if (callback) {
            callback(null, badges);
        }
    });
};

exports.init = function (options, callback) {
    storage = options.storage;
    meddle = options.meddle;

    var badges;

    if (badges = storage.getItem('badges')) {
        callback(null, badges);
    } else {
        exports.update(callback);
    }
};