// AIVO 13분 통합발표 — 팀원 초안(AIVO_13분_통합발표_초안.pptx)의 디자인 시스템을 그대로 이어서 확장
// 디자인 상수는 초안 슬라이드의 실제 좌표/색/크기에서 추출함
const pptxgen = require("pptxgenjs");

// ---------- 초안에서 추출한 팔레트 ----------
const INK = "14142F";        // 본문 잉크 / 다크 배경
const PURPLE = "6657E8";     // 액센트
const MUTED = "76738B";      // 보조 텍스트
const BG_WHITE = "FFFFFF";
const BG_TINT = "F7F7FB";
const BG_DARK = "14142F";
const ON_DARK_KICKER = "C6C1FF";
const ON_DARK_SUB = "AAA6C7";
const ON_DARK_PAGE = "BAB6D6";
const RULE_DARK = "6B63A8";
const RULE_LIGHT = "D9D7E6";
const RULE_FAINT = "DDDCE6";
const RULE_CONTENTS = "B8B5C7";
const NUM_GRAY = "465064";
const SLOT_FILL = "F1F0F7";
const BODY = "3A3750";

const FONT = "Pretendard";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 — 초안과 동일
const W = 13.333;

// ---------- 초안의 반복 레이아웃 ----------
const M = 0.88;          // 좌우 여백
const CW = 11.56;        // 본문 폭
let pageNo = 0;

function slide(bgColor) {
  const s = pres.addSlide();
  s.background = { color: bgColor };
  pageNo += 1;
  const dark = bgColor === BG_DARK;
  s.addText(String(pageNo).padStart(2, "0"), {
    x: 12.19, y: 6.98, w: 0.5, h: 0.19, align: "right", margin: 0,
    fontFace: FONT, fontSize: 7.5, color: dark ? ON_DARK_PAGE : MUTED,
  });
  s._isDark = dark;
  return s;
}

// 좌상단 섹션 라벨
function kicker(s, text) {
  s.addText(text, {
    x: M, y: 0.75, w: 5.21, h: 0.25, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 9, bold: true,
    color: s._isDark ? ON_DARK_KICKER : PURPLE,
  });
}

// 헤어라인 — 초안의 시그니처 모티프
function rule(s, x, y, w, color, h) {
  s.addShape("rect", {
    x, y, w, h: h || 0.02, fill: { color }, line: { color, width: 0 },
  });
}

// 콘텐츠 슬라이드 제목 + 전폭 헤어라인
function sectionTitle(s, text, opts) {
  const o = opts || {};
  s.addText(text, {
    x: M, y: o.y || 1.5, w: CW, h: 0.54, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: o.size || 22.5, bold: true, color: INK,
  });
  rule(s, M, o.ruleY || 2.31, CW, RULE_FAINT);
}

// 다크 전환 슬라이드
function statementSlide(kickerText, title, sub) {
  const s = slide(BG_DARK);
  if (kickerText) kicker(s, kickerText);
  s.addText(title, {
    x: M, y: 2.71, w: CW, h: 0.65, align: "center", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 28.5, bold: true, color: "FFFFFF",
  });
  if (sub) {
    s.addText(sub, {
      x: M, y: 3.54, w: CW, h: 0.29, align: "center", valign: "top", margin: 0,
      fontFace: FONT, fontSize: 12, color: ON_DARK_KICKER,
    });
  }
  rule(s, 5.88, 4.5, 1.58, PURPLE, 0.03);
  return s;
}

// 번호/라벨 + 헤어라인 + 제목 (초안 '의의 및 향후 계획' 패턴)
function labeledColumn(s, x, y, label, title, desc, opts) {
  const o = opts || {};
  const colW = o.w || 3.13;
  s.addText(label, {
    x, y, w: 0.95, h: 0.29, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 13.5, bold: true, color: o.labelColor || PURPLE,
  });
  rule(s, x, y + 0.43, o.ruleW || 2.92, o.ruleColor || PURPLE);
  s.addText(title, {
    x, y: y + 0.66, w: colW, h: 0.29, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 12, bold: true, color: INK,
  });
  if (desc) {
    s.addText(desc, {
      x, y: y + 1.02, w: colW, h: 0.9, align: "left", valign: "top", margin: 0,
      fontFace: FONT, fontSize: 10.5, color: MUTED, lineSpacingMultiple: 1.35,
    });
  }
}

