const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

exports.getStudyRecommendation = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new Error("로그인이 필요합니다.");
    }

    const db = getFirestore();

    // Firestore에서 데이터 조회
    const [subjectsSnap, todosSnap, schedulesSnap] = await Promise.all([
      db.collection("subjects").where("user_id", "==", userId).get(),
      db.collection("todos").where("user_id", "==", userId).get(),
      db.collection("schedules").where("user_id", "==", userId).get(),
    ]);

    const subjects = subjectsSnap.docs.map((d) => ({
      id: d.id,
      title: d.data().title,
      goal: d.data().goal,
    }));

    const subjectTitleById = subjects.reduce((acc, subject) => {
      acc[subject.id] = subject.title;
      return acc;
    }, {});

    const todos = todosSnap.docs.map((d) => ({
      title: d.data().title,
      subject_id: d.data().subject_id || "",
      subject: subjectTitleById[d.data().subject_id] || "과목 정보 없음",
      status: d.data().status || (d.data().is_completed ? "completed" : "open"),
      dueDate: d.data().dueDate,
      type: d.data().type || d.data().category,
    }));

    const schedules = schedulesSnap.docs.map((d) => ({
      title: d.data().title,
      start_time: d.data().start_time?.toDate?.()?.toISOString?.() || "",
      end_time: d.data().end_time?.toDate?.()?.toISOString?.() || "",
    }));

    const today = new Date().toISOString().split("T")[0];

    const prompt = `
당신은 학습 관리 앱의 AI 추천 도우미입니다.
오늘 날짜: ${today}

사용자의 학습 데이터:
- 과목 목록: ${JSON.stringify(subjects)}
- 투두 목록: ${JSON.stringify(todos)}
- 일정 목록: ${JSON.stringify(schedules)}

다음 기준으로 우선 학습할 항목을 추천해주세요:
1. 마감일이 가까운 할 일 (FR-030)
2. 미완료 상태인 할 일 (FR-032)
3. 중요도가 높은 항목 (FR-033)

응답은 반드시 아래 JSON 형식으로만 답하세요. 다른 텍스트 없이 JSON만 반환하세요:
{
  "recommendations": [
    {
      "priority": 1,
      "subject": "과목명",
      "reason": "추천 이유",
      "action": "구체적인 행동 제안"
    }
  ],
  "summary": "전체 학습 상태 한 줄 요약"
}
    `;

    // Gemini API 호출
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY.value()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    try {
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return { recommendations: [], summary: "추천 데이터를 불러오지 못했습니다." };
    }
  }
);
