// AIVO 테스트용 발표 PPT — 사용자가 준 6장 핵심 내용 기반
// 팔레트/폰트는 웹 UI 기준(흰 배경 · 잉크 #11131B · 블루 #5276DF · Noto Sans KR)
const pptxgen = require("pptxgenjs");

const PAPER = "FFFFFF";
const COOL = "F6F8FE";
const INK = "11131B";
const MUTED = "747987";
const FAINT = "A9ADB8";
const LINE = "DCDDE0";
const LINE_COOL = "D8DFEC";
const BLUE = "5276DF";
const BLUE_DEEP = "263F9C";
const BLUE_PALE = "E6EBFB";
const SOFT = "F4F5FA";

const F = "Noto Sans KR";
const FH = "Noto Sans KR Black";

const W = 13.333, H = 7.5;
const M = 0.95;
const CW = W - M * 2;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Team AIVO";
pres.title = "AIVO 서비스 소개 (테스트용)";

let page = 0;
function slide(bg) {
  const s = pres.addSlide();
  s.background = { color: bg || PAPER };
  page += 1;
  s.addText(String(page), {
    x: W - 1.05, y: H - 0.6, w: 0.5, h: 0.22, align: "right", margin: 0,
    fontFace: F, fontSize: 9, color: FAINT,
  });
  return s;
}

function head(s, label, title) {
  s.addText(label, {
    x: M, y: 0.7, w: CW, h: 0.28, align: "left", valign: "top", margin: 0,
    fontFace: F, fontSize: 10, bold: true, charSpacing: 1.5, color: BLUE,
  });
  s.addText(title, {
    x: M, y: 1.12, w: CW, h: 0.78, align: "left", valign: "top", margin: 0,
    fontFace: FH, fontSize: 34, bold: true, color: INK,
  });
  s.addShape("rect", {
    x: M, y: 2.12, w: CW, h: 0.016, fill: { color: LINE }, line: { color: LINE, width: 0 },
  });
}

// 불릿 목록
function bullets(s, items, opts) {
  const o = opts || {};
  s.addText(
    items.map((t, i) => ({
      text: t,
      options: { bullet: { indent: 18 }, breakLine: i !== items.length - 1 },
    })),
    {
      x: o.x || M, y: o.y || 2.6, w: o.w || CW, h: o.h || 3.4,
      align: "left", valign: "top", margin: 0,
      fontFace: F, fontSize: o.size || 16, color: o.color || "2E313D",
      lineSpacingMultiple: 1.5, paraSpaceAfter: o.gap === undefined ? 10 : o.gap,
    }
  );
}

/* ===== 1. AIVO 서비스 소개 ===== */
let s = slide(PAPER);
head(s, "슬라이드 1", "AIVO 서비스 소개");
bullets(s, [
  "발표 자료와 사용자의 음성·영상을 함께 분석하는 AI 기반 발표·면접 연습 서비스",
  "사용자가 혼자서도 반복적으로 연습할 수 있도록 설계",
  "발표 내용, 발화 습관, 발표 태도를 분석하고 구체적인 개선 피드백 제공",
  "발표와 면접 준비에 필요한 기능을 하나의 서비스에서 지원",
]);
s.addNotes("AIVO는 발표 자료와 음성·영상을 함께 분석하는 AI 발표·면접 연습 서비스입니다. 혼자서도 반복 연습할 수 있도록 발표 내용, 발화 습관, 발표 태도를 분석해 구체적인 개선 피드백을 제공합니다.");

/* ===== 2. 문제 상황과 서비스 목표 ===== */
s = slide(PAPER);
head(s, "슬라이드 2", "문제 상황과 서비스 목표");
bullets(s, [
  "발표와 면접은 자신의 모습을 객관적으로 확인하기 어려워 혼자 연습하기가 쉽지 않음",
  "말하는 속도, 반복 표현, 핵심 내용 누락은 발표자가 스스로 판단하기 어려움",
  "면접에서는 답변 내용뿐 아니라 시선·자세 같은 비언어적 요소도 함께 확인해야 함",
  "음성·영상·발표 자료를 하나의 연습 과정에서 통합적으로 분석하여 해결",
], { y: 2.6, h: 3.3 });
s.addNotes("자신의 모습을 객관적으로 보기 어렵다는 점이 핵심 문제입니다. AIVO는 음성, 영상, 발표 자료를 한 번의 연습 과정에서 통합 분석해 이 문제를 해결합니다.");

