// CrimeSphere AI - DigitalNotebookScreen
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, SafeAreaView, Modal, Animated,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../../types/navigation';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { MOCK_CASES } from '../../constants/mockData';
import { copilotApi } from '../../api/copilotApi';
import { apiErrorMessage } from '../../api/errors';
import type { ChatMessage } from '../../types';
import { Mission, NotebookTask } from '../../components/notebook/NotebookComponents';

type Nav = DrawerNavigationProp<DrawerParamList, 'DutyNotebook'>;

interface SavedNote { id: string; text: string; tags: string[]; timestamp: Date; }

const INITIAL_TASKS: (NotebookTask & { caseId?: string })[] = [
  { id: '1', title: 'Analyse CCTV footage from MG Road Camera 04', category: 'CCTV',      status: 'TODO',  caseId: 'KA-CR-1142' },
  { id: '2', title: 'Verify suspect vehicle registration logs',      category: 'ANPR',      status: 'DOING', caseId: 'KA-CR-1156' },
  { id: '3', title: 'Cross-match CDR against FIR timeline',          category: 'CDR',       status: 'DOING', caseId: 'KA-CR-1149' },
  { id: '4', title: 'Secure Whitefield safehouse operational logs',   category: 'Intel',     status: 'DONE',  caseId: 'KA-CR-1138' },
  { id: '5', title: 'File forensics request for mobile exhibit',      category: 'Forensics', status: 'TODO',  caseId: 'KA-CR-1142' },
];
const INIT_MISSIONS: Mission[] = [
  { id: 'M1', title: 'Identify primary safehouse location',   target: 'John Doe associates',        priority: 'URGENT' },
  { id: 'M2', title: 'Audit suspicious transaction pathways', target: 'Bank Account HDFC ****3321', priority: 'HIGH'   },
];
const AI_INSIGHTS = [
  'High priority: Vehicle KA-03-XY-9876 spotted near CCTV blind-spot on MG Road between 22:00-23:30.',
  'Action needed: +91-9876543210 linked to Whitefield tower ping within 10 min of assault timeline.',
  'Pattern flagged: 3 linked FIRs share same vehicle type and victim profile.',
];
const ALL_TAGS = ['#Suspect','#Vehicle','#CCTV','#CDR','#Witness','#Evidence','#FIR','#Timeline'];
const COL_CONFIG = [
  { key: 'TODO',  label: 'Backlog',      color: '#5B7FA6', bg: '#EEF0F4' },
  { key: 'DOING', label: 'In Progress',  color: '#C08B2C', bg: '#FDF8EE' },
  { key: 'DONE',  label: 'Resolved',    color: '#2E7D52', bg: '#EDF3EE' },
] as const;
type Status = 'TODO' | 'DOING' | 'DONE';
const CAT_COLORS: Record<string,string> = { CCTV:'#5B7FA6', ANPR:'#C08B2C', CDR:'#7B5EA7', Intel:'#1A2C4E', Forensics:'#2E7D52' };
const TOP_ROW_H = 220;

