# Changelog

## 0.1.0 — 2026-10-02

Primeira versão publicada (o app já estava em uso interno).

### Funcionalidades

- **Importação da matriz** de `.xlsx`, `.xls` e `.csv`, com tratamento de encoding (UTF-8, UTF-16,
  latin1), cabeçalhos duplicados ou vazios e conversão numérica que preserva zeros à esquerda.
- **Bipagem**: campo com foco permanente, busca pela coluna de ID (tolerante a zeros à esquerda),
  impressão automática das linhas encontradas e histórico da sessão.
- **Tela de dados**: tabela da matriz com filtro, paginação, edição de célula e exportação para
  `.xlsx`/`.csv`.
- **Impressão silenciosa** via `webContents.print` em janela oculta, com tamanho de página em mm e
  fallback para o papel configurado no driver.
- **Modelos de etiqueta por elementos** posicionados em mm (campo, texto, caixa, QR code), com
  campos semânticos que sobrevivem à troca de nome das colunas entre safras.
- **Editor visual de etiquetas**: arrastar, redimensionar, snap, zoom, desfazer/refazer (100
  passos), copiar/colar via clipboard do sistema e escala proporcional ao mudar as medidas.
- **Biblioteca de modelos**: criar, duplicar, renomear, ativar, exportar e importar (`.json`).
- **Configurações**: impressora, coluna de bipagem, número de cópias, preview da etiqueta e card de
  sistema (versão, backend de armazenamento, pasta de dados, reset de fábrica, desinstalar).
- **Armazenamento** em SQLite (`better-sqlite3`) com fallback automático para JSON.
- Tema escuro (padrão) e claro; atalhos `F1`/`F2`/`F3` entre as telas.
- Migração automática dos dados da versão anterior do app ("Magnun Etiquetas").

### Pendências conhecidas

- Impressão validada apenas via driver do Windows; falta teste de campo na térmica definitiva
  (eventual evolução para ZPL cru).
- Sem testes automatizados — validação é manual (ver checklist em `docs/DESENVOLVIMENTO.md`).
