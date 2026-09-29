import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function criarDocx(titulo, conteudo) {
  const paragrafos = String(conteudo || '')
    .split(/\r?\n/)
    .map((linha) => new Paragraph({ children: [new TextRun({ text: linha, size: 24 })] }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ children: [new TextRun({ text: titulo, bold: true, size: 32 })] }),
        new Paragraph({ children: [new TextRun({ text: '', size: 24 })] }),
        ...paragrafos,
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
