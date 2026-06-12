import { useState, useRef, useEffect } from "react";

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(() => Date.now().toString());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const touchStartX = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const res = await fetch("http://localhost:8000/history");
      const data = await res.json();
      setChats(data);
    } catch (e) {}
  };

  const newChat = () => {
    setCurrentChatId(Date.now().toString());
    setMessages([]);
    setUploadMsg("");
    setSidebarOpen(false);
  };

  const loadChat = (chat) => {
    setCurrentChatId(chat.chat_id);
    setMessages(chat.messages);
    setSidebarOpen(false);
  };

  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    await fetch(`http://localhost:8000/history/${chatId}`, { method: "DELETE" });
    fetchChats();
    if (chatId === currentChatId) newChat();
  };

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setUploadMsg("Uploading...");
    const formData = new FormData();
    formData.append("file", f);
    try {
      const res = await fetch("http://localhost:8000/upload", { method: "POST", body: formData });
      const data = await res.json();
      setUploadMsg("✓ " + data.message);
    } catch (e) { setUploadMsg("Upload failed."); }
  };

  const askQuestion = async () => {
    if (!question.trim() || loading) return;
    const userQuestion = question;
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", text: userQuestion }]);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
    try {
      const res = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userQuestion, chat_id: currentChatId }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", text: fullText };
          return updated;
        });
      }
      fetchChats();
    } catch (e) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", text: "Cannot connect to backend." };
        return updated;
      });
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  // Swipe to open/close sidebar
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 60) setSidebarOpen(true);
    if (diff < -60) setSidebarOpen(false);
  };

  return (
    <div
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={styles.overlay} />
      )}

      {/* Sidebar */}
      <div style={{ ...styles.sidebar, left: sidebarOpen ? "0" : "-260px" }}>
        <div style={styles.logo}>✦ Academic<br />Assistant</div>
        <button onClick={newChat} style={styles.newChatBtn}>+ New Chat</button>
        <div style={styles.sideSection}>
          <p style={styles.sideLabel}>CONVERSATIONS</p>
          {chats.length === 0 && <p style={styles.emptyHistory}>No chats yet</p>}
          {[...chats].reverse().map((chat) => (
            <div
              key={chat.chat_id}
              onClick={() => loadChat(chat)}
              style={{
                ...styles.historyItem,
                background: chat.chat_id === currentChatId ? "#0f172a" : "none",
              }}
            >
              <span style={styles.historyQ}>{chat.title}{chat.title?.length >= 40 ? "..." : ""}</span>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={styles.historyTime}>{chat.time}</span>
                <button onClick={(e) => deleteChat(chat.chat_id, e)} style={styles.deleteBtn}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div style={styles.main}>

        {/* Top bar */}
        <div style={styles.topBar}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={styles.menuBtn}>☰</button>
          <span style={styles.topTitle}>✦ Academic Assistant</span>
          <button onClick={newChat} style={styles.newChatTopBtn}>+ New</button>
        </div>

        <div style={styles.chatArea}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>✦</div>
              <p style={styles.emptyTitle}>Ask me anything academic</p>
              <p style={styles.emptySubtitle}>Upload your notes or type a question below</p>
              <div style={styles.suggestions}>
                {["What is recursion?", "Explain OSI model", "What is Big O notation?", "Explain normalization"].map((s) => (
                  <button key={s} onClick={() => setQuestion(s)} style={styles.suggChip}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: "16px" }}>
              {msg.role === "assistant" && <div style={styles.avatar}>✦</div>}
              <div style={msg.role === "user" ? styles.userBubble : styles.aiBubble}>
                {msg.text || (msg.role === "assistant" && loading ? "▋" : "")}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div style={styles.inputWrapper}>
          {uploadMsg && <p style={styles.uploadMsg}>{uploadMsg}</p>}
          <div style={styles.inputArea}>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} style={{ display: "none" }} />
            <button onClick={() => fileRef.current.click()} style={styles.attachBtn}>⊕</button>
            <textarea
              rows={2}
              placeholder="Ask a question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKey}
              style={styles.textarea}
            />
            <button onClick={askQuestion} disabled={loading} style={styles.sendBtn}>↑</button>
          </div>
          <p style={styles.hint}>Supports PDF, Word (.docx), and TXT files</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { height: "100vh", background: "#030712", fontFamily: "'Segoe UI', sans-serif", overflow: "hidden", position: "relative" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10 },
  sidebar: { position: "fixed", top: 0, left: "-260px", width: "250px", height: "100vh", background: "#0a0f1a", borderRight: "1px solid #111827", padding: "20px 14px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", zIndex: 20, transition: "left 0.25s ease" },
  logo: { color: "#f9fafb", fontSize: "15px", fontWeight: "600", lineHeight: "1.5" },
  newChatBtn: { background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e5e7eb", padding: "8px 12px", cursor: "pointer", fontSize: "12px", textAlign: "left" },
  sideSection: { display: "flex", flexDirection: "column", gap: "6px" },
  sideLabel: { color: "#374151", fontSize: "10px", letterSpacing: "1px", margin: "0 0 4px 0" },
  emptyHistory: { color: "#1f2937", fontSize: "12px" },
  historyItem: { border: "1px solid #111827", borderRadius: "6px", padding: "8px 10px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "3px" },
  historyQ: { color: "#6b7280", fontSize: "12px", lineHeight: "1.4" },
  historyTime: { color: "#1f2937", fontSize: "10px" },
  deleteBtn: { background: "none", border: "none", color: "#374151", cursor: "pointer", fontSize: "14px" },
  main: { display: "flex", flexDirection: "column", height: "100vh" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #0f172a", background: "#030712" },
  menuBtn: { background: "none", border: "none", color: "#6b7280", fontSize: "20px", cursor: "pointer" },
  topTitle: { color: "#f9fafb", fontSize: "14px", fontWeight: "600" },
  newChatTopBtn: { background: "#1e293b", border: "none", borderRadius: "6px", color: "#e5e7eb", padding: "6px 10px", cursor: "pointer", fontSize: "12px" },
  chatArea: { flex: 1, overflowY: "auto", padding: "20px 16px" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px" },
  emptyIcon: { fontSize: "28px", color: "#1e293b" },
  emptyTitle: { color: "#374151", fontSize: "18px", fontWeight: "500", margin: "0" },
  emptySubtitle: { color: "#1f2937", fontSize: "13px", margin: "0" },
  suggestions: { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "8px" },
  suggChip: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: "20px", color: "#4b5563", padding: "6px 14px", cursor: "pointer", fontSize: "12px" },
  avatar: { width: "26px", height: "26px", borderRadius: "8px", background: "#0f172a", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#6b7280", marginRight: "8px", flexShrink: 0 },
  userBubble: { maxWidth: "75%", background: "#1d4ed8", color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "10px 14px", fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" },
  aiBubble: { maxWidth: "80%", background: "#0f172a", border: "1px solid #1e293b", color: "#d1d5db", borderRadius: "16px 16px 16px 4px", padding: "10px 14px", fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" },
  inputWrapper: { padding: "10px 16px 16px", borderTop: "1px solid #0f172a" },
  uploadMsg: { color: "#22c55e", fontSize: "12px", margin: "0 0 6px 0" },
  inputArea: { display: "flex", gap: "8px", alignItems: "flex-end" },
  attachBtn: { width: "38px", height: "38px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", color: "#4b5563", fontSize: "20px", cursor: "pointer" },
  textarea: { flex: 1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", color: "#e5e7eb", fontSize: "14px", padding: "10px 12px", resize: "none", outline: "none", fontFamily: "inherit" },
  sendBtn: { width: "38px", height: "38px", borderRadius: "10px", background: "#1d4ed8", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" },
  hint: { color: "#1f2937", fontSize: "11px", margin: "6px 0 0 0" },
};

export default App;