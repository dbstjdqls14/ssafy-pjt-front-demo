// AIVO 발표덱 — Pitch Edition (카드 제거 · 여백 중심)
// 구조 언어: 채워진 카드/테두리 대신 (1) 얇은 상단 룰 + 라벨 (2) 행 사이 헤어라인 (3) 여백
// 색: 로고에서 추출한 브랜드 블루 #3B73EE. 대비 규칙에 따라 역할 분리.
const pptxgen = require("pptxgenjs");
const path = require("path");

const A = path.join(__dirname, "assets");
const LOGO_LIGHT = path.join(A, "logo_light.png");
const LOGO_DARK = path.join(A, "logo_dark.png");
const SCREEN = path.join(A, "screen_report.png");

/* ===== 토큰 ===== */
const BRAND = "3B73EE";
const BRAND_DEEP = "1F4FC4";
const BRAND_LIGHT = "8FA9F5";
const BRAND_PALE = "C9D8FA";
const LAV = "928AF7";
const INK = "11131B";
const BODY = "2E313D";
const MUTED = "747987";
const FAINT = "A9ADB8";
const PAPER = "FFFFFF";
const COOL = "F7F9FE";
const SLOT = "F2F4F9";
const LINE = "E4E6EE";
const HAIR = "ECEEF4";
const DARK = "0D0E12";
const BLACK = "000000";
const OK = "12A150";
const NO = "D95757";

const F = "Noto Sans KR";
const FH = "Noto Sans KR Black";

const W = 13.333, H = 7.5;
const M = 1.0;
const CW = W - M * 2;

const SECTIONS = ["문제 정의", "AIVO", "서비스 시연", "기능 소개", "사용 기술", "의의 · 향후"];

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Team 백구";
pres.company = "SSAFY B109";
pres.title = "AIVO — 발표와 면접 연습 영상을 분석해 맞춤형 피드백을 제공하는 AI 코칭 서비스";

let page = 0;

function slide(bg, sec) {
  const s = pres.addSlide();
  s.background = { color: bg || PAPER };
  page += 1;
  s._dark = bg === DARK || bg === BLACK;
  if (sec !== undefined && sec !== null) {
    const segW = 0.26, gap = 0.07;
    const total = SECTIONS.length * segW + (SECTIONS.length - 1) * gap;
    const sx = W - M - total;
    for (let i = 0; i < SECTIONS.length; i++) {
      const on = i === sec;
      const c = on ? BRAND : (s._dark ? "2A2D36" : LINE);
      s.addShape("roundRect", {
        x: sx + i * (segW + gap), y: 0.8, w: segW, h: 0.055, rectRadius: 0.027,
        fill: { color: c }, line: { color: c, width: 0 },
      });
    }
  }
  s.addText(String(page).padStart(2, "0"), {
    x: W - 1.1, y: H - 0.58, w: 0.5, h: 0.22, align: "right", margin: 0,
    fontFace: F, fontSize: 8.5, color: s._dark ? "4A4E5A" : FAINT,
  });
  return s;
}

function tx(s, t, o) {
  s.addText(t, Object.assign({ margin: 0, fontFace: F, align: "left", valign: "top" }, o));
}

/* 얇은 선 — 이 덱의 유일한 구조 요소 */
function rule(s, x, y, w, color, thick) {
  const c = color || LINE;
  s.addShape("rect", { x, y, w, h: thick || 0.014, fill: { color: c }, line: { color: c, width: 0 } });
}
function vrule(s, x, y, h, color) {
  const c = color || HAIR;
  s.addShape("rect", { x, y, w: 0.012, h, fill: { color: c }, line: { color: c, width: 0 } });
}

function eyebrow(s, t) {
  tx(s, t, {
    x: M, y: 0.73, w: 6.5, h: 0.28,
    fontSize: 10, bold: true, charSpacing: 1.6, color: s._dark ? BRAND_LIGHT : BRAND,
  });
}

function title(s, t, o) {
  o = o || {};
  tx(s, t, {
    x: M, y: o.y || 1.2, w: o.w || CW, h: o.h || 0.85,
    fontFace: FH, fontSize: o.size || 36, bold: true,
    color: s._dark ? PAPER : INK, lineSpacingMultiple: 1.2,
  });
  if (o.rule !== false) rule(s, M, o.ruleY || 2.24, CW, LINE);
}

function caption(s, t, y) {
  tx(s, t, { x: M, y: y || 6.35, w: CW, h: 0.32, fontSize: 12, color: MUTED });
}

/* 컬럼 헤드 — 상단 얇은 룰 + 라벨 (카드 대체) */
function colHead(s, x, y, w, label, o) {
  o = o || {};
  rule(s, x, y, w, o.ruleColor || BRAND, o.thick || 0.026);
  tx(s, label, {
    x, y: y + (o.gap || 0.22), w, h: o.h || 0.45,
    fontFace: FH, fontSize: o.size || 21, bold: true, color: o.color || INK,
  });
}

function statement(lines, o) {
  o = o || {};
  const s = slide(o.bg || PAPER, o.sec);
  if (o.eyebrow) eyebrow(s, o.eyebrow);
  tx(s, lines, {
    x: M, y: 2.2, w: CW, h: 2.6, valign: "middle", align: o.align || "left",
    fontFace: FH, fontSize: o.size || 50, bold: true,
    color: s._dark ? PAPER : (o.color || INK), lineSpacingMultiple: 1.2,
  });
  if (o.sub) tx(s, o.sub, {
    x: M, y: 5.0, w: CW, h: 0.5, align: o.align || "left",
    fontSize: 15, color: s._dark ? "A6ADBD" : MUTED,
  });
  return s;
}

