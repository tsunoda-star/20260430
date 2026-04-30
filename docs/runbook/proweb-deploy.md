# Pro-Web (AXIS) + Neon デプロイ手順書

**Target**: Pro-Web by AXIS (Plesk VPS) + Neon (Postgres serverless) で本サービスを公開する手順
**前提**: Pro-Web VPS の契約が有効 / 独自ドメインを Pro-Web に向けてある / GitHub アカウント
**追加月額コスト**: ¥0 (Pro-Web 契約済 + Neon Free Tier)
**所要時間**: 約 60〜90 分

---

## 1. 構成図

```mermaid
graph LR
  User[エンドユーザー] -->|HTTPS| Plesk[Plesk Reverse Proxy<br/>+ Let's Encrypt]
  Plesk -->|loopback| Node[Plesk Node.js Toolkit<br/>Next.js 14 standalone]
  Node -->|TLS| Neon[(Neon Postgres<br/>Serverless / Free Tier)]
  Node -->|HTTPS outbound| OpenAI[OpenAI API]
  Node -.optional.-> AuthJs[Auth.js + Email link<br/>or Cognito]
```

| コンポーネント | 役割 | 月額 |
|--------------|------|-----|
| Pro-Web VPS (Plesk) | Next.js 常駐 + nginx reverse proxy + Let's Encrypt | (既存契約に含む) |
| **Neon** Postgres | DB 本体 (serverless / 自動スリープ / 自動 backup) | $0 (Free 0.5GB) |
| OpenAI API | LLM (estimation / ai-chat) | 従量 (任意) |
| 認証 | 当面は **DEV_AUTH_BYPASS で動作確認** → 本番は Auth.js 推奨 | $0 |

---

## 2. ステップ 0: 事前準備

| 項目 | 確認 |
|------|------|
| Pro-Web Plesk 管理画面の URL とログイン情報 | ✓ |
| 独自ドメイン (例: `checklist.secureonline.co.jp`) を Pro-Web に向け済み | ✓ |
| GitHub リポジトリへの公開鍵登録 (deploy key 推奨) | ✓ |
| メモ: Plesk 管理 URL / SSH 接続情報 | ✓ |

---

## 3. ステップ 1: Neon Postgres を準備

### 3.1 Neon プロジェクト作成

1. https://neon.tech にアクセスし、GitHub アカウントでサインアップ (無料)
2. **Create Project** をクリック
3. 設定:
   - Project name: `security-checklist-tool`
   - Postgres version: **15**
   - Region: `Asia Pacific (Tokyo)` (= AWS ap-northeast-1)
4. **Create** で完了

### 3.2 Connection string 取得

1. Project ダッシュボード → **Connection Details**
2. **Pooled connection** の URL をコピー (例 `postgresql://user:pass@ep-xxxx.ap-northeast-1.aws.neon.tech/neondb?sslmode=require`)
3. これが `DATABASE_URL` になる

### 3.3 ローカルから migrate + seed

ローカル PC から Neon に接続して、Prisma スキーマを反映:

```bash
# リポジトリのルートで
export DATABASE_URL="postgresql://...@ep-xxxx.ap-northeast-1.aws.neon.tech/neondb?sslmode=require"

# スキーマ適用
npx prisma migrate deploy

# 27 ガイドライン seed
npm run prisma:seed
```

**確認**: Neon ダッシュボードの **SQL Editor** で `SELECT count(*) FROM guidelines;` が **27** を返せば OK。

---

## 4. ステップ 2: Plesk で Node.js 環境を準備

### 4.1 ドメインを Plesk に登録

1. Plesk 管理画面 → **Websites & Domains** → **Add Domain**
2. ドメイン名: `checklist.secureonline.co.jp`
3. Document root: `/httpdocs/checklist.secureonline.co.jp` (任意)
4. **OK**

### 4.2 Node.js Toolkit を有効化

1. ドメイン詳細画面 → **Node.js** ボタン
   (見つからない場合は **Tools & Settings** → **Updates** → "Node.js Toolkit" を install)
