import { Doc } from '@anticrm/core'
import { onDestroy } from 'svelte'
import { writable } from 'svelte/store'

/**
 * @public
 *
 */
export type SelectDirection = 'vertical' | 'horizontal'

export interface SelectionFocusProvider {
  // * If vertical, next will return item under.
  // * If horizontal, next will return item on right.
  next?: (direction?: SelectDirection) => void
  // * If vertical, next will return item amove.
  // * If horizontal, next will return item on left.
  prev?: (vertical?: SelectDirection) => void

  // Update documents content
  update: (docs: Doc[]) => void

  // Return selection index from list of documents.
  current: (doc?: FocusSelection) => number | undefined

  // Update focused element, selection is not changed.
  updateFocus: (doc: Doc) => void

  // Update curent selection list, focus items it not updated.
  updateSelection: (docs: Doc[], value: boolean) => void

  // Return all selectable documents
  docs: () => Doc[]
}
/**
 * @public
 *
 * Define document selection inside platform.
 */
export interface FocusSelection {
  // Focused document
  focus?: Doc

  // Additional interface to select, next/prev etc.
  provider?: SelectionFocusProvider
}

/**
 * @public
 */
export const focusStore = writable<FocusSelection>({ })
export const selectionStore = writable<Doc[]>([])

export const previewDocument = writable<Doc|undefined>()

/**
 * @public
 */
export function updateFocus (selection?: FocusSelection): void {
  focusStore.update((cur) => {
    const now = Date.now()
    if (selection === undefined || now - ((cur as any).now ?? 0) >= 25) {
      cur.focus = selection?.focus
      cur.provider = selection?.provider
      ;(cur as any).now = now
      previewDocument.update(old => {
        if (old !== undefined) {
          return selection?.focus
        }
      })
    }
    return cur
  })

  // We need to clear selection items not belong to passed provider.
  if (selection?.provider !== undefined) {
    const docs = new Set(selection?.provider.docs().map(it => it._id))
    selectionStore.update((old) => {
      return old.filter(it => docs.has(it._id))
    })
  }
}

/**
 * @public
 *
 * List selection provider
 */
export class ListSelectionProvider implements SelectionFocusProvider {
  _docs: Doc[] = []
  _current?: FocusSelection
  constructor (
    private readonly selectNext: (cur: number, direction?: SelectDirection) => void,
    private readonly selectPrev: (cur: number, direction?: SelectDirection) => void
  ) {
    const unsubscribe = focusStore.subscribe((doc) => {
      this._current = doc
    })
    onDestroy(() => {
      unsubscribe()
      updateFocus(undefined)
    })
  }

  next (direction?: SelectDirection): void {
    this.selectNext(this.current(this._current) ?? 0, direction)
  }

  prev (direction?: SelectDirection): void {
    this.selectPrev(this.current(this._current) ?? this._docs.length - 1, direction)
  }

  update (docs: Doc[]): void {
    this._docs = docs

    if (this._docs.length > 0) {
      if (this._current === undefined) {
        updateFocus({
          focus: this._docs[0],
          provider: this
        })
      } else {
        // Check if we don't have object, we need to select first one.
        if (this._docs.findIndex((it) => it._id === this._current?.focus?._id) === -1) {
          updateFocus({ focus: this._docs[0], provider: this })
        }
      }
    }
  }

  docs (): Doc[] {
    return this._docs
  }

  updateFocus (doc: Doc): void {
    updateFocus({ focus: doc, provider: this })
  }

  updateSelection (docs: Doc[], value: boolean): void {
    selectionStore.update((selection) => {
      const docsSet = new Set(docs.map(it => it._id))
      const noDocs = selection.filter((it) => !docsSet.has(it._id))
      return value
        ? [...noDocs, ...docs]
        : noDocs
    })
  }

  current (doc?: FocusSelection): number | undefined {
    return this._docs.findIndex((it) => it._id === doc?.focus?._id)
  }
}