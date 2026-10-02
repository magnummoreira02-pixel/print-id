import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { LabelElement, LabelTemplate, RowData } from '@shared/types'

export type ElementKind = LabelElement['type']

/**
 * Estado compartilhado do editor, provido por EtiquetaEditorView.
 * Os filhos mutam o template diretamente (é a cópia local reativa da view);
 * ações estruturais (adicionar/remover/duplicar/ordenar) passam pelas funções.
 */
export interface EditorContext {
  /** Cópia local do template — os filhos só montam quando ela existe */
  template: ComputedRef<LabelTemplate>
  selectedId: Ref<string | null>
  selectedElement: ComputedRef<LabelElement | null>
  /** Colunas reais da matriz (vazio sem matriz) — para o composer de colunas */
  matrixHeaders: ComputedRef<string[]>
  /** Cabeçalhos usados na resolução de valores (matriz ou amostra fixa) */
  headers: ComputedRef<string[]>
  /** Linha de exemplo renderizada no canvas */
  rowData: ComputedRef<RowData>
  hasQr: ComputedRef<boolean>
  select: (id: string | null) => void
  addElement: (kind: ElementKind) => void
  removeElement: (id: string) => void
  duplicateElement: (id: string) => void
  moveElement: (id: string, delta: -1 | 1) => void
}

export const EDITOR_CONTEXT: InjectionKey<EditorContext> = Symbol('etiqueta-editor')

export function useEditorContext(): EditorContext {
  const ctx = inject(EDITOR_CONTEXT)
  if (!ctx) throw new Error('EditorContext ausente: use dentro de EtiquetaEditorView')
  return ctx
}
