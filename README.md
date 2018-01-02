# billing-notifier
各種クレカサイトの請求明細を取得してSlackに投稿するもの。

APIという便利なものは用意されていないサイトたちなので、nightmareにてKIAIでparseしてます。

parseを行う部分は最初Lambdaでやろうかと思いましたが、nightmareの動作に必要なランタイムを一式突っ込んだら容量オーバーでアップロードできなかったため、仕方なくDocker Containerが使えるCodeBuildで実行しています。

## SETUP
### 環境変数の設定
下記の値をEC2 Parameter Storeに設定する。

#### 全体
 * `BILLING_NOTIFIER_SLACK_WEBHOOK_URL`: SlackのIncoming WebHook URL

#### ETC meisai
[ETC利用照会サービス](http://www.etc-meisai.jp) のデータを取得する際に必要

 * `BILLING_NOTIFIER_ETC_ID`: ETC利用照会サービスのユーザーID
 * `BILLING_NOTIFIER_ETC_PASSWORD`: ETC利用照会サービスのパスワード

#### VIEWCARD meisai
[VIEW's NET](http://www.jreast.co.jp/card/)のデータを取得する際に必要

* `BILLING_NOTIFIER_VIEWCARD_ID`: VIEW's NETのユーザーID
* `BILLING_NOTIFIER_VIEWCARD_PASSWORD`: VIEW's NETのパスワード


### serverlessでセットアップ
```
git clone https://github.com/celeron1ghz/billing-notifier.git
cd billing-notifier/lambda
sls deploy

## テスト実行
sls invoke -f main
```


## SEE ALSO
 * https://github.com/celeron1ghz/billing-notifier
 * https://github.com/celeron1ghz/docker-nightmare
 * https://hub.docker.com/r/celeron1ghz/nightmare/
 * http://www.etc-meisai.jp
 * http://www.jreast.co.jp/card/
