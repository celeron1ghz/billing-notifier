'use strict';

class EtcMeisaiParser {
    constructor(user_id, password) {
        this.user_id  = user_id;
        this.password = password;
    }

    parse() {
        const vo = require('vo');
        const aws = require('aws-sdk');
        const s3  = new aws.S3({ region: 'ap-northeast-1' });
        const fs = require('fs');
        //const nightmare = new require('nightmare')();
        const nightmare = new require('nightmare')({ show: true });
        const id   = this.user_id;
        const pass = this.password;

        return vo(function*(){
            const url  = 'https://www2.etc-meisai.jp/etc/R?funccode=1013000000&nextfunc=1013000000';

            let result = [];
            nightmare.viewport(1000, 1000)
                .useragent("Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36")
                .goto(url)
                // login
                .type("input[name=risLoginId]", id)
                .type("input[name=risPassword]", pass)
                .click("input[name=focusTarget]")
                .wait("table.meisaiinfo")
                // choose previous month
                .click("table.meisaiinfo > tbody > tr:nth-child(3) > td > table:nth-child(3) > tbody > tr > td:nth-last-child(3) button")
                .wait(1000)
                
            const aaa = nightmare.screenshot("/tmp/2.jpg")
            console.log(aaa)

            //yield s3.putObject({ Bucket: 'billing-notifier', Key: '2.jpg', Body: fs.readFileSync('/tmp/2.jpg') }).promise();

            
            while (true)   {
                const meisai = yield nightmare.evaluate(function () {
                    const css     = (parent, selector) => [].slice.apply(parent.querySelectorAll(selector));
                    const rm_nbsp = (val)              => val.replace(/&nbsp;/g, "");

                    try {
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
                    } catch(e) {
                        console.log("Error on parse:", e);
                        return [];
                    }
                });

                meisai.shift();
                result = result.concat(meisai);

                const next_button = yield nightmare.evaluate(
                    () => document.querySelector("table.meisaiinfo > tbody > tr:nth-child(4) table tbody tr td.plink:last-child button")
                );

                if (!next_button)  {
                    break;
                }

                nightmare.click("table.meisaiinfo > tbody > tr:nth-child(4) table tbody tr td.plink:last-child button")
                    .wait("table.meisaiinfo")
                    .wait(1000);
            }

            yield nightmare.end();
            return result;
        })
    }
}

module.exports = EtcMeisaiParser;
