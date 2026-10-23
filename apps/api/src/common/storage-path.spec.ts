import os from 'os'
import path from 'path'
import { resolveInside } from './storage-path'

describe('resolveInside', () => {
  const root = path.join(os.tmpdir(), 'damage-uploads')

  it('keeps a relative key inside the upload root', () => {
    const full = resolveInside(root, path.join('report', 'a.jpg'))
    expect(full.startsWith(path.resolve(root))).toBe(true)
  })

  it('rejects traversal and absolute keys', () => {
    expect(() => resolveInside(root, '..\\secret.txt')).toThrow()
    expect(() => resolveInside(root, path.join('a', '..', '..', 'secret.txt'))).toThrow()
    expect(() => resolveInside(root, path.resolve(root, '..', 'secret.txt'))).toThrow()
  })
})
