import Skeleton from "@/presentation/components/ui/Skeleton";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type MiniStatProps = {
  title: string;
  value: string | null;
  unit: string;
  icon: React.ReactNode;
};

const miniStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  row: { flexDirection: "row" as const, alignItems: "center", gap: 10 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: { fontSize: 13 },
  value: { fontSize: 18 },
});

export function MiniStat({ title, value, unit, icon }: MiniStatProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  return (
    <View
      style={[
        miniStyles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={miniStyles.row}>
        <View style={[miniStyles.iconWrap, { borderColor: colors.border }]}>
          {icon}
        </View>
        <Text
          style={[
            miniStyles.title,
            {
              color: colors.textSecondary,
              fontFamily: typography.body?.fontFamily,
            },
          ]}
        >
          {title}
        </Text>
      </View>

      {value === null ? (
        <Skeleton
          height={20}
          width="55%"
          radius={10}
          bg={colors.border}
          highlight={colors.border}
        />
      ) : (
        <Text
          style={[
            miniStyles.value,
            {
              color: colors.textPrimary,
              fontFamily: typography.subtitle?.fontFamily,
            },
          ]}
        >
          {value}{" "}
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.body?.fontFamily,
              fontSize: 12,
            }}
          >
            {unit}
          </Text>
        </Text>
      )}
    </View>
  );
}
