const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const {
  assertNoteContent,
  buildQuizPrompt,
  parseQuestionCount,
  parseGeminiQuizJson,
  validateQuizPayload,
} = require("./quizUtils");

initializeApp();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_GENERATE_ERROR_MESSAGE =
  "AI 퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.";

const getCallableUserId = (request) => {
  const requestedUserId =
    typeof request.data?.userId === "string" ? request.data.userId.trim() : "";
  const authUserId = request.auth?.uid || "";

  if (authUserId && requestedUserId && authUserId !== requestedUserId) {
    throw new HttpsError(
      "permission-denied",
      "로그인 사용자 정보가 일치하지 않습니다."
    );
  }

  return authUserId || requestedUserId;
};

const callGeminiGenerateContent = async (
  prompt,
  { responseMimeType, userErrorMessage = "Gemini API 호출에 실패했습니다." } = {}
) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY.value(),
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(responseMimeType
          ? { generationConfig: { responseMimeType } }
          : {}),
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new HttpsError("internal", userErrorMessage);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new HttpsError("internal", userErrorMessage);
  }

  return text;
};

const callGeminiForQuiz = (prompt) =>
  callGeminiGenerateContent(prompt, {
    responseMimeType: "application/json",
    userErrorMessage: GEMINI_GENERATE_ERROR_MESSAGE,
  });