2. 「Enable Node.js」をクリック
3. 設定:
   - **Node.js version**: **20.x** (LTS) を選択
   - **Document Root**: 自動 (httpdocs/checklist.secureonline.co.jp)
   - **Application Mode**: `production`
   - **Application URL**: `https://checklist.secureonline.co.jp`
   - **Application Root**: `httpdocs/checklist.secureonline.co.jp`
   - **Application Startup File**: 後で `server.js` (Next.js standalone) を指定
4. 一旦 **Apply** で保存

### 4.3 SSH でリポジトリを clone

Plesk → **Tools & Settings** → **SSH Terminal** (もしくは別ターミナルから SSH)

```bash
cd ~/httpdocs
# 既存の sct ディレクトリがあれば削除 (Plesk が自動生成した場合)
rm -rf sct
git clone https://github.com/tsunoda-star/20260430.git sct
cd sct
```

### 4.4 PDF 用日本語フォントの取得

```bash
npm run setup:fonts
# → public/fonts/NotoSansJP-Regular.otf / Bold.otf 取得
```

---

## 5. ステップ 3: Next.js を standalone build に切替

Plesk Node.js Toolkit (Phusion Passenger) は単一の `server.js` を立ち上げる構造のため、Next.js の **standalone output** を使うのが最も確実:

### 5.1 next.config.mjs に追記

ローカル PC で:

```js
// next.config.mjs
export default {
  output: 'standalone',  // ← 追加
  // ... 既存設定
};
```

コミット & push:

```bash
git add next.config.mjs
git commit -m "build: enable standalone output for Plesk Node.js"
git push
```

VPS 側で pull:

```bash
git pull
```

### 5.2 ビルド

```bash
npm ci
npm run build
# → .next/standalone/server.js が生成される
# → .next/static と public をコピーする必要あり
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
```

---

## 6. ステップ 4: 環境変数を Plesk に設定

Plesk → ドメインの **Node.js** 画面 → **Custom environment variables** で以下を追加 (※ 値は実環境のものに置換):

| 変数 | 値 | 備考 |
|------|-----|------|
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | `postgresql://...@ep-xxxx.../neondb?sslmode=require` | Neon の connection string |
| `OPENAI_API_KEY` | `sk-...` | OpenAI Enterprise / Free tier 任意 |
| `LLM_PRIMARY_PROVIDER` | `openai` | 未設定時は `fallback` (= rule-based のみ) |
| `OPENAI_MODEL` | `gpt-4o-mini` | コスト最適 |
| `SESSION_COOKIE_NAME` | `sct_session` | |
| `NEXT_PUBLIC_APP_NAME` | `Security Checklist Tool` | |
| `NEXT_PUBLIC_APP_ENV` | `prod` | |
| `NEXT_PUBLIC_CC_AUTH_REDIRECT_URI` | `https://checklist.secureonline.co.jp/auth/callback` | Cognito 利用時のみ |
| `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` / `COGNITO_REGION` | (Cognito を使う場合) | |
| `DEV_AUTH_BYPASS` | **設定しないこと** | production では無効 (security) |

---

## 7. ステップ 5: 起動 + Let's Encrypt + 動作確認

### 7.1 Application Startup File を変更

Plesk Node.js 画面 → **Application Startup File** を:

```
.next/standalone/server.js
```

に変更 → **Apply** → **Restart App**

### 7.2 SSL (Let's Encrypt) を有効化

1. ドメイン詳細 → **SSL/TLS Certificates**
2. **Install Free Basic Certificate by Let's Encrypt**
3. メール / `Secure www subdomain` チェック → **Get it free**
4. 反映後、ドメインに HTTPS でアクセスできるようになる

### 7.3 動作確認

ブラウザで `https://checklist.secureonline.co.jp/api/v1/health` を開く:

```json
{
  "status": "degraded" or "ok",
  "checks": [
    { "name": "database", "status": "ok" },
    { "name": "llm", "status": "ok or degraded" },
    { "name": "cognito", "status": "degraded if not set" }
  ]
}
```

