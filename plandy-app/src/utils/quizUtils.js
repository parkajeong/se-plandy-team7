const { calculateRate, getSubjectId, hasText } = require("./commonUtils");

const VALID_QUIZ_COUNTS = [5, 10, 15, 20, 25, 30];

function validateQuizCount(count) {
  return VALID_QUIZ_COUNTS.includes(Number(count));
}

function validateQuizInput(noteId, subjectId, count) {
  return hasText(noteId) && hasText(subjectId) && validateQuizCount(count);
}

function filterQuizzesBySubject(quizzes = [], subjectId) {
  return quizzes.filter((quiz) => getSubjectId(quiz) === subjectId);
}

function calculateQuizCorrectRate(correctCount, totalCount) {
  return calculateRate(correctCount, totalCount);
}

module.exports = {
  calculateQuizCorrectRate,
  filterQuizzesBySubject,
  validateQuizCount,
  validateQuizInput,
};
