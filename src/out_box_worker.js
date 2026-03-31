const mail = "lighting-pay@djordjenikolic.ch"
const password = "L_123456789"
const nodemailer = require("nodemailer")
const pool = require("./postgres_db")
const PDFDocument = require("pdfkit")

//*******************************************************************************************************************
function create_pdf(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks = []

    doc.on("data", chunk => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const fullName = `${payload.first_name || ""} ${payload.last_name || ""}`.trim()
    const fullAddress = [
      payload.address || "",
      `${payload.zip_code || ""} ${payload.town || ""}`.trim()
    ].filter(Boolean)

    doc.fontSize(20).text("Payment Receipt", { align: "center" })
    doc.moveDown(2)
      doc.fontSize(12).text(`Dear ${payload.first_name || payload.last_name || ""}, thank you for purchasing ${payload.product_name || "our product"}!`)
    doc.moveDown(2)
    doc.fontSize(12).text("Customer:")
    doc.moveDown(0.5)
    doc.text(`Name: ${fullName}`)
    doc.text(`Address: ${fullAddress[0] || ""}`)
    doc.text(`ZIP / Town: ${fullAddress[1] || ""}`)
    doc.text(`Email: ${payload.email || ""}`)

    doc.moveDown(1.5)
    doc.text("Payment")
    doc.moveDown(0.5)
    doc.text(`Amount: ${payload.amount || ""}`)
    doc.text(`Currency: ${payload.currency || ""}`)
    //doc.text(`Price: ${payload.price || ""}`)

    doc.moveDown(1.5)
    doc.text(`Created at: ${new Date().toISOString()}`)

    doc.end()
  })
}

//*******************************************************************************************************************
const transporter = nodemailer.createTransport({
  host: "send.one.com",
  port: 465,
  secure: true,
  auth: {
    user: mail,
    pass: password
  }
})

async function check_out_box() {
  try {
    console.log("checking outbox at", new Date().toISOString())

    const result = await pool.query(`
      SELECT *
      FROM outbox
      WHERE status = 'PENDING'
        AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
      LIMIT 10
    `)

    console.log("rows found:", result.rows.length)

    for (const row of result.rows) {

        try {

            const payload = row.payload;
            console.log("payload done")
            const email = payload.email;
            console.log("email done")
            const pdfBuffer = await create_pdf(payload);
            console.log("pdfBuffer done")
            await transporter.sendMail({
                from: mail,
                to: email,
                subject: "Your receipt",
                text: "Thanks for your payment.",
                attachments: [
                    {
                        filename: "receipt.pdf",
                        content: pdfBuffer
                    }
                ]
            })
            console.log("email sent")
            await pool.query(`
                UPDATE outbox
                SET status = 'SENT',
                    next_attempt_at = NOW(),
                    attempts = attempts + 1
                WHERE id = $1
            `, [row.id])
            console.log("sent email to", email)

        }
        catch {
            await pool.query(`
                UPDATE outbox
                SET status = 'FAILED',
                    next_attempt_at = NOW(),
                    attempts = attempts + 1
                WHERE id = $1
            `, [row.id])
        }
    }
  } catch (err) {
    console.error("worker error:", err)
  }
}

setInterval(check_out_box, 15000)

console.log("worker started")
check_out_box()

