const crypto = require("crypto");


const secret_key = process.env.SECRET_KEY;
console.log("SECRET_KEY exists?", !!process.env.SECRET_KEY);

function secrets(raw_body) {
    const y = typeof raw_body === "string" ? raw_body : JSON.stringify(raw_body);
  return crypto.createHmac("sha256", secret_key).update(y).digest("hex")
}
function check_signatures(new_sig, raw_body) {
    const want_sig = secrets(raw_body);
    const a = Buffer.from(new_sig, "hex");
    const b = Buffer.from(want_sig, "hex");

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new Error("Signatures do not match");
    }
}

module.exports = { check_signatures, secrets };