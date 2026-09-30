import { useState } from 'react';
import { api, fileToBase64, generateDocument } from '../api/client.js';

const MAX_SIZE_BYTES = 8 * 1024 * 1024;

export function PdfUploadPage() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState('');
  const [generatedDocument, setGeneratedDocument] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(event) {
    const selected = event.target.files?.[0] || null;
    setError('');
    if (selected && !/\.pdf$/i.test(selected.name)) {
      setError('Selecione um arquivo .pdf.');
      setFile(null);
      return;
    }
    if (selected && selected.size > MAX_SIZE_BYTES) {
      setError('O arquivo deve ter no máximo 8MB.');
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setError('Selecione um arquivo PDF.');
      return;
    }
    setError('');
    setReply('');
    setGeneratedDocument(null);
    setSubmitting(true);
    try {
      const contentBase64 = await fileToBase64(file);
      const data = await api.analyzePdf(file.name, contentBase64, question);
      if (data.generatedDocument) {
        setGeneratedDocument(data.generatedDocument);
      } else {
        setReply(data.reply);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload() {
    if (!generatedDocument) return;
    const blob = await generateDocument(generatedDocument.title, generatedDocument.content);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generatedDocument.title}.docx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pdf-page">
      <h1>Analisar documento PDF</h1>
      <form onSubmit={handleSubmit} className="upload-form">
        <label>
          Arquivo PDF (máx. 8MB)
          <input type="file" accept="application/pdf" onChange={handleFileChange} />
        </label>
        <label>
          Dúvida sobre o documento (opcional)
          <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={submitting}>{submitting ? 'Analisando…' : 'Enviar para análise'}</button>
      </form>
      {reply ? (
        <div className="analysis-result">
          <h2>Parecer da IA</h2>
          <p>{reply}</p>
        </div>
      ) : null}
      {generatedDocument ? (
        <div className="document-banner">
          <span>Documento pronto: {generatedDocument.title}</span>
          <button type="button" onClick={handleDownload}>Baixar .docx</button>
        </div>
      ) : null}
    </div>
  );
}
