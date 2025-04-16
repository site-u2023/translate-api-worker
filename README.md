# translate-api-worker

OpenWrtや他のクライアント向けに一括翻訳APIを提供するCloudflare Workersプロジェクトです。

## エンドポイント
- POST `/translate`

## デプロイ
- GitHubとCloudflare Workers「Git連携」で自動デプロイ
- エントリーポイント: `src/index.ts`

## 開発
- `npm install`
- `npm run build` （必要な場合）

## 必要ファイル
- wrangler.toml
- package.json
- tsconfig.json