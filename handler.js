'use strict';

const aws = require('aws-sdk');
const cb = new aws.CodeBuild();
const EtcMeisaiParser = require('./src/EtcMeisaiPageParser');
const ViewCardMeisaiParser = require('./src/ViewCardMeisaiPageParser');

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

module.exports.main = async (event, context) => {
  try {
    const etc = new ViewCardMeisaiParser();
    //const etc = new EtcMeisaiParser();
    await etc.init();

    process.env.HOME = "/opt/";

    const newData = await etc.parse();
    const oldData = await etc.getMostRecentMeisai();
    await etc.compareMeisai(oldData, newData);

  } catch(e) {
    console.log("Error happen:", e);
  }

  return { message: 'OK' };
};
