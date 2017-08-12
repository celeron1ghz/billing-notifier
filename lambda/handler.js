'use strict';

const aws = require('aws-sdk');
const cb  = new aws.CodeBuild();

module.exports.kicker = (event, context, callback) => {
    cb.startBuild({ projectName: 'billing-notifier-etc' }, function(err, ret){
        callback(err, ret.build);
    })
};

module.exports.status_getter = (event, context, callback) => {
    cb.batchGetBuilds({ ids: [event.id] }, function(err, ret){
        callback(err, ret.builds[0]);
    });
};

module.exports.etc = require('./etc.js');
