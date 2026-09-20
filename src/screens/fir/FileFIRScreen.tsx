// CrimeSphere AI — FileFIRScreen
// Full FIR Registration form. On submit, creates a new Case in caseStore
// and shows a professional success modal before navigating to Case Files.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { AppHeader } from '../../components/layout/AppHeader';
import { ScreenScrollView } from '../../components/layout/ScreenScrollView';
import { useCaseStore } from '../../store/caseStore';
import { useAuthStore } from '../../store/authStore';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { DrawerParamList } from '../../types/navigation';
import type { CaseCategory, Priority } from '../../types';
import { apiErrorMessage } from '../../api/errors';

type Props = {
  navigation: DrawerNavigationProp<DrawerParamList, 'FileFIR'>;
};

const CATEGORIES: { label: string; value: CaseCategory }[] = [
  { label: 'Cyber', value: 'cyber' },
  { label: 'Property', value: 'property' },
  { label: 'Assault', value: 'assault' },
  { label: 'Vehicle', value: 'vehicle' },
  { label: 'Other', value: 'other' },
];

const PRIORITIES: { label: string; value: Priority; color: string }[] = [
  { label: 'Urgent', value: 'urgent', color: Colors.red },
  { label: 'Review', value: 'review', color: Colors.amber },
  { label: 'Routine', value: 'routine', color: '#22c55e' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Professional Success Modal ──────────────────────────────────────────────
interface SuccessModalProps {
  visible: boolean;
  firNumber: string;
  onViewCases: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ visible, firNumber, onViewCases }) => {
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      {/* Backdrop */}
      <View style={modal.backdrop}>
        {/* Card */}
        <View style={modal.card}>
          {/* Top accent bar */}
          <View style={modal.accentBar} />

          {/* Icon circle */}
          <View style={modal.iconCircle}>
            <Text style={modal.iconText}>✓</Text>
          </View>

          {/* Texts */}
          <Text style={modal.headline}>FIR Registered</Text>
          <Text style={modal.subtitle}>
            First Information Report has been{'\n'}successfully registered in CrimeSphere.
          </Text>

          {/* FIR number badge */}
          <View style={modal.firBadge}>
            <Text style={modal.firLabel}>FIR NUMBER</Text>
            <Text style={modal.firNumber}>{firNumber}</Text>
          </View>

          {/* Meta row */}
          <View style={modal.metaRow}>
            <View style={modal.metaItem}>
              <Text style={modal.metaLabel}>Status</Text>
              <View style={modal.statusPill}>
                <View style={modal.statusDot} />
                <Text style={modal.statusText}>Open</Text>
              </View>
            </View>
            <View style={modal.metaItem}>
              <Text style={modal.metaLabel}>Filed On</Text>
              <Text style={modal.metaValue}>{today()}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={modal.divider} />

          {/* Action button */}
          <Pressable
            style={({ pressed }) => [modal.viewBtn, pressed && modal.viewBtnPressed]}
            onPress={onViewCases}
          >
            <Text style={modal.viewBtnText}>View in Case Files →</Text>
          </Pressable>

          <Text style={modal.footNote}>
            The case has been added to the active case registry.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// ── Main Screen ─────────────────────────────────────────────────────────────
export const FileFIRScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { createCase } = useCaseStore();
  const { officer } = useAuthStore();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [complainant, setComplainant] = useState('');
  const [complainantPhone, setComplainantPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [sector, setSector] = useState('');
  const [category, setCategory] = useState<CaseCategory>('other');
  const [priority, setPriority] = useState<Priority>('routine');
  const [entities, setEntities] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Success modal state ────────────────────────────────────────────────────
  const [showSuccess, setShowSuccess] = useState(false);
  const [registeredFIR, setRegisteredFIR] = useState('');

  // ── Validate & Submit ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!complainant.trim()) { alert('Complainant name is required.'); return; }
    if (!title.trim()) { alert('Case title / offence is required.'); return; }
    if (!description.trim()) { alert('Description is required.'); return; }
    if (!location.trim()) { alert('Incident location is required.'); return; }

    setSubmitting(true);
    try {
      // The server assigns the FIR number and records which officer filed it
      const created = await createCase({
        title: title.trim(),
        description: description.trim(),
        complainant: complainant.trim(),
        complainantPhone: complainantPhone.trim() || undefined,
        category,
        priority,
        location: location.trim(),
        sector: sector.trim(),
        entities: entities.split(',').map((e) => e.trim()).filter(Boolean),
        officerName: officer?.name,
      });
      setRegisteredFIR(created.firNumber);
      setShowSuccess(true);
    } catch (e) {
      alert(apiErrorMessage(e, 'Could not register the FIR. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewCases = () => {
    setShowSuccess(false);
    navigation.navigate('CaseFiles');
  };

  return (
    <>
      <SuccessModal
        visible={showSuccess}
        firNumber={registeredFIR}
        onViewCases={handleViewCases}
      />

      <ScreenScrollView
        backgroundColor={Colors.paper}
        header={
          <AppHeader
            onMenuPress={() => navigation.openDrawer()}
            title="File a New FIR"
          />
        }
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Page heading ─────────────────────────────────────────────────── */}
        <View style={styles.pageHead}>
          <View style={styles.pageHeadLeft}>
            <Text style={styles.eyebrow}>KARNATAKA STATE POLICE · CRIME INTELLIGENCE PLATFORM</Text>
            <Text style={styles.heading}>Register New FIR</Text>
            <Text style={styles.subtitle}>
              Fill in all mandatory fields (*) to register a First Information Report.
              A unique FIR number will be auto-generated on submission.
            </Text>
          </View>
        </View>

        {/* ── Complainant ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤  Complainant Details</Text>
          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rajesh Kumar"
                placeholderTextColor={Colors.gray}
                value={complainant}
                onChangeText={setComplainant}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 9876543210"
                placeholderTextColor={Colors.gray}
                value={complainantPhone}
                onChangeText={setComplainantPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* ── Offence Details ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋  Offence Details</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Case Title / Offence *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Theft of mobile phone at Koramangala"
              placeholderTextColor={Colors.gray}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Describe the incident in detail — what happened, when, how, any witnesses..."
              placeholderTextColor={Colors.gray}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Incident Location *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Koramangala 5th Block"
                placeholderTextColor={Colors.gray}
                value={location}
                onChangeText={setLocation}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Sector / Sub-division</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sector 4"
                placeholderTextColor={Colors.gray}
                value={sector}
                onChangeText={setSector}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Suspects / Entities (comma-separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Doe, KA-05-AB-1234, Blue Honda Activa"
              placeholderTextColor={Colors.gray}
              value={entities}
              onChangeText={setEntities}
            />
          </View>
        </View>

        {/* ── Classification ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏷️  Classification</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.pillRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.value}
                  style={[styles.pill, category === c.value && styles.pillActive]}
                  onPress={() => setCategory(c.value)}
                >
                  <Text style={[styles.pillText, category === c.value && styles.pillTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Priority *</Text>
            <View style={styles.pillRow}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p.value}
                  style={[
                    styles.pill,
                    priority === p.value && {
                      ...styles.pillActive,
                      borderColor: p.color,
                      backgroundColor: p.color + '15',
                    },
                  ]}
                  onPress={() => setPriority(p.value)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      priority === p.value && { color: p.color, fontFamily: FontFamily.bodyMedium },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* ── Filing Officer ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎖️  Filing Officer</Text>
          <View style={styles.officerBadge}>
            <Text style={styles.officerName}>{officer?.name ?? 'Duty Officer'}</Text>
            <Text style={styles.officerMeta}>{officer?.rank} · {officer?.station}</Text>
            <Text style={styles.officerMeta}>Badge: {officer?.badgeNumber}</Text>
          </View>
        </View>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitText}>
              {submitting ? 'Registering...' : '✓  Register FIR'}
            </Text>
          </Pressable>
        </View>
      </ScreenScrollView>
    </>
  );
};

// ── Success Modal Styles ────────────────────────────────────────────────────
const modal = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 30, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 28,
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 40,
    elevation: 20,
  },
  accentBar: {
    width: '100%',
    height: 5,
    backgroundColor: Colors.inkNavy,
    marginBottom: 28,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  iconText: {
    fontSize: 30,
    color: '#fff',
    fontWeight: '700',
  },
  headline: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['3xl'],
    fontWeight: '600',
    color: Colors.inkNavy,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.base,
    color: Colors.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
  },
  firBadge: {
    width: '100%',
    backgroundColor: Colors.inkNavy,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  firLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  firNumber: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize['2xl'],
    color: '#FFFFFF',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 22,
    width: '100%',
  },
  metaItem: {
    alignItems: 'center',
    gap: 5,
  },
  metaLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.gray,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  statusText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: '#15803d',
  },
  metaValue: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.inkNavy,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.line,
    marginBottom: 20,
  },
  viewBtn: {
    width: '100%',
    backgroundColor: Colors.inkNavy,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  viewBtnPressed: {
    opacity: 0.85,
  },
  viewBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.md,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  footNote: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.gray,
    textAlign: 'center',
  },
});

// ── Form Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
  },
  pageHead: { marginBottom: 4 },
  pageHeadLeft: { flex: 1 },
  eyebrow: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.red,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heading: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['4xl'],
    fontWeight: '600',
    color: Colors.inkNavy,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.base,
    color: Colors.gray,
    marginTop: 6,
    lineHeight: 20,
  },
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 12,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.inkNavy,
    marginBottom: 2,
  },
  field: { gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1, gap: 6 },
  label: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.inkNavy,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FontFamily.body,
    fontSize: FontSize.base,
    color: Colors.inkNavy,
    backgroundColor: Colors.paper,
  },
  textarea: {
    height: 110,
    paddingTop: 10,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.paper,
  },
  pillActive: {
    borderColor: Colors.inkNavy,
    backgroundColor: Colors.inkNavy + '10',
  },
  pillText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.gray,
  },
  pillTextActive: {
    fontFamily: FontFamily.bodyMedium,
    color: Colors.inkNavy,
  },
  officerBadge: {
    backgroundColor: Colors.paperDim,
    borderRadius: 8,
    padding: 14,
    gap: 3,
  },
  officerName: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.md,
    color: Colors.inkNavy,
  },
  officerMeta: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.gray,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  cancelText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.md,
    color: Colors.gray,
  },
  submitBtn: {
    backgroundColor: Colors.inkNavy,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.md,
    color: Colors.white,
    letterSpacing: 0.3,
  },
});