// ============================================================
// 01 — 타이틀 (빌드업 쇼: 가짜 발표자 인사)
// ============================================================
let s = slide(BG_WHITE);
s.addText("AIVO", {
  x: M, y: 1.85, w: CW, h: 0.77, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 45, bold: true, color: INK,
});
s.addText("AI 발표·면접 코치", {
  x: M, y: 2.83, w: CW, h: 0.35, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 16.5, bold: true, color: PURPLE,
});
s.addText("혼자 하는 연습에, 확신을 더하다", {
  x: M, y: 3.6, w: CW, h: 0.58, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 28.5, bold: true, color: INK,
});
s.addText("발표 연습 · 면접 연습 · 리포트", {
  x: M, y: 4.65, w: CW, h: 0.29, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 12, color: MUTED,
});
rule(s, 5.0, 5.31, 3.33, PURPLE, 0.03);
rule(s, M, 6.15, 11.54, PURPLE, 0.03);
s.addText("SSAFY 자율 프로젝트", {
  x: M, y: 6.42, w: 2.5, h: 0.21, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 8.25, color: MUTED,
});
s.addNotes(
  "[빌드업 쇼 시작 · 1분]\n" +
  "가짜 발표자가 등단해 인사. 의도적으로 필러(어…, 음…, 그…)를 남발하고, 말속도를 빠르게, 중간중간 공백을 길게 둔다.\n" +
  "관객은 아직 연출임을 모르는 상태."
);

// ============================================================
// 02 — CONTENTS (빌드업 쇼: 가짜 발표자가 목차를 읽다 무너짐)
// ============================================================
s = slide(BG_WHITE);
s.addText("CONTENTS", {
  x: M, y: 1.15, w: 3.13, h: 0.44, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 19.5, bold: true, color: INK,
});
const contents = [
  { n: "01.", t: "문제 정의" },
  { n: "02.", t: "AIVO" },
  { n: "03.", t: "서비스 시연" },
  { n: "04.", t: "기능 · 기술" },
  { n: "05.", t: "의의 · 향후 계획" },
];
contents.forEach((c, i) => {
  const x = 0.88 + i * 2.3325;
  s.addText(c.n, {
    x, y: 2.21, w: 1.46, h: 0.31, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 13.5, bold: true, color: NUM_GRAY,
  });
  rule(s, x, 2.66, 1.56, RULE_CONTENTS);
  s.addText(c.t, {
    x, y: 2.85, w: 1.93, h: 0.35, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 12, bold: true, color: INK,
  });
});
s.addNotes(
  "[빌드업 쇼 클라이맥스]\n" +
  "가짜 발표자가 목차를 읽다가 무너지는 지점. \"어… 음…\" 하며 공백이 길어진다.\n" +
  "→ 진짜 발표자가 난입해 마이크를 뺏는다. (마이크 2개면 난입, 1개면 뺏기)\n" +
  "진짜 발표자: \"잠시만요.\""
);

// ============================================================
// 03 — 방금 발표 분석 (문제 정의)
// ============================================================
s = slide(BG_TINT);
kicker(s, "방금 발표 분석");
s.addText("문제는 느껴져도, 정확히 남지 않습니다", {
  x: M, y: 1.52, w: CW, h: 0.75, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 30, bold: true, color: PURPLE,
});
rule(s, 1.52, 3.0, 10.29, RULE_LIGHT);
const stats = [
  { x: 1.6, v: "7회", l: "필러" },
  { x: 5.31, v: "2회", l: "1.5초 이상 공백" },
  { x: 9.02, v: "3회", l: "시선 이탈" },
];
stats.forEach((st) => {
  s.addText(st.v, {
    x: st.x, y: 3.65, w: 2.71, h: 0.65, align: "center", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 25.5, bold: true, color: INK,
  });
  s.addText(st.l, {
    x: st.x, y: 4.4, w: 2.71, h: 0.29, align: "center", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 11.25, color: MUTED,
  });
});
s.addText("문제가 생긴 순간까지 확인합니다.", {
  x: M, y: 5.26, w: CW, h: 0.29, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 12, color: MUTED,
});
s.addNotes(
  "[문제 정의 · 관객 소통 ver.]\n" +
  "\"여러분은 방금 발표에서 어떤 문제를 발견하셨나요?\" — 1초 정도 관객을 바라본다.\n" +
  "\"긴장했다는 것은 쉽게 알 수 있습니다.\"\n" +
  "→ 클릭마다 지표를 하나씩 공개 (필러 7회 → 공백 2회 → 시선 이탈 3회).\n" +
  "\"하지만 정확히 몇 번 발생했고, 어느 순간에 문제가 있었는지까지 기억하기는 어렵습니다.\""
);

