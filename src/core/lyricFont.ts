import { NativeModules } from 'react-native'
import { updateSetting } from '@/core/common'

export interface ImportedLyricFont { family: string, name: string }
const native = NativeModules.LyricFontModule as {
  load: () => Promise<ImportedLyricFont | null>
  importFont: (path: string) => Promise<ImportedLyricFont>
} | undefined
let imported: ImportedLyricFont | null = null
export const getImportedLyricFont = () => imported
export const getLyricFontFamily = (font: string): string | undefined => {
  if (font == 'serif' || font == 'monospace' || font == imported?.family) return font
  return undefined
}

export const initLyricFont = async() => {
  try { imported = await native?.load() ?? null } catch { imported = null }
}

export const importLyricFont = async(path: string) => {
  if (!native) throw new Error('Font module unavailable')
  const next = await native.importFont(path)
  imported = next
  updateSetting({ 'playDetail.style.font': next.family })
  return next
}
