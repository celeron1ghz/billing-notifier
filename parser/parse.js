const vo = require('vo');
const ViewCardParser  = require('./ViewCardParser');
const EtcMeisaiParser = require('./EtcMeisaiParser');

const config = [
    {
        type: 'etc',
        user_id: '/etc_meisai/user_id',
        password: '/etc_meisai/password',
    },
    {
        type: 'viewcard',
        user_id: '/viewcard/user_id',
        password: '/viewcard/password',
    },
];

vo(function*(){
    process.env.AWS_REGION = 'ap-northeast-1';
    const aws = require('aws-sdk');
    const ssm = new aws.SSM();

    for (const c of config) {
        console.log(c.type);
        const id   = (yield ssm.getParameter({ Name: c.user_id,  WithDecryption: true }).promise() ).Parameter.Value;
        const pass = (yield ssm.getParameter({ Name: c.password, WithDecryption: true }).promise() ).Parameter.Value;

        console.log(" ==> parsing...");
        const parser = c.type === "etc" ? new EtcMeisaiParser(id,pass) : new ViewCardParser(id,pass);
        const ret = yield parser.parse().catch(err => { console.log("Error on loop:", err); return [] });
        console.log(" ==> ", c.type, JSON.stringify(ret))
    }

}).catch(err => { console.log("Error on global:", err) })
