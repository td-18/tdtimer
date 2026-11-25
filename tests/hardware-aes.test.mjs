import test from "node:test";
import assert from "node:assert/strict";
import { cbcDecrypt, cbcEncrypt, decryptBlockBytes, encryptBlockBytes } from "../src/hardware/aes.js";
import { createEncrypter } from "../src/hardware/protocols/gan.js";

function hex(text) {
    return Uint8Array.from(text.replace(/\s+/g, "").match(/.{2}/g), (pair) => parseInt(pair, 16));
}

function toHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

test("AES-128 单块：FIPS-197 附录 C.1 向量", () => {
    const key = hex("000102030405060708090a0b0c0d0e0f");
    const plain = hex("00112233445566778899aabbccddeeff");
    const cipher = encryptBlockBytes(plain, key);
    assert.equal(toHex(cipher), "69c4e0d86a7b0430d8cdb78070b4c55a");
    assert.equal(toHex(decryptBlockBytes(cipher, key)), toHex(plain));
});

test("AES-128-CBC：NIST SP 800-38A F.2.1 首块向量", () => {
    const key = hex("2b7e151628aed2a6abf7158809cf4f3c");
    const iv = hex("000102030405060708090a0b0c0d0e0f");
    const plain = hex("6bc1bee22e409f96e93d7e117393172a");
    const cipher = cbcEncrypt(plain, key, iv);
    assert.equal(toHex(cipher), "7649abac8119b246cee98e9b12e9197d");
    assert.equal(toHex(cbcDecrypt(cipher, key, iv)), toHex(plain));
});

test("AES-128-CBC：多块往返", () => {
    const key = hex("2b7e151628aed2a6abf7158809cf4f3c");
    const iv = hex("000102030405060708090a0b0c0d0e0f");
    const plain = hex("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51");
    const cipher = cbcEncrypt(plain, key, iv);
    assert.notEqual(toHex(cipher), toHex(plain));
    assert.equal(toHex(cbcDecrypt(cipher, key, iv)), toHex(plain));
});

test("GAN 密钥派生：MAC 倒序叠加，模 255", () => {
    const encrypter = createEncrypter("11:22:33:44:55:66");
    // 盐 = 66 55 44 33 22 11
    assert.equal(encrypter.key[0], (0x01 + 0x66) % 0xff);
    assert.equal(encrypter.key[5], (0x91 + 0x11) % 0xff);
    assert.equal(encrypter.iv[0], (0x11 + 0x66) % 0xff);
    // 第 7 字节起不参与叠加
    assert.equal(encrypter.key[6], 0x16);
});

test("GAN 16 / 20 字节消息加解密往返", () => {
    const encrypter = createEncrypter("AA:BB:CC:DD:EE:FF");
    const short = Uint8Array.from({ length: 16 }, (_v, i) => i);
    assert.deepEqual(encrypter.decrypt(encrypter.encrypt(short)), short);

    const long = Uint8Array.from({ length: 20 }, (_v, i) => i * 3 + 1);
    assert.deepEqual(encrypter.decrypt(encrypter.encrypt(long)), long);
});

test("GAN 消息长度不足 16 字节时拒绝处理", () => {
    const encrypter = createEncrypter("AA:BB:CC:DD:EE:FF");
    assert.throws(() => encrypter.encrypt(new Uint8Array(8)));
    assert.throws(() => encrypter.decrypt(new Uint8Array(12)));
    assert.throws(() => createEncrypter("not-a-mac"), /无效的 MAC/);
});
