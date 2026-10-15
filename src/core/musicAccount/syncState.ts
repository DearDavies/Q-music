export interface PlaylistSyncState {
  phase: 'fetch' | 'save' | 'success' | 'error'
  current: number
  total: number
  error?: string
}
let state: Record<string, PlaylistSyncState> = {}
const listeners = new Set<() => void>()
export const getPlaylistSyncState = () => state
export const subscribePlaylistSync = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const setPlaylistSyncState = (id: string, next: PlaylistSyncState) => {
  state = { ...state, [id]: next }
  for (const listener of listeners) listener()
}