// AI Popup
const AICopilotPopup: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const [chatInput, setChatInput] = useState('');
  const [msgs, setMsgs] = useState(AI_INSIGHTS);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const slideAnim = useRef(new Animated.Value(420)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim,   { toValue: visible ? 0 : 420, friction: 9, tension: 80, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: visible ? 1 : 0,   duration: 220,            useNativeDriver: false }),
    ]).start();
  }, [visible]);
  const sendAI = async () => {
    const q = chatInput.trim();
    if (!q || thinking) return;
    setChatInput('');
    setThinking(true);
    const stamp = () => ({ time: new Date().toLocaleTimeString(), timestamp: new Date().toISOString() });
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: q, ...stamp() };
    try {
      // Backend: Strands agent on Amazon Bedrock, reading real cases/alerts from DynamoDB
      const reply = await copilotApi.sendMessage(q, history);
      const aiMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'copilot', content: reply, ...stamp() };
      setHistory(h => [...h, userMsg, aiMsg]);
      setMsgs(m => [...m, `Q: ${q}\n\n${reply}`]);
    } catch (e) {
      setMsgs(m => [...m, `Q: ${q}\n\n${apiErrorMessage(e, 'The copilot is unavailable right now.')}`]);
    } finally {
      setThinking(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };
  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[aiSt.backdrop, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[aiSt.panel, { transform: [{ translateY: slideAnim }] }]}>
        <View style={aiSt.header}>
          <View style={aiSt.headerLeft}>
            <View style={aiSt.iconBadge}><Text style={aiSt.iconText}>AI</Text></View>
            <View><Text style={aiSt.title}>AI Copilot</Text><Text style={aiSt.subtitle}>CrimeSphere Intelligence Engine</Text></View>
          </View>
          <TouchableOpacity style={aiSt.closeBtn} onPress={onClose}><Text style={aiSt.closeBtnText}>x</Text></TouchableOpacity>
        </View>
        <View style={aiSt.statusBar}><View style={aiSt.statusDot} /><Text style={aiSt.statusText}>{thinking ? 'Analysing case data…' : `Active - ${msgs.length} correlations`}</Text></View>
        <ScrollView ref={scrollRef} style={aiSt.scroll} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          {msgs.map((msg, i) => (
            <View key={i} style={aiSt.bubble}><Text style={aiSt.bubbleLabel}>AI Analysis</Text><Text style={aiSt.bubbleText}>{msg}</Text></View>
          ))}
        </ScrollView>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={aiSt.inputRow}>
            <TextInput style={aiSt.input} placeholder="Ask AI Copilot..." placeholderTextColor={Colors.gray} value={chatInput} onChangeText={setChatInput} onSubmitEditing={sendAI} returnKeyType="send" />
            <TouchableOpacity style={aiSt.sendBtn} onPress={sendAI}><Text style={aiSt.sendBtnText}>ASK</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
};
const aiSt = StyleSheet.create({
  backdrop: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(10,20,40,0.4)' },
  panel: { position:'absolute', bottom:90, right:24, width:380, maxHeight:500, backgroundColor:Colors.card, borderRadius:16, borderWidth:1, borderColor:Colors.line, shadowColor:Colors.inkNavy, shadowOffset:{width:0,height:10}, shadowOpacity:0.2, shadowRadius:24, elevation:20, overflow:'hidden' },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:Colors.inkNavy, paddingHorizontal:18, paddingVertical:14 },
  headerLeft: { flexDirection:'row', alignItems:'center', gap:12 },
  iconBadge: { width:36, height:36, borderRadius:10, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' },
  iconText: { fontSize:12, color:Colors.white, fontWeight:'700' },
  title: { fontFamily:FontFamily.displayBold, fontSize:FontSize.lg, color:Colors.white },
  subtitle: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.sidebarMuted, marginTop:1 },
  closeBtn: { width:28, height:28, borderRadius:14, backgroundColor:'rgba(255,255,255,0.1)', alignItems:'center', justifyContent:'center' },
  closeBtnText: { color:Colors.sidebarText, fontSize:14, fontWeight:'600' },
  statusBar: { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:18, paddingVertical:8, backgroundColor:Colors.paperDim, borderBottomWidth:1, borderBottomColor:Colors.line },
  statusDot: { width:7, height:7, borderRadius:3.5, backgroundColor:Colors.green },
  statusText: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.gray },
  scroll: { maxHeight:280 },
  bubble: { borderLeftWidth:3, borderLeftColor:Colors.inkNavy, marginHorizontal:16, marginTop:12, paddingLeft:12, paddingVertical:6, backgroundColor:Colors.paper, borderRadius:6 },
  bubbleLabel: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.steel, fontWeight:'700', marginBottom:3 },
  bubbleText: { fontFamily:FontFamily.body, fontSize:FontSize.sm, color:Colors.inkNavy2, lineHeight:19 },
  inputRow: { flexDirection:'row', gap:10, padding:14, borderTopWidth:1, borderTopColor:Colors.line, backgroundColor:Colors.card },
  input: { flex:1, height:40, backgroundColor:Colors.paper, borderRadius:8, paddingHorizontal:12, fontFamily:FontFamily.body, fontSize:FontSize.md, color:Colors.inkNavy, borderWidth:1, borderColor:Colors.line },
  sendBtn: { backgroundColor:Colors.inkNavy, paddingHorizontal:16, justifyContent:'center', borderRadius:8 },
  sendBtnText: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.white, fontWeight:'700', letterSpacing:0.8 },
});