/* ===== 3. 주요 기능과 사용자 흐름 ===== */
s = slide(PAPER);
head(s, "슬라이드 3", "주요 기능과 사용자 흐름");
const colW = (CW - 0.6) / 2;
// 발표 연습
s.addShape("roundRect", {
  x: M, y: 2.55, w: colW, h: 3.5, rectRadius: 0.18,
  fill: { color: SOFT }, line: { color: LINE_COOL, width: 1 },
});
s.addText("발표 연습", {
  x: M + 0.35, y: 2.85, w: colW - 0.7, h: 0.4, align: "left", valign: "top", margin: 0,
  fontFace: FH, fontSize: 18, bold: true, color: BLUE_DEEP,
});
bullets(s, [
  "PPTX 업로드 → 슬라이드별 핵심 내용 분석",
  "녹화된 음성·영상으로 발화 내용과 발표 태도 평가",
  "STT 결과와 슬라이드 내용을 비교",
  "핵심 내용 누락, 반복 표현, 발화 속도, 슬라이드별 설명 시간 분석",
], { x: M + 0.35, y: 3.4, w: colW - 0.7, h: 2.5, size: 13, gap: 8 });
// 면접 연습
s.addShape("roundRect", {
  x: M + colW + 0.6, y: 2.55, w: colW, h: 3.5, rectRadius: 0.18,
  fill: { color: SOFT }, line: { color: LINE_COOL, width: 1 },
});
s.addText("면접 연습", {
  x: M + colW + 0.95, y: 2.85, w: colW - 0.7, h: 0.4, align: "left", valign: "top", margin: 0,
  fontFace: FH, fontSize: 18, bold: true, color: BLUE_DEEP,
});
bullets(s, [
  "이력서·자기소개서·포트폴리오 등 사용자 문서 기반으로 예상 질문 생성",
  "사용자의 답변 내용과 태도를 분석",
  "질문별 피드백 제공",
], { x: M + colW + 0.95, y: 3.4, w: colW - 0.7, h: 2.5, size: 13, gap: 8 });
s.addNotes("발표 연습은 PPTX 업로드부터 슬라이드별 발화 비교까지, 면접 연습은 사용자 문서 기반 질문 생성부터 질문별 피드백까지 이어집니다.");

/* ===== 4. 시스템 아키텍처 ===== */
s = slide(PAPER);
head(s, "슬라이드 4", "시스템 아키텍처");
function box(x, y, w, h, title, sub, accent) {
  s.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.14,
    fill: { color: accent ? BLUE_PALE : SOFT },
    line: { color: accent ? BLUE_PALE : LINE_COOL, width: 1 },
  });
  s.addText(title, {
    x: x + 0.1, y: y + 0.22, w: w - 0.2, h: 0.32, align: "center", valign: "top", margin: 0,
    fontFace: FH, fontSize: 13, bold: true, color: accent ? BLUE_DEEP : INK,
  });
  s.addText(sub, {
    x: x + 0.1, y: y + 0.6, w: w - 0.2, h: 0.5, align: "center", valign: "top", margin: 0,
    fontFace: F, fontSize: 10, color: MUTED, lineSpacingMultiple: 1.25,
  });
}
function arrow(x, y) {
  s.addText("→", {
    x, y, w: 0.45, h: 0.4, align: "center", valign: "middle", margin: 0,
    fontFace: F, fontSize: 16, bold: true, color: BLUE,
  });
}
// 처리 흐름 (상단)
const bw = 2.6, by = 2.75, bh = 1.35;
box(M, by, bw, bh, "프론트엔드", "발표 자료 업로드\n음성 · 영상 녹화");
arrow(M + bw + 0.02, by + 0.48);
box(M + bw + 0.5, by, bw, bh, "Spring Boot", "사용자 · 세션 · 파일\n분석 결과 관리", true);
arrow(M + 2 * bw + 0.52, by + 0.48);
box(M + 2 * (bw + 0.5), by, bw, bh, "RabbitMQ", "STT · AI 분석 작업\n비동기 전달");
arrow(M + 3 * bw + 1.02, by + 0.48);
box(M + 3 * (bw + 0.5), by, bw, bh, "FastAPI", "STT · AI 분석 수행\n결과 반환", true);
// 저장소 (하단)
s.addText("저장", {
  x: M, y: 4.5, w: 1.2, h: 0.28, align: "left", valign: "top", margin: 0,
  fontFace: F, fontSize: 10, bold: true, charSpacing: 1, color: BLUE,
});
box(M, 4.85, 5.35, 1.1, "S3", "업로드된 발표 자료 · 녹화 파일 저장");
box(M + 5.85, 4.85, 5.35, 1.1, "PostgreSQL", "최종 분석 결과 저장");
s.addNotes("프론트엔드에서 업로드·녹화, Spring Boot가 서비스 데이터를 관리합니다. 오래 걸리는 STT·AI 분석은 RabbitMQ로 FastAPI에 비동기 전달되고, 완료된 결과는 Spring Boot를 거쳐 PostgreSQL에 저장됩니다. 파일은 S3에 보관합니다.");