exports.getStudyRecommendation = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (request) => {
    const userId = getCallableUserId(request);
    if (!userId) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const db = getFirestore();

    const [subjectsSnap, todosSnap, quizResultsSnap, quizzesSnap] = await Promise.all([
      db.collection("subjects").where("user_id", "==", userId).get(),
      db.collection("todos").where("user_id", "==", userId).where("is_completed", "==", false).get(),
      db.collection("quiz_results").where("user_id", "==", userId).get(),
      db.collection("quizzes").where("user_id", "==", userId).get(),
    ]);

    const subjects = subjectsSnap.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      goal: doc.data().goal || "",
    }));

    const subjectTitleById = subjects.reduce((acc, s) => {
      acc[s.id] = s.title;
      return acc;
    }, {});

    // quiz_id → subject_id 매핑
    const subjectIdByQuizId = quizzesSnap.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data().subject_id || "";
      return acc;
    }, {});

    // subject_id별 최신 quiz_result score 수집 후 평균 계산
    const latestResultByQuizId = {};
    quizResultsSnap.docs.forEach((doc) => {
      const d = doc.data();
      const qid = d.quiz_id;
      const solvedMs = d.solved_at?.toMillis?.() ?? 0;
      if (!latestResultByQuizId[qid] || solvedMs > latestResultByQuizId[qid].solvedMs) {
        latestResultByQuizId[qid] = {
          solvedMs,
          correct_rate: typeof d.correct_rate === "number" ? d.correct_rate
            : d.total_count > 0 ? Math.round((d.score / d.total_count) * 100) : 0,
        };
      }
    });

    const subjectQuizScores = {};
    Object.entries(latestResultByQuizId).forEach(([quizId, result]) => {
      const subjectId = subjectIdByQuizId[quizId];
      if (!subjectId) return;
      if (!subjectQuizScores[subjectId]) subjectQuizScores[subjectId] = [];
      subjectQuizScores[subjectId].push(result.correct_rate);
    });

    const subjectQuizAvg = Object.entries(subjectQuizScores).reduce((acc, [sid, scores]) => {
      acc[sid] = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
      return acc;
    }, {});

    // 미완료 todo에 추천 점수 부여
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todos = todosSnap.docs.map((doc) => {
      const d = doc.data();
      const deadlineVal = d.deadline || d.dueDate;
      const deadlineMs = deadlineVal?.toMillis?.() ?? 0;
      const daysLeft = deadlineMs > 0
        ? Math.ceil((deadlineMs - today.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      const deadlineScore = daysLeft <= 0 ? 10 : daysLeft <= 1 ? 8 : daysLeft <= 3 ? 6 : daysLeft <= 7 ? 4 : 1;
      const priority = Number(d.priority) || 3;
      const score = deadlineScore + (6 - priority) + 3; // 미완료 가중치 고정 +3

      return {
        title: d.title || "",
        subject_id: d.subject_id || "",
        subject: subjectTitleById[d.subject_id] || "과목 정보 없음",
        deadline: deadlineMs > 0 ? new Date(deadlineMs).toISOString().split("T")[0] : "없음",
        days_left: daysLeft < 999 ? daysLeft : null,
        priority,
        score,
      };
    }).sort((a, b) => b.score - a.score);

    // 과목별 퀴즈 정답률 요약
    const subjectQuizSummary = subjects.map((s) => ({
      subject: s.title,
      quiz_avg_rate: subjectQuizAvg[s.id] ?? null,
    }));

    const todayStr = today.toISOString().split("T")[0];

    const prompt = `
당신은 학습 관리 앱의 AI 추천 도우미입니다.
오늘 날짜: ${todayStr}

[과목 목록]
${JSON.stringify(subjects.map((s) => ({ id: s.id, title: s.title, goal: s.goal })))}

[미완료 할 일 목록 (추천 점수 내림차순)]
${JSON.stringify(todos.slice(0, 20))}

[과목별 퀴즈 정답률 (%)]
${JSON.stringify(subjectQuizSummary)}

위 데이터를 바탕으로 오늘 우선적으로 학습해야 할 과목을 추천하세요.
추천 기준:
1. 마감일이 임박한 할 일이 있는 과목
2. 퀴즈 정답률이 낮아 복습이 필요한 과목
3. 우선순위가 높은 미완료 할 일이 있는 과목

응답은 반드시 아래 JSON 배열 형식으로만 반환하세요. 다른 텍스트 없이 JSON만 반환하세요.
[
  { "priority": 1, "subject": "과목명", "reason": "추천 이유 (마감일, 정답률, 우선순위 등 근거 포함)" },
  { "priority": 2, "subject": "과목명", "reason": "추천 이유" }
]
최대 5개까지 추천하세요.
    `;

    try {
      const text = await callGeminiGenerateContent(prompt, {
        userErrorMessage: "추천 데이터를 불러오지 못했습니다.",
      });
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch (error) {
      throw new HttpsError("internal", "추천 데이터를 불러오지 못했습니다.");
    }
  }
);

exports.generateQuizFromNote = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (request) => {
    try {
      const userId = getCallableUserId(request);
      const noteId =
        typeof request.data?.noteId === "string"
          ? request.data.noteId.trim()
          : "";
      const subjectId =
        typeof request.data?.subjectId === "string"
          ? request.data.subjectId.trim()
          : "";
      let questionCount;

      try {
        questionCount = parseQuestionCount(request.data?.questionCount);
      } catch {
        throw new HttpsError(
          "invalid-argument",
          "questionCount는 5, 10, 15, 20, 25, 30 중 하나여야 합니다."
        );
      }

      if (!userId) {
        throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
      }

      if (!noteId) {
        throw new HttpsError("invalid-argument", "noteId가 필요합니다.");
      }

      if (!subjectId) {
        throw new HttpsError("invalid-argument", "subjectId가 필요합니다.");
      }

      const db = getFirestore();
      const noteSnap = await db.collection("notes").doc(noteId).get();

      if (!noteSnap.exists) {
        throw new HttpsError("not-found", "노트를 찾을 수 없습니다.");
      }

      const note = noteSnap.data();

      if (note.user_id !== userId) {
        throw new HttpsError(
          "permission-denied",
          "본인의 노트만 사용할 수 있습니다."
        );
      }

      if (note.subject_id !== subjectId) {
        throw new HttpsError(
          "invalid-argument",
          "노트의 과목 정보가 일치하지 않습니다."
        );
      }

      const noteContent = assertNoteContent(note.content);
      const prompt = buildQuizPrompt({
        noteTitle: note.title,
        noteContent,
        questionCount,
      });
      const geminiText = await callGeminiForQuiz(prompt);
      const parsed = parseGeminiQuizJson(geminiText);
      const quizPayload = validateQuizPayload(parsed, { questionCount });
      const quizRef = db.collection("quizzes").doc();

      await quizRef.set({
        id: quizRef.id,
        user_id: userId,
        subject_id: subjectId,
        note_id: noteId,
        title: quizPayload.title,
        questions: quizPayload.questions,
        question_count: quizPayload.questions.length,
        created_at: FieldValue.serverTimestamp(),
      });

      return {
        quizId: quizRef.id,
        id: quizRef.id,
        title: quizPayload.title,
        questionCount: quizPayload.questions.length,
      };
    } catch (error) {
      if (
        error instanceof HttpsError &&
        ["unauthenticated", "invalid-argument", "not-found", "permission-denied"].includes(
          error.code
        )
      ) {
        throw error;
      }

      throw new HttpsError("internal", GEMINI_GENERATE_ERROR_MESSAGE);
    }
  }
);
