'use strict';

(function (window, undefined) {

    var localStorage = window.localStorage;

    var storage = function (key, val) {
        if (arguments.length === 1) {
            return localStorage.getItem(key);
        }

        localStorage.setItem(key, val);
    };

    window.storage = storage;

})(window);
