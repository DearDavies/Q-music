import { closeApis, loadApi, setAllowShowUpdateAlert as setRendererEventAllowShowUpdateAlert, init } from './runtime'
import { getUserApis, importApi as handleImportApi, removeApi as handleRemoveApi, setAllowShowUpdateAlert as saveAllowShowUpdateAlert } from './utils'


let userApiId: string | null
let selectionRevision = 0

export const getApiList = getUserApis

export const importApi = async(script: string): Promise<LX.UserApi.ImportUserApi> => {
  return {
    apiInfo: await handleImportApi(script),
    apiList: getUserApis(),
  }
}
export const removeApi = async(ids: string[]): Promise<LX.UserApi.UserApiInfo[]> => {
  if (userApiId && ids.includes(userApiId)) {
    userApiId = null
  }
  await closeApis(ids)
  handleRemoveApi(ids)
  return getUserApis()
}

export const setApi = async(id: string) => {
  const revision = ++selectionRevision
  if (userApiId) {
    userApiId = null
  }
  await closeApis()
  if (revision !== selectionRevision) return
  userApiId ||= id
  await loadApi(id)
}

export const setAllowShowUpdateAlert = (id: string, enable: boolean) => {
  saveAllowShowUpdateAlert(id, enable)
  setRendererEventAllowShowUpdateAlert(id, enable)
}


export * from './runtime'

export default () => {
  init()

  global.lx.event_app.on('main_window_close', () => {
    void closeApis()
  })
}
