const PageParser = require('./PageParser')

class EtcMileParser extends PageParser {
  async init() {
    await super.init();
    this.id = await this.ssm.getParameter({ Name: '/webservice/etc_mile/user_id',  WithDecryption: true }).promise().then(d => d.Parameter.Value);
    this.password = await this.ssm.getParameter({ Name: '/webservice/etc_mile/password', WithDecryption: true }).promise().then(d => d.Parameter.Value);
    this.name = 'etc_mile';
  }

  async login() {
    const url = 'https://www2.smile-etc.jp/NASApp/etcmlg/MlgReq?gvlddpef=1013000000&mdwsetmb=1013000000';
    await this.page.goto(url, { waitUntil: ['domcontentloaded', 'networkidle0'] });
    await this.page.type("input[name=mlgloginid]", this.id);
    await this.page.type("input[name=mlgpassword]", this.password);

    this.page.click("input[type=submit]");
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  }

  async parse_page() {
    return this.page.evaluate(() => {
      const trs = [...document.querySelectorAll("table[bordercolor='#DEFFF7'] tr[bgcolor='#FFFFFF']")];
      return trs.map(tr => {
        return {
          road_area: tr.querySelector('td:nth-child(1) strong').textContent,
          point: tr.querySelector('td:nth-child(2)').textContent,
        }
      })
      .filter(row => row.point !== '0');
    });
  }

  async goto_next_page() {
    return false;
  }

  async compareMeisai(oldData, newData) {
    const oldPoint = {};
    const newPoint = {};

    oldData = !!oldData ? oldData.meisai : [];
    newData = newData || [];

    for (const o of oldData)  {
      oldPoint[o.road_area] = o;
    }

    for (const n of newData)  {
      newPoint[n.road_area] = n;
    }

    const changed = [];

    // compare to old
    for (const key of Object.keys(newPoint)) {
      const o = oldPoint[key];
      const n = newPoint[key];

      if (o.point === n.point)  {
        continue;
      }

      changed.push(`*${n.road_area}* => ${n.point}mile`);
    }

    console.log(`etc_mile: notify=${changed.length}`);

    if (changed.length > 0) {
      await this.postToSlack({
        username: 'ETC Mile',
        icon_emoji: ':etc_mile:',
        mrkdwn: true,
        text: changed.join("\n"),
      });
    }
  }
}

module.exports = EtcMileParser;
