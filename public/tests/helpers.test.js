const test = require('node:test')
const assert = require('node:assert/strict')

function percentile(arr, p) {
    if (!arr || arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => a - b)
    const idx = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, idx)]
}

function isAllowedTransition(from, to) {
    const allowed = {
        CREATED: ['PENDING', 'AUTHORIZED', 'FAILED'],
        PENDING: ['AUTHORIZED', 'FAILED'],
        AUTHORIZED: ['CAPTURED', 'FAILED'],
        CAPTURED: ['REFUNDED'],
        FAILED: [],
        REFUNDED: []
    }

    return !!allowed[from]?.includes(to)
}

test('percentile returns null for empty array', () => {
    assert.equal(percentile([], 95), null)
})

test('percentile returns correct p95', () => {
    assert.equal(percentile([1, 2, 3, 4, 5], 95), 5)
})

test('percentile returns correct p99', () => {
    assert.equal(percentile([10, 20, 30, 40, 50], 99), 50)
})

test('valid transition AUTHORIZED -> CAPTURED', () => {
    assert.equal(isAllowedTransition('AUTHORIZED', 'CAPTURED'), true)
})

test('invalid transition CAPTURED -> FAILED', () => {
    assert.equal(isAllowedTransition('CAPTURED', 'FAILED'), false)
})