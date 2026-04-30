# CCAGI Agents

このプロジェクトで利用可能なエージェント一覧。
各エージェントはCCAGI MCPサーバーを通じて実行されます。

| Agent | Description | 実行方法 |
|-------|-------------|----------|
| ai-product-analyzer | GitHubリポジトリからAIプロダクトを分析・抽出するAgent | `agent_run(name: "ai-product-analyzer")` |
| aiproductanalyzer | GitHubリポジトリからAIプロダクトを分析・抽出するAgent | `agent_run(name: "aiproductanalyzer")` |
| api | RESTful/GraphQL API設計・OpenAPI仕様・バージョニング管理の専門Agent | `agent_run(name: "api")` |
| architecture | システム設計・技術選定・スケーラビリティ設計の専門Agent | `agent_run(name: "architecture")` |
| aws-agent | AWS Agent - Cloud Infrastructure Management, Budget/Cost Management, Cost Estimation, Resource Optimization. Enterprise tier。 .ccagi/knowledge/ からAWSサービスカタログ・料金・re:Invent情報を参照。 CCI活用でコードベースのAWS利用実態を調査（fallback: grep）。 | `agent_run(name: "aws-agent")` |
| aws | AWS Agent - Cloud Infrastructure Management, Budget/Cost Management, Cost Estimation, Resource Optimization. Enterprise tier。 .ccagi/knowledge/ からAWSサービスカタログ・料金・re:Invent情報を参照。 CCI活用でコードベースのAWS利用実態を調査（fallback: grep）。 | `agent_run(name: "aws")` |
| backend | サーバーサイドロジック・API実装・データ処理の専門Agent | `agent_run(name: "backend")` |
| batch-issue | GitHub Issue一括作成Agent - テンプレートからバッチ作成 + Headless実行対応 | `agent_run(name: "batch-issue")` |
| batchissue | GitHub Issue一括作成Agent - テンプレートからバッチ作成 + Headless実行対応 | `agent_run(name: "batchissue")` |
| browser-automation | Platform-aware browser automation agent. Detects available browser backend (browser-cli vs Playwright), manages session state, handles retries, and orchestrates multi-tab browser workflows. | `agent_run(name: "browser-automation")` |
| codegen | AI駆動コード生成Agent - Claude Sonnet 4による自動コード生成 | `agent_run(name: "codegen")` |
| codex-codegen | OpenAI Codex駆動コード生成Agent | `agent_run(name: "codex-codegen")` |
| codex-docs | OpenAI Codex駆動ドキュメントAgent | `agent_run(name: "codex-docs")` |
| codex-refactor | OpenAI Codex駆動リファクタリングAgent | `agent_run(name: "codex-refactor")` |
| codex-test | OpenAI Codex駆動テストAgent | `agent_run(name: "codex-test")` |
| codexcodegen | OpenAI Codex駆動コード生成Agent | `agent_run(name: "codexcodegen")` |
| codexdocs | OpenAI Codex駆動ドキュメントAgent | `agent_run(name: "codexdocs")` |
| codexrefactor | OpenAI Codex駆動リファクタリングAgent | `agent_run(name: "codexrefactor")` |
| codextest | OpenAI Codex駆動テストAgent | `agent_run(name: "codextest")` |
| coordinator | タスク統括・並行実行制御Agent - DAGベースの自律オーケストレーション。複合タスクはIssue起票必須、チェックポイント駆動で実行。タスク分解はアウトカム単位(IC-3 Scope Fidelity準拠)。 | `agent_run(name: "coordinator")` |
| database | スキーマ設計・マイグレーション・クエリ最適化の専門Agent | `agent_run(name: "database")` |
| deploy-infra | AWS Infrastructure Auto-Setup Agent - Uses shared infrastructure (ALB, S3, CloudFront) | `agent_run(name: "deploy-infra")` |
| deployinfra | AWS Infrastructure Auto-Setup Agent - Uses shared infrastructure (ALB, S3, CloudFront) | `agent_run(name: "deployinfra")` |
| deployment | CI/CDデプロイ自動化Agent - Firebase/AWS自動デプロイ・ヘルスチェック・自動Rollback | `agent_run(name: "deployment")` |
| dev-observer | CDP直接制御による開発デバッグアシスタント。 統合ログ収集(server+browser+network)、自動スクリーンショット、 CLS検出、React Component Explorer、UI要素ビジュアル指定を提供。 | `agent_run(name: "dev-observer")` |
| devops | CI/CD設計・インフラ自動化・デプロイメント戦略Agent | `agent_run(name: "devops")` |
| documentation | ドキュメント生成・管理Agent - 自動ドキュメント生成・一貫性維持・多言語対応 | `agent_run(name: "documentation")` |
| frontend | UI/UX実装・コンポーネント設計・状態管理の専門Agent | `agent_run(name: "frontend")` |
| incident | インシデント対応・根本原因分析・ポストモーテム作成Agent | `agent_run(name: "incident")` |
| issue | Issue分析・Label管理Agent - 組織設計原則57ラベル体系による自動分類 + 階層的Issue管理 | `agent_run(name: "issue")` |
| lark-analytics-specialist | description: Larkエコシステムのデータ分析・ビジネスインテリジェンスエージェント。Baseデータを分析・トレンド把握・自動レポート化してインサイトに変換します。 | `agent_run(name: "lark-analytics-specialist")` |
| lark-approval-hr | description: Lark承認ワークフロー・HR運用エージェント。承認フロー、勤怠管理、採用・オンボーディングを専門的に実行します。 | `agent_run(name: "lark-approval-hr")` |
| lark-browser-admin | description: Lark管理コンソールをブラウザ経由で操作するエージェント。APIで不可能な管理設定、アプリ公開、権限設定を実行します。 | `agent_run(name: "lark-browser-admin")` |
| lark-enterprise-orchestrator | description: Lark上の複雑なマルチステップ業務プロセスを自動化するAIオーケストレーター。タスクを分解し、Base・IM・Docs・Calendarを横断して実行します。 | `agent_run(name: "lark-enterprise-orchestrator")` |
| lark-integration-bridge | description: Larkと外部システム間のインテグレーションブリッジエージェント。インテリジェントなエラーハンドリングとデータ変換によるクロスプラットフォームデータフローをオーケストレーションします。 | `agent_run(name: "lark-integration-bridge")` |
| lark-message-ops | description: Larkメッセージング運用エージェント。チャット管理、カード送信、バッチ通知、グループ設定を専門的に行います。 | `agent_run(name: "lark-message-ops")` |
| license-management | ライセンス管理専門Agent - LMC統合とライセンス検証システム | `agent_run(name: "license-management")` |
| licensemanagement | ライセンス管理専門Agent - LMC統合とライセンス検証システム | `agent_run(name: "licensemanagement")` |
| migration | マイグレーションスペシャリストAgent - データ移行・スキーマ変更・バージョンアップ・後方互換性 | `agent_run(name: "migration")` |
| monitoring | メトリクス収集・アラート設計・ログ分析・APM Agent | `agent_run(name: "monitoring")` |
| omega-guard | 不変条件(IC-1〜IC-5)の違反を検出するメタエージェント。 ワークフロー外で独立動作し、θ₁/θ₃/θ₅のゲートポイントで起動する。 任意のSurface(CLI/WebUI/API/Agent出力)に適用可能。 | `agent_run(name: "omega-guard")` |
| optimization-agent | パフォーマンス・コード最適化Agent - リファクタリング・品質改善・技術的負債解消 | `agent_run(name: "optimization-agent")` |
| optimization | パフォーマンス・コード最適化Agent - リファクタリング・品質改善・技術的負債解消 | `agent_run(name: "optimization")` |
| performance | パフォーマンス最適化Agent - 性能測定・ボトルネック分析・最適化提案・負荷テスト | `agent_run(name: "performance")` |
| pr | Pull Request自動作成Agent - Conventional Commits準拠・Draft PR自動生成 | `agent_run(name: "pr")` |
| qa | 品質保証・テスト自動化Agent - テスト戦略策定・E2Eテスト設計・品質メトリクス分析 | `agent_run(name: "qa")` |
| refactor | リファクタリングスペシャリストAgent - コード品質改善・技術的負債解消・設計パターン適用 | `agent_run(name: "refactor")` |
| refresher | Issue状態監視・自動更新Agent - 常にプロジェクトステータスを最新に保つ | `agent_run(name: "refresher")` |
| release | SDKリリース統括Agent — ビルド・検証・RQT・S3アップロード・E2Eテストの全フローを自律実行 | `agent_run(name: "release")` |
| review | コード品質判定Agent - 静的解析・セキュリティスキャン・品質スコアリング・不変条件検証(IC-1〜IC-5) | `agent_run(name: "review")` |
| rust-migration | TypeScript→Rust移行専門Agent - 安全なRust移行とNAPIバインディング生成 | `agent_run(name: "rust-migration")` |
| rustmigration | TypeScript→Rust移行専門Agent - 安全なRust移行とNAPIバインディング生成 | `agent_run(name: "rustmigration")` |
| sd-analyze | | | `agent_run(name: "sd-analyze")` |
| sd-generate | | | `agent_run(name: "sd-generate")` |
| sd-research | | | `agent_run(name: "sd-research")` |
| security-learner-agent | セキュリティインシデントから新パターンを学習し、検出ルールを自己進化させる | `agent_run(name: "security-learner-agent")` |
| security-planner-agent | APIルート設計時にセキュリティ要件を推論し、テンプレート・テストを生成する | `agent_run(name: "security-planner-agent")` |
| security-scanner-agent | コードレベルのセキュリティ欠陥を検出・分類する防御スキャナー | `agent_run(name: "security-scanner-agent")` |
| security | Webサービス全体セキュリティ統括CSO - E2Eセキュリティ責任 [Workflow θ₄] | `agent_run(name: "security")` |
| test | テスト自動実行Agent - ユニットテスト、統合テスト、E2Eテストを自動実行し、カバレッジレポートを生成 | `agent_run(name: "test")` |
| threejs | Three.js 3Dシーン構築・レンダリング・コード生成の専門Agent。 E:Stack Theory (Intent→Architecture→Manifestation) に基づく デザイン品質保証。R3F/vanilla 両対応、headlessレンダリング対応。 | `agent_run(name: "threejs")` |
| tmux-control | Tmux Control Agent - tmuxセッション制御・マルチペイン管理 | `agent_run(name: "tmux-control")` |
| tmuxcontrol | Tmux Control Agent - tmuxセッション制御・マルチペイン管理 | `agent_run(name: "tmuxcontrol")` |
| ux-review | ユーザー視点でUI/UXを分析し、カスタマージャーニーに基づく改善提案を行う | `agent_run(name: "ux-review")` |
| uxreview | ユーザー視点でUI/UXを分析し、カスタマージャーニーに基づく改善提案を行う | `agent_run(name: "uxreview")` |
| xkoma-agent | Xkoma AI Agent MCP Server との連携エージェント。 セッション管理、メモリ、キュー、セキュリティ監査を提供。 | `agent_run(name: "xkoma-agent")` |

---
*Generated by CCAGI SDK*
