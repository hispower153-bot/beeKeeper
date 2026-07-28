"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import {
  Plus, X, Crown, Bug, Pill, Droplet, AlertTriangle, ChevronLeft,
  Edit2, Trash2, Package, TrendingUp, MapPin, CheckCircle2,
  LayoutGrid, Gauge, Search, Layers,
  ChevronRight, Table2, Footprints, SkipForward, LogOut
} from "lucide-react";

/* ---------------- design tokens ---------------- */
const C = {
  cream: "#FBF5E8",
  paper: "#FFFDF8",
  ink: "#2B2210",
  inkSoft: "#6B5E45",
  amber: "#E0A02A",
  amberDeep: "#B87317",
  wood: "#6B4A2E",
  woodLine: "#E7D8B8",
  green: "#4C7A52",
  greenBg: "#E7EFE3",
  red: "#B5453F",
  redBg: "#F6E4E1",
  warn: "#C97A2B",
  warnBg: "#FBEBD6",
  blue: "#3E6E8E",
};

const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
    .font-display { font-family: 'Fraunces', serif; }
    .font-body { font-family: 'Inter', sans-serif; }
    .font-mono { font-family: 'IBM Plex Mono', monospace; }
    input, select, textarea { font-family: 'Inter', sans-serif; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: #D8C494; border-radius: 4px; }
  `}</style>
);

/* ---------------- helpers ---------------- */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysDiff = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
const ageFromDate = (iso) => {
  if (!iso) return "-";
  const days = daysDiff(iso, todayISO());
  if (days < 0) return "-";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return `${years}년 ${months}개월`;
  if (months > 0) return `${months}개월`;
  return `${days}일`;
};
const MARK_COLORS = { 1: "#FFFFFF", 2: "#FFF200", 3: "#FF3B30", 4: "#1FA24A", 5: "#1976D2", 6: "#FFFFFF", 7: "#FFF200", 8: "#FF3B30", 9: "#1FA24A", 0: "#1976D2" };
const MARK_LABELS = { 1: "흰색", 2: "노란색", 3: "빨간색", 4: "초록색", 5: "파란색", 6: "흰색", 7: "노란색", 8: "빨간색", 9: "초록색", 0: "파란색" };
const markColorForYear = (iso) => {
  if (!iso) return null;
  const y = new Date(iso + "T00:00:00").getFullYear() % 10;
  return { hex: MARK_COLORS[y], label: MARK_LABELS[y] };
};
const MARK_COLOR_OPTIONS = [
  { label: "흰색", hex: "#FFFFFF" },
  { label: "노란색", hex: "#FFF200" },
  { label: "빨간색", hex: "#FF3B30" },
  { label: "초록색", hex: "#1FA24A" },
  { label: "파란색", hex: "#1976D2" },
];
const markLabelForHex = (hex) => MARK_COLOR_OPTIONS.find((o) => o.hex === hex)?.label || "기타";
/* 실제 나이(출생일 기준) 우선, 없으면 도입일 기준 경과로 대체 표시 */
const queenAgeInfo = (queen) => {
  if (!queen) return { label: "-", basis: null };
  if (queen.birthDate) return { label: ageFromDate(queen.birthDate), basis: "birth" };
  if (queen.introducedDate) return { label: ageFromDate(queen.introducedDate), basis: "introduced" };
  return { label: "-", basis: null };
};

const QUEEN_STATUS_OPTS = ["정상", "산란저조", "교체 필요", "실종/유실", "폐사", "신규 도입"];
const STRENGTH_OPTS = ["강", "중", "약"];
const DISEASE_OPTS = ["노제마병", "응애(바로아)", "낭충봉아부패병", "미국부저병", "유럽부저병", "백묵병", "기타"];
const DISEASE_STATUS_OPTS = ["관찰중", "치료중", "완치"];
const MEDICINE_TYPE_OPTS = ["응애방제제", "항생제", "영양제", "곰팡이방제", "기타"];
const ACCIDENT_TYPE_OPTS = ["실종", "사고사(압사 등)", "분봉 중 유실", "천적 피해(말벌 등)", "기타"];

const statusLevel = (s) => (["교체 필요", "실종/유실", "폐사"].includes(s) ? "red" : s === "산란저조" ? "warn" : "green");
const LEVEL_COLOR = { red: C.red, warn: C.warn, green: C.green };
const LEVEL_BG = { red: C.redBg, warn: C.warnBg, green: C.greenBg };

/* 벌통 하나의 종합 위험도: 여왕벌/질병/투약(채밀금지) 중 가장 심각한 단계 */
const hiveRiskLevel = (h) => {
  let level = "green";
  const bump = (lv) => { if (lv === "red") level = "red"; else if (lv === "warn" && level !== "red") level = "warn"; };
  if (h.queen) {
    if (["교체 필요", "실종/유실", "폐사"].includes(h.queen.status)) bump("red");
    else if (h.queen.status === "산란저조") bump("warn");
    else if (h.queen.introducedDate && daysDiff(h.queen.introducedDate, todayISO()) > 365 * 2) bump("warn");
  }
  (h.diseases || []).forEach((d) => { if (d.status !== "완치") bump(d.status === "치료중" ? "warn" : "red"); });
  (h.medications || []).forEach((m) => { if (m.withdrawalUntil && m.withdrawalUntil >= todayISO()) bump("warn"); });
  return level;
};

/* ---------------- seed data ---------------- */
const seedApiaries = () => [
  { id: uid(), name: "과수원 벌장" },
  { id: uid(), name: "뒷산 벌장" },
];

const seedHives = (apiaries) => {
  const [apA, apB] = apiaries;
  const introduced1 = addDays(todayISO(), -420);
  const introduced2 = addDays(todayISO(), -95);
  const introduced3 = addDays(todayISO(), -200);
  const introduced4 = addDays(todayISO(), -760);
  return [
    {
      id: uid(), name: "1번통", apiaryId: apA.id, location: "1열", createdAt: addDays(todayISO(), -500), note: "",
      queen: { introducedDate: introduced1, birthDate: "", status: "산란저조", note: "산란량 감소 관찰됨, 교체 검토 중", accidents: [], wingClipped: true, wingClippedDate: introduced1, marked: true, markColor: "#1976D2", markedDate: introduced1 },
      population: { strength: "중", frames: 6, updatedAt: addDays(todayISO(), -3), note: "일벌 밀도 보통" },
      diseases: [{ id: uid(), name: "응애(바로아)", foundDate: addDays(todayISO(), -10), status: "치료중", note: "개미산 처리 시작" }],
      medications: [{ id: uid(), medicineName: "개미산 66%", date: addDays(todayISO(), -10), dosage: "20ml", note: "패드 처리", withdrawalUntil: addDays(todayISO(), 4) }],
      harvests: [{ id: uid(), date: addDays(todayISO(), -60), amount: 4.5, note: "아까시꿀" }],
      inspections: [],
    },
    {
      id: uid(), name: "2번통", apiaryId: apA.id, location: "1열", createdAt: addDays(todayISO(), -100), note: "",
      queen: { introducedDate: introduced2, birthDate: addDays(introduced2, -14), status: "정상", note: "", accidents: [{ id: uid(), date: addDays(todayISO(), -70), type: "분봉 중 유실", note: "인공분봉 시도 중 여왕벌 유실, 신여왕 도입" }], wingClipped: false, wingClippedDate: "", marked: true, markColor: "#FFF200", markedDate: introduced2 },
      population: { strength: "강", frames: 9, updatedAt: addDays(todayISO(), -1), note: "세력 왕성, 계상 추가 고려" },
      diseases: [],
      medications: [],
      harvests: [{ id: uid(), date: addDays(todayISO(), -55), amount: 6.2, note: "아까시꿀" }, { id: uid(), date: addDays(todayISO(), -5), amount: 3.1, note: "잡화꿀" }],
      inspections: [],
    },
    {
      id: uid(), name: "3번통", apiaryId: apB.id, location: "동쪽", createdAt: addDays(todayISO(), -200), note: "",
      queen: { introducedDate: introduced3, birthDate: "", status: "정상", note: "", accidents: [], wingClipped: true, wingClippedDate: introduced3, marked: true, markColor: "#FF3B30", markedDate: introduced3 },
      population: { strength: "중", frames: 7, updatedAt: addDays(todayISO(), -2), note: "" },
      diseases: [],
      medications: [],
      harvests: [{ id: uid(), date: addDays(todayISO(), -58), amount: 3.8, note: "아까시꿀" }],
      inspections: [],
    },
    {
      id: uid(), name: "4번통", apiaryId: apB.id, location: "동쪽", createdAt: addDays(todayISO(), -800), note: "",
      queen: { introducedDate: introduced4, birthDate: "", status: "교체 필요", note: "2년 이상 경과, 산란 불규칙", accidents: [], wingClipped: false, wingClippedDate: "", marked: false, markColor: "", markedDate: "" },
      population: { strength: "약", frames: 3, updatedAt: addDays(todayISO(), -1), note: "세력 약화, 관찰 필요" },
      diseases: [{ id: uid(), name: "낭충봉아부패병", foundDate: addDays(todayISO(), -20), status: "관찰중", note: "" }],
      medications: [],
      harvests: [],
      inspections: [],
    },
  ];
};

const seedMedicines = () => [
  { id: uid(), name: "옥살산 (승화법)", type: "응애방제제", unit: "g", stock: 250, minStock: 30, withdrawalDays: 0, note: "무유충기(겨울) 처리 권장" },
  { id: uid(), name: "개미산 66%", type: "응애방제제", unit: "ml", stock: 120, minStock: 50, withdrawalDays: 14, note: "고온기 사용 주의" },
  { id: uid(), name: "아피바 스트립", type: "응애방제제", unit: "개", stock: 8, minStock: 10, withdrawalDays: 42, note: "6주 부착 후 제거" },
  { id: uid(), name: "옥시테트라사이클린", type: "항생제", unit: "g", stock: 40, minStock: 20, withdrawalDays: 21, note: "부저병 예방/치료" },
  { id: uid(), name: "설탕시럽 1:1", type: "영양제", unit: "L", stock: 60, minStock: 10, withdrawalDays: 0, note: "산란 촉진기 급이" },
];

/* ---------------- small UI atoms ---------------- */
const HexDot = ({ color, size = 12 }) => (
  <span
    style={{
      display: "inline-block", width: size, height: size, background: color, flexShrink: 0,
      clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
    }}
  />
);

const Pill_ = ({ children, level = "green" }) => (
  <span
    className="font-body text-xs font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1.5"
    style={{ background: LEVEL_BG[level], color: LEVEL_COLOR[level] }}
  >
    <HexDot color={LEVEL_COLOR[level]} size={8} />
    {children}
  </span>
);

const SectionCard = ({ title, icon, children, right }) => (
  <div className="rounded-xl p-5 mb-5" style={{ background: C.paper, border: `1px solid ${C.woodLine}` }}>
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-lg font-semibold" style={{ color: C.ink }}>{title}</h3>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const Btn = ({ children, onClick, variant = "primary", small, icon, type = "button", disabled }) => {
  const styles = {
    primary: { background: C.amberDeep, color: "#fff" },
    ghost: { background: "transparent", color: C.wood, border: `1px solid ${C.woodLine}` },
    danger: { background: C.redBg, color: C.red },
    dark: { background: C.ink, color: "#fff" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`font-body font-semibold rounded-lg inline-flex items-center gap-1.5 transition-opacity hover:opacity-85 ${small ? "text-xs px-2.5 py-1.5" : "text-sm px-3.5 py-2"}`}
      style={{ ...styles[variant], opacity: disabled ? 0.5 : 1 }}
    >
      {icon}{children}
    </button>
  );
};

const Field = ({ label, children }) => (
  <label className="block mb-3">
    <span className="font-body text-xs font-semibold block mb-1" style={{ color: C.inkSoft }}>{label}</span>
    {children}
  </label>
);

const inputStyle = { border: `1px solid ${C.woodLine}`, background: "#fff", color: C.ink };
const inputClass = "w-full rounded-lg px-3 py-2 text-sm font-body outline-none";

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(43,34,16,0.45)" }}>
    <div className={`rounded-2xl w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[88vh] overflow-y-auto`} style={{ background: C.paper }}>
      <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ background: C.paper, borderBottom: `1px solid ${C.woodLine}` }}>
        <h3 className="font-display text-lg font-semibold" style={{ color: C.ink }}>{title}</h3>
        <button onClick={onClose}><X size={20} color={C.inkSoft} /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const EmptyState = ({ text }) => (
  <p className="font-body text-sm py-6 text-center" style={{ color: C.inkSoft }}>{text}</p>
);

/* 벌장 선택 + "새 벌장 만들기" 인라인 생성 */
const ApiaryPicker = ({ apiaries, value, onChange, newName, onNewName }) => (
  <>
    <select className={inputClass} style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">미지정</option>
      {apiaries.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      <option value="__new__">+ 새 벌장 만들기</option>
    </select>
    {value === "__new__" && (
      <input className={inputClass} style={{ ...inputStyle, marginTop: 8 }} value={newName} onChange={(e) => onNewName(e.target.value)} placeholder="새 벌장 이름" />
    )}
  </>
);

/* ================= APP ================= */
export default function App() {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [loaded, setLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [apiariesState, setApiariesState] = useState([]);
  const [hivesState, setHivesState] = useState([]);
  const [medicinesState, setMedicinesState] = useState([]);
  const [screen, setScreen] = useState("dashboard"); // dashboard | hives | medicines
  const [selectedHiveId, setSelectedHiveId] = useState(null);
  const [hiveTab, setHiveTab] = useState("queen");
  const [selectedHiveIds, setSelectedHiveIds] = useState(new Set());
  const [modal, setModal] = useState(null); // {type, hiveId?, hiveIds?, data?}

  /* ---- row <-> JS 객체 변환 ---- */
  const rowToApiary = (r) => ({ id: r.id, name: r.name });
  const apiaryToRow = (a) => ({ id: a.id, name: a.name });
  const rowToMedicine = (r) => ({ id: r.id, name: r.name, type: r.type, unit: r.unit, stock: Number(r.stock) || 0, minStock: Number(r.min_stock) || 0, withdrawalDays: Number(r.withdrawal_days) || 0, note: r.note || "" });
  const medicineToRow = (m) => ({ id: m.id, name: m.name, type: m.type, unit: m.unit, stock: m.stock, min_stock: m.minStock, withdrawal_days: m.withdrawalDays, note: m.note });
  const rowToHive = (r) => ({ id: r.id, name: r.name, apiaryId: r.apiary_id || "", location: r.location || "", note: r.note || "", createdAt: r.created_at, queen: r.queen || {}, population: r.population || {}, diseases: r.diseases || [], medications: r.medications || [], harvests: r.harvests || [], inspections: r.inspections || [] });
  const hiveToRow = (h) => ({ id: h.id, name: h.name, apiary_id: h.apiaryId || null, location: h.location || "", note: h.note || "", queen: h.queen, population: h.population, diseases: h.diseases, medications: h.medications, harvests: h.harvests, inspections: h.inspections });

  /* ---- 서버와 로컬 상태를 함께 갱신하는 setter (자식 컴포넌트는 전혀 몰라도 됨) ---- */
  const syncDiff = async (table, prev, next, toRow) => {
    const nextIds = new Set(next.map((x) => x.id));
    const toDelete = prev.filter((x) => !nextIds.has(x.id)).map((x) => x.id);
    const toUpsert = next.filter((x) => {
      const old = prev.find((p) => p.id === x.id);
      return !old || JSON.stringify(old) !== JSON.stringify(x);
    });
    if (toDelete.length) await supabase.from(table).delete().in("id", toDelete);
    if (toUpsert.length) await supabase.from(table).upsert(toUpsert.map(toRow));
  };
  const setApiaries = (updater) => setApiariesState((prev) => {
    const next = typeof updater === "function" ? updater(prev) : updater;
    syncDiff("apiaries", prev, next, apiaryToRow);
    return next;
  });
  const setMedicines = (updater) => setMedicinesState((prev) => {
    const next = typeof updater === "function" ? updater(prev) : updater;
    syncDiff("medicines", prev, next, medicineToRow);
    return next;
  });
  const setHives = (updater) => setHivesState((prev) => {
    const next = typeof updater === "function" ? updater(prev) : updater;
    syncDiff("hives", prev, next, hiveToRow);
    return next;
  });
  const apiaries = apiariesState;
  const hives = hivesState;
  const medicines = medicinesState;

  const refetchAll = async () => {
    const [{ data: ap }, { data: hv }, { data: md }] = await Promise.all([
      supabase.from("apiaries").select("*").order("created_at"),
      supabase.from("hives").select("*").order("created_at"),
      supabase.from("medicines").select("*").order("created_at"),
    ]);
    setApiariesState((ap || []).map(rowToApiary));
    setHivesState((hv || []).map(rowToHive));
    setMedicinesState((md || []).map(rowToMedicine));
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email || "");
      await refetchAll();
      setLoaded(true);
    })();
  }, []);

  /* 다른 직원이 데이터를 바꾸면 실시간으로 반영 */
  useEffect(() => {
    const channel = supabase
      .channel("apiary-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hives" }, refetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "apiaries" }, refetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "medicines" }, refetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const seedDemoData = () => {
    const ap = seedApiaries();
    setApiaries((prev) => [...prev, ...ap]);
    setHives((prev) => [...prev, ...seedHives(ap)]);
    setMedicines((prev) => [...prev, ...seedMedicines()]);
  };

  const updateHive = (hiveId, updater) => setHives((hs) => hs.map((h) => (h.id === hiveId ? updater(h) : h)));
  const selectedHive = hives.find((h) => h.id === selectedHiveId) || null;
  const openGlobalModal = (type, extra = {}) => setModal({ type, ...extra });
  const clearSelection = () => setSelectedHiveIds(new Set());

  const alerts = (() => {
    const list = [];
    hives.forEach((h) => {
      if (h.queen) {
        if (["교체 필요", "실종/유실", "폐사"].includes(h.queen.status)) {
          list.push({ hive: h.name, hiveId: h.id, msg: `여왕벌 상태 - ${h.queen.status}`, level: "red", icon: "queen" });
        } else if (h.queen.introducedDate && daysDiff(h.queen.introducedDate, todayISO()) > 365 * 2) {
          list.push({ hive: h.name, hiveId: h.id, msg: `여왕벌 도입 ${ageFromDate(h.queen.introducedDate)} 경과 - 교체 검토`, level: "warn", icon: "queen" });
        }
      }
      (h.diseases || []).forEach((d) => {
        if (d.status !== "완치") list.push({ hive: h.name, hiveId: h.id, msg: `${d.name} - ${d.status}`, level: d.status === "치료중" ? "warn" : "red", icon: "disease" });
      });
      (h.medications || []).forEach((m) => {
        if (m.withdrawalUntil && m.withdrawalUntil >= todayISO()) {
          list.push({ hive: h.name, hiveId: h.id, msg: `채밀 금지기간 (${fmtDate(m.withdrawalUntil)}까지) — ${m.medicineName}`, level: "warn", icon: "med" });
        }
      });
    });
    medicines.forEach((m) => {
      if (m.stock <= (m.minStock ?? 10)) list.push({ hive: null, hiveId: null, msg: `${m.name} 재고 부족 (${m.stock}${m.unit})`, level: "warn", icon: "stock" });
    });
    return list.sort((a, b) => (a.level === "red" ? -1 : 1) - (b.level === "red" ? -1 : 1));
  })();

  const yearHarvest = hives.reduce((sum, h) => sum + (h.harvests || []).filter((r) => r.date.slice(0, 4) === todayISO().slice(0, 4)).reduce((s, r) => s + Number(r.amount), 0), 0);

  if (!loaded) return <div className="min-h-screen flex items-center justify-center font-body" style={{ background: C.cream }}>불러오는 중...</div>;

  return (
    <div className="min-h-screen font-body" style={{ background: C.cream, color: C.ink }}>
      {FONTS}
      {/* header */}
      <div style={{ background: C.ink }} className="px-5 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HexDot color={C.amber} size={22} />
            <div>
              <h1 className="font-display text-xl font-bold text-white leading-tight">양봉일지</h1>
              <p className="text-xs" style={{ color: "#C9B98A" }}>벌통 · 여왕벌 · 투약 · 채밀 기록 관리</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {[
              ["dashboard", "대시보드", <Gauge size={15} key="i" />],
              ["hives", "벌통 관리", <LayoutGrid size={15} key="i" />],
              ["medicines", "약품 관리", <Package size={15} key="i" />],
            ].map(([key, label, icon]) => (
              <button
                key={key}
                onClick={() => { setScreen(key); setSelectedHiveId(null); }}
                className="font-body text-sm font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                style={{
                  background: screen === key ? C.amber : "transparent",
                  color: screen === key ? C.ink : "#D8C494",
                }}
              >
                {icon}{label}
              </button>
            ))}
            <span className="hidden sm:inline font-body text-xs ml-2" style={{ color: "#8A7B57" }}>{userEmail}</span>
            <button onClick={logout} title="로그아웃" className="ml-1 p-2 rounded-lg" style={{ color: "#D8C494" }}>
              <LogOut size={15} />
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-6">
        {screen === "dashboard" && (
          <Dashboard
            hives={hives} apiaries={apiaries} medicines={medicines} alerts={alerts} yearHarvest={yearHarvest}
            goHive={(id) => { setScreen("hives"); setSelectedHiveId(id); setHiveTab("queen"); }}
            goHives={() => { setScreen("hives"); setSelectedHiveId(null); }}
            onSeedDemo={seedDemoData}
          />
        )}

        {screen === "hives" && !selectedHive && (
          <HiveManagement
            hives={hives} apiaries={apiaries} setHives={setHives}
            onSelect={(id) => { setSelectedHiveId(id); setHiveTab("queen"); }}
            openModal={openGlobalModal}
            selectedIds={selectedHiveIds}
            setSelectedIds={setSelectedHiveIds}
          />
        )}

        {screen === "hives" && selectedHive && (
          <HiveDetail
            hive={selectedHive}
            apiaries={apiaries}
            hiveTab={hiveTab}
            setHiveTab={setHiveTab}
            onBack={() => setSelectedHiveId(null)}
            onEditHive={() => setModal({ type: "hive", data: selectedHive })}
            onDeleteHive={() => {
              if (confirm(`${selectedHive.name}을(를) 삭제할까요?`)) {
                setHives((hs) => hs.filter((h) => h.id !== selectedHive.id));
                setSelectedHiveId(null);
              }
            }}
            openModal={(type, data) => setModal({ type, hiveId: selectedHive.id, data })}
            updateHive={updateHive}
          />
        )}

        {screen === "medicines" && (
          <MedicineList medicines={medicines} onAdd={() => setModal({ type: "medicine" })} onEdit={(m) => setModal({ type: "medicine", data: m })}
            onAdjust={(id, delta) => setMedicines((ms) => ms.map((m) => m.id === id ? { ...m, stock: Math.max(0, m.stock + delta) } : m))}
            onDelete={(id) => { if (confirm("이 약품을 삭제할까요?")) setMedicines((ms) => ms.filter((m) => m.id !== id)); }}
          />
        )}
      </div>

      {modal && (
        <ModalRouter
          modal={modal}
          onClose={() => setModal(null)}
          hives={hives}
          setHives={setHives}
          medicines={medicines}
          setMedicines={setMedicines}
          apiaries={apiaries}
          setApiaries={setApiaries}
          updateHive={updateHive}
          clearSelection={clearSelection}
        />
      )}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ hives, apiaries, medicines, alerts, yearHarvest, goHive, goHives, onSeedDemo }) {
  if (hives.length === 0 && apiaries.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: C.paper, border: `1px solid ${C.woodLine}` }}>
        <h3 className="font-display text-lg font-semibold mb-2" style={{ color: C.ink }}>아직 등록된 벌통이 없습니다</h3>
        <p className="font-body text-sm mb-4" style={{ color: C.inkSoft }}>벌통 관리 화면에서 직접 추가하거나, 샘플 데이터로 먼저 둘러보세요.</p>
        <Btn onClick={onSeedDemo}>샘플 데이터 추가</Btn>
      </div>
    );
  }
  const cautionHives = hives.filter((h) => hiveRiskLevel(h) !== "green").length;
  const stats = [
    { label: "관리 벌통", value: hives.length, unit: "통", color: C.wood },
    { label: "벌장 수", value: apiaries.length, unit: "곳", color: C.wood },
    { label: "주의 필요 벌통", value: cautionHives, unit: "통", color: cautionHives ? C.red : C.green },
    { label: "올해 채밀량", value: yearHarvest.toFixed(1), unit: "kg", color: C.amberDeep },
  ];

  const groupSummaries = [
    ...apiaries.map((a) => {
      const list = hives.filter((h) => h.apiaryId === a.id);
      return {
        id: a.id, name: a.name, count: list.length,
        green: list.filter((h) => hiveRiskLevel(h) === "green").length,
        warn: list.filter((h) => hiveRiskLevel(h) === "warn").length,
        red: list.filter((h) => hiveRiskLevel(h) === "red").length,
      };
    }),
    (() => {
      const list = hives.filter((h) => !h.apiaryId || !apiaries.find((a) => a.id === h.apiaryId));
      return list.length ? {
        id: "unassigned", name: "미지정", count: list.length,
        green: list.filter((h) => hiveRiskLevel(h) === "green").length,
        warn: list.filter((h) => hiveRiskLevel(h) === "warn").length,
        red: list.filter((h) => hiveRiskLevel(h) === "red").length,
      } : null;
    })(),
  ].filter(Boolean);

  const shownAlerts = alerts.slice(0, 10);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: C.paper, border: `1px solid ${C.woodLine}` }}>
            <p className="font-body text-xs font-semibold mb-1" style={{ color: C.inkSoft }}>{s.label}</p>
            <p className="font-mono text-2xl font-semibold" style={{ color: s.color }}>{s.value}<span className="text-sm ml-1 font-body">{s.unit}</span></p>
          </div>
        ))}
      </div>

      <SectionCard title="주의가 필요한 항목" icon={<AlertTriangle size={17} color={C.warn} />}>
        {alerts.length === 0 ? <EmptyState text="현재 주의할 항목이 없습니다." /> : (
          <>
            <div className="space-y-2">
              {shownAlerts.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: LEVEL_BG[a.level] }}>
                  <div className="flex items-center gap-2.5">
                    <HexDot color={LEVEL_COLOR[a.level]} />
                    <span className="font-body text-sm" style={{ color: C.ink }}>
                      {a.hive && <b className="font-semibold">{a.hive} · </b>}{a.msg}
                    </span>
                  </div>
                  {a.hiveId && (
                    <button className="font-body text-xs font-semibold underline shrink-0" style={{ color: C.inkSoft }}
                      onClick={() => goHive(a.hiveId)}>보기</button>
                  )}
                </div>
              ))}
            </div>
            {alerts.length > shownAlerts.length && (
              <button onClick={goHives} className="font-body text-xs font-semibold underline mt-3" style={{ color: C.inkSoft }}>
                + {alerts.length - shownAlerts.length}건 더 있음 · 표에서 전체 확인
              </button>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="벌장별 현황" icon={<Layers size={17} color={C.wood} />} right={<Btn small variant="ghost" icon={<Table2 size={13} />} onClick={goHives}>전체 보기</Btn>}>
        {groupSummaries.length === 0 ? <EmptyState text="등록된 벌장이 없습니다." /> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {groupSummaries.map((g) => (
              <button key={g.id} onClick={goHives} className="text-left rounded-lg p-3 hover:opacity-85 transition-opacity" style={{ border: `1px solid ${C.woodLine}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-semibold" style={{ color: C.ink }}>{g.name}</span>
                  <span className="font-mono text-xs" style={{ color: C.inkSoft }}>{g.count}통</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Pill_ level="green">정상 {g.green}</Pill_>
                  <Pill_ level="warn">주의 {g.warn}</Pill_>
                  <Pill_ level="red">위험 {g.red}</Pill_>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ---------------- Hive Management (grid/table/patrol) ---------------- */
function HiveManagement({ hives, apiaries, setHives, onSelect, openModal, selectedIds, setSelectedIds }) {
  const [view, setView] = useState("grid"); // grid | table | patrol
  const [filterApiary, setFilterApiary] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = hives.filter((h) => {
    if (filterApiary !== "all" && h.apiaryId !== filterApiary) return false;
    if (filterLevel !== "all" && hiveRiskLevel(h) !== filterLevel) return false;
    if (search && !h.name.includes(search)) return false;
    return true;
  });

  const patrolSource = filterApiary === "all" ? hives : hives.filter((h) => h.apiaryId === filterApiary);
  const localUpdateHive = (hiveId, updater) => setHives((hs) => hs.map((h) => (h.id === hiveId ? updater(h) : h)));

  if (view === "patrol") {
    return <PatrolMode hives={patrolSource} apiaries={apiaries} updateHive={localUpdateHive} onExit={() => setView("grid")} />;
  }

  const bulkIds = Array.from(selectedIds);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-xl font-semibold" style={{ color: C.ink }}>벌통 관리 <span className="font-mono text-base font-normal" style={{ color: C.inkSoft }}>({hives.length}통)</span></h2>
        <div className="flex gap-2">
          <Btn variant="ghost" small icon={<Layers size={13} />} onClick={() => openModal("apiaryManage")}>벌장 관리</Btn>
          <Btn small icon={<Plus size={15} />} onClick={() => openModal("hive")}>벌통 추가</Btn>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[140px]">
          <Search size={14} color={C.inkSoft} style={{ position: "absolute", left: 10, top: 10 }} />
          <input className={inputClass} style={{ ...inputStyle, paddingLeft: 30 }} placeholder="벌통 이름 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="rounded-lg px-2.5 py-2 text-sm font-body" style={inputStyle} value={filterApiary} onChange={(e) => setFilterApiary(e.target.value)}>
          <option value="all">전체 벌장</option>
          {apiaries.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="rounded-lg px-2.5 py-2 text-sm font-body" style={inputStyle} value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
          <option value="all">전체 상태</option>
          <option value="green">정상</option>
          <option value="warn">주의</option>
          <option value="red">위험</option>
        </select>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.woodLine}` }}>
          <button onClick={() => setView("grid")} className="px-2.5 flex items-center" style={{ background: view === "grid" ? C.amberDeep : "#fff" }}>
            <LayoutGrid size={15} color={view === "grid" ? "#fff" : C.wood} />
          </button>
          <button onClick={() => setView("table")} className="px-2.5 flex items-center" style={{ background: view === "table" ? C.amberDeep : "#fff" }}>
            <Table2 size={15} color={view === "table" ? "#fff" : C.wood} />
          </button>
        </div>
        <Btn small variant="dark" icon={<Footprints size={13} />} onClick={() => setView("patrol")}>순회 점검</Btn>
      </div>

      {filtered.length === 0 ? <EmptyState text="조건에 맞는 벌통이 없습니다." /> : view === "grid" ? (
        <HiveGrid hives={filtered} apiaries={apiaries} onSelect={onSelect} />
      ) : (
        <HiveTable hives={filtered} apiaries={apiaries} onSelect={onSelect} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      )}

      {bulkIds.length > 0 && (
        <div className="sticky bottom-3 mt-4 rounded-xl p-3 flex items-center gap-2 flex-wrap" style={{ background: C.ink }}>
          <span className="font-body text-sm font-semibold text-white mr-1">{bulkIds.length}개 선택됨</span>
          <Btn small variant="ghost" onClick={() => openModal("bulkMedlog", { hiveIds: bulkIds })} icon={<Pill size={13} />}>투약 기록</Btn>
          <Btn small variant="ghost" onClick={() => openModal("bulkDisease", { hiveIds: bulkIds })} icon={<Bug size={13} />}>질병 기록</Btn>
          <Btn small variant="ghost" onClick={() => openModal("bulkHarvest", { hiveIds: bulkIds })} icon={<Droplet size={13} />}>채밀 기록</Btn>
          <Btn small variant="ghost" onClick={() => openModal("bulkMove", { hiveIds: bulkIds })} icon={<Layers size={13} />}>벌장 이동</Btn>
          <Btn small variant="danger" onClick={() => {
            if (confirm(`선택한 ${bulkIds.length}개 벌통을 삭제할까요?`)) {
              setHives((hs) => hs.filter((h) => !bulkIds.includes(h.id)));
              setSelectedIds(new Set());
            }
          }} icon={<Trash2 size={13} />}>삭제</Btn>
          <button className="font-body text-xs underline ml-auto" style={{ color: "#D8C494" }} onClick={() => setSelectedIds(new Set())}>선택 해제</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Hive Grid ---------------- */
function HiveGrid({ hives, apiaries, onSelect }) {
  const apiaryName = (id) => apiaries.find((a) => a.id === id)?.name || "미지정";
  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
      {hives.map((h) => {
        const risk = hiveRiskLevel(h);
        return (
          <button key={h.id} onClick={() => onSelect(h.id)} className="text-left rounded-xl p-4 hover:-translate-y-0.5 transition-transform" style={{ background: C.paper, border: `1px solid ${C.woodLine}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{
                width: 30, height: 30, background: LEVEL_COLOR[risk], display: "flex", alignItems: "center", justifyContent: "center",
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              }}>
                <Crown size={15} color="#fff" />
              </span>
              <div>
                <p className="font-display font-semibold leading-tight" style={{ color: C.ink }}>{h.name}</p>
                <p className="font-body text-xs flex items-center gap-1" style={{ color: C.inkSoft }}><MapPin size={10} />{apiaryName(h.apiaryId)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <Pill_ level={statusLevel(h.queen?.status)}>{h.queen?.status || "-"}</Pill_>
              <span className="font-body text-xs px-2 py-1 rounded-full" style={{ background: C.cream, color: C.wood }}>세력 {h.population?.strength || "-"}</span>
              {h.queen?.marked && (
                <span className="font-body text-xs px-2 py-1 rounded-full inline-flex items-center gap-1" style={{ background: C.cream, color: C.wood }}>
                  <HexDot color={h.queen.markColor} size={9} />{markLabelForHex(h.queen.markColor)}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Hive Table (grouped by apiary, bulk-selectable) ---------------- */
function HiveTable({ hives, apiaries, onSelect, selectedIds, setSelectedIds }) {
  const cols = "28px 1fr 96px 56px 90px 88px 16px";

  const groups = [
    ...apiaries.map((a) => ({ id: a.id, name: a.name, list: hives.filter((h) => h.apiaryId === a.id) })),
    { id: "unassigned", name: "미지정", list: hives.filter((h) => !h.apiaryId || !apiaries.find((a) => a.id === h.apiaryId)) },
  ].filter((g) => g.list.length > 0);

  const toggleOne = (id) => setSelectedIds((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleGroup = (ids) => setSelectedIds((prev) => {
    const n = new Set(prev);
    const allIn = ids.every((i) => n.has(i));
    ids.forEach((i) => (allIn ? n.delete(i) : n.add(i)));
    return n;
  });

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.woodLine}`, background: C.paper }}>
      <div className="grid px-3 py-2 font-body text-xs font-semibold" style={{ gridTemplateColumns: cols, background: C.cream, color: C.inkSoft }}>
        <span />
        <span>벌통</span>
        <span>여왕벌</span>
        <span>세력</span>
        <span>질병/투약</span>
        <span>최근점검</span>
        <span />
      </div>
      {groups.map((g) => {
        const ids = g.list.map((h) => h.id);
        const allSelected = ids.length > 0 && ids.every((i) => selectedIds.has(i));
        return (
          <div key={g.id}>
            <div className="grid items-center px-3 py-2" style={{ gridTemplateColumns: cols, background: "#F3E9D2", borderTop: `1px solid ${C.woodLine}` }}>
              <input type="checkbox" checked={allSelected} onChange={() => toggleGroup(ids)} />
              <span className="font-body text-sm font-semibold" style={{ color: C.wood, gridColumn: "2 / span 2" }}>{g.name}</span>
              <span className="font-mono text-xs" style={{ color: C.inkSoft }}>{g.list.length}통</span>
            </div>
            {g.list.map((h) => {
              const active = (h.medications || []).find((m) => m.withdrawalUntil && m.withdrawalUntil >= todayISO());
              const activeDisease = (h.diseases || []).find((d) => d.status !== "완치");
              const lastCheck = h.population?.updatedAt;
              return (
                <div key={h.id} onClick={() => onSelect(h.id)} className="grid items-center px-3 py-2.5 cursor-pointer hover:opacity-80" style={{ gridTemplateColumns: cols, borderTop: `1px solid ${C.woodLine}` }}>
                  <input type="checkbox" checked={selectedIds.has(h.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleOne(h.id)} />
                  <span className="font-body text-sm font-semibold flex items-center gap-1.5" style={{ color: C.ink }}>
                    <HexDot color={LEVEL_COLOR[hiveRiskLevel(h)]} size={9} />{h.name}
                  </span>
                  <span><Pill_ level={statusLevel(h.queen?.status)}>{h.queen?.status || "-"}</Pill_></span>
                  <span className="font-mono text-xs" style={{ color: C.ink }}>{h.population?.strength || "-"}</span>
                  <span className="font-body text-xs" style={{ color: activeDisease ? C.warn : C.inkSoft }}>
                    {activeDisease ? `${activeDisease.name}` : active ? "채밀금지" : "-"}
                  </span>
                  <span className="font-mono text-xs" style={{ color: C.inkSoft }}>{fmtDate(lastCheck)}</span>
                  <ChevronRight size={14} color={C.inkSoft} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Patrol (round inspection) Mode ---------------- */
function PatrolMode({ hives, apiaries, updateHive, onExit }) {
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [noteMode, setNoteMode] = useState(false);
  const [note, setNote] = useState("");
  const [results, setResults] = useState([]);

  const start = () => {
    const q = hives.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));
    setQueue(q); setIdx(0); setResults([]); setStarted(true);
  };

  if (!started) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: C.paper, border: `1px solid ${C.woodLine}` }}>
        <Footprints size={28} color={C.amberDeep} style={{ margin: "0 auto 8px" }} />
        <h3 className="font-display text-lg font-semibold mb-1" style={{ color: C.ink }}>순회 점검 모드</h3>
        <p className="font-body text-sm mb-4" style={{ color: C.inkSoft }}>선택된 {hives.length}개 벌통을 순서대로 훑으며 정상/이상 여부만 빠르게 기록합니다.</p>
        <div className="flex gap-2 justify-center">
          <Btn variant="ghost" onClick={onExit}>취소</Btn>
          <Btn onClick={start} icon={<Footprints size={15} />} disabled={hives.length === 0}>점검 시작</Btn>
        </div>
      </div>
    );
  }

  if (idx >= queue.length) {
    const abnormal = results.filter((r) => r.result === "이상");
    return (
      <div className="rounded-xl p-6" style={{ background: C.paper, border: `1px solid ${C.woodLine}` }}>
        <h3 className="font-display text-lg font-semibold mb-3" style={{ color: C.ink }}>점검 완료</h3>
        <div className="flex gap-2 mb-4 flex-wrap">
          <Pill_ level="green">정상 {results.filter((r) => r.result === "정상").length}</Pill_>
          <Pill_ level="red">이상 {abnormal.length}</Pill_>
          <Pill_ level="warn">건너뜀 {results.filter((r) => r.result === "건너뜀").length}</Pill_>
        </div>
        {abnormal.length > 0 && (
          <div className="space-y-2 mb-4">
            {abnormal.map((r, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: C.redBg }}>
                <p className="font-body text-sm font-semibold" style={{ color: C.red }}>{r.name}</p>
                {r.note && <p className="font-body text-xs mt-0.5" style={{ color: C.ink }}>{r.note}</p>}
              </div>
            ))}
          </div>
        )}
        <Btn onClick={onExit}>목록으로</Btn>
      </div>
    );
  }

  const hive = queue[idx];
  const apiaryName = apiaries.find((a) => a.id === hive.apiaryId)?.name || "미지정";

  const record = (result, n = "") => {
    setResults((r) => [...r, { hiveId: hive.id, name: hive.name, result, note: n }]);
    if (result !== "건너뜀") {
      updateHive(hive.id, (h) => ({
        ...h,
        population: { ...h.population, updatedAt: todayISO() },
        inspections: [...(h.inspections || []), { id: uid(), date: todayISO(), result, note: n }],
      }));
    }
    setNoteMode(false); setNote(""); setIdx((i) => i + 1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-body text-sm font-semibold" style={{ color: C.inkSoft }}>{idx + 1} / {queue.length}</p>
        <button onClick={onExit} className="font-body text-xs font-semibold underline" style={{ color: C.inkSoft }}>점검 종료</button>
      </div>
      <div className="h-1.5 rounded-full mb-5" style={{ background: C.woodLine }}>
        <div className="h-1.5 rounded-full transition-all" style={{ background: C.amber, width: `${(idx / queue.length) * 100}%` }} />
      </div>
      <div className="rounded-xl p-6 mb-4 text-center" style={{ background: C.paper, border: `1px solid ${C.woodLine}` }}>
        <p className="font-body text-xs mb-1" style={{ color: C.inkSoft }}>{apiaryName}</p>
        <h3 className="font-display text-2xl font-bold mb-3" style={{ color: C.ink }}>{hive.name}</h3>
        <div className="flex gap-2 justify-center flex-wrap">
          <Pill_ level={statusLevel(hive.queen?.status)}>{hive.queen?.status || "-"}</Pill_>
          <span className="font-body text-xs px-2 py-1 rounded-full" style={{ background: C.cream, color: C.wood }}>세력 {hive.population?.strength || "-"}</span>
        </div>
      </div>

      {!noteMode ? (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => record("건너뜀")} className="rounded-xl py-4 font-body text-sm font-semibold flex flex-col items-center gap-1" style={{ background: C.paper, color: C.inkSoft, border: `1px solid ${C.woodLine}` }}>
            <SkipForward size={16} />건너뛰기
          </button>
          <button onClick={() => setNoteMode(true)} className="rounded-xl py-4 font-body text-sm font-semibold" style={{ background: C.redBg, color: C.red }}>이상 있음</button>
          <button onClick={() => record("정상")} className="rounded-xl py-4 font-body text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>정상 ✓</button>
        </div>
      ) : (
        <div className="rounded-xl p-4" style={{ background: C.redBg }}>
          <p className="font-body text-xs font-semibold mb-2" style={{ color: C.red }}>어떤 이상이 있었나요?</p>
          <textarea autoFocus className={inputClass} style={{ ...inputStyle, marginBottom: 10 }} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 응애 의심, 여왕벌 미확인 등" />
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => { setNoteMode(false); setNote(""); }}>취소</Btn>
            <Btn variant="danger" onClick={() => record("이상", note)}>기록하고 다음</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Hive Detail ---------------- */
function HiveDetail({ hive, apiaries, hiveTab, setHiveTab, onBack, onEditHive, onDeleteHive, openModal, updateHive }) {
  const tabs = [
    ["queen", "여왕벌", <Crown size={14} key="i" />],
    ["health", "개체수 · 질병", <Bug size={14} key="i" />],
    ["meds", "투약 기록", <Pill size={14} key="i" />],
    ["harvest", "채밀 기록", <Droplet size={14} key="i" />],
  ];
  const mark = markColorForYear(hive.queen?.introducedDate);
  const apiaryName = apiaries.find((a) => a.id === hive.apiaryId)?.name || "미지정";

  return (
    <div>
      <button onClick={onBack} className="font-body text-sm font-semibold flex items-center gap-1 mb-3" style={{ color: C.inkSoft }}>
        <ChevronLeft size={16} />벌통 목록
      </button>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl font-bold" style={{ color: C.ink }}>{hive.name}</h2>
          <p className="font-body text-sm flex items-center gap-1 mt-1" style={{ color: C.inkSoft }}><MapPin size={12} />{apiaryName}{hive.location ? ` · ${hive.location}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" small icon={<Edit2 size={13} />} onClick={onEditHive}>수정</Btn>
          <Btn variant="danger" small icon={<Trash2 size={13} />} onClick={onDeleteHive}>삭제</Btn>
        </div>
      </div>

      <div className="flex gap-1 mb-5 flex-wrap">
        {tabs.map(([key, label, icon]) => (
          <button key={key} onClick={() => setHiveTab(key)} className="font-body text-sm font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5"
            style={{ background: hiveTab === key ? C.amberDeep : C.paper, color: hiveTab === key ? "#fff" : C.wood, border: `1px solid ${hiveTab === key ? C.amberDeep : C.woodLine}` }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {hiveTab === "queen" && (
        <SectionCard title="여왕벌 정보" icon={<Crown size={17} color={C.amberDeep} />} right={<Btn small icon={<Edit2 size={13} />} variant="ghost" onClick={() => openModal("queenEdit", hive.queen)}>정보 수정</Btn>}>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="font-body text-xs font-semibold mb-1" style={{ color: C.inkSoft }}>상태</p>
              <Pill_ level={statusLevel(hive.queen?.status)}>{hive.queen?.status || "미등록"}</Pill_>
            </div>
            <div>
              <p className="font-body text-xs font-semibold mb-1" style={{ color: C.inkSoft }}>나이</p>
              <p className="font-mono text-sm" style={{ color: C.ink }}>
                {queenAgeInfo(hive.queen).label}
                <span className="font-body text-xs ml-1" style={{ color: C.inkSoft }}>
                  {queenAgeInfo(hive.queen).basis === "birth" ? "(출생일 기준)" : queenAgeInfo(hive.queen).basis === "introduced" ? "(도입일 기준 추정)" : ""}
                </span>
              </p>
            </div>
            <div>
              <p className="font-body text-xs font-semibold mb-1" style={{ color: C.inkSoft }}>도입일 / 출생(사육)일</p>
              <p className="font-mono text-sm" style={{ color: C.ink }}>{fmtDate(hive.queen?.introducedDate)} / {hive.queen?.birthDate ? fmtDate(hive.queen.birthDate) : "미상"}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-2">
            <div className="rounded-lg p-3" style={{ background: C.cream }}>
              <p className="font-body text-xs font-semibold mb-1.5" style={{ color: C.inkSoft }}>날개관리</p>
              {hive.queen?.wingClipped ? (
                <p className="font-body text-sm font-semibold flex items-center gap-1.5" style={{ color: C.blue }}>
                  <CheckCircle2 size={14} />단시(날개 절단) 완료
                  <span className="font-mono font-normal text-xs" style={{ color: C.inkSoft }}>{fmtDate(hive.queen?.wingClippedDate)}</span>
                </p>
              ) : (
                <p className="font-body text-sm" style={{ color: C.inkSoft }}>날개 절단하지 않음</p>
              )}
            </div>
            <div className="rounded-lg p-3" style={{ background: C.cream }}>
              <p className="font-body text-xs font-semibold mb-1.5" style={{ color: C.inkSoft }}>색 표시(마킹) 유무</p>
              {hive.queen?.marked ? (
                <p className="font-body text-sm font-semibold inline-flex items-center gap-1.5" style={{ color: C.ink }}>
                  <HexDot color={hive.queen.markColor || "#999"} size={13} />
                  {markLabelForHex(hive.queen.markColor)} 표시됨
                  <span className="font-mono font-normal text-xs" style={{ color: C.inkSoft }}>{fmtDate(hive.queen?.markedDate)}</span>
                </p>
              ) : (
                <p className="font-body text-sm" style={{ color: C.inkSoft }}>표시하지 않음</p>
              )}
              {mark && <p className="font-body text-xs mt-1" style={{ color: C.inkSoft }}>참고: 도입 연도 기준 권장 색상은 {mark.label}입니다.</p>}
            </div>
          </div>
          {hive.queen?.note && <p className="font-body text-sm rounded-lg p-2.5 mt-1" style={{ background: C.cream, color: C.ink }}>{hive.queen.note}</p>}

          <div className="flex items-center justify-between mt-5 mb-2">
            <h4 className="font-body text-sm font-semibold" style={{ color: C.ink }}>사고 · 이상 이력</h4>
            <Btn small icon={<Plus size={13} />} onClick={() => openModal("accident")}>기록 추가</Btn>
          </div>
          {(!hive.queen?.accidents || hive.queen.accidents.length === 0) ? <EmptyState text="사고 이력이 없습니다." /> : (
            <div className="space-y-2">
              {hive.queen.accidents.slice().reverse().map((a) => (
                <div key={a.id} className="flex items-start justify-between rounded-lg p-3" style={{ background: C.redBg }}>
                  <div>
                    <p className="font-body text-sm font-semibold" style={{ color: C.red }}>{a.type} <span className="font-mono font-normal ml-1" style={{ color: C.inkSoft }}>{fmtDate(a.date)}</span></p>
                    {a.note && <p className="font-body text-xs mt-0.5" style={{ color: C.ink }}>{a.note}</p>}
                  </div>
                  <button onClick={() => updateHive(hive.id, (h) => ({ ...h, queen: { ...h.queen, accidents: h.queen.accidents.filter((x) => x.id !== a.id) } }))}>
                    <Trash2 size={14} color={C.inkSoft} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {hiveTab === "health" && (
        <>
          <SectionCard title="개체수 · 세력" icon={<TrendingUp size={17} color={C.wood} />} right={<Btn small icon={<Edit2 size={13} />} variant="ghost" onClick={() => openModal("population", hive.population)}>정보 수정</Btn>}>
            <div className="grid sm:grid-cols-3 gap-4">
              <div><p className="font-body text-xs font-semibold mb-1" style={{ color: C.inkSoft }}>세력</p><p className="font-mono text-lg" style={{ color: C.ink }}>{hive.population?.strength || "-"}</p></div>
              <div><p className="font-body text-xs font-semibold mb-1" style={{ color: C.inkSoft }}>소비(장) 수</p><p className="font-mono text-lg" style={{ color: C.ink }}>{hive.population?.frames ?? "-"}장</p></div>
              <div><p className="font-body text-xs font-semibold mb-1" style={{ color: C.inkSoft }}>최근 점검일</p><p className="font-mono text-lg" style={{ color: C.ink }}>{fmtDate(hive.population?.updatedAt)}</p></div>
            </div>
            {hive.population?.note && <p className="font-body text-sm rounded-lg p-2.5 mt-3" style={{ background: C.cream, color: C.ink }}>{hive.population.note}</p>}
            {hive.inspections && hive.inspections.length > 0 && (
              <div className="mt-4">
                <p className="font-body text-xs font-semibold mb-2" style={{ color: C.inkSoft }}>최근 순회 점검</p>
                <div className="space-y-1.5">
                  {hive.inspections.slice().reverse().slice(0, 3).map((ins) => (
                    <div key={ins.id} className="flex items-center gap-2">
                      <Pill_ level={ins.result === "이상" ? "red" : "green"}>{ins.result}</Pill_>
                      <span className="font-mono text-xs" style={{ color: C.inkSoft }}>{fmtDate(ins.date)}</span>
                      {ins.note && <span className="font-body text-xs" style={{ color: C.ink }}>{ins.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="질병 관리" icon={<Bug size={17} color={C.warn} />} right={<Btn small icon={<Plus size={13} />} onClick={() => openModal("disease")}>질병 기록</Btn>}>
            {(!hive.diseases || hive.diseases.length === 0) ? <EmptyState text="기록된 질병이 없습니다." /> : (
              <div className="space-y-2">
                {hive.diseases.slice().reverse().map((d) => (
                  <div key={d.id} className="flex items-start justify-between rounded-lg p-3" style={{ background: d.status === "완치" ? C.greenBg : C.warnBg }}>
                    <div>
                      <p className="font-body text-sm font-semibold" style={{ color: d.status === "완치" ? C.green : C.warn }}>{d.name} · {d.status} <span className="font-mono font-normal ml-1" style={{ color: C.inkSoft }}>{fmtDate(d.foundDate)}</span></p>
                      {d.note && <p className="font-body text-xs mt-0.5" style={{ color: C.ink }}>{d.note}</p>}
                    </div>
                    <div className="flex gap-2 items-center">
                      {d.status !== "완치" && (
                        <button className="font-body text-xs font-semibold underline" style={{ color: C.inkSoft }}
                          onClick={() => updateHive(hive.id, (h) => ({ ...h, diseases: h.diseases.map((x) => x.id === d.id ? { ...x, status: d.status === "관찰중" ? "치료중" : "완치" } : x) }))}>
                          {d.status === "관찰중" ? "치료 시작" : "완치 처리"}
                        </button>
                      )}
                      <button onClick={() => updateHive(hive.id, (h) => ({ ...h, diseases: h.diseases.filter((x) => x.id !== d.id) }))}>
                        <Trash2 size={14} color={C.inkSoft} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}

      {hiveTab === "meds" && (
        <SectionCard title="투약 기록" icon={<Pill size={17} color={C.blue} />} right={<Btn small icon={<Plus size={13} />} onClick={() => openModal("medlog")}>투약 기록 추가</Btn>}>
          {(!hive.medications || hive.medications.length === 0) ? <EmptyState text="투약 기록이 없습니다." /> : (
            <div className="space-y-2">
              {hive.medications.slice().reverse().map((m) => {
                const active = m.withdrawalUntil && m.withdrawalUntil >= todayISO();
                return (
                  <div key={m.id} className="flex items-start justify-between rounded-lg p-3" style={{ background: active ? C.warnBg : C.cream }}>
                    <div>
                      <p className="font-body text-sm font-semibold" style={{ color: C.ink }}>{m.medicineName} <span className="font-mono font-normal ml-1 text-xs" style={{ color: C.inkSoft }}>{fmtDate(m.date)}</span></p>
                      <p className="font-body text-xs mt-0.5" style={{ color: C.inkSoft }}>용량: {m.dosage}{m.note ? ` · ${m.note}` : ""}</p>
                      {active && <p className="font-body text-xs font-semibold mt-1" style={{ color: C.warn }}>⬢ 채밀 금지기간: {fmtDate(m.withdrawalUntil)}까지</p>}
                    </div>
                    <button onClick={() => updateHive(hive.id, (h) => ({ ...h, medications: h.medications.filter((x) => x.id !== m.id) }))}>
                      <Trash2 size={14} color={C.inkSoft} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {hiveTab === "harvest" && (
        <SectionCard title="채밀 기록" icon={<Droplet size={17} color={C.amberDeep} />} right={<Btn small icon={<Plus size={13} />} onClick={() => openModal("harvest")}>채밀 기록 추가</Btn>}>
          {(() => {
            const activeWithdrawal = (hive.medications || []).find((m) => m.withdrawalUntil && m.withdrawalUntil >= todayISO());
            return activeWithdrawal && (
              <div className="rounded-lg p-3 mb-3 flex items-center gap-2" style={{ background: C.redBg }}>
                <AlertTriangle size={16} color={C.red} />
                <p className="font-body text-sm font-semibold" style={{ color: C.red }}>채밀 금지기간 중입니다 ({fmtDate(activeWithdrawal.withdrawalUntil)}까지) — {activeWithdrawal.medicineName}</p>
              </div>
            );
          })()}
          {(!hive.harvests || hive.harvests.length === 0) ? <EmptyState text="채밀 기록이 없습니다." /> : (
            <>
              <p className="font-mono text-sm font-semibold mb-3" style={{ color: C.amberDeep }}>누적 채밀량: {hive.harvests.reduce((s, r) => s + Number(r.amount), 0).toFixed(1)}kg</p>
              <div className="space-y-2">
                {hive.harvests.slice().reverse().map((r) => (
                  <div key={r.id} className="flex items-start justify-between rounded-lg p-3" style={{ background: C.cream }}>
                    <div>
                      <p className="font-body text-sm font-semibold" style={{ color: C.ink }}><span className="font-mono">{r.amount}kg</span> <span className="font-mono font-normal ml-1 text-xs" style={{ color: C.inkSoft }}>{fmtDate(r.date)}</span></p>
                      {r.note && <p className="font-body text-xs mt-0.5" style={{ color: C.inkSoft }}>{r.note}</p>}
                    </div>
                    <button onClick={() => updateHive(hive.id, (h) => ({ ...h, harvests: h.harvests.filter((x) => x.id !== r.id) }))}>
                      <Trash2 size={14} color={C.inkSoft} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      )}
    </div>
  );
}

/* ---------------- Medicine List ---------------- */
function MedicineList({ medicines, onAdd, onEdit, onAdjust, onDelete }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold" style={{ color: C.ink }}>약품 관리</h2>
        <Btn icon={<Plus size={15} />} onClick={onAdd}>약품 추가</Btn>
      </div>
      {medicines.length === 0 ? <EmptyState text="등록된 약품이 없습니다." /> : (
        <div className="space-y-2">
          {medicines.map((m) => {
            const low = m.stock <= (m.minStock ?? 10);
            return (
              <div key={m.id} className="rounded-xl p-4 flex items-center justify-between" style={{ background: C.paper, border: `1px solid ${C.woodLine}` }}>
                <div className="flex items-center gap-3">
                  <span style={{ width: 26, height: 26, background: low ? C.warn : C.wood, display: "flex", alignItems: "center", justifyContent: "center", clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}>
                    <Pill size={13} color="#fff" />
                  </span>
                  <div>
                    <p className="font-display font-semibold" style={{ color: C.ink }}>{m.name}</p>
                    <p className="font-body text-xs" style={{ color: C.inkSoft }}>{m.type} · 채밀금지 {m.withdrawalDays}일{m.note ? ` · ${m.note}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono text-base font-semibold" style={{ color: low ? C.warn : C.ink }}>{m.stock}{m.unit}</p>
                    {low && <p className="font-body text-xs font-semibold" style={{ color: C.warn }}>재고 부족</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => onAdjust(m.id, 1)} className="font-mono text-xs w-6 h-6 rounded" style={{ background: C.cream, color: C.ink }}>+</button>
                    <button onClick={() => onAdjust(m.id, -1)} className="font-mono text-xs w-6 h-6 rounded" style={{ background: C.cream, color: C.ink }}>−</button>
                  </div>
                  <button onClick={() => onEdit(m)}><Edit2 size={15} color={C.inkSoft} /></button>
                  <button onClick={() => onDelete(m.id)}><Trash2 size={15} color={C.inkSoft} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Modal Router (forms + bulk actions) ---------------- */
function ModalRouter({ modal, onClose, hives, setHives, medicines, setMedicines, apiaries, setApiaries, updateHive, clearSelection }) {
  const { type, hiveId, hiveIds, data } = modal;

  if (type === "hive") {
    const isEdit = !!data;
    const [mode, setMode] = useState("single"); // single | bulk
    const [name, setName] = useState(data?.name || "");
    const [apiaryId, setApiaryId] = useState(data?.apiaryId || "");
    const [newApiaryName, setNewApiaryName] = useState("");
    const [location, setLocation] = useState(data?.location || "");
    const [prefix, setPrefix] = useState("");
    const [suffix, setSuffix] = useState("번통");
    const [start, setStart] = useState(1);
    const [count, setCount] = useState(10);
    const [bulkStrength, setBulkStrength] = useState("중");
    const [bulkQueenStatus, setBulkQueenStatus] = useState("신규 도입");

    const resolveApiaryId = () => {
      if (apiaryId === "__new__") {
        if (!newApiaryName.trim()) return null;
        const newId = uid();
        setApiaries((aps) => [...aps, { id: newId, name: newApiaryName.trim() }]);
        return newId;
      }
      return apiaryId;
    };

    const saveSingle = () => {
      if (!name.trim()) return;
      const finalApiaryId = resolveApiaryId();
      if (finalApiaryId === null) return;
      if (isEdit) {
        setHives((hs) => hs.map((h) => h.id === data.id ? { ...h, name, apiaryId: finalApiaryId, location } : h));
      } else {
        setHives((hs) => [...hs, {
          id: uid(), name, apiaryId: finalApiaryId, location, createdAt: todayISO(), note: "",
          queen: { introducedDate: "", birthDate: "", status: "신규 도입", note: "", accidents: [], wingClipped: false, wingClippedDate: "", marked: false, markColor: "", markedDate: "" },
          population: { strength: "중", frames: 0, updatedAt: todayISO(), note: "" },
          diseases: [], medications: [], harvests: [], inspections: [],
        }]);
      }
      onClose();
    };

    const saveBulk = () => {
      const finalApiaryId = resolveApiaryId();
      if (finalApiaryId === null) return;
      const n = Math.max(1, Math.min(500, Number(count) || 1));
      const s = Number(start) || 1;
      const newHives = Array.from({ length: n }, (_, i) => {
        const num = s + i;
        return {
          id: uid(), name: `${prefix}${num}${suffix}`, apiaryId: finalApiaryId, location: "", createdAt: todayISO(), note: "",
          queen: { introducedDate: "", birthDate: "", status: bulkQueenStatus, note: "", accidents: [], wingClipped: false, wingClippedDate: "", marked: false, markColor: "", markedDate: "" },
          population: { strength: bulkStrength, frames: 0, updatedAt: todayISO(), note: "" },
          diseases: [], medications: [], harvests: [], inspections: [],
        };
      });
      setHives((hs) => [...hs, ...newHives]);
      onClose();
    };

    return (
      <Modal title={isEdit ? "벌통 정보 수정" : "벌통 추가"} onClose={onClose} wide={mode === "bulk"}>
        {!isEdit && (
          <div className="flex gap-1 mb-4 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.woodLine}` }}>
            <button onClick={() => setMode("single")} className="flex-1 font-body text-sm font-semibold py-2" style={{ background: mode === "single" ? C.amberDeep : "#fff", color: mode === "single" ? "#fff" : C.wood }}>단일 추가</button>
            <button onClick={() => setMode("bulk")} className="flex-1 font-body text-sm font-semibold py-2" style={{ background: mode === "bulk" ? C.amberDeep : "#fff", color: mode === "bulk" ? "#fff" : C.wood }}>일괄 생성(번호 범위)</button>
          </div>
        )}

        {mode === "single" ? (
          <>
            <Field label="벌통 이름"><input className={inputClass} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 3번통" /></Field>
            <Field label="소속 벌장"><ApiaryPicker apiaries={apiaries} value={apiaryId} onChange={setApiaryId} newName={newApiaryName} onNewName={setNewApiaryName} /></Field>
            <Field label="세부 위치 (선택)"><input className={inputClass} style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 1열, 동쪽 끝" /></Field>
            <Btn onClick={saveSingle}>저장</Btn>
          </>
        ) : (
          <>
            <p className="font-body text-xs rounded-lg p-2.5 mb-3" style={{ background: C.cream, color: C.inkSoft }}>번호 범위로 여러 벌통을 한 번에 만듭니다. 이름은 "접두사+번호+접미사" 형식으로 생성돼요. (예: 접두사 없음, 접미사 "번통", 1~10 → 1번통 ~ 10번통)</p>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="이름 접두사 (선택)"><input className={inputClass} style={inputStyle} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="예: A동-" /></Field>
              <Field label="이름 접미사"><input className={inputClass} style={inputStyle} value={suffix} onChange={(e) => setSuffix(e.target.value)} /></Field>
              <Field label="시작 번호"><input type="number" className={inputClass} style={inputStyle} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label="생성 개수"><input type="number" className={inputClass} style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} /></Field>
            </div>
            <Field label="소속 벌장"><ApiaryPicker apiaries={apiaries} value={apiaryId} onChange={setApiaryId} newName={newApiaryName} onNewName={setNewApiaryName} /></Field>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="기본 세력">
                <select className={inputClass} style={inputStyle} value={bulkStrength} onChange={(e) => setBulkStrength(e.target.value)}>
                  {STRENGTH_OPTS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="기본 여왕벌 상태">
                <select className={inputClass} style={inputStyle} value={bulkQueenStatus} onChange={(e) => setBulkQueenStatus(e.target.value)}>
                  {QUEEN_STATUS_OPTS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <p className="font-body text-sm font-semibold mb-3" style={{ color: C.amberDeep }}>미리보기: {prefix}{start}{suffix} ~ {prefix}{Number(start) + Math.max(0, (Number(count) || 1) - 1)}{suffix} (총 {Math.max(1, Number(count) || 1)}개)</p>
            <Btn onClick={saveBulk}>일괄 생성</Btn>
          </>
        )}
      </Modal>
    );
  }

  if (type === "apiaryManage") {
    const [newName, setNewName] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState("");
    const countFor = (id) => hives.filter((h) => h.apiaryId === id).length;
    return (
      <Modal title="벌장 관리" onClose={onClose}>
        <div className="space-y-2 mb-4">
          {apiaries.length === 0 && <EmptyState text="등록된 벌장이 없습니다." />}
          {apiaries.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg p-2.5" style={{ background: C.cream }}>
              {editingId === a.id ? (
                <input className={inputClass} style={{ ...inputStyle, marginRight: 8 }} value={editingName} onChange={(e) => setEditingName(e.target.value)} autoFocus />
              ) : (
                <div>
                  <p className="font-body text-sm font-semibold" style={{ color: C.ink }}>{a.name}</p>
                  <p className="font-body text-xs" style={{ color: C.inkSoft }}>{countFor(a.id)}개 벌통</p>
                </div>
              )}
              <div className="flex gap-2 shrink-0">
                {editingId === a.id ? (
                  <button onClick={() => { setApiaries((aps) => aps.map((x) => x.id === a.id ? { ...x, name: editingName.trim() || x.name } : x)); setEditingId(null); }}>
                    <CheckCircle2 size={16} color={C.green} />
                  </button>
                ) : (
                  <button onClick={() => { setEditingId(a.id); setEditingName(a.name); }}><Edit2 size={14} color={C.inkSoft} /></button>
                )}
                <button onClick={() => {
                  if (countFor(a.id) > 0 && !confirm(`이 벌장의 벌통 ${countFor(a.id)}개는 "미지정"으로 이동됩니다. 계속할까요?`)) return;
                  setApiaries((aps) => aps.filter((x) => x.id !== a.id));
                  setHives((hs) => hs.map((h) => h.apiaryId === a.id ? { ...h, apiaryId: "" } : h));
                }}><Trash2 size={14} color={C.inkSoft} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className={inputClass} style={inputStyle} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="새 벌장 이름" />
          <Btn small onClick={() => { if (!newName.trim()) return; setApiaries((aps) => [...aps, { id: uid(), name: newName.trim() }]); setNewName(""); }} icon={<Plus size={13} />}>추가</Btn>
        </div>
      </Modal>
    );
  }

  if (type === "queenEdit") {
    const q = data || {};
    const [introducedDate, setIntroducedDate] = useState(q.introducedDate || "");
    const [birthDate, setBirthDate] = useState(q.birthDate || "");
    const [status, setStatus] = useState(q.status || "정상");
    const [note, setNote] = useState(q.note || "");
    const [wingClipped, setWingClipped] = useState(!!q.wingClipped);
    const [wingClippedDate, setWingClippedDate] = useState(q.wingClippedDate || "");
    const [marked, setMarked] = useState(!!q.marked);
    const [markColor, setMarkColor] = useState(q.markColor || MARK_COLOR_OPTIONS[0].hex);
    const [markedDate, setMarkedDate] = useState(q.markedDate || "");
    const save = () => {
      updateHive(hiveId, (h) => ({
        ...h,
        queen: {
          ...h.queen, introducedDate, birthDate, status, note,
          wingClipped, wingClippedDate: wingClipped ? wingClippedDate : "",
          marked, markColor: marked ? markColor : "", markedDate: marked ? markedDate : "",
        },
      }));
      onClose();
    };
    return (
      <Modal title="여왕벌 정보 수정" onClose={onClose} wide>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="도입일"><input type="date" className={inputClass} style={inputStyle} value={introducedDate} onChange={(e) => setIntroducedDate(e.target.value)} /></Field>
          <Field label="출생(사육)일 — 알고 있는 경우"><input type="date" className={inputClass} style={inputStyle} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></Field>
        </div>
        <Field label="상태">
          <select className={inputClass} style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
            {QUEEN_STATUS_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>

        <div className="rounded-lg p-3 mb-3" style={{ background: C.cream }}>
          <label className="font-body text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: C.ink }}>
            <input type="checkbox" checked={wingClipped} onChange={(e) => setWingClipped(e.target.checked)} />
            날개 절단(단시) 여부
          </label>
          {wingClipped && (
            <Field label="절단일"><input type="date" className={inputClass} style={inputStyle} value={wingClippedDate} onChange={(e) => setWingClippedDate(e.target.value)} /></Field>
          )}
        </div>

        <div className="rounded-lg p-3 mb-1" style={{ background: C.cream }}>
          <label className="font-body text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: C.ink }}>
            <input type="checkbox" checked={marked} onChange={(e) => setMarked(e.target.checked)} />
            색 표시(마킹) 여부
          </label>
          {marked && (
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="표시 색상">
                <div className="flex gap-2 flex-wrap">
                  {MARK_COLOR_OPTIONS.map((o) => (
                    <button type="button" key={o.hex} onClick={() => setMarkColor(o.hex)}
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: o.hex, border: markColor === o.hex ? `2px solid ${C.ink}` : `1px solid ${C.woodLine}` }}
                      title={o.label}>
                      {markColor === o.hex && <CheckCircle2 size={14} color={o.hex === "#FFFFFF" || o.hex === "#FFF200" ? C.ink : "#fff"} />}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="표시일"><input type="date" className={inputClass} style={inputStyle} value={markedDate} onChange={(e) => setMarkedDate(e.target.value)} /></Field>
            </div>
          )}
        </div>

        <Field label="메모"><textarea className={inputClass} style={inputStyle} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn onClick={save}>저장</Btn>
      </Modal>
    );
  }

  if (type === "accident") {
    const [aType, setAType] = useState(ACCIDENT_TYPE_OPTS[0]);
    const [date, setDate] = useState(todayISO());
    const [note, setNote] = useState("");
    const save = () => {
      updateHive(hiveId, (h) => ({ ...h, queen: { ...h.queen, accidents: [...(h.queen.accidents || []), { id: uid(), type: aType, date, note }] } }));
      onClose();
    };
    return (
      <Modal title="사고 · 이상 이력 추가" onClose={onClose}>
        <Field label="유형">
          <select className={inputClass} style={inputStyle} value={aType} onChange={(e) => setAType(e.target.value)}>
            {ACCIDENT_TYPE_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="날짜"><input type="date" className={inputClass} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="메모"><textarea className={inputClass} style={inputStyle} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn onClick={save}>저장</Btn>
      </Modal>
    );
  }

  if (type === "population") {
    const p = data || {};
    const [strength, setStrength] = useState(p.strength || "중");
    const [frames, setFrames] = useState(p.frames ?? 0);
    const [note, setNote] = useState(p.note || "");
    const save = () => {
      updateHive(hiveId, (h) => ({ ...h, population: { strength, frames: Number(frames), updatedAt: todayISO(), note } }));
      onClose();
    };
    return (
      <Modal title="개체수 · 세력 정보 수정" onClose={onClose}>
        <Field label="세력">
          <select className={inputClass} style={inputStyle} value={strength} onChange={(e) => setStrength(e.target.value)}>
            {STRENGTH_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="소비(장) 수"><input type="number" className={inputClass} style={inputStyle} value={frames} onChange={(e) => setFrames(e.target.value)} /></Field>
        <Field label="메모"><textarea className={inputClass} style={inputStyle} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn onClick={save}>저장</Btn>
      </Modal>
    );
  }

  if (type === "disease") {
    const [name, setName] = useState(DISEASE_OPTS[0]);
    const [foundDate, setFoundDate] = useState(todayISO());
    const [status, setStatus] = useState("관찰중");
    const [note, setNote] = useState("");
    const save = () => {
      updateHive(hiveId, (h) => ({ ...h, diseases: [...(h.diseases || []), { id: uid(), name, foundDate, status, note }] }));
      onClose();
    };
    return (
      <Modal title="질병 기록 추가" onClose={onClose}>
        <Field label="질병 종류">
          <select className={inputClass} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)}>
            {DISEASE_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="발견일"><input type="date" className={inputClass} style={inputStyle} value={foundDate} onChange={(e) => setFoundDate(e.target.value)} /></Field>
        <Field label="상태">
          <select className={inputClass} style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
            {DISEASE_STATUS_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="메모"><textarea className={inputClass} style={inputStyle} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn onClick={save}>저장</Btn>
      </Modal>
    );
  }

  if (type === "medlog") {
    const [medicineId, setMedicineId] = useState(medicines[0]?.id || "");
    const [date, setDate] = useState(todayISO());
    const [dosage, setDosage] = useState("");
    const [note, setNote] = useState("");
    const save = () => {
      const med = medicines.find((m) => m.id === medicineId);
      if (!med) return;
      const withdrawalUntil = med.withdrawalDays > 0 ? addDays(date, med.withdrawalDays) : "";
      updateHive(hiveId, (h) => ({ ...h, medications: [...(h.medications || []), { id: uid(), medicineId, medicineName: med.name, date, dosage, note, withdrawalUntil }] }));
      onClose();
    };
    return (
      <Modal title="투약 기록 추가" onClose={onClose}>
        <Field label="약품">
          <select className={inputClass} style={inputStyle} value={medicineId} onChange={(e) => setMedicineId(e.target.value)}>
            {medicines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.stock}{m.unit} 재고)</option>)}
          </select>
        </Field>
        <Field label="투약일"><input type="date" className={inputClass} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="용량 / 방법"><input className={inputClass} style={inputStyle} value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="예: 20ml, 패드 처리" /></Field>
        <Field label="메모"><textarea className={inputClass} style={inputStyle} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {medicines.find((m) => m.id === medicineId)?.withdrawalDays > 0 && (
          <p className="font-body text-xs rounded-lg p-2.5 mb-3" style={{ background: C.warnBg, color: C.warn }}>
            이 약품은 투약 후 {medicines.find((m) => m.id === medicineId).withdrawalDays}일간 채밀이 제한됩니다.
          </p>
        )}
        <Btn onClick={save} disabled={!medicineId}>저장</Btn>
      </Modal>
    );
  }

  if (type === "harvest") {
    const [date, setDate] = useState(todayISO());
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const save = () => {
      if (!amount) return;
      updateHive(hiveId, (h) => ({ ...h, harvests: [...(h.harvests || []), { id: uid(), date, amount: Number(amount), note }] }));
      onClose();
    };
    return (
      <Modal title="채밀 기록 추가" onClose={onClose}>
        <Field label="채밀일"><input type="date" className={inputClass} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="채밀량 (kg)"><input type="number" step="0.1" className={inputClass} style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 4.5" /></Field>
        <Field label="메모 (밀원 등)"><input className={inputClass} style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 아까시꿀" /></Field>
        <Btn onClick={save}>저장</Btn>
      </Modal>
    );
  }

  if (type === "medicine") {
    const m = data || {};
    const [name, setName] = useState(m.name || "");
    const [mType, setMType] = useState(m.type || MEDICINE_TYPE_OPTS[0]);
    const [unit, setUnit] = useState(m.unit || "");
    const [stock, setStock] = useState(m.stock ?? 0);
    const [minStock, setMinStock] = useState(m.minStock ?? 10);
    const [withdrawalDays, setWithdrawalDays] = useState(m.withdrawalDays ?? 0);
    const [note, setNote] = useState(m.note || "");
    const save = () => {
      if (!name.trim()) return;
      const payload = { name, type: mType, unit, stock: Number(stock), minStock: Number(minStock), withdrawalDays: Number(withdrawalDays), note };
      if (data) setMedicines((ms) => ms.map((x) => x.id === data.id ? { ...x, ...payload } : x));
      else setMedicines((ms) => [...ms, { id: uid(), ...payload }]);
      onClose();
    };
    return (
      <Modal title={data ? "약품 정보 수정" : "약품 추가"} onClose={onClose} wide>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="약품명"><input className={inputClass} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="구분">
            <select className={inputClass} style={inputStyle} value={mType} onChange={(e) => setMType(e.target.value)}>
              {MEDICINE_TYPE_OPTS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="단위 (ml, g, 개 등)"><input className={inputClass} style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
          <Field label="현재 재고"><input type="number" className={inputClass} style={inputStyle} value={stock} onChange={(e) => setStock(e.target.value)} /></Field>
          <Field label="재고 부족 기준"><input type="number" className={inputClass} style={inputStyle} value={minStock} onChange={(e) => setMinStock(e.target.value)} /></Field>
          <Field label="채밀 금지기간 (일)"><input type="number" className={inputClass} style={inputStyle} value={withdrawalDays} onChange={(e) => setWithdrawalDays(e.target.value)} /></Field>
        </div>
        <Field label="메모"><textarea className={inputClass} style={inputStyle} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn onClick={save}>저장</Btn>
      </Modal>
    );
  }

  /* ---- bulk actions on selected hives ---- */
  if (type === "bulkMedlog") {
    const [medicineId, setMedicineId] = useState(medicines[0]?.id || "");
    const [date, setDate] = useState(todayISO());
    const [dosage, setDosage] = useState("");
    const [note, setNote] = useState("");
    const save = () => {
      const med = medicines.find((m) => m.id === medicineId);
      if (!med) return;
      const withdrawalUntil = med.withdrawalDays > 0 ? addDays(date, med.withdrawalDays) : "";
      setHives((hs) => hs.map((h) => hiveIds.includes(h.id)
        ? { ...h, medications: [...(h.medications || []), { id: uid(), medicineId, medicineName: med.name, date, dosage, note, withdrawalUntil }] }
        : h));
      clearSelection(); onClose();
    };
    return (
      <Modal title={`선택한 ${hiveIds.length}개 벌통에 투약 기록 추가`} onClose={onClose}>
        <Field label="약품">
          <select className={inputClass} style={inputStyle} value={medicineId} onChange={(e) => setMedicineId(e.target.value)}>
            {medicines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.stock}{m.unit} 재고)</option>)}
          </select>
        </Field>
        <Field label="투약일"><input type="date" className={inputClass} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="용량 / 방법"><input className={inputClass} style={inputStyle} value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="예: 20ml, 패드 처리" /></Field>
        <Field label="메모"><textarea className={inputClass} style={inputStyle} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn onClick={save} disabled={!medicineId}>선택 벌통 전체에 저장</Btn>
      </Modal>
    );
  }

  if (type === "bulkDisease") {
    const [name, setName] = useState(DISEASE_OPTS[0]);
    const [foundDate, setFoundDate] = useState(todayISO());
    const [status, setStatus] = useState("관찰중");
    const [note, setNote] = useState("");
    const save = () => {
      setHives((hs) => hs.map((h) => hiveIds.includes(h.id)
        ? { ...h, diseases: [...(h.diseases || []), { id: uid(), name, foundDate, status, note }] }
        : h));
      clearSelection(); onClose();
    };
    return (
      <Modal title={`선택한 ${hiveIds.length}개 벌통에 질병 기록 추가`} onClose={onClose}>
        <Field label="질병 종류">
          <select className={inputClass} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)}>
            {DISEASE_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="발견일"><input type="date" className={inputClass} style={inputStyle} value={foundDate} onChange={(e) => setFoundDate(e.target.value)} /></Field>
        <Field label="상태">
          <select className={inputClass} style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
            {DISEASE_STATUS_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="메모"><textarea className={inputClass} style={inputStyle} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Btn onClick={save}>선택 벌통 전체에 저장</Btn>
      </Modal>
    );
  }

  if (type === "bulkHarvest") {
    const [date, setDate] = useState(todayISO());
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const save = () => {
      if (!amount) return;
      setHives((hs) => hs.map((h) => hiveIds.includes(h.id)
        ? { ...h, harvests: [...(h.harvests || []), { id: uid(), date, amount: Number(amount), note }] }
        : h));
      clearSelection(); onClose();
    };
    return (
      <Modal title={`선택한 ${hiveIds.length}개 벌통에 채밀 기록 추가`} onClose={onClose}>
        <p className="font-body text-xs rounded-lg p-2.5 mb-3" style={{ background: C.warnBg, color: C.warn }}>선택한 모든 벌통에 동일한 채밀량이 기록됩니다. 벌통별로 양이 다르면 개별 벌통에서 나중에 수정하세요.</p>
        <Field label="채밀일"><input type="date" className={inputClass} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="벌통당 채밀량 (kg)"><input type="number" step="0.1" className={inputClass} style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 4.5" /></Field>
        <Field label="메모 (밀원 등)"><input className={inputClass} style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 아까시꿀" /></Field>
        <Btn onClick={save}>선택 벌통 전체에 저장</Btn>
      </Modal>
    );
  }

  if (type === "bulkMove") {
    const [apiaryId, setApiaryId] = useState("");
    const [newApiaryName, setNewApiaryName] = useState("");
    const save = () => {
      let finalId = apiaryId;
      if (apiaryId === "__new__") {
        if (!newApiaryName.trim()) return;
        finalId = uid();
        setApiaries((aps) => [...aps, { id: finalId, name: newApiaryName.trim() }]);
      }
      setHives((hs) => hs.map((h) => hiveIds.includes(h.id) ? { ...h, apiaryId: finalId } : h));
      clearSelection(); onClose();
    };
    return (
      <Modal title={`선택한 ${hiveIds.length}개 벌통 벌장 이동`} onClose={onClose}>
        <Field label="이동할 벌장"><ApiaryPicker apiaries={apiaries} value={apiaryId} onChange={setApiaryId} newName={newApiaryName} onNewName={setNewApiaryName} /></Field>
        <Btn onClick={save}>이동</Btn>
      </Modal>
    );
  }

  return null;
}
