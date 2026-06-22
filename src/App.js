import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  MiniMap,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from './supabaseClient';
const EVENT_NAMES = [
  "CMP0",
  "CMP1",
  "CMP2",
  "CMP3",
  "TIMER",
  "!CMP0",
  "!CMP1",
  "!CMP2",
  "!CMP3",
  "!TIMER",
];

const BIT_SHIFTS = [0, 3, 6, 9, 12, 16, 19, 22, 25, 28];
const NODE_SIZE = 70;
const NODE_RADIUS = NODE_SIZE / 2;

const AuthContext = createContext({ user: null, loading: true, signOut: async () => {} });

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

function AuthGate() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSignUp = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert("Проверьте почту для подтверждения аккаунта");
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (user) return null;

  return (
    <div style={{ position: "absolute", top: 20, right: 20, zIndex: 50, width: 320, background: "white", border: "1px solid #ccc", borderRadius: 12, padding: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Вход / регистрация</div>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 8, boxSizing: "border-box" }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 12, boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleLogin} disabled={busy} style={btnStyle("#2196f3")}>Войти</button>
        <button onClick={handleSignUp} disabled={busy} style={btnStyle("#673ab7")}>Регистрация</button>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
      </div>
    </div>
  );
}

function btnStyle(bg) {
  return {
    flex: 1,
    padding: "10px 12px",
    background: bg,
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  };
}
function signedSpread(index) {
  if (index === 0) return 0;
  return index % 2 === 1 ? Math.ceil(index / 2) : -Math.ceil(index / 2);
}

function FsmEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data }) {
  const isLoop = data?.kind === "loop";
  const routeIndex = data?.routeIndex ?? 0;
  const routeTotal = data?.routeTotal ?? 1;
  const label = data?.label ?? "";

  let path = "";
  let labelX = 0;
  let labelY = 0;

  if (isLoop) {
    const loopStep = 18;
    const loopHeight = 100 + routeIndex * loopStep;
    const sideShift = (routeIndex - (routeTotal - 1) / 2) * 20;

    const startX = sourceX + NODE_RADIUS * 0.7;
    const endX = sourceX - NODE_RADIUS * 0.7;
    const topY = sourceY - loopHeight;

    const c1X = sourceX + 55 + sideShift;
    const c2X = sourceX - 55 + sideShift;

    path = `M ${startX},${sourceY - 60}
            C ${c1X},${topY}
              ${c2X},${topY}
              ${endX},${sourceY - 60}`;

    labelX = sourceX + sideShift;
    labelY = topY - 14;
  } else {
    const bendStep = 44;
    const bend = routeTotal > 1 ? signedSpread(routeIndex) * bendStep : 0;

    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const len = Math.hypot(dx, dy) || 1;

    const nx = -dy / len;
    const ny = dx / len;

    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    const ctrlX = midX + nx * bend;
    const ctrlY = midY + ny * bend;

    path = `M ${sourceX},${sourceY} Q ${ctrlX},${ctrlY} ${targetX},${targetY}`;
    labelX = ctrlX;
    labelY = ctrlY - 12;
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: "black", strokeWidth: 2 }} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "white",
              border: "1px solid black",
              borderRadius: 8,
              padding: "2px 6px",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FSMEditor/>
    </AuthProvider>
  );
}

