'use strict';

const moji = require('moji');
const aws = require('aws-sdk');
const s3  = new aws.S3({ signatureVersion: "v4" });
const ssm = new aws.SSM();

const BUCKET = "billing-notifier";
const CODEBUILD_ARTIFACT_PATH = "result/viewcard.txt";
const now = new Date();
const S3_HISTORY_PATH = `viewcard/${now.getFullYear()}${ ("0"+(now.getMonth() + 1)).slice(-2) }.json`;

module.exports = async (event, context, callback) => {
  try {
    const oldData = await s3.getObject({ Bucket: BUCKET, Key: S3_HISTORY_PATH }).promise()
      .then(data => JSON.parse(data.Body.toString()))
      .catch(err => { console.log("Error on old_history. reason: " + err); return null });

    const newData = await s3.getObject({ Bucket: BUCKET, Key: CODEBUILD_ARTIFACT_PATH }).promise()
      .then(data => JSON.parse(data.Body.toString()))
      .catch(err => { console.log("Error on old_history. reason: " + err); return null });

    const oldHistory = !!oldData ? oldData.meisai : [];
    const newHistory = !!newData ? newData.meisai : [];
    const oldBalance = !!oldData ? oldData.misc : [];
    const newBalance = !!newData ? newData.misc : [];

    let total = 0;
    const old_idx = {};
    const monthTotalAll = {};
    const monthTotalDiff = {};
    const formatted = [];

    oldHistory.forEach(h => {
      const key = `${h.date} ${h.shop} ${h.price}`;
      if (!old_idx[key]) { old_idx[key] = 1 }
      else               { old_idx[key]++   }
    });

    newHistory.forEach(h => {
      const month = h.date.split('/').splice(0,2).join('/');
      h.price = parseInt(h.price);
      h.month = month;
      if (monthTotalAll[month]) { monthTotalAll[month] += h.price }
      else                      { monthTotalAll[month] =  h.price }
      total += h.price;
    });

    const notifyHistory = newHistory.filter(h => { const key = `${h.date} ${h.shop} ${h.price}`; return !old_idx[key] });
    console.log(`new=${newHistory.length}, notify=${notifyHistory.length}`);

    notifyHistory.forEach(h => {
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

    if (formatted.length > 0) {
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

      formatted.push(
        "",
        "*Total Price* : `¥" + total + "-`",
      );

      if (oldBalance.remain !== newBalance.remain)  {
        formatted.push(
          "",
          "*Balance* : remain=`¥" + newBalance.remain + "-`, using=`¥" + newBalance.using + "-`",
        );
      }

      await new Promise((resolve,reject) => {
        const Slack   = require('slack-node');
        const slack   = new Slack();
        slack.setWebhook(process.env.SLACK_WEBHOOK_URL);
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

    await s3.putObject({ Bucket: BUCKET, Key: S3_HISTORY_PATH, Body: JSON.stringify(newData) }).promise();

    callback(null, {
      old:    oldHistory.length,
      new:    newHistory.length,
      notify: notifyHistory.length,
    });
  } catch(err) {
    console.log(err);
  }
};
