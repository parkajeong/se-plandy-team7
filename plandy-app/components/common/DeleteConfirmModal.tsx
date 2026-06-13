import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "@/constants/theme";

interface DeleteConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackground}>
        <View style={styles.deleteModalContainer}>
          <Text style={styles.modalTitle}>{title}</Text>

          <Text style={styles.deleteModalText}>{message}</Text>

          <View style={styles.deleteModalButtonRow}>
            <TouchableOpacity style={styles.deleteCancelButton} onPress={onCancel}>
              <Text style={styles.deleteCancelButtonText}>취소</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteConfirmButton} onPress={onConfirm}>
              <Text style={styles.deleteConfirmButtonText}>삭제</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  deleteModalContainer: {
    width: "100%",
    backgroundColor: COLORS.background,
    borderRadius: 15,
    padding: 20,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    color: COLORS.text,
  },

  deleteModalText: {
    fontSize: 16,
    marginBottom: 20,
    color: COLORS.text,
  },

  deleteModalButtonRow: {
    flexDirection: "row",
    gap: 10,
  },

  deleteCancelButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  deleteCancelButtonText: {
    color: COLORS.subText,
    fontSize: 16,
    fontWeight: "bold",
  },

  deleteConfirmButton: {
    flex: 1,
    backgroundColor: COLORS.danger,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  deleteConfirmButtonText: {
    color: COLORS.buttonText,
    fontSize: 16,
    fontWeight: "bold",
  },
});
