import { decodeYoloOutput, letterbox } from './yolo'

describe('decodeYoloOutput', () => {
  it('keeps a confident box and drops a weak one', () => {
    const channels = 10
    const boxes = 2
    const data = new Float32Array(channels * boxes)
    data[0 * boxes + 0] = 320
    data[1 * boxes + 0] = 320
    data[2 * boxes + 0] = 100
    data[3 * boxes + 0] = 80
    data[(4 + 5) * boxes + 0] = 0.91
    data[0 * boxes + 1] = 100
    data[1 * boxes + 1] = 100
    data[2 * boxes + 1] = 40
    data[3 * boxes + 1] = 40
    data[(4 + 1) * boxes + 1] = 0.1

    const found = decodeYoloOutput({
      data,
      dims: [1, channels, boxes],
      classCount: 6,
      meta: letterbox(640, 640),
      width: 640,
      height: 640,
      minConfidence: 0.35,
    })

    expect(found).toHaveLength(1)
    expect(found[0]?.classId).toBe(5)
    expect(found[0]?.confidence).toBeCloseTo(0.91)
    expect(found[0]?.box[2]).toBeGreaterThan(0.1)
  })

  it('suppresses a weaker overlap of the same class', () => {
    const channels = 10
    const boxes = 2
    const data = new Float32Array(channels * boxes)
    for (const index of [0, 1]) {
      data[0 * boxes + index] = 200
      data[1 * boxes + index] = 200
      data[2 * boxes + index] = 80
      data[3 * boxes + index] = 80
      data[(4 + 0) * boxes + index] = index === 0 ? 0.8 : 0.6
    }
    const found = decodeYoloOutput({
      data,
      dims: [1, channels, boxes],
      classCount: 6,
      meta: letterbox(640, 640),
      width: 640,
      height: 640,
      minConfidence: 0.35,
    })
    expect(found).toHaveLength(1)
    expect(found[0]?.confidence).toBeCloseTo(0.8)
  })
})
