# Yarikuri — Excelで運用していた個人資産管理を Next.js + Supabase で再構築 <!-- omit in toc -->

[![Status](https://img.shields.io/badge/Status-開発中-yellow?style=for-the-badge)](#)
[![Stack](https://img.shields.io/badge/Stack-Next.js%20%2B%20Supabase-2ea44f?style=for-the-badge)](#)

**Excelで長年運用していた個人資産管理ツール「Yarikuri」**を、Next.js + Supabase でWebアプリ化するプロジェクト。固定費・収入履歴・資産推移の3軸で家計を可視化することを目的とします。**現在開発中**で、Build in Public 方針でウェイトリストを先行受付しながら進めています。

> このREADMEは「Yarikuri で何を考え、どう作るか」を採用担当者・他エンジニアに向けて伝えることを目的にしています。リポジトリ自体はprivate管理のため、ここでは設計・技術選定の意思決定を中心に記載します。

- [1. なぜ作るか — Excel運用の限界とWebアプリ化の動機](#1-なぜ作るか--excel運用の限界とwebアプリ化の動機)
  - [個人開発の中での位置づけ](#個人開発の中での位置づけ)
  - [開発状況：Build in Public + ウェイトリスト先行](#開発状況build-in-public--ウェイトリスト先行)
- [2. 解決したい課題と機能の対応](#2-解決したい課題と機能の対応)
  - [固定費・定期支出の管理](#固定費定期支出の管理)
  - [収入履歴の管理](#収入履歴の管理)
  - [資産トラッキング](#資産トラッキング)
  - [各種集計・グラフ](#各種集計グラフ)
  - [PWA でPC・スマホ両対応](#pwa-でpcスマホ両対応)
  - [Supabase Auth + RLS でデータ分離](#supabase-auth--rls-でデータ分離)
- [3. 技術選定の理由](#3-技術選定の理由)
  - [フロント — Next.js（App Router） + React + Tailwind](#フロント--nextjsapp-router--react--tailwind)
  - [言語 — TypeScript（strict + `noUncheckedIndexedAccess`）](#言語--typescriptstrict--nouncheckedindexedaccess)
  - [PWA — `@serwist/next`](#pwa--serwistnext)
  - [LP — Astro + Tailwind + Cloudflare Workers + Static Assets](#lp--astro--tailwind--cloudflare-workers--static-assets)
  - [バックエンド — Supabase 完結（services/ なし）](#バックエンド--supabase-完結services-なし)
  - [DB — PostgreSQL（Supabase）](#db--postgresqlsupabase)
  - [認証 — Supabase Auth + SSR（`@supabase/ssr`）](#認証--supabase-auth--ssrsupabasessr)
  - [ホスティング（app） — AWS Amplify Hosting](#ホスティングapp--aws-amplify-hosting)
  - [ホスティング（LP） — Cloudflare Workers + Static Assets](#ホスティングlp--cloudflare-workers--static-assets)
  - [モノレポ — pnpm + Turborepo](#モノレポ--pnpm--turborepo)
  - [ウェイトリスト — Loops.so + Supabaseミラー](#ウェイトリスト--loopsso--supabaseミラー)
  - [環境変数 — `astro:env`](#環境変数--astroenv)
- [4. 設計で意識していること](#4-設計で意識していること)
  - [4.1 「Supabase完結（services/なし）」と決めた根拠](#41-supabase完結servicesなしと決めた根拠)
  - [4.2 複雑処理の置き場所を3階層で整理](#42-複雑処理の置き場所を3階層で整理)
  - [4.3 apps/web と apps/website を分離した理由](#43-appsweb-と-appswebsite-を分離した理由)
  - [4.4 ウェイトリストの「Loops + Supabaseミラー」二重化](#44-ウェイトリストのloops--supabaseミラー二重化)
- [5. UI / UX で意識していること](#5-ui--ux-で意識していること)
- [6. 運用で見ること（リリース後）](#6-運用で見ることリリース後)
- [7. テスト・品質担保の方針](#7-テスト品質担保の方針)
- [8. 今後やること](#8-今後やること)
- [9. このプロジェクトで得ている経験 → 業務での再現性](#9-このプロジェクトで得ている経験--業務での再現性)
- [10. プロジェクトの構成（概要）](#10-プロジェクトの構成概要)


## 1. なぜ作るか — Excel運用の限界とWebアプリ化の動機

長年、自分の家計（固定費・収入・資産推移）をExcelで管理してきましたが、以下の限界がありました：

- **モバイルからの入力・確認が辛い**：PCを開かないと参照できない
  - また、モバイルから入力しようとするとExcelの関数が壊れてしまう
- **グラフ更新が手動**：データを足すたびにグラフ範囲を直す手間
- **複数デバイス間の同期コスト**：Excelのため、どこかで開いていると使えない
- **集計の柔軟性が低い**：複雑なクロス集計はピボットテーブルで限界

「自分が一番使うツールだからこそ、自分で作って継続的に改善する」をテーマに、Next.js + Supabase でWebアプリ化することにしました。

### 個人開発の中での位置づけ

trecord（モバイル × AWS）・nomow（モバイル × オフライン）・pomo（モバイル × 軽量）に続く第4作で、**Web × Supabase完結スタック** を選択。

意図的に違う技術構成にすることで、自分の技術スタックの幅を広げる検証も兼ねています。

### 開発状況：Build in Public + ウェイトリスト先行

本アプリは現在開発中で、以下の方針で進めています：

- **LPを先行公開** してウェイトリスト受付を開始
- 開発進捗を **X（旧Twitter） + ウェイトリストメール** で定期発信
- β版完成時に **ウェイトリスト登録者へ先行招待**
- 正式リリース時に **X + waitlist + Product Hunt** で発表

> 「**作って終わり**」ではなく「**作る過程を見せる**」ことで、思考プロセス自体を見てもらえる個人開発を目指しています。


## 2. 解決したい課題と機能の対応

> 現在は開発中です。下記は今後の予定も含めた **設計・実装中の機能** です（DB設計は完了、テーブル作成・画面実装はこれから）。

### 固定費・定期支出の管理
固定費・サブスクの全体像が把握できない課題に対し、サブスク・公共料金などの **固定費・定期支出の管理** を提供予定。

また、今月のカード支払いがどのくらいか・口座引き落としなど含めた全体はどのくらいかなど、**出ていったお金ではなく出ていくお金を管理**する仕組みを提供予定。

### 収入履歴の管理
収入の月次推移が分かりづらい課題に対し、給与明細レベルの **収入履歴の管理** を提供予定。

### 資産トラッキング
資産（投信 / 暗号資産 / 貯金）の全体推移が分散している課題に対し、定期スナップショットによる **資産トラッキング** を提供予定。

また、収入に対してどれくらい貯金・積み立てできているか（いわゆる貯蓄率）なども算出し、推移を可視化する仕組みを提供予定。

### 各種集計・グラフ
分類別 / 引落先別の集計が手動でしんどい課題に対し、**分類別・引落先別・推移などの集計グラフ** を提供予定。

### PWA でPC・スマホ両対応
PCでもスマホでも見たい課題に対し、**PWA**（`@serwist/next`）でアプリライクに利用可能にする。

### Supabase Auth + RLS でデータ分離
データを安全に保管したい課題に対し、**Supabase Auth + RLS** でユーザーごとに完全分離。


## 3. 技術選定の理由

### フロント — Next.js（App Router） + React + Tailwind
- **理由**：SSR / 静的配信 / API Routes が1つで揃う / App Router で Server Components の利点を取れる
- **比較検討**：
  - Remix / SvelteKit
  - モバイル（ReactNative）
    - モバイルでも使いたいが、システム上どうしても横に長くなるもの＆PCから入力する場面が多くなりそうなのでまずはWebから着手
    - 入力・閲覧に特化したモバイル版を開発してもよいが、まずはWebを作成し、PWAで少しでも使いやすいようにする想定

### 言語 — TypeScript（strict + `noUncheckedIndexedAccess`）
- **理由**：個人開発の継続テーマ / 配列・オブジェクトアクセスの安全性も上げる

### PWA — `@serwist/next`
- **理由**：Next.js 公式推奨のService Worker構成
- **比較検討**：next-pwa（メンテ停滞気味）

### LP — Astro + Tailwind + Cloudflare Workers + Static Assets
- **理由**：SEO + 初回表示速度 / 静的サイトで無料運用 / Cloudflare WorkersでAPIルートだけ動的化
- **比較検討**：Next.js（LPには重い）

### バックエンド — Supabase 完結（services/ なし）
- **理由**：PostgREST + RLS + Auth で CRUD + 認証 + 認可が完結 / 自前APIを書かない
- **比較検討**：Hono on Workers / Express

### DB — PostgreSQL（Supabase）
- **理由**：リレーショナル要件強め / Supabaseの無料枠500MB
- **比較検討**：DynamoDB / SQLite

### 認証 — Supabase Auth + SSR（`@supabase/ssr`）
- **理由**：JWT発行・検証・SNSログイン（Google / Apple / Facebook）まで標準
- **比較検討**：Auth0 / Firebase Auth

### ホスティング（app） — AWS Amplify Hosting
- **理由**：Next.jsのSSR対応 / 自動ビルド / Vercel Hobbyの商用利用NG問題を回避
- **比較検討**：Vercel Pro $20 / Cloudflare Pages

### ホスティング（LP） — Cloudflare Workers + Static Assets
- **理由**：`@astrojs/cloudflare` の統合Workersモデルで配信 / 無料枠で十分
- **比較検討**：Cloudflare Pages

### モノレポ — pnpm + Turborepo
- **理由**：`@yarikuri/shared` で型流通 / Trecordで確立した構成を踏襲
- **比較検討**：Nx

### ウェイトリスト — Loops.so + Supabaseミラー
- **理由**：SaaS特化で実装コスト低 / バックアップとしてSupabaseにINSERT
- **比較検討**：Beehiiv / Kit / 自作

### 環境変数 — `astro:env`
- **理由**：サーバー / クライアント / 機密 / 公開 を **型で分離**
- **比較検討**：`import.meta.env` 直接利用


## 4. 設計で意識していること

### 4.1 「Supabase完結（services/なし）」と決めた根拠

最も時間をかけて意思決定したのが「**バックエンドを書くか書かないか**」。Supabase は単なる PostgreSQL ホスティングではなく、以下を全部マネージドで提供しています：

| 機能 | 役割 |
| --- | --- |
| **PostgREST** | 全テーブルに対するREST APIを自動生成 |
| **Row Level Security (RLS)** | DB層で認可をポリシーとして強制 |
| **Auth** | JWT発行・検証、SNS OAuth |
| **Realtime** | WebSocketでテーブル変更購読 |
| **Storage** | S3互換のファイル置き場 |
| **Edge Functions** | Denoベースのサーバーレス関数 |

CRUD + 認証 + 認可の3点セットが「**ブラウザから Supabase Client SDK を呼ぶだけ**」で完結するため、フェーズ1では自前APIサーバーを書かない判断にしました。

**比較した代替案**：

- **Hono on Cloudflare Workers**：レイテンシが+1ホップ増えるだけで、Supabase直叩きとほぼ同コスト
- **Hono on Amplify同居**：型生成 → ルート定義 → クライアント → ルートの多段で工数が無駄に増える

Hono を挟むメリット（N+1解消 / キャッシュ層 / 重いデータ変換）は、本アプリの規模では発生しないため不要と判断。

### 4.2 複雑処理の置き場所を3階層で整理

将来的に複雑処理が必要になった場合の置き場所を、**3階層の優先順位**で先に決めています：

| 優先 | 置き場所 | 用途 |
| --- | --- | --- |
| 1 | **DBのSQL/PL/pgSQL関数 + Supabase RPC** | 集計・JOIN・トランザクション（DB内で完結、ネットワーク往復ゼロ） |
| 2 | **Supabase Edge Functions（Deno）** | 外部API連携 / Webhook受信 / CRON |
| 3 | **Next.js API Routes** | Next.jsセッションと密結合 + 秘密鍵を使う処理 |

> 「**処理の置き場所のガイドラインを先に決めておく**」ことで、機能追加時に「これどこに書く？」で迷う時間がなくなります。業務でもチーム規約として効くパターンです。

### 4.3 apps/web と apps/website を分離した理由

```
apps/
├── web/       — Yarikuri本アプリ（Next.js + PWA）
└── website/   — マーケティング/LPサイト（Astro）
```

LPとアプリを **意図的に別ビルド・別ホスティング** に分けています：

- **LPはSEO / 初回表示速度が命** → 静的サイト（Astro）が正解。Next.jsに統合すると速度面で不利
- **ホスティングコスト**: Cloudflare Workers（LP / 無料）+ Amplify（App）の方が安く済む
- **Notion / Linear / Figma** など主要SaaSも同じ構成（marketingサイトとappが別ビルド）

> 「**LPと本アプリを分離する**」判断は、業務でも **マーケティング部門と開発部門の責務分離** の議論にそのまま接続できます。

### 4.4 ウェイトリストの「Loops + Supabaseミラー」二重化

ウェイトリストの実装で、**配信の真実はLoops、バックアップはSupabase** の二重化構成にしました。

```
フォーム → /api/waitlist → Loops.so (POST /api/v1/contacts/create)
                       ↓
                       Supabase waitlist テーブルへミラーINSERT
```

- **Loops** が delivery のSource of Truth：配信・分析・自動返信を担う
- **Supabase** はバックアップ：将来のサービス間連携・自社施策に使えるよう確保
- **service role key は使わない**：anon key + RLS の INSERT-only ポリシーで十分

> 「**SaaSとデータベースを併用してデータ主権を保つ**」設計は、業務での外部ツール導入時にも応用できるパターン。


## 5. UI / UX で意識していること

- **入力デバイスはPC前提、閲覧デバイスはPC + スマホ**：給与明細30項目の入力はPC前提の設計。閲覧側は **PWA でスマホ最適化**
- **ダッシュボードファースト**：開いた瞬間に資産推移・今月の固定費・収入が見える
- **データの「分類別」「引落先別」両軸での集計**：Excelのピボットテーブル相当を、UIでクリック切り替え可能に
- **モバイルでの省入力UI**：閲覧主体だが、出先で「資産スナップショットだけ取りたい」ニーズも想定


## 6. 運用で見ること（リリース後）

- **Supabase ダッシュボード**：DB使用量（無料枠500MB）、API呼び出し数、Auth登録数
- **AWS Amplify Hosting**：ビルド失敗、月次コスト
- **Cloudflare Workers**：LP のリクエスト数（無料枠100K/日）
- **Loops.so 分析**：ウェイトリスト登録数、開封率
- **エラー監視**：<!-- TODO: Sentry等の導入を予定 -->


## 7. テスト・品質担保の方針

- **型チェック**：TypeScript strict + `noUncheckedIndexedAccess`
- **Lint / Format**：ESLint 9 (flat config) + Prettier、pre-commit で自動実行（husky + lint-staged）
- **CI**：現状は未整備。型チェック・Lint・ビルドは **ローカル + pre-commit** で担保。GitHub Actions での自動化は今後導入予定
- **RLS テスト**：<!-- TODO: Supabase migrations にRLSテストSQLを同梱予定 -->
- **マイグレーション管理**：`infra/supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` 形式、RLSポリシーも同ファイル内に記述


## 8. 今後やること

- **LP実装**：Astro + Tailwind + Cloudflare Pages
  - まずLPから作ることで、Build in publicで過程も見せつつ集客もしていく
- **MVP実装**（フェーズ1）：自分用として固定費・収入・資産の3軸を入力・可視化できる状態まで
- **β版招待**：ウェイトリスト登録者へ先行招待
- **正式リリース**：X / Product Hunt 発表
- **フェーズ2（収益化）**：Stripe Checkout で課金機能を追加（Supabase Edge Functions で Webhook受信）
- **複数通貨対応**：暗号資産含む、為替レートAPI連携（Edge Functions + CRON）
- **データインポート**：既存のExcelからのインポート機能


## 9. このプロジェクトで得ている経験 → 業務での再現性

- **「自前で書く前にマネージドサービスで詰める」意思決定プロセス**：Supabase完結 vs 自前API の比較を、コスト・レイテンシ・DXの3軸で明文化した経験は、業務での **マネージド vs 自前 vs OSS** の議論にそのまま使えます
- **将来の複雑処理の置き場所を3階層で先に決めておく設計**：「DB RPC → Edge Functions → API Routes」の優先順位は、業務でも **マイクロサービス境界・処理の責務分離** の議論に応用できる
- **LP / 本アプリを分離する判断とコスト最適化**：Cloudflare Workers + Amplify Hostingの組合せで月額をミニマムに抑える経験は、事業会社の **インフラコスト最適化** に直結
- **Build in Public による開発の透明化**：意思決定の過程を公開する経験は、業務での **設計判断のドキュメント化・ステークホルダー共有** にそのまま接続
- **型安全な環境変数管理（`astro:env`）と Cloudflare Workers 統合 Workers モデルの構築**：Next.js / Astro / Workersといった **比較的新しい技術スタック** を、本番を見据えて適切に組み合わせる経験（LPは公開済み、本アプリは構築中）


---


## 10. プロジェクトの構成（概要）

```
yarikuri/
├── apps/
│   ├── web/        — Yarikuri 本アプリ（Next.js + Tailwind + PWA）
│   └── website/    — マーケティング/LPサイト（Astro + Tailwind）
├── packages/
│   └── shared/     — 共有の型・ユーティリティ
├── infra/
│   └── supabase/   — Supabase CLI 設定・migrations・Edge Functions
└── docs/           — 設計ドキュメント（技術選定の壁打ち記録含む）
```