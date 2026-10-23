import { readFileSync } from 'fs'
import path from 'path'
import { DamageLevel, DefectClass, aggregateDamage, boxCoverage } from '@damage/shared'

const box: [number, number, number, number] = [0.2, 0.2, 0.3, 0.3]

describe('aggregateDamage', () => {
  it('matches the PECCD class keys used for training', () => {
    const classes = JSON.parse(readFileSync(path.join(__dirname, '../../../../ml/classes.json'), 'utf8')) as {
      names: string[]
    }
    expect(DefectClass.map((defect) => defect.key)).toEqual(classes.names)
  })

  it('suggests the worst defect seen across several photos', () => {
    const suggestion = aggregateDamage([
      { imageId: 'a', detections: [{ classId: 1, confidence: 0.7, box }] },
      {
        imageId: 'b',
        detections: [
          { classId: 5, confidence: 0.62, box },
          { classId: 1, confidence: 0.2, box },
        ],
      },
      { imageId: 'c', detections: [{ classId: 5, confidence: 0.8, box }] },
    ])

    expect(suggestion.suggestedLevel).toBe(DamageLevel.CRITICAL)
    expect(suggestion.confidence).toBeGreaterThan(0.8)
    expect(suggestion.coverageRatio).toBeGreaterThan(0)
    expect(suggestion.totals.map((row) => row.key)).toEqual(['holes', 'simple_crack'])
    expect(suggestion.totals[0]?.imageCount).toBe(2)
    expect(suggestion.summary).toContain('ثقوب')
    expect(suggestion.summary).toContain('تغطية')
    expect(suggestion.images[1]?.detections).toHaveLength(1)
  })

  it('does not invent a level when nothing is detected', () => {
    const suggestion = aggregateDamage([
      { imageId: 'a', detections: [{ classId: 1, confidence: 0.1, box }] },
      { imageId: 'b', detections: [] },
    ])
    expect(suggestion.suggestedLevel).toBeNull()
    expect(suggestion.coverageRatio).toBeNull()
    expect(suggestion.summary).toContain('صور')
  })

  it('measures union coverage of overlapping boxes', () => {
    const covered = boxCoverage([
      [0, 0, 0.5, 0.5],
      [0.25, 0.25, 0.5, 0.5],
    ])
    // Exact union is 0.4375; grid approximation stays close.
    expect(covered).toBeGreaterThan(0.4)
    expect(covered).toBeLessThan(0.5)
  })
})
