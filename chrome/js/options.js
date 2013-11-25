'use strict';

(function (window, undefined) {

    var ENTER_KEY = 13;

    var ko = window.ko;
    var $ = window.$;
    var backgroundPage = window.chrome.extension.getBackgroundPage();
    var model = window.model;
    var options = model.options;
    var activities = model.activities;
    var todos = model.todos;

    // a custom binding to handle the enter key (could go in a separate library)
    ko.bindingHandlers.enterKey = {
        init: function (element, valueAccessor, allBindingsAccessor, data) {
            var wrappedHandler, newValueAccessor;

            // wrap the handler with a check for the enter key
            wrappedHandler = function (data, event) {
                if (event.keyCode === ENTER_KEY) {
                    valueAccessor().call(this, data, event);
                }
            };

            // create a valueAccessor with the options that we would want to pass to the event binding
            newValueAccessor = function () {
                return {
                    keyup: wrappedHandler
                };
            };

            // call the real event binding's init function
            ko.bindingHandlers.event.init(element, newValueAccessor, allBindingsAccessor, data);
        }
    };

    // wrapper to hasfocus that also selects text and applies focus async
    ko.bindingHandlers.selectAndFocus = {
        init: function (element, valueAccessor, allBindingsAccessor) {
            ko.bindingHandlers.hasfocus.init(element, valueAccessor, allBindingsAccessor);
            ko.utils.registerEventHandler(element, 'focus', function () {
                element.focus();
            });
        },
        update: function (element, valueAccessor) {
            ko.utils.unwrapObservable(valueAccessor()); // for dependency
            // ensure that element is visible before trying to focus
            setTimeout(function () {
                ko.bindingHandlers.hasfocus.update(element, valueAccessor);
            }, 0);
        }
    };

    ////////////////////////////////////////////////////////////////////////
    todos.editItem = function (item) {
        item.editing(true);
    };

    todos.stopEditing = function (item) {
        item.editing(false);

        var title = item.title();
        var trimmedTitle = title.trim();
        if (title !== trimmedTitle) {
            item.title(trimmedTitle);
        }
        if (!trimmedTitle) {
            todos.remove(item);
        }
    };

    todos.running = ko.computed(function () {
        //var resting = storage.state.contains('resting');
        return ko.utils.arrayFilter(todos.all(), function (todo) {
            return todo.running();
        }).length > 0;
    });

    // start the todo
    todos.start = function (todo) {
        activities.add(todo);
        backgroundPage.timer.click(todo.title());
    };

    // add a break to the running todo
    todos.breaked = function (todo) {
        activities.breaked(todo);
        //backgroundPage.model.refresh('activities');
    };

    // stop the running todo
    todos.stop = function (todo) {
        if (window.confirm('確定要取消 ' + todo.title() + ' 這次的番茄鐘嗎？')) {
            backgroundPage.timer.click(todo.title());
        }
    };

    activities.nickname = options.nickname();

    options.save = function () {
        //Utils.log(ko.toJSON(options));
        model.storage('options', ko.toJSON(options));
        window.alert('儲存成功！');
        //backgroundPage.model.refresh('options');
    };

    $(function() {
        ko.applyBindings(todos, $('#todos')[0]);
        ko.applyBindings(activities, $('#activities')[0]);
        ko.applyBindings(window.model.options, $('form[name="options-form"]')[0]);
        backgroundPage.optionsPage = window;
    });

})(window);

