
var https = require("https");
var querystring = require('querystring');

var message_handler = [
    {
        "type"    : "location",
        "handler" : location_handler
    }
];

function make_date_str() {
    var d = new Date();
    d.setTime(d.getTime() + 1000 * 60 * 60 * 9); // UTC --> JST

    var year  = d.getFullYear();
    var month = d.getMonth() + 1;
    var date  = d.getDate();
    var hour  = d.getHours();
    var min   = d.getMinutes();

    if (month < 10) month = '0' + month;
    if (date  < 10) date  = '0' + date;
    if (hour  < 10) hour  = '0' + hour;
    if (min   < 10) min   = '0' + min;

    return [year, month, date, hour, min].reduce((pre, cur) => pre + cur.toString());
}

function make_yahoo_api_map_rainfall_url(lat, lon) {
    const yahoo_api_map_url = "http://map.olp.yahooapis.jp/OpenLocalPlatform/V1/static?";
    const zoom   = 11;
    const width  = 600;
    const height = 800;
    const query_str = querystring.stringify({
        "appid"   : process.env.YAHOO_APP_ID,
        "lat"     : lat,
        "lon"     : lon,
        "z"       : zoom,
        "width"   : width,
        "height"  : height,
        "pointer" : "on",
        "mode"    : "map",
        "overlay" : "type:rainfall|datelabel:on|date:" + make_date_str()
    });
    return yahoo_api_map_url + query_str;
}

function location_handler(context, event) {

    const url = make_yahoo_api_map_rainfall_url(event.message.latitude, event.message.longitude);
    context.log(url);

    return new Promise((resolve, reject) => {
        var req = https.request({
            host: 'www.googleapis.com',
            path: '/urlshortener/v1/url?key=' + process.env.GOOGLE_API_KEY,
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
        }, res => {
            var body = '';
            res.on('data', chunk => {
                body += chunk.toString();
            });
            res.on('end', () => {
                var d = JSON.parse(body);
                event.message = {
                    "type"               : "image",
                    "originalContentUrl" : d.id,
                    "previewImageUrl"    : d.id
                };
                resolve(event);
            });
            res.on('error', err => {
                event.message = {
                    "type" : "text",
                    "text" : err.message
                };
                reject(event);
            });
        });
        req.write(JSON.stringify({"longUrl" : url}));
        req.end();
    });
}

module.exports = function (context, myQueueItem) {
    context.log('Node.js queue trigger function processed work item', myQueueItem);

    var message_events = myQueueItem.events.filter(event => event.type == "message");

    var task = [];
    message_events.forEach(event => {
        for (var mh of message_handler) {
            if (mh.type == event.message.type) {
                event = mh.handler(context, event);
                break;
            }
        }
        task.push(event);
    });

    Promise.all(task).then(events => {
        myQueueItem.events = events;
        context.bindings.outputQueueItem = myQueueItem;
        context.done();
    }).catch(err => {
        context.log(err);
        context.done();
    });
};
