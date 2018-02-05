'use strict';

const PageParser = require('./PageParser');

class EtcMeisaiParser extends PageParser {
    constructor(user_id, password) {
      super(user_id,password);
      this.login_page_url = 'https://www2.etc-meisai.jp/etc/R?funccode=1013000000&nextfunc=1013000000';
    }

    login(nightmare) {
      nightmare
         // login
        .type("input[name=risLoginId]", this.user_id)
        .type("input[name=risPassword]", this.password)
        .click("input[name=focusTarget]")
        .wait("table.meisaiinfo")
        // choose previous month
        .click("table.meisaiinfo > tbody > tr:nth-child(3) > td > table:nth-child(3) > tbody > tr > td:nth-last-child(3) button")
        .wait(1000)
    }

    parse_page(document) {
      const css     = (parent, selector) => [].slice.apply(parent.querySelectorAll(selector));
      const rm_nbsp = (val)              => val.replace(/&nbsp;/g, "");

      return css(document, "tr.meisai, tr.meisai_r").map(function(tr){
        const td1 = css(tr, "td:nth-child(2) > table > tbody > tr > td > span").map(function(span){ return span.innerHTML });
        const td2 = tr.querySelector("td:nth-child(3) span").innerHTML;
        const td4 = tr.querySelector("td:nth-child(5) span").innerHTML;
        const from  = td1[0].split('<br>');
        const to    = td1[1].split('<br>');
        const price = td2.split('<br>');
        const meta  = td4.split('<br>');

        return {
          from_date:  rm_nbsp(from[0]),
          from_time:  rm_nbsp(from[1]),
          from_place: rm_nbsp(from[2]),
          to_date:    to[0],
          to_time:    to[1],
          to_place:   to[2],
          price:      price[2].replace(/,/g, ""),
          type:       meta[0],
          car_no:     meta[1],
          etc_no:     meta[2],
        }
      });
    }

    has_next_page(document) {
      return document.querySelector("table.meisaiinfo > tbody > tr:nth-child(4) table tbody tr td.plink:last-child button")
    }

    goto_next_page(nightmare) {
      nightmare.click("table.meisaiinfo > tbody > tr:nth-child(4) table tbody tr td.plink:last-child button")
        .wait("table.meisaiinfo")
        .wait(1000);
    }
}

module.exports = EtcMeisaiParser;
