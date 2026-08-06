// 어느 슬라이드를 몇 단계로 나눠 등장시킬지 계획해 steps.txt 로 내보낸다.
// PowerShell 5.1 이 UTF-8 .ps1 의 한글 리터럴을 깨뜨리므로, 한글 매칭은 여기(Node)에서 하고
// .ps1 에는 ASCII 숫자/문자만 넘긴다.
//
// 원칙: 기본은 "한 단계" — 본문 전체가 한 번에 부드럽게 나타난다.
//       내레이션이 하나씩 짚어야 하는 슬라이드만 2~3단계로 나눈다.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const deck = path.join(__dirname, "pitch_src.pptx");
const tmp = path.join(process.env.TEMP || ".", "planstep");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
try { execSync(`unzip -o -q "${deck}" -d "${tmp}"`); } catch (e) {}

// 발표 순서 = presentation.xml 의 sldIdLst 순서
const rels = fs.readFileSync(path.join(tmp, "ppt", "_rels", "presentation.xml.rels"), "utf8");
const relMap = {};
[...rels.matchAll(/Id="([^"]+)"[^>]*Target="[^"]*?(slide\d+\.xml)"/g)].forEach((m) => (relMap[m[1]] = m[2]));
[...rels.matchAll(/Target="[^"]*?(slide\d+\.xml)"[^>]*Id="([^"]+)"/g)].forEach((m) => (relMap[m[2]] = m[1]));
const pres = fs.readFileSync(path.join(tmp, "ppt", "presentation.xml"), "utf8");
const order = [...pres.matchAll(/<p:sldId[^>]*r:id="([^"]+)"/g)].map((m) => relMap[m[1]]).filter(Boolean);

// 여러 단계로 나눌 슬라이드 — [식별 문구, 그룹 축, 최대 그룹 수]
const MULTI = [
  ["방금 발표 분석 결과", "x", 3],       // 필러 → 공백 → 시선 이탈, 하나씩 공개
  ["세 가지를 한 번에 봅니다", "x", 3],   // 입력 → AIVO → 출력
  ["지금까지의 연습 방법", "y", 2],       // 3열 비교 → 결론 한 줄
  ["슬라이드 단위로 연결합니다", "y", 3], // 전환 트랙 → 발화 트랙 → 결과
];

const lines = [];
order.forEach((f, i) => {
  const xml = fs.readFileSync(path.join(tmp, "ppt", "slides", f), "utf8");
  const text = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(" ");
  const hit = MULTI.find(([kw]) => text.includes(kw));
  if (hit) lines.push(`${i + 1} ${hit[1]} ${hit[2]}`);
});

fs.writeFileSync(path.join(__dirname, "steps.txt"), lines.join("\n") + "\n", "ascii");
fs.rmSync(tmp, { recursive: true, force: true });
console.log("다단계 슬라이드:");
lines.forEach((l) => console.log("  " + l));
console.log("나머지는 전부 1단계(본문 전체 동시 등장)");
