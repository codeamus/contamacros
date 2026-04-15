import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  Animated,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/presentation/theme/ThemeProvider';

/**
 * RatingPromptModal Component
 *
 * Non-intrusive modal for requesting app ratings.
 * Shows after positive user moments (first meal logged, 7-day streak, etc.)
 * Respects user choices and never asks again if they select "never".
 *
 * @example
 * <RatingPromptModal
 *   isVisible={isVisible}
 *   isLoading={isLoading}
 *   onRate={handleRate}
 *   onLater={handleLater}
 *   onNever={handleNever}
 * />
 */

interface RatingPromptModalProps {
  isVisible: boolean;
  isLoading: boolean;
  onRate: () => void;
  onLater: () => void;
  onNever: () => void;
}

export const RatingPromptModal: React.FC<RatingPromptModalProps> = ({
  isVisible,
  isLoading,
  onRate,
  onLater,
  onNever,
}) => {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  // Animación de entrada
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.3);
      opacityAnim.setValue(0);
    }
  }, [isVisible, scaleAnim, opacityAnim]);

  if (!isVisible) return null;

  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Play Store';

  const s = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    container: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      padding: 32,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 20,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: `${colors.brand}20`,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 12,
      fontFamily: typography.h2?.fontFamily,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 28,
      lineHeight: 20,
      fontFamily: typography.body?.fontFamily,
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 4,
      marginBottom: 32,
    },
    primaryButton: {
      backgroundColor: colors.brand,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 20,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onCta,
      fontFamily: typography.button?.fontFamily,
    },
    secondaryButton: {
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 20,
      marginBottom: 12,
      borderWidth: 1.5,
      borderColor: `${colors.textPrimary}20`,
      backgroundColor: `${colors.textPrimary}05`,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
      fontFamily: typography.subtitle?.fontFamily,
    },
    tertiaryButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    tertiaryButtonText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      fontFamily: typography.body?.fontFamily,
      textDecorationLine: 'underline',
    },
  });

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onLater}
    >
      <View style={s.overlay}>
        <Animated.View
          style={[
            s.container,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Icon Header */}
          <View style={s.iconContainer}>
            <MaterialCommunityIcons
              name="star"
              size={44}
              color={colors.brand}
            />
          </View>

          {/* Title */}
          <Text style={s.title}>¡Te encanta ContaMacros!</Text>

          {/* Subtitle */}
          <Text style={s.subtitle}>
            Tu opinión nos ayuda a mejorar y llegar a más personas que quieren
            cuidar su peso.
          </Text>

          {/* Stars Display */}
          <View style={s.starsContainer}>
            {[1, 2, 3, 4, 5].map((i) => (
              <MaterialCommunityIcons
                key={`star-${i}`}
                name="star"
                size={20}
                color={colors.brand}
              />
            ))}
          </View>

          {/* Primary Button - Rate Now */}
          <Pressable
            onPress={onRate}
            disabled={isLoading}
            style={({ pressed }) => [
              s.primaryButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.onCta} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="heart"
                  size={18}
                  color={colors.onCta}
                />
                <Text style={s.primaryButtonText}>
                  {`Calificar en ${storeName}`}
                </Text>
              </>
            )}
          </Pressable>

          {/* Secondary Button - Ask Later */}
          <Pressable
            onPress={onLater}
            disabled={isLoading}
            style={({ pressed }) => [
              s.secondaryButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={s.secondaryButtonText}>Recuérdame después</Text>
          </Pressable>

          {/* Tertiary Button - Never Ask */}
          <Pressable
            onPress={onNever}
            disabled={isLoading}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Text style={s.tertiaryButtonText}>No quiero calificar</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};
