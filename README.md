# Mind Map App

Vite + React + AWS Amplify Gen2 で構築したマインドマップアプリです。  
プロジェクトごとにマインドマップを作成し、ノードの追加・削除・編集・ドラッグ移動ができます。

<img width="800" height="600" alt="image" src="https://github.com/user-attachments/assets/0f24ef31-12bb-46cf-8036-7cac10f6ff57" />


## 主な機能

- プロジェクト（マインドマップ）の作成・削除
- ノードの追加（ホバーして `+` ボタン）・削除（ホバーして `×` ボタン）
- ノードラベルのインライン編集（ダブルクリック → Enter または クリック外で保存）
- ドラッグによる自由配置（位置は自動保存）
- ノード追加・削除時の自動レイアウト（横方向ツリー）
- 「自動整列」ボタンで手動再レイアウト
- Amazon Cognito によるメールアドレス認証
- デスクトップ：サイドバー常時表示 / モバイル：ハンバーガーメニュー

## 技術スタック

| 項目 | 内容 |
|------|------|
| フロントエンド | Vite + React 18 + TypeScript |
| マインドマップ描画 | @xyflow/react (React Flow v12) |
| バックエンド | AWS Amplify Gen2 (AppSync + DynamoDB) |
| 認証 | Amazon Cognito (メールアドレス) |
| インフラ | AWS CDK (Amplify Gen2 が自動管理) |

## ローカルでのテスト

### 前提条件

- Node.js 18 以上
- AWS アカウントと設定済みの認証情報（`~/.aws/credentials`）
- AWS IAM ユーザーに Amplify / CloudFormation / DynamoDB / AppSync / Cognito の権限

### 1. 依存パッケージのインストール

```bash
cd mindmap-react-front
npm install
```

### 2. Amplify サンドボックスの起動（バックエンドデプロイ）

```bash
npx ampx sandbox
```

初回は CloudFormation スタックの作成に **3〜5 分** かかります。  
完了すると `amplify_outputs.json` がプロジェクトルートに生成されます。

> WSL 環境で DNS エラーが出た場合は、別ターミナルで以下を実行してください。
> ```bash
> npx ampx generate outputs --format json --out-dir .
> ```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開きます。  
サンドボックスは起動したまま（ファイル変更を監視してホットリロード）。

### 4. サンドボックスの停止

開発が終わったら `Ctrl + C` でサンドボックスを停止します。  
AWSリソースを削除する場合は以下を実行します。

```bash
npx ampx sandbox delete
```

---

## Amplify Console へのデプロイ

### 1. GitHub にリポジトリを作成して push

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

### 2. Amplify Console でアプリを作成

1. [AWS Amplify Console](https://console.aws.amazon.com/amplify/) を開く
2. 「Create new app」→「Host web app」
3. GitHub を選択してリポジトリと `main` ブランチを接続
4. 「App settings」で **Root directory** に `mindmap-react-front` を設定  
   （モノレポ構成の場合。このリポジトリのみの場合は空欄でOK）
5. ビルド設定は `amplify.yml` が自動認識されるため変更不要
6. 「Save and deploy」

### 3. デプロイの確認

- Amplify Console のビルドログで `Backend synthesized` → `Deployment completed` を確認
- 発行された URL（例: `https://main.xxxxxx.amplifyapp.com`）でアプリにアクセス

### 継続的デプロイ

`main` ブランチへの push ごとに Amplify Console が自動でビルド・デプロイします。

---

## データモデル

```
MindMapProject
  id           : ID (自動生成)
  name         : String (必須)
  displayOrder : Int

MindMapNode
  id           : ID (自動生成)
  projectId    : ID (必須) ─── MindMapProject.id
  parentId     : ID         ─── 親ノードの ID（ルートノードは null）
  label        : String (必須)
  x            : Float (必須) ─── 画面上の X 座標
  y            : Float (必須) ─── 画面上の Y 座標
  color        : String       ─── ノードカラー
```

認証は Cognito ユーザープール。各ユーザーは自分のデータのみ参照・変更できます（owner-based authorization）。
