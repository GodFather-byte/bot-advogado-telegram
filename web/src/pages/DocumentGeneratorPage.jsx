import { useState } from 'react';
import { generateDocument } from '../api/client.js';

export function DocumentGeneratorPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const blob = await generateDocument(title, content);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title || 'documento'}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="document-generator-page">
      <h1>Gerar documento (.docx)</h1>
      <p>Crie contratos, procurações, petições e outros documentos a partir de um texto. Revise sempre com um advogado antes de utilizar.</p>
      <form onSubmit={handleSubmit} className="document-form">
        <label>
          Título
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Conteúdo
          <textarea rows={12} required value={content} onChange={(e) => setContent(e.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={submitting}>{submitting ? 'Gerando…' : 'Gerar e baixar'}</button>
      </form>
    </div>
  );
}
