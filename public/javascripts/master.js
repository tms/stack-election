var Settings = {};

// MarkdownMini parser, regexs are from the chat source *cough cough*
var Markdown = {
    parse: function (raw) {
        if (!raw) {
            return '';
        }

        raw = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        raw = raw.replace(/\\`/g, "&#96;")
            .replace(/\\\*/g, "&#42;")
            .replace(/\\_/g, "&#95;")
            .replace(/\\\[/g, "&#91;")
            .replace(/\\\]/g, "&#93;")
            .replace(/\\\(/g, "&#40;")
            .replace(/\\\)/g, "&#41;");

        raw = raw.replace(this._code, "$1<code>$2</code>")
            .replace(this._bold, "$1<strong>$2</strong>")
            .replace(this._italic, "$1<em>$2</em>")
            .replace(this._link, '$1<a href="$3">$2</a>')
            .replace(this._autolink, ' <a href="$2">$2</a>');

        return raw;
    },
    _bold: /(^|[\s,(])(?:\*\*|__)(?=\S)(.+?\S)(?:\*\*|__)(?=[\s,?!.;:)]|$)/g,
    _italic: /(^|[\s,(])(?:\*|_)(?=\S)(.+?\S)(?:\*|_)(?=[\s,?!.;:)]|$)/g,
    _link: /(^|\s)\[([^\]]+)\]\(((?:https?|ftp):\/\/[^)\s]+?)(?:\s(?:"|&quot;)([^"]+?)(?:"|&quot;))?\)/g,
    _autolink: /([^">;]|^)\b((?:https?|ftp):\/\/[A-Za-z0-9][-A-Za-z0-9+&@#/%?=~_|\[\]\(\)!:,.;]*[-A-Za-z0-9+&@#/%=~_|\[\]])/gi,
    _code: /(^|\W)`(.+?)`(?=\W|$)/g
};

var Loading = {
    _listEle: $('#loading-list li'),
    complete: function(title, force) {
        this._listEle.filter('#load-' + title).addClass('loaded');

        if(force || !this._listEle.filter(':visible:not(.loaded)').length) {
            $('#loading-list, #loading').slideUp(400);
        }
    },
    add: function(name, text, insertAfter) {
        var insertSelector = insertAfter ? '#load-' + insertAfter : ':last';

        $('<li>', {
            text: text,
            id: 'load-' + name,
            'class': 'cleanup'
        }).insertAfter(insertSelector);
    },
    reset: function(users) {
        $('#loading, #loading-list').slideDown();
        this._listEle.removeClass('loaded').filter('cleanup').remove();

        if(users) this._listEle.filer('.load-election').hide();
    }
};

Handlebars.registerHelper('markdown', function (raw) {
    return new Handlebars.SafeString(Markdown.parse(raw));
});

Handlebars.registerHelper('abbreviate', function (number) {
    return StackElections.Helpers.abbreviate(number, 1000);
});

Handlebars.registerHelper('reputation', function (rep) {
    return StackElections.Helpers.abbreviate(rep);
});

Handlebars.registerHelper('userpath', function (id, isMeta) {
    return 'http://' + (arguments.length === 3 ? 'meta.' : '') + Settings.siteName + '.com/users/' + id;
});

var StackElections = (function () {
    function init (options) {
        StackElections.options = options;

        Meddle.Configure({
            key: options.apikey
        });

        initBadges(options.badges, options.selectedBadges);
        //initUsers();
        initSort();
        initSites();
        initPreload();
    }

    function initBadges(available, selected) {
        var template = Handlebars.compile($('#badge-template').html()),
            list = $('#badges'),
            suggestions = $('#badge-suggestions');

        // Compensate for the API returning HTML here...
        available.forEach(function (badge) {
            badge.description = $('<div>').append(badge.description).text();
        });

        selected.forEach(function (badge) {
            badge = StackElections.Helpers.findBadge(badge);

            if (badge) {
                list.append(template(badge));
            }
        });

        $('#add-badge').on('input', function () {
            suggestions.empty();

            if (!this.value) {
                return;
            }

            available.forEach(function (badge) {
                if (badge.name.toLowerCase().indexOf(this.value.toLowerCase()) !== -1
                    && selected.indexOf(badge.name) === -1) {
                    $('<span>', {
                        text: badge.name,
                        'class': 'badge-name ' + badge.rank,
                        title: badge.description,
                        click: function () {
                            selected.push(badge.name);
                            list.append(template(badge));

                            $(this).slideUp(300, function () {
                                $(this).remove();
                            });

                            $('#add-badge').val(null);

                            return false;
                        }
                    }).appendTo(suggestions);
                }
            }, this);
        });

        list.on('click', 'a.remove-badge', function () {
            selected.splice(selected.indexOf(this.getAttribute('data-badge')), 1);

            $(this).parent().slideUp(300, function () {
                $(this).remove();
            });

            return false;
        });
    }

    function initUsers() {
        var template = Handlebars.compile($('#user-info-template').html()),
            list = $('#users'),
            suggestions = $('#user-suggestions');

        var deferred = new StackElections.DeferredAction({
            action: function (data, callback) {
                Meddle.With(Settings.siteName).users().pagesize(30).pages(1).set('inname', data).get(function (users) {
                    suggestions.find('li')
                        .filter('.top-user').hide().end()
                        .filter('.search-user').remove();

                    users.forEach(function (user) {
                        $(template(user)).data('info', user)
                            .addClass('cleanup search-user')
                            .appendTo(suggestions);
                    });
                });
            }
        });

        list.on('click', 'li', function () { suggestions.append(this); });
        suggestions.on('click', 'li', function () { list.append(this); });

        $('#user-search').on('input', function () {
            if (!this.value) {
                deferred.cancel();
                suggestions.find('li').hide().filter('.top-user').show();
            } else {
                deferred.invoke(this.value);
            }
        });

        $('#add-user-confirm').on('click', function () {
            var users = suggestions.find('li').map(function () {
                return $(this).data('info');
            }).get();

            return false;
        });
    }

    function initSort() {
        $('#sort input:radio').click(function(){
            $(this).parent().addClass('active').siblings().removeClass('active');

            if(this.name === 'sort') {
                var sortFunc;

                switch (this.value) {
                    case 'random':
                        sortFunc = function () {
                            return Math.random() * 3 - 1;
                        };
                        break;
                    case 'reputation':
                        sortFunc = function (a, b) {
                            return $(b).find('.rep').attr('title') - $(a).find('.rep').attr('title');
                        };
                        break;
                    case 'join':
                        sortFunc = function (a, b) {
                            return (new Date($(a).find('.member_for').attr('title').substring(14)) -
                                new Date($(b).find('.member_for').attr('title').substring(14)));
                        };
                        break;
                    case 'nomination':
                        sortFunc = function (a, b) {
                            return a.getAttribute('data-nomination-order') - b.getAttribute('data-nomination-order');
                        };
                        break;
                }

                $('#candidates > li').sortElements(sortFunc);
            } else if (this.name === 'show') {
                $('.nomination_detail').hide().filter('.' + this.value).show();
            }
        });

        $('#sort').hover(function(){
            $(this).children().fadeTo(100, 0.9);
        }, function(){
            $(this).children().fadeTo(100, 0.3);
        });
    }

    function initSites() {
        $('#sites').on('click', 'li', function () {
            $('#sites').slideUp(600);
            selectSite(this);
        });
    }

    function initPreload() {
        // Check for a pre-selected site
        var selected = window.location.hash.replace('#', '');

        if (selected && (selected = $('li[data-sitename="' + selected + '"]')).length) {
            $('#sites').hide();
            selectSite(selected);
        }
    }

    function selectSite(site) {
        site = $(site);

        Settings = {
            siteName: site.data('sitename'),
            friendlyName: site.text().trim(),
            siteLogo: site.find('img').attr('src').replace('favicon.ico', 'apple-touch-icon.png')
        };

        $('#sort').slideDown()
            .find('h2 + label').addClass('active')
            .siblings().removeClass('active');
        $('#candidates').empty();

        Loading.reset();

        $('#election-result, #no-candidates').slideUp();
        $('#site-detail, #option-menu').slideUp().find('dl').empty();
        $('.cleanup').remove();

        $.get('/' + Settings.siteName + '/election', function (election) {
            var ids = Object.keys(election.candidates);

            Loading.complete('init', !ids.length);
            Settings.phase = election.phase;

            var details = $('#site-detail');

            election.stats.forEach(function (stats) {
                this.append($('<dt>', { text: stats.label }));
                this.append($('<dd>', { text: stats.value, title: stats.title }));
            }, details.find('dl'));

            details.find('img.site-logo').attr('src', Settings.siteLogo);
            details.find('h2.site-title').text(Settings.friendlyName + ' ' + election.title);
            details.find('a.election-link').attr('href', 'http://' + Settings.siteName + '.com/election/latest');

            if (election.finished) {
                var results = $('#election-result');

                Object.keys(election.candidates).forEach(function (key) {
                    var candidate = election.candidates[key];

                    if (candidate.elected) {
                        $('<a>', { href: 'http://' + Settings.siteName + '.com/users/' + key, 'class': 'cleanup' }).append(
                            $('<img>', { src: 'http://' + Settings.siteName + '.com/users/flair/' + key + '.png' })
                        ).appendTo(results);
                    }
                });

                results.slideDown();
            }

            details.slideDown();

            if (ids.length) {
                Meddle.With(Settings.siteName).users(Object.keys(election.candidates)).filter('!*Mq.)f.7fClai1MW').get(function (candidates) {
                    Loading.complete('profile');

                    candidates.forEach(function (candidate) {
                        $.extend(candidate, election.candidates[candidate.user_id] || {});

                        if (/^http:\/\/www.gravatar.com\//.test(candidate.profile_image)) {
                            candidate.profile_image += '&s=90';
                        }
                    });

                    stalkCandidates(candidates, election);
                });
            } else {
                $('#no-candidates').slideDown();
            }

            var template = Handlebars.compile($('#user-info-template').html()),
                suggestions = $('#user-suggestions');

            Meddle.With(Settings.siteName).users().pagesize(30).pages(1).get(function (users) {
                users.forEach(function (user) {
                    $(template(user)).data('info', user)
                        .addClass('cleanup top-user')
                        .appendTo(suggestions);
                });
            });
        });
    }

    function stalkCandidates(candidates, election) {
        var users = [],
            accounts = {},
            rendered = {},
            count = candidates.length,
            template;

        for (var i = 0, j, tmp; i < count; ++i) {
            j = Math.floor(Math.random() * (i + 1));
            tmp = candidates[i];
            candidates[i] = candidates[j];
            candidates[j] = tmp;

            users.push(accounts[tmp.account_id] = tmp.user_id);
        }

        template = Handlebars.compile($('#candidate-template').html());

        candidates.forEach(function (candidate) {
            var website,
                daysActive = (Date.now() / 1000 - candidate.creation_date) / (24 * 60 * 60);

            if (candidate.website_url) {
                website = '<a href="' + candidate.website_url + '">' + candidate.website_url + '</a>';
            }

            var personal = $.grep([ candidate.age, candidate.location, website], function (c) { return c != null; }),
                current = $.extend({
                    days_active: daysActive,
                    member_for: StackElections.Helpers.normalizeTime(candidate.creation_date),
                    creation_string: new Date(candidate.creation_date * 1000).toString(),
                    user_text: candidate.text,
                    nominated_order: candidate.nominated_order,
                    personal_data: personal.join(', '),
                    is_protem: !election.finished && candidate.user_type === 'moderator',
                    ratio_qa: (candidate.answer_count / candidate.question_count).toFixed(2),
                    ratio_votes: (candidate.up_vote_count / candidate.down_vote_count).toFixed(2),
                    avg_post_rep: (candidate.reputation / (candidate.answer_count + candidate.question_count)).toFixed(1),
                    avg_day_rep: (candidate.reputation / daysActive).toFixed(1)
                }, candidate);

            var profile = (current.about_me || '').trim();

            if (profile) {
                current.about_me = $('<div>').append(profile).find('a.post-tag').each(function () {
                    var target = this.getAttribute('href');

                    if (target.indexOf('http://') !== 0) {
                        this.setAttribute('href', 'http://' + Settings.siteName + '.com' + target);
                    }
                }).end().find('a.post-tag img').remove().end().html();
            }

            rendered['user-' + candidate.user_id] = $(template(current)).appendTo('#candidates');
        });

        function stalkMetaCandidates(metaUsers, isLinkedMeta) {
            var template = Handlebars.compile($('#candidate-meta-template').html());

            Meddle.With('meta.' + Settings.siteName).users(metaUsers).filter('!*Mq.)f.7fClai1MW').get(function (candidates) {
                candidates.forEach(function (candidate) {
                    candidate.site = Settings.siteName;
                    candidate.is_linked_user = isLinkedMeta;
                    candidate.ratio_qa = (candidate.answer_count / candidate.question_count).toFixed(2);

                    rendered['user-' + accounts[candidate.account_id]].find('.meta').append(
                        template(candidate)
                    );
                });

                Loading.complete('meta');
            });
        }

        Meddle.associated(Object.keys(accounts)).pagesize(100).all().get(function (users) {
            var tallies = {},
                metaUsers = [],
                template = Handlebars.compile($('#candidate-network-template').html());

            users.forEach(function (user) {
                var tally = tallies[user.account_id];

                if (!tally) {
                    tally = {
                        total: 0,
                        active: 0,
                        reputation: 0
                    };
                    tallies[user.account_id] = tally;
                }

                if (user.site_name === 'Meta ' + Settings.friendlyName) {
                    metaUsers.push(user.user_id);
                }

                ++tally.total;
                tally.reputation += user.reputation - 100;

                if (user.reputation > 200) {
                    ++tally.active;
                }
            });

            Object.keys(tallies).forEach(function (account) {
                var tally = tallies[account];

                rendered['user-' + accounts[account]].find('.stackexchange').append(
                    template({
                        combined_rep: tally.reputation,
                        active_sites: tally.active,
                        total_sites: tally.total
                    })
                );
            });

            if (Settings.siteName === 'stackoverflow') {
                stalkMetaCandidates(metaUsers, false);
            }
        });

        // For every other site, do meta polling here
        if (Settings.siteName !== 'stackoverflow') {
            stalkMetaCandidates(users, true);
        }

        Meddle.With(Settings.siteName).users(users).badges().pagesize(100).all().sort('type').max('named').filter('!6QqZPj6BmRO)x').get(function (badges) {
            var lists = $('.badge_list ul:empty');

            StackElections.options.selectedBadges.forEach(function (badge) {
                var info = StackElections.Helpers.findBadge(badge);

                $('<li>', {
                    text: badge,
                    title: info.rank + ': ' + info.description
                }).appendTo(lists);
            });

            badges.forEach(function (badge) {
                if (StackElections.options.selectedBadges.indexOf(badge.name) !== -1) {
                    rendered['user-' + badge.user.user_id].find('.badge_list li').filter(match).addClass('badge_received');
                }

                function match() {
                    return (this.textContent || this.innerText) === badge.name;
                }
            });

            Loading.complete('badge');
        });

        // Ask for the last five bits of activity for each user in separate requests
        var responses = { tags: 0, timeline: 0 }, timelineConversions = {
            commented: 'comment',
            revision:  'edit',
            answered:  'answer',
            asked:     'question',
            suggested: 'suggestion', // This one will be too long, but most candidates have edit privs...right?
            reviewed:  'review'
        };

        users.forEach(function (candidate) {
            $.get('/' + Settings.siteName + '/candidate-tags/' + candidate, function (tags) {
                var list = rendered['user-' + candidate].find('.tag_list'),
                    template = Handlebars.compile($('#candidate-tag-template').html());

                tags.forEach(function (tag) {
                    list.append(template($.extend({
                        site: Settings.siteName,
                        user_id: candidate,
                        name_safe: encodeURIComponent(tag.tag_name)
                    }, tag)));
                });

                if (++responses.tags === count) {
                    Loading.complete('tag');
                }
            });

            Meddle.With(Settings.siteName).users(candidate).timeline().pagesize(5).pages(1).filter('!nNik2mH5PA').get(function (activity) {
                if (activity.length) {
                    var list = rendered['user-' + activity[0].user_id].find('.recent_activity ul'),
                        template =  Handlebars.compile($('#candidate-activity-template').html());

                    activity.forEach(function (activity) {
                        var action = timelineConversions[activity.timeline_type] || activity.timeline_type;

                        activity = $.extend({
                            awarded: action === 'awarded',
                            action: action,
                            time_ago: $.timeago(new Date(activity.creation_date * 1000)),
                            creation_string: new Date(activity.creation_date * 1000).toString()
                        }, activity);

                        list.append(template(activity));
                    });
                }

                if (++responses.timeline === count) {
                    Loading.complete('activity');
                }
            });
        });
    }

    return {
        init: init
    }
})();

StackElections.DeferredAction = function DeferredAction(settings) {
    var options = $.extend({ delay: 700 }, settings),
        pending = null,
        dispatched = false,
        cancelled = false,
        deferred = null;

    this.invoke = function reinvoke(data) {
        if (pending) {
            clearTimeout(pending);
        }

        cancelled = false;

        if (!dispatched) {
            options.data = data;
            pending = setTimeout(invoke, options.delay);
        } else {
            deferred = function () {
                reinvoke(data);
            };
        }
    };

    this.cancel = function cancel() {
        cancelled = true;
        clearTimeout(pending);
    };

    function invoke() {
        dispatched = true;
        var data = typeof options.data === 'function' ? options.data() : options.data;

        if (!cancelled) {
            // We should require the action to return a promise instead
            // of relying on them calling actionCallback, but we'll take
            // the lazy way out for the moment
            options.action(data, actionCallback);
        } else {
            dispatched = false;
        }
    }

    function actionCallback() {
        dispatched = false;

        if (deferred) {
            deferred();
        }
    }
};

StackElections.Helpers = {
    findBadge: function  (name) {
        var result = null;

        StackElections.options.badges.forEach(function (badge) {
            if (badge.name === name) {
                result = badge;
                return false;
            }
        });

        return result;
    },
    normalizeTime: function(time) {
        var timeago = new Date(Date.now() - (time * 1000)),
            dateString = '';

        var dateComponents = {
            year: timeago.getFullYear() - 1970,
            month: timeago.getMonth()
        };

        Object.keys(dateComponents).forEach(function (component) {
            if (dateComponents[component]) {
                dateString += dateComponents[component] + ' ' + component + (dateComponents[component] > 1 ? 's' : '') + ' ';
            }
        });

        return dateString.trim();
    },
    abbreviate: function (number, cutoff) {
        cutoff = cutoff || 10000;

        if (number < cutoff) {
            return number;
        } else if (number < 100000) {
            var thousands = Math.floor(Math.round(number / 100) / 10);
            number = Math.round((number - thousands * 1000) / 100);

            return thousands + (number > 0 ? "." + number : "") + "k";
        }

        return Math.round(number / 1000) + "k";
    }
};

// Toggle
$('a[id$=toggle]').click(function(){
    $('#' + this.id.replace('-toggle', '')).slideToggle();
    return false;
});

// Unicorns!!!
$('#unicorn').toggle(function(){
    $('img').attr('src', function(i, v){
        return v.replace(/\w*\.gravatar\.com/i, 'unicornify.appspot.com');
    });
}, function(){
    $('img').attr('src', function(i, v){
        return v.replace('unicornify.appspot.com', 'www.gravatar.com');
    });
});
