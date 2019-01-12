# billing-notifier
各種クレカサイトの請求明細を取得してSlackに投稿するもの。

APIという便利なものは用意されていないサイトたちなので、nightmareにてKIAIでparseしてます。

parseを行う部分は最初Lambdaでやろうかと思いましたが、nightmareの動作に必要なランタイムを一式突っ込んだら容量オーバーでアップロードできなかったため、仕方なくDocker Containerが使えるCodeBuildで実行しています。


## SETUP ENVIRONMENT VARIABLES
Set these value to `EC2 Parameter Store`.

#### GLOBAL
 * `/slack/webhook/dev`: SlackのIncoming WebHook URL
#### [ETC Meisai Service](http://www.etc-meisai.jp) 
 * `/etc_meisai/user_id`: ETC meisai service's user_id
 * `/etc_meisai/password`: ETC meisai service's password
#### [VIEW's NET](http://www.jreast.co.jp/card/)
 * `/viewcard/user_id`: VIEW's NET user_id
 * `/viewcard/password`: VIEW's NET password


## SETUP SERVERLESS SCRIPT
```
git clone https://github.com/celeron1ghz/billing-notifier.git
cd billing-notifier
sls deploy
```


## SEE ALSO
 * https://github.com/celeron1ghz/billing-notifier
 * https://github.com/celeron1ghz/docker-nightmare
 * https://hub.docker.com/r/celeron1ghz/nightmare/
 * http://www.etc-meisai.jp
 * http://www.jreast.co.jp/card/
