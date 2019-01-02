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
    this.name = this.constructor.name;
  }

  async init() {
    const puppeteer = require('puppeteer');

    this.puppeteer = await puppeteer.launch({
      headless: true,
      //executablePath: '/opt/headless-chromium',
      args: ['--no-sandbox', '--disable-gpu', '--single-process'],
    });

    this.page = await this.puppeteer.newPage();
  }

  login()           { throw Error("abstract method: login") }
  parse_page()      { throw Error("abstract method: parse_page") }
  goto_next_page()  { throw Error("abstract method: goto_next_page") }

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
  }

  async screenshot() {
    //const image = await page.screenshot();
    const image = await this.page.screenshot({ clip: { x: 0, y: 0, width: 1024, height: 800 } });
    const filename = this.name + "-" + new Date().getTime() + '.png';
    console.log("screenshot:", filename);
    return this.s3.putObject({ Bucket: 'puppeteer-test2', Key: filename, Body: image }).promise();
  }
}

module.exports = PageParser;
