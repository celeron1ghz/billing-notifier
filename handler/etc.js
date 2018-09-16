'use strict';

const Slack = require('slack-node');
const aws = require('aws-sdk');
const s3  = new aws.S3({ signatureVersion: "v4" });
const ssm = new aws.SSM();

const BUCKET = "billing-notifier";
const newFile = "result/etc.txt";
const now = new Date();
const storeFile = `etc/${now.getFullYear()}${ ("0"+(now.getMonth() + 1)).slice(-2) }.json`;

module.exports = async (event, context, callback) => {
  try {
    const oldData = await s3.getObject({ Bucket: BUCKET, Key: storeFile }).promise()
      .then(data => JSON.parse(data.Body.toString()))
      .catch(err => { console.log("Error on old_history. reason: " + err); return null });

    const newData = await s3.getObject({ Bucket: BUCKET, Key: newFile }).promise()
      .then(data => JSON.parse(data.Body.toString()))
      .catch(err => { console.log("Error on new_history. reason: " + err); return null });

    const oldHistory = !!oldData ? oldData.meisai : [];
    const newHistory = !!newData ? newData.meisai : [];
    const notifyHistory = newHistory.slice(oldHistory.length, newHistory.length + 1);

    console.log(`old=${oldHistory.length}, new=${newHistory.length}, notify=${notifyHistory.length}`);

    // post to slack
    const ret = notifyHistory.map(h => {
      const date = h.to_date.split('/').splice(1).join('/');

      const place = !!h.from_place && !!h.to_place
        ? h.from_place + "→" + h.to_place
        : h.to_place;

      const time = h.from_time === h.to_time
        ? h.to_time
        : h.from_time + "→" + h.to_time;

      return "*" + date + "* `¥" + h.price + "-` " + place + " (" + time + ")";
    });

    if (ret.length > 0) {
      ret.push(
        "\n*Total Price*: `¥" + newHistory.reduce((a,b) => a + parseInt(b.price), 0) + "-` :money_with_wings:",
      );
    }

    await new Promise((resolve,reject) => {
      const slack   = new Slack();
      slack.setWebhook(process.env.SLACK_WEBHOOK_URL);
      slack.webhook({
        username: 'ETC Billing',
        icon_emoji: ':etc:',
        mrkdwn: true,
        text: ret.join("\n"),
      }, (err,res) => {
        if (err) { reject(err) } else { resolve(res) }
      })
    });

    await s3.putObject({ Bucket: BUCKET, Key: storeFile, Body: JSON.stringify(newData) }).promise();

    callback(null, {
      old:    oldHistory.length,
      new:    newHistory.length,
      notify: notifyHistory.length,
    });
  } catch(err) {
      console.log(err);
  }
};
