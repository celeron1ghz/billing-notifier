'use strict';

class PageParser {
    constructor(user_id, password) {
      this.user_id  = user_id;
      this.password = password;
      //this.login_page_url = 'https://viewsnet.jp/';
    }
    
    login(nightmare)            { throw new Error("abstract method") }
    parse_page(document)        { throw new Error("abstract method") }
    has_next_page(document)     { throw new Error("abstract method") }
    goto_next_page(nightmare)   { throw new Error("abstract method") }

    parse() {
      const nightmare = new require('nightmare')({ show: true });
      const { JSDOM } = require('jsdom');
      const self = this;

      return (async () => {
        const result = [];

        nightmare.viewport(1000, 1000)
          .useragent("Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36")
          .goto(self.login_page_url)

        console.log(" ==> LOGIN");
        self.login(nightmare)

        while (true)   {
          const html = await nightmare.evaluate(() => document.body.innerHTML);
          const { document } = new JSDOM(html).window;

          const meisai = self.parse_page(document);
          meisai.shift();
          result.push(...meisai);
                
          console.log(" => GOT ", result.length);
          const next_button = self.has_next_page(document);

          if (!next_button)  {
            console.log(" => LAST");
            break;
          }

          console.log(" => NEXT")
          self.goto_next_page(nightmare)
        }

        await nightmare.end();
        return result;
      })();
    }
}

module.exports = PageParser;
