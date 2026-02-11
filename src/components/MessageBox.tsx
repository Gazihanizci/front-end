import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  type?: "success" | "error" |"info";
  onClose: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
};

export default function MessageBox({
  visible,
  title,
  message,
  type = "success",
  onClose,
  onConfirm,
  onCancel,
  confirmText = "Tamam",
  cancelText = "Vazgeç",
}: Props) {
  const isSuccess = type === "success";
  const showConfirm = typeof onConfirm === "function";

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text
            style={[
              styles.title,
              { color: isSuccess ? "#22c55e" : "#ef4444" },
            ]}
          >
            {title}
          </Text>

          <Text style={styles.message}>{message}</Text>

          {showConfirm ? (
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel || onClose}>
                <Text style={styles.cancelButtonText}>{cancelText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: isSuccess ? "#22c55e" : "#ef4444" },
                ]}
                onPress={onConfirm}
              >
                <Text style={styles.buttonText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.button,
                styles.singleButton,
                { backgroundColor: isSuccess ? "#22c55e" : "#ef4444" },
              ]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>{confirmText}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  box: {
    width: "85%",
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    color: "#e5e7eb",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  singleButton: {
    marginTop: 6,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  cancelButton: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  cancelButtonText: {
    color: "#e5e7eb",
    fontWeight: "700",
    fontSize: 15,
  },
});
