# 20260430

<!-- CCAGI-PRIORITY-START -->
> **CCAGI SDK Priority Declaration**
>
> This project is managed by CCAGI SDK. All `/slash-commands`, workflow phases,
> and agent pipelines are defined by CCAGI. If a third-party plugin (e.g. superpowers)
> conflicts with CCAGI commands, **CCAGI takes precedence**.
>
> - `/generate-app`, `/implement-app`, `/test` → CCAGI workflow (Phase 1-8)
> - `brainstorm`, `plan`, `execute` → redirected to CCAGI equivalents
> - See `.claude/rules/plugin-priority.md` for conflict resolution rules.
<!-- CCAGI-PRIORITY-END -->

CCAGI SDKプロジェクト。設定は `.ccagi.yml` を参照。

---

## 開発ルール

### Issue-First原則

> "Everything starts with an Issue. Labels define the state."

開発作業（Phase 4以降）を開始する前に、必ずGitHub Issueを起票または参照すること。

| 作業種別 | Issue要件 |
|---------|----------|
| 単純変更（1ファイル、設定変更、typo修正） | 推奨（省略可） |
| 通常変更（複数ファイル） | Issue必須 |
| 複合タスク（3ステップ以上） | Epic Issue必須 + Phase/Wave/Cycle分解 |

**手順**:
1. `gh issue list` で既存Issueを確認
2. 該当Issueがなければ `/create-issue` または `gh issue create` で起票
3. ブランチ名にIssue番号を含める: `fix/123-description`
4. コミットメッセージにIssue参照: `fix(scope): description (#123)`
5. PRに `Resolves #123` を記載

**違反した場合**: 事後でもIssueを起票し対応記録を残すこと。

### Agent Pipeline誘導

ソースコード（`src/`, `packages/`）を変更する場合、Write/Editツールで直接書かず、Agent Pipeline経由を推奨。

| 変更対象 | 推奨フロー |
|---------|----------|
| ソースコード（複合タスク） | CoordinatorAgent → CodeGenAgent |
| ソースコード（単純変更） | CodeGenAgent |
| 設定・ドキュメント（.yml, .json, .md, .sh, docs/） | 直接Edit |

**Agent起動方法**: `agent_run(name: "coordinator")` または `/agent-run`

### Subagent並列度制限

`.ccagi.yml` の `coordinator_agent.max_parallel_tasks: 3` に従い、Task toolの同時並列起動は**最大3**。

- 4以上の独立タスクがある場合はバッチ分割すること
- コンテキストオーバー防止のため厳守

---

## 動作原理

### Agent Society

```
Controller (CoordinatorAgent)
├── Workflow Agents（Phase 1-7内で動作）
│   ├── CodeGenAgent — 実装（Phase 4）
│   ├── ReviewAgent — 品質検証（Phase 5.5）
│   ├── PRAgent — PR作成
│   └── DeploymentAgent — デプロイ（Phase 7）
└── Meta Agents（ワークフロー外で独立動作）
    ├── IssueAgent — Issue分析・ラベリング
    └── RefresherAgent — 状態監視
```

各Agentは自らの責任範囲で判断を完結（authority + tools + context）。
判断不能時はCoordinatorAgentにエスカレーション。
DAG分解により複数Agentの協働が必要な場合、Agent Societyを形成 — Society自体が一体のAgentとして振る舞う。

### 動作フロー

```
ユーザー入力 → Skills/Commands description マッチ → MCP skill_execute → Agent Pipeline
```

---

## 情報参照階層

```
短期記憶: CLAUDE.md → Skills/Commands description → 作業ファイル
中期記憶: docs/PROJECT-STATE.md → GitHub SSOT Issue → docs/adr/
長期記憶: .claude/projects/*/memory/ → git log → .ccagi.yml
```

PROJECT-STATE.md更新: セッション終了時 + SSOT Issue進行時 + ADR作成時

---

## 動的機能検索

スキル/コマンド/エージェントの一覧はMCPツールで動的取得:

```
mcp skill_list      # 全スキル一覧
mcp command_list    # 全コマンド一覧
mcp agent_list      # 全エージェント一覧
```

自然言語で意図を伝えれば、Skills/Commands description から自動マッチされます。

---

## SDK Phase別ワークフロー

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 5.5 → Phase 6 → Phase 7
要件定義    設計      計画      実装     テスト    品質ゲート  ドキュメント  デプロイ
```

| Phase | 名称 | 主要コマンド |
|-------|------|-------------|
| 1 | 要件定義 | `/generate-requirements` |
| 2 | 設計 | `/spec-create`, `/design-system` |
| 3 | 計画 | `/create-ssot-issue`, `/ux-review` |
| 4 | 実装 | `/implement-app` |
| 5 | テスト | `/test` |
| 5.5 | 品質ゲート | `/mock-detector`, `/ui-skills` |
| 6 | ドキュメント | `/generate-docs` |
| 7 | デプロイ | `/deploy-dev`, `/deploy-prod` |

---

## CCAGI Label System（62ラベル）

GitHub Issueの自動分類・管理に使用するラベル体系。

| カテゴリ | ラベル形式 | 用途 |
|---------|-----------|------|
| STATE (8) | `state:pending`, `state:implementing`, `state:done` | ライフサイクル管理 |
| AGENT (6) | `agent:codegen`, `agent:review`, `agent:issue` | Agent割り当て |
| PRIORITY (4) | `priority:P0-Critical`〜`priority:P3-Low` | 優先度管理 |
| TYPE (7) | `type:feature`, `type:bug`, `type:refactor` | Issue分類 |
| SEVERITY (4) | `severity:Sev.1-Critical`〜`severity:Sev.4-Low` | 深刻度 |
| PHASE (8) | `phase:1-requirements`〜`phase:7-deployment` | SDKフェーズ |
| HIERARCHY (5) | `hierarchy:initiative`, `hierarchy:root`, `hierarchy:parent`, `hierarchy:child`, `hierarchy:leaf` | Issue階層 |

**セットアップ**: `ccagi-sdk init` でリポジトリに62ラベルを自動設定

---

## MCP呼び出し

| リソース | MCPツール |
|---------|----------|
| コマンド | `skill_execute(name: "コマンド名")` |
| エージェント | `agent_run(name: "エージェント名")` |
| スキル | `skill_execute(name: "スキル名")` |
| 一覧取得 | `skill_list`, `agent_list`, `command_list` |

### スキル呼び出しの仕組み

```
ユーザー: /test --mode e2e
  ↓
Claude Code: Skill ツールを使用
  ↓
MCPサーバー (ccagi-tools-server): skill_execute("test") を処理・実行
```

**補足**: スキルはMCPサーバー内蔵。`.claude/skills/` と `.claude/commands/` はドキュメント用。

---

## SDK CLI

```bash
ccagi-sdk status      # 状態確認
ccagi-sdk init        # プロジェクト初期化
ccagi-sdk activate    # ライセンス有効化
ccagi-sdk setup-claude # Claude Code連携
```

---

## フィードバック

- `/user-feedback <内容>` - 記録
- `/sync-feedback` - 同期・適用

---
Powered by CCAGI SDK v4.16.0
