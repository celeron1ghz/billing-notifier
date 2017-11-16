'use strict';

const vo  = require('vo');
const aws = require('aws-sdk');
const s3  = new aws.S3({ signatureVersion: "v4" });

const now = new Date();
const BUCKET = "billing-notifier";
const CODEBUILD_ARTIFACT_PATH = "codebuild_result/viewcard.txt";
const S3_HISTORY_PATH = `viewcard/${now.getFullYear()}${ ("0"+(now.getMonth() + 1)).slice(-2) }.json`;

const post_message = (param) => new Promise((resolve,reject) => {
    const Slack   = require('slack-node');
    const slack   = new Slack();
    slack.setWebhook(process.env.BILLING_NOTIFIER_SLACK_WEBHOOK_URL);
    slack.webhook(param, (err,res) => {
        if (err) { reject(err) } else { resolve(res) }
    }) 
});

function get_old_history()  {
    return vo(function*(){
        console.log(`S3.getObject(${BUCKET}#${S3_HISTORY_PATH})`);

        const old_history = yield s3.getObject({ Bucket: BUCKET, Key: S3_HISTORY_PATH }).promise()
            .then(data => JSON.parse(data.Body.toString()) )
            .catch(err => { console.log("old_history=none. reason: " + err); return [] });

        console.log(`old_history=${old_history.length}`);

        return old_history;
    });
}

function get_new_history()  {
    return vo(function*(){
        console.log(`S3.getObject(${BUCKET}#${CODEBUILD_ARTIFACT_PATH})`);
        const cb_result   = yield s3.getObject({ Bucket: BUCKET, Key: CODEBUILD_ARTIFACT_PATH }).promise();
        const new_history = JSON.parse(cb_result.Body.toString());
        return new_history;
    });
}

module.exports = (event, context, callback) => {
    vo(function*(){
        // fetch old history
        const old_history = yield get_old_history();
        const old_idx = {};
        old_history.forEach(h => {
            const key = `${h.date} ${h.shop} ${h.price}`;
            if (!old_idx[key]) { old_idx[key] = 1 }
            else               { old_idx[key]++   }
        });

        // fetch new history
        const new_history = yield get_new_history();
        const month_total = {};
        new_history.forEach(h => {
            const mon = h.date.split('/').splice(0,2).join('/');
            h.price = parseInt(h.price);
            h.month = mon;
            if (month_total[mon]) { month_total[mon] += h.price }
            else                  { month_total[mon] =  h.price }
        });

        // calc notify entry
        const notify_history = new_history.filter(h => { const key = `${h.date} ${h.shop} ${h.price}`; return !old_idx[key] });
        console.log(`new_history=${new_history.length}, notify_history=${notify_history.length}`);

        const genred = {};
        notify_history.forEach(h => {
            const mon = h.month;

            if (genred[mon] == null) genred[mon] = [];
            genred[mon].push({
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
                    text:  `¥${month_total[key]}-`,
                });

                yield post_message({
                    username:    `VIEW Card Billing (${key})`,
                    icon_emoji:  ':viewcard:',
                    mrkdwn:      true,
                    attachments: attaches,
                });
            }
        }

        const save = yield s3.putObject({ Bucket: BUCKET, Key: S3_HISTORY_PATH, Body: JSON.stringify(new_history) }).promise();
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
