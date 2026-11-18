/**
 * 非公開リポジトリの使用言語の割合を、横の積み上げバー＋凡例の SVG にする。
 *
 * - 対象: トークンの持ち主が owner の非公開リポジトリ（fork・アーカイブ済みは除く）
 * - 集計: GitHub の languages API のバイト数を合算し、上位5言語＋その他にまとめる
 *
 * リポジトリ名は公開したくないので、コード・ログ・SVG のどこにも書かない（ログは件数だけ）。
 * トークンは環境変数 LANGS_TOKEN（メタデータの読み取りだけの fine-grained トークンで足りる）。
 * 取得に失敗した・集計が0件のときは書き出さずに終了コード 1 で終わる。
 *
 * 実行: node scripts/update-languages.mjs dist/languages.svg
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** 数えない言語（MDX はブログ・記事の本文のため） */
const EXCLUDED_LANGUAGES = ["MDX"];

const API_BASE = "https://api.github.com";
const PER_PAGE = 100;
const TOP_LIMIT = 5;
const OTHER_LABEL = "その他";

/** 言語の色（GitHub の言語の色）。無い言語は OTHER_COLOR */
const LANGUAGE_COLORS = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Astro: "#ff5a03",
    Shell: "#89e051",
    PowerShell: "#012456",
    CSS: "#563d7c",
    HTML: "#e34c26",
};
const OTHER_COLOR = "#959da5";

/** SVG の寸法と文字色（背景は透明。ライトでもダークでも読める中間の色） */
const SVG_WIDTH = 480;
const TITLE_COLOR = "#2f81f7";
const TEXT_COLOR = "#7d8590";

/**
 * GitHub API を叩いて JSON を返す。HTTP エラーは例外にする。
 * エラーの文言に URL を入れない（リポジトリ名が入るため）。
 * @param {string} path API のパス（/user/repos など）
 * @param {string} token GitHub のトークン
 * @returns {Promise<any>} レスポンスの JSON
 */
async function fetchGitHub(path, token) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "rarzyu-update-languages",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });
    if (!res.ok) {
        throw new Error(`GitHub API の呼び出しに失敗しました（HTTP ${res.status}）`);
    }
    return res.json();
}

/**
 * トークンの持ち主が owner の非公開リポジトリを、ページをたどって全部取る。fork とアーカイブ済みは除く。
 * @param {string} token GitHub のトークン
 * @returns {Promise<{ full_name: string }[]>} 対象のリポジトリ
 */
async function fetchPrivateRepos(token) {
    const repos = [];
    for (let page = 1; ; page++) {
        const batch = await fetchGitHub(
            `/user/repos?visibility=private&affiliation=owner&per_page=${PER_PAGE}&page=${page}`,
            token,
        );
        repos.push(...batch);
        if (batch.length < PER_PAGE) {
            break;
        }
    }
    return repos.filter((repo) => !repo.fork && !repo.archived);
}

/**
 * リポジトリごとの言語のバイト数を合算する。EXCLUDED_LANGUAGES は数えない。
 * @param {{ full_name: string }[]} repos 対象のリポジトリ
 * @param {string} token GitHub のトークン
 * @returns {Promise<Map<string, number>>} 言語 → バイト数
 */
async function sumLanguageBytes(repos, token) {
    const results = await Promise.all(repos.map((repo) => fetchGitHub(`/repos/${repo.full_name}/languages`, token)));
    const totals = new Map();
    for (const languages of results) {
        for (const [language, bytes] of Object.entries(languages)) {
            if (EXCLUDED_LANGUAGES.includes(language)) {
                continue;
            }
            totals.set(language, (totals.get(language) ?? 0) + bytes);
        }
    }
    return totals;
}

/**
 * バイト数を割合にし、上位 TOP_LIMIT 言語＋その他にまとめる。
 * @param {Map<string, number>} totals 言語 → バイト数
 * @returns {{ name: string, color: string, ratio: number }[]} 割合の大きい順（その他は最後）
 */
