const fs = require('fs')
const path = require('path')

const source =
  process.env.PECCD_SOURCE ||
  'D:\\Post-earthquake concrete crack dataset (PECCD)\\Post-earthquake concrete crack dataset (PECCD)\\SyrianPostEarthquakeCrackDataset'
const out = path.join(__dirname, 'datasets', 'peccd')
const classes = JSON.parse(fs.readFileSync(path.join(__dirname, 'classes.json'), 'utf8'))
const copyRe = /copy|\(\d+\)/i

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(items, random) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

function linkOrCopy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  if (fs.existsSync(to)) fs.rmSync(to)
  try {
    fs.linkSync(from, to)
  } catch {
    fs.copyFileSync(from, to)
  }
}

const files = fs.readdirSync(source)
const images = files.filter((file) => /\.jpe?g$/i.test(file) && !copyRe.test(file))
const rarity = [5, 4, 2, 3, 0, 1]
const buckets = new Map()

for (const image of images) {
  const stem = image.replace(/\.[^.]+$/, '')
  const labelPath = path.join(source, `${stem}.txt`)
  if (!fs.existsSync(labelPath)) continue
  const present = new Set()
  for (const line of fs.readFileSync(labelPath, 'utf8').trim().split(/\r?\n/)) {
    const classId = Number(line.trim().split(/\s+/)[0])
    if (Number.isInteger(classId)) present.add(classId)
  }
  const primary = rarity.find((classId) => present.has(classId)) ?? 0
  const group = buckets.get(primary) ?? []
  group.push({ image, stem })
  buckets.set(primary, group)
}

const splits = { train: [], val: [], test: [] }
const random = mulberry32(2026)
for (const group of buckets.values()) {
  const ordered = shuffle(group, random)
  const valCount = Math.max(1, Math.round(ordered.length * 0.1))
  const testCount = Math.max(1, Math.round(ordered.length * 0.1))
  splits.val.push(...ordered.slice(0, valCount))
  splits.test.push(...ordered.slice(valCount, valCount + testCount))
  splits.train.push(...ordered.slice(valCount + testCount))
}

for (const split of Object.keys(splits)) {
  fs.rmSync(path.join(out, 'images', split), { recursive: true, force: true })
  fs.rmSync(path.join(out, 'labels', split), { recursive: true, force: true })
  for (const item of splits[split]) {
    linkOrCopy(path.join(source, item.image), path.join(out, 'images', split, item.image))
    linkOrCopy(path.join(source, `${item.stem}.txt`), path.join(out, 'labels', split, `${item.stem}.txt`))
  }
}

const names = classes.names.map((name, index) => `  ${index}: ${name}`).join('\n')
const yaml = `path: ${out.replace(/\\/g, '/')}\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n${names}\n`
fs.writeFileSync(path.join(out, 'data.yaml'), yaml)
console.log(
  JSON.stringify(
    {
      train: splits.train.length,
      val: splits.val.length,
      test: splits.test.length,
      out,
    },
    null,
    2,
  ),
)
