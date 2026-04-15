const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require("crypto")

const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const MOCK_URL = process.env.MOCK_URL || 'http://localhost:3001'
const TEST_USERNAME = process.env.TEST_USERNAME || "luca-meier"
const TEST_PASSWORD = process.env.TEST_PASSWORD || "cust001"
const PRODUCT_ID = process.env.PRODUCT_ID || "PROD001"


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

test('customer login works with valid credentials', async () => {
    const res = await fetch(`${APP_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: TEST_USERNAME,
            password: TEST_PASSWORD
        })
    })

    assert.equal(res.status, 200)

    const data = await res.json()
    assert.ok(!data.error)
    assert.ok(data.userId)
})

test('customer login fails with invalid credentials', async () => {
    const res = await fetch(`${APP_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: TEST_USERNAME,
            password: 'tttttttt'
        })
    })

    const data = await res.json()
    assert.ok(data.error)
})

test('product fetch returns product data', async () => {
    const res = await fetch(`${APP_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prod_id: PRODUCT_ID
        })
    })

    assert.equal(res.status, 200)

    const data = await res.json()
    assert.ok(!data.error)
    assert.ok(data.price)
    assert.ok(data.currency)
})

test('payment flow reaches a terminal state', async () => {
    const customerRes = await fetch(`${APP_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: TEST_USERNAME,
            password: TEST_PASSWORD
        })
    })
    const customer = await customerRes.json()
    assert.ok(customer.userId)

    const productRes = await fetch(`${APP_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prod_id: PRODUCT_ID
        })
    })
    const product = await productRes.json()
    assert.ok(product.price)

    const idempotencyKey = crypto.randomUUID();
    const paymentRes = await fetch(`${APP_URL}/payments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
            userId: customer.userId,
            amount: parseInt(product.price, 10),
            currency: product.currency
        })
    })

    const paymentData = await paymentRes.json()


    assert.ok(!paymentData.error, `Payments returned error: ${paymentData.error}`)
    assert.ok(paymentData.paymentId)
    assert.ok(paymentData.checkoutUrl)

    const checkoutUrl = new URL(paymentData.checkoutUrl)
    const gatewayPaymentId = checkoutUrl.searchParams.get('gatewayPaymentId')

    assert.ok(gatewayPaymentId)

    const mockRes = await fetch(`${MOCK_URL}/payment_data_colected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'following_payment_details_for_the_following_payment_target',
            paymentId: paymentData.paymentId,
            gatewayPaymentId,
            card_number: '4111111111111111',
            card_holder_name: 'Luca Meier',
            expiry_date: '12/28',
            cvv: '123'
        })
    })

    assert.equal(mockRes.status, 200)

    let finalStatus = null

    for (let i = 0; i < 30; i++) {
        const pollRes = await fetch(`${APP_URL}/payments/${paymentData.paymentId}`)
        const pollData = await pollRes.json()

        finalStatus = pollData.payment_data?.status || null

        if (finalStatus === 'CAPTURED' || finalStatus === 'FAILED') {
            break
        }

        await sleep(1000)
    }

    assert.ok(finalStatus === 'CAPTURED' || finalStatus === 'FAILED')
})