// Floating AI Btn
const FloatingAIBtn: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue:1.1, duration:900, useNativeDriver:false }),
      Animated.timing(pulse, { toValue:1,   duration:900, useNativeDriver:false }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[fabSt.wrap, { transform:[{ scale:pulse }] }]}>
      <TouchableOpacity style={fabSt.btn} onPress={onPress} activeOpacity={0.85}>
        <Text style={fabSt.icon}>AI</Text>
        <View style={fabSt.badge}><Text style={fabSt.badgeText}>3</Text></View>
      </TouchableOpacity>
      <Text style={fabSt.label}>AI Copilot</Text>
    </Animated.View>
  );
};
const fabSt = StyleSheet.create({
  wrap: { position:'absolute', bottom:24, right:24, alignItems:'center', zIndex:100 },
  btn: { width:54, height:54, borderRadius:27, backgroundColor:Colors.inkNavy, alignItems:'center', justifyContent:'center', shadowColor:Colors.inkNavy, shadowOffset:{width:0,height:6}, shadowOpacity:0.35, shadowRadius:12, elevation:12, borderWidth:2, borderColor:Colors.steel },
  icon: { fontSize:14, color:Colors.white, fontWeight:'700' },
  badge: { position:'absolute', top:-2, right:-2, width:18, height:18, borderRadius:9, backgroundColor:Colors.red, alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:Colors.card },
  badgeText: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.white, fontWeight:'700' },
  label: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.inkNavy, marginTop:4, fontWeight:'600' },
});

// Mission Card
const MissionCardLocal: React.FC<{ mission: Mission }> = ({ mission }) => {
  const pc = mission.priority==='URGENT' ? Colors.red : mission.priority==='HIGH' ? Colors.amber : Colors.green;
  const pb = mission.priority==='URGENT' ? Colors.redDim : mission.priority==='HIGH' ? Colors.amberDim : Colors.greenDim;
  return (
    <View style={mSt.card}>
      <View style={[mSt.stripe, { backgroundColor:pc }]} />
      <View style={mSt.body}>
        <View style={[mSt.badge, { backgroundColor:pb, borderColor:pc+'60' }]}><Text style={[mSt.badgeText,{color:pc}]}>{mission.priority}</Text></View>
        <Text style={mSt.title}>{mission.title}</Text>
        <Text style={mSt.target}>Target: {mission.target}</Text>
      </View>
    </View>
  );
};
const mSt = StyleSheet.create({
  card: { flexDirection:'row', backgroundColor:Colors.card, borderRadius:8, borderWidth:1, borderColor:Colors.line, overflow:'hidden', marginBottom:8 },
  stripe: { width:3 },
  body: { flex:1, padding:10 },
  badge: { alignSelf:'flex-start', paddingHorizontal:6, paddingVertical:2, borderRadius:4, borderWidth:1, marginBottom:4 },
  badgeText: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, fontWeight:'700', letterSpacing:0.5 },
  title: { fontFamily:FontFamily.bodyMedium, fontSize:FontSize.base, color:Colors.inkNavy, marginBottom:3 },
  target: { fontFamily:FontFamily.body, fontSize:FontSize.xs, color:Colors.gray },
});

