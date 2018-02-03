'use strict';

const vo  = require('vo');

class ViewCardParser {
    constructor(user_id, password) {
        this.user_id  = user_id;
        this.password = password;
    }

    parse() {
        const nightmare = new require('nightmare')({ show: true });
        //const nightmare = new require('nightmare')();
        const id   = this.user_id
        const pass = this.password;

        return vo(function*(){
            const url  = 'https://viewsnet.jp/';

            let result = [];
            nightmare.viewport(1000, 1000)
                .useragent("Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36")
                .goto(url)
                // login
                .type("input[name=id]", id)
                .type("input[name=pass]", pass)
                .click("input[type=image]")
                .wait(1000)
                // 
                .click("a#vucGlobalNavi_LnkV0300_001Header")
                .wait(1000)
                //
                .click("a#LnkYotei")
                .wait(1000)

            while (true)   {
                const meisai = yield nightmare.evaluate(function () {
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
                });

                meisai.shift();
                result = result.concat(meisai);

                const next_button = yield nightmare.evaluate(
                    () => document.querySelector("#LnkNextBottom")
                );

                if (!next_button)  {
                    break;
                }

                nightmare.click("#LnkNextBottom")
                    .wait("div#DivDetailInfo")
                    .wait(1000);
            }

            yield nightmare.end();
            return result;
        })
    }
}

vo(function*(){
    process.env.AWS_REGION = 'ap-northeast-1';
    const aws = require('aws-sdk');
    const ssm = new aws.SSM();
    const id   = (yield ssm.getParameter({ Name: '/viewcard/user_id',  WithDecryption: true }).promise() ).Parameter.Value;
    const pass = (yield ssm.getParameter({ Name: '/viewcard/password', WithDecryption: true }).promise() ).Parameter.Value;
    const ret = yield new ViewCardParser(id, pass)
        .parse()
        .catch(err => { throw new Error(err) });
    console.log(JSON.stringify(ret))
}).catch(err => { throw new Error(err) })
