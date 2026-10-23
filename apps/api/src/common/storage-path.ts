import path from 'path'

export function resolveInside(root: string, key: string) {
  if (!key || key.includes('..') || path.isAbsolute(key)) {
    throw new Error('مسار الملف غير صالح')
  }
  const rootResolved = path.resolve(root)
  const full = path.resolve(rootResolved, key)
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
    throw new Error('مسار الملف غير صالح')
  }
  return full
}
