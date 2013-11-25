'use strict';

(function (window, undefined) {

    var COLOR = {
        'RED': [180, 0, 0, 255],
        'GREEN': [0, 180, 0, 255]
    };
    var ONE_SEC = 1000;
    var ONE_MIN = 60;
    var CALENDAR_URL = 'http://my-doings.appspot.com/api';

    var chrome = window.chrome;
    var storage = window.storage;
    var browserAction = chrome.browserAction;
    var model = window.model;
    var options = model.options;
    var todos = model.todos;

    var Utils = window.Utils;
    Utils.beep = function () {
        if (options.playSound() === true) {
            var beeper = window.document.getElementById('beeper');
            beeper.src = 'media/' + options.icon() + '.mp3';
            beeper.play();
        }
    };

    var Popup = {
        notification: null,
        show: function (ackFor) {
            this.close();

            var msgs = {
                'end of working': '耶！吃完一個番茄囉，休息一下吧！',
                'waiting for work': '休息夠了隨時再開始新的蕃茄鐘歐'
            };

            this.notification = webkitNotifications.createNotification(
                'img/icon48.png', // icon url - can be relative
                '', // notification title
                msgs[ackFor] // notification body text
            );

            this.notification.show();
            window.setTimeout(this.close.bind(this), 15 * ONE_SEC);
        },
        close: function () {
            this.notification && this.notification.cancel();
        }
    };

    var actionIcon = {
        setTitle: function (text) {
            browserAction.setTitle({
                title: text
            });
        },
        setBadgeText: function (text, bgcolor) {
            browserAction.setBadgeBackgroundColor({
                color: bgcolor || COLOR.GREEN
            });
            browserAction.setBadgeText({
                text: text
            });
        }
    };

    browserAction.setIcon({
        path: 'img/icon_' + options.icon() + '.png'
    });

    browserAction.onClicked.addListener(function (tab) {
        var url = chrome.extension.getURL('options.html');
        chrome.tabs.query({
            url: url,
        }, function (results) {
            if (results.length) {
                chrome.tabs.update(results[0].id, {
                    active: true
                });
            } else {
                chrome.tabs.create({
                    url: url
                });
            }
        });
    });

    var timer = window.StateMachine.create({
        initial: storage('state') || 'idling',

        events: [{
            name: 'start',
            from: 'idling',
            to: 'working'
        }, {
            name: 'rest',
            from: 'working',
            to: 'resting'
        }, 　　　　　　 {
            name: 'idle',
            from: 'resting',
            to: 'idling'
        }, 　　　　　　 {
            name: 'stop',
            from: 'working',
            to: 'idling'
        }],
        callbacks: {
            onbeforeevent: function (event, from, to) {
                model.refresh();
            },
            onenterstate: function (event, from, to) {
                storage('state', to);
                Utils.log('state: ' + from + ' -> ' + to);
            },
            onafterevent: function (event, from, to) {
                window.optionsPage && window.optionsPage.model.refresh();
            }
        }
    });

    timer.todo = storage('todo');
    timer.timeout = null;
    timer.tickPeriod = 5 * ONE_SEC;

    timer.onworking = function (event, from, to) {
        storage('todo', this.todo);
        Popup.close();
        Utils.beep();
        this.tick();
    };

    timer.onresting = function (event, from, to) {
        Popup.show('end of working');
        Utils.beep();
        this.countdown(options.restLength() * ONE_MIN);
        this.tick();
        todos.eatup(this.todo, true);
        //window.optionsPage && window.optionsPage.model.refresh();
    };

    timer.onleaveresting = function (event, from, to) {
        Popup.show('waiting for work');
        Utils.beep();
    };

    timer.onidling = function (event, from, to) {
        storage('todo', '');
        actionIcon.setBadgeText('IDLE');
        actionIcon.setTitle('趕快再重新開始一個新的番茄鐘吧！');
    };

    timer.onleaveidling = function (event, from, to) {
        this.countdown(options.workLength() * ONE_MIN);
    };

    timer.onstop = function (event, from, to, msg) {
        Popup.close();
        this.clearTimeout();
        todos.eatup(this.todo, false);
        //window.optionsPage && window.optionsPage.model.refresh();
    };

    ////////////////////////////////////////////////////////////////////////

    timer.click = function (todo) {
        this.todo = todo;
        todo = todos.refresh().fetch(this.todo);
        todo.running(!todo.running());
        todos.save();
        if (todo.running()) {
            this.start();
        } else {
            this.stop();
        }
    };

    timer.writePeriodToCalendar = function () {
        if (options.syncToCalendar() === false) {
            Utils.log('calendar sync is turned off.');
            return;
        }
        // work time = working time + decompression time
        // -- since you need decompression after working to maintain
        // high performance, it counts as work too.
        var workTime = parseInt(storage('countDown'), 10) + (options.workLength() * ONE_MIN);

        Utils.log('trying to write to calendar');

        this.iframe = window.document.createElement('iframe');
        this.iframe.src = CALENDAR_URL + '#create/ChromoDoro/' + workTime;
        window.document.body.appendChild(this.iframe);
    };

    timer.getTime = function (seconds) {
        return new Date().getTime();
    };

    timer.timeLeft = function () {
        var secondsPast = (this.getTime() - storage('startedAt')) / ONE_SEC;
        return (storage('countDown') - secondsPast);
    };

    timer.countdown = function (seconds) {
        storage('countDown', seconds);
        storage('startedAt', this.getTime());
    };

    timer.clearTimeout = function () {
        window.clearTimeout(this.timeout);
        this.timeout = null;
    };

    timer.tick = function () {
        var state = this.current;
        var timeLeft = this.timeLeft();
        //Utils.log('state: ' + state + ', timeLeft: ' + timeLeft);
        if (timeLeft <= 0) {
            this.clearTimeout();
            if (state === 'working') {
                this.rest();
            }
            if (state === 'resting') {
                this.idle();
            }
        } else {
            var bgcolor = (state === 'working') ? COLOR.RED : COLOR.GREEN;
            timeLeft = Math.ceil(this.timeLeft() / ONE_MIN).toString();
            actionIcon.setTitle(this.todo || state);
            actionIcon.setBadgeText(timeLeft, bgcolor);

            this.clearTimeout();
            this.timeout = window.setTimeout(this.tick.bind(this), this.tickPeriod);
        }
    };

    window.addEventListener('load', function () {
        if (timer.current !== 'idling') {
            timer.tick();
        }
        window.timer = timer;
        window.optionsPage = null;
    });

})(window);

