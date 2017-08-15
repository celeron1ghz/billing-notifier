const exec = require('child_process').execSync;

module.exports.kms = function(){
    const ret = {};

    ['BILLING_NOTIFIER_SLACK_WEBHOOK_URL', 'GENERAL_CREDSTASH_KMS_ID'].forEach(key => {
        const cred = exec(`credstash -r ap-northeast-1 get ${key}`).toString().replace("\n", "");
        ret[key] = cred;
    })

    return ret;
};
