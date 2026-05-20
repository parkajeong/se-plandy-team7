import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  FlatList,
  Modal,
} from "react-native";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import { getSubjects } from "@/src/subjectService";

const firebase = require("../../src/firebase");
const db = firebase.db;

type Subject = {
  id: string;
  title: string;
  goal?: string;
  progress?: number;
};

export default function NoteScreen() {
  const [mode, setMode] = useState<"write" | "search">("write");

  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [searchSubject, setSearchSubject] = useState<Subject | null>(null);

  const [noteTitle, setNoteTitle] = useState("");
  const [content, setContent] = useState("");

  const [notes, setNotes] = useState<any[]>([]);

  const [isWriteSubjectModalVisible, setIsWriteSubjectModalVisible] =
    useState(false);
  const [isSearchSubjectModalVisible, setIsSearchSubjectModalVisible] =
    useState(false);

  const userId = getCurrentAppUserIdOrNull();

  const fetchSubjects = async () => {
    if (!userId) {
      setSubjects([]);
      return;
    }

    try {
      const data = await getSubjects(userId);
      setSubjects(data as Subject[]);
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "과목 목록 조회 실패");
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleAddNote = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 노트를 작성할 수 있습니다.");
      return;
    }

    if (!selectedSubject || !noteTitle || !content) {
      Alert.alert("오류", "과목, 노트 제목, 노트 내용을 모두 입력해주세요.");
      return;
    }

    try {
      await addDoc(collection(db, "notes"), {
        user_id: userId,
        subject_id: selectedSubject.id,
        title: noteTitle,
        content: content,
        updated_at: new Date(),
      });

      Alert.alert("성공", "노트가 저장되었습니다.");

      setSelectedSubject(null);
      setNoteTitle("");
      setContent("");
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "노트 저장 실패");
    }
  };

  const handleSearchNotes = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 노트를 조회할 수 있습니다.");
      return;
    }

    if (!searchSubject) {
      Alert.alert("오류", "조회할 과목을 선택해주세요.");
      return;
    }

    try {
      const q = query(
        collection(db, "notes"),
        where("user_id", "==", userId),
        where("subject_id", "==", searchSubject.id)
      );

      const querySnapshot = await getDocs(q);

      const data: any[] = [];

      querySnapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setNotes(data);
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "노트 조회 실패");
    }
  };

  const getSubjectTitle = (subjectId: string) => {
    const subject = subjects.find((item) => item.id === subjectId);
    return subject ? subject.title : subjectId;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>노트 관리</Text>

      {!userId && (
        <Text style={styles.loginNotice}>
          로그인 후 노트 작성 및 조회가 가능합니다.
        </Text>
      )}

      {/* 작성 / 조회 전환 버튼 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, mode === "write" && styles.activeTabButton]}
          onPress={() => setMode("write")}
        >
          <Text
            style={[
              styles.tabButtonText,
              mode === "write" && styles.activeTabButtonText,
            ]}
          >
            노트 작성
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, mode === "search" && styles.activeTabButton]}
          onPress={() => setMode("search")}
        >
          <Text
            style={[
              styles.tabButtonText,
              mode === "search" && styles.activeTabButtonText,
            ]}
          >
            노트 조회
          </Text>
        </TouchableOpacity>
      </View>

      {/* 노트 작성 화면 */}
      {mode === "write" && (
        <View>
          <Text style={styles.sectionTitle}>노트 작성</Text>

          <TouchableOpacity
            style={styles.input}
            onPress={() => {
              if (!userId) {
                Alert.alert("오류", "로그인 후 과목을 선택할 수 있습니다.");
                return;
              }

              setIsWriteSubjectModalVisible(true);
            }}
          >
            <Text
              style={selectedSubject ? styles.selectedText : styles.placeholderText}
            >
              {selectedSubject ? selectedSubject.title : "과목 선택"}
            </Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="노트 제목"
            value={noteTitle}
            onChangeText={setNoteTitle}
          />

          <TextInput
            style={styles.noteInput}
            placeholder="학습 노트 내용을 입력하세요"
            value={content}
            onChangeText={setContent}
            multiline
          />

          <TouchableOpacity style={styles.button} onPress={handleAddNote}>
            <Text style={styles.buttonText}>저장하기</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 노트 조회 화면 */}
      {mode === "search" && (
        <View style={styles.searchContainer}>
          <Text style={styles.sectionTitle}>과목별 노트 조회</Text>

          <TouchableOpacity
            style={styles.input}
            onPress={() => {
              if (!userId) {
                Alert.alert("오류", "로그인 후 과목을 선택할 수 있습니다.");
                return;
              }

              setIsSearchSubjectModalVisible(true);
            }}
          >
            <Text
              style={searchSubject ? styles.selectedText : styles.placeholderText}
            >
              {searchSubject ? searchSubject.title : "조회할 과목 선택"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearchNotes}
          >
            <Text style={styles.buttonText}>조회하기</Text>
          </TouchableOpacity>

          <FlatList
            data={notes}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text style={styles.emptyText}>조회된 노트가 없습니다.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.subject}>
                  {getSubjectTitle(item.subject_id)}
                </Text>

                <Text style={styles.noteTitle}>
                  {item.title}
                </Text>

                <Text style={styles.noteText}>
                  {item.content}
                </Text>
              </View>
            )}
          />
        </View>
      )}

      {/* 노트 작성용 과목 선택 모달 */}
      <Modal
        visible={isWriteSubjectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsWriteSubjectModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>과목 선택</Text>

            <FlatList
              data={subjects}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  등록된 과목이 없습니다.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.subjectItem}
                  onPress={() => {
                    setSelectedSubject(item);
                    setIsWriteSubjectModalVisible(false);
                  }}
                >
                  <Text style={styles.subjectItemText}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsWriteSubjectModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 노트 조회용 과목 선택 모달 */}
      <Modal
        visible={isSearchSubjectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSearchSubjectModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>조회할 과목 선택</Text>

            <FlatList
              data={subjects}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  등록된 과목이 없습니다.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.subjectItem}
                  onPress={() => {
                    setSearchSubject(item);
                    setIsSearchSubjectModalVisible(false);
                  }}
                >
                  <Text style={styles.subjectItemText}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsSearchSubjectModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },

  loginNotice: {
    color: "#e53e3e",
    marginBottom: 15,
    fontSize: 15,
  },

  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#F2F2F2",
    borderRadius: 10,
    padding: 4,
  },

  tabButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  activeTabButton: {
    backgroundColor: "#4A90E2",
  },

  tabButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#777",
  },

  activeTabButtonText: {
    color: "#fff",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    marginTop: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    justifyContent: "center",
  },

  selectedText: {
    fontSize: 16,
    color: "#000",
  },

  placeholderText: {
    fontSize: 16,
    color: "#999",
  },

  noteInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    height: 160,
    textAlignVertical: "top",
  },

  button: {
    backgroundColor: "#4A90E2",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 25,
  },

  searchButton: {
    backgroundColor: "#4A90E2",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  searchContainer: {
    flex: 1,
  },

  card: {
    backgroundColor: "#F2F2F2",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },

  subject: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },

  noteTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },

  noteText: {
    fontSize: 16,
    lineHeight: 22,
  },

  emptyText: {
    color: "#777",
    marginTop: 10,
  },

  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalContainer: {
    width: "100%",
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
  },

  subjectItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  subjectItemText: {
    fontSize: 16,
  },

  closeButton: {
    marginTop: 15,
    backgroundColor: "#4A90E2",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});