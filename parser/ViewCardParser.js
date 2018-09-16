'use strict';

const PageParser = require('./PageParser');

class ViewCardParser extends PageParser {
    constructor(user_id, password) {
      super(user_id,password);
      this.login_page_url = 'https://viewsnet.jp/';
    }

    login(nightmare) {
      nightmare
        .type("input[name=id]", this.user_id)
        .type("input[name=pass]", this.password)
        .click("input[type=image]")
        .wait(1000)
        //
        .click("a#vucGlobalNavi_LnkV0300_001Header")
        .wait(1000)
        //
        .click("a#LnkYotei")
        .wait(1000)
    }

    parse_page(document) {
      const css = (parent, selector) => [].slice.apply(parent.querySelectorAll(selector));
      const trs = css(document, "div#DivDetailInfo table tbody tr");
      trs.shift();

      return trs.map(function(tr){
        const td1 = css(tr, "td:nth-child(1)");
        const td2 = css(tr, "td:nth-child(2)");
        const td3 = css(tr, "td:nth-child(3)");
        const td4 = css(tr, "td:nth-child(4)");

        return {
          date:    (td1.length != 0 ? css(td1[0], "span").map(e => e.textContent).join("/") : ""),
          card_no: (td2.length != 0 ? css(td2[0], "span")[0].innerHTML : ""),
          shop:    (td3.length != 0 ? css(td3[0], "strong")[0].textContent : ""),
          price:   (td4.length != 0 ? css(td4[0], "strong")[0].textContent.replace(/,/g, "") : ""),
        };
      });
    }

    has_next_page(document) {
      return document.querySelector("#LnkNextBottom")
    }

    goto_next_page(nightmare) {
      nightmare.click("#LnkNextBottom")
        .wait("div#DivDetailInfo")
        .wait(1000);
    }

    afterParse() {
      return (async () => {
        this.nightmare
          .click("#vucGlobalNavi_LnkV0500_001Header")
          .wait(1000)
          .click("#BtnShow")
          .wait(1000);

        const html = await this.nightmare.evaluate(() => document.body.innerHTML);
        const { JSDOM } = require('jsdom');
        const { document } = new JSDOM(html).window;

        var ret = [].slice.apply(document.querySelectorAll("#PnlShowControl tbody tr:nth-child(3) td"));
        const row = ret.map(e => e.textContent)
            .map(v => v.replace(/,/g, ""))
            .map(v => parseInt(v));

        const result = {
            remain: row[0],
            limit: row[1],
            using: row[2],
        };

        return result
      })();
    }
}

module.exports = ViewCardParser;