// ============================================================
// 04 — 자기평가의 한계
// ============================================================
s = slide(BG_DARK);
kicker(s, "자기평가의 한계");
s.addText("대학생의 발표 자기평가 점수는\n대부분 교사가 평가한 점수보다 높게 나타났습니다", {
  x: M, y: 1.95, w: CW, h: 1.0, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 21, color: "FFFFFF", lineSpacingMultiple: 1.35,
});
s.addText("De Grez, Valcke, & Roozen, 2012", {
  x: M, y: 3.12, w: CW, h: 0.25, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 9.75, color: ON_DARK_SUB,
});
rule(s, 4.75, 3.8, 3.83, RULE_DARK);
s.addText("우리는 자신의 발표에 관대합니다", {
  x: M, y: 4.35, w: CW, h: 0.75, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 28.5, bold: true, color: "FFFFFF",
});
s.addNotes(
  "\"우리는 자신의 발표에 관대합니다.\"\n" +
  "자기평가만으로는 고쳐야 할 지점을 정확히 찾기 어렵다는 근거로 제시.\n" +
  "[Source] De Grez, Valcke, & Roozen (2012)"
);

// ============================================================
// 05 — AIVO가 하는 일
// ============================================================
s = slide(BG_WHITE);
kicker(s, "AIVO가 하는 일");
s.addText("AIVO", {
  x: M, y: 2.02, w: CW, h: 0.79, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 43.5, bold: true, color: INK,
});
s.addText("놓친 순간을 다시 보고,\n다음 연습을 바꿉니다", {
  x: M, y: 3.23, w: CW, h: 0.96, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 22.5, bold: true, color: PURPLE, lineSpacingMultiple: 1.3,
});
rule(s, 5.0, 4.79, 3.33, PURPLE, 0.03);
s.addText("발표와 면접을 기록하고, 개선이 필요한 순간을 찾습니다.", {
  x: M, y: 5.1, w: CW, h: 0.29, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 12, color: MUTED,
});
s.addNotes(
  "\"그래서 저희는 발표자가 놓친 문제를 데이터로 보여주는 AI 발표 코치, AIVO를 만들었습니다.\""
);

// ============================================================
// 06 — 영상 포폴 (1분)
// ============================================================
s = statementSlide("영상 포폴 · 60초", "AIVO를 60초 안에", "발표와 면접, 두 문제를 하나의 흐름으로 해결합니다");
s.addNotes(
  "[영상 포폴 · 1분]\n" +
  "발표와 면접의 문제가 함께 드러나고, 그 두 문제를 AIVO가 해결하는 흐름의 영상을 재생.\n" +
  "※ 영상을 맨 앞(cold open)으로 옮기고 싶다면 이 슬라이드를 1번 앞으로 이동."
);

// ============================================================
// 07~08 — 시연 (6분)
// ============================================================
s = statementSlide("시연 01", "발표 리허설 시연", "준비 → 실시간 분석 → 슬라이드별 리포트");
s.addNotes("[시연 · 발표] 약 3분. 준비 화면 → 녹화 중 실시간 지표 → 리포트에서 문제 구간 재생까지.");

s = statementSlide("시연 02", "면접 리허설 시연", "질문 생성 → 5초 후 자동 진행 → 답변 리포트");
s.addNotes("[시연 · 면접] 약 3분. 면접관 스타일 설정 → 질문 자동 진행 → 답변별 리포트.");

