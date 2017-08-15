'use strict';

const vo  = require('vo');
const aws = require('aws-sdk');
const s3  = new aws.S3({ signatureVersion: "v4" });

const BUCKET = "billing-notifier";

const post_message = (param) => new Promise((resolve,reject) => {
    const Slack   = require('slack-node');
    const slack   = new Slack();
    slack.setWebhook(process.env.ETC_BILLING_NOTIFIER_SLACK_WEBHOOK_URL);
    slack.webhook(param, (err,res) => {
        if (err) { reject(err) } else { resolve(res) }
    }) 
});

module.exports = (event, context, callback) => {
    vo(function*(){
        const now = new Date();
        const filename = `etc/${now.getFullYear()}${ ("0"+now.getMonth()).slice(-2) }.json`;

        // getting etc history from s3
        console.log(`S3.getObject(${BUCKET}#${filename})`);
        const old_history = yield s3.getObject({ Bucket: BUCKET, Key: filename }).promise()
            .then(data => {
                const ret = JSON.parse(data.Body.toString());
                console.log(`old_history=${ret.length}`);
                return ret;
            })
            .catch(err => {
                console.log("old_history=none. reason: " + err);
                return [];
            });

        const path   = "codebuild_result/etc.txt";
        console.log(`S3.getObject(${BUCKET}#${path})`);

        const cb_result = yield s3.getObject({ Bucket: BUCKET, Key: path }).promise();

        const new_history    = JSON.parse(cb_result.Body.toString());
        const notify_history = new_history.slice(old_history.length, new_history.length + 1);
        console.log(`new_history=${new_history.length}, notify_history=${notify_history.length}`);


        // post to slack
        const ret = notify_history.map(h => {
            if (!h.from_place)  {
                //return `[料金所] ${h.to_place}(${h.to_date} ${h.to_time}) ¥${h.price}`;
                return {
                    title:     `[料金所] ${h.to_place}`,
                    text:      `${h.to_date} ${h.to_time}\n\`¥${h.price}-\``,
                    color:     'good',
                    mrkdwn_in: ['text'],
                };
            }
            if (!h.from_date)   {
                //return `[首都高速] ${h.from_place} -> ${h.to_place}(${h.to_date} ${h.to_time}) ¥${h.price}`;
                return {
                    title:     `[首都高速] ${h.from_place} -> ${h.to_place}`,
                    text:      `${h.to_date} ${h.to_time}\n\`¥${h.price}-\``,
                    color:     'good',
                    mrkdwn_in: ['text'],
                };
            }

            //return `[高速自動車国道] ${h.from_place}(${h.from_date} ${h.from_time}) -> ${h.to_place}(${h.to_date} ${h.to_time}) ¥${h.price}`;
            return {
                title:     `[高速自動車国道] ${h.from_place} -> ${h.to_place}`,
                text:      `${h.from_date} ${h.from_time} -> ${h.to_date} ${h.to_time}\n\`¥${h.price}-\``,
                color:     'good',
                mrkdwn_in: ['text'],
            };

        });

        if (ret.length > 0) {
            ret.push({
                title: "Total price in this month",
                text:  '¥' + new_history.reduce((a,b) => a + parseInt(b.price), 0) + '-',
            });
        }

        yield post_message({
            username:    'ETC Billing',
            icon_emoji:  ':etc:',
            mrkdwn:      true,
            attachments: ret,
        });

        const save = yield s3.putObject({ Bucket: BUCKET, Key: filename, Body: JSON.stringify(new_history) }).promise();
        callback(null, {
            old:    old_history.length,
            new:    new_history.length,
            notify: notify_history.length,
        });
    })
    .catch(err => {
        console.log(err);
    });
};
