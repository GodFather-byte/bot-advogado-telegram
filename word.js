import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function criarDocx(titulo, conteudo) {
  // Quebra o texto gerado pela IA em parágrafos reais do Word
  const paragrafos = conteudo.split('\n').map(linha => 
    new Paragraph({ children: [new TextRun({ text: linha, size: 24 })] })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ children: [new TextRun({ text: titulo, bold: true, size: 32 })] }),
        new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }), // Espaço em branco
        ...paragrafos
      ],
    }],
  });
  
  // Retorna o arquivo binário pronto para envio
  return await Packer.toBuffer(doc);
}