// ============================================================
// 09~11 — 기능 소개 (1분)
// ============================================================
function featureSlide(kickerText, title, left, right, caption) {
  const sl = slide(BG_WHITE);
  kicker(sl, kickerText);
  sectionTitle(sl, title);
  [left, right].forEach((col, i) => {
    const x = i === 0 ? M : 6.77;
    sl.addText(col.head, {
      x, y: 2.92, w: 5.21, h: 0.33, align: "left", valign: "top", margin: 0,
      fontFace: FONT, fontSize: 15, bold: true, color: INK,
    });
    rule(sl, x, 3.44, 5.21, RULE_FAINT);
    sl.addShape("rect", {
      x, y: 3.7, w: 5.21, h: 1.72, fill: { color: SLOT_FILL }, line: { color: SLOT_FILL, width: 0 },
    });
    sl.addText(col.slot, {
      x, y: 3.7, w: 5.21, h: 1.72, align: "center", valign: "middle", margin: 0,
      fontFace: FONT, fontSize: 10.5, color: "9C99B0",
    });
    sl.addText(col.desc, {
      x, y: 5.62, w: 5.21, h: 0.85, align: "left", valign: "top", margin: 0,
      fontFace: FONT, fontSize: 11.25, color: MUTED, lineSpacingMultiple: 1.4,
    });
  });
  if (caption) {
    sl.addText(caption, {
      x: M, y: 6.55, w: CW, h: 0.28, align: "left", valign: "top", margin: 0,
      fontFace: FONT, fontSize: 10.5, color: MUTED,
    });
  }
  return sl;
}

s = featureSlide(
  "기능 소개 · 발표",
  "연습 화면과 리포트, 두 화면으로",
  {
    head: "실시간 평가",
    slot: "발표 녹화 화면 캡처",
    desc: "말속도 · 습관어 · 음량을 발화 중 표시하고,\n시선 이탈과 자세 흐트러짐을 함께 감지합니다.",
  },
  {
    head: "평가 리포트",
    slot: "발표 리포트 화면 캡처",
    desc: "슬라이드별 발화와 문제 시점을 나란히 보고,\n지적된 구간을 클릭해 그 순간부터 다시 재생합니다.",
  },
  "발표가 끝나면 발표 맥락 기반의 청중 예상 질문으로 이어집니다."
);
s.addNotes("실제 서비스 캡처를 좌우 회색 슬롯에 삽입하세요.");

s = featureSlide(
  "기능 소개 · 면접",
  "질문은 자동으로, 답변은 기록으로",
  {
    head: "실시간 평가",
    slot: "면접 녹화 화면 캡처",
    desc: "질문이 자동으로 제시되고 생각할 시간은 5초.\n실제 면접의 압박감까지 재현합니다.",
  },
  {
    head: "평가 리포트",
    slot: "면접 리포트 화면 캡처",
    desc: "질문별 답변을 다시 듣고,\n말하기 습관을 발표 연습과 같은 기준으로 비교합니다.",
  },
  "회사 · 직무와 면접관 스타일(인성 · 직무 · 압박형)을 미리 설정할 수 있습니다."
);
s.addNotes("실제 서비스 캡처를 좌우 회색 슬롯에 삽입하세요.");

// 11 — 아카이브 (차트)
s = slide(BG_TINT);
kicker(s, "기능 소개 · 아카이브");
sectionTitle(s, "연습마다 점수가 쌓이고, 성장 추이가 남습니다");
s.addChart(
  pres.ChartType.line,
  [{ name: "종합 점수", labels: ["시도 1", "시도 2", "시도 3", "시도 4", "시도 5"], values: [58, 64, 71, 76, 84] }],
  {
    x: 1.6, y: 2.75, w: 10.1, h: 3.3,
    showTitle: false, showLegend: false,
    showValue: true, dataLabelPosition: "t", dataLabelColor: INK, dataLabelFontSize: 11, dataLabelFontFace: FONT,
    chartColors: [PURPLE],
    lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 8,
    catAxisLabelColor: MUTED, catAxisLabelFontSize: 11, catAxisLabelFontFace: FONT,
    valAxisLabelColor: MUTED, valAxisLabelFontSize: 11, valAxisLabelFontFace: FONT,
    valAxisMinVal: 0, valAxisMaxVal: 100,
    valGridLine: { color: "E4E2EF", size: 1 },
    catGridLine: { style: "none" },
  }
);
s.addText("같은 폴더 안의 시도끼리 점수와 문제 구간을 이어서 비교합니다.", {
  x: M, y: 6.2, w: CW, h: 0.29, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 12, color: MUTED,
});
s.addNotes("※ 그래프는 아카이브 화면의 예시 추이입니다. 실제 데모 계정 수치로 교체하면 더 좋습니다.");

