import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "@/constants/theme";
import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import { db } from "@/src/firebase";

type Note = {
  id: string;
  title?: string;
  content?: string;
  updated_at?: any;
};

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const formatDate = (value: any) => {
  const date = value?.toDate?.() || (value instanceof Date ? value : null);

  if (!date) return "-";

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export default function SubjectNotesScreen() {
  const params = useLocalSearchParams();
  const subjectId = getParam(params.subjectId);
  const subjectTitle = getParam(params.subjectTitle) || "과목 노트";

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isWriteModalVisible, setIsWriteModalVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [content, setContent] = useState("");

  const fetchNotes = useCallback(async () => {
    const userId = getCurrentAppUserIdOrNull();

    if (!userId || !subjectId) {
      setNotes([]);
      return;
    }

    try {
      setIsLoading(true);

      const q = query(
        collection(db, "notes"),
        where("user_id", "==", userId),
        where("subject_id", "==", subjectId)
      );
      const querySnapshot = await getDocs(q);
      const data: Note[] = [];

      querySnapshot.forEach((docItem) => {
        data.push({ id: docItem.id, ...docItem.data() } as Note);
      });

      setNotes(data);
    } catch (error) {
      void error;
      Alert.alert("오류", "노트 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [fetchNotes])
  );

  const openWriteModal = () => {
    const userId = getCurrentAppUserIdOrNull();

    if (!userId) {
      Alert.alert("오류", "로그인 후 노트를 작성할 수 있습니다.");
      return;
    }

    setNoteTitle("");
    setContent("");
    setIsWriteModalVisible(true);
  };

  const handleAddNote = async () => {
    const userId = getCurrentAppUserIdOrNull();

    if (!userId || !subjectId) {
      Alert.alert("오류", "로그인 후 노트를 작성할 수 있습니다.");
      return;
    }

    if (!noteTitle.trim() || !content.trim()) {
      Alert.alert("오류", "노트 제목과 내용을 모두 입력해주세요.");
      return;
    }

    try {
      await addDoc(collection(db, "notes"), {
        user_id: userId,
        subject_id: subjectId,
        title: noteTitle,
        content: content,
        updated_at: new Date(),
      });

      Alert.alert("성공", "노트가 저장되었습니다.");

      setIsWriteModalVisible(false);
      setNoteTitle("");
      setContent("");
      fetchNotes();
    } catch (error) {
      void error;
      Alert.alert("오류", "노트 저장 실패");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>{subjectTitle}</Text>
          <Text style={styles.screenSubtitle}>이 과목에 작성된 노트를 확인하세요</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openWriteModal}>
          <Text style={styles.addButtonText}>+ 노트 작성</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={COLORS.primary} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>이 과목에 작성된 노트가 없어요.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/note-detail",
                  params: {
                    noteId: item.id,
                    noteTitle: item.title ?? "",
                    noteContent: item.content ?? "",
                    updatedAt: item.updated_at?.toDate?.().toLocaleDateString("ko-KR") ?? "",
                  },
                })
              }
            >
              <Text style={styles.noteTitle}>{item.title || "제목 없음"}</Text>
              <Text style={styles.noteDate}>{formatDate(item.updated_at)}</Text>
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={isWriteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsWriteModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>노트 작성</Text>

            <TextInput
              style={styles.input}
              placeholder="노트 제목"
              placeholderTextColor={COLORS.subText}
              value={noteTitle}
              onChangeText={setNoteTitle}
            />

            <TextInput
              style={styles.noteInput}
              placeholder="학습 노트 내용을 입력하세요"
              placeholderTextColor={COLORS.subText}
              value={content}
              onChangeText={setContent}
              multiline
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleAddNote}>
              <Text style={styles.submitButtonText}>저장하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsWriteModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
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
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
  },
  screenSubtitle: {
    fontSize: 14,
    color: COLORS.subText,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: {
    color: COLORS.buttonText,
    fontSize: 14,
    fontWeight: "600",
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    padding: 24,
    paddingBottom: 40,
  },
  emptyText: {
    color: COLORS.subText,
    textAlign: "center",
    marginTop: 40,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  noteDate: {
    fontSize: 13,
    color: COLORS.subText,
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
    backgroundColor: COLORS.background,
    borderRadius: 15,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    color: COLORS.text,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    height: 160,
    textAlignVertical: "top",
    color: COLORS.text,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  submitButtonText: {
    color: COLORS.buttonText,
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButtonText: {
    color: COLORS.subText,
    fontSize: 16,
    fontWeight: "700",
  },
});
