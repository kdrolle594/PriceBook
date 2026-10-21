import { describe, it, expect } from 'vitest'
import { rowBox, boxToRect } from './photos.js'

describe('rowBox', () => {
  it('reads the box after the price', () => {
    expect(rowBox(['rice', 'Rice', '10lb', 9.49, 100, 200, 300, 400])).toEqual([100, 200, 300, 400])
  })

  it('is null when the scan gave no box', () => {
    expect(rowBox(['rice', 'Rice', '10lb', 9.49])).toBeNull()
    expect(rowBox(['rice', 'Rice', '10lb', 9.49, 1, 2, 'x', 4])).toBeNull()
  })

  it('clamps to the image and drops boxes too small to be a photo', () => {
    expect(rowBox(['a', 'A', '', 1, -20, 10, 1200, 990])).toEqual([0, 10, 1000, 990])
    expect(rowBox(['a', 'A', '', 1, 100, 100, 102, 300])).toBeNull()
  })
})

describe('boxToRect', () => {
  it('maps 0–1000 units to pixels', () => {
    expect(boxToRect([250, 500, 750, 1000], 2000, 1000, 0)).toEqual({ x: 500, y: 500, w: 1000, h: 500 })
  })

  it('pads the box but never past the image edge', () => {
    const r = boxToRect([0, 0, 500, 500], 1000, 1000, 0.1)
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
    expect(r.w).toBeCloseTo(550)
    expect(r.h).toBeCloseTo(550)
  })
})
