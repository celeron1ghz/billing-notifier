'use strict';

const Slack = require('slack-node');
const aws = require('aws-sdk');
const s3  = new aws.S3({ signatureVersion: "v4" });
const ssm = new aws.SSM();
const BUCKET = "billing-notifier";

module.exports = async (event, context, callback) => {
    try {
        const now = new Date();
        const newFile = "result/etc.txt";
        const storeFile = `etc/${now.getFullYear()}${ ("0"+(now.getMonth() + 1)).slice(-2) }.json`;

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
            if (!h.from_place)  {
              //return `[料金所] ${h.to_place}(${h.to_date} ${h.to_time}) ¥${h.price}`;
              return [
                "`¥" + h.price + "-` : *" + h.to_place + "*",
                "  (" + h.to_date + " " + h.to_time + ")",
              ].join("\n");
            }
            if (!h.from_date)   {
              //return `[首都高速] ${h.from_place} -> ${h.to_place}(${h.to_date} ${h.to_time}) ¥${h.price}`;
              return [
                "`¥" + h.price + "-` : *" + h.from_place + "→" + h.to_place + "*" ,
                "  (" + h.to_date + " " + h.to_time + ")",
              ].join("\n");
            }

            //return `[高速自動車国道] ${h.from_place}(${h.from_date} ${h.from_time}) -> ${h.to_place}(${h.to_date} ${h.to_time}) ¥${h.price}`;
            return [
              "`¥" + h.price + "-` : *" + h.from_place + "→" + h.to_place + "*" ,
              `  (${h.from_date} ${h.from_time} → ${h.to_time})`,
            ].join("\n");
        });

        if (ret.length > 0) {
            ret.push(
              "\n*Total Price*: `¥" + newHistory.new_history.reduce((a,b) => a + parseInt(b.price), 0) + "-` :money_with_wings:",
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
