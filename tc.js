try {
  const {parseMatrixFile}=require('./src/main/importer.ts');
  parseMatrixFile('X:/arquivo-que-nao-existe.xlsx');
} catch(e) { console.error(e.message); }
