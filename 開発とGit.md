# 開発とGit

ソースは https://github.com/karadaga1236/gcg-table のmainブランチで管理し、配布版の状態にはv4.8.1などのタグを付けます。Windows用ZIPはReleasesで配布します。

保存デッキのdata/decks、作業用のwork、配布ZIPはGitの対象外です。公式カード画像とruntime/node.exeも配布物にのみ同梱し、ソースには含めません。ソースからの動作確認には、対応する配布ZIPの実行環境と画像が必要です。

テスト対象はpackage.jsonのtestに記載しています。同梱のruntime/node.exeに--testと各テストファイルを指定すると実行できます。v4.8.1では97件を確認しています。別PC4台でのVPN対戦は未確認です。

個人の保存デッキはGitの履歴に含まれないため、dataフォルダーを別途コピーして控えを残してください。
