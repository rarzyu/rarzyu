# pomo — ポモドーロタイマー / 勉強・仕事に集中 <!-- omit in toc -->

[![App Store](https://img.shields.io/badge/App%20Store-0D96F6?style=for-the-badge&logo=apple&logoColor=white)](https://apps.apple.com/app/id6502401630)
[![Google Play](https://img.shields.io/badge/Google%20Play-414141?style=for-the-badge&logo=googleplay&logoColor=white)](https://play.google.com/store/apps/details?id=com.rarzyu.pomodoro_timer)
[![Website](https://img.shields.io/badge/LP-pomo.rarzyu.com-2ea44f?style=for-the-badge)](https://pomo.rarzyu.com)

ポモドーロ・テクニックを使って、勉強・仕事・コーディングなどあらゆる集中作業の生産性を高めるシンプルなタイマーアプリ。**作業時間 / 休憩時間 / セット数を自由にカスタマイズ可能**、ダークモード基調（既定はダーク・ライトにも切替可）、8言語対応。

> このREADMEは「pomoで何を考え、どう作ったか」を採用担当者・他エンジニアに向けて伝えることを目的にしています。リポジトリ自体はprivate管理のため、ここでは設計・運用の意思決定を中心に記載します。

- [1. なぜ作ったか](#1-なぜ作ったか)
- [2. 解決したかった課題と機能の対応](#2-解決したかった課題と機能の対応)
  - [シンプルな1画面構成](#シンプルな1画面構成)
  - [タイマーの自由カスタマイズ](#タイマーの自由カスタマイズ)
  - [画面の常時表示（Keep Awake）](#画面の常時表示keep-awake)
  - [多チャネル通知](#多チャネル通知)
  - [8言語対応](#8言語対応)
  - [ダークモードを既定に](#ダークモードを既定に)
- [3. 技術選定の理由](#3-技術選定の理由)
  - [モバイル — React Native (Expo) + TypeScript](#モバイル--react-native-expo--typescript)
  - [ルーティング — expo-router](#ルーティング--expo-router)
  - [状態管理 — React Context（AppSettings / InAppPurchase）](#状態管理--react-contextappsettings--inapppurchase)
  - [永続化 — AsyncStorage](#永続化--asyncstorage)
  - [i18n — i18next + react-i18next](#i18n--i18next--react-i18next)
  - [エラー監視 — Sentry React Native（`@sentry/react-native`）](#エラー監視--sentry-react-nativesentryreact-native)
  - [広告 / 課金 — AdMob + `react-native-iap`](#広告--課金--admob--react-native-iap)
  - [Webサイト（LP） — Astro + Tailwind + Cloudflare Pages](#webサイトlp--astro--tailwind--cloudflare-pages)
- [4. 設計で意識したこと](#4-設計で意識したこと)
  - [4.1 タイマーロジック：状態とフェーズ遷移を1か所に集約](#41-タイマーロジック状態とフェーズ遷移を1か所に集約)
  - [4.2 状態管理：Provider階層を「寿命」で並べる](#42-状態管理provider階層を寿命で並べる)
- [5. UI / UX で意識したこと](#5-ui--ux-で意識したこと)
- [6. 運用で見ていること](#6-運用で見ていること)
- [7. テスト・品質担保](#7-テスト品質担保)
- [8. 今後改善したいこと](#8-今後改善したいこと)
- [9. このプロジェクトで得た経験 → 業務での再現性](#9-このプロジェクトで得た経験--業務での再現性)
- [10. プロジェクトの構成（概要）](#10-プロジェクトの構成概要)


## 1. なぜ作ったか

集中作業に取り組むなかで「ポモドーロは試したいけれど、既存アプリは機能過多 / 広告過多 / カスタマイズしづらい」という不満を感じることが多く、**自分が一番使いたいシンプルさで作り直す**ことをテーマに開発しました。

同じ React Native + Expo の構成で、trecord（筋トレ記録）・nomow（サプリ管理）に続く「自分の生活で使うtoCアプリ」シリーズの第3弾です。

> 個人開発で **trecord / nomow で確立したパターンを別ドメインに横展開できるか** を検証することも、このプロジェクトの目的の1つでした。


## 2. 解決したかった課題と機能の対応

### シンプルな1画面構成
既存アプリは機能過多で迷うという課題に対し、**1画面で完結** するタイマーUIを提供。

### タイマーの自由カスタマイズ
25分 / 5分の固定ペースが合わないという課題に対し、**作業時間・休憩時間・長休憩のタイミング・セット数を自由に設定** 可能。

### 画面の常時表示（Keep Awake）
集中中に画面が消えると進捗が見えない課題に対し、**画面の常時表示** に対応。

### 多チャネル通知
タイマー終了の合図に気付きづらい課題に対し、**通知 + サウンド + バイブレーション** で知らせる。

### 8言語対応
海外ユーザーにも届けたい課題に対し、**8言語対応**（ja / en / zh / ko / es / fr / de / pt_BR）。

### ダークモードを既定に
暗い場所での作業で目が疲れる課題に対し、**ダークモードを既定** に設計（システム設定連動でライトにも切替可能）。


## 3. 技術選定の理由

### モバイル — React Native (Expo) + TypeScript
- **理由**：trecord / nomowと同じ構成で **パターンを横展開** / TypeScriptへの軸足統一
- **比較検討**：Flutter / Native

### ルーティング — expo-router
- **理由**：ファイルベースの宣言的ルーティング
- **比較検討**：React Navigation

### 状態管理 — React Context（AppSettings / InAppPurchase）
- **理由**：アプリ全体の永続設定と課金状態が主要 / Reduxまでは不要
- **比較検討**：Zustand / Redux

### 永続化 — AsyncStorage
- **理由**：設定値（テーマ・言語・カスタムタイミング）のみ / DB不要
- **比較検討**：expo-sqlite（オーバースペック）

### i18n — i18next + react-i18next
- **理由**：日本語をSource of Truthとした **型安全な翻訳キー**（`ja.ts` から型生成）/ 8言語対応

### エラー監視 — Sentry React Native（`@sentry/react-native`）
- **理由**：production限定で送信 / 画面遷移トレース / `getSentryExpoConfig` でMetro統合

### 広告 / 課金 — AdMob + `react-native-iap`
- **理由**：AdMob（バナー / インタースティシャル / リワード）で無料プランを収益化 / IAPでApple・Googleのストア課金に対応し、プレミアム購入で広告非表示

### Webサイト（LP） — Astro + Tailwind + Cloudflare Pages
- **理由**：LP・利用規約・お問い合わせ（Web3Forms）を静的サイト（SSG・8言語）で配信 / 無料ホスティング
- **比較検討**：Next.js（オーバースペック）

> 全体方針：**trecord / nomowで確立した「個人開発のテンプレート」を別ドメインで実証する** ことを軸に、不要な技術追加は避けています。


## 4. 設計で意識したこと

### 4.1 タイマーロジック：状態とフェーズ遷移を1か所に集約

タイマーは `useTimer` フックに集約しています。`setInterval`（1秒）で `remainingTime` をデクリメントしつつ、作業 → 休憩 → 長休憩 → … のフェーズ遷移を純粋関数（`getNextPhase`）に切り出して一元管理しています。

- **状態を `runningState`（idle / running / paused）と `status`（フェーズ）に分離**し、見通しを確保
- 残り時間が0になったらフェーズを進め、設定セット数を終えたら `finished` に遷移
- フェーズ遷移ロジックを純粋関数にしておくことで、テストしやすく副作用を局所化

> 現状は前面（フォアグラウンド）動作を前提とした `setInterval` ベースの実装で、**バックグラウンド中の経過時間のズレ補正は今後の改善対象**です（[8](#8-今後改善したいこと)）。`Date.now()` 基準の再計算に寄せるのが次の一手だと考えています。

### 4.2 状態管理：Provider階層を「寿命」で並べる

trecordで確立したパターンを踏襲し、Providerを **状態の寿命の長さ順** にネストしています。

```
QueryClient（あれば）
  └ InAppPurchaseProvider   ← 課金状態（アプリ起動中ずっと使う）
    └ AppSettingsProvider   ← 永続設定（テーマ・言語・タイマー設定）：AsyncStorage
      └ Screen Components   ← UI ステート
```

これにより、課金状態を変更してもタイマーUIが余計に再レンダされない・設定変更でもストア情報が保持される、といった **再レンダ範囲の最小化** が達成できます。

## 5. UI / UX で意識したこと

- **1画面で完結するシンプルさ**：タイマー画面で必要な操作が完結する
- **ダークモードを既定**：集中時間中に目が疲れにくい配色。システム設定連動でライトにも切替可能
- **大きな数字 + 大きなボタン**：作業中に視認・操作しやすい
- **画面の常時表示**：作業中にスリープしない（Keep Awake）
- **多チャネル通知**：通知 + サウンド + バイブレーションで気付きを担保
- **8言語対応**：型安全な翻訳キーで誤キーをコンパイル時検出
- **広告挿入の控えめさ**：集中を妨げないタイミングにのみ表示


## 6. 運用で見ていること

- **エラー監視**：[Sentry React Native](https://sentry.io/organizations/rarzyu/issues/) で production ビルドのみクラッシュ・エラーを収集
- **ストア審査対応**：プライバシーポリシー・利用規約・特商法をWebサイト（nomow.rarzyu.com）側で公開
- **ユーザーフィードバック**：Webサイトのお問い合わせフォーム（Web3Forms）で受け付け
- **広告 / 課金の収益**：AdMob / App Store Connect / Google Play Console で確認
- **マーケティング**：ASO分析・ストア掲載文言・施策を `docs/marketing` で管理


## 7. テスト・品質担保

- **型チェック**：TypeScript strict mode
- **手動QA**：ストア提出前のチェックリスト（8言語 × 課金状態 × 通知ON/OFFの組合せ要点を確認）


## 8. 今後改善したいこと

- **バックグラウンドでのタイマー精度改善**：現状は `setInterval` ベースのため、バックグラウンド復帰時に経過時間がズレる。`Date.now()` 基準の差分再計算へ寄せる
- テストコードの実装
  - 品質の担保のためにも、テストコードを実装する
- ツールの導入
  - PostHog
    - ユーザーの行動を分析し、どの機能がどの程度使われているかを把握するために導入を検討
  - RevenueCat
    - 課金の管理を効率化するために導入を検討


## 9. このプロジェクトで得た経験 → 業務での再現性

- **「個人開発のテンプレート」の検証**：trecord で確立した React Native + Expo + i18n + Sentry + Atomic Design のパターンを、別ドメインで再利用できることを実証。**新規プロダクトの立ち上げコストを下げる共通基盤** の作り方として業務に持ち込めます
- **タイマーの状態遷移を純粋関数に集約した設計**：`runningState` と `status` を分離し、フェーズ遷移を `getNextPhase` に閉じ込めたことで、状態の見通しとテスト容易性を確保（バックグラウンド時間補正は今後の課題として認識している）

---


## 10. プロジェクトの構成（概要）

```
pomo/
├── mobile/                 React Native (Expo) モバイルアプリ
│   ├── app/                expo-router ルート（_layout, (tabs), setting/, purchase/）
│   ├── src/
│   │   ├── components/     atoms / molecules / organisms
│   │   ├── screens/        画面コンポーネント
│   │   ├── context/        AppSettingsContext / InAppPurchaseContext
│   │   ├── hooks/          useAdmob / useInAppPurchase 等
│   │   ├── services/       外部サービス連携
│   │   ├── constants/      color / styles / link
│   │   ├── types/          型定義
│   │   ├── utils/          reportError / reportMessage 等
│   │   └── localizations/  i18n (8言語) + TK + translations/
│   └── assets/
├── website/                Astro + Tailwind + Cloudflare Pages（LP / 利用規約等）
├── design-system/          デザインシステム
└── docs/                   ドキュメント（design / marketing / operations）
```
