# 開発とGit

2026年10月15日から、開発用のgcg-table-v4.1フォルダーをローカルGitで管理しています。
Gitは変更の履歴を残し、差分を確認したり、以前の状態を取り出したりするための仕組みです。

- mainブランチに、04版からの更新を記録しています。
- 今後の開発もこのリポジトリーを継続して使用します。配布ZIPは別に作成します。
- 公開先は https://github.com/karadaga1236/gcg-table です。ソースコードはGitHub、利用者向けZIPはReleasesで配布します。
- 保存デッキ（data/decks）、その控え、作業用ファイル、ZIPは履歴に含めません。
- 実行環境のnode.exeと公式カード画像は配布物として同梱し、Gitの対象から外しています。ライセンス・画像の出典・カード情報は管理対象です。
- 配布ZIPには.gitフォルダーを入れません。遊ぶ人がGitをインストールする必要はありません。

## 開発環境を別の場所で復元する場合

Gitのソースだけでは同梱実行環境と画像が不足します。同じ版の配布ZIPからruntime/node.exeとpublic/cardsをコピーしてください。実行環境のライセンスはruntime/LICENSE.txtにあります。保存デッキは必要な本人の分だけ、別途data/decksへ引き継いでください。

開発確認はruntime/node.exeで、test.mjs・turns.test.mjs・decks.test.mjs・local.test.mjs・lobby.test.mjs・match.test.mjs・tools.test.mjs・interaction.test.mjs・feedback.test.mjs・access.test.mjs・curve.test.mjsをNode.jsの--testオプションに指定します。package.jsonにも同じテスト対象を記載しています。外部ライブラリーのインストールは不要です。

GitはPC故障へのバックアップにはなりません。ソースのリポジトリーと個人のdataフォルダーは、必要に応じて別の保存先にも控えを残してください。
