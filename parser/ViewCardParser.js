'use strict';

class ViewCardParser {
    constructor(user_id, password) {
      this.user_id  = user_id;
      this.password = password;
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
    
    parse_page(self, done) {
        console.log("self", self)
        console.log("doc", document)
        const css = (parent, selector) => [].slice.apply(parent.querySelectorAll(selector));
        const trs = css(document, "div#DivDetailInfo table tbody tr");
        trs.shift();

        done(null, "popopo");
        /*
        done(null, trs.map(function(tr){
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
        }) );
        */
    }
    
    has_next_page(document) {
      return document.querySelector("#LnkNextBottom")
    }
    
    goto_next_page(nightmare) {
      nightmare.click("#LnkNextBottom")
        .wait("div#DivDetailInfo")
        .wait(1000);
    }

    parse() {
        const vo = require('vo');
        //const nightmare = new require('nightmare')({ show: true });
        const nightmare = new require('nightmare')();
        const aws = require('aws-sdk');
        const s3  = new aws.S3({ region: 'ap-northeast-1' });
        const fs = require('fs');
        const url  = this.login_page_url;
        
        const self = this;

        return vo(function*(){
            let result = [];

            console.log("FIRST_PAGE", url);
            nightmare.viewport(1000, 1000)
                .useragent("Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36")
                .goto(url)

            console.log("LOGIN");
            self.login(nightmare)

            while (true)   {
                const document = yield nightmare.evaluate(self.parse_page.bind(self), self);
                console.log(document);
                const meisai = [];
                meisai.shift();
                result = result.concat(meisai);
                console.log(" ==> PARSED ROWS ", meisai.length);
                console.log(" ==> TOTAL  ROWS ", result.length);

                const next_button = yield nightmare.evaluate(() => { console.log("2", arguments); return [] });

                if (!next_button)  {
                    console.log(" ==> LAST");
                    break;
                }

                console.log(" ==> NEXT")
                self.goto_next_page(nightmare)
            }

            yield nightmare.end();
            return result;
        })
    }
}

module.exports = ViewCardParser;