// ============================================================
// 12 — 기술 섹션 전환
// ============================================================
s = statementSlide("기술 소개", "점수 뒤에는, 기술이 있다", "리포트에 찍힌 지표를 하나씩 열어 봅니다");
s.addNotes("[기술 소개 · 3분 시작]");

// ============================================================
// 13 — 시스템 아키텍처
// ============================================================
s = slide(BG_WHITE);
kicker(s, "기술 소개 · 아키텍처");
sectionTitle(s, "시스템 아키텍처");

function archBox(sl, x, y, w, h, title, sub, accent) {
  sl.addShape("rect", {
    x, y, w, h, fill: { color: accent ? "EDEBFA" : SLOT_FILL },
    line: { color: accent ? "EDEBFA" : SLOT_FILL, width: 0 },
  });
  sl.addText(title, {
    x: x + 0.15, y: y + 0.22, w: w - 0.3, h: 0.3, align: "center", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 12, bold: true, color: accent ? PURPLE : INK,
  });
  if (sub) {
    sl.addText(sub, {
      x: x + 0.15, y: y + 0.56, w: w - 0.3, h: 0.5, align: "center", valign: "top", margin: 0,
      fontFace: FONT, fontSize: 9.75, color: MUTED, lineSpacingMultiple: 1.25,
    });
  }
}

// 왼쪽 열 — 사용자 기기(브라우저)
s.addText("사용자 기기 (브라우저)", {
  x: M, y: 2.62, w: 4.6, h: 0.25, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 9.75, bold: true, color: PURPLE,
});
archBox(s, M, 2.95, 4.6, 1.2, "Vue 3 SPA", "화면 · 상태 관리");
archBox(s, M, 4.45, 4.6, 1.2, "실시간 분석", "MediaPipe · Web Audio · Web Speech", true);

// 오른쪽 열 — 서버
s.addText("서버", {
  x: 5.9, y: 2.62, w: 6.54, h: 0.25, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 9.75, bold: true, color: PURPLE,
});
archBox(s, 5.9, 2.95, 2.07, 1.2, "Nginx", "정적 서빙 · 프록시");
archBox(s, 8.14, 2.95, 2.07, 1.2, "Spring Boot", "REST API · 인증");
archBox(s, 10.37, 2.95, 2.07, 1.2, "FastAPI", "음성 · 내용 분석");
archBox(s, 5.9, 4.45, 3.15, 1.2, "PostgreSQL", "연습 · 리포트 데이터");
archBox(s, 9.29, 4.45, 3.15, 1.2, "Grafana", "메트릭 · 모니터링");

rule(s, M, 6.05, CW, RULE_FAINT);
s.addText("실시간 피드백은 사용자 기기에서 처리하고, 저장을 선택한 데이터만 서버 경계를 넘습니다.", {
  x: M, y: 6.25, w: CW, h: 0.29, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 11.25, color: MUTED,
});

// ============================================================
// 14 — 기술 스택
// ============================================================
s = slide(BG_TINT);
kicker(s, "기술 소개 · 스택");
sectionTitle(s, "기술 스택");
const stacks = [
  { label: "FE", title: "프론트엔드", desc: "Vue 3 · SFC\nPinia · Vite\nVitest" },
  { label: "BE", title: "백엔드", desc: "Spring Boot\nPostgreSQL\nREST API" },
  { label: "AI", title: "AI · 분석", desc: "FastAPI\nMediaPipe\nWeb Speech · LLM" },
  { label: "OPS", title: "인프라", desc: "Docker · Nginx\nGrafana\nCI 배포" },
];
stacks.forEach((st, i) => {
  labeledColumn(s, M + i * 2.99, 3.0, st.label, st.title, st.desc, { w: 2.59, ruleW: 2.59 });
});
s.addText("실시간 분석은 브라우저에서, 저장·분석·모니터링은 서버에서 역할을 나눠 맡습니다.", {
  x: M, y: 6.2, w: CW, h: 0.29, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 11.25, color: MUTED,
});

