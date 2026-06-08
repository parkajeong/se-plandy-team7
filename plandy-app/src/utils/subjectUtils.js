const { getUserId, hasText } = require("./commonUtils");

function validateSubjectTitle(title) {
  return hasText(title);
}

function findSubjectById(subjects = [], subjectId) {
  return subjects.find((subject) => subject.id === subjectId) || null;
}

function filterSubjectsByUser(subjects = [], userId) {
  return subjects.filter((subject) => getUserId(subject) === userId);
}

module.exports = {
  filterSubjectsByUser,
  findSubjectById,
  validateSubjectTitle,
};
