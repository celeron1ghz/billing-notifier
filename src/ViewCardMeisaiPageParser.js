const PageParser = require('./Pageparser')

class ViewCardMeisaiParser extends PageParser {
  async init() {
    await super.init();
    this.id = await this.ssm.getParameter({ Name: '/webservice/viewcard/user_id',  WithDecryption: true }).promise().then(d => d.Parameter.Value);
    this.password = await this.ssm.getParameter({ Name: '/webservice/viewcard/password', WithDecryption: true }).promise().then(d => d.Parameter.Value);
    this.name = 'viewcard';
  }

  async login() {
    const url = 'https://viewsnet.jp/';
    await this.page.goto(url, { waitUntil: ['domcontentloaded', 'networkidle0'] });
    await this.page.type("input[name=id]", this.id);
    await this.page.type("input[name=pass]", this.password);

    // login
    this.page.click("input[type=image]");
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });

    // meisai page
    this.page.click("a#vucGlobalNavi_LnkV0300_001Header");
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });

    // KAKUTEIZUMI page
    this.page.click("a#LnkYotei");
    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  }

  async parse_page() {
    return this.page.evaluate(() => {
      const trs = [...document.querySelectorAll("div#DivDetailInfo table tbody tr")];
      trs.shift();

      return trs.map(function(tr){
        const td1 = tr.querySelectorAll("td:nth-child(1)");
        const td2 = tr.querySelectorAll("td:nth-child(2)");
        const td3 = tr.querySelectorAll("td:nth-child(3)");
        const td4 = tr.querySelectorAll("td:nth-child(4)");

        return {
          date:    (td1.length != 0 ? [...td1[0].querySelectorAll("span")].map(e => e.textContent).join("/") : ""),
          card_no: (td2.length != 0 ? [...td2[0].querySelectorAll("span")][0].innerHTML : ""),
          shop:    (td3.length != 0 ? [...td3[0].querySelectorAll("strong")][0].textContent : ""),
          price:   (td4.length != 0 ? [...td4[0].querySelectorAll("strong")][0].textContent.replace(/,/g, "") : ""),
        };  
      }); 
    });
  }

  async goto_next_page() {
    try {
      await this.page.click("#LnkNextBottom");
      await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
      return true;
    } catch(e) {
      return false;
    }
  }
}

module.exports = ViewCardMeisaiParser;
