'use strict';

const aws = require('aws-sdk');
const cb  = new aws.CodeBuild();

module.exports.kicker = (event, context, callback) => {
    cb.startBuild({ projectName: 'billing-notifier' }, function(err, ret){
        if (err)    {
            callback(err);
        } else {
            callback(null, ret.build);
        }
    })
};

module.exports.status_getter = (event, context, callback) => {
    cb.batchGetBuilds({ ids: [event.id] }, function(err, ret){
        if (err)    {
            callback(err);
        } else {
            callback(null, ret.builds[0]);
        }
    });
};

module.exports.etc      = require('./handler/etc.js');
module.exports.viewcard = require('./handler/viewcard.js');
