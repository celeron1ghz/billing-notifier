'use strict';

const aws = require('aws-sdk');
const s3  = new aws.S3({ signatureVersion: "v4" });
const ssm = new aws.SSM();
const BUCKET = "billing-notifier";

module.exports = async (event, context, callback) => {
    try {
        const now = new Date();
        const filename = `etc/${now.getFullYear()}${ ("0"+(now.getMonth() + 1)).slice(-2) }.json`;

        // getting etc history from s3
        const old_history = await s3.getObject({ Bucket: BUCKET, Key: filename }).promise()
            .then(data => {
                const ret = JSON.parse(data.Body.toString());
                console.log(`old_history=${ret.length}`);
                return ret;
            })
            .catch(err => {
                console.log("old_history=none. reason: " + err);
                return [];
            });

        const path   = "result/etc.txt";
        const cb_result = await s3.getObject({ Bucket: BUCKET, Key: path }).promise();
        const data = JSON.parse(cb_result.Body.toString());
        const new_history = data.meisai;

        const notify_history = new_history.slice(old_history.length, new_history.length + 1);
        console.log(`new_history=${new_history.length}, notify_history=${notify_history.length}`);

        // post to slack
        const ret = notify_history.map(h => {
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
              "\n*Total Price*: `¥" + new_history.reduce((a,b) => a + parseInt(b.price), 0) + "-` :money_with_wings:",
            );
        }

        const hook_url = await ssm.getParameter({ Name: '/slack/webhook/sensitive', WithDecryption: true }).promise().then(d => d.Parameter.Value);

        await new Promise((resolve,reject) => {
            const Slack   = require('slack-node');
            const slack   = new Slack();
            slack.setWebhook(hook_url);
            slack.webhook({
                username:    'ETC Billing',
                icon_emoji:  ':etc:',
                mrkdwn:      true,
                text:        ret.join("\n"),
            }, (err,res) => {
                if (err) { reject(err) } else { resolve(res) }
            })
        });

        const save = await s3.putObject({ Bucket: BUCKET, Key: filename, Body: JSON.stringify(new_history) }).promise();
        callback(null, {
            old:    old_history.length,
            new:    new_history.length,
            notify: notify_history.length,
        });
    } catch(err) {
        console.log(err);
    }
};
