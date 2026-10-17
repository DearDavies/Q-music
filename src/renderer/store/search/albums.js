import { httpFetch } from '@renderer/utils/request'
import { toNewMusicInfo } from '@renderer/utils'
import qqSearch from '@renderer/utils/musicSdk/tx/musicSearch'
import { signRequest } from '@renderer/utils/musicSdk/tx/utils'
import { eapiRequest } from '@renderer/utils/musicSdk/wy/utils'
import wyDetail from '@renderer/utils/musicSdk/wy/musicDetail'
import { getMusicInfosByList } from '@renderer/utils/musicSdk/kg/musicInfo'
import { withBrowseTimeout } from '../browseRequest'

export const albumSources = ['tx', 'wy', 'kg']
const limit = 20
const imageUrl = value => typeof value == 'string' ? value.replace(/^http:/, 'https:').replace('{size}', '240') : ''
const dateText = value => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const searchSource = async(text, source, page) => {
  let rows, total, map
  switch (source) {
    case 'tx': {
      const data = await qqSearch.musicSearch(text, page, limit, 0, 2)
      if (data.meta?.is_filter < 0) throw new Error('Album search rejected')
      rows = data.body?.item_album
      total = Number(data.meta?.sum || data.meta?.estimate_sum)
      map = item => ({ id: item.albummid, name: item.name, singer: item.singer, date: item.publish_date, count: item.song_num, pic: imageUrl(item.pic) })
      break
    }
    case 'wy': {
      const { body } = await eapiRequest('/api/cloudsearch/pc', { s: text, type: 10, limit, offset: (page - 1) * limit, total: true }).promise
      if (body.code != 200) throw new Error('Album search rejected')
      rows = body.result?.albums ?? (body.result?.albumCount === 0 ? [] : null)
      total = Number(body.result?.albumCount)
      map = item => ({ id: String(item.id), name: item.name, singer: (item.artists || [item.artist]).map(artist => artist?.name).filter(Boolean).join('、'), date: dateText(item.publishTime), count: item.size, pic: imageUrl(item.picUrl) })
      break
    }
    case 'kg': {
      const { body } = await httpFetch(`http://mobilecdn.kugou.com/api/v3/search/album?keyword=${encodeURIComponent(text)}&page=${page}&pagesize=${limit}`).promise
      if (body.status != 1) throw new Error('Album search rejected')
      rows = body.data?.info
      total = Number(body.data?.total)
      map = item => ({ id: String(item.albumid), name: item.albumname, singer: item.singername, date: item.publishtime?.slice(0, 10), count: item.songcount, pic: imageUrl(item.imgurl) })
      break
    }
    default: throw new Error('Unsupported album source')
  }
  if (!Array.isArray(rows)) throw new Error('Invalid album search response')
  const list = rows.map(map).filter(item => item.id && item.name).map(item => ({ ...item, source }))
  return { list, hasMore: rows.length == limit && (!Number.isFinite(total) || page * limit < total) }
}

export const searchAlbums = async(text, source, page = 1) => {
  const sources = source == 'all' ? albumSources : [source]
  const results = await Promise.allSettled(sources.map(async(id) => withBrowseTimeout(searchSource(text, id, page))))
  const successful = results.filter(item => item.status == 'fulfilled').map(item => item.value)
  if (!successful.length) throw new Error('Album search failed')
  // 聚合按各平台原排序交错展示，同名专辑保留平台标识，不混并不同发行版本。
  const list = []
  for (let index = 0; index < limit; index++) {
    for (const result of successful) if (result.list[index]) list.push(result.list[index])
  }
  return { list, hasMore: successful.some(item => item.hasMore), failedSources: sources.filter((_, index) => results[index].status == 'rejected') }
}

const loadTracks = async(source, id) => {
  const deadline = Date.now() + 40_000
  if (!albumSources.includes(source) || !/^[a-z\d]+$/i.test(id)) throw new Error('Invalid album')
  if (source == 'wy') {
    const { body } = await eapiRequest(`/api/v1/album/${id}`, { id }).promise
    if (body.code != 200 || !Array.isArray(body.songs)) throw new Error('Album detail failed')
    const ids = body.songs.map(song => song.id)
    const songs = []
    for (let offset = 0; offset < ids.length; offset += 200) {
      if (Date.now() >= deadline) throw new Error('Album request timed out')
      const { body: detail } = await eapiRequest('/api/v3/song/detail', { c: JSON.stringify(ids.slice(offset, offset + 200).map(id => ({ id }))) }).promise
      if (detail.code != 200 || !Array.isArray(detail.songs) || !Array.isArray(detail.privileges)) throw new Error('Album song detail failed')
      songs.push(...wyDetail.filterList(detail))
    }
    // 详情接口的返回顺序可能不同于曲目顺序。
    const byId = new Map(songs.map(song => [String(song.songmid), song]))
    if (ids.some(id => !byId.has(String(id)))) throw new Error('Incomplete album')
    return ids.map(id => byId.get(String(id)))
  }
  const rows = []
  const seen = new Set()
  for (let page = 1; page <= 50; page++) {
    if (Date.now() >= deadline) throw new Error('Album request timed out')
    let items, total
    if (source == 'tx') {
      const { body } = await signRequest({ comm: { ct: 24, cv: 0, uin: 0, format: 'json' }, req: { module: 'music.musichallAlbum.AlbumSongList', method: 'GetAlbumSongList', param: { albumMid: id, albumID: 0, begin: (page - 1) * 100, num: 100 } } })
      if (body.code != 0 || body.req?.code != 0) throw new Error('Album detail failed')
      items = body.req.data?.songList?.map(item => item.songInfo)
      total = Number(body.req.data?.totalNum)
    } else {
      const { body } = await httpFetch(`http://mobiles.kugou.com/api/v3/album/song?version=9108&albumid=${id}&plat=0&pagesize=100&area_code=0&page=${page}&with_res_tag=0`).promise
      if (body.errcode != 0) throw new Error('Album detail failed')
      items = body.data?.info
      total = Number(body.data?.total)
    }
    if (!Array.isArray(items) || !Number.isFinite(total)) throw new Error('Invalid album detail')
    for (const item of items) {
      const key = source == 'tx' ? item.mid : item.hash
      if (!key || seen.has(key)) throw new Error('Repeated album page')
      seen.add(key)
      rows.push(item)
    }
    if (rows.length >= total) {
      if (source == 'tx') {
        rows.sort((a, b) => (a.index_cd - b.index_cd) || (a.index_album - b.index_album))
        const songs = qqSearch.handleResult(rows)
        if (songs.length != rows.length) throw new Error('Incomplete album')
        return songs
      }
      const songs = await getMusicInfosByList(rows)
      const byHash = new Map(songs.map(song => [song.hash?.toLowerCase(), song]))
      if (rows.some(song => !byHash.has(song.hash.toLowerCase()))) throw new Error('Incomplete album')
      return rows.map(song => byHash.get(song.hash.toLowerCase()))
    }
    if (!items.length) throw new Error('Incomplete album')
  }
  throw new Error('Album page limit exceeded')
}

export const getAlbumTracks = async(source, id) => {
  const songs = await withBrowseTimeout(loadTracks(source, id), 40_000)
  return songs.map(song => toNewMusicInfo(song))
}
