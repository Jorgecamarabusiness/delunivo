import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  consumeVerificationCodeWithRpc,
  issueVerificationCodeWithRpc,
  type VerificationCodeRpcClient,
} from "./verificationCodeRpc.ts";

type RpcReply = { data: unknown; error: { message?: string } | null };

function fakeRpc(
  reply: RpcReply
): VerificationCodeRpcClient & {
  calls: Array<[string, Record<string, string>]>;
} {
  const calls: Array<[string, Record<string, string>]> = [];
  return {
    calls,
    async rpc(name, params) {
      calls.push([name, params]);
      return reply;
    },
  };
}

describe("verification codes RPC contract", () => {
  test("emite solo tras la confirmación atómica y normaliza los argumentos", async () => {
    const rpc = fakeRpc({ data: "issued", error: null });
    const result = await issueVerificationCodeWithRpc(
      rpc,
      "  ALUMNA@EXAMPLE.COM ",
      "signup",
      () => "042931"
    );

    assert.deepEqual(result, { code: "042931", error: null });
    assert.equal(rpc.calls.length, 1);
    assert.equal(rpc.calls[0][0], "issue_verification_code");
    assert.equal(rpc.calls[0][1].p_email, "alumna@example.com");
    assert.equal(rpc.calls[0][1].p_purpose, "signup");
    assert.match(rpc.calls[0][1].p_code_hash, /^[a-f0-9]{64}$/);
  });

  test("no devuelve un código si la RPC falla, limita o devuelve un estado desconocido", async () => {
    for (const reply of [
      { data: null, error: { message: "unavailable" } },
      { data: "rate_limited_email", error: null },
      { data: "unexpected", error: null },
    ]) {
      const result = await issueVerificationCodeWithRpc(
        fakeRpc(reply),
        "alumna@example.com",
        "signup",
        () => "042931"
      );
      assert.equal(result.code, "");
      assert.notEqual(result.error, null);
    }
  });

  test("rechaza códigos que no tengan exactamente seis dígitos sin invocar la RPC", async () => {
    const rpc = fakeRpc({ data: { status: "consumed" }, error: null });
    const result = await consumeVerificationCodeWithRpc(
      rpc,
      "alumna@example.com",
      "signup",
      "12 34-56"
    );

    assert.match(result.error ?? "", /6 dígitos/);
    assert.equal(rpc.calls.length, 0);
  });

  test("traduce los intentos que la RPC serializada contabiliza de forma secuencial", async () => {
    const replies: RpcReply[] = [
      { data: { status: "incorrect", attempts_left: 4 }, error: null },
      { data: { status: "incorrect", attempts_left: 3 }, error: null },
      { data: { status: "too_many_attempts" }, error: null },
    ];
    const rpc: VerificationCodeRpcClient = {
      async rpc() {
        return (
          replies.shift() ?? {
            data: { status: "too_many_attempts" },
            error: null,
          }
        );
      },
    };

    assert.match(
      (await consumeVerificationCodeWithRpc(rpc, "a@b.com", "signup", "000001"))
        .error ?? "",
      /4 intentos/
    );
    assert.match(
      (await consumeVerificationCodeWithRpc(rpc, "a@b.com", "signup", "000001"))
        .error ?? "",
      /3 intentos/
    );
    assert.match(
      (await consumeVerificationCodeWithRpc(rpc, "a@b.com", "signup", "000001"))
        .error ?? "",
      /Demasiados intentos/
    );
  });

  test("las llamadas concurrentes delegan el consumo único en el repositorio RPC", async () => {
    let consumed = false;
    let tail = Promise.resolve();
    const rpc: VerificationCodeRpcClient = {
      async rpc() {
        let reply: RpcReply = { data: { status: "missing" }, error: null };
        // Repositorio falso serializado: modela el contrato de la RPC, sin
        // afirmar que esta prueba haya ejercitado una base de datos real.
        tail = tail.then(() => {
          if (!consumed) {
            consumed = true;
            reply = { data: { status: "consumed" }, error: null };
          }
        });
        await tail;
        return reply;
      },
    };

    const results = await Promise.all([
      consumeVerificationCodeWithRpc(rpc, "a@b.com", "signup", "042931"),
      consumeVerificationCodeWithRpc(rpc, "a@b.com", "signup", "042931"),
    ]);

    assert.equal(results.filter((result) => result.error === null).length, 1);
    assert.equal(results.filter((result) => result.error !== null).length, 1);
  });
});
