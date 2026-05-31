import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type SubjectOption = {
  id: string;
  title: string;
};

type SubjectDropdownProps = {
  subjects: SubjectOption[];
  selectedSubjectId?: string | null;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  onSelect: (subject: SubjectOption) => void;
  onOpen?: () => void | Promise<unknown>;
};

export default function SubjectDropdown({
  subjects,
  selectedSubjectId,
  placeholder = "과목 선택",
  emptyMessage = "먼저 과목을 등록해주세요.",
  disabled = false,
  onSelect,
  onOpen,
}: SubjectDropdownProps) {
  const [isVisible, setIsVisible] = useState(false);

  const selectedSubject = subjects.find(
    (subject) => subject.id === selectedSubjectId
  );

  const handleOpen = async () => {
    if (disabled) {
      return;
    }

    await onOpen?.();
    setIsVisible(true);
  };

  return (
    <>
      <Pressable
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={handleOpen}
        disabled={disabled}
      >
        <Text
          style={selectedSubject ? styles.selectedText : styles.placeholderText}
        >
          {selectedSubject ? selectedSubject.title : placeholder}
        </Text>
      </Pressable>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>과목 선택</Text>

            <FlatList
              data={subjects}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.subjectItem,
                    item.id === selectedSubjectId && styles.subjectItemSelected,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setIsVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.subjectItemText,
                      item.id === selectedSubjectId &&
                        styles.subjectItemTextSelected,
                    ]}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              )}
            />

            <Pressable
              style={styles.closeButton}
              onPress={() => setIsVisible(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
    backgroundColor: "#ffffff",
  },
  triggerDisabled: {
    backgroundColor: "#f3f4f6",
  },
  selectedText: {
    fontSize: 16,
    color: "#111827",
  },
  placeholderText: {
    fontSize: 16,
    color: "#9ca3af",
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
    backgroundColor: "#ffffff",
    borderRadius: 15,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#111827",
  },
  subjectItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  subjectItemSelected: {
    backgroundColor: "#eff6ff",
  },
  subjectItemText: {
    fontSize: 16,
    color: "#111827",
  },
  subjectItemTextSelected: {
    fontWeight: "700",
    color: "#2563eb",
  },
  emptyText: {
    color: "#777777",
    marginTop: 10,
  },
  closeButton: {
    marginTop: 15,
    backgroundColor: "#4A90E2",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
