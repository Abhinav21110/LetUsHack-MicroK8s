const crypto = require("crypto");

function create256(inputString: String) {
  const hash = crypto.createHash("sha256");
  hash.update(inputString);
  return hash.digest("hex");
}

export function encrypt(text: String, key: String) {
  const derivedKey = Buffer.from(create256(key), "hex");
  const iv = crypto.createHash("md5").update(derivedKey).digest();
  const cipher = crypto.createCipheriv("aes-256-cbc", derivedKey, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

export function decrypt(encryptedText: String, key: String) {
  const derivedKey = Buffer.from(create256(key), "hex");
  const iv = crypto.createHash("md5").update(derivedKey).digest();
  const decipher = crypto.createDecipheriv("aes-256-cbc", derivedKey, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function checkIfValidEncryption(
  inputString: String,
  encryptedData: String,
  key: String
) {
  const encryptedDataFromInput = encrypt(inputString, key);
  const decryptedDataFromInput = decrypt(encryptedData, key);
  return (
    encryptedDataFromInput === encryptedData &&
    decryptedDataFromInput === inputString
  );
}