// ============================================================
// 15 — 프론트엔드
// ============================================================
s = slide(BG_WHITE);
kicker(s, "기술 소개 · 프론트엔드");
sectionTitle(s, "녹화가 끝나야 아는 피드백은, 늦다");
const feCols = [
  { label: "01", title: "MediaPipe", desc: "카메라 프레임에서 랜드마크를 추출해\n시선 이탈과 자세 흐트러짐을 감지" },
  { label: "02", title: "Web Audio", desc: "음량과 발화 리듬을 계산해\n말속도와 공백 구간을 실시간 산출" },
  { label: "03", title: "Web Speech", desc: "발화를 즉시 자막으로 변환해\n습관어를 발화 구간 기준으로 집계" },
];
feCols.forEach((c, i) => {
  labeledColumn(s, 0.88 + i * 3.9, 2.9, c.label, c.title, c.desc, { w: 3.5, ruleW: 3.5 });
});
rule(s, M, 5.55, CW, RULE_FAINT);
s.addText("모든 분석을 매 프레임 돌리면 UI가 버벅입니다. 분석 주기를 샘플링하고 시선·자세와 음성 처리를 분리해 녹화 흐름을 지켰습니다.", {
  x: M, y: 5.78, w: CW, h: 0.29, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 11.25, color: MUTED,
});

// ============================================================
// 16 — 백엔드
// ============================================================
s = slide(BG_WHITE);
kicker(s, "기술 소개 · 백엔드");
sectionTitle(s, "연습 기록을 리포트로 바꾸는 층");
const beCols = [
  { label: "01", title: "연습 세션 관리", desc: "인증과 폴더 단위 연습 기록을 관리하고\n시도마다 기준값을 함께 저장" },
  { label: "02", title: "슬라이드 · 발화 귀속", desc: "슬라이드 전환 시각과 발화 타임스탬프를 교차해\n어느 슬라이드에서 무슨 말을 했는지 붙임" },
  { label: "03", title: "리포트 · 아카이브 API", desc: "슬라이드별 타이밍과 문제 구간을 내려주고\n이전 시도와의 비교를 제공" },
];
beCols.forEach((c, i) => {
  labeledColumn(s, 0.88 + i * 3.9, 2.9, c.label, c.title, c.desc, { w: 3.5, ruleW: 3.5 });
});
rule(s, M, 5.55, CW, RULE_FAINT);
s.addText("문제 구간을 클릭하면 그 순간부터 녹화 영상이 재생되도록, 시간축을 서버에서 일관되게 관리합니다.", {
  x: M, y: 5.78, w: CW, h: 0.29, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 11.25, color: MUTED,
});

// ============================================================
// 17 — AI
// ============================================================
s = slide(BG_WHITE);
kicker(s, "기술 소개 · AI");
sectionTitle(s, "말하려던 것과 실제로 말한 것을 맞춰 본다");
const aiCols = [
  { label: "01", title: "내용 일치 비교", desc: "슬라이드 핵심 내용과 실제 발화를\n슬라이드 단위로 대조" },
  { label: "02", title: "예상 질문 생성", desc: "발표 맥락과 실제 발화를 바탕으로\n청중 질문과 꼬리 질문을 구성" },
  { label: "03", title: "음성 지표 산출", desc: "필러와 침묵 구간을 인식된 발화 기준으로\n과대 집계 없이 계산" },
];
aiCols.forEach((c, i) => {
  labeledColumn(s, 0.88 + i * 3.9, 2.9, c.label, c.title, c.desc, { w: 3.5, ruleW: 3.5 });
});
rule(s, M, 5.55, CW, RULE_FAINT);
s.addText("현재는 키워드 · 규칙 기반 비교를 기본으로 사용하며, LLM 의미 평가는 확장 단계입니다.", {
  x: M, y: 5.78, w: CW, h: 0.29, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 11.25, color: MUTED,
});

// ============================================================
// 18 — AI 모델 성능 (차트)
// ============================================================
s = slide(BG_TINT);
kicker(s, "기술 소개 · AI 성능");
sectionTitle(s, "시도를 거듭할수록 정교해진 필러 · 침묵 탐지");
s.addChart(
  pres.ChartType.bar,
  [{ name: "탐지 정확도(%)", labels: ["시도 1", "시도 2", "시도 3", "시도 4"], values: [61, 74, 85, 92] }],
  {
    x: 1.6, y: 2.75, w: 10.1, h: 3.2,
    barDir: "col", barGapWidthPct: 120,
    showTitle: false, showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: INK, dataLabelFontSize: 11, dataLabelFontFace: FONT,
    chartColors: [PURPLE],
    catAxisLabelColor: MUTED, catAxisLabelFontSize: 11, catAxisLabelFontFace: FONT,
    valAxisLabelColor: MUTED, valAxisLabelFontSize: 11, valAxisLabelFontFace: FONT,
    valAxisMinVal: 0, valAxisMaxVal: 100,
    valGridLine: { color: "E4E2EF", size: 1 },
    catGridLine: { style: "none" },
  }
);
s.addText("탐지 규칙과 임계값을 시도마다 조정하며 성능을 끌어올렸습니다.", {
  x: M, y: 6.15, w: CW, h: 0.29, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 12, color: MUTED,
});
s.addNotes(
  "⚠ 이 차트의 수치(61 / 74 / 85 / 92)는 예시 값입니다. 발표 전 반드시 실제 측정값으로 교체하세요."
);

