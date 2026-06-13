const { getSubjectId, hasText } = require("./commonUtils");

function validateNoteInput(title, content, subjectId) {
  return hasText(title) && hasText(content) && hasText(subjectId);
}

function validateNoteForQuiz(content) {
  return hasText(content);
}

function filterNotesBySubject(notes = [], subjectId) {
  return notes.filter((note) => getSubjectId(note) === subjectId);
}

module.exports = {
  filterNotesBySubject,
  validateNoteForQuiz,
  validateNoteInput,
};
