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
    const sites = [
      new ViewCardMeisaiParser(),
      new EtcMeisaiParser(),
    ];

    for (const site of sites)   {
      await site.init();
    }

    process.env.HOME = "/opt/";

    for (const site of sites)   {
      const newData = await site.parse();
      const oldData = await site.getMostRecentMeisai();
      await site.compareMeisai(oldData, newData);
      await site.storeMostRecentMeisai({ meisai: newData });
    }

  } catch(e) {
    console.log("Error happen:", e);
  }

  return { message: 'OK' };
};