// ============================================================
// 19 — 인프라
// ============================================================
s = slide(BG_WHITE);
kicker(s, "기술 소개 · 인프라");
sectionTitle(s, "언제 열어도 같은 화면이 뜨도록");
const opsCols = [
  { label: "01", title: "컨테이너 배포", desc: "Docker로 서비스를 묶고\nNginx가 정적 자원과 API를 함께 서빙" },
  { label: "02", title: "상태 모니터링", desc: "Grafana로 서비스 지표를 수집해\n장애 지점을 즉시 확인" },
  { label: "03", title: "회귀 검증", desc: "Vitest로 화면과 스토어를 검증해\n배포 전 회귀를 차단" },
];
opsCols.forEach((c, i) => {
  labeledColumn(s, 0.88 + i * 3.9, 2.9, c.label, c.title, c.desc, { w: 3.5, ruleW: 3.5 });
});
rule(s, M, 5.55, CW, RULE_FAINT);
s.addText("설치 없이, 예약 없이 — 브라우저에서 바로 리허설을 시작할 수 있는 환경을 유지합니다.", {
  x: M, y: 5.78, w: CW, h: 0.29, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 11.25, color: MUTED,
});

// ============================================================
// 20 — 팀 소개
// ============================================================
s = slide(BG_WHITE);
kicker(s, "팀 소개");
sectionTitle(s, "Team AIVO");
const team = [
  { label: "FE", title: "프론트엔드", name: "서가은", desc: "서비스 플로우 · 공통 UI\n녹화 · 실시간 피드백 화면" },
  { label: "BE", title: "백엔드", name: "채승규 · 윤재영", desc: "인증 · 연습 · 리포트 API\n슬라이드 발화 귀속" },
  { label: "AI", title: "AI · 분석", name: "윤성빈", desc: "내용 비교 · 질문 로직\n음성 지표 산출" },
  { label: "OPS", title: "인프라", name: "최현철", desc: "배포 · 컨테이너 · 모니터링" },
];
team.forEach((t, i) => {
  const x = M + i * 2.99;
  s.addText(t.label, {
    x, y: 2.9, w: 0.95, h: 0.29, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 13.5, bold: true, color: PURPLE,
  });
  rule(s, x, 3.33, 2.59, PURPLE);
  s.addText(t.title, {
    x, y: 3.56, w: 2.59, h: 0.3, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 12, bold: true, color: PURPLE,
  });
  s.addText(t.name, {
    x, y: 3.98, w: 2.59, h: 0.36, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 15, bold: true, color: INK,
  });
  s.addText(t.desc, {
    x, y: 4.52, w: 2.59, h: 1.1, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 11.25, color: MUTED, lineSpacingMultiple: 1.35,
  });
});
s.addNotes(
  "⚠ 팀원 이름은 git 커밋 이력에서 가져왔고, 역할 배치는 커밋한 디렉터리를 근거로 추정한 것입니다.\n" +
  "발표 전 실제 담당으로 반드시 수정하세요. (윤재영은 계정 handle에서 추정한 이름입니다.)"
);

