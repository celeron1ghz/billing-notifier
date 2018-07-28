const ViewCardParser  = require('./ViewCardParser');
const EtcMeisaiParser = require('./EtcMeisaiParser');

process.env.AWS_REGION = 'ap-northeast-1';
const aws = require('aws-sdk');
const s3  = new aws.S3({ region: 'ap-northeast-1' });
const ssm = new aws.SSM();

const config = [
    {
        type: 'etc',
        user_id: '/webservice/etc_meisai/user_id',
        password: '/webservice/etc_meisai/password',
    },
    {
        type: 'viewcard',
        user_id: '/webservice/viewcard/user_id',
        password: '/webservice/viewcard/password',
    },
];

(async () => {
    try {
        for (const c of config) {
            console.log("PARSE:", c.type);
            const id   = await ssm.getParameter({ Name: c.user_id,  WithDecryption: true }).promise().then(d => d.Parameter.Value);
            const pass = await ssm.getParameter({ Name: c.password, WithDecryption: true }).promise().then(d => d.Parameter.Value);

            const parser = c.type === "etc" ? new EtcMeisaiParser(id,pass) : new ViewCardParser(id,pass);
            const ret = await parser.parse().catch(err => { console.log("Error on loop:", err); return [] });
            //console.log(" ==> ", c.type, JSON.stringify(ret))
            await s3.putObject({ Bucket: 'billing-notifier', Key: "result/" + c.type + ".txt", Body: JSON.stringify(ret) }).promise();
        }
    } catch (e) {
        console.log("Error on global:", e);
    }
})();
