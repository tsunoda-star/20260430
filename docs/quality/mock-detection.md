# Mock Detection Report — Phase 5.5 / Cycle 5.5.1

**Project**: security-checklist-tool
**Generated**: 2026-04-30
**Scope**: `src/` 配下 (テスト除く)
**Policy**: `lenient` (dev — Critical のみ block)
**Verdict**: ✅ **PASS**

---

## 1. サマリ

| Severity | 件数 | 対応 |
|----------|:----:|------|
| Critical | **0** | — |
| High | **0** | — |
| Medium | **1** | フォロー Issue 起票推奨 |
| Low | 5 | 許容 (Tailwind class / SSRF deny list / コメント) |

**Lenient policy** (Critical のみ block) を満たすため、本フェーズはゲート PASS。

---

## 2. 検出結果詳細

### 2.1 Critical (0 件)

検出なし。本番コードに `throw new Error('Not implemented')` / ハードコード認証情報 / AWS Access Key / `console.log('DEBUG')` / mock/fake token は **すべて 0 件**。

| パターン | 該当 |
|---------|:----:|
| Cognito userPoolId / clientId 直書き | 0 |
| `mockToken` / `fakeToken` / `testJwt` | 0 |
| `AKIA[0-9A-Z]{16}` (AWS access key) | 0 |
| `throw new Error('Not implemented')` | 0 |
| `console.log('DEBUG')` | 0 |

### 2.2 High (0 件)

検出なし。Cycle 2.2 SSRF / Cycle 3.2 RBAC で防御層を構築済み。

| パターン | 該当 |
|---------|:----:|
| ハードコード `localhost:NNNN` (本番コード) | 0 |
| `127.0.0.1` (本番コード) | 0 (テストのみ) |
| 環境変数を使わない秘密情報リテラル | 0 |

### 2.3 Medium (1 件)

| 場所 | 内容 | 推奨対応 |
|------|------|---------|
| `src/components/url-input-form.tsx:59` | `// TODO(#7 Cycle 2.4): POST /api/v1/companies → router.push(...)` | **POST /api/v1/companies/stream (Cycle 3.4 で実装済) に配線可能。** Issue 起票して対応 |

**コンテキスト**:
- POST `/api/v1/companies` (Cycle 2.4) と POST `/api/v1/companies/stream` (Cycle 3.4) は実装済
- 現状フォーム submit は toast 表示のみで、実 API には未接続
- `useEventStream` フック (Cycle 3.4) を使えば数行で繋がる

### 2.4 Low (5 件 — 許容)

| 場所 | 内容 | 判定 |
|------|------|------|
| `src/components/url-input-form.tsx:90` | `placeholder="https://your-company.example.jp"` | **許容**: HTML input の placeholder 属性 (UX 用) |
| `src/components/ui/input.tsx:18` | `'placeholder:text-muted-foreground'` | **許容**: Tailwind class 名 (False positive) |
| `src/lib/auth/cc-auth.ts:141` | `// .../CC-Auth.localhost_redirect ...` | **許容**: ドキュメントコメント |
| `src/lib/crawler/ip-blocklist.ts:12-13` | `'localhost'`, `'localhost.localdomain'` | **許容**: SSRF deny list (`BLOCK_HOSTS`) |
| `src/components/history-empty-state.tsx` JSDoc | `Cycle 2.4 で GET /api/v1/companies?recent から ... に置換予定` | **許容**: ドキュメントコメント (機能 placeholder) |

---

## 3. CC-Auth URL 整合性

`.ccagi.yml` の Cognito 設定とソースコードのハードコード整合性チェック:

| 項目 | 結果 |
|------|------|
| `process.env.COGNITO_USER_POOL_ID` 経由のみ | ✅ 100% (直書き 0 件) |
| `process.env.COGNITO_CLIENT_ID` 経由のみ | ✅ 100% |
| `process.env.NEXT_PUBLIC_CC_AUTH_REDIRECT_URI` 経由のみ | ✅ 100% |
| 本番コードに `localhost:` リテラル | ✅ 0 件 |

すべての Cognito / CC-Auth 設定は環境変数経由で読み込まれており、`.ccagi.yml` との整合性が保たれている。

---

## 4. Stub 検出 (no-stub-no-workaround ルール)

`.claude/rules/scope-contract.md` の禁止事項に該当する stub / workaround は検出されず:

| 項目 | 結果 |
|------|------|
| node_modules 内のファイル手動作成 | ✅ 0 件 |
| ダミーモジュール / スタブで build を通している箇所 | ✅ 0 件 |
| `// removed by build` 等のフォローアップ忘れ | ✅ 0 件 |

---

## 5. ゲート判定

| Policy | 判定基準 | 結果 |
|--------|---------|------|
| **lenient** (本フェーズ採用) | Critical=0 のみ要求 | ✅ **PASS** |
| standard (staging) | Critical=0 + High=0 | ✅ PASS (参考) |
| strict (prod) | Critical=0 + High=0 + Medium=0 + mock 検出ゼロ | 🟡 Medium 1件 → 修正後 PASS |

---

## 6. 推奨フォローアップ (任意)

Phase 5.5 は **検出 + 判定** が役割であり、修正自体は別 Issue 化が推奨。

**起票候補**:
- `[follow-up] url-input-form.tsx の POST /api/v1/companies 接続` (Medium, Cycle 5.5 後の polish)
- `[follow-up] history-empty-state.tsx を /api/v1/companies?recent に接続` (Low, 同様)

prod デプロイ前 (`strict` policy) には上記 2 件を解消する必要がある。

---

## 付録: スキャン実行コマンド (再現可能)

```bash
# 本番コードの mock パターン
grep -rEn "mock[A-Z]|dummy[A-Z]|fake[A-Z]|sample[A-Z][a-zA-Z]*|placeholder|lorem ipsum" \
  src/ --include='*.ts' --include='*.tsx'

# ハードコード認証情報 / localhost
grep -rEn "test@|admin123|localhost:[0-9]+|127\\.0\\.0\\.1|['\\\"]xxx" \
  src/ --include='*.ts' --include='*.tsx'

# 仮実装マーカー
grep -rEn "TODO|FIXME|HACK:|Not implemented" \
  src/ --include='*.ts' --include='*.tsx'

# Cognito 直書き
grep -rEn "userPoolId.*=.*['\\\"]ap-northeast-1_|clientId.*=.*['\\\"][a-z0-9]{26}" \
  src/ --include='*.ts' --include='*.tsx' | grep -v "process.env"

# AWS access key
grep -rEn "AKIA[0-9A-Z]{16}" \
  src/ --include='*.ts' --include='*.tsx' --exclude='*.test.ts'
```

---
*Phase 5.5 / Cycle 5.5.1 — Mock Detection Report (security-checklist-tool)*
