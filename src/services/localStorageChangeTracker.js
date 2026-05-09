import { isActiveKey, markLocalDirty } from './localDataStore'

let installed = false

export function installLocalStorageChangeTracker() {
  if (installed) return
  installed = true

  const originalSetItem = localStorage.setItem.bind(localStorage)
  const originalRemoveItem = localStorage.removeItem.bind(localStorage)
  const originalClear = localStorage.clear.bind(localStorage)

  localStorage.setItem = (key, value) => {
    originalSetItem(key, value)
    if (isActiveKey(key)) markLocalDirty()
  }

  localStorage.removeItem = (key) => {
    originalRemoveItem(key)
    if (isActiveKey(key)) markLocalDirty()
  }

  localStorage.clear = () => {
    originalClear()
    markLocalDirty()
  }
}

installLocalStorageChangeTracker()
