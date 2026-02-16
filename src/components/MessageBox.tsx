import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  type?: "success" | "error" | "info";
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
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isSuccess = type === "success";
  const isError = type === "error";
  const showConfirm = typeof onConfirm === "function";
  const statusColor = isSuccess ? colors.success : isError ? colors.danger : colors.accent;
  const overlayColor = mode === "light" ? "rgba(15,23,42,0.45)" : "rgba(0,0,0,0.65)";

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <View style={styles.box}>
          <Text style={[styles.title, { color: statusColor }]}>{title}</Text>

          <Text style={styles.message}>{message}</Text>

          {showConfirm ? (
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel || onClose}>
                <Text style={styles.cancelButtonText}>{cancelText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: statusColor }]}
                onPress={onConfirm}
              >
                <Text style={styles.buttonText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.singleButton, { backgroundColor: statusColor }]}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    box: {
      width: "85%",
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 10,
    },
    message: {
      fontSize: 15,
      color: colors.text,
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
      color: colors.onAccent,
      fontWeight: "800",
      fontSize: 16,
      textAlign: "center",
      includeFontPadding: false,
      textAlignVertical: "center",
    },
    cancelButton: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    cancelButtonText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 15,
    },
  });