// ============================================================
// 21 — 의의 및 향후 계획
// ============================================================
s = slide(BG_TINT);
kicker(s, "의의 및 향후 계획");
s.addText("평가가 아니라,\n개선을 위한 서비스", {
  x: M, y: 1.35, w: 5.42, h: 1.21, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 28.5, bold: true, color: INK, lineSpacingMultiple: 1.25,
});
s.addText(
  "AIVO의 목적은 사용자의 발표를 단순히 점수화하는 것이 아닙니다.\n\n" +
  "사용자가 놓친 문제를 근거와 함께 보여주고,\n다음 연습에서 실제로 개선하도록 돕는 것이 핵심입니다.",
  {
    x: 6.77, y: 1.45, w: 5.67, h: 1.6, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 12, color: BODY, lineSpacingMultiple: 1.45,
  }
);
rule(s, M, 3.75, CW, RULE_LIGHT);
const plans = [
  { n: "01", t: "반복 연습 전후 비교", d: "같은 폴더의 시도끼리\n변화를 이어서 비교" },
  { n: "02", t: "사용자별 기준 개인화", d: "사람마다 다른 말하기 습관을\n기준값에 반영" },
  { n: "03", t: "분석 데이터 기반 성능 개선", d: "축적된 분석 데이터로\n탐지 모델을 고도화" },
];
plans.forEach((p, i) => {
  const x = 0.88 + i * 3.8;
  labeledColumn(s, x, 4.38, p.n, p.t, p.d, { w: 3.3, ruleW: 2.92 });
});
s.addText("앞으로는 반복 연습 결과를 비교하고, 사용자마다 다른 말하기 습관을 반영한 개인화 분석으로 확장할 계획입니다.", {
  x: M, y: 6.4, w: CW, h: 0.29, align: "left", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 11.25, color: MUTED,
});

// ============================================================
// 22 — 마무리 슬로건
// ============================================================
s = slide(BG_DARK);
s.addText("말하기의 순간을\n성장의 데이터로", {
  x: M, y: 2.71, w: CW, h: 1.13, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 31.5, bold: true, color: "FFFFFF", lineSpacingMultiple: 1.3,
});
s.addText("AIVO", {
  x: M, y: 4.42, w: CW, h: 0.31, align: "center", valign: "top", margin: 0,
  fontFace: FONT, fontSize: 13.5, bold: true, color: ON_DARK_KICKER,
});
rule(s, 5.88, 5.1, 1.58, PURPLE, 0.03);

// ============================================================
// 23~26 — 예상 질문
// ============================================================
function qaSlide(idx, q, a) {
  const sl = slide(idx % 2 === 1 ? BG_WHITE : BG_TINT);
  kicker(sl, `예상 질문 · ${String(idx).padStart(2, "0")}`);
  sl.addText("Q.", {
    x: M, y: 1.5, w: 0.6, h: 0.4, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 21, bold: true, color: PURPLE,
  });
  sl.addText(q, {
    x: 1.55, y: 1.5, w: 10.89, h: 0.9, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 21, bold: true, color: INK, lineSpacingMultiple: 1.3,
  });
  rule(sl, M, 2.85, CW, RULE_LIGHT);
  sl.addText("A.", {
    x: M, y: 3.2, w: 0.6, h: 0.35, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 13.5, bold: true, color: PURPLE,
  });
  sl.addText(a, {
    x: 1.55, y: 3.2, w: 10.89, h: 2.2, align: "left", valign: "top", margin: 0,
    fontFace: FONT, fontSize: 13.5, color: BODY, lineSpacingMultiple: 1.5,
  });
  return sl;
}

qaSlide(1, "음성 인식(STT) 정확도는 충분한가요?",
  "실시간 자막은 브라우저 STT를 사용합니다. 음성 분석은 모드에 따라 서버 결과를 분리해 표시하고,\n인식되지 않은 구간에서 필러 값을 임의로 만들지 않습니다.");
qaSlide(2, "녹화 영상의 프라이버시는 어떻게 지키나요?",
  "시선 · 자세 등 실시간 분석은 브라우저 안에서 처리합니다.\n녹화 원본은 사용자가 저장을 선택한 경우에만 서버 저장 흐름으로 전달됩니다.");
qaSlide(3, "기존 AI 면접 서비스와 무엇이 다른가요?",
  "한 번 평가하고 끝나는 서비스가 아니라, 발표와 면접의 준비부터 문제 구간 재생,\n이전 시도 비교까지 이어지는 반복 리허설 루프라는 점이 다릅니다.");
qaSlide(4, "LLM 평가는 믿을 수 있나요?",
  "현재는 키워드 · 규칙 기반 비교를 기본으로 사용하며, LLM 의미 평가는 확장 단계입니다.\n결과는 항상 슬라이드별 실제 발화와 함께 보여 근거를 확인할 수 있게 했습니다.");

pres.writeFile({ fileName: "AIVO_13분_통합발표_수정본.pptx" }).then(() => console.log("built:", pageNo, "slides"));
