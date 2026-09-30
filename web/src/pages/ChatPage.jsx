import { useEffect, useRef, useState } from 'react';
import { api, generateDocument } from '../api/client.js';

export function ChatPage() {
  const [cases, setCases] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pendingDocument, setPendingDocument] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.listCases().then((data) => {
      setCases(data.cases);
      const active = data.cases.find((c) => c.isActive);
      if (active) setActiveCaseId(active.id);
    }).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!activeCaseId) {
      setMessages([]);
      return;
    }
    api.caseMessages(activeCaseId).then((data) => setMessages(data.messages)).catch((err) => setError(err.message));
  }, [activeCaseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;

    setError('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setPendingDocument(null);

    try {
      const data = await api.chat(text, activeCaseId || undefined);
      if (data.generatedDocument) {
        setPendingDocument(data.generatedDocument);
        setMessages((prev) => [...prev, { role: 'model', text: `📄 Documento gerado: "${data.generatedDocument.title}". Use o botão abaixo para baixar.` }]);
      } else {
        setMessages((prev) => [...prev, { role: 'model', text: data.reply }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleDownload() {
    if (!pendingDocument) return;
    try {
      const blob = await generateDocument(pendingDocument.title, pendingDocument.content);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pendingDocument.title}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="chat-page">
      <h1>Chat Jurídico</h1>
      <div className="case-selector">
        <label>
          Caso ativo:
          <select value={activeCaseId} onChange={(e) => setActiveCaseId(e.target.value)}>
            <option value="">Sem caso (conversa geral)</option>
            {cases.map((item) => (
              <option key={item.id} value={item.id}>#{item.number} — {item.title}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="chat-window">
        {messages.map((message, index) => (
          <div key={index} className={`bubble ${message.role}`}>{message.text}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      {pendingDocument ? (
        <div className="document-banner">
          <span>Documento pronto: {pendingDocument.title}</span>
          <button type="button" onClick={handleDownload}>Baixar .docx</button>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <form onSubmit={handleSend} className="chat-input">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua dúvida jurídica…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
        />
        <button type="submit" disabled={sending}>{sending ? 'Enviando…' : 'Enviar'}</button>
      </form>
    </div>
  );
}
