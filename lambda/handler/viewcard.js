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
        const filename = `${now.getFullYear()}${ ("0"+now.getMonth()).slice(-2) }.json`;

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

        // running codebuild for getting new etc history
        const cb_output_arn = event.artifacts.location;
        const bucket = cb_output_arn.split('/')[0].split(':')[5];
        const path   = cb_output_arn.replace(/^.*?\//, "") + "/viewcard.txt";

        console.log(`S3.getObject(${bucket}#${path})`);
        const cb_result = yield s3.getObject({ Bucket: bucket, Key: path }).promise();

        const new_history    = JSON.parse(cb_result.Body.toString());
        const notify_history = new_history.slice(old_history.length, new_history.length + 1);
        console.log(`new_history=${new_history.length}, notify_history=${notify_history.length}`);


        // post to slack
        const genred = {};
        const price = {};
        notify_history.forEach(h => {
            const month = h.date.split('/').splice(0,2).join('/');

            if (price[month] == null) price[month] = 0;
            price[month] += parseInt(h.price);

            if (genred[month] == null) genred[month] = [];
            genred[month].push({
                title: `${h.date} ${h.shop}`,
                text:  `\`¥${h.price}-\``,
                color: 'good',
                mrkdwn_in: ['text'],
            });
        });


        if (new_history.length > 0) {
            const keys = Object.keys(genred)

            for (const key of keys) {
                const attaches = genred[key];

                attaches.push({
                    title: `${key} total price`,
                    text:  `¥${price[key]}-`,
                });

                yield post_message({
                    username:    `VIEW Card Billing (${key})`,
                    icon_emoji:  ':viewcard:',
                    mrkdwn:      true,
                    attachments: attaches,
                });
            }
        }

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
