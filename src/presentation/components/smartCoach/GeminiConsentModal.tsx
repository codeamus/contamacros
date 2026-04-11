import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface GeminiConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Modal que solicita consentimiento para usar Google Gemini en Smart Coach
 * Solo se muestra una vez (guardado en AsyncStorage)
 *
 * IMPORTANTE: Este modal es REQUERIDO por Apple AppStore
 * - Guideline 5.1.1(i) - Privacy - Data Collection
 * - Guideline 5.1.2(i) - Privacy - Data Use
 */
export const GeminiConsentModal: React.FC<GeminiConsentModalProps> = ({
  visible,
  onAccept,
  onDecline,
}) => {
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { maxHeight: height * 0.9 }]}>
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            scrollEventThrottle={16}
          >
            {/* Header con icono */}
            <View style={styles.headerSection}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name="google"
                  size={32}
                  color="#4285F4"
                />
                <MaterialCommunityIcons
                  name="robot"
                  size={32}
                  color="#22C55E"
                  style={styles.robotIcon}
                />
              </View>
              <Text style={styles.title}>Google Gemini en Smart Coach</Text>
              <Text style={styles.subtitle}>
                Necesitamos tu permiso para usar IA
              </Text>
            </View>

            {/* Sección: Qué datos compartimos */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="information"
                  size={18}
                  color="#22C55E"
                />
                <Text style={styles.sectionTitle}>Datos que se compartirán</Text>
              </View>
              <Text style={styles.text}>
                Para ofrecerte recomendaciones personalizadas, Google Gemini verá:
              </Text>
              <View style={styles.listContainer}>
                <Text style={styles.listItem}>• Macros consumidos hoy (proteína, carbohidratos, grasa)</Text>
                <Text style={styles.listItem}>• Calorías totales del día</Text>
                <Text style={styles.listItem}>• Tu objetivo calórico</Text>
                <Text style={styles.listItem}>• Preferencias dietéticas (vegano, keto, sin gluten, etc.)</Text>
                <Text style={styles.listItem}>• Tus preguntas y solicitudes de recetas</Text>
              </View>
            </View>

            {/* Sección: Qué NO compartimos */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="shield-check"
                  size={18}
                  color="#10B981"
                />
                <Text style={styles.sectionTitle}>Datos que NO se compartirán</Text>
              </View>
              <View style={styles.listContainer}>
                <Text style={styles.listItem}>• Tu contraseña</Text>
                <Text style={styles.listItem}>• Números de identificación</Text>
                <Text style={styles.listItem}>• Información de pago</Text>
                <Text style={styles.listItem}>• Historial médico completo</Text>
              </View>
            </View>

            {/* Sección: Quién es Google Gemini */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="cloud"
                  size={18}
                  color="#1F2937"
                />
                <Text style={styles.sectionTitle}>Quien es Google Gemini</Text>
              </View>
              <Text style={styles.text}>
                Google Gemini es un servicio de inteligencia artificial de Google. Procesa tus datos de acuerdo con su Política de Privacidad de Google Cloud:
              </Text>
              <Text style={styles.link}>
                https://cloud.google.com/privacy
              </Text>
            </View>

            {/* Sección: Puedes cambiar de opinión */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="undo"
                  size={18}
                  color="#F59E0B"
                />
                <Text style={styles.sectionTitle}>Puedes cambiar de opinión</Text>
              </View>
              <Text style={styles.text}>
                Si cambias de idea, puedes revocar este consentimiento en cualquier momento desde:
              </Text>
              <Text style={styles.path}>
                Configuración → Privacidad → Gemini
              </Text>
            </View>

            {/* Disclaimer final */}
            <View style={styles.disclaimerSection}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={16}
                color="#EF4444"
                style={styles.disclaimerIcon}
              />
              <Text style={styles.disclaimer}>
                Al aceptar, confirmas que entiendes que Google Gemini procesará tus datos de salud y nutrición. Lee la política de privacidad de Google si tienes dudas.
              </Text>
            </View>
          </ScrollView>

          {/* Botones de acción */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.declineButton]}
              onPress={onDecline}
              activeOpacity={0.7}
            >
              <Text style={styles.declineButtonText}>Rechazar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={onAccept}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={18}
                color="#1B3A2F"
              />
              <Text style={styles.acceptButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1B3A2F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconContainer: {
    position: 'relative',
    width: 80,
    height: 64,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  robotIcon: {
    position: 'absolute',
    right: -4,
    bottom: -4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'Lora',
  },
  subtitle: {
    fontSize: 14,
    color: '#B3B3B3',
    textAlign: 'center',
    fontFamily: 'Work Sans',
  },
  section: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34, 197, 94, 0.15)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22C55E',
    fontFamily: 'Nunito',
  },
  text: {
    fontSize: 13,
    color: '#B3B3B3',
    lineHeight: 20,
    fontFamily: 'Work Sans',
    marginBottom: 8,
  },
  listContainer: {
    gap: 6,
    marginTop: 8,
  },
  listItem: {
    fontSize: 13,
    color: '#B3B3B3',
    lineHeight: 18,
    fontFamily: 'Work Sans',
    marginLeft: 4,
  },
  link: {
    fontSize: 12,
    color: '#22C55E',
    textDecorationLine: 'underline',
    fontFamily: 'Work Sans',
    marginTop: 8,
  },
  path: {
    fontSize: 12,
    color: '#F59E0B',
    fontFamily: 'Work Sans',
    fontWeight: '600',
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 6,
  },
  disclaimerSection: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    marginBottom: 24,
  },
  disclaimerIcon: {
    marginTop: 2,
  },
  disclaimer: {
    fontSize: 12,
    color: '#F9A825',
    lineHeight: 18,
    fontFamily: 'Work Sans',
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 197, 94, 0.15)',
    backgroundColor: '#1B3A2F',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  declineButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Nunito',
  },
  acceptButton: {
    backgroundColor: '#22C55E',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B3A2F',
    fontFamily: 'Nunito',
  },
});
