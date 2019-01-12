const moji = require('moji');
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
      //trs.shift();

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

  async compareMeisai(oldData, newData) {
    const oldHistory = !!oldData ? oldData.meisai : [];
    const newHistory = !!newData ? newData : [];
    //const oldBalance = !!oldData ? oldData.misc : [];
    //const newBalance = !!newData ? newData.misc : [];

    let total = 0;
    const old_idx = {};
    const monthTotalAll = {};
    const monthTotalDiff = {};
    const formatted = [];

    oldHistory.forEach(h => {
      const key = `${h.date} ${h.shop} ${h.price}`;
      if (!old_idx[key]) { old_idx[key] = 1 }
      else               { old_idx[key]++   }
    });

    newHistory.forEach(h => {
      const month = h.date.split('/').splice(0,2).join('/');
      h.price = parseInt(h.price);
      h.month = month;
      if (monthTotalAll[month]) { monthTotalAll[month] += h.price }
      else                      { monthTotalAll[month] =  h.price }
      total += h.price;
    });

    const notifyHistory = newHistory.filter(h => { const key = `${h.date} ${h.shop} ${h.price}`; return !old_idx[key] });
    console.log(`new=${newHistory.length}, notify=${notifyHistory.length}`);

    notifyHistory.forEach(h => {
      const month = h.month;

      if (!monthTotalDiff[month]) monthTotalDiff[month] = 0;
      monthTotalDiff[month] += h.price;

      formatted.push(
        "*" + h.date.split('/').splice(1).join('/')
          +  "* `¥" + h.price + "-` "
          + moji(h.shop)
            .convert("ZE", "HE")
            .convert("ZS", "HS")
            .convert("ZK", "HK")
            .toString(),
      );
    });

    if (formatted.length > 0) {
      formatted.push("\n"); // separator

      for (const key of Object.keys(monthTotalDiff))    {
        formatted.push(
          "*" + key + " Added Price* : `¥" + monthTotalDiff[key] + "-`",
        );
      }

      formatted.push("\n"); // separator

      for (const key of Object.keys(monthTotalAll))    {
        formatted.push(
          "*" + key + " Total Price* : `¥" + monthTotalAll[key] + "-`",
        );
      }

      formatted.push(
        "",
        "*Total Price* : `¥" + total + "-`",
      );

      //if (oldBalance.remain !== newBalance.remain)  {
      //  formatted.push(
      //    "",
      //    "*Balance* : remain=`¥" + newBalance.remain + "-`, using=`¥" + newBalance.using + "-`",
      //  );
      //}

      await this.postToSlack({
        username:    "VIEW Card Billing",
        icon_emoji:  ':viewcard:',
        mrkdwn:      true,
        text       : formatted.join("\n"),
      });
    }
  }
}

module.exports = ViewCardMeisaiParser;
