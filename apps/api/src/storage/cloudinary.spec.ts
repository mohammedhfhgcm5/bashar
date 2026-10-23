import { parseCloudinaryUrl, publicIdFromDeliveryUrl, signCloudinary } from './cloudinary'

describe('cloudinary', () => {
  it('parses the dashboard URL', () => {
    expect(parseCloudinaryUrl('cloudinary://123456:s3cr3t@demo-cloud')).toEqual({
      cloudName: 'demo-cloud',
      apiKey: '123456',
      apiSecret: 's3cr3t',
    })
  })

  it('signs parameters in alphabetical order', () => {
    const signature = signCloudinary(
      { timestamp: '1315060510', public_id: 'sample' },
      'abcd',
    )
    expect(signature).toBe(
      signCloudinary({ public_id: 'sample', timestamp: '1315060510' }, 'abcd'),
    )
    expect(signature).toHaveLength(40)
  })

  it('reads the public id from a delivery URL', () => {
    expect(
      publicIdFromDeliveryUrl(
        'https://res.cloudinary.com/demo/image/upload/v1312461204/damage/report.jpg',
      ),
    ).toBe('damage/report')
  })
})