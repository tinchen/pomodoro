'use strict';

(function (window, undefined) {

    var now = new Date().getTime();
    var $ = window.$;
    var ko = window.ko;
    var storage = window.storage || window.chrome.extension.getBackgroundPage().storage;

    function today() {
        return new Date().format('yyyy-MM-dd');
    }

    var Todo = function (source) {
        this.title = ko.observable(source.title);
        this.completed = ko.observable(source.completed || false);
        this.running = ko.observable(source.running || false);
        this.editing = ko.observable(false);
    };

    var Todos = function () {
        var self = this;

        // store the new todo value being entered
        self.current = ko.observable();

        self.refresh = function () {
            var loaded = JSON.parse(storage('todos') || '[]');
            if (self.all) {
                self.all.removeAll();
            }
            else {
                self.all = ko.observableArray();
            }
            ko.utils.arrayForEach(loaded, function(todo) {
                self.all.push(new Todo(todo));
            });
            return self;
        };
        self.refresh();

        self.showMode = ko.observable('active');
        self.filteredTodos = ko.computed(function () {
            switch (self.showMode()) {
            case 'active':
                return self.all().filter(function (todo) {
                    return !todo.completed();
                });
            case 'completed':
                return self.all().filter(function (todo) {
                    return todo.completed();
                });
            default:
                return self.all();
            }
        });

        self.add = function () {
            var current = self.current().trim();
            if (current) {
                self.all.push(new Todo({
                    title: current
                }));
                self.current('');
            }
        };

        self.remove = function (todo) {
            self.all.remove(todo);
        };

        self.removeCompleted = function () {
            self.all.remove(function (todo) {
                return todo.completed();
            });
        };

        self.completedCount = ko.computed(function () {
            return ko.utils.arrayFilter(self.all(), function (todo) {
                return todo.completed();
            }).length;
        });

        self.remainingCount = ko.computed(function () {
            return self.all().length - self.completedCount();
        });

        self.allCompleted = ko.computed({
            //always return true/false based on the done flag of all todos
            read: function () {
                return !self.remainingCount();
            },
            // set all todos to the written value (true/false)
            write: function (newValue) {
                ko.utils.arrayForEach(self.all(), function (todo) {
                    // set even if value is the same, as subscribers are not notified in that case
                    todo.completed(newValue);
                });
            }
        });

        self.fetch = function (title) {
            var found = ko.utils.arrayFilter(self.all(), function (todo) {
                return todo.title() === title;
            });
            return found.length > 0 ? found[0] : null;
        };

        // eatup the running todo
        self.eatup = function (todo, done) {
            self.fetch(todo).running(false);
            storage('todos', ko.toJSON(self.all));
            window.model.activities.eatup(todo, done);
        };

        self.save = function () {
            storage('todos', ko.toJSON(self.all));
        };
        
        // internal computed observable that fires whenever anything changes in our todos
        ko.computed(function () {
            storage('todos', ko.toJSON(self.all));
        }).extend({
            throttle: 500
        }); // save at most twice per second
    };

    var Activity = function (source) {
        this.title = ko.observable(source.title);
        this.running = ko.observable(source.running);
        this.completed = ko.observable(source.completed || false);
        this.estimated = ko.observable(source.estimated || 0);
        this.actual = ko.observable(source.actual || 0);
        this.breaked = ko.observable(source.breaked || 0);
        this.canceled = ko.observable(source.canceled || false);
        this.date = ko.observable(source.date || today());
    };

    var Activities = function () {
        var self = this;

        self.today = today();

        self.refresh = function () {
            var loaded = JSON.parse(storage(self.today + '-activities') || '[]');
            if (self.all) {
                self.all.removeAll();
            }
            else {
                self.all = ko.observableArray();
            }
            ko.utils.arrayForEach(loaded, function(activity) {
                self.all.push(new Activity(activity));
            });
            return self;
        };
        self.refresh();

        self.fetch = function (title) {
            var found = ko.utils.arrayFilter(self.all(), function (activity) {
                return activity.title() === title;
            });
            return found.length > 0 ? found[0] : null;
        };

        self.add = function (todo) {
            if (!self.fetch(todo.title())) {
                self.all.push(new Activity({
                    title: todo.title(),
                    running: todo.running()
                }));
                self.save();
            }
        };

        self.breaked = function (todo) {
            var activity = self.fetch(todo.title());
            activity.breaked(activity.breaked() + 1);
            self.save();
        };

        self.eatup = function (todo, done) {
            var activity = self.fetch(todo);
            activity.actual(activity.actual() + (done ? 1 : 0));
            self.save();
        };

        self.save = function () {
            storage(self.today + '-activities', ko.toJSON(self.all));
        };
    };

    var Options = function () {
        var self = this;

        self.refresh = function () {
            var loaded = JSON.parse(storage('options') || '{}');
            self.nickname       = ko.observable(loaded.nickname || '訪客');
            self.workLength     = ko.observable(loaded.workLength || 25);
            self.restLength     = ko.observable(loaded.restLength || 5);
            self.playSound      = ko.observable(loaded.playSound !== undefined ? loaded.playSound : false);
            self.syncToCalendar = ko.observable(loaded.syncToCalendar !== undefined ? loaded.syncToCalendar : false);
            self.icon           = ko.observable(loaded.icon || 'default');
            self.version        = ko.observable(loaded.version || '1.0');
            $.getJSON('manifest.json', function(manifest) {
                self.version(manifest.version);
            });
            return self;
        };

        self.refresh();
    };

    window.model = {
        storage    : storage,
        options    : new Options(),
        todos      : new Todos(),
        activities : new Activities(),
        refresh    : function(name) {
            if (name) {
                return this[name].refresh();
            }
            this.options.refresh();
            this.todos.refresh();
            this.activities.refresh();
            return this;
        }
    };

})(window);

