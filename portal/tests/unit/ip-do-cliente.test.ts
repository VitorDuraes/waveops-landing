import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ipDoCliente } from "../../src/lib/ip-do-cliente";

// IP usado no limite de volume por IP e no hash do visitante. Cabeçalho que o cliente
// controla não pode decidir a chave, senão cada requisição forjada ganha um balde novo.

describe("ipDoCliente", () => {
  test("sem Cloudflare na frente, CF-Connecting-IP é ignorado (o cliente forja)", () => {
    const h = new Headers({ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "203.0.113.7" });
    assert.equal(ipDoCliente(h, false), "203.0.113.7");
  });

  test("com Cloudflare declarado, CF-Connecting-IP vale", () => {
    const h = new Headers({ "cf-connecting-ip": " 198.51.100.2 ", "x-real-ip": "203.0.113.7" });
    assert.equal(ipDoCliente(h, true), "198.51.100.2");
  });

  test("Cloudflare declarado mas sem o cabeçalho: segue para o x-real-ip", () => {
    assert.equal(ipDoCliente(new Headers({ "x-real-ip": "203.0.113.7" }), true), "203.0.113.7");
  });

  test("sem x-real-ip, vale o ÚLTIMO x-forwarded-for, posto pelo proxy mais próximo", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.1, 203.0.113.9" });
    assert.equal(ipDoCliente(h, false), "203.0.113.9");
  });

  test("sem nenhum cabeçalho", () => {
    assert.equal(ipDoCliente(new Headers(), false), "desconhecido");
    assert.equal(ipDoCliente(new Headers({ "x-forwarded-for": " , " }), false), "desconhecido");
  });
});
