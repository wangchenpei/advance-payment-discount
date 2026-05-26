/** 解析利率字符串：支持 5%、0.05、逗号/空格/换行分隔 */
export function parseRates(input: string): number[] {
  const raw = input
    .split(/[\s,;，；]+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  const rates: number[] = [];
  for (const token of raw) {
    let v: number;
    if (token.endsWith("%")) {
      v = Number(token.slice(0, -1)) / 100;
    } else {
      v = Number(token);
    }
    if (!Number.isFinite(v)) {
      throw new Error(`无法解析利率：「${token}」`);
    }
    rates.push(v);
  }
  return rates;
}

/**
 * 名义总保费 total，分 n 年等额缴，每期 P = total/n。
 * 第 0 时刻从实缴 X 扣 P，余额按 r[0] 滚一年再扣 P，… 共 n-1 个利率；
 * 第 n-1 年末余额须等于 P（最后一期由账户支付）。
 * 倒推得 X。
 */
export function solveLumpSum(total: number, n: number, rates: number[]): number {
  if (!Number.isFinite(total) || total < 0) {
    throw new Error("名义保费须为非负有限数");
  }
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("年数须为不小于 1 的整数");
  }

  const P = total / n;
  if (n === 1) {
    if (rates.length > 0) {
      throw new Error("分 1 年交时不应再填写计息利率（无计息期）");
    }
    return total;
  }

  if (rates.length !== n - 1) {
    throw new Error(
      `分期年数为 ${n} 时，需要恰好 ${n - 1} 个年利率，当前为 ${rates.length} 个`,
    );
  }

  for (let i = 0; i < rates.length; i++) {
    const r = rates[i];
    if (!Number.isFinite(r) || r <= -1) {
      throw new Error(`第 ${i + 1} 个利率须为大于 -1 的有限数（当前为 ${r}）`);
    }
  }

  let B = P;
  for (let k = rates.length - 1; k >= 0; k--) {
    const r = rates[k];
    B = (B + P) / (1 + r);
  }
  return B + P;
}

/** 正向验算：返回各年末余额（含初始扣款后） */
export function forwardLedger(
  X: number,
  P: number,
  rates: number[],
): { label: string; balance: number }[] {
  const rows: { label: string; balance: number }[] = [];
  let B = X - P;
  rows.push({ label: "第 0 期扣款后账户余额", balance: B });

  for (let i = 0; i < rates.length; i++) {
    const r = rates[i];
    B = B * (1 + r) - P;
    rows.push({
      label: `第 ${i + 1} 年末（先按 ${(r * 100).toFixed(4)}% 计息再扣一期）`,
      balance: B,
    });
  }
  return rows;
}

function formatMoney(n: number): string {
  return (
    n.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " 元"
  );
}

const el = (id: string) => document.getElementById(id)!;

function run(): void {
  const err = el("error") as HTMLElement;
  const res = el("result") as HTMLElement;
  err.hidden = true;
  res.hidden = true;
  err.textContent = "";

  try {
    const nominal = Number((el("nominal") as HTMLInputElement).value);
    const years = Math.round(Number((el("years") as HTMLInputElement).value));
    const rates = parseRates((el("rates") as HTMLTextAreaElement).value);

    const X = solveLumpSum(nominal, years, rates);
    const P = nominal / years;
    const save = nominal - X;
    const ledger = forwardLedger(X, P, rates);

    (el("outInstallment") as HTMLElement).textContent = formatMoney(P);
    (el("outLump") as HTMLElement).textContent = formatMoney(X);
    (el("outSave") as HTMLElement).textContent = formatMoney(save);

    const warn = el("outWarn") as HTMLElement;
    if (save < 0) {
      warn.hidden = false;
      warn.textContent =
        "提示：在当前利率与约束下，倒推出的实缴一次性金额高于名义总保费。通常出现在各年利率过低或为 0 的情形；请核对利率与业务含义是否与您的合同一致。";
    } else {
      warn.hidden = true;
      warn.textContent = "";
    }

    const lines = ledger.map(
      (r) => `${r.label}：${r.balance.toLocaleString("zh-CN", { maximumFractionDigits: 6 })}`,
    );
    (el("outSteps") as HTMLElement).textContent = lines.join("\n");

    res.hidden = false;
  } catch (e) {
    err.textContent = e instanceof Error ? e.message : String(e);
    err.hidden = false;
  }
}

(el("calc") as HTMLButtonElement).addEventListener("click", run);
run();
