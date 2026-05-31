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
  console.log("Using Gemini model:", GEMINI_MODEL);

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
    console.error("Gemini API request failed", {
      model: GEMINI_MODEL,
      status: response.status,
      error: data?.error || data,
    });
    throw new HttpsError("internal", userErrorMessage);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("Gemini API response text is empty", {
      model: GEMINI_MODEL,
      response: data,
    });
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
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const db = getFirestore();

    const [subjectsSnap, todosSnap, schedulesSnap] = await Promise.all([
      db.collection("subjects").where("user_id", "==", userId).get(),
      db.collection("todos").where("user_id", "==", userId).get(),
      db.collection("schedules").where("user_id", "==", userId).get(),
    ]);

    const subjects = subjectsSnap.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      goal: doc.data().goal,
    }));

    const subjectTitleById = subjects.reduce((acc, subject) => {
      acc[subject.id] = subject.title;
      return acc;
    }, {});

    const todos = todosSnap.docs.map((doc) => ({
      title: doc.data().title,
      subject_id: doc.data().subject_id || "",
      subject: subjectTitleById[doc.data().subject_id] || "과목 정보 없음",
      status: doc.data().status || (doc.data().is_completed ? "completed" : "open"),
      dueDate: doc.data().dueDate,
      type: doc.data().type || doc.data().category,
    }));

    const schedules = schedulesSnap.docs.map((doc) => ({
      title: doc.data().title,
      start_time: doc.data().start_time?.toDate?.()?.toISOString?.() || "",
      end_time: doc.data().end_time?.toDate?.()?.toISOString?.() || "",
    }));

    const today = new Date().toISOString().split("T")[0];

    const prompt = `
당신은 학습 관리 앱의 AI 추천 도우미입니다.
오늘 날짜: ${today}

사용자의 학습 데이터:
- 과목 목록: ${JSON.stringify(subjects)}
- 할 일 목록: ${JSON.stringify(todos)}
- 일정 목록: ${JSON.stringify(schedules)}

다음 기준으로 우선 학습할 항목을 추천하세요:
1. 마감일이 가까운 할 일
2. 미완료 상태의 할 일
3. 중요한 과목

응답은 반드시 아래 JSON 형식으로만 반환하세요. 다른 텍스트 없이 JSON만 반환하세요.
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

    try {
      const text = await callGeminiGenerateContent(prompt, {
        userErrorMessage: "추천 데이터를 불러오지 못했습니다.",
      });
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch (error) {
      console.error("Study recommendation generation failed", error);
      return {
        recommendations: [],
        summary: "추천 데이터를 불러오지 못했습니다.",
      };
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

      if (error instanceof SyntaxError) {
        console.error("Gemini quiz JSON parsing failed", error);
      } else {
        console.error("Quiz generation failed", error);
      }

      throw new HttpsError("internal", GEMINI_GENERATE_ERROR_MESSAGE);
    }
  }
);