/* ===== 5. AI 분석 처리 과정 ===== */
s = slide(PAPER);
head(s, "슬라이드 5", "AI 분석 처리 과정");
const steps = [
  ["01", "발표 자료를 슬라이드 단위로 분리"],
  ["02", "슬라이드 텍스트·이미지를 멀티모달 모델로 분석해 핵심 내용 추출"],
  ["03", "녹화 음성을 STT로 변환 — 전체 발화 내용과 문장별 시작·종료 시간 생성"],
  ["04", "시간 정보와 슬라이드 전환 기록을 연결해 슬라이드별 실제 발화 구분"],
  ["05", "슬라이드 핵심 내용과 실제 발화를 비교 — 누락·오설명·반복 표현·발표 속도 분석"],
  ["06", "영상의 시선·자세 정보까지 결합해 최종 피드백 생성"],
];
steps.forEach((st, i) => {
  const y = 2.5 + i * 0.62;
  s.addText(st[0], {
    x: M, y, w: 0.6, h: 0.42, align: "left", valign: "middle", margin: 0,
    fontFace: FH, fontSize: 15, bold: true, color: BLUE,
  });
  s.addText(st[1], {
    x: M + 0.75, y, w: CW - 0.75, h: 0.42, align: "left", valign: "middle", margin: 0,
    fontFace: F, fontSize: 14.5, color: "2E313D",
  });
  if (i < steps.length - 1) {
    s.addShape("rect", {
      x: M, y: y + 0.5, w: CW, h: 0.012,
      fill: { color: "EDEEF4" }, line: { color: "EDEEF4", width: 0 },
    });
  }
});
s.addNotes("슬라이드 분리 → 멀티모달 핵심 내용 추출 → STT 변환 → 슬라이드별 발화 구분 → 핵심 내용 대조 → 시선·자세 결합의 순서로 분석이 진행됩니다.");

/* ===== 6. 차별점과 기대 효과 ===== */
s = slide(PAPER);
head(s, "슬라이드 6", "차별점과 기대 효과");
s.addShape("roundRect", {
  x: M, y: 2.5, w: CW, h: 1.15, rectRadius: 0.16,
  fill: { color: BLUE_PALE }, line: { color: BLUE_PALE, width: 0 },
});
s.addText("준비한 발표 자료와 실제 발화 내용을 슬라이드 단위로 연결하여 평가합니다", {
  x: M + 0.4, y: 2.5, w: CW - 0.8, h: 1.15, align: "left", valign: "middle", margin: 0,
  fontFace: FH, fontSize: 19, bold: true, color: BLUE_DEEP,
});
bullets(s, [
  "말하기 방식만 분석하는 것이 아니라, 발표 자료와 발화를 슬라이드 단위로 대조",
  "어떤 슬라이드의 설명이 부족했고 어떤 핵심 내용을 빠뜨렸는지 구체적으로 제시",
  "음성 · 영상 · 문서를 통합적으로 분석",
  "반복 연습 결과를 누적해 이전 연습보다 개선된 부분을 확인",
], { y: 4.0, h: 2.1 });
s.addNotes("가장 큰 차별점은 말하기 방식만 보지 않고 발표 자료와 실제 발화를 슬라이드 단위로 연결해 평가한다는 점입니다. 반복 연습 결과를 누적해 개선 추이도 확인할 수 있습니다.");

pres.writeFile({ fileName: "AIVO_서비스소개_테스트용.pptx" }).then(() => console.log("built:", page, "slides"));
