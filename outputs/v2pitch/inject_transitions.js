// 슬라이드 전환 효과 주입
//   기본: Fade 0.7s (은은하게)
//   Morph 0.9s: 바로 앞 슬라이드와 레이아웃이 같은 슬라이드 (숫자/문장이 자연스럽게 이동)
// CT_Slide 스키마 순서: cSld → clrMapOvr → transition → timing → extLst
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "_chk", "ppt", "slides");
const files = fs.readdirSync(dir).filter((f) => /^slide\d+\.xml$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

const MC = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
const P14 = 'xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"';

function fade(ms) {
  return `<mc:AlternateContent ${MC}><mc:Choice ${P14} Requires="p14">` +
    `<p:transition spd="med" p14:dur="${ms}"><p:fade/></p:transition>` +
    `</mc:Choice><mc:Fallback><p:transition spd="med"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>`;
}
function morph(ms) {
  return `<mc:AlternateContent ${MC}><mc:Choice ${P14} Requires="p14">` +
    `<p:transition spd="slow" p14:dur="${ms}"><p14:morph option="byObject"/></p:transition>` +
    `</mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>`;
}

// 각 슬라이드의 눈썹(섹션 라벨) 텍스트로 "앞 슬라이드와 같은 종류인지" 판정
const texts = files.map((f) => {
  const xml = fs.readFileSync(path.join(dir, f), "utf8");
  return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(" ");
});

function kindOf(t) {
  if (/향후 계획/.test(t)) return "plan";
  if (/시연 0/.test(t)) return "demo";
  if (/예상 질문 ·/.test(t)) return "qa";
  if (/기능 · (발표|면접|아카이브)/.test(t)) return "feature";
  return null;
}

let nFade = 0, nMorph = 0;
files.forEach((f, i) => {
  const p = path.join(dir, f);
  let xml = fs.readFileSync(p, "utf8");
  if (/<p:transition/.test(xml) || /<mc:AlternateContent/.test(xml)) return;

  const k = kindOf(texts[i]);
  const kPrev = i > 0 ? kindOf(texts[i - 1]) : null;
  // 앞 슬라이드와 같은 유형이 연속되면 Morph (숫자·제목이 자연스럽게 이동)
  const useMorph = k !== null && k === kPrev;
  const frag = useMorph ? morph(900) : fade(700);
  if (useMorph) nMorph++; else nFade++;

  if (xml.includes("<p:timing>")) {
    xml = xml.replace("<p:timing>", frag + "<p:timing>");
  } else if (xml.includes("</p:clrMapOvr>")) {
    xml = xml.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + frag);
  } else {
    xml = xml.replace("</p:sld>", frag + "</p:sld>");
  }
  fs.writeFileSync(p, xml, "utf8");
});

console.log(`fade: ${nFade}  morph: ${nMorph}  (총 ${files.length}장)`);
