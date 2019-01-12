const PageParser = require('./Pageparser')

class EtcMeisaiParser extends PageParser {
  async init() {
    await super.init();
    this.id = await this.ssm.getParameter({ Name: '/webservice/etc_meisai/user_id',  WithDecryption: true }).promise().then(d => d.Parameter.Value);
    this.password = await this.ssm.getParameter({ Name: '/webservice/etc_meisai/password', WithDecryption: true }).promise().then(d => d.Parameter.Value);
    this.name = 'etc';
  }

  async login() {
    const url = 'https://www2.etc-meisai.jp/etc/R?funccode=1013000000&nextfunc=1013000000';
    await this.page.goto(url, { waitUntil: ['domcontentloaded', 'networkidle0'] });
    await this.page.type("input[name=risLoginId]", this.id);
    await this.page.type("input[name=risPassword]", this.password);

    this.page.click("input[name=focusTarget]");
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });

    // previous month
    //const monthes = await this.page.$$(".meisaiinfo:last-child button.mlink_no");
    //monthes[monthes.length - 2].click();
    //await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  }

  async parse_page() {
    return this.page.evaluate(() => {
      const trs = [...document.querySelectorAll("tr.meisai, tr.meisai_r")];
      trs.shift();

      return trs.map(tr => {
        const td1 = [...tr.querySelectorAll("td:nth-child(2) > table > tbody > tr > td > span")].map(function(span){ return span.innerHTML }); 
        const td2 = tr.querySelector("td:nth-child(3) span").innerHTML;
        const td4 = tr.querySelector("td:nth-child(5) span").innerHTML;
        const from  = td1[0].split('<br>');
        const to    = td1[1].split('<br>');
        const price = td2.split('<br>');
        const meta  = td4.split('<br>');

        return {
          from_date:  from[0],
          from_time:  from[1],
          from_place: from[2],
          to_date:    to[0],
          to_time:    to[1],
          to_place:   to[2],
          price:      price[2].replace(/,/g, ""),
          type:       meta[0],
          car_no:     meta[1],
          etc_no:     meta[2],
        }
      })
    });
  }

  async goto_next_page() {
    try {
      await this.page.click("table.meisaiinfo > tbody > tr:nth-child(4) table tbody tr td.plink:last-child button");
      await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
      return true;
    } catch(e) {
      return false;
    }
  }

  compareMeisai(oldData, newData) {
    const oldHistory = !!oldData ? oldData.meisai : [];
    const newHistory = !!newData ? newData: [];
    const notifyHistory = newHistory.slice(oldHistory.length, newHistory.length + 1);

    console.log(`old=${oldHistory.length}, new=${newHistory.length}, notify=${notifyHistory.length}`);

    // post to slack
    const ret = notifyHistory.map(h => {
      const date = h.to_date.split('/').splice(1).join('/');

      const place = !!h.from_place && !!h.to_place
        ? h.from_place + "→" + h.to_place
        : h.to_place;

      const time = h.from_time === h.to_time
        ? h.to_time
        : h.from_time + "→" + h.to_time;

      return "*" + date + "* `¥" + h.price + "-` " + place + " (" + time + ")";
    });

    if (ret.length > 0) {
      ret.push(
        "\n*Total Price*: `¥" + newHistory.reduce((a,b) => a + parseInt(b.price), 0) + "-` :money_with_wings:",
      );
    }

    console.log(ret);
  }
}

module.exports = EtcMeisaiParser;