// Kanban Card
interface KanbanCardProps { task: NotebookTask & { caseId?: string }; accentColor: string; status: Status; onMoveNext: () => void; onMovePrev: () => void; onNavigate: () => void; }
const KanbanCard: React.FC<KanbanCardProps> = ({ task, accentColor, status, onMoveNext, onMovePrev, onNavigate }) => {
  const catColor = CAT_COLORS[task.category] ?? '#888';
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[kSt.card, { transform:[{ scale }] }]}>
      <View style={[kSt.bar, { backgroundColor:accentColor }]} />
      <TouchableOpacity style={kSt.body} onPress={onNavigate}
        onPressIn={() => Animated.spring(scale,{toValue:0.97,useNativeDriver:false}).start()}
        onPressOut={() => Animated.spring(scale,{toValue:1,useNativeDriver:false}).start()} activeOpacity={1}>
        <View style={[kSt.catBadge, { backgroundColor:catColor+'18', borderColor:catColor+'55' }]}>
          <Text style={[kSt.catText, { color:catColor }]}>{task.category}</Text>
        </View>
        <Text style={kSt.title}>{task.title}</Text>
        {task.caseId ? <View style={kSt.caseRef}><Text style={kSt.caseRefIcon}>📂</Text><Text style={kSt.caseRefText}>FIR {task.caseId}</Text></View> : null}
      </TouchableOpacity>
      <View style={kSt.actions}>
        {status !== 'TODO' ? <TouchableOpacity style={kSt.backBtn} onPress={onMovePrev}><Text style={kSt.backBtnText}>← Back</Text></TouchableOpacity> : null}
        <View style={{ flex:1 }} />
        {status === 'TODO' ? <TouchableOpacity style={[kSt.nextBtn,{backgroundColor:accentColor}]} onPress={onMoveNext}><Text style={kSt.nextBtnText}>Start →</Text></TouchableOpacity>
         : status === 'DOING' ? <TouchableOpacity style={[kSt.nextBtn,{backgroundColor:accentColor}]} onPress={onMoveNext}><Text style={kSt.nextBtnText}>Resolve ✓</Text></TouchableOpacity>
         : <TouchableOpacity style={kSt.backBtn} onPress={onMovePrev}><Text style={kSt.backBtnText}>↩ Reopen</Text></TouchableOpacity>}
      </View>
    </Animated.View>
  );
};
const kSt = StyleSheet.create({
  card: { backgroundColor:Colors.card, borderRadius:9, borderWidth:1, borderColor:Colors.line, marginBottom:8, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:4, elevation:2 },
  bar: { height:3 },
  body: { padding:10 },
  catBadge: { alignSelf:'flex-start', borderRadius:4, borderWidth:1, paddingHorizontal:6, paddingVertical:2, marginBottom:6 },
  catText: { fontFamily:FontFamily.mono, fontSize:9, fontWeight:'700', letterSpacing:0.4 },
  title: { fontFamily:FontFamily.bodyMedium, fontSize:FontSize.sm, color:Colors.inkNavy, lineHeight:18, marginBottom:6 },
  caseRef: { flexDirection:'row', alignItems:'center', gap:4 },
  caseRefIcon: { fontSize:10 },
  caseRefText: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.gray, fontWeight:'600' },
  actions: { flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:6, borderTopWidth:1, borderTopColor:Colors.line, backgroundColor:Colors.paperDim, gap:6 },
  backBtn: { backgroundColor:Colors.paper, borderWidth:1, borderColor:Colors.line, borderRadius:5, paddingHorizontal:8, paddingVertical:4 },
  backBtnText: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.gray, fontWeight:'600' },
  nextBtn: { borderRadius:5, paddingHorizontal:8, paddingVertical:4 },
  nextBtnText: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.white, fontWeight:'700' },
});

