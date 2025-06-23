import crypto from "crypto";

/**
 * Generates a secure password that meets Google Workspace requirements:
 * - At least 8 characters
 * - Contains uppercase, lowercase, numbers, and special characters
 * - Uses cryptographically secure random generation
 */
export function generateSecurePassword(length: number = 16): string {
  if (length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + special;

  let password = "";
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  return password
    .split("")
    .sort(() => crypto.randomInt(3) - 1)
    .join("");
}
