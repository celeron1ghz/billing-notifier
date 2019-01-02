class PageParser {
  constructor() {
    const aws = require('aws-sdk');

    if (process.env.IS_LOCAL)   {   
      //console.log("Running in local: loading credential from local ini");
      aws.config.credentials = new aws.SharedIniFileCredentials({ profile: 'default' }); 
    }

    this.aws = aws;
    this.s3  = new aws.S3();
    this.ssm = new aws.SSM();
    this.bucket = 'billing-notifier';
  }

  login()           { throw Error("abstract method: login") }
  parse_page()      { throw Error("abstract method: parse_page") }
  goto_next_page()  { throw Error("abstract method: goto_next_page") }

  async init() {
    const puppeteer = require('puppeteer');

    this.puppeteer = await puppeteer.launch({
      headless: true,
      //executablePath: '/opt/headless-chromium',
      args: ['--no-sandbox', '--disable-gpu', '--single-process'],
    });

    this.page = await this.puppeteer.newPage();
  }

  async parse() {
    await this.login();
    const meisais = [];

    while (true) {
      const ret = await this.parse_page();
      await this.screenshot();

      meisais.push(...ret);
      console.log(meisais.length);
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

    return await s3.putObject({ Bucket: this.bucket, Key: storeFile, Body: JSON.stringify(data) }).promise();
  }

  async getMostRecentMeisai() {
    const now = new Date();
    const storeFile = `${this.name}/${now.getFullYear()}${ ("0"+(now.getMonth() + 1)).slice(-2) }.json`;

    return await this.s3.getObject({ Bucket: this.bucket, Key: storeFile }).promise()
      .then(data => JSON.parse(data.Body.toString()))
      .catch(err => { console.log("Error on old_history. reason: " + err); return null });
  }
}

module.exports = PageParser;
