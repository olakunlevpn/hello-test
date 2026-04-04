import { encrypt, decrypt } from "../encryption";

describe("encryption", () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY =
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("encrypts and decrypts a string back to original", () => {
    const plaintext = "this-is-a-secret-refresh-token-value";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "same-input-different-output";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("throws on tampered ciphertext", () => {
    const plaintext = "tamper-test";
    const encrypted = encrypt(plaintext);
    const tampered = encrypted.slice(0, -4) + "XXXX";
    expect(() => decrypt(tampered)).toThrow();
  });
});
