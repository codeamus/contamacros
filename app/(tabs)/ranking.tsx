// app/(tabs)/ranking.tsx
import { GamificationService, getUserRank, type LeaderboardEntry } from "@/domain/services/gamificationService";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RankingScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { user } = useAuth();
  const s = makeStyles(colors, typography);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userPosition, setUserPosition] = useState<{ position: number; entry: LeaderboardEntry | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    const [leaderboardResult, positionResult] = await Promise.all([
      GamificationService.getLeaderboard(10),
      GamificationService.getUserRankingPosition(),
    ]);

    if (leaderboardResult.ok) {
      setLeaderboard(leaderboardResult.data);
    }
    if (positionResult.ok) {
      setUserPosition(positionResult.data);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [loadLeaderboard]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  }, [loadLeaderboard]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "trophy";
    if (rank === 2) return "trophy-outline";
    if (rank === 3) return "medal";
    return "numeric-" + rank + "-circle";
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "#FFD700"; // Gold
    if (rank === 2) return "#C0C0C0"; // Silver
    if (rank === 3) return "#CD7F32"; // Bronze
    return colors.textSecondary;
  };

  // Separar top 3 del resto
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <MaterialCommunityIcons
            name="podium"
            size={36}
            color={colors.brand}
          />
          <Text style={s.title}>Ranking de la Comunidad</Text>
          <Text style={s.subtitle}>
            Los mejores usuarios por experiencia
          </Text>
        </View>

        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={s.loadingText}>Cargando ranking...</Text>
          </View>
        ) : leaderboard.length === 0 ? (
          <View style={s.emptyContainer}>
            <MaterialCommunityIcons
              name="podium-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={s.emptyText}>Aún no hay usuarios en el ranking</Text>
          </View>
        ) : (
          <>
            {/* Podio Top 3 */}
            {top3.length > 0 && (
              <View style={s.podiumContainer}>
                {/* 2do lugar (izquierda) */}
                {top3[1] && (
                  <View style={[s.podiumItem, s.podiumSecond]}>
                    <View style={s.podiumRank}>
                      <MaterialCommunityIcons
                        name="trophy-outline"
                        size={32}
                        color="#C0C0C0"
                      />
                      <Text style={[s.podiumRankText, { color: "#C0C0C0" }]}>
                        #2
                      </Text>
                    </View>
                    {top3[1].is_premium && (
                      <View style={s.premiumBadge}>
                        <MaterialCommunityIcons
                          name="crown"
                          size={16}
                          color="#FFD700"
                        />
                      </View>
                    )}
                    <View style={s.podiumAvatar}>
                      <MaterialCommunityIcons
                        name="account-circle"
                        size={48}
                        color={colors.brand}
                      />
                    </View>
                    <Text style={s.podiumName} numberOfLines={1}>
                      {top3[1].full_name || top3[1].email.split("@")[0] || "Usuario"}
                    </Text>
                    <Text style={s.podiumXP}>{top3[1].xp_points} XP</Text>
                    <Text style={s.podiumRankBadge}>
                      {getUserRank(top3[1].xp_points).emoji}{" "}
                      {getUserRank(top3[1].xp_points).name}
                    </Text>
                  </View>
                )}

                {/* 1er lugar (centro, más grande) */}
                {top3[0] && (
                  <View style={[s.podiumItem, s.podiumFirst]}>
                    <View style={s.podiumCrown}>
                      <MaterialCommunityIcons
                        name="trophy"
                        size={40}
                        color="#FFD700"
                      />
                    </View>
                    {top3[0].is_premium && (
                      <View style={s.premiumBadgeLarge}>
                        <MaterialCommunityIcons
                          name="crown"
                          size={20}
                          color="#FFD700"
                        />
                      </View>
                    )}
                    <View style={s.podiumAvatarLarge}>
                      <MaterialCommunityIcons
                        name="account-circle"
                        size={64}
                        color={colors.brand}
                      />
                    </View>
                    <Text style={s.podiumNameLarge} numberOfLines={1}>
                      {top3[0].full_name || top3[0].email.split("@")[0] || "Usuario"}
                    </Text>
                    <Text style={s.podiumXPLarge}>{top3[0].xp_points} XP</Text>
                    <Text style={s.podiumRankBadgeLarge}>
                      {getUserRank(top3[0].xp_points).emoji}{" "}
                      {getUserRank(top3[0].xp_points).name}
                    </Text>
                  </View>
                )}

                {/* 3er lugar (derecha) */}
                {top3[2] && (
                  <View style={[s.podiumItem, s.podiumThird]}>
                    <View style={s.podiumRank}>
                      <MaterialCommunityIcons
                        name="medal"
                        size={32}
                        color="#CD7F32"
                      />
                      <Text style={[s.podiumRankText, { color: "#CD7F32" }]}>
                        #3
                      </Text>
                    </View>
                    {top3[2].is_premium && (
                      <View style={s.premiumBadge}>
                        <MaterialCommunityIcons
                          name="crown"
                          size={16}
                          color="#FFD700"
                        />
                      </View>
                    )}
                    <View style={s.podiumAvatar}>
                      <MaterialCommunityIcons
                        name="account-circle"
                        size={48}
                        color={colors.brand}
                      />
                    </View>
                    <Text style={s.podiumName} numberOfLines={1}>
                      {top3[2].full_name || top3[2].email.split("@")[0] || "Usuario"}
                    </Text>
                    <Text style={s.podiumXP}>{top3[2].xp_points} XP</Text>
                    <Text style={s.podiumRankBadge}>
                      {getUserRank(top3[2].xp_points).emoji}{" "}
                      {getUserRank(top3[2].xp_points).name}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Resto del ranking (4-10) */}
            {rest.length > 0 && (
              <View style={s.restContainer}>
                <Text style={s.restTitle}>Resto del Top 10</Text>
                <View style={s.listContainer}>
                  {rest.map((entry) => (
                    <View key={entry.user_id} style={s.entryWrapper}>
                      {entry.is_premium ? (
                        <LinearGradient
                          colors={["#FFD70020", "#FFD70010", "transparent"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={s.premiumGradient}
                        >
                          <View style={[s.entryCard, s.entryCardPremium]}>
                            <View style={s.rankContainer}>
                              <MaterialCommunityIcons
                                name={getRankIcon(entry.rank) as any}
                                size={24}
                                color={colors.textSecondary}
                              />
                              <Text style={s.rankText}>#{entry.rank}</Text>
                            </View>
                            <View style={s.userInfo}>
                              <View style={s.avatar}>
                                <MaterialCommunityIcons
                                  name="account-circle"
                                  size={32}
                                  color={colors.brand}
                                />
                              </View>
                              <View style={s.userDetails}>
                                <View style={s.userNameRow}>
                                  <Text style={s.userName} numberOfLines={1}>
                                    {entry.full_name || entry.email.split("@")[0] || "Usuario"}
                                  </Text>
                                  <MaterialCommunityIcons
                                    name="crown"
                                    size={16}
                                    color="#FFD700"
                                  />
                                </View>
                                <Text style={s.userRank}>
                                  {getUserRank(entry.xp_points).emoji}{" "}
                                  {getUserRank(entry.xp_points).name}
                                </Text>
                              </View>
                            </View>
                            <View style={s.statsContainer}>
                              <Text style={s.statValue}>{entry.xp_points}</Text>
                              <Text style={s.statLabel}>XP</Text>
                            </View>
                          </View>
                        </LinearGradient>
                      ) : (
                        <View style={s.entryCard}>
                          <View style={s.rankContainer}>
                            <MaterialCommunityIcons
                              name={getRankIcon(entry.rank) as any}
                              size={24}
                              color={colors.textSecondary}
                            />
                            <Text style={s.rankText}>#{entry.rank}</Text>
                          </View>
                          <View style={s.userInfo}>
                            <View style={s.avatar}>
                              <MaterialCommunityIcons
                                name="account-circle"
                                size={32}
                                color={colors.brand}
                              />
                            </View>
                            <View style={s.userDetails}>
                              <Text style={s.userName} numberOfLines={1}>
                                {entry.full_name || entry.email.split("@")[0] || "Usuario"}
                              </Text>
                              <Text style={s.userRank}>
                                {getUserRank(entry.xp_points).emoji}{" "}
                                {getUserRank(entry.xp_points).name}
                              </Text>
                            </View>
                          </View>
                          <View style={s.statsContainer}>
                            <Text style={s.statValue}>{entry.xp_points}</Text>
                            <Text style={s.statLabel}>XP</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Sticky Bar con posición del usuario */}
      {userPosition && userPosition.entry && (
        <View style={s.stickyBar}>
          <View style={s.stickyContent}>
            <View style={s.stickyLeft}>
              <MaterialCommunityIcons
                name="account-circle"
                size={32}
                color={colors.brand}
              />
              <View style={s.stickyInfo}>
                <Text style={s.stickyName} numberOfLines={1}>
                  {userPosition.entry.full_name || userPosition.entry.email.split("@")[0] || "Tú"}
                </Text>
                <Text style={s.stickyRank}>
                  {getUserRank(userPosition.entry.xp_points).emoji}{" "}
                  {getUserRank(userPosition.entry.xp_points).name}
                </Text>
              </View>
            </View>
            <View style={s.stickyRight}>
              <View style={s.stickyPosition}>
                <Text style={s.stickyPositionLabel}>Posición</Text>
                <Text style={s.stickyPositionValue}>
                  #{userPosition.position}
                </Text>
              </View>
              <View style={s.stickyXP}>
                <Text style={s.stickyXPLabel}>XP</Text>
                <Text style={s.stickyXPValue}>
                  {userPosition.entry.xp_points}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 18,
      paddingBottom: 100, // Espacio para sticky bar
    },
    header: {
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      ...typography.h1,
      fontSize: 26,
      fontWeight: "900",
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 4,
    },
    subtitle: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    loadingContainer: {
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      gap: 12,
    },
    loadingText: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      gap: 12,
    },
    emptyText: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    // Podio
    podiumContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 8,
      marginBottom: 32,
      paddingHorizontal: 8,
    },
    podiumItem: {
      alignItems: "center",
      padding: 16,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 2,
      minWidth: 100,
    },
    podiumFirst: {
      borderColor: "#FFD700",
      backgroundColor: colors.surface,
      transform: [{ scale: 1.15 }],
      zIndex: 10,
      marginHorizontal: 4,
    },
    podiumSecond: {
      borderColor: "#C0C0C0",
      flex: 1,
    },
    podiumThird: {
      borderColor: "#CD7F32",
      flex: 1,
    },
    podiumRank: {
      alignItems: "center",
      marginBottom: 8,
    },
    podiumRankText: {
      ...typography.subtitle,
      fontSize: 14,
      fontWeight: "800",
      marginTop: 4,
    },
    podiumCrown: {
      marginBottom: 8,
    },
    premiumBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#FFD700",
      alignItems: "center",
      justifyContent: "center",
    },
    premiumBadgeLarge: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#FFD700",
      alignItems: "center",
      justifyContent: "center",
    },
    podiumAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.brand + "15",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    podiumAvatarLarge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.brand + "15",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    podiumName: {
      ...typography.subtitle,
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 4,
    },
    podiumNameLarge: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 6,
    },
    podiumXP: {
      ...typography.h3,
      fontSize: 16,
      fontWeight: "800",
      color: colors.brand,
      marginBottom: 4,
    },
    podiumXPLarge: {
      ...typography.h2,
      fontSize: 20,
      fontWeight: "900",
      color: colors.brand,
      marginBottom: 6,
    },
    podiumRankBadge: {
      ...typography.caption,
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    podiumRankBadgeLarge: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    // Resto del ranking
    restContainer: {
      marginTop: 8,
    },
    restTitle: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 16,
    },
    listContainer: {
      gap: 10,
    },
    entryWrapper: {
      borderRadius: 16,
      overflow: "hidden",
    },
    premiumGradient: {
      borderRadius: 16,
      borderWidth: 2,
      borderColor: "#FFD700",
    },
    entryCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    entryCardPremium: {
      borderColor: "#FFD700",
    },
    rankContainer: {
      alignItems: "center",
      minWidth: 50,
    },
    rankText: {
      ...typography.subtitle,
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
      marginTop: 2,
    },
    userInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.brand + "15",
      alignItems: "center",
      justifyContent: "center",
    },
    userDetails: {
      flex: 1,
    },
    userNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    userName: {
      ...typography.subtitle,
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    userRank: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statsContainer: {
      alignItems: "flex-end",
    },
    statValue: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "800",
      color: colors.brand,
    },
    statLabel: {
      ...typography.caption,
      fontSize: 10,
      color: colors.textSecondary,
    },
    // Sticky Bar
    stickyBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopWidth: 2,
      borderTopColor: colors.brand,
      paddingHorizontal: 18,
      paddingVertical: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    stickyContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    stickyLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    stickyInfo: {
      flex: 1,
    },
    stickyName: {
      ...typography.subtitle,
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    stickyRank: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    stickyRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 20,
    },
    stickyPosition: {
      alignItems: "center",
    },
    stickyPositionLabel: {
      ...typography.caption,
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    stickyPositionValue: {
      ...typography.h3,
      fontSize: 20,
      fontWeight: "900",
      color: colors.brand,
    },
    stickyXP: {
      alignItems: "center",
    },
    stickyXPLabel: {
      ...typography.caption,
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    stickyXPValue: {
      ...typography.h3,
      fontSize: 20,
      fontWeight: "900",
      color: colors.textPrimary,
    },
  });
}
