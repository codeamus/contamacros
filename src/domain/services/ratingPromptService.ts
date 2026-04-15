import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Smart Rating Prompt Service
 *
 * Manages non-invasive in-app rating prompts with intelligent state management.
 * Only shows prompts after positive user moments, respects user decisions,
 * and enforces cooldown periods to prevent spam.
 *
 * Documentation: /mnt/contamacros-web/smart-rating-prompt-DOCUMENTATION.md
 */

export type RatingDecision = 'rated' | 'later' | 'never' | null;

export interface RatingState {
  hasSeenPrompt: boolean;
  decision: RatingDecision;
  promptCount: number;
  firstPromptDate: string | null;
  nextPromptDate: string | null;
  lastTriggerReason: string | null;
}

const STORAGE_KEY = 'contamacros_rating_state';
const COOLDOWN_DAYS = 180; // 6 months between prompts
const MAX_PROMPT_COUNT = 3; // Ask max 3 times in app lifetime

export const ratingPromptService = {
  /**
   * Get current rating prompt state from storage
   */
  async getState(): Promise<RatingState> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return {
          hasSeenPrompt: false,
          decision: null,
          promptCount: 0,
          firstPromptDate: null,
          nextPromptDate: null,
          lastTriggerReason: null,
        };
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error('[RatingPrompt] Error reading state:', error);
      return {
        hasSeenPrompt: false,
        decision: null,
        promptCount: 0,
        firstPromptDate: null,
        nextPromptDate: null,
        lastTriggerReason: null,
      };
    }
  },

  /**
   * Save rating state to AsyncStorage
   */
  async setState(state: RatingState): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[RatingPrompt] Error saving state:', error);
    }
  },

  /**
   * Record that rating prompt was shown to user
   * Increments prompt count and sets next eligible date (6 months later)
   */
  async recordPromptShown(reason: string): Promise<void> {
    const state = await this.getState();
    const now = new Date().toISOString();

    state.hasSeenPrompt = true;
    state.promptCount += 1;
    state.lastTriggerReason = reason;

    // Only set first prompt date once
    if (!state.firstPromptDate) {
      state.firstPromptDate = now;
      // Set next prompt for 6 months later
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + COOLDOWN_DAYS);
      state.nextPromptDate = nextDate.toISOString();
    }

    await this.setState(state);
    console.log(`[RatingPrompt] Shown (reason: ${reason}, count: ${state.promptCount})`);
  },

  /**
   * Record user's response to rating prompt
   * - 'rated': User completed rating (don't ask again)
   * - 'later': Ask again in 30 days
   * - 'never': Never ask again (set far future date)
   */
  async recordUserResponse(decision: RatingDecision): Promise<void> {
    const state = await this.getState();
    state.decision = decision;

    if (decision === 'never') {
      // Never ask again - set nextPromptDate to 10 years in future
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 10);
      state.nextPromptDate = farFuture.toISOString();
      console.log('[RatingPrompt] User selected "never ask again"');
    } else if (decision === 'later') {
      // Ask again in 30 days
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      state.nextPromptDate = nextDate.toISOString();
      console.log('[RatingPrompt] User selected "ask later" - will prompt again in 30 days');
    } else if (decision === 'rated') {
      console.log('[RatingPrompt] User completed rating');
    }

    await this.setState(state);
  },

  /**
   * Check if rating prompt should be shown to user
   * Returns false if:
   * - User already rated
   * - User said "never"
   * - Max prompt count exceeded (3)
   * - Still in cooldown period
   */
  async shouldShowPrompt(): Promise<boolean> {
    const state = await this.getState();

    // Already rated
    if (state.decision === 'rated') {
      console.log('[RatingPrompt] Skipping - user already rated');
      return false;
    }

    // User said "never"
    if (state.decision === 'never') {
      console.log('[RatingPrompt] Skipping - user opted out permanently');
      return false;
    }

    // Exceeded max prompts
    if (state.promptCount >= MAX_PROMPT_COUNT) {
      console.log('[RatingPrompt] Skipping - max prompt count reached');
      return false;
    }

    // Still in cooldown period
    if (state.nextPromptDate) {
      const nextDate = new Date(state.nextPromptDate);
      if (new Date() < nextDate) {
        console.log('[RatingPrompt] Skipping - in cooldown until', nextDate);
        return false;
      }
    }

    return true;
  },

  /**
   * Reset all rating prompt state (for testing only)
   */
  async reset(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('[RatingPrompt] State reset (testing only)');
    } catch (error) {
      console.error('[RatingPrompt] Error resetting state:', error);
    }
  },

  /**
   * Get debug information about current state
   */
  async getDebugInfo(): Promise<string> {
    const state = await this.getState();
    return JSON.stringify(state, null, 2);
  },
};