function FSMEditor() {
  const fileInputRef = useRef(null);
  const { user, signOut } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [cmpExit, setCmpExit] = useState([0, 0, 0, 0]);
  const [contexts, setContexts] = useState(Array(8).fill(0));
  const [visibility, setVisibility] = useState(Array(8).fill(1));
  const [cmpValues, setCmpValues] = useState(["0x00000000", "0x00000000", "0x00000000", "0x00000000"]);
  const [timer, setTimer] = useState("0");
  const [cloudFiles, setCloudFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const nodeTypes = useMemo(() => ({}), []);
  const edgeTypes = useMemo(() => ({ fsm: FsmEdge }), []);

  const getNodeStyle = useCallback(
    (id) => ({
      background: contexts[id] ? "#ffcc80" : "#b3e5fc",
      border: "1px solid black",
      borderRadius: "50%",
      width: NODE_SIZE,
      height: NODE_SIZE,
      display: visibility[id] ? "flex" : "none",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      fontWeight: "bold",
      zIndex: 1,
    }),
    [contexts, visibility]
  );

  useEffect(() => {
    const radius = 200;
    const cx = 300;
    const cy = 300;
    const initialNodes = Array.from({ length: 8 }, (_, i) => {
      const angle = (2 * Math.PI * i) / 8;
      return {
        id: String(i),
        position: { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius },
        data: { label: `S${i}` },
        style: getNodeStyle(i),
      };
    });
    setNodes(initialNodes);
  }, [getNodeStyle, setNodes]);

  useEffect(() => {
    if (!user) {
      setCloudFiles([]);
      return;
    }
    fetchCloudFiles();
  }, [user]);

  const getAllowedEvents = (stateId) => {
    const s = Number(stateId);
    if (s === 0) {
      const allowed = [];
      if (cmpExit[0]) allowed.push(0, 5);
      if (cmpExit[1]) allowed.push(1, 6);
      if (cmpExit[2]) allowed.push(2, 7);
      if (cmpExit[3]) allowed.push(3, 8);
      return allowed;
    }
    if (s === 1 && !cmpExit[1]) return [1, 6];
    if (s === 2 && !cmpExit[2]) return [2, 7];
    if (s === 3 && !cmpExit[3]) return [3, 8];
    if (s === 4 && !cmpExit[0]) return [0, 5];
    if (s === 5) return [4, 9];
    return [];
  };

  const onConnect = useCallback(
    (params) => {
      const allowed = getAllowedEvents(params.source);
      if (allowed.length === 0) {
        alert("Из этого состояния переходы запрещены");
        return;
      }
      setSelectedConnection({ ...params, allowed });
      setShowDialog(true);
    },
    [cmpExit]
  );

  const confirmEvent = (eventIndex) => {
    if (!selectedConnection) return;
    const { source, target } = selectedConnection;
    const src = Number(source);

    if ([0, 5].includes(eventIndex) && cmpExit[0] && src !== 0) return alert("CMP0 принадлежит S0");
    if ([1, 6].includes(eventIndex) && cmpExit[1] && src !== 0) return alert("CMP1 принадлежит S0");
    if ([2, 7].includes(eventIndex) && cmpExit[2] && src !== 0) return alert("CMP2 принадлежит S0");
    if ([3, 8].includes(eventIndex) && cmpExit[3] && src !== 0) return alert("CMP3 принадлежит S0");

    const isLoop = source === target;
    const newEdge = {
      id: `${source}-${target}-${eventIndex}`,
      source,
      target,
      type: "fsm",
      label: EVENT_NAMES[eventIndex],
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      zIndex: 10,
      data: { eventIndex, label: EVENT_NAMES[eventIndex], kind: isLoop ? "loop" : "edge" },
    };

    setEdges((eds) => {
      const withoutSameEvent = eds.filter((e) => e.data?.eventIndex !== eventIndex);
      return [...withoutSameEvent, newEdge];
    });

    setShowDialog(false);
    setSelectedConnection(null);
  };

  const decoratedEdges = useMemo(() => {
    const groups = new Map();
    for (const edge of edges) {
      const key = edge.source === edge.target ? `loop:${edge.source}` : [edge.source, edge.target].sort().join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(edge);
    }

    return edges.map((edge) => {
      const key = edge.source === edge.target ? `loop:${edge.source}` : [edge.source, edge.target].sort().join("|");
      const group = groups.get(key) || [];
      const ordered = [...group].sort((a, b) => (a.data?.eventIndex ?? 0) - (b.data?.eventIndex ?? 0));
      const routeIndex = Math.max(0, ordered.findIndex((e) => e.id === edge.id));

      return {
        ...edge,
        data: {
          ...edge.data,
          routeIndex,
          routeTotal: ordered.length || 1,
          kind: edge.source === edge.target ? "loop" : "edge",
        },
      };
    });
  }, [edges]);

  const updateContexts = (i) => {
    const copy = [...contexts];
    copy[i] ^= 1;
    setContexts(copy);
    setNodes((nds) => nds.map((n) => (n.id === String(i) ? { ...n, style: getNodeStyle(i) } : n)));
  };

  const updateVisibility = (i) => {
    const copy = [...visibility];
    copy[i] ^= 1;
    setVisibility(copy);
    setNodes((nds) => nds.map((n) => (n.id === String(i) ? { ...n, style: getNodeStyle(i) } : n)));
    setEdges((eds) => eds.map((e) => ({ ...e, hidden: !(copy[e.source] && copy[e.target]) })));
  };

  const deleteEdge = (edgeId) => setEdges((eds) => eds.filter((e) => e.id !== edgeId));

  function serializeConfig() {
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);
    let offset = 0;

    for (let i = 0; i < 4; i++) {
      view.setUint32(offset, parseInt(cmpValues[i], 16) || 0, true);
      offset += 4;
    }

    let nextVals = 0;
    for (let i = 0; i < 10; i++) {
      const edge = edges.find((e) => e.data?.eventIndex === i);
      if (edge) {
        nextVals |= (Number(edge.target) & 0x7) << BIT_SHIFTS[i];
      }
    }
    view.setUint32(offset, nextVals, true);
    offset += 4;

    let detectVal = 0;
    for (let s = 0; s < 8; s++) if (contexts[s]) detectVal |= 1 << s;
    for (let c = 0; c < 4; c++) if (cmpExit[c]) detectVal |= 1 << (16 + c);
    view.setUint32(offset, detectVal, true);
    offset += 4;

    view.setUint32(offset, parseInt(timer, 10) || 0, true);
    return buffer;
  }

  function applyBuffer(buffer) {
    if (buffer.byteLength < 24) {
      alert("Файл слишком мал");
      return;
    }

    const view = new DataView(buffer);
    let offset = 0;

    const newCmpValues = [];
    for (let i = 0; i < 4; i++) {
      const val = view.getUint32(offset, true);
      newCmpValues.push(`0x${val.toString(16).padStart(8, "0")}`);
      offset += 4;
    }
    setCmpValues(newCmpValues);

    const nextVals = view.getUint32(offset, true);
    offset += 4;

    const detectVal = view.getUint32(offset, true);
    offset += 4;
    const newContexts = Array(8).fill(0);
    for (let s = 0; s < 8; s++) newContexts[s] = (detectVal >> s) & 1;
    setContexts(newContexts);

    const newCmpExit = Array(4).fill(0);
    for (let c = 0; c < 4; c++) newCmpExit[c] = (detectVal >> (16 + c)) & 1;
    setCmpExit(newCmpExit);

    const newTimer = buffer.byteLength >= 32 ? view.getUint32(offset, true) : 0;
    setTimer(String(newTimer));

    const newEdges = [];
    for (let i = 0; i < 10; i++) {
      const targetState = (nextVals >>> BIT_SHIFTS[i]) & 0x7;

      let sourceState = 0;
      if (i === 0 || i === 5) sourceState = newCmpExit[0] ? 0 : 4;
      else if (i === 1 || i === 6) sourceState = newCmpExit[1] ? 0 : 1;
      else if (i === 2 || i === 7) sourceState = newCmpExit[2] ? 0 : 2;
      else if (i === 3 || i === 8) sourceState = newCmpExit[3] ? 0 : 3;
      else if (i === 4 || i === 9) sourceState = 5;

      const sourceStr = String(sourceState);
      const targetStr = String(targetState);
      const isLoop = sourceStr === targetStr;

      newEdges.push({
        id: `${sourceStr}-${targetStr}-${i}`,
        source: sourceStr,
        target: targetStr,
        type: "fsm",
        label: EVENT_NAMES[i],
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        zIndex: 10,
        data: { eventIndex: i, label: EVENT_NAMES[i], kind: isLoop ? "loop" : "edge" },
      });
    }

    setEdges(newEdges);
  }

  const saveToBin = useCallback(() => {
    const buffer = serializeConfig();
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fsm_config.bin";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [cmpValues, edges, contexts, cmpExit, timer]);

  const loadFromBin = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => applyBuffer(e.target.result);
    reader.readAsArrayBuffer(file);
    event.target.value = null;
  }, []);

  async function fetchCloudFiles() {
    if (!user) return;
    const { data, error } = await supabase.from("binaries").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) console.error(error);
    else setCloudFiles(data || []);
  }

  async function saveToCloud() {
    if (!user) return alert("Сначала войдите в аккаунт.");
    const fileName = prompt("Введите название:");
    if (!fileName) return;

    setIsUploading(true);
    try {
      const buffer = serializeConfig();
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const filePath = `${user.id}/${Date.now()}_${fileName}.bin`;

      const { error: storageError } = await supabase.storage.from("binaries").upload(filePath, blob, { upsert: true });
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("binaries").insert([{ user_id: user.id, name: fileName, file_path: filePath }]);
      if (dbError) throw dbError;

      await fetchCloudFiles();
      alert("Сохранено в облако.");
    } catch (err) {
      alert(`Ошибка при сохранении: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  async function loadFromCloud(filePath) {
    try {
      const { data, error } = await supabase.storage.from("binaries").download(filePath);
      if (error) throw error;
      const reader = new FileReader();
      reader.onload = (e) => applyBuffer(e.target.result);
      reader.readAsArrayBuffer(data);
    } catch (err) {
      alert(`Не удалось загрузить файл: ${err.message}`);
    }
  }

  async function deleteFromCloud(dbId, filePath) {
    if (!window.confirm("Удалить?")) return;
    try {
      const { error: storageError } = await supabase.storage.from("binaries").remove([filePath]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from("binaries").delete().eq("id", dbId);
      if (dbError) throw dbError;
      setCloudFiles((prev) => prev.filter((f) => f.id !== dbId));
    } catch (err) {
      alert(`Не удалось удалить файл: ${err.message}`);
    }
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      <AuthGate />

      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 20, padding: 12, background: "white", border: "1px solid #ddd", borderRadius: 12, width: 320, maxHeight: "95vh", overflowY: "auto", boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <b>FSM editor</b>
          {user ? <button onClick={signOut} style={btnStyle("#d32f2f")}>Выйти</button> : <span style={{ fontSize: 12, color: "#666" }}> Вы не авторизованы </span>}
        </div>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <button
            onMouseEnter={() => setShowHelp(true)}
            onMouseLeave={() => setShowHelp(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid #999",
              background: "#fafafa",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: 18,
            }}
          >
            ?
          </button>

          {showHelp && (
            <div
              style={{
                position: "absolute",
                top: 40,
                left: 0,
                width: 280,
                background: "white",
                border: "1px solid #ccc",
                borderRadius: 10,
                padding: 12,
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                zIndex: 1000,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
      <b>Инструкция:</b>

      <ul style={{ paddingLeft: 18 }}>
        <li>S0 –  программируемый компаратор</li>
        <li>S1 – CMP1 – компаратор</li>
        <li>S2 – CMP2 – компаратор</li>
        <li>S3 – CMP3 – специализированный компаратор</li>
        <li>S4 – CMP0 – компаратор</li>
        <li>S6 – зарезервирован на будущее</li>
        <li>S7 – зарезервирован на будущее</li>
        <li>Загрузить .bin — загрузка конфигурации cd в приложение для редактирования</li>
        <li>Скачать .bin — сохранение бинарного файла в память устройства</li>
        <li>Скрыть нужные состояния и переходы можно кнопками на панели</li>
        <li>Удалить переходы можно двойным нажатием на соответсвующий переход в панели</li>
      </ul>
    </div>
  )}
</div>
        <div>
          <b>CMP:</b>
          {cmpValues.map((v, i) => (
            <input
              key={i}
              value={v}
              onChange={(e) => {
                const copy = [...cmpValues];
                copy[i] = e.target.value;
                setCmpValues(copy);
              }}
              style={{ display: "block", margin: 2, width: "100%", boxSizing: "border-box" }}
            />
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          <b>Timer:</b>
          <input value={timer} onChange={(e) => setTimer(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
        </div>

        <div style={{ marginTop: 10 }}>
          <b>CMP_EXIT:</b>
          <div>
            {cmpExit.map((v, i) => (
              <label key={i} style={{ marginRight: 8 }}>
                <input
                  type="checkbox"
                  checked={!!v}
                  onChange={() => {
                    const copy = [...cmpExit];
                    copy[i] ^= 1;
                    setCmpExit(copy);
                  }}
                />
                {i}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <b>Контекст:</b>
          <div>
            {contexts.map((v, i) => (
              <label key={i} style={{ marginRight: 8 }}>
                <input type="checkbox" checked={!!v} onChange={() => updateContexts(i)} /> S{i}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <b>Видимость:</b>
          <div>
            {visibility.map((v, i) => (
              <label key={i} style={{ marginRight: 8 }}>
                <input type="checkbox" checked={!!v} onChange={() => updateVisibility(i)} /> S{i}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <b>Переходы:</b>
          <ul style={{ maxHeight: 140, overflowY: "auto", paddingLeft: 16, background: "#f7f7f7", padding: 8, borderRadius: 8 }}>
            {edges.map((e) => (
              <li key={e.id} style={{ cursor: "pointer" }} onDoubleClick={() => deleteEdge(e.id)}>
                {e.label}: S{e.source} → S{e.target}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input ref={fileInputRef} type="file" accept=".bin" style={{ display: "none" }} onChange={loadFromBin} />
          <button onClick={() => fileInputRef.current?.click()} style={btnStyle("#2196f3")}>Загрузить .bin</button>
          <button onClick={saveToBin} style={btnStyle("#4caf50")}>Скачать .bin</button>
        </div>

        <div style={{ marginTop: 8 }}>
          <button onClick={saveToCloud} disabled={isUploading || !user} style={{ ...btnStyle("#673ab7"), width: "100%", opacity: isUploading || !user ? 0.6 : 1 }}>
            {isUploading ? "Сохраняю..." : "Сохранить в облако"}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <b>Файлы:</b>
          {!user ? (
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>Войдите, чтобы видеть файлы из облака.</div>
          ) : cloudFiles.length === 0 ? (
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>Пока пусто.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
              {cloudFiles.map((f) => (
                <li key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 6, background: "#f1f1f1", padding: 6, borderRadius: 8 }}>
                  <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>{f.name}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => loadFromCloud(f.file_path)} style={smallBtn("#2196f3")}>⬇</button>
                    <button onClick={() => deleteFromCloud(f.id, f.file_path)} style={smallBtn("#d32f2f")}>×</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={decoratedEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        connectionLineType="smoothstep"
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>

      {showDialog && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "white", padding: 20, border: "1px solid black", zIndex: 100, borderRadius: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Выберите событие:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {selectedConnection?.allowed?.map((i) => (
              <button key={i} onClick={() => confirmEvent(i)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc", background: "#f5f5f5", cursor: "pointer" }}>
                {EVENT_NAMES[i]}
              </button>
            ))}
          </div>
          <button onClick={() => setShowDialog(false)} style={btnStyle("#d32f2f")}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function smallBtn(bg) {
  return {
    padding: "4px 8px",
    border: "none",
    borderRadius: 6,
    color: "white",
    background: bg,
    cursor: "pointer",
    fontSize: 12,
  };
}