`database` が **ok** なら Neon 接続成功。

トップページ `https://checklist.secureonline.co.jp/` で URL 入力フォームが表示される。

---

## 8. ステップ 6: 認証戦略を決める

現状は **DEV_AUTH_BYPASS=1 にしないと API が 401** で止まる。Production では DEV bypass は無効なので、認証経路の選択が必要:

| 選択肢 | 工数 | コスト |
|--------|:---:|:------:|
| **A. AWS Cognito を使う** (現設計通り) | 小 | $0 〜 (50,000 MAU 無料) |
| B. Auth.js (NextAuth) Email Magic Link | 中 | $0 + メール送信サービス費用 |
| C. Clerk / Supabase Auth | 中 | 無料枠あり |
| **D. 当面は単一 Owner ユーザだけ** (`.env` に固定値で 1 ユーザ inject) | 極小 | $0 |

**推奨**: **A** (Cognito User Pool は無料枠 50,000 MAU + AWS 側のコストゼロ) もしくは MVP 段階では **D** で 1 owner 運用。

D で一時的に動かす場合は、**production でも安全な「単一ユーザ inject」モード** を別途実装する必要がある (将来 Phase 8 で拡張)。
本ランブックでは Cognito 連携を前提とする。

---

## 9. ステップ 7: GitHub Actions で自動デプロイ (任意)

push したら自動で VPS に反映する設定例:

```yaml
# .github/workflows/proweb-deploy.yml (草案)
name: Deploy to Pro-Web
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: SSH deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROWEB_HOST }}
          username: ${{ secrets.PROWEB_USER }}
          key: ${{ secrets.PROWEB_SSH_KEY }}
          script: |
            cd ~/httpdocs/checklist.secureonline.co.jp
            git pull
            npm ci
            npm run setup:fonts
            npm run build
            cp -r .next/static .next/standalone/.next/
            cp -r public .next/standalone/
            # Plesk が Passenger 経由で auto-restart
            touch tmp/restart.txt
```

GitHub Secrets に `PROWEB_HOST` / `PROWEB_USER` / `PROWEB_SSH_KEY` を登録。

---

## 10. トラブルシューティング

| 症状 | 対処 |
|------|------|
| `503 Service Unavailable` | Plesk Node.js → Logs を確認。`server.js` パスが正しいか / ビルド済みか |
| `database: down` (health check) | Neon connection string が正しいか / `?sslmode=require` を含むか |
| 401 Unauthorized が連続 | Cognito 未設定。DEV_AUTH_BYPASS は production では無効 (二重防御) |
| PDF が文字化け | `npm run setup:fonts` を実行したか / `public/fonts/NotoSansJP-*.otf` 存在確認 |
| `next start` ではなく `server.js` で動かない | next.config.mjs に `output: 'standalone'` を追加 + 再ビルド + 静的ファイル copy |
| Plesk が prepare /tmp を消す | `tmp/restart.txt` で Passenger 再起動 (graceful) |

---

## 11. 月額コスト試算

| 項目 | 月額 (税込) |
|------|------:|
| Pro-Web VPS (既存契約) | ¥0 (追加なし) |
| Neon Free Tier | $0 |
| OpenAI API (gpt-4o-mini, 月 1k リクエスト想定) | ~$2 |
| ドメイン (例: お名前.com の .jp) | ~¥250 (年 ¥3,000 を月割) |
| **合計** | **¥350 程度** |

実費はほぼ OpenAI コストのみ。MVP 期はこれで十分回せる。

---

## 12. 関連ドキュメント

- [`docs/runbook/index.md`](./index.md) — Runbook 全体
- [`docs/runbook/troubleshooting.md`](./troubleshooting.md) — 障害分類別の一次対応
- [`docs/PROJECT-STATE.md`](../PROJECT-STATE.md) — Phase 1-7 全進捗

---
*Phase 7 / Cycle 7.6 (proweb 経路) — Pro-Web Deployment Runbook (security-checklist-tool)*
