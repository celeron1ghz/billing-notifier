'use strict';

const moji = require('moji');
const aws = require('aws-sdk');
const s3  = new aws.S3({ signatureVersion: "v4" });
const ssm = new aws.SSM();

const now = new Date();
const BUCKET = "billing-notifier";
const CODEBUILD_ARTIFACT_PATH = "result/viewcard.txt";
const S3_HISTORY_PATH = `viewcard/${now.getFullYear()}${ ("0"+(now.getMonth() + 1)).slice(-2) }.json`;

function get_old_history()  {
  return (async () => {
    const old_history = await s3.getObject({ Bucket: BUCKET, Key: S3_HISTORY_PATH }).promise()
      .then(data => JSON.parse(data.Body.toString()) )
      .catch(err => { console.log("old_history=none. reason: " + err); return [] });

    console.log(`old_history=${old_history.length}`);

    return old_history;
  })();
}

function get_new_history()  {
  return (async () => {
    const cb_result   = await s3.getObject({ Bucket: BUCKET, Key: CODEBUILD_ARTIFACT_PATH }).promise();
    const new_history = JSON.parse(cb_result.Body.toString());
    return new_history;
  })();
}

module.exports = async (event, context, callback) => {
  try {
    // fetch old history
    const old_history = await get_old_history();
    const old_idx = {};
    old_history.forEach(h => {
      const key = `${h.date} ${h.shop} ${h.price}`;
      if (!old_idx[key]) { old_idx[key] = 1 }
      else               { old_idx[key]++   }
    });

    // fetch new history
    let total = 0;
    const data = await get_new_history();
    const new_history = data.meisai;
    const monthTotalAll = {};
    new_history.forEach(h => {
      const month = h.date.split('/').splice(0,2).join('/');
      h.price = parseInt(h.price);
      h.month = month;
      if (monthTotalAll[month]) { monthTotalAll[month] += h.price }
      else                      { monthTotalAll[month] =  h.price }
      total += h.price;
    });

    // calc notify entry
    const notify_history = new_history.filter(h => { const key = `${h.date} ${h.shop} ${h.price}`; return !old_idx[key] });
    console.log(`new_history=${new_history.length}, notify_history=${notify_history.length}`);

    const monthTotalDiff = {};
    const formatted = [];
    notify_history.forEach(h => {
      const month = h.month;

      if (!monthTotalDiff[month]) monthTotalDiff[month] = 0;
      monthTotalDiff[month] += h.price;

      formatted.push(
        "*" + h.date.split('/').splice(1).join('/')
          +  "* `¥" + h.price + "-` "
          + moji(h.shop)
            .convert("ZE", "HE")
            .convert("ZS", "HS")
            .convert("ZK", "HK")
            .toString(),
      );
    });

    if (new_history.length > 0) {
      formatted.push("\n"); // separator

      for (const key of Object.keys(monthTotalDiff))    {
        formatted.push(
          "*" + key + " Added Price* : `¥" + monthTotalDiff[key] + "-`",
        );
      }

      formatted.push("\n"); // separator

      for (const key of Object.keys(monthTotalAll))    {
        formatted.push(
          "*" + key + " Total Price* : `¥" + monthTotalAll[key] + "-`",
        );
      }

      formatted.push("\n"); // separator
      formatted.push(
        "*Total Price* : `¥" + total + "-`",
      );


      const hook_url = await ssm.getParameter({ Name: '/slack/webhook/sensitive', WithDecryption: true }).promise().then(d => d.Parameter.Value);

      await new Promise((resolve,reject) => {
        const Slack   = require('slack-node');
        const slack   = new Slack();
        slack.setWebhook(hook_url);
        slack.webhook({
            username:    "VIEW Card Billing",
            icon_emoji:  ':viewcard:',
            mrkdwn:      true,
            text       : formatted.join("\n"),
        }, (err,res) => {
            if (err) { reject(err) } else { resolve(res) }
        })
      });
    }

    const save = await s3.putObject({ Bucket: BUCKET, Key: S3_HISTORY_PATH, Body: JSON.stringify(new_history) }).promise();

    callback(null, {
      old:    old_history.length,
      new:    new_history.length,
      notify: notify_history.length,
    });
  } catch(err) {
    console.log(err);
  }
};
