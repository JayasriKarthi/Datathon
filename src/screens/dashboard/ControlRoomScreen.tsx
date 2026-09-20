// CrimeSphere AI — ControlRoomScreen (Home Dashboard)
// Visionary layout:
//   Row 1: Live Feed (left 60%) | File a Case (right 40%)
//   Row 2: Case Summary line chart with filters
//   Row 3: 4 Stat cards inline
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  Image, Animated, RefreshControl,
} from 'react-native';
import { ScreenScrollView } from '../../components/layout/ScreenScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { AppHeader } from '../../components/layout/AppHeader';
import { CaseSummaryChart } from '../../components/charts/CaseSummaryChart';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../utils/rbac';
import { useCaseStore } from '../../store/caseStore';
import { statsApi } from '../../api/statsApi';
import { USE_MOCK } from '../../api/config';
import {
  MOCK_STATS,
  MOCK_COMMISSIONER_STATS,
  MOCK_LIVE_FEED,
} from '../../constants/mockData';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { DrawerParamList } from '../../types/navigation';
import type { TickerItem, StatCard } from '../../types';

type Props = {
  navigation: DrawerNavigationProp<DrawerParamList, 'ControlRoom'>;
};

// ── Severity helpers ──────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  red:   Colors.red,
  amber: Colors.amber,
  green: Colors.green,
  navy:  Colors.inkNavy,
};
const SEV_BG: Record<string, string> = {
  red:   Colors.redDim,
  amber: Colors.amberDim,
  green: Colors.greenDim,
  navy:  Colors.paperDim,
};
const STAT_ICON: Record<string, string> = {
  red:   '📂',
  amber: '📋',
  green: '🚔',
  navy:  '🔔',
};

// ── Live Feed Item ────────────────────────────────────────────────────────────
const FeedItem: React.FC<{ item: TickerItem; isLast: boolean; index: number }> = ({
  item, isLast, index,
}) => {
  const slideAnim = useRef(new Animated.Value(24)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(1)).current;
  const color = SEV_COLOR[item.severity] ?? Colors.gray;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 80),
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();

    if (item.severity === 'red') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotPulse, { toValue: 1.5, duration: 700, useNativeDriver: true }),
          Animated.timing(dotPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  return (
    <Animated.View
      style={[
        feedStyles.item,
        !isLast && feedStyles.itemBorder,
        { opacity: opacityAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      <Animated.View
        style={[
          feedStyles.dot,
          { backgroundColor: color, transform: [{ scale: dotPulse }] },
        ]}
      />
      <View style={feedStyles.body}>
        <View style={feedStyles.titleRow}>
          <Text style={[feedStyles.title, { color: Colors.inkNavy }]}>{item.title}</Text>
          <Text style={feedStyles.time}>{item.time}</Text>
        </View>
        <Text style={feedStyles.detail} numberOfLines={2}>{item.detail}</Text>
      </View>
    </Animated.View>
  );
};

const feedStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  body: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  title: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.md,
    flex: 1,
  },
  time: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.gray,
  },
  detail: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.base,
    color: Colors.gray,
    lineHeight: 17,
  },
});

// ── Stat Card ─────────────────────────────────────────────────────────────────
const DashStatCard: React.FC<{ stat: StatCard; index: number }> = ({ stat, index }) => {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);

  const color = SEV_COLOR[stat.color] ?? Colors.inkNavy;
  const bg    = SEV_BG[stat.color] ?? Colors.paperDim;
  const icon  = STAT_ICON[stat.color] ?? '📌';

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 70),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={[statStyles.wrapper, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        style={[
          statStyles.card,
          { borderTopColor: color, borderTopWidth: 3 },
          hovered && statStyles.cardHover,
        ]}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityLabel={`${stat.label}: ${stat.value}`}
      >
        {/* Top row */}
        <View style={statStyles.topRow}>
          <View style={[statStyles.iconBadge, { backgroundColor: color + '18' }]}>
            <Text style={statStyles.icon}>{icon}</Text>
          </View>
          <View style={[statStyles.trendDot, {
            backgroundColor: stat.trend === 'up' ? Colors.red + '20' : Colors.green + '20',
            borderColor:      stat.trend === 'up' ? Colors.red : Colors.green,
          }]}>
            <Text style={[statStyles.trendArrow, { color: stat.trend === 'up' ? Colors.red : Colors.green }]}>
              {stat.trend === 'up' ? '▲' : '▼'}
            </Text>
          </View>
        </View>

        {/* Value */}
        <Text style={[statStyles.value, { color }]}>{stat.value}</Text>

        {/* Label */}
        <Text style={statStyles.label}>{stat.label}</Text>

        {/* Delta */}
        <View style={[statStyles.deltaPill, { backgroundColor: bg }]}>
          <Text style={[statStyles.delta, { color }]}>{stat.delta}</Text>
        </View>

        {/* Accent bar */}
        <View style={[statStyles.accentBar, { backgroundColor: color, width: `${Math.min(100, (stat.value / 30) * 100)}%` }]} />
      </Pressable>
    </Animated.View>
  );
};

