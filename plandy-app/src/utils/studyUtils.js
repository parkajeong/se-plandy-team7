const { getSubjectId, hasText } = require("./commonUtils");

function validateStudyGroupInput(name, subjectId) {
  return hasText(name) && hasText(subjectId);
}

function getMemberId(member) {
  if (typeof member === "string") {
    return member;
  }

  return member?.user_id ?? member?.userId ?? member?.uid ?? member?.id ?? null;
}

function isStudyMember(studyGroup, userId) {
  const members = Array.isArray(studyGroup?.members) ? studyGroup.members : [];
  return members.some((member) => getMemberId(member) === userId);
}

function filterStudyGroupsByUser(studyGroups = [], userId) {
  return studyGroups.filter((studyGroup) => isStudyMember(studyGroup, userId));
}

module.exports = {
  filterStudyGroupsByUser,
  isStudyMember,
  validateStudyGroupInput,
};
