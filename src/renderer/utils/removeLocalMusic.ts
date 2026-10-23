import { shell } from 'electron'
import { lstat } from 'node:fs/promises'
import { isAbsolute, extname } from 'node:path'
import { localAudioExtensions } from '@common/utils/localMusicFiles'

export const trashLocalMusic = async(music: LX.Music.MusicInfoLocal) => {
  const file = music.meta.filePath
  const extension = extname(file)
  if (!isAbsolute(file) || !localAudioExtensions.includes(extension.slice(1).toLowerCase())) throw new Error('Invalid local audio path')
  const stem = file.slice(0, -extension.length)
  const files: string[] = []
  // 仅处理所选音频及同名歌词，不递归删除目录，也不跟随链接。
  for (const target of [`${stem}.lrc`, `${stem}.tlrc`, `${stem}.rlrc`, `${file}.lrc`, file]) {
    let stat
    try { stat = await lstat(target) } catch (err: any) { if (err.code == 'ENOENT') continue; throw err }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Not a regular audio or lyric file')
    files.push(target)
  }
  for (const target of files) await shell.trashItem(target)
}
