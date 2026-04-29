"use client";
import { useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const langToExt: Record<string, string> = {
  python: "py", py: "py", javascript: "js", js: "js", typescript: "ts", ts: "ts",
  tsx: "tsx", jsx: "jsx", html: "html", css: "css", json: "json", bash: "sh",
  shell: "sh", sh: "sh", sql: "sql", rust: "rs", go: "go", java: "java",
  cpp: "cpp", c: "c", markdown: "md", yaml: "yml", toml: "toml", xml: "xml",
};

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);
  const lines = code.split("\n").length;
  const ext   = langToExt[language.toLowerCase()] ?? "txt";

  function copy() {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob([code], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `code.${ext}`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 8, margin: "12px 0", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "#0d0d0d", borderBottom: expanded ? "1px solid #1e1e1e" : "none" }}>
        <span style={{ fontSize: 12, color: "#76b900", fontFamily: "monospace", fontWeight: 600 }}>{language || "code"}</span>
        <span style={{ fontSize: 11, color: "#444" }}>{lines} {lines === 1 ? "line" : "lines"}</span>
        <div style={{ flex: 1 }} />
        <button onClick={copy}              style={cbtn}>{copied ? "✓ copied" : "copy"}</button>
        <button onClick={download}          style={cbtn}>↓ save</button>
        <button onClick={() => setExpanded(e => !e)} style={cbtn}>{expanded ? "▲" : "▼"}</button>
      </div>
      {expanded && (
        <pre style={{ margin: 0, padding: "14px", overflowX: "auto", fontSize: 13, lineHeight: 1.65, color: "#ccc", fontFamily: "monospace" }}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

const cbtn: React.CSSProperties = {
  background: "none", border: "1px solid #2a2a2a", borderRadius: 4,
  color: "#666", fontSize: 11, cursor: "pointer", padding: "2px 8px",
  fontFamily: "monospace",
};

type Role = "user" | "assistant";
type MediaKind = "image" | "audio" | "video" | "video+audio" | null;

interface Message {
  role: Role;
  text: string;
  mediaKind?: MediaKind;
  mediaUrl?: string;
  mediaName?: string;
  thinking: boolean;
  elapsed?: number;
}

export default function Home() {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [thinking, setThinking]   = useState(true);
  const [loading, setLoading]     = useState(false);
  const [dragging, setDragging]   = useState(false);
  const [mediaB64, setMediaB64]   = useState<string | null>(null);
  const [mediaMime, setMediaMime] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [mediaKind, setMediaKind] = useState<MediaKind>(null);
  const [recording, setRecording]   = useState(false);
  const fileRef      = useRef<HTMLInputElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const startRef     = useRef<number>(0);
  const mediaRecRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);

  function detectKind(mime: string): MediaKind {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.startsWith("video/")) return "video";
    return null;
  }

  function loadFile(file: File) {
    setMediaMime(file.type);
    setMediaName(file.name);
    setMediaKind(detectKind(file.type));
    const reader = new FileReader();
    reader.onload = () => setMediaB64((reader.result as string).split(",")[1]);
    reader.readAsDataURL(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }, []);

  async function toggleRecording() {
    if (recording) {
      mediaRecRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onload = () => {
          setMediaB64((reader.result as string).split(",")[1]);
          setMediaMime(mime);
          setMediaName("recording.webm");
          setMediaKind("audio");
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
    } catch {
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  }

  function clearMedia() {
    setMediaB64(null); setMediaMime(""); setMediaName(""); setMediaKind(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function buildMessages(): unknown[] {
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const content: unknown[] = [];
    if (mediaB64 && mediaKind) {
      const url = `data:${mediaMime};base64,${mediaB64}`;
      if (mediaKind === "image")  content.push({ type: "image_url",  image_url:  { url } });
      if (mediaKind === "audio")  content.push({ type: "audio_url",  audio_url:  { url } });
      if (mediaKind === "video" || mediaKind === "video+audio")
                                  content.push({ type: "video_url",  video_url:  { url } });
    }
    content.push({ type: "text", text: input });
    return [...history, { role: "user", content }];
  }

  async function send() {
    if (!input.trim() && !mediaB64) return;
    const userMsg: Message = {
      role: "user", text: input, mediaKind, mediaName,
      mediaUrl: mediaB64 ? `data:${mediaMime};base64,${mediaB64}` : undefined,
      thinking,
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput(""); clearMedia();
    setLoading(true);
    startRef.current = Date.now();

    const asstMsg: Message = { role: "assistant", text: "", thinking };
    setMessages([...updated, asstMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: buildMessages(), thinking, mediaType: mediaKind }),
      });
      if (!res.ok) {
        const err = await res.json();
        setMessages((p) => { const c=[...p]; c[c.length-1]={...c[c.length-1], text:`Error: ${err.error??res.statusText}`}; return c; });
        return;
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") break;
          try {
            const content = JSON.parse(data).choices?.[0]?.delta?.content ?? "";
            if (content) setMessages((p) => {
              const c = [...p];
              c[c.length-1] = { ...c[c.length-1], text: c[c.length-1].text + content };
              return c;
            });
          } catch {}
        }
      }
    } finally {
      const elapsed = ((Date.now() - startRef.current) / 1000).toFixed(1);
      setMessages((p) => { const c=[...p]; c[c.length-1]={...c[c.length-1], elapsed: parseFloat(elapsed)}; return c; });
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div
      style={s.root}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* Header */}
      <div style={s.header}>
        <span style={s.title}>Multimodal Chat</span>
        <div style={{ flex: 1 }} />
        <label style={s.toggleWrap}>
          <span style={{ fontSize: 12, color: thinking ? "#76b900" : "#555" }}>Thinking</span>
          <div
            style={{ ...s.toggleTrack, background: thinking ? "#76b900" : "#2a2a2a" }}
            onClick={() => setThinking(t => !t)}
          >
            <div style={{ ...s.toggleThumb, left: thinking ? 18 : 2 }} />
          </div>
        </label>
      </div>

      {/* Messages */}
      <div style={s.messages}>
        {messages.length === 0 && (
          <div style={s.empty}>
            <div style={{ fontSize: 52, color: "#76b900", marginBottom: 12 }}>⬡</div>
            <div style={{ fontSize: 16, color: "#666" }}>Ask about a video, audio, image, or PDF</div>
            <div style={{ fontSize: 13, color: "#444", marginTop: 6 }}>Drag and drop a file or use the paperclip below</div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 6 }}>

            {/* Terminal block for user media */}
            {m.role === "user" && m.mediaName && (
              <div style={s.terminal}>
                <div style={s.terminalHeader}>
                  <span style={s.terminalDot} />
                  <span style={{ fontSize: 10, color: "#555", letterSpacing: 1 }}>ATTACHED FILE</span>
                </div>
                <div style={s.terminalBody}>
                  <span style={{ color: "#76b900" }}>$</span>{" "}
                  <span style={{ color: "#aaa" }}>
                    nemotron-omni --input &quot;{m.mediaName}&quot; &quot;{m.text}&quot;
                  </span>
                </div>
                {m.mediaUrl && m.mediaKind === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.mediaUrl} alt="" style={s.mediaPreview} />
                )}
                {m.mediaUrl && m.mediaKind === "audio" && (
                  <audio controls src={m.mediaUrl} style={{ width: "100%", marginTop: 8 }} />
                )}
                {m.mediaUrl && (m.mediaKind === "video" || m.mediaKind === "video+audio") && (
                  <video controls src={m.mediaUrl} style={s.mediaPreview} />
                )}
              </div>
            )}

            {/* Bubble */}
            <div style={{ ...s.bubble, ...(m.role === "user" ? s.userBubble : s.aiBubble) }}>
              {m.role === "user" ? (
                <span>{m.text}</span>
              ) : (
                <>
                  {/* Thinking indicator */}
                  {m.thinking && loading && i === messages.length - 1 && !m.text && (
                    <div style={s.thinkingRow}>
                      <span style={s.spinner} />
                      <span style={{ fontSize: 13, color: "#76b900" }}>Thinking...</span>
                    </div>
                  )}
                  <div style={s.mdBody} className="md">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children }) {
                          const match = /language-(\w+)/.exec(className || "");
                          const codeStr = String(children).replace(/\n$/, "");
                          if (codeStr.includes("\n") || match) {
                            return <CodeBlock language={match?.[1] ?? ""} code={codeStr} />;
                          }
                          return (
                            <code style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 4, padding: "1px 6px", fontFamily: "monospace", fontSize: 13, color: "#76b900" }}>
                              {children}
                            </code>
                          );
                        },
                        pre({ children }) { return <>{children}</>; },
                      }}
                    >
                      {m.text || (loading && i === messages.length - 1 ? "▌" : "")}
                    </ReactMarkdown>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Drop overlay */}
      {dragging && (
        <div style={s.dropOverlay}>
          <div style={{ fontSize: 48 }}>📎</div>
          <div style={{ fontSize: 18, marginTop: 12 }}>Drop file to attach</div>
        </div>
      )}

      {/* Input */}
      <div style={s.inputArea}>
        {recording && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, color:"#ff4444", fontSize:13 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#ff4444", display:"inline-block", animation:"pulse 1s ease-in-out infinite" }} />
            Recording… click ⏹ to stop
          </div>
        )}
        {mediaName && (
          <div style={s.attachedFile}>
            <span style={{ fontSize: 13 }}>📎 {mediaName}</span>
            <button style={s.removeBtn} onClick={clearMedia}>✕</button>
          </div>
        )}
        <div style={s.inputRow}>
          <button style={s.iconBtn} onClick={() => fileRef.current?.click()} title="Attach file">
            📎
          </button>
          <input
            ref={fileRef} type="file" style={{ display: "none" }}
            accept="image/*,audio/*,video/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about a video, audio, or PDF — drag one in"
            style={s.textarea}
            rows={1}
            disabled={loading}
          />
          <button
            style={{ ...s.iconBtn, color: recording ? "#ff4444" : "#555" }}
            title={recording ? "Stop recording" : "Record audio"}
            onClick={toggleRecording}
          >
            {recording ? "⏹" : "🎙"}
          </button>
          <button
            onClick={send}
            disabled={loading || (!input.trim() && !mediaB64)}
            style={{ ...s.sendBtn, opacity: loading || (!input.trim() && !mediaB64) ? 0.4 : 1 }}
          >
            {loading ? "■" : "↑"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
        textarea:focus { outline: none; }
        textarea { scrollbar-width: none; }
        .md p { margin: 0 0 12px; }
        .md p:last-child { margin-bottom: 0; }
        .md strong { color: #fff; font-weight: 700; }
        .md h1,.md h2,.md h3 { color: #fff; margin: 16px 0 8px; font-weight: 600; }
        .md h1 { font-size: 1.3em; }
        .md h2 { font-size: 1.15em; }
        .md h3 { font-size: 1.05em; }
        .md ul,.md ol { padding-left: 20px; margin: 0 0 12px; }
        .md li { margin-bottom: 4px; }
        .md table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
        .md th { background: #1a1a1a; color: #76b900; padding: 8px 12px; border: 1px solid #2a2a2a; text-align: left; font-weight: 600; }
        .md td { padding: 7px 12px; border: 1px solid #1e1e1e; color: #ccc; }
        .md tr:nth-child(even) td { background: #0f0f0f; }
        .md blockquote { border-left: 3px solid #76b900; padding-left: 12px; color: #777; margin: 12px 0; }
        .md a { color: #76b900; text-decoration: none; }
        .md hr { border: none; border-top: 1px solid #222; margin: 16px 0; }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root:         { display:"flex", flexDirection:"column", height:"100vh", background:"#0a0a0a", color:"#e0e0e0", position:"relative" },
  header:       { display:"flex", alignItems:"center", gap:10, padding:"12px 20px", borderBottom:"1px solid #1a1a1a", background:"#0d0d0d", flexShrink:0 },
  title:        { fontSize:15, fontWeight:600, letterSpacing:0.3 },
  toggleWrap:   { display:"flex", alignItems:"center", gap:8, cursor:"pointer" },
  toggleTrack:  { position:"relative", width:36, height:20, borderRadius:10, transition:"background .2s", cursor:"pointer", flexShrink:0 },
  toggleThumb:  { position:"absolute", top:2, width:16, height:16, borderRadius:8, background:"#fff", transition:"left .2s" },
  messages:     { flex:1, overflowY:"auto", padding:"24px 20px", display:"flex", flexDirection:"column", gap:20, maxWidth:860, width:"100%", margin:"0 auto", boxSizing:"border-box" },
  empty:        { margin:"auto", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center" },

  bubble:       { maxWidth:"75%", borderRadius:16, padding:"12px 16px", fontSize:14, lineHeight:1.7 },
  userBubble:   { background:"#1a3a0a", border:"1px solid #2a5010", borderBottomRightRadius:4, alignSelf:"flex-end" },
  aiBubble:     { background:"transparent", border:"none", padding:"0", alignSelf:"flex-start", maxWidth:"100%" },
  mdBody:       { fontSize:14, lineHeight:1.8, color:"#d4d4d4" },

  thinkingRow:  { display:"flex", alignItems:"center", gap:8, marginBottom:10, height:20 },
  spinner:      { width:14, height:14, border:"2px solid #333", borderTopColor:"#76b900", borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 },

  terminal:     { background:"#111", border:"1px solid #222", borderRadius:10, overflow:"hidden", maxWidth:"75%", width:"100%" },
  terminalHeader: { display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderBottom:"1px solid #1a1a1a", background:"#0d0d0d" },
  terminalDot:  { width:8, height:8, borderRadius:"50%", background:"#76b900" },
  terminalBody: { padding:"10px 14px", fontFamily:"monospace", fontSize:12, color:"#888" },
  mediaPreview: { maxWidth:"100%", maxHeight:200, display:"block", margin:"0 auto 8px" },

  dropOverlay:  { position:"absolute", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:50, color:"#76b900", fontSize:16, border:"2px dashed #76b900", borderRadius:12, margin:16 },

  inputArea:    { borderTop:"1px solid #1a1a1a", padding:"12px 20px 16px", background:"#0d0d0d", flexShrink:0, maxWidth:860, width:"100%", alignSelf:"center", boxSizing:"border-box" },
  attachedFile: { display:"flex", alignItems:"center", justifyContent:"space-between", background:"#1a1a1a", borderRadius:8, padding:"6px 12px", marginBottom:8, fontSize:13, color:"#76b900" },
  removeBtn:    { background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:14, padding:0 },
  inputRow:     { display:"flex", alignItems:"center", gap:8, background:"#161616", border:"1px solid #2a2a2a", borderRadius:14, padding:"6px 10px" },
  iconBtn:      { background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:18, padding:"4px 6px", lineHeight:1, flexShrink:0 },
  textarea:     { flex:1, background:"none", border:"none", color:"#e0e0e0", fontSize:14, resize:"none", fontFamily:"inherit", lineHeight:1.5, maxHeight:120, overflowY:"auto" },
  sendBtn:      { width:32, height:32, borderRadius:"50%", background:"#76b900", border:"none", color:"#000", fontSize:16, fontWeight:700, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" },
};
