'use strict';

module.exports.runner = async (event, context) => {
  if (!process.env.TARGETS)   {
    throw Error('env TARGETS not specified');
  }

  console.log("Targets:", process.env.TARGETS);
  const sites = process.env.TARGETS.split(',').map(t => { const clazz = require('./src/' + t); return new clazz });

  for (const site of sites)   {
    try {
      await site.init();
    } catch (e) {
      console.log("Error on init: ", e);
      return;
    }
  }

  process.env.HOME = "/opt/";

  for (const site of sites)   {
    try {
      const newData = await site.parse();
      const oldData = await site.getMostRecentMeisai();

      if (process.env.DEBUG)    {
        console.log(newData);
      }

      await site.compareMeisai(oldData, newData);
      await site.storeMostRecentMeisai({ meisai: newData });
    } catch(e) {
      console.log("Error on fetch:", e);
      return;
    }
  }

  return 'OK';
};
