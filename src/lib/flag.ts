import { encrypt, decrypt, checkIfValidEncryption } from "@/lib/encryption";

export function createFlag(email: String, key: String) {
  const flagValue = encrypt(email, key);
  const flag = `flag{${flagValue}}`;
  return flag;
}

export function checkFlag(email: String, flag: String, key: String) {
  const encryptedValue = flag.substring(5, flag.length - 1);
  const decryptedValue = decrypt(encryptedValue, key);
  if (
    decryptedValue === email &&
    checkIfValidEncryption(decryptedValue, encryptedValue, key)
  ) {
    return {
      error: false,
      message: "The flag is valid",
      success: true,
      valid: true,
    };
  } else {
    return {
      error: true,
      message: "The flag is wrong or not valid",
      success: false,
      valid: false,
    };
  }
}
