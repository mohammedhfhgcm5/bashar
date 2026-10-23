import { sniffImage } from './image-sniff'

describe('sniffImage', () => {
  it('accepts jpeg, png, and webp signatures', () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext).toBe('jpg')
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe('image/png')
    const webp = Buffer.alloc(12)
    webp.write('RIFF', 0, 'ascii')
    webp.write('WEBP', 8, 'ascii')
    expect(sniffImage(webp)?.ext).toBe('webp')
  })

  it('rejects other payloads', () => {
    expect(sniffImage(Buffer.from('not an image!!'))).toBeNull()
    expect(sniffImage(Buffer.from([0xff, 0xd8]))).toBeNull()
  })
})
