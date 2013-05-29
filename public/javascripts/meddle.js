var Meddle;

if (typeof exports === 'object' && typeof require === 'function') {
    Meddle = exports;
} else {
    Meddle = {};
}

(function () {
    var internal = {};

    var options = {
        base: 'http://api.stackexchange.com/2.0',
        cooldown: 1500,
        debug: false,
        delay: 150,
        maxpages: 5
    };

    function extend(extended) {
        var i, objects = arguments;

        if (arguments.length < 2) {
            return extended;
        }

        for (i = 1; i < objects.length; ++i) {
            Object.keys(objects[i]).forEach(function (key) {
                extended[key] = objects[i][key];
            });
        }

        return extended;
    }

    function bindAll(object) {
        Object.keys(object).forEach(function (name) {
            if (typeof object[name] === 'function') {
                object[name] = object[name].bind(object);
            }
        });

        return object;
    }

    function stub(object, paths) {
        paths.forEach(function (name) {
            var method = name.replace(/-(.)/g, function (s, c) {
                return c.toUpperCase();
            });

            object[method] = function () {
                return new Request().constructor((this._path || '') + '/' + name, this._args);
            };
        });

        return object;
    }

    function numeric(value) {
        return (typeof value === 'number' && value > 0) || (typeof value === 'string' && /^\d+$/.test(value));
    }

    function verifyIDs(ids) {
        if (ids && Array.isArray(ids)) {
            ids = ids.join(';');
        }

        if (typeof ids === 'number') {
            ids = '' + ids;
        }

        if (ids == null || ids.length === 0) {
            return null;
        }

        if (typeof ids !== 'string') {
            throw new Error("the provided list of ids is not a valid format");
        }

        if (!/^(\d+;)*(\d+)$/.test(ids)) {
            throw new Error("the provided list of ids is not a valid format");
        }

        return ids;
    }

    function log(message) {
        if (options.debug && console) {
            console.log(message);
        }
    }

    var Dispatcher = (function () {
        var impl, queued = [], last, active;

        function prepareImplementation() {
            if (impl != null) {
                return;
            }

            if (typeof XMLHttpRequest !== 'undefined' &&  'withCredentials' in new XMLHttpRequest()) {
                impl = XMLHttpRequest;
            } else if (typeof XDomainRequest !== 'undefined') {
                impl = XDomainRequest;
            } else if (options.requestHandler) {
                impl = options.requestHandler;
            } else {
                throw new Error("this environment doesn't appear to support CORS");
            }
        }

        function invoke(target, callbacks, args) {
            if (!callbacks || !callbacks.length) {
                return;
            }

            for (var i = 0; i < callbacks.length; ++i) {
                callbacks[i].apply(target, args);
            }
        }

        var QueueItem = function (url, args, pages, success, failure) {
            bindAll(this);
            prepareImplementation();

            this._url = url;
            this._args = args;
            this._impl = new impl();
            this._pages = pages;
            this._count = 0;
            this._urgent = false;

            this.items = [];
            this.failed = false;
            this.started = false;
            this.complete = false;

            function handleSuccess(event) {
                if (this._impl.status !== 200) {
                    handleError.apply(this, [event]);
                }

                var response = JSON.parse(this._impl.responseText);

                if (response.error_code) {
                    handleError.apply(this, [event, response.error_id]);
                }

                ++this._count;

                Array.prototype.push.apply(this.items, response.items);

                if ((this._pages > this._count || this._pages == -1) && response.has_more) {
                    this._urgent = true;
                    add(this);
                } else {
                    this.complete = true;
                    invoke(this, success, [this.items]);
                }
            }

            function handleError(event, code) {
                this.failed = true;
                this.complete = true;

                if (this._impl.status != 200 || code == 500 || code == 502 || code == 503) {
                    var cooldown = Date.now() + options.cooldown;

                    if (cooldown > last) {
                        last = cooldown;
                    }
                }

                invoke(this, failure, [code]);
            }

            this._impl.onload = (handleSuccess).bind(this);
            this._impl.onerror = (handleError).bind(this);
        };

        QueueItem.prototype = {
            abort: function () {
                this._impl.abort();
            },
            start: function () {
                var query, args = extend({}, this._args);

                if (this._count) {
                    args['page'] = +(args['page'] || 0) + this._count + 1;
                }

                Object.keys(args).forEach(function (key) {
                    query = (query ? query + '&' : '') + key + '=' + encodeURIComponent(args[key]);
                }, this);

                var now = Date.now();

                if (now < last) {
                    last = now;
                }

                log("sending request for " +  options.base + this._url + (query ? '?' + query : ''));

                this.started = true;
                this._impl.open('get', options.base + this._url + (query ? '?' + query : ''));
                this._impl.send();
            }
        };

        function submit() {
            queued.shift().start();
        }

        function monitor() {
            if (!last || Date.now() - last >= options.delay) {
                submit();

                if (!queued.length) {
                    active = null;
                }
            }

            if (queued.length) {
                active = setTimeout(monitor, options.delay - (Date.now() - last));
            }
        }

        function add(item) {
            if (!item._urgent) {
                queued.push(item);

                log("added non-urgent item to end of queue, " + queued.length + " items pending");
            } else {
                var i, added = false;

                for (i = 0; i < queued.length && !added; ++i) {
                    if ((added = !queued[i]._urgent)) {
                        queued.splice(i, 0, item);
                    }
                }

                if (!added) {
                    queued.push(item);
                }

                log("added urgent item to queue at position " + i + ", " + queued.length + " items pending");
            }

            if (!active) {
                monitor();
            }

            return item;
        }

        return {
            queue: function (url, args, pages, success, failure) {
                return add(new QueueItem(url, args, pages, success, failure));
            }
        };
    })();

    var Request = function () {};

    Request.prototype = {
        constructor: function (path, args, whitelist) {
            var required = ['on', 'fail', 'done', 'response', 'get'];

            if (whitelist) {
                if (!Array.isArray(whitelist)) {
                    whitelist = [whitelist];
                }

                Array.prototype.push.apply(required, whitelist);
            }

            Object.keys(this).forEach(function (name) {
                if (Request.prototype[name] && required.indexOf(name) === -1) {
                    delete this[name];
                }
            }, this);

            this._path = path;
            this._args = args || {};
            this._handlers = {
                error: [], success: []
            };

            if (options.key) {
                this._args.key = options.key;
            }

            return bindAll(this);
        },
        on: function (event, handler) {
            if (!this._handlers[event]) {
                throw new Error("unknown event type " + event);
            }

            if (typeof handler !== 'function') {
                throw new Error("handler is not a function");
            }

            this._handlers[event].push(handler);

            return this;
        },
        fail: function (handler) {
            this.on('error', handler);

            return this;
        },
        done: function (handler) {
            this.on('success', handler);

            return this;
        },
        response: function (handler) {
            Object.keys(this._handlers).forEach(function (key) {
                this.on(key, handler);
            }, this);

            return this;
        },
        get: function (handler) {
            if (handler) {
                this.on('success', handler);
            }

            Dispatcher.queue(this._path, this._args, this._pages || options.maxpages, this._handlers.success, this._handlers.error);

            return this;
        },
        filter: function (filter) {
            this._args.filter = filter;

            return this;
        },
        all: function () {
            this.pages('all');

            return this;
        },
        pages: function (pages) {
            if (!numeric(pages) && pages !== 'all') {
                throw new Error("pages must a positive integer or the special value all");
            }

            this._pages = +(pages === 'all' ? -1 : pages);

            return this;
        },
        pagesize: function (pagesize) {
            if (!numeric(pagesize)) {
                throw new Error("pagesize must be a positive integer");
            }

            this._args.pagesize = pagesize;

            return this;
        },
        min: function (min) {
            this._args.min = min;

            return this;
        },
        max: function (max) {
            this._args.max = max;

            return this;
        },
        sort: function (sort) {
            this._args.sort = sort;

            return this;
        },
        order: function (order) {
            this._args.order = order;

            return this;
        },
        asc: function () {
            return this.order('asc');
        },
        desc: function () {
            return this.order('desc');
        },
        set: function (arg, value) {
            this._args[arg] = value;

            return this;
        }
    };

    var Site = function () {};

    Site.prototype = stub({
        constructor: function (name) {
            this._name = name;
            this._args = { site: name };

            return bindAll(this);
        },
        info: function () {
            return new Request().constructor('/info', this._args);
        },
        users: function (ids) {
            if (ids = verifyIDs(ids)) {
                return new User().constructor(this._name, ids);
            } else {
                return new Request().constructor('/users', this._args);
            }
        },
        badges: function (ids) {
            if (ids = verifyIDs(ids)) {

            } else {
                return new Request().constructor('/badges', this._args);
            }
        }
    }, ['info', 'privileges', 'search', 'similar']);

    var Users = function () {};

    Users.prototype = extend(new Request(), {
        constructor: function (site) {
            Request.prototype.constructor.call(this, '/users', { site: site });

            return bindAll(this);
        }
    });

    var User = function () {};

    User.prototype = extend(new Request(), stub({
        constructor: function (site, ids) {
            Request.prototype.constructor.call(this, '/users/' + ids, { site: site });

            this._ids = ids;

            return bindAll(this);
        },
        comments: function (toid) {
            if (toid && !numeric(toid)) {
                throw new Error("toid is not a valid id");
            }

            return new Request().constructor(this._path + '/comments' + (toid ? '/' + toid : ''), this._args);
        },
        tags: function (ids) {
            if (numeric(ids)) {
                return new UserTags().constructor(this._ids, ids, this._args);
            } else if (!ids || (ids = verifyIDs(ids))) {
                return new Request().constructor(this._path + '/tags' + (ids ? '/' + ids : ''), this._args);
            } else {
                throw new Error("ids are not in a valid format");
            }
        }
    }, ['answers', 'badges', 'favorites', 'mentioned', 'privileges', 'reputation', 'suggested-edits', 'timeline', 'top-answer-tags', 'top-question-tags']));

    var UserTags = function () {};

    UserTags.prototype = extend(new Request(), stub({
        constructor: function (uid, tids, args) {
            Request.prototype.constructor.call(this, '/users/' + uid + '/tags/' + tids, { site: site });

            return bindAll(this);
        }
    }, ['top-answers', 'top-questions']));

    Meddle.With = function (site) {
        return new Site().constructor(site);
    };

    Meddle.Configure = function (config) {
        extend(options, config);

        if (options.debug) {
            Meddle.Dispatcher = Dispatcher;
        } else {
            delete Meddle.Dispatcher;
        }
    };

    extend(Meddle, {
        associated: function (ids) {
            if (!(ids = verifyIDs(ids))) {
                throw new Error("valid ids not provided");
            }

            return new Request().constructor('/users/' + ids + '/associated');
        },
        sites: function () {
            return new Request().constructor('/sites', { pagesize: 500 });
        }
    });
})();