
var crypto = require("crypto");

function validate_signature(signature, body)
{
    const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
    return signature == crypto.createHmac('sha256', LINE_CHANNEL_SECRET).update(Buffer.from(JSON.stringify(body))).digest('base64');
}

module.exports = function(context, req) {
    context.log('Node.js HTTP trigger function processed a request. RequestUri=%s', req.originalUrl);

    if (validate_signature(req.headers['x-line-signature'], req.body)) {
	context.bindings.outputQueueItem = req.body;
    }
    else {
	context.log('fail to validate signature');
    }
    
    context.res = { body : "" };
    context.done();
};
