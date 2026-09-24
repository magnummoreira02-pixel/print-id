# Print ID – Etiquetas

App desktop Windows para bipagem com impressão automática Zebra (ZPL).

## Stack
- Vite + React + TypeScript + Zustand
- xlsx (SheetJS) para import/export
- ZPL II gerado e enviado RAW (spooler ou TCP 9100)
- Electron (opcional) para instalador .exe
- Persistência localStorage (compatível com SQLite better-sqlite3 em Electron)

## Rodar
```bash
cd print-id
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm run electron:build  # instalador Windows (requer electron-builder)
```

## Funcionalidades
- **Bipagem (F1)**: campo mira verde, foco automático, Enter dispara busca <50ms via índice Map, beep sucesso/erro, reimpressão, histórico sessão + permanente, export CSV
- **Dados (F2)**: import xlsx/csv, tabela com busca global, ordenação, paginação 100, duplo clique para editar, add/delete
- **Configurações (F3)**: modelos de etiqueta, página 45,5×18mm 2 colunas, preview real, editor drag-and-drop, ZPL com ^XA/^PW/^LL/^FO/^BQ/^BC/^GB, impressora Zebra (ZD220/ZT410/ZT411), TCP 9100 / spooler RAW, teste e calibrar ~JC

## Atalhos
F1 Bipagem | F2 Dados | F3 Configurações

## Exemplo
`exemplos/matriz_exemplo_20_linhas.xlsx` – 20 linhas para teste (ID RM-001 … RM-020)

## Modelo padrão
45,5 × 18 mm, 2 colunas, gap 3mm, 14 elementos, QR + textos vinculados

## Pasta de dados
`%APPDATA%\print-id` (quando em Electron com SQLite) – no modo web usa localStorage `print-id-storage`

## Tema
Escuro #0a0d10 padrão, botão MODO CLARO/ESCURO no rodapé da sidebar, destaque #a3e635, perigo #ef4444, mono JetBrains Mono
