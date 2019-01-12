'use strict';

const aws = require('aws-sdk');
const EtcMeisaiParser = require('./src/EtcMeisaiPageParser');
const ViewCardMeisaiParser = require('./src/ViewCardMeisaiPageParser');

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
