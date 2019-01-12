async function getPuppeteer() {
  const aws = require('aws-sdk');
  const puppeteer_params = {
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--single-process'],
  };

  let browser;

  const Slack = require('slack-node');
  const slack = new Slack();
  slack.setWebhook(process.env.SLACK_WEBHOOK_URL);

  if (process.env.IS_LOCAL)   {
    aws.config.credentials = new aws.SharedIniFileCredentials({ profile: 'default' });

    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch(puppeteer_params);

  } else {
    puppeteer_params.executablePath = '/opt/headless-chromium';

    const puppeteer = require('puppeteer-core');
    browser = await puppeteer.launch(puppeteer_params);
  }

  return { browser, aws, slack };
}

class PageParser {
  login()           { throw Error("abstract method: login") }
  parse_page()      { throw Error("abstract method: parse_page") }
  goto_next_page()  { throw Error("abstract method: goto_next_page") }
  compareMeisai()  { throw Error("abstract method: compareMeisai") }

  async init() {
    const { aws, browser, slack } = await getPuppeteer();

    this.aws = aws;
    this.s3  = new aws.S3();
    this.ssm = new aws.SSM();
    this.bucket = 'billing-notifier';

    this.puppeteer = browser;
    this.page = await this.puppeteer.newPage();

    this.slack = slack;
  }

  async parse() {
    await this.login();
    const meisais = [];

    while (true) {
      const ret = await this.parse_page();

      if (process.env.SCREENSHOT)   {
        await this.screenshot();
      }

      meisais.push(...ret);
      //console.log("GOT:", meisais.length);
      if (!await this.goto_next_page()) {
        break;
      }
    }

    return meisais;
  }

  async screenshot() {
    //const image = await page.screenshot();
    const image = await this.page.screenshot({ clip: { x: 0, y: 0, width: 1024, height: 800 } });
    const filename = 'ss/' + this.name + "-" + new Date().getTime() + '.png';
    console.log("screenshot:", filename);
    return this.s3.putObject({ Bucket: this.bucket, Key: filename, Body: image }).promise();
  }

  async storeMostRecentMeisai(data) {
    const now = new Date();
    const storeFile = `${this.name}/${now.getFullYear()}${ ("0"+(now.getMonth() + 1)).slice(-2) }.json`;

    return await this.s3.putObject({ Bucket: this.bucket, Key: storeFile, Body: JSON.stringify(data) }).promise();
  }

  async getMostRecentMeisai() {
    const now = new Date();
    const storeFile = `${this.name}/${now.getFullYear()}${ ("0"+(now.getMonth() + 1)).slice(-2) }.json`;

    return await this.s3.getObject({ Bucket: this.bucket, Key: storeFile }).promise()
      .then(data => JSON.parse(data.Body.toString()))
      .catch(err => { console.log("Error on old_history. reason: " + err); return null });
  }

  async postToSlack(param)  {
    return new Promise((resolve,reject) => {
      this.slack.webhook(param, (err,res) => {
        if (err) { reject(err) } else { resolve(res) }
      });
    });
  }
}

module.exports = PageParser;
