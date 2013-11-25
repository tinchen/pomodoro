(function (undefined) {
    var window = this;
    var $ = window.$;
    var token = null;

    window.baiduStorage = {
        getToken : function(callback) {
            var url = 'https://openapi.baidu.com/oauth/2.0/authorize?';
            url += 'response_type=token&client_id=HNP1IGXKtvILVPGrGaRxF1lN&';
            url += 'redirect_uri=oob&scope=netdisk';
        },
        save : function(key, data, callback) {
            if (token === null) {
                this.getToken(function() {
                    window.baiduStorage(key, data, callback);
                });
            }
            else {
                // real save
                console.log(key);
            }
        }
    };

})();