function sectionCover(idx, name, sub) {
  const s = slide(DARK, idx);
  tx(s, String(idx + 1).padStart(2, "0"), {
    x: M, y: 2.35, w: 3, h: 1.5, valign: "middle", fontFace: FH, fontSize: 96, bold: true, color: BRAND,
  });
  tx(s, name, { x: M, y: 3.95, w: CW, h: 0.9, fontFace: FH, fontSize: 44, bold: true, color: PAPER });
  if (sub) tx(s, sub, { x: M, y: 4.98, w: CW, h: 0.4, fontSize: 14, color: "A6ADBD" });
  return s;
}

/* 실제 캡처 자산 — 있으면 쓰고, 없으면 자리만 남긴다 */
const fs = require("fs");
const SHOTS = path.join(__dirname, "shots");
function shot(name) {
  const p = path.join(SHOTS, name + ".png");
  if (!fs.existsSync(p)) return null;
  const b = fs.readFileSync(p);
  return { path: p, w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/* 기능 슬라이드.
   asset 이 주어지면 실제 화면 캡처를 우측에 원본 비율로 배치하고,
   없으면 테두리 없는 옅은 면으로 자리만 표시한다. */
function feature(sec, kicker, no, ttl, line, slotLabel, asset) {
  const s = slide(PAPER, sec);
  const img = asset ? shot(asset) : null;

  if (img) {
    // 실캡처가 있으면: 제목을 한 줄로 위에 두고 화면을 최대한 크게
    eyebrow(s, kicker + "  " + no);
    tx(s, ttl.replace(/\n/g, " "), {
      x: M, y: 1.14, w: CW, h: 0.72, fontFace: FH, fontSize: 30, bold: true, color: INK,
    });
    tx(s, line, { x: M, y: 1.94, w: CW, h: 0.38, fontSize: 13, color: MUTED });
    const TOP = 2.5, BOT = 6.3, MAXW = CW;
    const ar = img.w / img.h;
    let h = BOT - TOP, w = h * ar;
    if (w > MAXW) { w = MAXW; h = w / ar; }
    s.addImage({ path: img.path, x: M + (MAXW - w) / 2, y: TOP + (BOT - TOP - h) / 2, w, h });
  } else {
    // 캡처 전: 좌측 텍스트 + 우측 자리
    eyebrow(s, kicker);
    tx(s, no, { x: M, y: 1.5, w: 1.6, h: 0.42, fontFace: FH, fontSize: 20, bold: true, color: BRAND_PALE });
    tx(s, ttl, { x: M, y: 2.08, w: 4.6, h: 1.7, fontFace: FH, fontSize: 33, bold: true, color: INK, lineSpacingMultiple: 1.22 });
    tx(s, line, { x: M, y: 4.02, w: 4.5, h: 0.9, fontSize: 13.5, color: BODY, lineSpacingMultiple: 1.45 });
    s.addShape("roundRect", {
      x: 6.5, y: 1.35, w: 5.83, h: 4.8, rectRadius: 0.1,
      fill: { color: SLOT }, line: { color: SLOT, width: 0 },
    });
    tx(s, slotLabel, { x: 6.5, y: 1.35, w: 5.83, h: 4.8, align: "center", valign: "middle", fontSize: 11, color: FAINT });
  }
  return s;
}

function qa(n, q, a) {
  const s = slide(n % 2 ? PAPER : COOL, 5);
  eyebrow(s, `예상 질문 · ${String(n).padStart(2, "0")}`);
  tx(s, q, { x: M, y: 1.7, w: CW, h: 1.4, fontFace: FH, fontSize: 30, bold: true, color: INK, lineSpacingMultiple: 1.25 });
  rule(s, M, 3.35, CW, LINE);
  tx(s, a, { x: M, y: 3.72, w: CW - 1.4, h: 1.8, fontSize: 15, color: BODY, lineSpacingMultiple: 1.6 });
  return s;
}

/* =============== 표지 =============== */
let s = slide(PAPER);
s.addImage({ path: LOGO_LIGHT, x: M, y: 1.95, w: 3.3, h: 1.635 });
tx(s, "발표와 면접 연습 영상을 분석해\n맞춤형 피드백을 제공하는 AI 코칭 서비스", {
  x: M, y: 3.95, w: 9.2, h: 1.3, fontFace: FH, fontSize: 27, bold: true, color: INK, lineSpacingMultiple: 1.3,
});
tx(s, "혼자 하는 연습에, 확신을 더하다.", { x: M, y: 5.35, w: CW, h: 0.45, fontSize: 16, bold: true, color: BRAND });
rule(s, M, 6.1, CW, INK, 0.02);
tx(s, "SSAFY 공통 프로젝트   ·   대전 1반   ·   B109  Team 백구", { x: M, y: 6.32, w: 7.5, h: 0.3, fontSize: 11.5, color: MUTED });
tx(s, "박민규 · 서가은 · 윤성빈 · 윤재용 · 채승규 · 최현철", { x: 6.5, y: 6.32, w: 5.83, h: 0.3, align: "right", fontSize: 11.5, color: MUTED });
s.addNotes("[빌드업 쇼 · 1분]\n가짜 발표자가 인사. 필러(어…, 음…, 그…)를 남발하고 말속도를 빠르게, 공백을 길게.");

/* 목차 — 카드 없이 얇은 룰 + 번호 + 이름 */
s = slide(PAPER);
eyebrow(s, "CONTENT");
title(s, "발표 순서", { size: 34 });
const tw = (CW - 2 * 0.7) / 3;
SECTIONS.forEach((t, i) => {
  const c = i % 3, r = Math.floor(i / 3);
  const x = M + c * (tw + 0.7);
  const y = 3.0 + r * 1.6;
  rule(s, x, y, tw, i === 0 ? BRAND : LINE, 0.026);
  tx(s, String(i + 1).padStart(2, "0"), { x, y: y + 0.24, w: 1, h: 0.32, fontSize: 12, bold: true, color: BRAND });
  tx(s, t, { x, y: y + 0.66, w: tw, h: 0.5, fontFace: FH, fontSize: 22, bold: true, color: INK });
});
s.addNotes("[빌드업 쇼 클라이맥스]\n목차를 읽다 무너진다. \"어… 음…\" → 진짜 발표자가 마이크를 뺏는다. \"잠시만요.\"");

/* =============== 01 문제 정의 =============== */
sectionCover(0, "문제 정의", "혼자 하는 연습이 왜 어려운가");
statement("잠시만요.", { size: 76, bg: DARK, sec: 0 }).addNotes("연기를 끊고 정적 2초.");
statement("여러분은 방금 발표에서\n어떤 문제를 발견하셨나요?", { size: 44, sec: 0 }).addNotes("1초 정도 관객을 바라본다.");
statement("발표가 매끄럽지 않았다는 건\n누구나 느낄 수 있습니다.", { size: 46, bg: COOL, sec: 0 });

/* 지표 3개 — 카드 제거, 큰 숫자 + 얇은 룰만 */
s = slide(PAPER, 0);
eyebrow(s, "방금 발표 분석 결과");
title(s, "하지만 혼자서는 무엇이, 얼마나,\n언제 반복됐는지 알기 어렵습니다.", { size: 32, h: 1.3, ruleY: 2.66 });
const stats = [
  { v: "9", u: "회", l: "필러", d: "어 · 음 · 그" },
  { v: "4", u: "회", l: "1.5초 이상 공백", d: "말이 끊긴 구간" },
  { v: "3", u: "회", l: "시선 이탈", d: "청중을 벗어난 시선" },
];
const sw = (CW - 2 * 0.8) / 3;
stats.forEach((st, i) => {
  const x = M + i * (sw + 0.8);
  s.addText(
    [
      { text: st.v, options: { fontSize: 96, fontFace: FH, bold: true, color: INK } },
      { text: st.u, options: { fontSize: 26, fontFace: F, bold: true, color: MUTED } },
    ],
    { x, y: 3.25, w: sw, h: 1.55, align: "left", valign: "middle", margin: 0 }
  );
  rule(s, x, 5.0, 1.2, BRAND, 0.03);
  tx(s, st.l, { x, y: 5.24, w: sw, h: 0.4, fontFace: FH, fontSize: 18, bold: true, color: INK });
  tx(s, st.d, { x, y: 5.68, w: sw, h: 0.35, fontSize: 12, color: MUTED });
});
caption(s, "실제 연습 1회 분석 결과 예시 — 지표는 발화 구간 기준으로 집계합니다.", 6.5);

statement("나는 관대하다.\n스스로에게.", { size: 58, bg: COOL, sec: 0 });

s = slide(PAPER, 0);
eyebrow(s, "문제 정의");
tx(s, "대학생의 발표 자기평가 점수는\n대부분 교사의 평가보다 높았다.", {
  x: M, y: 2.15, w: CW, h: 2.0, valign: "middle", fontFace: FH, fontSize: 40, bold: true, color: INK, lineSpacingMultiple: 1.24,
});
rule(s, M, 4.5, 1.6, BRAND, 0.03);
tx(s, "De Grez, Valcke, & Roozen (2012)", { x: M, y: 4.78, w: CW, h: 0.35, fontSize: 14, bold: true, color: BRAND_DEEP });
tx(s, "Active Learning in Higher Education", { x: M, y: 5.14, w: CW, h: 0.35, fontSize: 12.5, color: MUTED, italic: true });

statement("혼자서는 스스로의 발표를\n객관적으로 보기 어렵습니다.", { size: 46, bg: DARK, sec: 0 });

/* 문제의 3겹 — 채운 바 제거, 행 헤어라인만 */
s = slide(PAPER, 0);
eyebrow(s, "문제의 구조");
title(s, "놓치는 것은 세 겹입니다", { size: 34 });
const layers = [
  { n: "말하기", d: "말속도 · 필러 · 공백", ex: "빠르게 말했는지, 어디서 멈췄는지", a: BRAND },
  { n: "태도", d: "시선 · 자세", ex: "청중을 보고 있었는지", a: LAV },
  { n: "내용", d: "핵심 내용 누락 · 설명 시간", ex: "무엇을 빠뜨렸는지", a: MUTED },
];
layers.forEach((l, i) => {
  const y = 2.85 + i * 1.15;
  rule(s, M, y, 1.15, l.a, 0.03);
  tx(s, l.n, { x: M, y: y + 0.24, w: 2.0, h: 0.5, fontFace: FH, fontSize: 24, bold: true, color: INK });
  tx(s, l.d, { x: M + 2.4, y: y + 0.32, w: 4.3, h: 0.4, fontFace: FH, fontSize: 15, bold: true, color: BODY });
  tx(s, l.ex, { x: M + 7.0, y: y + 0.34, w: 4.33, h: 0.4, fontSize: 13, color: MUTED });
  if (i < 2) rule(s, M, y + 0.95, CW, HAIR);
});
caption(s, "세 겹이 동시에 일어나기 때문에, 하나의 연습에서 함께 확인해야 합니다.", 6.45);

/* 기존 방식의 한계 — 카드 제거 */
s = slide(PAPER, 0);
eyebrow(s, "기존 방식의 한계");
title(s, "지금까지의 연습 방법", { size: 34 });
const prior = [
  { n: "거울 앞 연습", g: "즉시 확인", b: "기록이 남지 않는다" },
  { n: "스터디 피드백", g: "타인의 시선", b: "매번 사람을 모아야 한다" },
  { n: "기존 AI 면접", g: "자동 분석", b: "한 번 평가하고 끝난다" },
];
const pw = (CW - 2 * 0.8) / 3;
prior.forEach((p, i) => {
  const x = M + i * (pw + 0.8);
  colHead(s, x, 2.9, pw, p.n, { size: 21, ruleColor: LINE });
  tx(s, "○   " + p.g, { x, y: 3.72, w: pw, h: 0.4, fontSize: 13.5, color: BODY });
  tx(s, "✕   " + p.b, { x, y: 4.22, w: pw, h: 0.8, fontSize: 13.5, bold: true, color: NO, lineSpacingMultiple: 1.35 });
});
rule(s, M, 5.6, CW, LINE);
tx(s, "필요한 것은 — 매번 혼자서, 기록으로 남고, 다음 연습으로 이어지는 방법", {
  x: M, y: 5.88, w: CW, h: 0.5, align: "center", fontFace: FH, fontSize: 17, bold: true, color: BRAND_DEEP,
});

/* =============== 02 AIVO =============== */
sectionCover(1, "AIVO", "말하기 연습을 위한 AI 코치");
statement("그래서, 만들었습니다.", { size: 56, sec: 1 });

s = slide(BLACK, 1);
s.addImage({ path: LOGO_DARK, x: 2.17, y: 0.95, w: 9.0, h: 5.06 });
tx(s, "말하기 연습을 위한 AI 코치", {
  x: 0, y: 6.3, w: W, h: 0.5, align: "center", fontFace: FH, fontSize: 20, bold: true, color: BRAND_LIGHT,
});

statement("놓친 순간을 다시 보고,\n다음 연습을 바꿉니다.", {
  size: 46, sec: 1, sub: "발표와 면접을 분석해 개선이 필요한 순간을 찾고, 맞춤형 피드백을 제공합니다.",
});

/* 통합 분석 — 박스 제거, 텍스트 + 룰 + 화살표 */
s = slide(PAPER, 1);
eyebrow(s, "AIVO의 접근");
title(s, "세 가지를 한 번에 봅니다", { size: 34 });
const inputs = [["발표 자료", "PPTX 슬라이드"], ["음성", "발화 · 말하기 습관"], ["영상", "시선 · 자세"]];
inputs.forEach((it, i) => {
  const y = 3.0 + i * 1.05;
  rule(s, M, y, 2.5, LINE, 0.024);
  tx(s, it[0], { x: M, y: y + 0.2, w: 2.5, h: 0.38, fontFace: FH, fontSize: 18, bold: true, color: INK });
  tx(s, it[1], { x: M, y: y + 0.6, w: 2.5, h: 0.3, fontSize: 11.5, color: MUTED });
});
tx(s, "→", { x: 3.85, y: 3.95, w: 0.6, h: 0.5, align: "center", fontSize: 20, bold: true, color: BRAND });
tx(s, "AIVO", { x: 4.6, y: 3.55, w: 3.4, h: 0.9, align: "center", fontFace: FH, fontSize: 46, bold: true, color: BRAND });
tx(s, "통합 분석", { x: 4.6, y: 4.5, w: 3.4, h: 0.4, align: "center", fontFace: FH, fontSize: 15, bold: true, color: MUTED });
tx(s, "→", { x: 8.15, y: 3.95, w: 0.6, h: 0.5, align: "center", fontSize: 20, bold: true, color: BRAND });
["문제 구간과 근거", "슬라이드별 피드백", "이전 시도와 비교"].forEach((o, i) => {
  const y = 3.0 + i * 1.05;
  rule(s, 8.95, y, 3.38, BRAND, 0.024);
  tx(s, o, { x: 8.95, y: y + 0.22, w: 3.38, h: 0.4, fontFace: FH, fontSize: 16, bold: true, color: BRAND_DEEP });
});
caption(s, "말하기 방식만 보는 것이 아니라, 준비한 자료와 실제 발화를 함께 대조합니다.", 6.4);

/* 리허설 루프 — 카드 제거 */
s = slide(PAPER, 1);
eyebrow(s, "사용 흐름");
title(s, "한 번의 연습이 다음 연습을 만듭니다", { size: 34 });
const loop = [
  ["준비", "자료 업로드\n목표 시간 설정"],
  ["리허설", "녹화 중\n실시간 피드백"],
  ["리포트", "문제 구간 재생\n슬라이드별 분석"],
  ["다시 연습", "이전 시도와\n비교"],
];
const lw = (CW - 3 * 0.75) / 4;
loop.forEach((l, i) => {
  const x = M + i * (lw + 0.75);
  const last = i === 3;
  rule(s, x, 3.0, lw, last ? BRAND : LINE, 0.026);
  tx(s, String(i + 1).padStart(2, "0"), { x, y: 3.24, w: 1, h: 0.32, fontSize: 12, bold: true, color: BRAND });
  tx(s, l[0], { x, y: 3.66, w: lw, h: 0.5, fontFace: FH, fontSize: 23, bold: true, color: INK });
  tx(s, l[1], { x, y: 4.3, w: lw, h: 0.9, fontSize: 12.5, color: MUTED, lineSpacingMultiple: 1.35 });
  if (!last) tx(s, "→", { x: x + lw + 0.1, y: 3.62, w: 0.55, h: 0.45, align: "center", fontSize: 17, bold: true, color: BRAND });
});
tx(s, "↺   기록이 쌓일수록 비교할 수 있는 것이 늘어납니다", {
  x: M, y: 5.9, w: CW, h: 0.45, align: "center", fontFace: FH, fontSize: 15, bold: true, color: BRAND_DEEP,
});

/* 핵심 차별점 — 블록 제거, 2트랙을 룰로 */
s = slide(PAPER, 1);
eyebrow(s, "핵심 차별점");
title(s, "발표 자료와 실제 발화를\n슬라이드 단위로 연결합니다", { size: 32, h: 1.4, ruleY: 2.7 });
const gw = (CW - 2 * 0.5) / 3;
tx(s, "슬라이드 전환 시각", { x: M, y: 3.05, w: 3.2, h: 0.3, fontSize: 11.5, bold: true, charSpacing: 1, color: BRAND });
[["슬라이드 1", "0:00 – 1:12"], ["슬라이드 2", "1:12 – 2:40"], ["슬라이드 3", "2:40 – 3:55"]].forEach((g, i) => {
  const x = M + i * (gw + 0.5);
  rule(s, x, 3.42, gw, BRAND, 0.024);
  tx(s, g[0], { x, y: 3.6, w: gw, h: 0.3, fontFace: FH, fontSize: 15, bold: true, color: INK });
  tx(s, g[1], { x, y: 3.94, w: gw, h: 0.28, fontSize: 11, color: MUTED });
});
tx(s, "×", { x: M, y: 4.34, w: CW, h: 0.35, align: "center", fontFace: FH, fontSize: 20, bold: true, color: FAINT });
tx(s, "발화 타임스탬프 (STT)", { x: M, y: 4.78, w: 3.6, h: 0.3, fontSize: 11.5, bold: true, charSpacing: 1, color: LAV });
["\"저희 서비스는…\"", "\"핵심 기능은 세 가지로…\"", "\"마지막으로 성과는…\""].forEach((t, i) => {
  const x = M + i * (gw + 0.5);
  rule(s, x, 5.15, gw, LAV, 0.024);
  tx(s, t, { x, y: 5.33, w: gw, h: 0.4, fontSize: 12.5, italic: true, color: BODY });
});
rule(s, M, 5.95, CW, LINE);
tx(s, "= 어느 슬라이드에서 무슨 말을 했고, 무엇을 빠뜨렸는지", {
  x: M, y: 6.2, w: CW, h: 0.45, align: "center", fontFace: FH, fontSize: 17, bold: true, color: INK,
});

/* =============== 03 서비스 시연 =============== */
sectionCover(2, "서비스 시연", "발표 · 면접 리허설을 직접 보여드립니다");

s = slide(COOL, 2);
eyebrow(s, "실제 리포트 화면");
title(s, "문제 구간을 발화와 함께 다시 봅니다", { size: 30, rule: false });
s.addImage({ path: SCREEN, x: 1.35, y: 2.35, w: 10.63, h: 4.58 });
s.addNotes("실제 발표 리포트 화면 — 좌측 녹화 영상, 우측 슬라이드별 대본 복기.");

statement("발표 리허설", { size: 62, bg: DARK, sec: 2, align: "center", eyebrow: "시연 01", sub: "준비 → 실시간 분석 → 리포트" })
  .addNotes("[시연 · 발표] 약 3분");
statement("면접 리허설", { size: 62, bg: DARK, sec: 2, align: "center", eyebrow: "시연 02", sub: "질문 생성 → 답변 → 리포트" })
  .addNotes("[시연 · 면접] 약 3분");

/* =============== 04 기능 소개 =============== */
sectionCover(3, "기능 소개", "연습 중에 보이고, 끝나면 남습니다");

/* 기능 지도 — 패널·타일 제거, 3열 리스트 */
s = slide(PAPER, 3);
eyebrow(s, "기능 한눈에");
title(s, "12개 기능, 세 갈래", { size: 34 });
const groups = [
  { n: "발표", c: BRAND, items: ["실시간 자막", "말속도", "습관어", "시선 · 자세", "슬라이드별 리포트", "문제 구간 재생", "청중 예상 질문"] },
  { n: "면접", c: LAV, items: ["질문 자동 생성", "생각할 시간 5초", "질문별 리포트"] },
  { n: "아카이브", c: MUTED, items: ["시도마다 저장", "성장 추이"] },
];
const ggw = (CW - 2 * 0.8) / 3;
groups.forEach((g, gi) => {
  const x = M + gi * (ggw + 0.8);
  rule(s, x, 2.9, ggw, g.c, 0.03);
  tx(s, g.n, { x, y: 3.12, w: ggw, h: 0.4, fontFace: FH, fontSize: 19, bold: true, color: g.c === MUTED ? INK : g.c });
  g.items.forEach((it, i) => {
    const y = 3.62 + i * 0.4;
    tx(s, it, { x, y, w: ggw, h: 0.32, fontSize: 13.5, color: BODY });
    if (i < g.items.length - 1) rule(s, x, y + 0.33, ggw, HAIR);
  });
});
caption(s, "이어지는 슬라이드에서 기능을 하나씩 보여드립니다.", 6.4);

feature(3, "기능 · 발표", "01", "말한 그대로,\n즉시 글자로", "브라우저 음성 인식으로 발화가 바로 자막이 됩니다.", "실시간 자막 화면");
feature(3, "기능 · 발표", "02", "지금 빠른지,\n느린지", "말속도를 실시간으로 표시합니다.", "말속도 지표 화면", "c_speed");
feature(3, "기능 · 발표", "03", "\"어\", \"음\"이\n몇 번인지", "습관어를 발화 구간 기준으로 집계합니다.", "습관어 카운트 화면");
feature(3, "기능 · 발표", "04", "청중을\n보고 있는지", "카메라로 시선 이탈과 자세 흐트러짐을 감지합니다.", "시선 · 자세 감지 화면");
feature(3, "기능 · 발표", "05", "어느 장에서\n무슨 말을 했는지", "슬라이드별로 발화를 나눠 보여줍니다.", "슬라이드별 리포트 화면", "c_score");
feature(3, "기능 · 발표", "06", "그 순간부터\n다시 보기", "문제 구간을 클릭하면 녹화가 그 지점부터 재생됩니다.", "문제 구간 재생 화면");
feature(3, "기능 · 발표", "07", "발표가 끝나면\n질문이 옵니다", "발표 맥락을 바탕으로 청중 예상 질문을 만듭니다.", "예상 질문 화면");
feature(3, "기능 · 면접", "01", "질문은\n자동으로", "이력서 · 자기소개서 · 포트폴리오를 바탕으로 예상 질문을 생성합니다.", "면접 질문 생성 화면", "c_interviewer");
feature(3, "기능 · 면접", "02", "생각할 시간은\n5초", "실제 면접의 압박감까지 재현합니다.", "면접 녹화 화면");
feature(3, "기능 · 면접", "03", "질문별로\n다시 듣기", "답변을 질문 단위로 나눠 리포트에 남깁니다.", "면접 리포트 화면", "c_int_report");
feature(3, "기능 · 아카이브", "01", "연습이\n기록이 됩니다", "같은 폴더에 시도마다 결과가 쌓입니다.", "아카이브 목록 화면", "c_folder");

/* 아카이브 02 — 실제 서비스의 성장 추이 화면 캡처 사용 (수치를 만들지 않음) */
s = slide(PAPER, 3);
eyebrow(s, "기능 · 아카이브 02");
tx(s, "시도마다 점수가\n그대로 남습니다", { x: M, y: 1.75, w: 4.3, h: 2.0, fontFace: FH, fontSize: 34, bold: true, color: INK, lineSpacingMultiple: 1.22 });
tx(s, "생성된 리포트의 실제 점수만 이어서 보여주기 때문에,\n올랐는지 떨어졌는지를 그대로 확인할 수 있습니다.", {
  x: M, y: 3.95, w: 4.4, h: 1.0, fontSize: 13.5, color: BODY, lineSpacingMultiple: 1.45,
});
{
  const img = shot("c_trend");
  if (img) {
    const ar = img.w / img.h;
    const BX = 5.9, BY = 1.6, BW = 6.43, BH = 4.3;
    let w = BW, h = BW / ar;
    if (h > BH) { h = BH; w = BH * ar; }
    s.addImage({ path: img.path, x: BX + (BW - w) / 2, y: BY + (BH - h) / 2, w, h });
  }
}
s.addNotes("실제 서비스의 '내 성장 추이' 화면 캡처입니다 (aivotest1 계정, AIVO 최종 발표 준비 폴더 3회: 44 → 54 → 51점).");

/* =============== 05 사용 기술 =============== */
sectionCover(4, "사용 기술", "점수 뒤에는 기술이 있습니다");

/* 아키텍처 — 박스 제거, 노드는 룰 + 라벨 */
s = slide(PAPER, 4);
eyebrow(s, "시스템 아키텍처");
title(s, "요청은 빠르게, 분석은 비동기로", { size: 32 });
const nodes = [
  { t: "프론트엔드", d: "업로드 · 녹화\n실시간 분석", key: false },
  { t: "Spring Boot", d: "세션 · 파일\n결과 관리", key: true },
  { t: "RabbitMQ", d: "분석 작업\n비동기 전달", key: false },
  { t: "FastAPI", d: "STT · AI 분석\n수행", key: true },
];
const nw = (CW - 3 * 0.62) / 4;
nodes.forEach((n, i) => {
  const x = M + i * (nw + 0.62);
  rule(s, x, 2.95, nw, n.key ? BRAND : LINE, 0.028);
  tx(s, n.t, { x, y: 3.16, w: nw, h: 0.38, fontFace: FH, fontSize: 17, bold: true, color: n.key ? BRAND_DEEP : INK });
  tx(s, n.d, { x, y: 3.6, w: nw, h: 0.7, fontSize: 11.5, color: MUTED, lineSpacingMultiple: 1.3 });
  if (i < 3) tx(s, "→", { x: x + nw + 0.04, y: 3.12, w: 0.55, h: 0.42, align: "center", fontSize: 17, bold: true, color: BRAND });
});
rule(s, M, 4.7, CW, HAIR);
tx(s, "저장", { x: M, y: 4.92, w: 1.5, h: 0.28, fontSize: 11, bold: true, charSpacing: 1.4, color: BRAND });
[["S3", "발표 자료 · 녹화 파일"], ["PostgreSQL", "최종 분석 결과"]].forEach((n, i) => {
  const x = M + i * (CW / 2 + 0.3);
  const wid = CW / 2 - 0.3;
  tx(s, n[0], { x, y: 5.3, w: wid, h: 0.38, fontFace: FH, fontSize: 17, bold: true, color: INK });
  tx(s, n[1], { x, y: 5.72, w: wid, h: 0.3, fontSize: 11.5, color: MUTED });
});
caption(s, "오래 걸리는 STT · AI 분석을 큐로 분리해, 사용자 요청은 기다리지 않고 응답합니다.", 6.4);

/* 동기 vs 비동기 — 카드 제거, 세로 헤어라인으로 분리 */
s = slide(PAPER, 4);
eyebrow(s, "설계 판단");
title(s, "분석을 기다리게 하지 않기", { size: 34 });
const half = (CW - 0.9) / 2;
const ba = [
  { t: "동기 처리라면", items: ["업로드 후 분석이 끝날 때까지 대기", "긴 요청이 서버 자원을 점유", "실패하면 처음부터 다시"], c: NO, mark: "✕", rc: NO },
  { t: "비동기 (RabbitMQ)", items: ["업로드 즉시 응답, 분석은 백그라운드", "분석 서버를 따로 확장 가능", "실패한 작업만 재처리"], c: OK, mark: "○", rc: OK },
];
ba.forEach((b, i) => {
  const x = M + i * (half + 0.9);
  rule(s, x, 2.95, half, b.rc, 0.028);
  tx(s, b.t, { x, y: 3.18, w: half, h: 0.45, fontFace: FH, fontSize: 20, bold: true, color: INK });
  b.items.forEach((it, j) => {
    tx(s, b.mark + "   " + it, { x, y: 3.86 + j * 0.66, w: half, h: 0.6, fontSize: 13.5, color: BODY, lineSpacingMultiple: 1.3 });
  });
});
vrule(s, M + half + 0.44, 2.95, 2.9, HAIR);
caption(s, "분석 결과가 준비되면 Spring Boot가 받아 저장하고, 사용자는 완료된 리포트를 확인합니다.", 6.15);

/* AI 파이프라인 */
s = slide(PAPER, 4);
eyebrow(s, "AI 분석 파이프라인");
title(s, "발표 자료와 발화가 만나는 순서", { size: 32 });
const steps = [
  ["01", "발표 자료를 슬라이드 단위로 분리"],
  ["02", "슬라이드 텍스트 · 이미지를 멀티모달 모델로 분석해 핵심 내용 추출"],
  ["03", "녹화 음성을 STT로 변환 — 발화 내용과 문장별 시작 · 종료 시간 생성"],
  ["04", "시간 정보와 슬라이드 전환 기록을 연결해 슬라이드별 실제 발화 구분"],
  ["05", "슬라이드 핵심 내용과 실제 발화를 비교 — 누락 · 반복 표현 · 발표 속도 분석"],
  ["06", "영상의 시선 · 자세 정보를 결합해 최종 피드백 생성"],
];
steps.forEach((st, i) => {
  const y = 2.68 + i * 0.6;
  tx(s, st[0], { x: M, y, w: 0.62, h: 0.4, valign: "middle", fontFace: FH, fontSize: 14, bold: true, color: BRAND });
  tx(s, st[1], { x: M + 0.8, y, w: CW - 0.8, h: 0.4, valign: "middle", fontSize: 14, color: BODY });
  if (i < steps.length - 1) rule(s, M, y + 0.48, CW, HAIR);
});

/* 기술 스택 — 타일 제거 */
s = slide(PAPER, 4);
eyebrow(s, "기술 스택");
title(s, "사용 기술", { size: 34 });
const stacks = [
  ["Frontend", ["Vue 3", "Pinia · Vite", "Vitest"]],
  ["Backend", ["Spring Boot", "PostgreSQL", "RabbitMQ"]],
  ["AI", ["FastAPI", "STT 모델", "멀티모달 LLM"]],
  ["Infra", ["AWS S3", "Docker · Nginx", "모니터링"]],
];
const stw = (CW - 3 * 0.7) / 4;
stacks.forEach((st, i) => {
  const x = M + i * (stw + 0.7);
  rule(s, x, 2.95, stw, BRAND, 0.028);
  tx(s, st[0], { x, y: 3.16, w: stw, h: 0.38, fontFace: FH, fontSize: 17, bold: true, color: BRAND_DEEP });
  st[1].forEach((it, j) => {
    const y = 3.72 + j * 0.52;
    tx(s, it, { x, y, w: stw, h: 0.36, fontSize: 14, color: BODY });
    if (j < st[1].length - 1) rule(s, x, y + 0.38, stw, HAIR);
  });
});
caption(s, "실시간 피드백은 브라우저에서, 저장 · 분석 · 모니터링은 서버에서 역할을 나눠 맡습니다.", 5.85);

/* 모델 성능 — 점선 프레임 제거 */
s = slide(PAPER, 4);
eyebrow(s, "모델 성능 개선");
title(s, "시도를 거듭할수록 정교해진 탐지", { size: 32 });
tx(s, "시도별 필러 · 침묵 탐지 성능 변화 그래프를 넣어 주세요 (실측값)", {
  x: M, y: 4.0, w: CW, h: 0.5, align: "center", fontSize: 13, color: FAINT,
});
s.addNotes("⚠ 실측값이 없어 비워 두었습니다. 시도별 정확도를 측정해 채워 주세요.");

/* =============== 06 의의 · 향후 =============== */
sectionCover(5, "의의 · 향후 계획", "평가가 아닌, 개선을 위한 서비스");

/* 팀 — 카드 제거 */
s = slide(PAPER, 5);
eyebrow(s, "팀 소개");
title(s, "Team 백구", { size: 38 });
const team = ["박민규", "서가은", "윤성빈", "윤재용", "채승규", "최현철"];
const mw = (CW - 5 * 0.42) / 6;
team.forEach((n, i) => {
  const x = M + i * (mw + 0.42);
  rule(s, x, 3.3, mw, BRAND, 0.028);
  tx(s, n, { x, y: 3.54, w: mw, h: 0.5, fontFace: FH, fontSize: 21, bold: true, color: INK });
});
tx(s, "SSAFY 공통 프로젝트  ·  대전 1반  ·  B109", {
  x: M, y: 5.2, w: CW, h: 0.4, align: "center", fontSize: 13, color: MUTED,
});
s.addNotes("역할 표기가 필요하면 각 이름 아래에 한 줄씩 추가하세요.");

statement("평가가 아닌,\n개선을 위한 서비스", { size: 50, sec: 5, eyebrow: "서비스 의의" })
  .addNotes("\"AIVO의 목적은 발표를 점수화하는 것이 아닙니다. 놓친 문제를 근거와 함께 보여주고, 다음 연습에서 실제로 개선하도록 돕는 것이 핵심입니다.\"");

[
  { n: "01", t: "반복 연습 전후 비교", d: "같은 폴더의 시도끼리 변화를 이어서 비교" },
  { n: "02", t: "사용자별 기준 개인화", d: "사람마다 다른 말하기 습관을 기준값에 반영" },
  { n: "03", t: "분석 데이터 기반 성능 개선", d: "축적된 분석 데이터로 탐지 모델을 고도화" },
].forEach((p) => {
  const sl = slide(COOL, 5);
  eyebrow(sl, "향후 계획");
  tx(sl, p.n, { x: M, y: 2.1, w: CW, h: 1.0, valign: "middle", fontFace: FH, fontSize: 54, bold: true, color: BRAND_PALE });
  tx(sl, p.t, { x: M, y: 3.25, w: CW, h: 0.95, valign: "middle", fontFace: FH, fontSize: 42, bold: true, color: INK });
  tx(sl, p.d, { x: M, y: 4.45, w: CW, h: 0.45, fontSize: 15, color: BODY });
});

/* 사용 시나리오 — 카드 제거 */
s = slide(PAPER, 5);
eyebrow(s, "다음 무대");
title(s, "말하기를 반복해야 하는 모든 순간", { size: 34 });
const scenes = [["학교", "발표 수업 · 말하기 평가"], ["부트캠프", "프로젝트 발표 · 취업 대비"], ["기업", "사내 발표 · 세일즈 피칭"]];
const scw = (CW - 2 * 0.8) / 3;
scenes.forEach((sc, i) => {
  const x = M + i * (scw + 0.8);
  rule(s, x, 3.0, scw, i === 1 ? BRAND : LINE, 0.028);
  tx(s, String(i + 1).padStart(2, "0"), { x, y: 3.24, w: 1, h: 0.32, fontSize: 12, bold: true, color: BRAND });
  tx(s, sc[0], { x, y: 3.68, w: scw, h: 0.55, fontFace: FH, fontSize: 26, bold: true, color: INK });
  tx(s, sc[1], { x, y: 4.42, w: scw, h: 0.6, fontSize: 13, color: MUTED, lineSpacingMultiple: 1.35 });
});
caption(s, "개인의 리허설에서, 조직의 말하기 인프라로 확장할 수 있습니다.", 5.85);

/* 마무리 */
s = slide(BLACK, 5);
tx(s, "말하기의 순간을\n성장의 데이터로.", {
  x: M, y: 2.0, w: CW, h: 2.4, valign: "middle", align: "center",
  fontFace: FH, fontSize: 54, bold: true, color: PAPER, lineSpacingMultiple: 1.22,
});
tx(s, "혼자 하는 연습에, 확신을 더하다.", {
  x: M, y: 4.62, w: CW, h: 0.5, align: "center", fontSize: 17, bold: true, color: BRAND_LIGHT,
});
s.addImage({ path: LOGO_DARK, x: W / 2 - 1.7, y: 5.25, w: 3.4, h: 1.91 });

/* =============== 예상 질문 =============== */
statement("예상 질문", { size: 56, bg: COOL, sec: 5, align: "center" });
qa(1, "음성 인식 정확도는 충분한가요?", "실시간 자막은 브라우저 STT를 사용합니다. 인식되지 않은 구간에서 필러 값을 임의로 만들지 않습니다.");
qa(2, "녹화 영상의 프라이버시는 어떻게 지키나요?", "시선 · 자세 분석은 브라우저 안에서 처리하고, 녹화 원본은 사용자가 저장을 선택한 경우에만 서버로 갑니다.");
qa(3, "기존 AI 면접 서비스와 무엇이 다른가요?", "한 번 평가하고 끝나지 않습니다. 준비 → 문제 구간 재생 → 이전 시도 비교로 이어지는 반복 리허설 루프입니다.");
qa(4, "LLM 평가는 믿을 수 있나요?", "결과를 항상 실제 발화와 함께 보여 근거를 확인할 수 있게 했습니다.");
qa(5, "설치가 필요한가요?", "브라우저만 있으면 됩니다. 설치도, 예약도 필요 없습니다.");

pres.writeFile({ fileName: "AIVO_발표_Pitch.pptx" }).then(() => console.log("built:", page, "slides"));