// Saved Note Item — with inline Edit & Delete
const NoteItem: React.FC<{ note: SavedNote; onDelete:(id:string)=>void; onSaveEdit:(id:string,txt:string)=>void }> = ({ note, onDelete, onSaveEdit }) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const timeStr = note.timestamp.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  const dateStr = note.timestamp.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
  const save = () => { if (editText.trim()) onSaveEdit(note.id, editText.trim()); setEditing(false); };
  const cancel = () => { setEditText(note.text); setEditing(false); };
  return (
    <View style={niSt.card}>
      {note.tags.length > 0 ? (
        <View style={niSt.tagsRow}>
          {note.tags.map((tag,i) => <View key={i} style={niSt.tag}><Text style={niSt.tagText}>{tag}</Text></View>)}
        </View>
      ) : null}
      {editing
        ? <TextInput style={niSt.editInput} multiline value={editText} onChangeText={setEditText} autoFocus />
        : <Text style={niSt.noteText}>{note.text}</Text>}
      <View style={niSt.footer}>
        <Text style={niSt.timestamp}>📅 {dateStr} · {timeStr}</Text>
        <View style={niSt.btns}>
          {editing ? (
            <>
              <TouchableOpacity style={niSt.saveBtn} onPress={save}><Text style={niSt.saveTxt}>✓ Save</Text></TouchableOpacity>
              <TouchableOpacity style={niSt.cancelBtn} onPress={cancel}><Text style={niSt.cancelTxt}>Cancel</Text></TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={niSt.editBtn} onPress={() => setEditing(true)}><Text style={niSt.editTxt}>✏ Edit</Text></TouchableOpacity>
              <TouchableOpacity style={niSt.delBtn} onPress={() => onDelete(note.id)}><Text style={niSt.delTxt}>🗑 Del</Text></TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};
const niSt = StyleSheet.create({
  card: { backgroundColor:Colors.card, borderRadius:10, borderWidth:1, borderColor:Colors.line, padding:11, marginBottom:9 },
  tagsRow: { flexDirection:'row', flexWrap:'wrap', gap:4, marginBottom:7 },
  tag: { backgroundColor:Colors.inkNavy+'12', borderRadius:20, paddingHorizontal:7, paddingVertical:2, borderWidth:1, borderColor:Colors.inkNavy+'30' },
  tagText: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.inkNavy, fontWeight:'700' },
  noteText: { fontFamily:FontFamily.body, fontSize:FontSize.sm, color:Colors.inkNavy2, lineHeight:19, marginBottom:9 },
  editInput: { fontFamily:FontFamily.body, fontSize:FontSize.sm, color:Colors.inkNavy, lineHeight:19, borderWidth:1.5, borderColor:Colors.inkNavy+'50', borderRadius:7, padding:8, minHeight:64, textAlignVertical:'top', backgroundColor:Colors.paper, marginBottom:9 },
  footer: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderTopWidth:1, borderTopColor:Colors.line, paddingTop:7 },
  timestamp: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.gray },
  btns: { flexDirection:'row', gap:5 },
  editBtn: { backgroundColor:Colors.inkNavy+'10', borderRadius:5, paddingHorizontal:8, paddingVertical:4, borderWidth:1, borderColor:Colors.inkNavy+'25' },
  editTxt: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.inkNavy, fontWeight:'700' },
  delBtn: { backgroundColor:Colors.redDim, borderRadius:5, paddingHorizontal:8, paddingVertical:4, borderWidth:1, borderColor:Colors.red+'40' },
  delTxt: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.red, fontWeight:'700' },
  saveBtn: { backgroundColor:Colors.green, borderRadius:5, paddingHorizontal:8, paddingVertical:4 },
  saveTxt: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.white, fontWeight:'700' },
  cancelBtn: { backgroundColor:Colors.paper, borderRadius:5, paddingHorizontal:8, paddingVertical:4, borderWidth:1, borderColor:Colors.line },
  cancelTxt: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.gray, fontWeight:'700' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export const DigitalNotebookScreen = () => {
  const navigation = useNavigation<Nav>();
  const [tasks, setTasks]   = useState(INITIAL_TASKS);
  const [missions]          = useState(INIT_MISSIONS);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [draftText, setDraftText]     = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [savedNotes, setSavedNotes]   = useState<SavedNote[]>([]);

  const moveTask = (id: string, status: Status) =>
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status } : t));
  const todo  = tasks.filter(t => t.status === 'TODO');
  const doing = tasks.filter(t => t.status === 'DOING');
  const done  = tasks.filter(t => t.status === 'DONE');
  const cols  = [todo, doing, done];

  const navigateToCase = (caseId?: string) => {
    if (!caseId) return;
    const found = MOCK_CASES.find(c => c.id === caseId);
    if (found) navigation.navigate('CaseDetail', { caseId });
  };

  const resolvedPct = tasks.length === 0 ? 0 : Math.round((done.length / tasks.length) * 100);

  const toggleTag = (tag: string) =>
    setSelectedTags(ts => ts.includes(tag) ? ts.filter(t => t !== tag) : [...ts, tag]);

  const handleAddNote = () => {
    const text = draftText.trim();
    if (!text) return;
    setSavedNotes(n => [{ id: Date.now().toString(), text, tags: [...selectedTags], timestamp: new Date() }, ...n]);
    setDraftText('');
    setSelectedTags([]);
  };

  const handleDelete   = (id: string) => setSavedNotes(ns => ns.filter(n => n.id !== id));
  const handleSaveEdit = (id: string, newText: string) =>
    setSavedNotes(ns => ns.map(n => n.id === id ? { ...n, text: newText } : n));

  return (
    <SafeAreaView style={st.root}>
      {/* Top Bar */}
      <View style={st.topBar}>
        <TouchableOpacity style={st.menuBtn} onPress={() => navigation.openDrawer()}>
          <Text style={st.menuIcon}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex:1 }}>
          <Text style={st.topBarTitle}>Investigation Workspace</Text>
          <Text style={st.topBarSub}>AI-Powered Digital Duty Notebook</Text>
        </View>
        <View style={st.dateBadge}>
          <Text style={st.dateText}>{new Date().toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'2-digit' })}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={st.body}>

        {/* LEFT COLUMN */}
        <View style={st.leftCol}>
          {/* TOP-LEFT: Missions */}
          <View style={[st.missionsPanel, { height:TOP_ROW_H }]}>
            <View style={st.panelHeader}>
              <Text style={st.panelLabel}>TODAY'S MISSIONS</Text>
              <View style={st.countChip}><Text style={st.countChipText}>{missions.length}</Text></View>
              <View style={{ flex:1 }} />
              <TouchableOpacity style={st.addMissionBtn}><Text style={st.addMissionText}>✚ Add mission</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex:1 }}>
              {missions.map(m => <MissionCardLocal key={m.id} mission={m} />)}
            </ScrollView>
          </View>
          <View style={st.rule} />

          {/* BOTTOM-LEFT: Kanban */}
          <View style={st.kanbanPanel}>
            <View style={st.kanbanTitleRow}>
              <Text style={st.kanbanTitle}>Investigation Pipeline</Text>
              <View style={st.resolvedPill}>
                <View style={[st.resolvedDot,{backgroundColor:Colors.green}]} />
                <Text style={st.resolvedText}>{done.length}/{tasks.length} resolved</Text>
              </View>
            </View>
            <View style={st.progressTrack}>
              <View style={[st.progressFill,{width:(resolvedPct+'%') as any}]} />
            </View>
            <View style={st.progressLegend}>
              {COL_CONFIG.map(col => {
                const n = col.key==='TODO' ? todo.length : col.key==='DOING' ? doing.length : done.length;
                return (
                  <View key={col.key} style={st.legendItem}>
                    <View style={[st.legendDot,{backgroundColor:col.color}]} />
                    <Text style={st.legendText}>{col.label} ({n})</Text>
                  </View>
                );
              })}
            </View>
            <View style={st.kanbanBoard}>
              {COL_CONFIG.map((col,ci) => {
                const colTasks = cols[ci];
                return (
                  <View key={col.key} style={[st.kanbanCol,{backgroundColor:col.bg,borderTopColor:col.color}]}>
                    <View style={st.colHeader}>
                      <View style={[st.colDot,{backgroundColor:col.color}]} />
                      <Text style={[st.colTitle,{color:col.color}]}>{col.label.toUpperCase()}</Text>
                      <View style={[st.colBadge,{backgroundColor:col.color+'22',borderColor:col.color+'55'}]}>
                        <Text style={[st.colBadgeText,{color:col.color}]}>{colTasks.length}</Text>
                      </View>
                    </View>
                    {colTasks.length === 0 ? <View style={st.emptyCol}><Text style={st.emptyColText}>No tasks</Text></View> : null}
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {colTasks.map(task => (
                        <KanbanCard key={task.id} task={task} accentColor={col.color} status={col.key as Status}
                          onNavigate={() => navigateToCase(task.caseId)}
                          onMoveNext={() => { if(col.key==='TODO') moveTask(task.id,'DOING'); if(col.key==='DOING') moveTask(task.id,'DONE'); }}
                          onMovePrev={() => { if(col.key==='DOING') moveTask(task.id,'TODO'); if(col.key==='DONE') moveTask(task.id,'DOING'); }}
                        />
                      ))}
                    </ScrollView>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={st.vDivider} />

        {/* RIGHT COLUMN */}
        <View style={st.rightCol}>
          {/* TOP-RIGHT: My Notes list */}
          <View style={[st.myNotesPanel, { height:TOP_ROW_H }]}>
            <View style={st.myNotesTitleRow}>
              <Text style={st.myNotesTitle}>My notes</Text>
              {savedNotes.length > 0 ? <View style={st.noteCountBadge}><Text style={st.noteCountText}>{savedNotes.length}</Text></View> : null}
            </View>
            {savedNotes.length === 0 ? (
              <View style={st.myNotesEmpty}>
                <Text style={st.myNotesEmptyIcon}>📝</Text>
                <Text style={st.myNotesEmptyText}>No notes yet.{'\n'}Write and upload a note below.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex:1 }}>
                {savedNotes.map(note => (
                  <NoteItem key={note.id} note={note} onDelete={handleDelete} onSaveEdit={handleSaveEdit} />
                ))}
              </ScrollView>
            )}
          </View>

          <View style={st.rule} />

          {/* BOTTOM-RIGHT: Compose & Upload */}
          <ScrollView style={st.rightBottomScroll} contentContainerStyle={st.rightBottomContent} showsVerticalScrollIndicator={false}>
            <View style={st.composeHeader}>
              <Text style={st.panelLabel}>INVESTIGATION NOTES</Text>
              <Text style={st.composeSubLabel}>Compose and upload field observations</Text>
            </View>

            <View style={[st.composeCard, draftText.length > 0 && st.composeCardActive]}>
              <TextInput
                style={st.composeInput}
                multiline
                placeholder="Record field observations, lead analysis, witness assessments, suspect descriptions..."
                placeholderTextColor={Colors.gray}
                value={draftText}
                onChangeText={setDraftText}
              />
              {draftText.length > 0 ? <Text style={st.charCount}>{draftText.length} chars</Text> : null}
            </View>

            <Text style={[st.panelLabel,{marginTop:14,marginBottom:8}]}>TAG THIS NOTE</Text>
            <View style={st.tagSelector}>
              {ALL_TAGS.map((tag,i) => {
                const active = selectedTags.includes(tag);
                return (
                  <TouchableOpacity key={i} style={[st.tagChip, active && st.tagChipActive]} onPress={() => toggleTag(tag)}>
                    <Text style={[st.tagChipText, active && st.tagChipTextActive]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[st.uploadBtn, !draftText.trim() && st.uploadBtnDisabled]}
              onPress={handleAddNote}
              disabled={!draftText.trim()}>
              <Text style={st.uploadBtnIcon}>⬆</Text>
              <Text style={st.uploadBtnText}>Upload Note</Text>
            </TouchableOpacity>

            <View style={{ height:16 }} />
            <TouchableOpacity style={st.exportBtn}><Text style={st.exportBtnText}>Export Intelligence Log</Text></TouchableOpacity>
            <TouchableOpacity style={st.exportBtnSec}><Text style={st.exportBtnSecText}>Share via CCTNS</Text></TouchableOpacity>
            <View style={{ height:100 }} />
          </ScrollView>
        </View>
      </View>

      <FloatingAIBtn onPress={() => setCopilotOpen(true)} />
      <AICopilotPopup visible={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex:1, backgroundColor:Colors.paper },
  topBar: { flexDirection:'row', alignItems:'center', backgroundColor:Colors.inkNavy, paddingHorizontal:22, paddingVertical:14, gap:14, borderBottomWidth:2, borderBottomColor:Colors.steel },
  menuBtn: { width:34, height:34, alignItems:'center', justifyContent:'center', borderRadius:6, backgroundColor:'rgba(255,255,255,0.08)' },
  menuIcon: { color:Colors.sidebarText, fontSize:17 },
  topBarTitle: { fontFamily:FontFamily.displayBold, fontSize:FontSize['2xl'], color:Colors.white },
  topBarSub: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.sidebarMuted, marginTop:2 },
  dateBadge: { backgroundColor:'rgba(255,255,255,0.1)', borderRadius:6, paddingHorizontal:11, paddingVertical:7, borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  dateText: { fontFamily:FontFamily.monoMedium, fontSize:FontSize.sm, color:Colors.sidebarText },
  body: { flex:1, flexDirection:'row' },
  leftCol: { flex:1, minWidth:0, flexDirection:'column' },
  missionsPanel: { backgroundColor:Colors.card, paddingHorizontal:20, paddingTop:16, paddingBottom:12 },
  panelHeader: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:12 },
  panelLabel: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.gray, fontWeight:'700', letterSpacing:1 },
  countChip: { backgroundColor:Colors.paperDim, borderRadius:10, borderWidth:1, borderColor:Colors.line, paddingHorizontal:7, paddingVertical:1 },
  countChipText: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.steel, fontWeight:'700' },
  addMissionBtn: { backgroundColor:Colors.inkNavy+'10', borderRadius:6, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:Colors.inkNavy+'30' },
  addMissionText: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.inkNavy, fontWeight:'700' },
  rule: { height:1, backgroundColor:Colors.line },
  vDivider: { width:1, backgroundColor:Colors.line },
  kanbanPanel: { flex:1, padding:18, backgroundColor:Colors.paper },
  kanbanTitleRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  kanbanTitle: { fontFamily:FontFamily.displayBold, fontSize:FontSize.xl, color:Colors.inkNavy },
  resolvedPill: { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:Colors.greenDim, borderRadius:20, paddingHorizontal:10, paddingVertical:4, borderWidth:1, borderColor:Colors.green+'55' },
  resolvedDot: { width:6, height:6, borderRadius:3 },
  resolvedText: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.green, fontWeight:'700' },
  progressTrack: { height:5, backgroundColor:Colors.line, borderRadius:3, overflow:'hidden', marginBottom:7 },
  progressFill: { height:'100%' as any, backgroundColor:Colors.green, borderRadius:3 },
  progressLegend: { flexDirection:'row', gap:14, marginBottom:14 },
  legendItem: { flexDirection:'row', alignItems:'center', gap:5 },
  legendDot: { width:6, height:6, borderRadius:3 },
  legendText: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.gray },
  kanbanBoard: { flex:1, flexDirection:'row', gap:12 },
  kanbanCol: { flex:1, minWidth:0, borderRadius:11, borderWidth:1, borderColor:Colors.line, borderTopWidth:3, padding:10, overflow:'hidden' },
  colHeader: { flexDirection:'row', alignItems:'center', gap:7, marginBottom:10 },
  colDot: { width:7, height:7, borderRadius:3.5 },
  colTitle: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, fontWeight:'800', flex:1, letterSpacing:1 },
  colBadge: { borderRadius:20, borderWidth:1, paddingHorizontal:6, paddingVertical:1 },
  colBadgeText: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, fontWeight:'700' },
  emptyCol: { alignItems:'center', paddingVertical:20, borderWidth:1, borderStyle:'dashed', borderColor:Colors.line, borderRadius:7, marginBottom:6 },
  emptyColText: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.gray },
  rightCol: { width:300, flexDirection:'column', backgroundColor:Colors.card },
  myNotesPanel: { paddingHorizontal:16, paddingTop:14, paddingBottom:10, backgroundColor:Colors.card },
  myNotesTitleRow: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 },
  myNotesTitle: { fontFamily:FontFamily.displayBold, fontSize:FontSize.lg, color:Colors.inkNavy },
  noteCountBadge: { backgroundColor:Colors.inkNavy, borderRadius:10, paddingHorizontal:7, paddingVertical:2 },
  noteCountText: { fontFamily:FontFamily.mono, fontSize:10, color:Colors.white, fontWeight:'700' },
  myNotesEmpty: { flex:1, alignItems:'center', justifyContent:'center', gap:6 },
  myNotesEmptyIcon: { fontSize:28 },
  myNotesEmptyText: { fontFamily:FontFamily.body, fontSize:FontSize.sm, color:Colors.gray, textAlign:'center', lineHeight:19 },
  rightBottomScroll: { flex:1 },
  rightBottomContent: { paddingHorizontal:16, paddingTop:14, paddingBottom:40 },
  composeHeader: { marginBottom:10 },
  composeSubLabel: { fontFamily:FontFamily.body, fontSize:FontSize.xs, color:Colors.gray, marginTop:3 },
  composeCard: { backgroundColor:Colors.paper, borderRadius:10, borderWidth:1.5, borderColor:Colors.line, padding:12 },
  composeCardActive: { borderColor:Colors.inkNavy+'60' },
  composeInput: { fontFamily:FontFamily.body, fontSize:FontSize.sm, color:Colors.inkNavy, minHeight:90, textAlignVertical:'top', lineHeight:21 },
  charCount: { fontFamily:FontFamily.mono, fontSize:9, color:Colors.gray, marginTop:6, textAlign:'right' },
  tagSelector: { flexDirection:'row', flexWrap:'wrap', gap:7 },
  tagChip: { backgroundColor:Colors.paper, borderRadius:20, borderWidth:1, borderColor:Colors.line, paddingHorizontal:10, paddingVertical:4 },
  tagChipActive: { backgroundColor:Colors.inkNavy, borderColor:Colors.inkNavy },
  tagChipText: { fontFamily:FontFamily.mono, fontSize:FontSize.xs, color:Colors.steel, fontWeight:'600' },
  tagChipTextActive: { color:Colors.white },
  uploadBtn: { backgroundColor:Colors.inkNavy, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:13, borderRadius:9, marginTop:14, shadowColor:Colors.inkNavy, shadowOffset:{width:0,height:4}, shadowOpacity:0.25, shadowRadius:8 },
  uploadBtnDisabled: { backgroundColor:Colors.steel, opacity:0.45, shadowOpacity:0 },
  uploadBtnIcon: { fontSize:14, color:Colors.white },
  uploadBtnText: { fontFamily:FontFamily.bodyMedium, fontSize:FontSize.md, color:Colors.white },
  exportBtn: { backgroundColor:Colors.inkNavy+'14', paddingVertical:12, borderRadius:8, alignItems:'center', borderWidth:1, borderColor:Colors.inkNavy+'30', marginTop:4 },
  exportBtnText: { fontFamily:FontFamily.bodyMedium, fontSize:FontSize.sm, color:Colors.inkNavy },
  exportBtnSec: { backgroundColor:Colors.paper, borderWidth:1, borderColor:Colors.line, paddingVertical:11, borderRadius:8, alignItems:'center', marginTop:8 },
  exportBtnSecText: { fontFamily:FontFamily.bodyMedium, fontSize:FontSize.sm, color:Colors.inkNavy },
});