function toShares(totals) {
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const shares = sorted.slice(0, TOP_LIMIT).map(([name, bytes]) => ({
        name,
        color: LANGUAGE_COLORS[name] ?? OTHER_COLOR,
        ratio: bytes / sum,
    }));
    const otherBytes = sorted.slice(TOP_LIMIT).reduce((a, [, bytes]) => a + bytes, 0);
    if (otherBytes > 0) {
        shares.push({ name: OTHER_LABEL, color: OTHER_COLOR, ratio: otherBytes / sum });
    }
    return shares;
}

/**
 * XML の特殊文字（& < > "）をエスケープする。
 * @param {string} text テキスト
 * @returns {string} エスケープしたテキスト
 */
function escapeXml(text) {
    return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/**
 * 横の積み上げバーを作る（両端を丸めるため clipPath で切り抜く）。
 * @param {{ color: string, ratio: number }[]} shares 割合
 * @param {number} y バーの上端
 * @returns {string} SVG の断片
 */
function renderBar(shares, y) {
    let x = 0;
    const rects = shares.map((share) => {
        const width = share.ratio * SVG_WIDTH;
        const rect = `<rect x="${x.toFixed(1)}" y="${y}" width="${width.toFixed(1)}" height="8" fill="${share.color}"/>`;
        x += width;
        return rect;
    });
    return [
        `<clipPath id="bar"><rect x="0" y="${y}" width="${SVG_WIDTH}" height="8" rx="4"/></clipPath>`,
        `<g clip-path="url(#bar)">`,
        ...rects.map((rect) => `  ${rect}`),
        `</g>`,
    ].join("\n");
}

/**
 * 凡例を3列で並べる。
 * @param {{ name: string, color: string, ratio: number }[]} shares 割合
 * @param {number} y 1行目の文字のベースライン
 * @returns {string} SVG の断片
 */
function renderLegend(shares, y) {
    const columnWidth = SVG_WIDTH / 3;
    const rowHeight = 24;
    return shares
        .map((share, i) => {
            const cx = (i % 3) * columnWidth + 5;
            const baseline = y + Math.floor(i / 3) * rowHeight;
            const label = `${escapeXml(share.name)} ${(share.ratio * 100).toFixed(1)}%`;
            return [
                `<circle cx="${cx}" cy="${baseline - 4}" r="5" fill="${share.color}"/>`,
                `<text x="${cx + 9}" y="${baseline}" fill="${TEXT_COLOR}">${label}</text>`,
            ].join("");
        })
        .join("\n");
}

/**
 * タイトル・注記・バー・凡例をまとめて SVG にする。
 * @param {{ name: string, color: string, ratio: number }[]} shares 割合
 * @returns {string} SVG の全文
 */
function renderSvg(shares) {
    const legendY = 70;
    const rows = Math.ceil(shares.length / 3);
    const height = legendY + (rows - 1) * 24 + 10;
    return [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${height}" viewBox="0 0 ${SVG_WIDTH} ${height}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="12">`,
        `<text x="0" y="16" fill="${TITLE_COLOR}" font-size="15" font-weight="600">Most used languages</text>`,
        `<text x="0" y="33" fill="${TEXT_COLOR}" font-size="10">private repositories / ${escapeXml(EXCLUDED_LANGUAGES.join(", "))} excluded</text>`,
        renderBar(shares, 44),
        renderLegend(shares, legendY),
        `</svg>`,
        ``,
    ].join("\n");
}

/**
 * 集計して SVG を書き出す。失敗したら書き出さずに終了コード 1 で終わる。
 * @returns {Promise<void>}
 */
async function main() {
    const outputPath = process.argv[2];
    if (!outputPath) {
        throw new Error("出力先を引数で指定してください（例: node scripts/update-languages.mjs dist/languages.svg）");
    }
    const token = process.env.LANGS_TOKEN;
    if (!token) {
        throw new Error(
            "環境変数 LANGS_TOKEN がありません（リポジトリの Secrets に、メタデータの読み取りだけの fine-grained トークンを登録してください）",
        );
    }
    const repos = await fetchPrivateRepos(token);
    if (repos.length === 0) {
        throw new Error("対象の非公開リポジトリが0件でした");
    }
    const totals = await sumLanguageBytes(repos, token);
    if (totals.size === 0) {
        throw new Error("言語のデータが0件でした");
    }
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderSvg(toShares(totals)), "utf8");
    console.log(`非公開リポジトリ ${repos.length} 件から集計し、${outputPath} に書き出しました`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