const statStyles = StyleSheet.create({
  wrapper: { flex: 1, minWidth: 130 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 10,
    padding: 16,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  cardHover: {
    shadowColor: Colors.inkNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 16 },
  trendDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendArrow: { fontSize: 9, fontWeight: '700' },
  value: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['4xl'],
    fontWeight: '700',
    lineHeight: 34,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.base,
    color: Colors.gray,
    lineHeight: 16,
  },
  deltaPill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  delta: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    borderRadius: 0,
    opacity: 0.5,
  },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export const ControlRoomScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { officer } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [bodyW, setBodyW] = useState(0);
  const [feedSearch, setFeedSearch] = useState('');

  const headerFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(16)).current;

  const isComm = officer?.role === 'commissioner';
  const canGenerateFIR = hasPermission(officer?.role, 'GENERATE_FIR');
  // Live counts from the backend (falls back to the mock cards offline or while loading).
  // Re-fetched whenever the case list changes, e.g. after a new FIR is registered.
  const caseCount = useCaseStore((s) => s.cases.length);
  const [liveStats, setLiveStats] = useState<StatCard[] | null>(null);
  useEffect(() => {
    if (USE_MOCK) return;
    let active = true;
    statsApi.getAll().then((s) => { if (active) setLiveStats(s); }).catch(() => {});
    return () => { active = false; };
  }, [caseCount, officer?.badgeNumber]);
  const statsList = isComm ? MOCK_COMMISSIONER_STATS : (liveStats ?? MOCK_STATS);

  // Responsive stat card sizing
  const cardCols = isComm ? (bodyW >= 600 ? 3 : bodyW >= 380 ? 2 : 1) : (bodyW >= 500 ? 2 : 1);
  const cardGap = 12;
  const cardBasis = bodyW > 0 ? (bodyW - 36 - cardGap * (cardCols - 1)) / cardCols : 130;

  const filteredFeed = feedSearch.trim()
    ? MOCK_LIVE_FEED.filter(
        (item) =>
          item.title.toLowerCase().includes(feedSearch.toLowerCase()) ||
          item.detail.toLowerCase().includes(feedSearch.toLowerCase())
      )
    : MOCK_LIVE_FEED;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      // useNativeDriver: false so RN Web layout can measure scroll height correctly
      Animated.spring(contentSlide, { toValue: 0, friction: 8, tension: 70, useNativeDriver: false }),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 900));
    setRefreshing(false);
  };

  const isWide = bodyW >= 700;

  return (
    <ScreenScrollView
      backgroundColor={Colors.paper}
      header={
        <AppHeader
          onMenuPress={() => navigation.openDrawer()}
          searchQuery={feedSearch}
          onSearchChange={setFeedSearch}
        />
      }
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
      showsVerticalScrollIndicator={true}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.red} />}
      onLayout={(e: any) => setBodyW(e.nativeEvent.layout.width)}
    >
        {/* ── Page head ─────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.pageHead,
            { opacity: headerFade, transform: [{ translateY: contentSlide }] },
          ]}
        >
          <View style={styles.pageHeadLeft}>
            <Text style={styles.eyebrow}>
              {isComm ? 'Commissioner Control Office · City Police HQ' : 'Control Room · Whitefield Sub-Division'}
            </Text>
            <Text style={styles.heading}>Good afternoon, {officer?.name || 'Officer'}.</Text>
            <Text style={styles.subtitle}>
              {isComm
                ? 'Executive overview across district police stations and crime intelligence.'
                : "Here's where things stand across the sub-division right now."}
            </Text>
          </View>
          <Image
            source={require('../../../assets/karnataka_police_logo.png')}
            style={styles.kspLogo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* ── Row 1: Live Feed + File a Case ──────────────────────── */}
        <Animated.View
          style={[
            styles.topRow,
            { flexDirection: isWide ? 'row' : 'column', transform: [{ translateY: contentSlide }] },
          ]}
        >
          {/* Live Feed ─────────────────────────────────────────────── */}
          <View style={[styles.card, styles.liveFeedCard, isWide && { flex: 3 }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <View style={styles.liveDot} />
                <Text style={styles.cardTitle}>Live Feed</Text>
              </View>
              <View style={styles.liveCountBadge}>
                <Text style={styles.liveCountText}>{MOCK_LIVE_FEED.length} updates</Text>
              </View>
            </View>

            <View style={styles.feedList}>
              {filteredFeed.map((item, i) => (
                <FeedItem
                  key={item.id}
                  item={item}
                  isLast={i === filteredFeed.length - 1}
                  index={i}
                />
              ))}
            </View>
          </View>

          {/* File a Case / Duty Action ───────────────────────────────── */}
          <View style={[styles.card, styles.fileCard, isWide && { flex: 2 }]}>
            <View style={styles.fileCardInner}>
              {/* Emblem */}
              <View style={styles.emblemWrapper}>
                <Image
                  source={require('../../../assets/karnataka_police_logo.png')}
                  style={styles.emblem}
                  resizeMode="contain"
                />
                <View style={styles.emblemGlow} />
              </View>

              {/* Content */}
              <View style={styles.fileCardContent}>
                <Text style={styles.fileCardEyebrow}>KARNATAKA STATE POLICE</Text>
                <Text style={styles.fileCardTitle}>{canGenerateFIR ? 'File a Case' : 'Field Operations'}</Text>
                <Text style={styles.fileCardDesc}>
                  {canGenerateFIR
                    ? 'Register a new FIR or add a complaint into the CrimeSphere system.'
                    : 'Record field evidence, capture statements, and update assigned duty tasks.'}
                </Text>

                <Pressable
                  onPress={() => navigation.navigate('FileFIR')}
                  style={({ pressed }) => [styles.fileBtn, pressed && styles.fileBtnPressed]}
                  accessibilityLabel={canGenerateFIR ? 'Start new FIR' : 'Field Operations'}
                >
                  <Text style={styles.fileBtnText}>
                    {canGenerateFIR ? '+ New FIR' : '📁 View Assigned Tasks'}
                  </Text>
                </Pressable>

                <View style={styles.fileQuickRow}>
                  <Pressable style={styles.fileQuickBtn} onPress={() => navigation.navigate('ComplaintLetters')}>
                    <Text style={styles.fileQuickText}>📋 Complaint list</Text>
                  </Pressable>
                  <Pressable style={styles.fileQuickBtn} onPress={() => navigation.navigate('DutyNotebook')}>
                    <Text style={styles.fileQuickText}>💬 Duty log</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Row 2: Case Summary Chart ────────────────────────────── */}
        <Animated.View
          style={[styles.card, styles.chartCard, { transform: [{ translateY: contentSlide }] }]}
        >
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Case Summary</Text>
              <Text style={styles.cardSubtitle}>
                No. of cases reported — filter by type, timing & region
              </Text>
            </View>
            <View style={[styles.liveCountBadge, { backgroundColor: Colors.paperDim }]}>
              <Text style={styles.liveCountText}>{isComm ? '142 total active' : '27 total open'}</Text>
            </View>
          </View>
          <CaseSummaryChart />
        </Animated.View>

        {/* ── Row 3: Stat cards (Commissioner 9 cards or Standard 4 cards) ──────── */}
        <Animated.View
          style={[
            styles.statRow,
            { transform: [{ translateY: contentSlide }] },
          ]}
        >
          {statsList.map((stat, i) => (
            <DashStatCard key={stat.id} stat={stat} index={i} />
          ))}
        </Animated.View>

        <View style={{ height: 32 }} />
    </ScreenScrollView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 16,
  },

  // Page head
  pageHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  pageHeadLeft: { flex: 1, paddingRight: 12 },
  eyebrow: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.red,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heading: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['4xl'],
    fontWeight: '600',
    color: Colors.inkNavy,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.mdPlus,
    color: Colors.gray,
    marginTop: 4,
    lineHeight: 20,
  },
  kspLogo: {
    width: 60,
    height: 60,
  },

  // Cards
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    fontWeight: '600',
    color: Colors.inkNavy,
  },
  cardSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.base,
    color: Colors.gray,
    marginTop: 3,
  },

  // Live dot
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.red,
  },
  liveCountBadge: {
    backgroundColor: Colors.paperDim,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  liveCountText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.gray,
  },

  // Top row
  topRow: {
    gap: 14,
  },
  liveFeedCard: { },
  feedList: { },

  // File a case card
  fileCard: {
    backgroundColor: Colors.inkNavy,
    borderColor: Colors.inkNavy2,
    minHeight: 200,
  },
  fileCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  emblemWrapper: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inkNavy2,
    paddingVertical: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  emblem: {
    width: 64,
    height: 64,
    zIndex: 2,
  },
  emblemGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.amber + '20',
    alignSelf: 'center',
  },
  fileCardContent: {
    flex: 1,
    padding: 18,
    gap: 8,
    justifyContent: 'center',
  },
  fileCardEyebrow: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.sidebarMuted,
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  fileCardTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['3xl'],
    fontWeight: '600',
    color: Colors.white,
  },
  fileCardDesc: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.base,
    color: Colors.sidebarMuted,
    lineHeight: 17,
  },
  fileBtn: {
    backgroundColor: Colors.amber,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  fileBtnPressed: {
    opacity: 0.8,
  },
  fileBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.md,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  fileQuickRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  fileQuickBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fileQuickText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.base,
    color: Colors.sidebarText,
  },

  // Chart card
  chartCard: {
    padding: 0,
  },
  chartInner: {
    padding: 18,
    paddingTop: 14,
  },

  // Stat row
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
