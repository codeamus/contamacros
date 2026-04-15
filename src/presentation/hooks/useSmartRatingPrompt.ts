import { useEffect, useState, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import {
  ratingPromptService,
  type RatingDecision,
} from '@/domain/services/ratingPromptService';

/**
 * useSmartRatingPrompt Hook
 *
 * Manages smart rating prompt lifecycle.
 * Automatically checks if prompt should be shown on mount,
 * handles user responses, and manages loading states.
 *
 * Documentation: /mnt/contamacros-web/smart-rating-prompt-DOCUMENTATION.md
 *
 * @param config - Configuration for the rating prompt
 * @param config.reason - Why we're showing the prompt (e.g., 'first_ai_scan', 'seven_day_streak')
 * @param config.onShow - Optional callback when modal appears
 * @param config.onDismiss - Optional callback when modal closes
 *
 * @example
 * const {
 *   isVisible,
 *   isLoading,
 *   handleRate,
 *   handleLater,
 *   handleNever,
 * } = useSmartRatingPrompt({
 *   reason: 'first_ai_scan',
 *   onShow: () => console.log('Rating prompt shown'),
 * });
 */

interface RatingPromptConfig {
  reason: string;
  onShow?: () => void;
  onDismiss?: () => void;
}

interface UseSmartRatingPromptReturn {
  isVisible: boolean;
  isLoading: boolean;
  showPrompt: () => Promise<void>;
  handleRate: () => Promise<void>;
  handleLater: () => Promise<void>;
  handleNever: () => Promise<void>;
}

export const useSmartRatingPrompt = (
  config: RatingPromptConfig
): UseSmartRatingPromptReturn => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Check if prompt should be shown and display it
   */
  const checkAndShowPrompt = useCallback(async () => {
    try {
      console.log('[Rating] 📊 checkAndShowPrompt() called');
      const shouldShow = await ratingPromptService.shouldShowPrompt();
      console.log('[Rating] 📊 shouldShow:', shouldShow);
      if (shouldShow) {
        console.log('[Rating] 📊 Showing rating prompt!');
        setIsVisible(true);
        await ratingPromptService.recordPromptShown(config.reason);
        config.onShow?.();
      } else {
        console.log('[Rating] 📊 Prompt should not be shown (cooldown or already shown)');
      }
    } catch (error) {
      console.error('[Rating] Error checking if should show prompt:', error);
    }
  }, [config]);

  /**
   * Auto-check and show prompt on mount
   */
  useEffect(() => {
    checkAndShowPrompt();
  }, [checkAndShowPrompt]);

  /**
   * Handle "Rate Now" action
   * Opens App Store / Play Store for user to leave a review
   */
  const handleRate = useCallback(async () => {
    setIsLoading(true);
    try {
      // Open App Store or Play Store
      const storeUrl = Platform.select({
        ios: 'https://apps.apple.com/app/contamacros-calor%C3%ADas-y-dieta/id6758101956?action=write-review',
        android: 'https://play.google.com/store/apps/details?id=com.codeamusdev2.contamacro',
      });

      if (storeUrl) {
        await Linking.openURL(storeUrl);
      }

      // Record successful rating
      await ratingPromptService.recordUserResponse('rated');
      setIsVisible(false);
      config.onDismiss?.();
    } catch (error) {
      console.error('[Rating] Error opening store:', error);
      // Graceful fallback - treat as "later"
      await ratingPromptService.recordUserResponse('later');
      setIsVisible(false);
      config.onDismiss?.();
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  /**
   * Handle "Ask Later" action
   * Will show prompt again in 30 days
   */
  const handleLater = useCallback(async () => {
    try {
      await ratingPromptService.recordUserResponse('later');
      setIsVisible(false);
      config.onDismiss?.();
    } catch (error) {
      console.error('[Rating] Error recording "later" response:', error);
      setIsVisible(false);
    }
  }, [config]);

  /**
   * Handle "Never Ask Again" action
   * Will never show prompt again in this app
   */
  const handleNever = useCallback(async () => {
    try {
      await ratingPromptService.recordUserResponse('never');
      setIsVisible(false);
      config.onDismiss?.();
    } catch (error) {
      console.error('[Rating] Error recording "never" response:', error);
      setIsVisible(false);
    }
  }, [config]);

  /**
   * Manually trigger prompt (useful for testing or manual triggers)
   */
  const showPrompt = useCallback(async () => {
    await checkAndShowPrompt();
  }, [checkAndShowPrompt]);

  return {
    isVisible,
    isLoading,
    showPrompt,
    handleRate,
    handleLater,
    handleNever,
  };
};
