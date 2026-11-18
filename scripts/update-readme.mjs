/**
 * README.md の自動更新欄（ブログの新着・アプリの最新版）を書き換える。
 *
 * - ブログ: rarzyu.com の RSS から新しい記事を5件
 * - アプリ: iTunes lookup API から App Store の今のバージョンと公開日
 *
 * 取得に失敗した・件数が0のときは README を書き換えずに終了コード 1 で終わる。
 * マーカーの間だけを置き換え、結果が今と同じなら書き込まない。
 *
 * 実行: node scripts/update-readme.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const README_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "README.md");
const RSS_URL = "https://rarzyu.com/rss.xml";
const BLOG_LIMIT = 5;

/** App Store に出しているアプリ（リンクは README の Products と同じ URL） */
const APPS = [
    { name: "Trecord", id: "6754829217" },
    { name: "pomo", id: "6502401630" },
    { name: "nomow", id: "6474133320" },
];

/**
 * URL を取得して本文を文字列で返す。HTTP エラーは例外にする。
 * @param {string} url 取得する URL
 * @returns {Promise<string>} レスポンスの本文
 */
async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`${url} の取得に失敗しました（HTTP ${res.status}）`);
    }
    return res.text();
}

/**
 * 日時を JST の YYYY-MM-DD にする。
 * @param {string | Date} value 日時（Date か、Date が解釈できる文字列）
 * @returns {string} JST の日付
 */
function toJstDate(value) {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) {
        throw new Error(`日時を解釈できません: ${value}`);
    }
    return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * XML の実体参照（&amp; など）を文字に戻す。CDATA は中身を取り出す。
 * @param {string} text XML のテキスト
 * @returns {string} 実体参照を戻したテキスト
 */
function decodeXmlEntities(text) {
    const cdata = text.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
    if (cdata) {
        return cdata[1];
    }
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, ref) => {
        if (ref[0] === "#") {
            const code = ref[1].toLowerCase() === "x" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
            return String.fromCodePoint(code);
        }
        return named[ref.toLowerCase()] ?? match;
    });
}

/**
 * Markdown のリンク文字列で崩れる文字（\ [ ] |）をエスケープする。
 * @param {string} text リンク文字列
 * @returns {string} エスケープしたリンク文字列
 */
function escapeMarkdown(text) {
    return text.replace(/[\\[\]|]/g, "\\$&");
}

/**
 * RSS の item 要素から、指定したタグの中身を取り出す。
 * @param {string} item item 要素の XML
 * @param {string} tag タグ名
 * @returns {string} タグの中身（実体参照は戻す）
 */
function readTag(item, tag) {
    const match = item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    if (!match) {
        throw new Error(`RSS の item に <${tag}> がありません`);
    }
    return decodeXmlEntities(match[1].trim());
}

/**
 * RSS 2.0 から記事を取り出し、pubDate の新しい順に並べる。
 * @param {string} xml RSS の XML
 * @returns {{ title: string, link: string, date: Date }[]} 新しい順の記事
 */
function parseRss(xml) {
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    return items
        .map((item) => ({
            title: readTag(item, "title"),
            link: readTag(item, "link"),
            date: new Date(readTag(item, "pubDate")),
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * ブログの新着欄の中身を作る。
 * @returns {Promise<string>} 記事を1行ずつ空行で区切った Markdown
 */
async function buildBlogSection() {
    const posts = parseRss(await fetchText(RSS_URL)).slice(0, BLOG_LIMIT);
    if (posts.length === 0) {
        throw new Error("RSS に記事がありません");
    }
    return posts
        .map((post) => `[${escapeMarkdown(post.title)}](${post.link}) - ${toJstDate(post.date)}`)
        .join("\n\n");
}

/**
 * iTunes lookup API でアプリの今のバージョンと公開日を取る。
 * @param {{ name: string, id: string }} app アプリ
 * @returns {Promise<{ version: string, releaseDate: string }>} バージョンと公開日（JST）
 */
async function fetchAppVersion(app) {
    const data = JSON.parse(await fetchText(`https://itunes.apple.com/lookup?id=${app.id}&country=jp`));
    const result = data.results?.[0];
    if (!result?.version || !result?.currentVersionReleaseDate) {
        throw new Error(`${app.name} の情報が lookup API から取れませんでした`);
    }
    return { version: result.version, releaseDate: toJstDate(result.currentVersionReleaseDate) };
}

/**
 * アプリの最新版欄の中身を作る。
 * @returns {Promise<string>} アプリを1行ずつ空行で区切った Markdown
 */
async function buildAppsSection() {
    const lines = await Promise.all(
        APPS.map(async (app) => {
            const { version, releaseDate } = await fetchAppVersion(app);
            return `[**${app.name}**](https://apps.apple.com/app/id${app.id}) ${version} - ${releaseDate}`;
        }),
    );
    return lines.join("\n\n");
}

/**
 * README のマーカーの間を置き換える。マーカーの外は変えない。
 * @param {string} readme README の全文
 * @param {string} name マーカーの名前（blog / apps）
 * @param {string} content マーカーの間に入れる中身
 * @returns {string} 置き換えた README の全文
 */
function replaceSection(readme, name, content) {
    const start = `<!-- ${name}:start -->`;
    const end = `<!-- ${name}:end -->`;
    const startIndex = readme.indexOf(start);
    const endIndex = readme.indexOf(end);
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        throw new Error(`README に ${start} 〜 ${end} のマーカーがありません`);
    }
    const newline = readme.includes("\r\n") ? "\r\n" : "\n";
    const body = content.replace(/\n/g, newline);
    return readme.slice(0, startIndex + start.length) + newline + body + newline + readme.slice(endIndex);
}

/**
 * 2つの欄を取得して README を更新する。失敗したら書き換えずに終了コード 1 で終わる。
 * @returns {Promise<void>}
 */
async function main() {
    const [blog, apps] = await Promise.all([buildBlogSection(), buildAppsSection()]);
    const current = await readFile(README_PATH, "utf8");
    const updated = replaceSection(replaceSection(current, "blog", blog), "apps", apps);
    if (updated === current) {
        console.log("README.md は変わりませんでした");
        return;
    }
    await writeFile(README_PATH, updated, "utf8");
    console.log("README.md を更新しました");
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
